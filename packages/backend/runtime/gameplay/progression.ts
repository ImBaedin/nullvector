import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import { computeNextNpcRaidAt, RAID_MIN_PLAYER_RANK } from "./raidScheduling";
import { resolveCurrentPlayer } from "./shared";

export const playerProgressionValidator = v.object({
	playerId: v.id("players"),
	credits: v.number(),
	rank: v.number(),
	rankXp: v.number(),
});

function defaultPlayerProgression(playerId: Id<"players">) {
	return {
		playerId,
		credits: 0,
		rank: 1,
		rankXp: 0,
	};
}

function nextRankXpRequirement(rank: number) {
	return Math.max(100, Math.round(100 * Math.pow(1.4, Math.max(0, rank - 1))));
}

async function reconcileNpcRaidSchedulesAfterRankChange(args: {
	ctx: MutationCtx;
	nextRank: number;
	playerId: Id<"players">;
	previousRank: number;
}) {
	const crossedRaidThreshold =
		(args.previousRank < RAID_MIN_PLAYER_RANK) !== (args.nextRank < RAID_MIN_PLAYER_RANK);
	if (!crossedRaidThreshold) {
		return;
	}

	const colonies = await args.ctx.db
		.query("colonies")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	const now = Date.now();
	const raidsEnabled = args.nextRank >= RAID_MIN_PLAYER_RANK;
	for (const colony of colonies) {
		const nextNpcRaidAt = raidsEnabled
			? colony.nextNpcRaidAt ??
				computeNextNpcRaidAt({
					anchorAt: now,
					colonyId: colony._id,
				})
			: undefined;
		await args.ctx.db.patch(colony._id, {
			nextNpcRaidAt,
			updatedAt: now,
		});
	}
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
		rank: 1,
		rankXp: 0,
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

export async function grantPlayerRankXp(args: {
	amount: number;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	let rank = progression.rank;
	let rankXp = progression.rankXp + Math.max(0, Math.floor(args.amount));

	while (rankXp >= nextRankXpRequirement(rank)) {
		rankXp -= nextRankXpRequirement(rank);
		rank += 1;
	}

	await args.ctx.db.patch(progression._id, {
		rank,
		rankXp,
		updatedAt: Date.now(),
	});
	await reconcileNpcRaidSchedulesAfterRankChange({
		ctx: args.ctx,
		nextRank: rank,
		playerId: args.playerId,
		previousRank: progression.rank,
	});
}

export async function changePlayerRankXp(args: {
	amount: number;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	let rank = progression.rank;
	let rankXp = progression.rankXp + Math.floor(args.amount);

	while (rankXp >= nextRankXpRequirement(rank)) {
		rankXp -= nextRankXpRequirement(rank);
		rank += 1;
	}

	while (rankXp < 0 && rank > 1) {
		rank -= 1;
		rankXp += nextRankXpRequirement(rank);
	}

	rankXp = Math.max(0, rankXp);

	await args.ctx.db.patch(progression._id, {
		rank,
		rankXp,
		updatedAt: Date.now(),
	});
	await reconcileNpcRaidSchedulesAfterRankChange({
		ctx: args.ctx,
		nextRank: rank,
		playerId: args.playerId,
		previousRank: progression.rank,
	});
}

export const getPlayerProgression = query({
	args: {},
	returns: playerProgressionValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const progression = await ctx.db
			.query("playerProgression")
			.withIndex("by_player_id", (q) => q.eq("playerId", playerResult.player._id))
			.unique();
		if (!progression) {
			return defaultPlayerProgression(playerResult.player._id);
		}
		return {
			playerId: progression.playerId,
			credits: progression.credits,
			rank: progression.rank,
			rankXp: progression.rankXp,
		};
	},
});

export const getPlayerProfile = query({
	args: {},
	returns: v.object({
		displayName: v.string(),
		rank: v.number(),
		rankXp: v.number(),
		credits: v.number(),
	}),
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const progression = await ctx.db
			.query("playerProgression")
			.withIndex("by_player_id", (q) => q.eq("playerId", playerResult.player._id))
			.unique();
		return {
			displayName: playerResult.player.displayName,
			rank: progression?.rank ?? 1,
			rankXp: progression?.rankXp ?? 0,
			credits: progression?.credits ?? 0,
		};
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
