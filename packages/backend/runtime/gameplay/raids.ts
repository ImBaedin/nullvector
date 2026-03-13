import {
	DEFAULT_SHIP_DEFINITIONS,
	generateNpcRaidSnapshot,
	getDifficultyTierForRank,
	getFleetCargoCapacity,
	normalizeDefenseCounts,
	normalizeShipCounts,
	simulateCombat,
	type DefenseCounts,
	type ResourceBucket,
	type ShipCounts,
	type ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import {
	internalMutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "../../convex/_generated/server";
import { colonySystemCoords, durationMsForFleet, euclideanDistance } from "./fleetV2";
import { emitRaidIncomingNotification, emitRaidResolvedNotification } from "./notifications";
import { changePlayerRankXp } from "./progression";
import {
	cloneResourceBucket,
	emptyResourceBucket,
	getOwnedColony,
	incrementColonyShipCount,
	loadColonyDefenseCounts,
	loadColonyState,
	loadPlanetState,
	replaceColonyDefenseCounts,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	upsertColonyCompanionRows,
} from "./shared";

const RAID_STATUS_IN_TRANSIT = "inTransit" as const;
const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;
const MAX_RAID_DIFFICULTY_TIER = 10;
const DEFENSE_SALVAGE_FACTOR = 0.35;
const RAID_FAILURE_RANK_XP_PER_TIER = 25;

function hashString(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

async function systemCoordsForPlanet(args: {
	ctx: QueryCtx | MutationCtx;
	planetId: Id<"planets">;
}) {
	const planet = await args.ctx.db.get(args.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for planet");
	}
	return {
		planet,
		x: system.x,
		y: system.y,
	};
}

async function readColonyShipCounts(args: {
	colonyId: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	const rows = await args.ctx.db
		.query("colonyShips")
		.withIndex("by_colony", (q) => q.eq("colonyId", args.colonyId))
		.collect();
	const counts = normalizeShipCounts({});
	for (const row of rows) {
		counts[row.shipKey] = row.count;
	}
	return counts;
}

async function replaceColonyShipCounts(args: {
	colony: Doc<"colonies">;
	counts: ShipCounts;
	ctx: MutationCtx;
	now: number;
}) {
	const current = await readColonyShipCounts({
		colonyId: args.colony._id,
		ctx: args.ctx,
	});
	for (const key of Object.keys(args.counts) as ShipKey[]) {
		const diff = args.counts[key] - current[key];
		if (diff === 0) {
			continue;
		}
		await incrementColonyShipCount({
			amount: diff,
			colony: args.colony,
			ctx: args.ctx,
			now: args.now,
			shipKey: key,
		});
	}
}

async function getNearestHostilePlanetForColony(args: {
	colony: Doc<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	const hostileRows = await args.ctx.db
		.query("planetHostility")
		.withIndex("by_universe_status", (q) =>
			q.eq("universeId", args.colony.universeId).eq("status", "hostile"),
		)
		.collect();
	if (hostileRows.length === 0) {
		return null;
	}

	const originCoords = await colonySystemCoords({
		colonyId: args.colony._id,
		ctx: args.ctx,
	});

	let best: {
		distance: number;
		hostileFactionKey: Doc<"planetHostility">["hostileFactionKey"];
		planetId: Id<"planets">;
	} | null = null;

	for (const row of hostileRows) {
		const target = await systemCoordsForPlanet({
			ctx: args.ctx,
			planetId: row.planetId,
		});
		const distance = euclideanDistance({
			x1: originCoords.x,
			y1: originCoords.y,
			x2: target.x,
			y2: target.y,
		});
		if (!best || distance < best.distance) {
			best = {
				distance,
				hostileFactionKey: row.hostileFactionKey,
				planetId: row.planetId,
			};
		}
	}

	return best;
}

function nextRaidIntervalMs() {
	return 12 * 60 * 60 * 1_000;
}

async function cancelScheduledJobIfPresent(args: {
	ctx: MutationCtx;
	jobId: Id<"_scheduled_functions"> | undefined;
}) {
	if (!args.jobId) {
		return;
	}
	await args.ctx.scheduler.cancel(args.jobId);
}

async function scheduleRaidResolution(args: { ctx: MutationCtx; raid: Doc<"npcRaidOperations"> }) {
	const jobId = await args.ctx.scheduler.runAt(
		Math.max(Date.now(), args.raid.nextEventAt),
		internal.raids.resolveNpcRaid,
		{
			raidOperationId: args.raid._id,
			scheduledAt: args.raid.nextEventAt,
		},
	);
	await args.ctx.db.patch(args.raid._id, {
		resolutionJobId: jobId,
		resolutionScheduledAt: args.raid.nextEventAt,
		updatedAt: Date.now(),
	});
}

export async function spawnNpcRaidImmediatelyForColony(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	scheduledAt: number;
}) {
	await cancelScheduledJobIfPresent({
		ctx: args.ctx,
		jobId: args.colony.npcRaidSchedulingJobId,
	});
	await args.ctx.db.patch(args.colony._id, {
		nextNpcRaidAt: undefined,
		npcRaidSchedulingJobId: undefined,
		updatedAt: Date.now(),
	});

	const hostileSource = await getNearestHostilePlanetForColony({
		colony: args.colony,
		ctx: args.ctx,
	});
	if (!hostileSource) {
		return {
			colonyId: args.colony._id,
			raidOperationId: undefined,
			stale: false,
		};
	}

	const progression = await args.ctx.db
		.query("playerProgression")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.colony.playerId))
		.unique();
	const difficultyTier = Math.min(
		MAX_RAID_DIFFICULTY_TIER,
		getDifficultyTierForRank(progression?.rank ?? 1),
	);
	const snapshot = generateNpcRaidSnapshot({
		difficultyTier,
		hostileFactionKey: hostileSource.hostileFactionKey,
		seed: `${args.colony._id}:${hostileSource.planetId}:${args.scheduledAt}`,
	});
	const durationMs = durationMsForFleet({
		distance: hostileSource.distance,
		shipCounts: snapshot.attackerFleet,
	});
	const now = Date.now();
	const raidOperationId = await args.ctx.db.insert("npcRaidOperations", {
		universeId: args.colony.universeId,
		targetColonyId: args.colony._id,
		targetPlayerId: args.colony.playerId,
		sourcePlanetId: hostileSource.planetId,
		hostileFactionKey: hostileSource.hostileFactionKey,
		status: RAID_STATUS_IN_TRANSIT,
		difficultyTier,
		attackerFleet: snapshot.attackerFleet,
		attackerTargetPriority: snapshot.attackerTargetPriority,
		defenderTargetPriority: snapshot.defenderTargetPriority,
		departAt: now,
		arriveAt: now + durationMs,
		nextEventAt: now + durationMs,
		createdAt: now,
		updatedAt: now,
	});
	const raid = await args.ctx.db.get(raidOperationId);
	if (!raid) {
		throw new ConvexError("Failed to create NPC raid");
	}
	await scheduleRaidResolution({
		ctx: args.ctx,
		raid,
	});
	await emitRaidIncomingNotification({
		arriveAt: raid.arriveAt,
		attackerFleet: normalizeShipCounts(raid.attackerFleet),
		ctx: args.ctx,
		difficultyTier: raid.difficultyTier,
		hostileFactionKey: raid.hostileFactionKey,
		occurredAt: now,
		playerId: raid.targetPlayerId,
		raidOperationId: raid._id,
		targetColonyId: raid.targetColonyId,
		universeId: raid.universeId,
	});
	await args.ctx.scheduler.runAfter(0, internal.raids.reconcileNpcRaidSchedule, {
		colonyId: args.colony._id,
	});
	return {
		colonyId: args.colony._id,
		raidOperationId,
		stale: false,
	};
}

function lootFromResources(args: { available: ResourceBucket; capacity: number }) {
	const looted = emptyResourceBucket();
	let remaining = Math.max(0, Math.floor(args.capacity));
	for (const key of RESOURCE_KEYS) {
		const amount = Math.max(0, Math.min(args.available[key], remaining));
		looted[key] = amount;
		remaining -= amount;
	}
	return looted;
}

function salvageFromDestroyedAttackers(args: { initialFleet: ShipCounts; survivors: ShipCounts }) {
	const salvage = emptyResourceBucket();

	for (const key of Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]) {
		const destroyed = Math.max(0, args.initialFleet[key] - args.survivors[key]);
		if (destroyed <= 0) {
			continue;
		}
		const cost = DEFAULT_SHIP_DEFINITIONS[key].cost;
		salvage.alloy += Math.floor(cost.alloy * destroyed * DEFENSE_SALVAGE_FACTOR);
		salvage.crystal += Math.floor(cost.crystal * destroyed * DEFENSE_SALVAGE_FACTOR);
		salvage.fuel += Math.floor(cost.fuel * destroyed * DEFENSE_SALVAGE_FACTOR);
	}

	return salvage;
}

async function applyResourcesToColony(args: {
	colony: Awaited<ReturnType<typeof loadColonyState>>;
	ctx: MutationCtx;
	now: number;
	resourcesScaled: ResourceBucket;
}) {
	const nextResources = cloneResourceBucket(args.colony.resources);
	const nextOverflow = cloneResourceBucket(args.colony.overflow);
	const deliveredToStorage = emptyResourceBucket();
	const deliveredToOverflow = emptyResourceBucket();

	for (const key of RESOURCE_KEYS) {
		const currentStored = nextResources[key];
		const cap = args.colony.storageCaps[key];
		const inbound = args.resourcesScaled[key];
		const accepted = Math.max(0, Math.min(inbound, Math.max(0, cap - currentStored)));
		const overflow = Math.max(0, inbound - accepted);
		nextResources[key] = currentStored + accepted;
		nextOverflow[key] += overflow;
		deliveredToStorage[key] = accepted;
		deliveredToOverflow[key] = overflow;
	}

	await args.ctx.db.patch(args.colony._id, {
		updatedAt: args.now,
	});
	await upsertColonyCompanionRows({
		colony: {
			...args.colony,
			resources: nextResources,
			overflow: nextOverflow,
			updatedAt: args.now,
		},
		ctx: args.ctx,
		now: args.now,
	});

	return {
		deliveredToOverflow,
		deliveredToStorage,
	};
}

const raidStatusViewValidator = v.object({
	colonyId: v.id("colonies"),
	nextNpcRaidAt: v.optional(v.number()),
	activeRaid: v.optional(
		v.object({
			id: v.id("npcRaidOperations"),
			status: v.literal("inTransit"),
			departAt: v.number(),
			arriveAt: v.number(),
			difficultyTier: v.number(),
			hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
			attackerFleet: v.object({
				colonyShip: v.number(),
				cruiser: v.number(),
				bomber: v.number(),
				interceptor: v.number(),
				frigate: v.number(),
				largeCargo: v.number(),
				smallCargo: v.number(),
			}),
		}),
	),
});

export const getRaidStatusForColony = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: raidStatusViewValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const activeRaid = await ctx.db
			.query("npcRaidOperations")
			.withIndex("by_target_status_event", (q) =>
				q.eq("targetColonyId", colony._id).eq("status", RAID_STATUS_IN_TRANSIT),
			)
			.first();
		const activeRaidView = activeRaid
			? {
					id: activeRaid._id,
					status: RAID_STATUS_IN_TRANSIT,
					departAt: activeRaid.departAt,
					arriveAt: activeRaid.arriveAt,
					difficultyTier: activeRaid.difficultyTier,
					hostileFactionKey: activeRaid.hostileFactionKey,
					attackerFleet: normalizeShipCounts(activeRaid.attackerFleet),
				}
			: undefined;
		return {
			colonyId: colony._id,
			nextNpcRaidAt: colony.nextNpcRaidAt,
			activeRaid: activeRaidView,
		};
	},
});

