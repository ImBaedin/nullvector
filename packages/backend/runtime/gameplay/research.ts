import {
	buildResearchModifierSnapshot,
	canResearchNodeStart,
	getResearchNode,
	rollMetaMatterBundle,
	type MetaMatterBundle,
	type ResearchKey,
	type ResearchLevelMap,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "../../convex/_generated/server";
import { scaledUnits } from "./shared";
import { getOwnedColony, resolveCurrentPlayer, upsertColonyCompanionRows } from "./shared";

const metaMatterValidator = v.object({
	common: v.number(),
	rare: v.number(),
	mythic: v.number(),
});

const researchQueueStatusValidator = v.union(
	v.literal("queued"),
	v.literal("active"),
	v.literal("completed"),
	v.literal("cancelled"),
	v.literal("failed"),
);

const researchStateViewValidator = v.object({
	playerId: v.id("players"),
	colonyId: v.id("colonies"),
	levels: v.record(v.string(), v.number()),
	balances: metaMatterValidator,
	combinedResearchCapacity: v.number(),
	localResearchFacilityLevel: v.number(),
	activeResearch: v.union(
		v.object({
			queueItemId: v.id("playerResearchQueueItems"),
			researchKey: v.string(),
			fromLevel: v.number(),
			toLevel: v.number(),
			status: researchQueueStatusValidator,
			queuedAt: v.number(),
			startsAt: v.number(),
			completesAt: v.number(),
			costMetaMatter: metaMatterValidator,
			costResources: v.object({
				alloy: v.number(),
				crystal: v.number(),
				fuel: v.number(),
			}),
		}),
		v.null(),
	),
});

function emptyMetaMatter(): MetaMatterBundle {
	return {
		common: 0,
		rare: 0,
		mythic: 0,
	};
}

function cloneMetaMatter(bundle: Partial<MetaMatterBundle> | undefined): MetaMatterBundle {
	return {
		common: Math.max(0, Math.floor(bundle?.common ?? 0)),
		rare: Math.max(0, Math.floor(bundle?.rare ?? 0)),
		mythic: Math.max(0, Math.floor(bundle?.mythic ?? 0)),
	};
}

function pickCanonicalRow<T extends { _creationTime: number }>(rows: T[]) {
	if (rows.length === 0) {
		return null;
	}
	rows.sort((left, right) => left._creationTime - right._creationTime);
	return rows[0]!;
}

async function getPlayerResearchStateRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchState")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getPlayerResearchBalancesRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchBalances")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getPlayerResearchSchedulingRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchScheduling")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getOpenResearchQueueRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await Promise.all([
		args.ctx.db
			.query("playerResearchQueueItems")
			.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
			.collect(),
		args.ctx.db
			.query("playerResearchQueueItems")
			.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "queued"))
			.collect(),
	]);
	return pickCanonicalRow(rows[0]) ?? pickCanonicalRow(rows[1]) ?? null;
}

