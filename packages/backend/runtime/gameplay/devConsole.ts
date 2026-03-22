import {
	DEFAULT_FACILITY_REGISTRY,
	normalizeShipCounts,
	type FacilityKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
} from "../../convex/_generated/server";
import { settleDueFleetOperations } from "./fleetV2";
import { resolveNpcRaidNow, spawnNpcRaidImmediatelyForColony } from "./raids";
import { reconcileFleetOperationSchedule, rescheduleColonyQueueResolution } from "./scheduling";
import {
	BUILDING_CONFIG,
	compareQueueOrder,
	getGeneratorOrThrow,
	getOwnedColony,
	incrementColonyDefenseCount,
	incrementColonyShipCount,
	isBuildingUpgradeQueueItem,
	isDefenseBuildQueueItem,
	isFacilityUpgradeQueueItem,
	isShipBuildQueueItem,
	listOpenLaneQueueItems,
	readColonyDefenseCounts,
	replaceColonyDefenseCounts,
	replaceColonyShipCounts,
	requireOwnedColonyAccess,
	resolveCurrentPlayer,
	scaledUnits,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	storageCapsFromBuildings,
	storedToWholeUnits,
	usedSlotsFromBuildings,
	upsertColonyCompanionRows,
} from "./shared";

const resourcePatchValidator = v.object({
	alloy: v.optional(v.number()),
	crystal: v.optional(v.number()),
	fuel: v.optional(v.number()),
});

const buildingLevelsPatchValidator = v.object({
	alloyMineLevel: v.optional(v.number()),
	crystalMineLevel: v.optional(v.number()),
	fuelRefineryLevel: v.optional(v.number()),
	powerPlantLevel: v.optional(v.number()),
	alloyStorageLevel: v.optional(v.number()),
	crystalStorageLevel: v.optional(v.number()),
	fuelStorageLevel: v.optional(v.number()),
});

const devQueueLaneValidator = v.union(
	v.literal("building"),
	v.literal("shipyard"),
	v.literal("defense"),
);

const DEV_TERMINAL_OP_STATUSES = ["completed", "cancelled", "failed"] as const;
const DEV_RESOLVABLE_OP_STATUSES = ["inTransit", "returning"] as const;
const DEV_EDITABLE_BUILDING_KEYS = [
	"alloyMineLevel",
	"crystalMineLevel",
	"fuelRefineryLevel",
	"powerPlantLevel",
	"alloyStorageLevel",
	"crystalStorageLevel",
	"fuelStorageLevel",
] as const;
const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;

type DevEditableBuildingKey = (typeof DEV_EDITABLE_BUILDING_KEYS)[number];
type DevActionType =
	| "setColonyResources"
	| "setBuildingLevels"
	| "setFacilityLevels"
	| "setShipCounts"
	| "setDefenseCounts"
	| "triggerNpcRaid"
	| "completeActiveRaid"
	| "completeActiveQueueItem"
	| "completeActiveMission";

const facilityLevelsPatchValidator = v.object({
	robotics_hub: v.optional(v.number()),
	shipyard: v.optional(v.number()),
	defense_grid: v.optional(v.number()),
});

const shipCountsPatchValidator = v.object({
	smallCargo: v.optional(v.number()),
	largeCargo: v.optional(v.number()),
	colonyShip: v.optional(v.number()),
	interceptor: v.optional(v.number()),
	frigate: v.optional(v.number()),
	cruiser: v.optional(v.number()),
	bomber: v.optional(v.number()),
});

const defenseCountsPatchValidator = v.object({
	missileBattery: v.optional(v.number()),
	laserTurret: v.optional(v.number()),
	gaussCannon: v.optional(v.number()),
	shieldDome: v.optional(v.number()),
});

function sanitizeNonNegativeInteger(value: number | undefined) {
	if (!Number.isFinite(value ?? Number.NaN)) {
		return 0;
	}
	return Math.max(0, Math.floor(value ?? 0));
}

function isTerminalOperationStatus(status: string) {
	return DEV_TERMINAL_OP_STATUSES.includes(status as (typeof DEV_TERMINAL_OP_STATUSES)[number]);
}

