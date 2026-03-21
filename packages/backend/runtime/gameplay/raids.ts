import {
	DEFAULT_SHIP_DEFINITIONS,
	generateNpcRaidSnapshot,
	generateTutorialNpcRaidSnapshot,
	getFleetCargoCapacity,
	normalizeDefenseCounts,
	normalizeShipCounts,
	simulateCombat,
	type ResourceBucket,
	type ShipCounts,
	type ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "../../convex/_generated/server";
import { RESOURCE_SCALE } from "../../convex/schema";
import { emitRaidIncomingNotification, emitRaidResolvedNotification } from "./notifications";
import { buildProgressionRules } from "./progression";
import {
	computeNextNpcRaidAt,
	computeNpcRaidTravelDurationMs,
	pickNpcRaidFaction,
} from "./raidScheduling";
import {
	cloneResourceBucket,
	emptyResourceBucket,
	incrementColonyShipCount,
	loadColonyDefenseCounts,
	loadColonyState,
	loadPlanetState,
	requireOwnedColonyRow,
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
const RAID_RECONCILE_BATCH_SIZE = 64;

function scaledUnits(unscaledUnits: number) {
	return Math.round(Math.max(0, unscaledUnits) * RESOURCE_SCALE);
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

async function findActiveRaidForColony(args: {
	colonyId: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	return args.ctx.db
		.query("npcRaidOperations")
		.withIndex("by_target_status_event", (q) =>
			q.eq("targetColonyId", args.colonyId).eq("status", RAID_STATUS_IN_TRANSIT),
		)
		.first();
}

async function setNextNpcRaidAtForColony(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	enabled: boolean;
	now: number;
	scheduledAt?: number;
}) {
	const nextNpcRaidAt = args.enabled
		? computeNextNpcRaidAt({
				anchorAt: args.scheduledAt ?? args.now,
				colonyId: args.colony._id,
			})
		: undefined;
	await args.ctx.db.patch(args.colony._id, {
		nextNpcRaidAt,
		updatedAt: args.now,
	});
	return nextNpcRaidAt ?? null;
}

async function reconcileNpcRaidScheduleForColony(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	progression?: Awaited<ReturnType<typeof buildProgressionRules>>;
}) {
	const progression =
		args.progression ??
		(await buildProgressionRules({
			ctx: args.ctx,
			playerId: args.colony.playerId,
		}));
	const now = Date.now();
	if (progression.raidRules.mode !== "full") {
		await args.ctx.db.patch(args.colony._id, {
			nextNpcRaidAt: undefined,
			updatedAt: now,
		});
		return null;
	}

	if (args.colony.nextNpcRaidAt !== undefined) {
		return args.colony.nextNpcRaidAt;
	}

	return setNextNpcRaidAtForColony({
		colony: args.colony,
		ctx: args.ctx,
		enabled: true,
		now,
	});
}

export async function spawnNpcRaidImmediatelyForColony(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	scheduledAt: number;
	spawnReason?: "tutorialRank2";
}) {
	const now = Date.now();
	const progression = await buildProgressionRules({
		ctx: args.ctx,
		playerId: args.colony.playerId,
	});
	if (
		progression.raidRules.mode === "off" ||
		(progression.raidRules.mode === "tutorialOnly" && args.spawnReason !== "tutorialRank2")
	) {
		await setNextNpcRaidAtForColony({
			colony: args.colony,
			ctx: args.ctx,
			enabled: false,
			now,
		});
		return {
			colonyId: args.colony._id,
			raidOperationId: undefined,
			stale: false,
		};
	}
	const difficultyTier = Math.min(MAX_RAID_DIFFICULTY_TIER, progression.raidRules.difficultyTier);
	const hostileFactionKey = pickNpcRaidFaction({
		colonyId: args.colony._id,
		scheduledAt: args.scheduledAt,
	});
	const snapshot =
		args.spawnReason === "tutorialRank2"
			? generateTutorialNpcRaidSnapshot()
			: generateNpcRaidSnapshot({
					difficultyTier,
					hostileFactionKey,
					seed: `${args.colony._id}:${args.scheduledAt}`,
				});
	const durationMs = computeNpcRaidTravelDurationMs({
		colonyId: args.colony._id,
		scheduledAt: args.scheduledAt,
	});
	const raidOperationId = await args.ctx.db.insert("npcRaidOperations", {
		universeId: args.colony.universeId,
		targetColonyId: args.colony._id,
		targetPlayerId: args.colony.playerId,
		sourcePlanetId: undefined,
		spawnReason: args.spawnReason,
		hostileFactionKey,
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
	await setNextNpcRaidAtForColony({
		colony: args.colony,
		ctx: args.ctx,
		enabled: progression.raidRules.mode === "full",
		now,
		scheduledAt: args.scheduledAt,
	});
	return {
		colonyId: args.colony._id,
		raidOperationId,
		stale: false,
	};
}

function lootFromResources(args: { available: ResourceBucket; capacity: number }) {
	const looted = emptyResourceBucket();
	let remaining = scaledUnits(args.capacity);
	for (const key of RESOURCE_KEYS) {
		const amount = Math.max(0, Math.min(args.available[key], remaining));
		looted[key] = amount;
		remaining -= amount;
	}
	return looted;
}

function salvageFromDestroyedAttackers(args: { initialFleet: ShipCounts; survivors: ShipCounts }) {
	const salvageWhole = emptyResourceBucket();

	for (const key of Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]) {
		const destroyed = Math.max(0, args.initialFleet[key] - args.survivors[key]);
		if (destroyed <= 0) {
			continue;
		}
		const cost = DEFAULT_SHIP_DEFINITIONS[key].cost;
		salvageWhole.alloy += Math.floor(cost.alloy * destroyed * DEFENSE_SALVAGE_FACTOR);
		salvageWhole.crystal += Math.floor(cost.crystal * destroyed * DEFENSE_SALVAGE_FACTOR);
		salvageWhole.fuel += Math.floor(cost.fuel * destroyed * DEFENSE_SALVAGE_FACTOR);
	}

	return {
		alloy: scaledUnits(salvageWhole.alloy),
		crystal: scaledUnits(salvageWhole.crystal),
		fuel: scaledUnits(salvageWhole.fuel),
	};
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
		const { colony } = await requireOwnedColonyRow({
			ctx,
			colonyId: args.colonyId,
		});
		const activeRaid = await findActiveRaidForColony({
			colonyId: colony._id,
			ctx,
		});
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
				createdAt: v.number(),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const { colony } = await requireOwnedColonyRow({
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
					createdAt: row.createdAt,
				})),
		};
	},
});

