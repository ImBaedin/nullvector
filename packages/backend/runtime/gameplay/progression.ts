import {
	getProgressionOverview as getSharedProgressionOverview,
	getQuestDefinition,
	type FeatureAccessState,
	type FeatureKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import { resolveCurrentPlayer } from "./shared";

const featureAccessStateValidator = v.union(
	v.literal("hidden"),
	v.literal("locked"),
	v.literal("unlocked"),
);

const featureMapValidator = v.object({
	contracts: featureAccessStateValidator,
	raids: featureAccessStateValidator,
	colonization: featureAccessStateValidator,
	fleet: featureAccessStateValidator,
	shipyard: featureAccessStateValidator,
	defenses: featureAccessStateValidator,
	notifications: featureAccessStateValidator,
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
	contractRules: v.object({
		visibleSlots: v.number(),
		activeLimit: v.number(),
		difficultyTier: v.number(),
	}),
	raidRules: v.object({
		enabled: v.boolean(),
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
	source: "contract" | "quest";
}) {
	void args.source;
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	await args.ctx.db.patch(progression._id, {
		rankXpTotal: progression.rankXpTotal + Math.max(0, Math.floor(args.amount)),
		updatedAt: Date.now(),
	});
}

async function getQuestTrackerCount(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerQuestStates")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
		.collect();
	const claimableRows = await args.ctx.db
		.query("playerQuestStates")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "claimable"))
		.collect();
	return rows.length + claimableRows.length;
}

function mapFeatures(features: Record<FeatureKey, FeatureAccessState>) {
	return {
		contracts: features.contracts,
		raids: features.raids,
		colonization: features.colonization,
		fleet: features.fleet,
		shipyard: features.shipyard,
		defenses: features.defenses,
		notifications: features.notifications,
	};
}

export async function buildProgressionOverview(args: {
	ctx: QueryCtx | MutationCtx;
	player: { _id: Id<"players">; displayName: string };
}) {
	const [progression, questTrackerCount] = await Promise.all([
		args.ctx.db
			.query("playerProgression")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.player._id))
			.unique(),
		getQuestTrackerCount({ ctx: args.ctx, playerId: args.player._id }),
	]);
	const current = progression ?? defaultPlayerProgression(args.player._id);
	const overview = getSharedProgressionOverview({
		rankXpTotal: current.rankXpTotal,
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
		contractRules: overview.contractRules,
		raidRules: overview.raidRules,
	};
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