function isResolvableOperationStatus(status: string) {
	return DEV_RESOLVABLE_OP_STATUSES.includes(status as (typeof DEV_RESOLVABLE_OP_STATUSES)[number]);
}

function maxLevelForBuilding(buildingKey: DevEditableBuildingKey) {
	const config = BUILDING_CONFIG[buildingKey];
	if (config.kind === "generator") {
		return getGeneratorOrThrow(config.generatorId).maxLevel;
	}
	return config.maxLevel;
}

async function logDevAction(args: {
	actionType: DevActionType;
	actorPlayerId: Id<"players">;
	ctx: MutationCtx;
	now: number;
	payload: unknown;
	result?: unknown;
	targetColonyId?: Id<"colonies">;
	targetOperationId?: Id<"fleetOperations">;
}) {
	await args.ctx.db.insert("devConsoleActions", {
		actorPlayerId: args.actorPlayerId,
		actionType: args.actionType,
		targetColonyId: args.targetColonyId,
		targetOperationId: args.targetOperationId,
		payloadJson: JSON.stringify(args.payload),
		resultJson: args.result === undefined ? undefined : JSON.stringify(args.result),
		createdAt: args.now,
	});
}

async function deleteAllByQuery(args: {
	ctx: MutationCtx;
	dryRun: boolean;
	queryFactory: () => Promise<Array<{ _id: Id<any> }>>;
}) {
	const rows = await args.queryFactory();
	let deleted = 0;

	for (const row of rows) {
		if (!args.dryRun) {
			await args.ctx.db.delete(row._id);
		}
		deleted += 1;
	}

	return deleted;
}

const clearAllPlayerDataDeletedValidator = v.object({
	playerProgression: v.number(),
	playerQuestStates: v.number(),
	devConsoleActions: v.number(),
	playerNotificationPreferences: v.number(),
	notifications: v.number(),
	colonyContractCandidates: v.number(),
	colonyContractDiscoveryState: v.number(),
	contractBoardState: v.number(),
	contractResults: v.number(),
	contracts: v.number(),
	fleetEvents: v.number(),
	fleetOperationResults: v.number(),
	fleetOperations: v.number(),
	fleets: v.number(),
	npcRaidResults: v.number(),
	npcRaidOperations: v.number(),
	colonyQueuePayloads: v.number(),
	colonyQueueItems: v.number(),
	colonyShips: v.number(),
	colonyDefenses: v.number(),
	colonyPolicy: v.number(),
	colonyInfrastructure: v.number(),
	colonyEconomy: v.number(),
	colonies: v.number(),
});

async function getDevAuthorizedOwnedColony(args: { colonyId: Id<"colonies">; ctx: MutationCtx }) {
	const ownedAccess = await requireOwnedColonyAccess({
		ctx: args.ctx,
		colonyId: args.colonyId,
	});
	if (!ownedAccess.player.devConsoleEnabled) {
		throw new ConvexError("Dev console access denied");
	}

	const owned = await getOwnedColony({
		ctx: args.ctx,
		colonyId: args.colonyId,
	});
	return owned;
}

async function shiftOpenLaneScheduleToNow(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	lane: "building" | "shipyard" | "defense";
	now: number;
}) {
	const openRows = (
		await listOpenLaneQueueItems({
			colonyId: args.colonyId,
			ctx: args.ctx,
			lane: args.lane,
		})
	)
		.filter((row) => row.status === "active" || row.status === "queued")
		.sort(compareQueueOrder);

	if (openRows.length === 0) {
		return;
	}

	let cursor = args.now;
	for (const row of openRows) {
		const durationMs = Math.max(0, row.completesAt - row.startsAt);
		const startsAt = cursor;
		const completesAt = cursor + durationMs;
		cursor = completesAt;

		if (row.startsAt === startsAt && row.completesAt === completesAt) {
			continue;
		}

		await args.ctx.db.patch(row._id, {
			startsAt,
			completesAt,
			updatedAt: args.now,
		});
	}
}

