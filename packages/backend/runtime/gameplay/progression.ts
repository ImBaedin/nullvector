import {
	getProgressionOverview as getSharedProgressionOverview,
	getQuestDefinition,
	getRankDefinition,
	type FeatureAccessState,
	type FeatureKey,
	type FacilityKey,
	type MissionKey,
	type ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import { resolveCurrentPlayer } from "./shared";

const featureAccessStateValidator = v.union(
	v.literal("hidden"),
	v.literal("locked"),
	v.literal("unlocked"),
);

const featureMapValidator = v.object({
	overview: featureAccessStateValidator,
	contracts: featureAccessStateValidator,
	raids: featureAccessStateValidator,
	colonization: featureAccessStateValidator,
	facilities: featureAccessStateValidator,
	fleet: featureAccessStateValidator,
	shipyard: featureAccessStateValidator,
	defenses: featureAccessStateValidator,
	notifications: featureAccessStateValidator,
});

const facilityAccessValidator = v.object({
	robotics_hub: featureAccessStateValidator,
	shipyard: featureAccessStateValidator,
	defense_grid: featureAccessStateValidator,
});

const shipAccessValidator = v.object({
	smallCargo: featureAccessStateValidator,
	largeCargo: featureAccessStateValidator,
	colonyShip: featureAccessStateValidator,
	interceptor: featureAccessStateValidator,
	frigate: featureAccessStateValidator,
	cruiser: featureAccessStateValidator,
	bomber: featureAccessStateValidator,
});

const missionAccessValidator = v.object({
	contracts: featureAccessStateValidator,
	colonize: featureAccessStateValidator,
	transport: featureAccessStateValidator,
});

const progressionOverviewValidator = v.object({
	playerId: v.id("players"),
	displayName: v.string(),
	credits: v.number(),
	rank: v.number(),
	rankXpTotal: v.number(),
	xpIntoCurrentRank: v.number(),
	xpToNextRank: v.union(v.number(), v.null()),
	nextRank: v.union(v.number(), v.null()),
	nextRankXpRequired: v.union(v.number(), v.null()),
	colonyCap: v.number(),
	questTrackerCount: v.number(),
	features: featureMapValidator,
	facilityAccess: facilityAccessValidator,
	shipAccess: shipAccessValidator,
	missionAccess: missionAccessValidator,
	contractRules: v.object({
		visibleSlots: v.number(),
		activeLimit: v.number(),
		difficultyTier: v.number(),
	}),
	raidRules: v.object({
		mode: v.union(v.literal("off"), v.literal("tutorialOnly"), v.literal("full")),
		difficultyTier: v.number(),
	}),
});

function defaultPlayerProgression(playerId: Id<"players">) {
	return {
		playerId,
		credits: 0,
		rankXpTotal: 0,
	};
}

async function reconcileNpcRaidSchedulesAfterProgressionChange(args: {
	ctx: MutationCtx;
	nextRankXpTotal: number;
	playerId: Id<"players">;
	previousRankXpTotal: number;
}) {
	const previousOverview = getSharedProgressionOverview({
		rankXpTotal: args.previousRankXpTotal,
	});
	const nextOverview = getSharedProgressionOverview({
		rankXpTotal: args.nextRankXpTotal,
	});
	if (previousOverview.raidRules.mode === nextOverview.raidRules.mode) {
		return;
	}
	await args.ctx.scheduler.runAfter(0, internal.raids.reconcileNpcRaidSchedulesForPlayer, {
		playerId: args.playerId,
	});
}
export async function ensurePlayerProgression(args: {
	ctx: MutationCtx | QueryCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("playerProgression")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
	if (existing) {
		return existing;
	}
	if (!("patch" in args.ctx.db)) {
		throw new ConvexError("Player progression row missing");
	}
	const now = Date.now();
	const progressionId = await args.ctx.db.insert("playerProgression", {
		playerId: args.playerId,
		credits: 0,
		rankXpTotal: 0,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(progressionId);
	if (!inserted) {
		throw new ConvexError("Failed to create player progression");
	}
	return inserted;
}

export async function grantPlayerCredits(args: {
	amount: number;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const now = Date.now();
	await args.ctx.db.patch(progression._id, {
		credits: progression.credits + Math.max(0, Math.floor(args.amount)),
		updatedAt: now,
	});
}

export async function grantProgressionXp(args: {
	amount: number;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const previousRankXpTotal = deriveRankXpTotal(args.playerId, progression);
	const nextRankXpTotal = previousRankXpTotal + Math.max(0, Math.floor(args.amount));
	await args.ctx.db.patch(progression._id, {
		rankXpTotal: nextRankXpTotal,
		updatedAt: Date.now(),
	});
	await reconcileNpcRaidSchedulesAfterProgressionChange({
		ctx: args.ctx,
		nextRankXpTotal,
		playerId: args.playerId,
		previousRankXpTotal,
	});
}

async function getQuestTrackerCount(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerQuestStates")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId))
		.collect();
	return rows.filter((row) => row.status === "active" || row.status === "claimable").length;
}

function mapFeatures(features: Record<FeatureKey, FeatureAccessState>) {
	return {
		overview: features.overview,
		contracts: features.contracts,
		raids: features.raids,
		colonization: features.colonization,
		facilities: features.facilities,
		fleet: features.fleet,
		shipyard: features.shipyard,
		defenses: features.defenses,
		notifications: features.notifications,
	};
}

function formatAccessError(label: string, access: FeatureAccessState) {
	return access === "hidden" ? `${label} is not available yet` : `${label} is locked`;
}

function deriveRankXpTotal(
	playerId: Id<"players">,
	progression:
		| {
				rankXpTotal?: number;
				rank?: number;
				rankXp?: number;
		  }
		| null
		| undefined,
) {
	if (typeof progression?.rankXpTotal === "number" && Number.isFinite(progression.rankXpTotal)) {
		return Math.max(0, Math.floor(progression.rankXpTotal));
	}
	if (typeof progression?.rank === "number" || typeof progression?.rankXp === "number") {
		const legacyRank = Math.max(0, Math.floor(progression?.rank ?? 0));
		const legacyXp = Math.max(0, Math.floor(progression?.rankXp ?? 0));
		return getRankDefinition(legacyRank).totalXpRequired + legacyXp;
	}
	return defaultPlayerProgression(playerId).rankXpTotal;
}

async function loadProgressionState(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const progression = await args.ctx.db
		.query("playerProgression")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
	const current = progression ?? defaultPlayerProgression(args.playerId);
	return {
		current,
		rankXpTotal: deriveRankXpTotal(args.playerId, progression),
	};
}

export async function buildProgressionRules(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const { rankXpTotal } = await loadProgressionState(args);
	return getSharedProgressionOverview({
		rankXpTotal,
	});
}

export async function buildProgressionOverview(args: {
	ctx: QueryCtx | MutationCtx;
	player: { _id: Id<"players">; displayName: string };
}) {
	const [{ current, rankXpTotal }, questTrackerCount] = await Promise.all([
		loadProgressionState({
			ctx: args.ctx,
			playerId: args.player._id,
		}),
		getQuestTrackerCount({ ctx: args.ctx, playerId: args.player._id }),
	]);
	const overview = getSharedProgressionOverview({
		rankXpTotal,
		questTrackerCount,
	});
	return {
		playerId: args.player._id,
		displayName: args.player.displayName,
		credits: current.credits,
		rank: overview.rank,
		rankXpTotal: overview.rankXpTotal,
		xpIntoCurrentRank: overview.xpIntoCurrentRank,
		xpToNextRank: overview.xpToNextRank,
		nextRank: overview.nextRank,
		nextRankXpRequired: overview.nextRankXpRequired,
		colonyCap: overview.colonyCap,
		questTrackerCount: overview.questTrackerCount,
		features: mapFeatures(overview.features),
		facilityAccess: overview.facilityAccess,
		shipAccess: overview.shipAccess,
		missionAccess: overview.missionAccess,
		contractRules: overview.contractRules,
		raidRules: overview.raidRules,
	};
}

export function requireFeatureAccess(args: {
	featureKey: FeatureKey;
	label: string;
	progression: Awaited<ReturnType<typeof buildProgressionRules>>;
}) {
	const access = args.progression.features[args.featureKey];
	if (access !== "unlocked") {
		throw new ConvexError(formatAccessError(args.label, access));
	}
}

export function requireFacilityAccess(args: {
	facilityKey: FacilityKey;
	label: string;
	progression: Awaited<ReturnType<typeof buildProgressionRules>>;
}) {
	const access = args.progression.facilityAccess[args.facilityKey];
	if (access !== "unlocked") {
		throw new ConvexError(formatAccessError(args.label, access));
	}
}

export function requireShipAccess(args: {
	label: string;
	progression: Awaited<ReturnType<typeof buildProgressionRules>>;
	shipKey: ShipKey;
}) {
	const access = args.progression.shipAccess[args.shipKey];
	if (access !== "unlocked") {
		throw new ConvexError(formatAccessError(args.label, access));
	}
}

export function requireMissionAccess(args: {
	label: string;
	missionKey: MissionKey;
	progression: Awaited<ReturnType<typeof buildProgressionRules>>;
}) {
	const access = args.progression.missionAccess[args.missionKey];
	if (access !== "unlocked") {
		throw new ConvexError(formatAccessError(args.label, access));
	}
}

export const getOverview = query({
	args: {},
	returns: progressionOverviewValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		return buildProgressionOverview({
			ctx,
			player: playerResult.player,
		});
	},
});

export const backfillPlayerProgression = mutation({
	args: {
		token: v.string(),
	},
	returns: v.object({
		created: v.number(),
	}),
	handler: async (ctx, args) => {
		const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
		if (!configuredToken) {
			throw new ConvexError("UNIVERSE_GEN_TOKEN is not configured");
		}
		if (args.token !== configuredToken) {
			throw new ConvexError("Invalid token");
		}
		const players = await ctx.db.query("players").collect();
		let created = 0;
		for (const player of players) {
			const existing = await ctx.db
				.query("playerProgression")
				.withIndex("by_player_id", (q) => q.eq("playerId", player._id))
				.unique();
			if (existing) {
				continue;
			}
			await ensurePlayerProgression({
				ctx,
				playerId: player._id,
			});
			created += 1;
		}
		return { created };
	},
});

export function requireQuestDefinition(questId: string) {
	const definition = getQuestDefinition(questId as never);
	if (!definition) {
		throw new ConvexError(`Unknown quest definition: ${questId}`);
	}
	return definition;
}