export async function ensurePlayerResearchState(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await getPlayerResearchStateRow(args);
	if (existing) {
		return existing;
	}
	if (!("patch" in args.ctx.db)) {
		return {
			_id: undefined,
			playerId: args.playerId,
			levels: {},
			unlockedAtByKey: {},
			createdAt: 0,
			updatedAt: 0,
		} as const;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchState", {
		playerId: args.playerId,
		levels: {},
		unlockedAtByKey: {},
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

export async function ensurePlayerResearchBalances(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await getPlayerResearchBalancesRow(args);
	if (existing) {
		return existing;
	}
	if (!("patch" in args.ctx.db)) {
		return {
			_id: undefined,
			playerId: args.playerId,
			...emptyMetaMatter(),
			createdAt: 0,
			updatedAt: 0,
		} as const;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchBalances", {
		playerId: args.playerId,
		...emptyMetaMatter(),
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

async function ensurePlayerResearchScheduling(args: { ctx: MutationCtx; playerId: Id<"players"> }) {
	const existing = await getPlayerResearchSchedulingRow(args);
	if (existing) {
		return existing;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchScheduling", {
		playerId: args.playerId,
		resolutionScheduledAt: undefined,
		resolutionJobId: undefined,
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

export async function loadPlayerResearchLevels(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}): Promise<ResearchLevelMap> {
	const row = await ensurePlayerResearchState(args);
	return { ...(row.levels ?? {}) };
}

export async function loadPlayerResearchModifierSnapshot(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	return buildResearchModifierSnapshot(await loadPlayerResearchLevels(args));
}

export async function getEffectiveResearchCapacity(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const colonies = await args.ctx.db
		.query("colonies")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	let total = 0;
	for (const colony of colonies) {
		const infraRows = await args.ctx.db
			.query("colonyInfrastructure")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
			.collect();
		total += Math.max(0, pickCanonicalRow(infraRows)?.buildings.researchDirectorateLevel ?? 0);
	}
	return total;
}

async function upsertPlayerResearchScheduling(args: {
	ctx: MutationCtx;
	now: number;
	playerId: Id<"players">;
	patch: Partial<
		Pick<Doc<"playerResearchScheduling">, "resolutionJobId" | "resolutionScheduledAt">
	>;
}) {
	const row = await ensurePlayerResearchScheduling({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (row._id) {
		await args.ctx.db.patch(row._id, {
			...args.patch,
			updatedAt: args.now,
		});
	}
}

async function cancelScheduledResearchIfPresent(args: {
	ctx: MutationCtx;
	jobId: Id<"_scheduled_functions"> | undefined;
}) {
	if (!args.jobId) {
		return;
	}
	await args.ctx.scheduler.cancel(args.jobId);
}

export async function reconcileResearchSchedule(args: {
	ctx: MutationCtx;
	force?: boolean;
	playerId: Id<"players">;
	skipCancel?: boolean;
}) {
	const scheduling = await ensurePlayerResearchScheduling({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const activeRows = await args.ctx.db
		.query("playerResearchQueueItems")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
		.collect();
	const active = pickCanonicalRow(activeRows);
	if (!active) {
		if (!args.skipCancel) {
			await cancelScheduledResearchIfPresent({
				ctx: args.ctx,
				jobId: scheduling.resolutionJobId,
			});
		}
		await upsertPlayerResearchScheduling({
			ctx: args.ctx,
			now: Date.now(),
			playerId: args.playerId,
			patch: {
				resolutionJobId: undefined,
				resolutionScheduledAt: undefined,
			},
		});
		return { nextDueAt: null as number | null };
	}
	if (
		!args.force &&
		scheduling.resolutionScheduledAt === active.completesAt &&
		scheduling.resolutionJobId !== undefined
	) {
		return { nextDueAt: active.completesAt };
	}
	if (!args.skipCancel) {
		await cancelScheduledResearchIfPresent({
			ctx: args.ctx,
			jobId: scheduling.resolutionJobId,
		});
	}
	const runAt = Math.max(Date.now(), active.completesAt);
	const jobId = await args.ctx.scheduler.runAt(runAt, internal.scheduler.resolvePlayerResearch, {
		playerId: args.playerId,
		scheduledAt: active.completesAt,
	});
	await upsertPlayerResearchScheduling({
		ctx: args.ctx,
		now: Date.now(),
		playerId: args.playerId,
		patch: {
			resolutionJobId: jobId,
			resolutionScheduledAt: active.completesAt,
		},
	});
	return { nextDueAt: active.completesAt };
}

export async function grantMetaMatter(args: {
	amounts: Partial<MetaMatterBundle>;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const row = await ensurePlayerResearchBalances({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (!row._id) {
		throw new ConvexError("Research balances row missing");
	}
	await args.ctx.db.patch(row._id, {
		common: row.common + Math.max(0, Math.floor(args.amounts.common ?? 0)),
		rare: row.rare + Math.max(0, Math.floor(args.amounts.rare ?? 0)),
		mythic: row.mythic + Math.max(0, Math.floor(args.amounts.mythic ?? 0)),
		updatedAt: Date.now(),
	});
}

export async function getResearchState(args: {
	colonyId: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	const { colony, player } = await getOwnedColony({
		ctx: args.ctx,
		colonyId: args.colonyId,
	});
	const [state, balances, activeResearch, combinedCapacity] = await Promise.all([
		ensurePlayerResearchState({
			ctx: args.ctx,
			playerId: player._id,
		}),
		ensurePlayerResearchBalances({
			ctx: args.ctx,
			playerId: player._id,
		}),
		getOpenResearchQueueRow({
			ctx: args.ctx,
			playerId: player._id,
		}),
		getEffectiveResearchCapacity({
			ctx: args.ctx,
			playerId: player._id,
		}),
	]);
	return {
		playerId: player._id,
		colonyId: colony._id,
		levels: state.levels ?? {},
		balances: cloneMetaMatter(balances),
		combinedResearchCapacity: combinedCapacity,
		localResearchFacilityLevel: Math.max(0, colony.buildings.researchDirectorateLevel),
		activeResearch: activeResearch
			? {
					queueItemId: activeResearch._id,
					researchKey: activeResearch.researchKey,
					fromLevel: activeResearch.fromLevel,
					toLevel: activeResearch.toLevel,
					status: activeResearch.status,
					queuedAt: activeResearch.queuedAt,
					startsAt: activeResearch.startsAt,
					completesAt: activeResearch.completesAt,
					costMetaMatter: cloneMetaMatter(activeResearch.costMetaMatter),
					costResources: activeResearch.costResources,
				}
			: null,
	};
}

export async function settleResearchQueue(args: {
	ctx: MutationCtx;
	now: number;
	playerId: Id<"players">;
}) {
	const activeRows = await args.ctx.db
		.query("playerResearchQueueItems")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
		.collect();
	const active = pickCanonicalRow(activeRows);
	if (!active || active.completesAt > args.now) {
		return { resolvedQueueItemId: null as Id<"playerResearchQueueItems"> | null };
	}
	const state = await ensurePlayerResearchState({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (!state._id) {
		throw new ConvexError("Research state row missing");
	}
	const nextLevels = {
		...(state.levels ?? {}),
		[active.researchKey]: active.toLevel,
	};
	const nextUnlockedAt = {
		...(state.unlockedAtByKey ?? {}),
		[active.researchKey]:
			active.fromLevel <= 0 ? args.now : (state.unlockedAtByKey?.[active.researchKey] ?? args.now),
	};
	await args.ctx.db.patch(state._id, {
		levels: nextLevels,
		unlockedAtByKey: nextUnlockedAt,
		updatedAt: args.now,
	});
	await args.ctx.db.patch(active._id, {
		status: "completed",
		resolvedAt: args.now,
		updatedAt: args.now,
	});
	await upsertPlayerResearchScheduling({
		ctx: args.ctx,
		now: args.now,
		playerId: args.playerId,
		patch: {
			resolutionJobId: undefined,
			resolutionScheduledAt: undefined,
		},
	});
	return { resolvedQueueItemId: active._id };
}

export const getState = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: researchStateViewValidator,
	handler: async (ctx, args) => {
		return getResearchState({
			colonyId: args.colonyId,
			ctx,
		});
	},
});

export const enqueue = mutation({
	args: {
		colonyId: v.id("colonies"),
		researchKey: v.string(),
	},
	returns: researchStateViewValidator.fields.activeResearch,
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const now = Date.now();
		const openResearch = await getOpenResearchQueueRow({
			ctx,
			playerId: player._id,
		});
		if (openResearch) {
			throw new ConvexError("Research queue already has an active item");
		}
		const node = getResearchNode(args.researchKey as ResearchKey);
		if (!node) {
			throw new ConvexError("Unknown research node");
		}
		const [state, balances, combinedCapacity, modifierSnapshot] = await Promise.all([
			ensurePlayerResearchState({
				ctx,
				playerId: player._id,
			}),
			ensurePlayerResearchBalances({
				ctx,
				playerId: player._id,
			}),
			getEffectiveResearchCapacity({
				ctx,
				playerId: player._id,
			}),
			loadPlayerResearchModifierSnapshot({
				ctx,
				playerId: player._id,
			}),
		]);
		const levels = (state.levels ?? {}) as Record<string, number>;
		const fromLevel = Math.max(0, Math.floor(levels[node.id] ?? 0));
		if (
			!canResearchNodeStart({
				combinedResearchCapacity: combinedCapacity,
				localResearchFacilityLevel: Math.max(0, colony.buildings.researchDirectorateLevel),
				levels,
				researchKey: node.id,
			})
		) {
			throw new ConvexError("Research requirements not met");
		}
		const cost = node.costs[fromLevel];
		if (!cost) {
			throw new ConvexError("Research cost definition missing");
		}
		const costMetaMatter = cloneMetaMatter(cost.metaMatter);
		const costResources = {
			alloy: scaledUnits(cost.resources?.alloy ?? 0),
			crystal: scaledUnits(cost.resources?.crystal ?? 0),
			fuel: scaledUnits(cost.resources?.fuel ?? 0),
		};
		if (
			balances.common < costMetaMatter.common ||
			balances.rare < costMetaMatter.rare ||
			balances.mythic < costMetaMatter.mythic
		) {
			throw new ConvexError("Not enough meta-matter");
		}
		if (
			colony.resources.alloy < costResources.alloy ||
			colony.resources.crystal < costResources.crystal ||
			colony.resources.fuel < costResources.fuel
		) {
			throw new ConvexError("Not enough colony resources to start research");
		}
		if (!balances._id) {
			throw new ConvexError("Research balances row missing");
		}
		await ctx.db.patch(balances._id, {
			common: balances.common - costMetaMatter.common,
			rare: balances.rare - costMetaMatter.rare,
			mythic: balances.mythic - costMetaMatter.mythic,
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...colony,
				resources: {
					alloy: colony.resources.alloy - costResources.alloy,
					crystal: colony.resources.crystal - costResources.crystal,
					fuel: colony.resources.fuel - costResources.fuel,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});
		const durationSeconds = Math.max(
			1,
			Math.round(cost.seconds * modifierSnapshot.researchDurationMultiplier),
		);
		const startsAt = now;
		const completesAt = now + durationSeconds * 1000;
		const queueItemId = await ctx.db.insert("playerResearchQueueItems", {
			playerId: player._id,
			originColonyId: colony._id,
			researchKey: node.id,
			fromLevel,
			toLevel: fromLevel + 1,
			status: "active",
			queuedAt: now,
			startsAt,
			completesAt,
			resolvedAt: undefined,
			costMetaMatter,
			costResources,
			snapshot: {
				originResearchFacilityLevel: Math.max(0, colony.buildings.researchDirectorateLevel),
				combinedResearchCapacity: combinedCapacity,
				durationSeconds,
			},
			createdAt: now,
			updatedAt: now,
		});
		await reconcileResearchSchedule({
			ctx,
			playerId: player._id,
		});
		return {
			queueItemId,
			researchKey: node.id,
			fromLevel,
			toLevel: fromLevel + 1,
			status: "active" as const,
			queuedAt: now,
			startsAt,
			completesAt,
			costMetaMatter,
			costResources,
		};
	},
});

export const cancel = mutation({
	args: {
		queueItemId: v.id("playerResearchQueueItems"),
	},
	returns: v.object({
		queueItemId: v.id("playerResearchQueueItems"),
	}),
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const row = await ctx.db.get(args.queueItemId);
		if (!row || row.playerId !== playerResult.player._id) {
			throw new ConvexError("Research queue item not found");
		}
		if (row.status !== "active" && row.status !== "queued") {
			throw new ConvexError("Research item is not cancellable");
		}
		const [balances, colony] = await Promise.all([
			ensurePlayerResearchBalances({
				ctx,
				playerId: playerResult.player._id,
			}),
			getOwnedColony({
				ctx,
				colonyId: row.originColonyId,
			}),
		]);
		if (!balances._id) {
			throw new ConvexError("Research balances row missing");
		}
		const now = Date.now();
		await ctx.db.patch(balances._id, {
			common: balances.common + row.costMetaMatter.common,
			rare: balances.rare + row.costMetaMatter.rare,
			mythic: balances.mythic + row.costMetaMatter.mythic,
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...colony.colony,
				resources: {
					alloy: colony.colony.resources.alloy + row.costResources.alloy,
					crystal: colony.colony.resources.crystal + row.costResources.crystal,
					fuel: colony.colony.resources.fuel + row.costResources.fuel,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});
		await ctx.db.patch(row._id, {
			status: "cancelled",
			resolvedAt: now,
			updatedAt: now,
		});
		await reconcileResearchSchedule({
			ctx,
			playerId: playerResult.player._id,
		});
		return {
			queueItemId: row._id,
		};
	},
});

export const resolveScheduledResearch = internalMutation({
	args: {
		playerId: v.id("players"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		playerId: v.id("players"),
		resolvedAt: v.number(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const scheduling = await ensurePlayerResearchScheduling({
			ctx,
			playerId: args.playerId,
		});
		const now = Date.now();
		if (scheduling.resolutionScheduledAt !== args.scheduledAt) {
			return {
				playerId: args.playerId,
				resolvedAt: now,
				stale: true,
			};
		}
		await settleResearchQueue({
			ctx,
			now,
			playerId: args.playerId,
		});
		await ctx.scheduler.runAfter(0, internal.scheduler.rearmPlayerResearchSchedule, {
			playerId: args.playerId,
		});
		return {
			playerId: args.playerId,
			resolvedAt: now,
			stale: false,
		};
	},
});

export function buildAcceptedContractMetaMatterReward(args: {
	difficultyTier: number;
	playerResearchLevels: Partial<ResearchLevelMap>;
	seed: string;
}) {
	const modifiers = buildResearchModifierSnapshot(args.playerResearchLevels);
	return rollMetaMatterBundle({
		difficultyTier: args.difficultyTier,
		modifierSnapshot: {
			globalMetaMatterRewardMultiplier: modifiers.globalMetaMatterRewardMultiplier,
			metaMatterRewardMultipliers: modifiers.metaMatterRewardMultipliers,
		},
		seed: args.seed,
	});
}