export const getDevConsoleState = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		canUseDevConsole: v.boolean(),
		showDevConsoleUi: v.boolean(),
		availableActions: v.object({
			editResources: v.boolean(),
			editBuildingLevels: v.boolean(),
			completeQueueItem: v.boolean(),
			completeMission: v.boolean(),
		}),
	}),
	handler: async (ctx, args) => {
		try {
			const owned = await requireOwnedColonyAccess({
				ctx,
				colonyId: args.colonyId,
			});
			const canUseDevConsole = owned.player.devConsoleEnabled === true;
			const showDevConsoleUi = canUseDevConsole && owned.player.devConsoleUiEnabled === true;
			return {
				canUseDevConsole,
				showDevConsoleUi,
				availableActions: {
					editResources: canUseDevConsole,
					editBuildingLevels: canUseDevConsole,
					completeQueueItem: canUseDevConsole,
					completeMission: canUseDevConsole,
				},
			};
		} catch {
			return {
				canUseDevConsole: false,
				showDevConsoleUi: false,
				availableActions: {
					editResources: false,
					editBuildingLevels: false,
					completeQueueItem: false,
					completeMission: false,
				},
			};
		}
	},
});

export const setDevConsoleUiEnabled = mutation({
	args: {
		enabled: v.boolean(),
	},
	returns: v.object({
		devConsoleUiEnabled: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		if (playerResult.player.devConsoleEnabled !== true) {
			throw new ConvexError("Dev console access denied");
		}

		await ctx.db.patch(playerResult.player._id, {
			devConsoleUiEnabled: args.enabled,
		});

		return {
			devConsoleUiEnabled: args.enabled,
		};
	},
});

export const setColonyResources = mutation({
	args: {
		colonyId: v.id("colonies"),
		resources: resourcePatchValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		resources: v.object({
			alloy: v.number(),
			crystal: v.number(),
			fuel: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});

		const providedKeys = RESOURCE_KEYS.filter((key) => args.resources[key] !== undefined);
		if (providedKeys.length === 0) {
			throw new ConvexError("Provide at least one resource value");
		}

		const nextResources = {
			...settledColony.resources,
		};

		for (const key of providedKeys) {
			const scaled = scaledUnits(sanitizeNonNegativeInteger(args.resources[key]));
			nextResources[key] = Math.min(settledColony.storageCaps[key], scaled);
		}

		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...settledColony,
				resources: nextResources,
				updatedAt: now,
			},
			ctx,
			now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		const result = {
			colonyId: settledColony._id,
			resources: {
				alloy: storedToWholeUnits(nextResources.alloy),
				crystal: storedToWholeUnits(nextResources.crystal),
				fuel: storedToWholeUnits(nextResources.fuel),
			},
		};

		await logDevAction({
			actionType: "setColonyResources",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: args.resources,
			result: result.resources,
			targetColonyId: settledColony._id,
		});

		return result;
	},
});

export const setBuildingLevels = mutation({
	args: {
		colonyId: v.id("colonies"),
		buildingLevels: buildingLevelsPatchValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		buildingLevels: v.object({
			alloyMineLevel: v.number(),
			crystalMineLevel: v.number(),
			fuelRefineryLevel: v.number(),
			powerPlantLevel: v.number(),
			alloyStorageLevel: v.number(),
			crystalStorageLevel: v.number(),
			fuelStorageLevel: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});

		const provided = DEV_EDITABLE_BUILDING_KEYS.filter(
			(key) => args.buildingLevels[key] !== undefined,
		);
		if (provided.length === 0) {
			throw new ConvexError("Provide at least one building level value");
		}

		const nextBuildings = {
			...settledColony.buildings,
		};
		for (const key of provided) {
			const nextLevel = sanitizeNonNegativeInteger(args.buildingLevels[key]);
			nextBuildings[key] = Math.min(maxLevelForBuilding(key), nextLevel);
		}

		const nextStorageCaps = storageCapsFromBuildings(nextBuildings);
		const nextResources = {
			...settledColony.resources,
		};
		for (const key of RESOURCE_KEYS) {
			nextResources[key] = Math.min(nextResources[key], nextStorageCaps[key]);
		}

		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...settledColony,
				buildings: nextBuildings,
				resources: nextResources,
				storageCaps: nextStorageCaps,
				usedSlots: usedSlotsFromBuildings(nextBuildings),
				updatedAt: now,
			},
			ctx,
			now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		const result = {
			colonyId: settledColony._id,
			buildingLevels: {
				alloyMineLevel: nextBuildings.alloyMineLevel,
				crystalMineLevel: nextBuildings.crystalMineLevel,
				fuelRefineryLevel: nextBuildings.fuelRefineryLevel,
				powerPlantLevel: nextBuildings.powerPlantLevel,
				alloyStorageLevel: nextBuildings.alloyStorageLevel,
				crystalStorageLevel: nextBuildings.crystalStorageLevel,
				fuelStorageLevel: nextBuildings.fuelStorageLevel,
			},
		};

		await logDevAction({
			actionType: "setBuildingLevels",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: args.buildingLevels,
			result: result.buildingLevels,
			targetColonyId: settledColony._id,
		});

		return result;
	},
});