export const resolveOverdueRaidForColony = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		raidOperationId: v.optional(v.id("npcRaidOperations")),
		resolved: v.boolean(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const { colony } = await requireOwnedColonyRow({
			ctx,
			colonyId: args.colonyId,
		});
		const activeRaid = await findActiveRaidForColony({
			colonyId: colony._id,
			ctx,
		});
		if (!activeRaid) {
			return {
				colonyId: colony._id,
				raidOperationId: undefined,
				resolved: false,
				stale: false,
			};
		}
		if (activeRaid.arriveAt > Date.now()) {
			return {
				colonyId: colony._id,
				raidOperationId: activeRaid._id,
				resolved: false,
				stale: false,
			};
		}

		const result = await resolveNpcRaidNow({
			ctx,
			raidOperationId: activeRaid._id,
			scheduledAt: activeRaid.nextEventAt,
		});
		return {
			colonyId: colony._id,
			raidOperationId: activeRaid._id,
			resolved: !result.stale,
			stale: result.stale,
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
		const nextNpcRaidAt = await reconcileNpcRaidScheduleForColony({
			colony,
			ctx,
		});
		return {
			colonyId: colony._id,
			nextNpcRaidAt: nextNpcRaidAt ?? null,
		};
	},
});

export const reconcileNpcRaidSchedulesForPlayer = internalMutation({
	args: {
		playerId: v.id("players"),
	},
	returns: v.object({
		playerId: v.id("players"),
		processed: v.number(),
		scheduled: v.number(),
		cleared: v.number(),
		runAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const colonies = await ctx.db
			.query("colonies")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.collect();
		const progression = await buildProgressionRules({
			ctx,
			playerId: args.playerId,
		});
		let scheduled = 0;
		let cleared = 0;
		for (const colony of colonies) {
			const nextNpcRaidAt = await reconcileNpcRaidScheduleForColony({
				colony,
				ctx,
				progression,
			});
			if (nextNpcRaidAt === null) {
				cleared += 1;
			} else {
				scheduled += 1;
			}
		}
		return {
			playerId: args.playerId,
			processed: colonies.length,
			scheduled,
			cleared,
			runAt: Date.now(),
		};
	},
});

export const reconcileDueNpcRaids = internalMutation({
	args: {},
	returns: v.object({
		processedColonies: v.number(),
		processedRaids: v.number(),
		spawned: v.number(),
		resolved: v.number(),
		runAt: v.number(),
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const dueRaids = await ctx.db
			.query("npcRaidOperations")
			.withIndex("by_status_event", (q) =>
				q.eq("status", RAID_STATUS_IN_TRANSIT).lte("nextEventAt", now),
			)
			.take(RAID_RECONCILE_BATCH_SIZE);
		let resolved = 0;
		for (const raid of dueRaids) {
			const result = await resolveNpcRaidNow({
				ctx,
				raidOperationId: raid._id,
				scheduledAt: raid.nextEventAt,
			});
			if (!result.stale) {
				resolved += 1;
			}
		}
		const dueColonies = await ctx.db
			.query("colonies")
			.withIndex("by_next_npc_raid_at", (q) => q.lte("nextNpcRaidAt", now))
			.take(RAID_RECONCILE_BATCH_SIZE);
		let spawned = 0;
		for (const colony of dueColonies) {
			if (colony.nextNpcRaidAt === undefined || colony.nextNpcRaidAt > now) {
				continue;
			}
			const activeRaid = await findActiveRaidForColony({
				colonyId: colony._id,
				ctx,
			});
			const progression = await buildProgressionRules({
				ctx,
				playerId: colony.playerId,
			});
			if (activeRaid) {
				if (activeRaid.status === RAID_STATUS_IN_TRANSIT && activeRaid.arriveAt <= now) {
					await resolveNpcRaidNow({
						ctx,
						raidOperationId: activeRaid._id,
						scheduledAt: activeRaid.nextEventAt,
					});
				}
				await setNextNpcRaidAtForColony({
					colony,
					ctx,
					enabled: progression.raidRules.mode === "full",
					now,
					scheduledAt: colony.nextNpcRaidAt,
				});
				continue;
			}
			const result = await spawnNpcRaidImmediatelyForColony({
				colony,
				ctx,
				scheduledAt: colony.nextNpcRaidAt,
			});
			if (result.raidOperationId) {
				spawned += 1;
			}
		}
		return {
			processedColonies: dueColonies.length,
			processedRaids: dueRaids.length,
			spawned,
			resolved,
			runAt: now,
		};
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
		createdAt: now,
		updatedAt: now,
	});
	await emitRaidResolvedNotification({
		ctx: args.ctx,
		hostileFactionKey: raid.hostileFactionKey,
		playerId: raid.targetPlayerId,
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