export const getRaidHistoryForColony = query({
	args: {
		colonyId: v.id("colonies"),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		results: v.array(
			v.object({
				id: v.id("npcRaidResults"),
				raidOperationId: v.id("npcRaidOperations"),
				success: v.boolean(),
				roundsFought: v.number(),
				hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
				resourcesLooted: v.object({
					alloy: v.number(),
					crystal: v.number(),
					fuel: v.number(),
				}),
				salvageGranted: v.object({
					alloy: v.number(),
					crystal: v.number(),
					fuel: v.number(),
				}),
				rankXpDelta: v.number(),
				createdAt: v.number(),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const limit = Math.max(1, Math.min(20, Math.floor(args.limit ?? 10)));
		const rows = await ctx.db
			.query("npcRaidResults")
			.withIndex("by_target_colony_id", (q) => q.eq("targetColonyId", colony._id))
			.collect();
		return {
			results: rows
				.sort((left, right) => right.createdAt - left.createdAt)
				.slice(0, limit)
				.map((row) => ({
					id: row._id,
					raidOperationId: row.raidOperationId,
					success: row.success,
					roundsFought: row.roundsFought,
					hostileFactionKey: row.hostileFactionKey,
					resourcesLooted: row.resourcesLooted,
					salvageGranted: row.salvageGranted,
					rankXpDelta: row.rankXpDelta,
					createdAt: row.createdAt,
				})),
		};
	},
});

export const reconcileNpcRaidSchedule = internalMutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		nextNpcRaidAt: v.union(v.number(), v.null()),
	}),
	handler: async (ctx, args) => {
		const colony = await ctx.db.get(args.colonyId);
		if (!colony) {
			return {
				colonyId: args.colonyId,
				nextNpcRaidAt: null,
			};
		}
		const progression = await ctx.db
			.query("playerProgression")
			.withIndex("by_player_id", (q) => q.eq("playerId", colony.playerId))
			.unique();
		if ((progression?.rank ?? 1) < 5) {
			await cancelScheduledJobIfPresent({
				ctx,
				jobId: colony.npcRaidSchedulingJobId,
			});
			await ctx.db.patch(colony._id, {
				nextNpcRaidAt: undefined,
				npcRaidSchedulingJobId: undefined,
				updatedAt: Date.now(),
			});
			return {
				colonyId: colony._id,
				nextNpcRaidAt: null,
			};
		}

		const hostileSource = await getNearestHostilePlanetForColony({
			colony,
			ctx,
		});
		if (!hostileSource) {
			await cancelScheduledJobIfPresent({
				ctx,
				jobId: colony.npcRaidSchedulingJobId,
			});
			await ctx.db.patch(colony._id, {
				nextNpcRaidAt: undefined,
				npcRaidSchedulingJobId: undefined,
				updatedAt: Date.now(),
			});
			return {
				colonyId: colony._id,
				nextNpcRaidAt: null,
			};
		}

		const jitterMs = hashString(`${colony._id}:${hostileSource.planetId}`) % (30 * 60 * 1_000);
		const nextNpcRaidAt = Date.now() + nextRaidIntervalMs() + jitterMs;

		await cancelScheduledJobIfPresent({
			ctx,
			jobId: colony.npcRaidSchedulingJobId,
		});
		const jobId = await ctx.scheduler.runAt(
			Math.max(Date.now(), nextNpcRaidAt),
			internal.raids.spawnNpcRaidForColony,
			{
				colonyId: colony._id,
				scheduledAt: nextNpcRaidAt,
			},
		);
		await ctx.db.patch(colony._id, {
			nextNpcRaidAt,
			npcRaidSchedulingJobId: jobId,
			updatedAt: Date.now(),
		});
		return {
			colonyId: colony._id,
			nextNpcRaidAt,
		};
	},
});