export const setFacilityLevels = mutation({
	args: {
		colonyId: v.id("colonies"),
		facilityLevels: facilityLevelsPatchValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		facilityLevels: v.object({
			robotics_hub: v.number(),
			shipyard: v.number(),
			defense_grid: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});

		const provided = (["robotics_hub", "shipyard", "defense_grid"] as const).filter(
			(key) => args.facilityLevels[key] !== undefined,
		);
		if (provided.length === 0) {
			throw new ConvexError("Provide at least one facility level value");
		}

		const nextBuildings = {
			...settledColony.buildings,
		};
		for (const key of provided) {
			const facility = DEFAULT_FACILITY_REGISTRY.get(key as FacilityKey);
			if (!facility) {
				throw new ConvexError(`Unknown facility ${key}`);
			}
			const clamped = Math.min(
				facility.maxLevel,
				sanitizeNonNegativeInteger(args.facilityLevels[key]),
			);
			if (key === "robotics_hub") {
				nextBuildings.roboticsHubLevel = clamped;
			}
			if (key === "shipyard") {
				nextBuildings.shipyardLevel = clamped;
			}
			if (key === "defense_grid") {
				nextBuildings.defenseGridLevel = clamped;
			}
		}

		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...settledColony,
				buildings: nextBuildings,
				usedSlots: usedSlotsFromBuildings(nextBuildings),
				updatedAt: now,
			},
			ctx,
			now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		const result = {
			colonyId: settledColony._id,
			facilityLevels: {
				robotics_hub: nextBuildings.roboticsHubLevel,
				shipyard: nextBuildings.shipyardLevel,
				defense_grid: nextBuildings.defenseGridLevel,
			},
		};

		await logDevAction({
			actionType: "setFacilityLevels",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: args.facilityLevels,
			result: result.facilityLevels,
			targetColonyId: settledColony._id,
		});

		return result;
	},
});

export const setShipCounts = mutation({
	args: {
		colonyId: v.id("colonies"),
		shipCounts: shipCountsPatchValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		shipCounts: v.object({
			smallCargo: v.number(),
			largeCargo: v.number(),
			colonyShip: v.number(),
			interceptor: v.number(),
			frigate: v.number(),
			cruiser: v.number(),
			bomber: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});
		await settleShipyardQueue({
			colony: settledColony,
			ctx,
			now,
		});

		const provided = (Object.keys(args.shipCounts) as Array<keyof typeof args.shipCounts>).filter(
			(key) => args.shipCounts[key] !== undefined,
		);
		if (provided.length === 0) {
			throw new ConvexError("Provide at least one ship count value");
		}

		const shipRows = await ctx.db
			.query("colonyShips")
			.withIndex("by_colony", (q) => q.eq("colonyId", settledColony._id))
			.collect();
		const nextShipCounts = normalizeShipCounts({});
		for (const row of shipRows) {
			nextShipCounts[row.shipKey] = row.count;
		}
		for (const key of provided) {
			nextShipCounts[key] = sanitizeNonNegativeInteger(args.shipCounts[key]);
		}
		await replaceColonyShipCounts({
			colony: settledColony,
			counts: nextShipCounts,
			ctx,
			now,
		});
		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		const result = {
			colonyId: settledColony._id,
			shipCounts: nextShipCounts,
		};

		await logDevAction({
			actionType: "setShipCounts",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: args.shipCounts,
			result: result.shipCounts,
			targetColonyId: settledColony._id,
		});

		return result;
	},
});

export const setDefenseCounts = mutation({
	args: {
		colonyId: v.id("colonies"),
		defenseCounts: defenseCountsPatchValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		defenseCounts: v.object({
			missileBattery: v.number(),
			laserTurret: v.number(),
			gaussCannon: v.number(),
			shieldDome: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});
		await settleDefenseQueue({
			colony: settledColony,
			ctx,
			now,
		});

		const provided = (
			Object.keys(args.defenseCounts) as Array<keyof typeof args.defenseCounts>
		).filter((key) => args.defenseCounts[key] !== undefined);
		if (provided.length === 0) {
			throw new ConvexError("Provide at least one defense count value");
		}

		const nextDefenseCounts = await readColonyDefenseCounts({
			colonyId: settledColony._id,
			ctx,
		});
		for (const key of provided) {
			nextDefenseCounts[key] = sanitizeNonNegativeInteger(args.defenseCounts[key]);
		}
		await replaceColonyDefenseCounts({
			colony: settledColony,
			counts: nextDefenseCounts,
			ctx,
			now,
		});
		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		const result = {
			colonyId: settledColony._id,
			defenseCounts: nextDefenseCounts,
		};

		await logDevAction({
			actionType: "setDefenseCounts",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: args.defenseCounts,
			result: result.defenseCounts,
			targetColonyId: settledColony._id,
		});

		return result;
	},
});