export const spawnNpcRaidForColony = internalMutation({
	args: {
		colonyId: v.id("colonies"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		raidOperationId: v.optional(v.id("npcRaidOperations")),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const colony = await ctx.db.get(args.colonyId);
		if (!colony || colony.nextNpcRaidAt !== args.scheduledAt) {
			return {
				colonyId: args.colonyId,
				raidOperationId: undefined,
				stale: true,
			};
		}
		return spawnNpcRaidImmediatelyForColony({
			colony,
			ctx,
			scheduledAt: args.scheduledAt,
		});
	},
});

export async function resolveNpcRaidNow(args: {
	ctx: MutationCtx;
	raidOperationId: Id<"npcRaidOperations">;
	scheduledAt: number;
}) {
	const raid = await args.ctx.db.get(args.raidOperationId);
	const now = Date.now();
	if (!raid || raid.status !== RAID_STATUS_IN_TRANSIT || raid.nextEventAt !== args.scheduledAt) {
		return {
			raidOperationId: args.raidOperationId,
			resolvedAt: now,
			stale: true,
		};
	}
	await args.ctx.db.patch(raid._id, {
		resolutionJobId: undefined,
		resolutionScheduledAt: undefined,
		updatedAt: now,
	});

	const colony = await args.ctx.db.get(raid.targetColonyId);
	if (!colony) {
		await args.ctx.db.patch(raid._id, {
			status: "cancelled",
			updatedAt: now,
		});
		return {
			raidOperationId: raid._id,
			resolvedAt: now,
			stale: false,
		};
	}
	const planet = await args.ctx.db.get(colony.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found for raid target colony");
	}

	const colonyState = await loadColonyState({
		colony,
		ctx: args.ctx,
	});
	const planetState = await loadPlanetState({
		planet,
		ctx: args.ctx,
	});
	const settledColony = await settleColonyAndPersist({
		ctx: args.ctx,
		colony: colonyState,
		planet: planetState,
		now,
	});
	await settleShipyardQueue({
		colony: settledColony,
		ctx: args.ctx,
		now,
	});
	await settleDefenseQueue({
		colony: settledColony,
		ctx: args.ctx,
		now,
	});

	const [defenderShips, defenderDefenses] = await Promise.all([
		readColonyShipCounts({
			colonyId: settledColony._id,
			ctx: args.ctx,
		}),
		loadColonyDefenseCounts({
			colonyId: settledColony._id,
			ctx: args.ctx,
		}),
	]);

	const combat = simulateCombat({
		attacker: {
			ships: raid.attackerFleet,
			targetPriority: raid.attackerTargetPriority,
		},
		defender: {
			ships: defenderShips,
			defenses: defenderDefenses,
			targetPriority: raid.defenderTargetPriority,
		},
		maxRounds: 6,
	});

	await replaceColonyShipCounts({
		colony: settledColony,
		counts: combat.defenderFleetRemaining,
		ctx: args.ctx,
		now,
	});
	await replaceColonyDefenseCounts({
		colony: settledColony,
		counts: normalizeDefenseCounts(combat.defenderDefenseRemaining),
		ctx: args.ctx,
		now,
	});

	let resourcesLooted = emptyResourceBucket();
	let salvageGranted = emptyResourceBucket();
	let rankXpDelta = 0;
	if (combat.success) {
		const available = cloneResourceBucket(settledColony.resources);
		const capacity = getFleetCargoCapacity(combat.attackerRemaining);
		resourcesLooted = lootFromResources({
			available,
			capacity,
		});
		if (resourcesLooted.alloy > 0 || resourcesLooted.crystal > 0 || resourcesLooted.fuel > 0) {
			await upsertColonyCompanionRows({
				colony: {
					...settledColony,
					resources: {
						alloy: settledColony.resources.alloy - resourcesLooted.alloy,
						crystal: settledColony.resources.crystal - resourcesLooted.crystal,
						fuel: settledColony.resources.fuel - resourcesLooted.fuel,
					},
					updatedAt: now,
				},
				ctx: args.ctx,
				now,
			});
		}
		rankXpDelta = -Math.max(25, raid.difficultyTier * RAID_FAILURE_RANK_XP_PER_TIER);
		await changePlayerRankXp({
			amount: rankXpDelta,
			ctx: args.ctx,
			playerId: raid.targetPlayerId,
		});
	} else {
		salvageGranted = salvageFromDestroyedAttackers({
			initialFleet: normalizeShipCounts(raid.attackerFleet),
			survivors: normalizeShipCounts(combat.attackerRemaining),
		});
		if (salvageGranted.alloy > 0 || salvageGranted.crystal > 0 || salvageGranted.fuel > 0) {
			const delivery = await applyResourcesToColony({
				colony: settledColony,
				ctx: args.ctx,
				now,
				resourcesScaled: salvageGranted,
			});
			salvageGranted = {
				alloy: delivery.deliveredToStorage.alloy + delivery.deliveredToOverflow.alloy,
				crystal: delivery.deliveredToStorage.crystal + delivery.deliveredToOverflow.crystal,
				fuel: delivery.deliveredToStorage.fuel + delivery.deliveredToOverflow.fuel,
			};
		}
	}

	await args.ctx.db.patch(raid._id, {
		status: "resolved",
		updatedAt: now,
	});
	await args.ctx.db.insert("npcRaidResults", {
		raidOperationId: raid._id,
		universeId: raid.universeId,
		targetColonyId: raid.targetColonyId,
		targetPlayerId: raid.targetPlayerId,
		hostileFactionKey: raid.hostileFactionKey,
		success: combat.success,
		roundsFought: combat.roundsFought,
		attackerSurvivors: combat.attackerRemaining,
		defenderSurvivors: {
			fleet: combat.defenderFleetRemaining,
			defenses: normalizeDefenseCounts(combat.defenderDefenseRemaining),
		},
		resourcesLooted,
		salvageGranted,
		rankXpDelta,
		createdAt: now,
		updatedAt: now,
	});
	await emitRaidResolvedNotification({
		ctx: args.ctx,
		hostileFactionKey: raid.hostileFactionKey,
		playerId: raid.targetPlayerId,
		rankXpDelta,
		raidOperationId: raid._id,
		resolvedAt: now,
		resourcesLooted,
		roundsFought: combat.roundsFought,
		salvageGranted,
		success: combat.success,
		targetColonyId: raid.targetColonyId,
		universeId: raid.universeId,
	});
	return {
		raidOperationId: raid._id,
		resolvedAt: now,
		stale: false,
	};
}

export const resolveNpcRaid = internalMutation({
	args: {
		raidOperationId: v.id("npcRaidOperations"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		raidOperationId: v.id("npcRaidOperations"),
		resolvedAt: v.number(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		return resolveNpcRaidNow({
			ctx,
			raidOperationId: args.raidOperationId,
			scheduledAt: args.scheduledAt,
		});
	},
});