export const completeActiveQueueItem = mutation({
	args: {
		colonyId: v.id("colonies"),
		lane: devQueueLaneValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		completedQueueItemId: v.id("colonyQueueItems"),
		lane: devQueueLaneValidator,
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const settledColony = await settleColonyAndPersist({
			ctx,
			colony: owned.colony,
			planet: owned.planet,
			now,
		});

		if (args.lane === "shipyard") {
			await settleShipyardQueue({
				colony: settledColony,
				ctx,
				now,
			});
		}
		if (args.lane === "defense") {
			await settleDefenseQueue({
				colony: settledColony,
				ctx,
				now,
			});
		}

		const queueRows = await listOpenLaneQueueItems({
			colonyId: settledColony._id,
			ctx,
			lane: args.lane,
		});
		const activeQueue = queueRows.find((row) => {
			if (row.status !== "active") {
				return false;
			}
			if (args.lane === "building") {
				return isBuildingUpgradeQueueItem(row) || isFacilityUpgradeQueueItem(row);
			}
			if (args.lane === "shipyard") {
				return isShipBuildQueueItem(row);
			}
			return isDefenseBuildQueueItem(row);
		});

		if (!activeQueue) {
			throw new ConvexError("No active queue item found");
		}

		if (args.lane === "building") {
			await ctx.db.patch(activeQueue._id, {
				startsAt: Math.min(activeQueue.startsAt, now),
				completesAt: now,
				updatedAt: now,
			});

			await settleColonyAndPersist({
				ctx,
				colony: settledColony,
				planet: owned.planet,
				now,
			});
		} else if (args.lane === "shipyard") {
			if (!isShipBuildQueueItem(activeQueue)) {
				throw new ConvexError("Expected active ship build queue item");
			}

			const payload = activeQueue.payload;
			const remaining = Math.max(0, payload.quantity - payload.completedQuantity);
			if (remaining > 0) {
				await incrementColonyShipCount({
					amount: remaining,
					colony: settledColony,
					ctx,
					now,
					shipKey: payload.shipKey,
				});
			}

			const payloadRow = await ctx.db
				.query("colonyQueuePayloads")
				.withIndex("by_queue_item_id", (q) => q.eq("queueItemId", activeQueue._id))
				.unique();
			if (payloadRow) {
				await ctx.db.patch(payloadRow._id, {
					payload: {
						...payload,
						completedQuantity: payload.quantity,
					},
					updatedAt: now,
				});
			}

			await ctx.db.patch(activeQueue._id, {
				status: "completed",
				resolvedAt: now,
				completesAt: now,
				updatedAt: now,
			});

			const nextQueued = queueRows.find((row) => row.status === "queued");
			if (nextQueued) {
				await ctx.db.patch(nextQueued._id, {
					status: "active",
					updatedAt: now,
				});
			}
		} else {
			if (!isDefenseBuildQueueItem(activeQueue)) {
				throw new ConvexError("Expected active defense build queue item");
			}

			const payload = activeQueue.payload;
			const remaining = Math.max(0, payload.quantity - payload.completedQuantity);
			if (remaining > 0) {
				await incrementColonyDefenseCount({
					amount: remaining,
					colony: settledColony,
					ctx,
					defenseKey: payload.defenseKey,
					now,
				});
			}

			const payloadRow = await ctx.db
				.query("colonyQueuePayloads")
				.withIndex("by_queue_item_id", (q) => q.eq("queueItemId", activeQueue._id))
				.unique();
			if (payloadRow) {
				await ctx.db.patch(payloadRow._id, {
					payload: {
						...payload,
						completedQuantity: payload.quantity,
					},
					updatedAt: now,
				});
			}

			await ctx.db.patch(activeQueue._id, {
				status: "completed",
				resolvedAt: now,
				completesAt: now,
				updatedAt: now,
			});

			const nextQueued = queueRows.find((row) => row.status === "queued");
			if (nextQueued) {
				await ctx.db.patch(nextQueued._id, {
					status: "active",
					updatedAt: now,
				});
			}
		}

		await shiftOpenLaneScheduleToNow({
			colonyId: settledColony._id,
			ctx,
			lane: args.lane,
			now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		await logDevAction({
			actionType: "completeActiveQueueItem",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: {
				lane: args.lane,
			},
			result: {
				completedQueueItemId: activeQueue._id,
			},
			targetColonyId: settledColony._id,
		});

		return {
			colonyId: settledColony._id,
			completedQueueItemId: activeQueue._id,
			lane: args.lane,
		};
	},
});

export const completeActiveMission = mutation({
	args: {
		colonyId: v.id("colonies"),
		operationId: v.id("fleetOperations"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		operationId: v.id("fleetOperations"),
		status: v.string(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const operation = await ctx.db.get(args.operationId);
		if (!operation || operation.ownerPlayerId !== owned.player._id) {
			throw new ConvexError("Operation not found");
		}

		const relatedToColony =
			operation.originColonyId === args.colonyId ||
			(operation.target.kind === "colony" && operation.target.colonyId === args.colonyId);
		if (!relatedToColony) {
			throw new ConvexError("Operation is not related to this colony");
		}

		if (!isResolvableOperationStatus(operation.status)) {
			throw new ConvexError("Only active missions can be completed");
		}

		for (let i = 0; i < 4; i += 1) {
			const latest = await ctx.db.get(args.operationId);
			if (!latest) {
				throw new ConvexError("Operation not found");
			}
			if (isTerminalOperationStatus(latest.status)) {
				break;
			}
			if (!isResolvableOperationStatus(latest.status)) {
				throw new ConvexError("Operation cannot be force-completed in current state");
			}

			await ctx.db.patch(latest._id, {
				arriveAt: Math.min(latest.arriveAt, now),
				nextEventAt: now,
				updatedAt: now,
			});
			const settled = await settleDueFleetOperations({
				ctx,
				now,
				ownerPlayerId: owned.player._id,
			});
			for (const affectedOperationId of settled.affectedOperationIds) {
				await reconcileFleetOperationSchedule({
					ctx,
					operationId: affectedOperationId,
				});
			}
		}

		await reconcileFleetOperationSchedule({
			ctx,
			operationId: args.operationId,
		});

		const resolved = await ctx.db.get(args.operationId);
		if (!resolved) {
			throw new ConvexError("Operation not found");
		}
		if (!isTerminalOperationStatus(resolved.status)) {
			throw new ConvexError("Failed to resolve operation immediately");
		}

		await logDevAction({
			actionType: "completeActiveMission",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: {
				colonyId: args.colonyId,
				operationId: args.operationId,
			},
			result: {
				status: resolved.status,
			},
			targetColonyId: args.colonyId,
			targetOperationId: args.operationId,
		});

		return {
			colonyId: args.colonyId,
			operationId: args.operationId,
			status: resolved.status,
		};
	},
});

export const triggerNpcRaidAtCurrentColony = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		raidOperationId: v.optional(v.id("npcRaidOperations")),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const result = await spawnNpcRaidImmediatelyForColony({
			colony: owned.colony,
			ctx,
			scheduledAt: now,
		});

		await logDevAction({
			actionType: "triggerNpcRaid",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: {
				colonyId: args.colonyId,
			},
			result: {
				raidOperationId: result.raidOperationId,
			},
			targetColonyId: owned.colony._id,
		});

		return {
			colonyId: owned.colony._id,
			raidOperationId: result.raidOperationId,
		};
	},
});

export const completeActiveRaidAtCurrentColony = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		raidOperationId: v.id("npcRaidOperations"),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const owned = await getDevAuthorizedOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const activeRaid = await ctx.db
			.query("npcRaidOperations")
			.withIndex("by_target_status_event", (q) =>
				q.eq("targetColonyId", owned.colony._id).eq("status", "inTransit"),
			)
			.first();
		if (!activeRaid) {
			throw new ConvexError("No active raid found");
		}

		const result = await resolveNpcRaidNow({
			ctx,
			raidOperationId: activeRaid._id,
			scheduledAt: activeRaid.nextEventAt,
		});
		if (result.stale) {
			throw new ConvexError("Failed to resolve active raid immediately");
		}

		await logDevAction({
			actionType: "completeActiveRaid",
			actorPlayerId: owned.player._id,
			ctx,
			now,
			payload: {
				colonyId: args.colonyId,
				raidOperationId: activeRaid._id,
			},
			result: {
				raidOperationId: activeRaid._id,
			},
			targetColonyId: owned.colony._id,
		});

		return {
			colonyId: owned.colony._id,
			raidOperationId: activeRaid._id,
		};
	},
});

export const clearAllPlayerData = internalMutation({
	args: {
		dryRun: v.optional(v.boolean()),
	},
	returns: v.object({
		deleted: clearAllPlayerDataDeletedValidator,
		dryRun: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const dryRun = args.dryRun ?? false;

		const deleted = {
			playerProgression: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("playerProgression").collect(),
			}),
			playerQuestStates: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("playerQuestStates").collect(),
			}),
			devConsoleActions: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("devConsoleActions").collect(),
			}),
			playerNotificationPreferences: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("playerNotificationPreferences").collect(),
			}),
			notifications: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("notifications").collect(),
			}),
			colonyContractCandidates: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyContractCandidates").collect(),
			}),
			colonyContractDiscoveryState: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyContractDiscoveryState").collect(),
			}),
			contractBoardState: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("contractBoardState").collect(),
			}),
			contractResults: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("contractResults").collect(),
			}),
			contracts: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("contracts").collect(),
			}),
			fleetEvents: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("fleetEvents").collect(),
			}),
			fleetOperationResults: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("fleetOperationResults").collect(),
			}),
			fleetOperations: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("fleetOperations").collect(),
			}),
			fleets: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("fleets").collect(),
			}),
			npcRaidResults: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("npcRaidResults").collect(),
			}),
			npcRaidOperations: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("npcRaidOperations").collect(),
			}),
			colonyQueuePayloads: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyQueuePayloads").collect(),
			}),
			colonyQueueItems: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyQueueItems").collect(),
			}),
			colonyShips: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyShips").collect(),
			}),
			colonyDefenses: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyDefenses").collect(),
			}),
			colonyPolicy: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyPolicy").collect(),
			}),
			colonyInfrastructure: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyInfrastructure").collect(),
			}),
			colonyEconomy: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonyEconomy").collect(),
			}),
			colonies: await deleteAllByQuery({
				ctx,
				dryRun,
				queryFactory: () => ctx.db.query("colonies").collect(),
			}),
		};

		return {
			deleted,
			dryRun,
		};
	},
});
