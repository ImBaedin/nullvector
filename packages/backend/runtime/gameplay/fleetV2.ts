import {
	generateSciFiName,
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	normalizeShipCounts,
	simulateCombat,
	type ResourceBucket,
	type ShipCounts,
	type ShipKey,
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
import { RESOURCE_SCALE } from "../../convex/schema";
import { advanceContractBoardSlot, maybeRebuildContractDiscoveryAfterClear } from "./contracts";
import { applyPlanetControlReduction, isPlanetCurrentlyColonizable } from "./hostility";
import {
	emitContractResolvedNotification,
	emitOperationFailedNotification,
	emitTransportDeliveredNotifications,
	emitTransportIncomingNotification,
	emitTransportReturnedNotification,
} from "./notifications";
import { grantPlayerCredits, grantPlayerRankXp } from "./progression";
import { reconcileFleetOperationSchedule } from "./scheduling";
import {
	cloneResourceBucket,
	emptyResourceBucket,
	getOwnedColony,
	incrementColonyShipCount,
	loadColonyState,
	loadPlanetState,
	resolveCurrentPlayer,
	resourceBucketValidator,
	settleDefenseQueue,
	settleShipyardQueue,
	toAddressLabel,
	upsertColonyCompanionRows,
} from "./shared";

const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;

type FleetResultCode =
	| "delivered"
	| "colonized"
	| "cancelledInFlight"
	| "notImplemented"
	| "failed";

const shipCountsValidator = v.object({
	smallCargo: v.number(),
	largeCargo: v.number(),
	colonyShip: v.number(),
	interceptor: v.optional(v.number()),
	frigate: v.optional(v.number()),
	cruiser: v.optional(v.number()),
	bomber: v.optional(v.number()),
});

const transportPostDeliveryActionValidator = v.union(
	v.literal("returnToOrigin"),
	v.literal("stationAtDestination"),
);

const fleetOperationKindValidator = v.union(
	v.literal("transport"),
	v.literal("colonize"),
	v.literal("contract"),
	v.literal("combat"),
);

const fleetOperationStatusValidator = v.union(
	v.literal("planned"),
	v.literal("inTransit"),
	v.literal("atTarget"),
	v.literal("returning"),
	v.literal("completed"),
	v.literal("cancelled"),
	v.literal("failed"),
);

const fleetTargetValidator = v.object({
	kind: v.union(
		v.literal("colony"),
		v.literal("planet"),
		v.literal("fleet"),
		v.literal("contractNode"),
	),
	colonyId: v.optional(v.id("colonies")),
	planetId: v.optional(v.id("planets")),
	fleetId: v.optional(v.id("fleets")),
	contractId: v.optional(v.id("contracts")),
});

function scaledUnits(unscaledUnits: number) {
	return Math.round(Math.max(0, unscaledUnits) * RESOURCE_SCALE);
}

function planetDisplayNameFromStoredOrGenerated(
	planet: Pick<
		Doc<"planets">,
		"galaxyIndex" | "sectorIndex" | "systemIndex" | "planetIndex" | "name"
	>,
) {
	const addressLabel = `G${planet.galaxyIndex}:S${planet.sectorIndex}:SYS${planet.systemIndex}:P${planet.planetIndex}`;
	const trimmed = planet.name?.trim();
	if (trimmed && trimmed.length > 0) {
		return trimmed;
	}
	return generateSciFiName(addressLabel);
}

function wholeUnits(storedAmount: number) {
	return Math.max(0, Math.floor(storedAmount / RESOURCE_SCALE));
}

export function normalizeMissionCargo(cargo: Partial<ResourceBucket>): ResourceBucket {
	const normalizeValue = (value: number | undefined) => {
		if (!Number.isFinite(value ?? 0)) {
			return 0;
		}
		return Math.max(0, Math.floor(value ?? 0));
	};

	return {
		alloy: normalizeValue(cargo.alloy),
		crystal: normalizeValue(cargo.crystal),
		fuel: normalizeValue(cargo.fuel),
	};
}

function resourceMapToScaledBucket(resourceMap: Partial<Record<string, number>>): ResourceBucket {
	return {
		alloy: scaledUnits(resourceMap.alloy ?? 0),
		crystal: scaledUnits(resourceMap.crystal ?? 0),
		fuel: scaledUnits(resourceMap.fuel ?? 0),
	};
}

function missionCargoTotal(cargo: ResourceBucket) {
	return cargo.alloy + cargo.crystal + cargo.fuel;
}

export function durationMsForFleet(args: { distance: number; shipCounts: ShipCounts }) {
	const speed = getFleetSlowestSpeed(args.shipCounts);
	if (speed <= 0) {
		throw new ConvexError("Operation fleet has no ships");
	}
	return Math.max(30_000, Math.ceil((args.distance / speed) * 3_600_000));
}

export function euclideanDistance(args: { x1: number; x2: number; y1: number; y2: number }) {
	return Math.max(1, Math.hypot(args.x1 - args.x2, args.y1 - args.y2));
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

export async function decrementShipsOrThrow(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	now: number;
	requested: ShipCounts;
}) {
	const available = await readColonyShipCounts({
		colonyId: args.colony._id,
		ctx: args.ctx,
	});

	for (const key of Object.keys(args.requested) as ShipKey[]) {
		if (available[key] < args.requested[key]) {
			throw new ConvexError(`Not enough ${key} ships available`);
		}
	}

	for (const key of Object.keys(args.requested) as ShipKey[]) {
		if (args.requested[key] <= 0) {
			continue;
		}
		await incrementColonyShipCount({
			amount: -args.requested[key],
			colony: args.colony,
			ctx: args.ctx,
			now: args.now,
			shipKey: key,
		});
	}
}

export async function colonySystemCoords(args: {
	colonyId: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		throw new ConvexError("Colony not found");
	}
	const planet = await args.ctx.db.get(colony.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found for colony");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for colony");
	}
	return {
		x: system.x,
		y: system.y,
	};
}

async function planetSystemCoords(args: { planetId: Id<"planets">; ctx: QueryCtx | MutationCtx }) {
	const planet = await args.ctx.db.get(args.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for planet");
	}
	return {
		x: system.x,
		y: system.y,
	};
}

function starterColonyBuildings(): Doc<"colonyInfrastructure">["buildings"] {
	return {
		alloyMineLevel: 1,
		crystalMineLevel: 1,
		fuelRefineryLevel: 1,
		powerPlantLevel: 1,
		alloyStorageLevel: 1,
		crystalStorageLevel: 1,
		fuelStorageLevel: 1,
		roboticsHubLevel: 0,
		shipyardLevel: 0,
		defenseGridLevel: 0,
	};
}

function storageCapForLevel(level: number) {
	if (level <= 0) {
		return 0;
	}
	return Math.round(10_000 * Math.pow(1.7, level - 1));
}

function storageCapsFromBuildings(
	buildings: Doc<"colonyInfrastructure">["buildings"],
): ResourceBucket {
	return {
		alloy: scaledUnits(storageCapForLevel(buildings.alloyStorageLevel)),
		crystal: scaledUnits(storageCapForLevel(buildings.crystalStorageLevel)),
		fuel: scaledUnits(storageCapForLevel(buildings.fuelStorageLevel)),
	};
}

function usedSlotsFromBuildings(buildings: Doc<"colonyInfrastructure">["buildings"]) {
	const keys = [
		"alloyMineLevel",
		"crystalMineLevel",
		"fuelRefineryLevel",
		"powerPlantLevel",
		"alloyStorageLevel",
		"crystalStorageLevel",
		"fuelStorageLevel",
		"roboticsHubLevel",
		"shipyardLevel",
		"defenseGridLevel",
	] as const;

	let used = 0;
	for (const key of keys) {
		if ((buildings[key] ?? 0) > 0) {
			used += 1;
		}
	}
	return used;
}

async function applyCargoToColony(args: {
	cargoScaled: ResourceBucket;
	colony: Awaited<ReturnType<typeof loadColonyState>>;
	ctx: MutationCtx;
	now: number;
}) {
	const nextResources = cloneResourceBucket(args.colony.resources);
	const nextOverflow = cloneResourceBucket(args.colony.overflow);
	const deliveredToStorage = emptyResourceBucket();
	const deliveredToOverflow = emptyResourceBucket();

	for (const key of RESOURCE_KEYS) {
		const currentStored = nextResources[key];
		const cap = args.colony.storageCaps[key];
		const inbound = args.cargoScaled[key];
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
		deliveredToStorage,
		deliveredToOverflow,
	};
}

async function appendFleetEvent(args: {
	ctx: MutationCtx;
	data: Record<string, unknown>;
	eventType: Doc<"fleetEvents">["eventType"];
	fleetId: Id<"fleets">;
	now: number;
	operationId: Id<"fleetOperations">;
	ownerPlayerId: Id<"players">;
	universeId: Id<"universes">;
}) {
	await args.ctx.db.insert("fleetEvents", {
		universeId: args.universeId,
		ownerPlayerId: args.ownerPlayerId,
		fleetId: args.fleetId,
		operationId: args.operationId,
		eventType: args.eventType,
		occurredAt: args.now,
		dataJson: JSON.stringify(args.data),
		createdAt: args.now,
	});
}

async function upsertOperationResult(args: {
	ctx: MutationCtx;
	operation: Doc<"fleetOperations">;
	now: number;
	patch: {
		cancelledAt?: number;
		cargoDeliveredToOverflow?: ResourceBucket;
		cargoDeliveredToStorage?: ResourceBucket;
		fuelWaived?: number;
		resolvedAt?: number;
		resultCode?: FleetResultCode;
		resultMessage?: string;
	};
}) {
	const existing = await args.ctx.db
		.query("fleetOperationResults")
		.withIndex("by_operation_id", (q) => q.eq("operationId", args.operation._id))
		.unique();

	const base = {
		universeId: args.operation.universeId,
		ownerPlayerId: args.operation.ownerPlayerId,
		cargoDeliveredToStorage:
			args.patch.cargoDeliveredToStorage ??
			existing?.cargoDeliveredToStorage ??
			emptyResourceBucket(),
		cargoDeliveredToOverflow:
			args.patch.cargoDeliveredToOverflow ??
			existing?.cargoDeliveredToOverflow ??
			emptyResourceBucket(),
		fuelWaived: args.patch.fuelWaived ?? existing?.fuelWaived,
		cancelledAt: args.patch.cancelledAt ?? existing?.cancelledAt,
		resolvedAt: args.patch.resolvedAt ?? existing?.resolvedAt,
		resultCode: args.patch.resultCode ?? existing?.resultCode,
		resultMessage: args.patch.resultMessage ?? existing?.resultMessage,
		updatedAt: args.now,
	};

	if (existing) {
		await args.ctx.db.patch(existing._id, base);
		return;
	}

	await args.ctx.db.insert("fleetOperationResults", {
		operationId: args.operation._id,
		createdAt: args.now,
		...base,
	});
}

async function failOperationAndNotify(args: {
	ctx: MutationCtx;
	now: number;
	operation: Doc<"fleetOperations">;
	resultCode?: FleetResultCode;
	resultMessage: string;
}) {
	await args.ctx.db.patch(args.operation._id, {
		status: "failed",
		updatedAt: args.now,
	});
	await upsertOperationResult({
		ctx: args.ctx,
		operation: args.operation,
		now: args.now,
		patch: {
			resolvedAt: args.now,
			resultCode: args.resultCode ?? "failed",
			resultMessage: args.resultMessage,
		},
	});
	await emitOperationFailedNotification({
		ctx: args.ctx,
		operationId: args.operation._id,
		operationKind: args.operation.kind,
		originColonyId: args.operation.originColonyId,
		playerId: args.operation.ownerPlayerId,
		resultCode: args.resultCode ?? "failed",
		resultMessage: args.resultMessage,
		resolvedAt: args.now,
		universeId: args.operation.universeId,
	});
}

async function settleTransportAtTarget(args: {
	ctx: MutationCtx;
	now: number;
	operation: Doc<"fleetOperations">;
}) {
	const destinationId = args.operation.target.colonyId;
	if (!destinationId) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Missing transport destination",
		});
		return;
	}

	const destinationBase = await args.ctx.db.get(destinationId);
	if (!destinationBase) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Destination colony not found",
		});
		return;
	}

	const destination = await loadColonyState({
		colony: destinationBase,
		ctx: args.ctx,
	});
	if (
		args.operation.postDeliveryAction === "stationAtDestination" &&
		destination.playerId !== args.operation.ownerPlayerId
	) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Cross-player stationing is not allowed",
		});
		return;
	}

	const delivery = await applyCargoToColony({
		cargoScaled: args.operation.cargoRequested,
		colony: destination,
		ctx: args.ctx,
		now: args.now,
	});

	if (args.operation.postDeliveryAction === "stationAtDestination") {
		const stationingShips = normalizeShipCounts(args.operation.shipCounts);
		for (const key of Object.keys(stationingShips) as ShipKey[]) {
			if (stationingShips[key] <= 0) {
				continue;
			}
			await incrementColonyShipCount({
				amount: stationingShips[key],
				colony: destination,
				ctx: args.ctx,
				now: args.now,
				shipKey: key,
			});
		}

		await args.ctx.db.patch(args.operation.fleetId, {
			state: "stationed",
			locationKind: "colony",
			locationColonyId: destination._id,
			routeOperationId: undefined,
			updatedAt: args.now,
		});

		await args.ctx.db.patch(args.operation._id, {
			status: "completed",
			nextEventAt: args.now,
			updatedAt: args.now,
		});
		await upsertOperationResult({
			ctx: args.ctx,
			operation: args.operation,
			now: args.now,
			patch: {
				resolvedAt: args.now,
				cargoDeliveredToStorage: delivery.deliveredToStorage,
				cargoDeliveredToOverflow: delivery.deliveredToOverflow,
				resultCode: "delivered",
			},
		});

		await appendFleetEvent({
			ctx: args.ctx,
			data: {
				deliveredToStorage: delivery.deliveredToStorage,
				deliveredToOverflow: delivery.deliveredToOverflow,
			},
			eventType: "cargoDelivered",
			fleetId: args.operation.fleetId,
			now: args.now,
			operationId: args.operation._id,
			ownerPlayerId: args.operation.ownerPlayerId,
			universeId: args.operation.universeId,
		});
		await emitTransportDeliveredNotifications({
			ctx: args.ctx,
			deliveredAt: args.now,
			deliveredToOverflow: delivery.deliveredToOverflow,
			deliveredToStorage: delivery.deliveredToStorage,
			destinationColonyId: destination._id,
			destinationPlayerId: destination.playerId,
			operationId: args.operation._id,
			originColonyId: args.operation.originColonyId,
			ownerPlayerId: args.operation.ownerPlayerId,
			universeId: args.operation.universeId,
		});
		return;
	}

	await args.ctx.db.patch(args.operation.fleetId, {
		state: "returning",
		locationKind: "route",
		routeOperationId: args.operation._id,
		updatedAt: args.now,
	});

	const returnDuration = Math.max(30_000, args.operation.arriveAt - args.operation.departAt);
	await args.ctx.db.patch(args.operation._id, {
		status: "returning",
		departAt: args.now,
		arriveAt: args.now + returnDuration,
		nextEventAt: args.now + returnDuration,
		updatedAt: args.now,
	});
	await upsertOperationResult({
		ctx: args.ctx,
		operation: args.operation,
		now: args.now,
		patch: {
			cargoDeliveredToStorage: delivery.deliveredToStorage,
			cargoDeliveredToOverflow: delivery.deliveredToOverflow,
		},
	});

	await appendFleetEvent({
		ctx: args.ctx,
		data: {
			deliveredToStorage: delivery.deliveredToStorage,
			deliveredToOverflow: delivery.deliveredToOverflow,
			returnAt: args.now + returnDuration,
		},
		eventType: "arrived",
		fleetId: args.operation.fleetId,
		now: args.now,
		operationId: args.operation._id,
		ownerPlayerId: args.operation.ownerPlayerId,
		universeId: args.operation.universeId,
	});
	await emitTransportDeliveredNotifications({
		ctx: args.ctx,
		deliveredAt: args.now,
		deliveredToOverflow: delivery.deliveredToOverflow,
		deliveredToStorage: delivery.deliveredToStorage,
		destinationColonyId: destination._id,
		destinationPlayerId: destination.playerId,
		operationId: args.operation._id,
		originColonyId: args.operation.originColonyId,
		ownerPlayerId: args.operation.ownerPlayerId,
		returnAt: args.now + returnDuration,
		universeId: args.operation.universeId,
	});
}

async function settleColonizeAtTarget(args: {
	ctx: MutationCtx;
	now: number;
	operation: Doc<"fleetOperations">;
}) {
	const targetPlanetId = args.operation.target.planetId;
	if (!targetPlanetId) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Missing colonization target planet",
		});
		return;
	}

	const targetPlanetBase = await args.ctx.db.get(targetPlanetId);
	if (!targetPlanetBase) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Target planet not found",
		});
		return;
	}

	const targetPlanet = await loadPlanetState({
		planet: targetPlanetBase,
		ctx: args.ctx,
	});

	if (
		!(await isPlanetCurrentlyColonizable({
			ctx: args.ctx,
			planetId: targetPlanetId,
		}))
	) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Target planet is not colonizable",
		});
		return;
	}

	const existing = await args.ctx.db
		.query("colonies")
		.withIndex("by_planet_id", (q) => q.eq("planetId", targetPlanetId))
		.first();

	if (existing) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Target planet already colonized",
		});
		return;
	}

	const starterBuildings = starterColonyBuildings();
	const storageCaps = storageCapsFromBuildings(starterBuildings);
	const colonyId = await args.ctx.db.insert("colonies", {
		universeId: args.operation.universeId,
		playerId: args.operation.ownerPlayerId,
		planetId: targetPlanetId,
		name: `Colony ${targetPlanet.galaxyIndex + 1}-${targetPlanet.sectorIndex + 1}-${targetPlanet.systemIndex + 1}`,
		createdAt: args.now,
		updatedAt: args.now,
	});

	await args.ctx.db.insert("colonyEconomy", {
		colonyId,
		resources: emptyResourceBucket(),
		overflow: emptyResourceBucket(),
		storageCaps,
		lastAccruedAt: args.now,
		createdAt: args.now,
		updatedAt: args.now,
	});

	await args.ctx.db.insert("colonyInfrastructure", {
		colonyId,
		buildings: starterBuildings,
		usedSlots: usedSlotsFromBuildings(starterBuildings),
		createdAt: args.now,
		updatedAt: args.now,
	});

	await args.ctx.db.insert("colonyPolicy", {
		colonyId,
		inboundMissionPolicy: "allowAll",
		createdAt: args.now,
		updatedAt: args.now,
	});
	await args.ctx.scheduler.runAfter(0, internal.raids.reconcileNpcRaidSchedule, {
		colonyId,
	});
	await args.ctx.scheduler.runAfter(0, internal.contracts.rebuildContractDiscoveryForColony, {
		colonyId,
	});

	const createdColonyBase = await args.ctx.db.get(colonyId);
	if (!createdColonyBase) {
		throw new ConvexError("Failed to create colony");
	}
	const createdColony = await loadColonyState({
		colony: createdColonyBase,
		ctx: args.ctx,
	});

	const delivery = await applyCargoToColony({
		cargoScaled: args.operation.cargoRequested,
		colony: createdColony,
		ctx: args.ctx,
		now: args.now,
	});

	for (const key of ["smallCargo", "largeCargo"] as const) {
		if (args.operation.shipCounts[key] <= 0) {
			continue;
		}
		await incrementColonyShipCount({
			amount: args.operation.shipCounts[key],
			colony: createdColony,
			ctx: args.ctx,
			now: args.now,
			shipKey: key,
		});
	}

	await args.ctx.db.patch(args.operation.fleetId, {
		state: "stationed",
		locationKind: "colony",
		locationColonyId: createdColony._id,
		routeOperationId: undefined,
		updatedAt: args.now,
	});

	await args.ctx.db.patch(args.operation._id, {
		status: "completed",
		nextEventAt: args.now,
		updatedAt: args.now,
	});
	await upsertOperationResult({
		ctx: args.ctx,
		operation: args.operation,
		now: args.now,
		patch: {
			resolvedAt: args.now,
			cargoDeliveredToStorage: delivery.deliveredToStorage,
			cargoDeliveredToOverflow: delivery.deliveredToOverflow,
			resultCode: "colonized",
		},
	});

	await appendFleetEvent({
		ctx: args.ctx,
		data: {
			colonyId: createdColony._id,
			planetId: targetPlanetId,
		},
		eventType: "colonyFounded",
		fleetId: args.operation.fleetId,
		now: args.now,
		operationId: args.operation._id,
		ownerPlayerId: args.operation.ownerPlayerId,
		universeId: args.operation.universeId,
	});
}

async function settleContractAtTarget(args: {
	ctx: MutationCtx;
	now: number;
	operation: Doc<"fleetOperations">;
}) {
	const contractId = args.operation.target.contractId;
	if (!contractId) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Missing contract target",
		});
		return;
	}

	const contract = await args.ctx.db.get(contractId);
	if (!contract) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Contract not found",
		});
		return;
	}

	const combat = simulateCombat({
		attacker: {
			ships: args.operation.shipCounts,
			targetPriority: contract.snapshot.priorityProfile.attackerTargetPriority,
		},
		defender: {
			ships: contract.snapshot.enemyFleet,
			defenses: contract.snapshot.enemyDefenses,
			targetPriority: contract.snapshot.priorityProfile.defenderTargetPriority,
		},
		maxRounds: 6,
	});

	const rewardCargoWhole = combat.success
		? contract.snapshot.rewardResources
		: emptyResourceBucket();
	const rewardCapacity = combat.cargoCapacityRemaining;
	let remainingCapacity = rewardCapacity;
	const rewardCargoLoadedWhole = {
		alloy: 0,
		crystal: 0,
		fuel: 0,
	};
	const rewardCargoLostWhole = {
		...rewardCargoWhole,
	};
	for (const key of RESOURCE_KEYS) {
		const loadable = Math.max(0, Math.min(rewardCargoWhole[key], remainingCapacity));
		rewardCargoLoadedWhole[key] = loadable;
		rewardCargoLostWhole[key] = Math.max(0, rewardCargoWhole[key] - loadable);
		remainingCapacity -= loadable;
	}

	const rewardCargoScaled = resourceMapToScaledBucket(rewardCargoLoadedWhole);
	const rewardCargoLostScaled = resourceMapToScaledBucket(rewardCargoLostWhole);
	const returnDuration = Math.max(30_000, args.operation.arriveAt - args.operation.departAt);
	const controlReductionApplied = combat.success
		? (
				await applyPlanetControlReduction({
					controlReduction: contract.snapshot.controlReduction,
					ctx: args.ctx,
					now: args.now,
					planetId: contract.planetId,
				})
			).applied
		: 0;
	const rankXpGranted = combat.success
		? contract.snapshot.rewardRankXpSuccess
		: contract.snapshot.rewardRankXpFailure;

	if (combat.success) {
		await grantPlayerCredits({
			amount: contract.snapshot.rewardCredits,
			ctx: args.ctx,
			playerId: contract.playerId,
		});
	}
	await grantPlayerRankXp({
		amount: rankXpGranted,
		ctx: args.ctx,
		playerId: contract.playerId,
	});

	await args.ctx.db.patch(contract._id, {
		status: combat.success ? "completed" : "failed",
		resolvedAt: args.now,
		updatedAt: args.now,
	});

	await args.ctx.db.insert("contractResults", {
		contractId: contract._id,
		operationId: args.operation._id,
		playerId: contract.playerId,
		planetId: contract.planetId,
		success: combat.success,
		roundsFought: combat.roundsFought,
		attackerSurvivors: combat.attackerRemaining,
		defenderSurvivors: {
			fleet: combat.defenderFleetRemaining,
			defenses: combat.defenderDefenseRemaining,
		},
		rewardCreditsGranted: combat.success ? contract.snapshot.rewardCredits : 0,
		rewardRankXpGranted: rankXpGranted,
		rewardCargoLoaded: rewardCargoScaled,
		rewardCargoLostByCapacity: rewardCargoLostScaled,
		controlReductionApplied,
		createdAt: args.now,
		updatedAt: args.now,
	});

	await args.ctx.db.patch(args.operation.fleetId, {
		state: "returning",
		locationKind: "route",
		routeOperationId: args.operation._id,
		shipCounts: combat.attackerRemaining,
		cargo: rewardCargoScaled,
		updatedAt: args.now,
	});
	await args.ctx.db.patch(args.operation._id, {
		status: "returning",
		shipCounts: combat.attackerRemaining,
		departAt: args.now,
		arriveAt: args.now + returnDuration,
		nextEventAt: args.now + returnDuration,
		updatedAt: args.now,
	});
	await upsertOperationResult({
		ctx: args.ctx,
		operation: args.operation,
		now: args.now,
		patch: {
			resultCode: combat.success ? "delivered" : "failed",
		},
	});

	await appendFleetEvent({
		ctx: args.ctx,
		data: {
			contractId: contract._id,
			success: combat.success,
			roundsFought: combat.roundsFought,
			controlReductionApplied,
			returnAt: args.now + returnDuration,
		},
		eventType: combat.success ? "arrived" : "failed",
		fleetId: args.operation.fleetId,
		now: args.now,
		operationId: args.operation._id,
		ownerPlayerId: args.operation.ownerPlayerId,
		universeId: args.operation.universeId,
	});
	await emitContractResolvedNotification({
		controlReductionApplied,
		ctx: args.ctx,
		operationId: args.operation._id,
		originColonyId: contract.originColonyId ?? args.operation.originColonyId,
		planetId: contract.planetId,
		playerId: contract.playerId,
		resolvedAt: args.now,
		rewardCargoLoaded: rewardCargoScaled,
		rewardCargoLostByCapacity: rewardCargoLostScaled,
		rewardCreditsGranted: combat.success ? contract.snapshot.rewardCredits : 0,
		rewardRankXpGranted: rankXpGranted,
		roundsFought: combat.roundsFought,
		success: combat.success,
		contractId: contract._id,
		universeId: args.operation.universeId,
	});

	const originColonyId = contract.originColonyId ?? args.operation.originColonyId;
	await advanceContractBoardSlot({
		ctx: args.ctx,
		colonyId: originColonyId,
		now: args.now,
		planetId: contract.planetId,
		playerId: contract.playerId,
		slot: contract.slot,
	});
	if (controlReductionApplied > 0) {
		await maybeRebuildContractDiscoveryAfterClear({
			ctx: args.ctx,
			colonyId: originColonyId,
			now: args.now,
		});
	}
}

async function settleOperationReturn(args: {
	ctx: MutationCtx;
	now: number;
	operation: Doc<"fleetOperations">;
}) {
	const originBase = await args.ctx.db.get(args.operation.originColonyId);
	if (!originBase) {
		await failOperationAndNotify({
			ctx: args.ctx,
			now: args.now,
			operation: args.operation,
			resultCode: "failed",
			resultMessage: "Origin colony not found for return",
		});
		return;
	}

	const origin = await loadColonyState({
		colony: originBase,
		ctx: args.ctx,
	});
	const fleet = await args.ctx.db.get(args.operation.fleetId);
	if (!fleet) {
		throw new ConvexError("Fleet not found for return");
	}
	if (fleet.cargo.alloy > 0 || fleet.cargo.crystal > 0 || fleet.cargo.fuel > 0) {
		await applyCargoToColony({
			cargoScaled: fleet.cargo,
			colony: origin,
			ctx: args.ctx,
			now: args.now,
		});
	}

	const returningShips = normalizeShipCounts(args.operation.shipCounts);
	for (const key of Object.keys(returningShips) as ShipKey[]) {
		if (returningShips[key] <= 0) {
			continue;
		}
		await incrementColonyShipCount({
			amount: returningShips[key],
			colony: originBase,
			ctx: args.ctx,
			now: args.now,
			shipKey: key,
		});
	}

	await args.ctx.db.patch(args.operation.fleetId, {
		state: "stationed",
		locationKind: "colony",
		locationColonyId: originBase._id,
		cargo: emptyResourceBucket(),
		routeOperationId: undefined,
		updatedAt: args.now,
	});

	const result = await args.ctx.db
		.query("fleetOperationResults")
		.withIndex("by_operation_id", (q) => q.eq("operationId", args.operation._id))
		.unique();

	await args.ctx.db.patch(args.operation._id, {
		status: "completed",
		nextEventAt: args.now,
		updatedAt: args.now,
	});
	await upsertOperationResult({
		ctx: args.ctx,
		operation: args.operation,
		now: args.now,
		patch: {
			resolvedAt: args.now,
			resultCode:
				args.operation.status === "returning" && result?.cancelledAt
					? "cancelledInFlight"
					: (result?.resultCode ?? "delivered"),
		},
	});

	await appendFleetEvent({
		ctx: args.ctx,
		data: {
			originColonyId: originBase._id,
		},
		eventType: "returned",
		fleetId: args.operation.fleetId,
		now: args.now,
		operationId: args.operation._id,
		ownerPlayerId: args.operation.ownerPlayerId,
		universeId: args.operation.universeId,
	});
	if (args.operation.kind === "transport" && !result?.cancelledAt) {
		await emitTransportReturnedNotification({
			ctx: args.ctx,
			operationId: args.operation._id,
			originColonyId: originBase._id,
			playerId: args.operation.ownerPlayerId,
			returnedAt: args.now,
			universeId: args.operation.universeId,
		});
	}
}

export async function settleDueFleetOperations(args: {
	ctx: MutationCtx;
	now: number;
	ownerPlayerId: Id<"players">;
}) {
	const affectedOperationIds = new Set<Id<"fleetOperations">>();
	const [dueInTransit, dueReturning] = await Promise.all([
		args.ctx.db
			.query("fleetOperations")
			.withIndex("by_owner_stat_evt", (q) =>
				q
					.eq("ownerPlayerId", args.ownerPlayerId)
					.eq("status", "inTransit")
					.lte("nextEventAt", args.now),
			)
			.collect(),
		args.ctx.db
			.query("fleetOperations")
			.withIndex("by_owner_stat_evt", (q) =>
				q
					.eq("ownerPlayerId", args.ownerPlayerId)
					.eq("status", "returning")
					.lte("nextEventAt", args.now),
			)
			.collect(),
	]);

	const due = [...dueInTransit, ...dueReturning].sort(
		(left, right) => left.nextEventAt - right.nextEventAt,
	);

	for (const operation of due) {
		const latest = await args.ctx.db.get(operation._id);
		if (!latest) {
			continue;
		}

		if (
			(latest.status !== "inTransit" && latest.status !== "returning") ||
			latest.nextEventAt > args.now
		) {
			continue;
		}
		affectedOperationIds.add(latest._id);

		if (latest.status === "returning") {
			await settleOperationReturn({
				ctx: args.ctx,
				now: args.now,
				operation: latest,
			});
			continue;
		}

		if (latest.kind === "transport") {
			await settleTransportAtTarget({
				ctx: args.ctx,
				now: args.now,
				operation: latest,
			});
			continue;
		}

		if (latest.kind === "colonize") {
			await settleColonizeAtTarget({
				ctx: args.ctx,
				now: args.now,
				operation: latest,
			});
			continue;
		}

		if (latest.kind === "contract") {
			await settleContractAtTarget({
				ctx: args.ctx,
				now: args.now,
				operation: latest,
			});
			continue;
		}

		const origin = await args.ctx.db.get(latest.originColonyId);
		if (origin) {
			const fallbackShips = normalizeShipCounts(latest.shipCounts);
			for (const key of Object.keys(fallbackShips) as ShipKey[]) {
				if (fallbackShips[key] <= 0) {
					continue;
				}
				await incrementColonyShipCount({
					amount: fallbackShips[key],
					colony: origin,
					ctx: args.ctx,
					now: args.now,
					shipKey: key,
				});
			}
		}

		await args.ctx.db.patch(latest._id, {
			status: "failed",
			nextEventAt: args.now,
			updatedAt: args.now,
		});
		await upsertOperationResult({
			ctx: args.ctx,
			operation: latest,
			now: args.now,
			patch: {
				resolvedAt: args.now,
				resultCode: "notImplemented",
				resultMessage: `${latest.kind} operations are not implemented yet`,
			},
		});

		await args.ctx.db.patch(latest.fleetId, {
			state: origin ? "stationed" : "destroyed",
			locationKind: origin ? "colony" : "route",
			locationColonyId: origin?._id,
			routeOperationId: undefined,
			updatedAt: args.now,
		});

		await appendFleetEvent({
			ctx: args.ctx,
			data: {
				reason: `${latest.kind} operations are not implemented yet`,
			},
			eventType: "failed",
			fleetId: latest.fleetId,
			now: args.now,
			operationId: latest._id,
			ownerPlayerId: latest.ownerPlayerId,
			universeId: latest.universeId,
		});
		await emitOperationFailedNotification({
			ctx: args.ctx,
			operationId: latest._id,
			operationKind: latest.kind,
			originColonyId: latest.originColonyId,
			playerId: latest.ownerPlayerId,
			resultCode: "notImplemented",
			resultMessage: `${latest.kind} operations are not implemented yet`,
			resolvedAt: args.now,
			universeId: latest.universeId,
		});
	}

	return {
		affectedOperationIds: [...affectedOperationIds],
		resolvedCount: due.length,
	};
}

const operationSummaryValidator = v.object({
	id: v.id("fleetOperations"),
	fleetId: v.id("fleets"),
	kind: fleetOperationKindValidator,
	status: fleetOperationStatusValidator,
	originColonyId: v.id("colonies"),
	target: fleetTargetValidator,
	shipCounts: shipCountsValidator,
	cargoRequested: resourceBucketValidator,
	postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
	departAt: v.number(),
	arriveAt: v.number(),
	nextEventAt: v.number(),
	parentOperationId: v.optional(v.id("fleetOperations")),
});

const fleetOperationTargetPreviewValidator = v.object({
	isOwnedByPlayer: v.optional(v.boolean()),
	kind: v.union(v.literal("colony"), v.literal("planet")),
	label: v.string(),
});

const fleetOperationOriginColonySummaryValidator = v.object({
	id: v.id("fleetOperations"),
	fleetId: v.id("fleets"),
	kind: fleetOperationKindValidator,
	status: fleetOperationStatusValidator,
	originColonyId: v.id("colonies"),
	originName: v.string(),
	originAddressLabel: v.string(),
	target: fleetTargetValidator,
	targetPreview: fleetOperationTargetPreviewValidator,
	shipCounts: shipCountsValidator,
	cargoRequested: resourceBucketValidator,
	postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
	departAt: v.number(),
	arriveAt: v.number(),
	nextEventAt: v.number(),
	distance: v.number(),
	canCancel: v.boolean(),
});
const fleetOperationColonyRelationValidator = v.union(v.literal("outgoing"), v.literal("incoming"));
const fleetOperationColonySummaryValidator = v.object({
	id: v.id("fleetOperations"),
	fleetId: v.id("fleets"),
	kind: fleetOperationKindValidator,
	status: fleetOperationStatusValidator,
	relation: fleetOperationColonyRelationValidator,
	originColonyId: v.id("colonies"),
	originName: v.string(),
	originAddressLabel: v.string(),
	target: fleetTargetValidator,
	targetPreview: fleetOperationTargetPreviewValidator,
	shipCounts: shipCountsValidator,
	cargoRequested: resourceBucketValidator,
	postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
	departAt: v.number(),
	arriveAt: v.number(),
	nextEventAt: v.number(),
	distance: v.number(),
	canCancel: v.boolean(),
});

const missionKindValidator = v.union(v.literal("transport"), v.literal("colonize"));

const resolveFleetTargetResultValidator = v.object({
	ok: v.boolean(),
	reason: v.optional(v.string()),
	distance: v.optional(v.number()),
	target: v.optional(fleetTargetValidator),
	targetPreview: v.optional(fleetOperationTargetPreviewValidator),
});

type FleetOperationTargetPreview = {
	isOwnedByPlayer?: boolean;
	kind: "colony" | "planet";
	label: string;
};

type FleetOperationDisplayEndpoint = {
	addressLabel: string;
	colonyId?: Id<"colonies">;
	name: string;
};

async function resolveOperationTargetPreview(args: {
	ctx: QueryCtx;
	getColonySummary: (colonyId: Id<"colonies">) => Promise<{ addressLabel: string; name: string }>;
	ownerPlayerId: Id<"players">;
	target: Doc<"fleetOperations">["target"];
}): Promise<FleetOperationTargetPreview> {
	const { ctx, getColonySummary, ownerPlayerId, target } = args;

	if (target.kind === "colony" && target.colonyId) {
		const targetSummary = await getColonySummary(target.colonyId);
		const targetColony = await ctx.db.get(target.colonyId);
		return {
			kind: "colony",
			label: `${targetSummary.name} (${targetSummary.addressLabel})`,
			isOwnedByPlayer: targetColony?.playerId === ownerPlayerId,
		};
	}

	if (target.kind === "planet" && target.planetId) {
		const targetPlanet = await ctx.db.get(target.planetId);
		if (targetPlanet) {
			return {
				kind: "planet",
				label: `${planetDisplayNameFromStoredOrGenerated(targetPlanet)} (${toAddressLabel(targetPlanet)})`,
			};
		}
	}

	if (target.kind === "contractNode" && target.contractId) {
		const contract = await ctx.db.get(target.contractId);
		if (contract) {
			const targetPlanet = await ctx.db.get(contract.planetId);
			if (targetPlanet) {
				return {
					kind: "planet",
					label: `${planetDisplayNameFromStoredOrGenerated(targetPlanet)} (${toAddressLabel(targetPlanet)})`,
				};
			}
		}
	}

	return {
		kind: "planet",
		label: "Unknown target",
	};
}

async function resolveReturningOriginEndpoint(args: {
	ctx: QueryCtx;
	getColonySummary: (colonyId: Id<"colonies">) => Promise<{ addressLabel: string; name: string }>;
	target: Doc<"fleetOperations">["target"];
}): Promise<FleetOperationDisplayEndpoint> {
	const { ctx, getColonySummary, target } = args;

	if (target.kind === "colony" && target.colonyId) {
		const summary = await getColonySummary(target.colonyId);
		return {
			colonyId: target.colonyId,
			name: summary.name,
			addressLabel: summary.addressLabel,
		};
	}

	if (target.kind === "planet" && target.planetId) {
		const targetPlanet = await ctx.db.get(target.planetId);
		if (targetPlanet) {
			return {
				name: planetDisplayNameFromStoredOrGenerated(targetPlanet),
				addressLabel: toAddressLabel(targetPlanet),
			};
		}
	}

	if (target.kind === "contractNode" && target.contractId) {
		const contract = await ctx.db.get(target.contractId);
		if (contract) {
			const targetPlanet = await ctx.db.get(contract.planetId);
			if (targetPlanet) {
				return {
					name: planetDisplayNameFromStoredOrGenerated(targetPlanet),
					addressLabel: toAddressLabel(targetPlanet),
				};
			}
		}
	}

	return {
		name: "Unknown origin",
		addressLabel: "Unknown",
	};
}

async function resolveOperationDisplay(args: {
	ctx: QueryCtx;
	getColonySummary: (colonyId: Id<"colonies">) => Promise<{ addressLabel: string; name: string }>;
	ownerPlayerId: Id<"players">;
	operation: Doc<"fleetOperations">;
}) {
	const { ctx, getColonySummary, ownerPlayerId, operation } = args;
	const homeSummary = await getColonySummary(operation.originColonyId);

	if (operation.status === "returning") {
		const returningOrigin = await resolveReturningOriginEndpoint({
			ctx,
			getColonySummary,
			target: operation.target,
		});
		return {
			displayOrigin: returningOrigin,
			displayTarget: {
				kind: "colony" as const,
				label: `${homeSummary.name} (${homeSummary.addressLabel})`,
				isOwnedByPlayer: true,
			},
			displayTargetColonyId: operation.originColonyId,
		};
	}

	return {
		displayOrigin: {
			colonyId: operation.originColonyId,
			name: homeSummary.name,
			addressLabel: homeSummary.addressLabel,
		},
		displayTarget: await resolveOperationTargetPreview({
			ctx,
			getColonySummary,
			ownerPlayerId,
			target: operation.target,
		}),
		displayTargetColonyId:
			operation.target.kind === "colony" ? operation.target.colonyId : undefined,
	};
}

export const getFleetGarrison = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		garrisonShips: shipCountsValidator,
	}),
	handler: async (ctx, args) => {
		await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const shipRows = await ctx.db
			.query("colonyShips")
			.withIndex("by_colony", (q) => q.eq("colonyId", args.colonyId))
			.collect();

		const garrisonShips = normalizeShipCounts({});
		for (const row of shipRows) {
			garrisonShips[row.shipKey] = row.count;
		}

		return {
			garrisonShips,
		};
	},
});

export const getFleetActiveOperations = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		active: v.array(operationSummaryValidator),
		nextEventAt: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const { player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const [inTransit, returning] = await Promise.all([
			ctx.db
				.query("fleetOperations")
				.withIndex("by_owner_stat_evt", (q) =>
					q.eq("ownerPlayerId", player._id).eq("status", "inTransit"),
				)
				.collect(),
			ctx.db
				.query("fleetOperations")
				.withIndex("by_owner_stat_evt", (q) =>
					q.eq("ownerPlayerId", player._id).eq("status", "returning"),
				)
				.collect(),
		]);

		const activeOps = [...inTransit, ...returning].sort(
			(left, right) => left.nextEventAt - right.nextEventAt,
		);

		return {
			active: activeOps.map((operation) => ({
				id: operation._id,
				fleetId: operation.fleetId,
				kind: operation.kind,
				status: operation.status,
				originColonyId: operation.originColonyId,
				target: operation.target,
				shipCounts: normalizeShipCounts(operation.shipCounts),
				cargoRequested: {
					alloy: wholeUnits(operation.cargoRequested.alloy),
					crystal: wholeUnits(operation.cargoRequested.crystal),
					fuel: wholeUnits(operation.cargoRequested.fuel),
				},
				postDeliveryAction: operation.postDeliveryAction,
				departAt: operation.departAt,
				arriveAt: operation.arriveAt,
				nextEventAt: operation.nextEventAt,
				parentOperationId: operation.parentOperationId,
			})),
			nextEventAt: activeOps[0]?.nextEventAt,
		};
	},
});

export const getFleetOperationsForOriginColony = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		active: v.array(fleetOperationOriginColonySummaryValidator),
		nextEventAt: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const [inTransit, returning] = await Promise.all([
			ctx.db
				.query("fleetOperations")
				.withIndex("by_origin_stat_evt", (q) =>
					q.eq("originColonyId", colony._id).eq("status", "inTransit"),
				)
				.collect(),
			ctx.db
				.query("fleetOperations")
				.withIndex("by_origin_stat_evt", (q) =>
					q.eq("originColonyId", colony._id).eq("status", "returning"),
				)
				.collect(),
		]);

		const activeOps = [...inTransit, ...returning]
			.filter((operation) => operation.ownerPlayerId === player._id)
			.sort((left, right) => left.nextEventAt - right.nextEventAt);

		const colonySummaryCache = new Map<Id<"colonies">, { addressLabel: string; name: string }>();
		const getColonySummary = async (colonyId: Id<"colonies">) => {
			const cached = colonySummaryCache.get(colonyId);
			if (cached) {
				return cached;
			}
			const colonyRow = await ctx.db.get(colonyId);
			if (!colonyRow) {
				const fallback = {
					name: "Unknown colony",
					addressLabel: "Unknown",
				};
				colonySummaryCache.set(colonyId, fallback);
				return fallback;
			}
			const planetRow = await ctx.db.get(colonyRow.planetId);
			const summary = {
				name: colonyRow.name,
				addressLabel: planetRow ? toAddressLabel(planetRow) : "Unknown",
			};
			colonySummaryCache.set(colonyId, summary);
			return summary;
		};

		const rows = await Promise.all(
			activeOps.map(async (operation) => {
				const display = await resolveOperationDisplay({
					ctx,
					getColonySummary,
					ownerPlayerId: player._id,
					operation,
				});

				return {
					id: operation._id,
					fleetId: operation.fleetId,
					kind: operation.kind,
					status: operation.status,
					originColonyId: operation.originColonyId,
					originName: display.displayOrigin.name,
					originAddressLabel: display.displayOrigin.addressLabel,
					target: operation.target,
					targetPreview: display.displayTarget,
					shipCounts: normalizeShipCounts(operation.shipCounts),
					cargoRequested: {
						alloy: wholeUnits(operation.cargoRequested.alloy),
						crystal: wholeUnits(operation.cargoRequested.crystal),
						fuel: wholeUnits(operation.cargoRequested.fuel),
					},
					postDeliveryAction: operation.postDeliveryAction,
					departAt: operation.departAt,
					arriveAt: operation.arriveAt,
					nextEventAt: operation.nextEventAt,
					distance: operation.distance,
					canCancel: operation.status === "inTransit",
				};
			}),
		);

		return {
			active: rows,
			nextEventAt: rows[0]?.nextEventAt,
		};
	},
});

export const getFleetOperationsForColony = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		active: v.array(fleetOperationColonySummaryValidator),
		hasStaleOwnedOperations: v.boolean(),
		nextEventAt: v.optional(v.number()),
		serverNowMs: v.number(),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const now = Date.now();

		const [ownedInTransit, ownedReturning, inboundInTransit, inboundReturning] = await Promise.all([
			ctx.db
				.query("fleetOperations")
				.withIndex("by_owner_stat_evt", (q) =>
					q.eq("ownerPlayerId", player._id).eq("status", "inTransit"),
				)
				.collect(),
			ctx.db
				.query("fleetOperations")
				.withIndex("by_owner_stat_evt", (q) =>
					q.eq("ownerPlayerId", player._id).eq("status", "returning"),
				)
				.collect(),
			ctx.db
				.query("fleetOperations")
				.withIndex("by_tcol_st_evt", (q) =>
					q.eq("target.colonyId", colony._id).eq("status", "inTransit"),
				)
				.collect(),
			ctx.db
				.query("fleetOperations")
				.withIndex("by_tcol_st_evt", (q) =>
					q.eq("target.colonyId", colony._id).eq("status", "returning"),
				)
				.collect(),
		]);

		const activeOps = [
			...new Map(
				[...ownedInTransit, ...ownedReturning, ...inboundInTransit, ...inboundReturning].map(
					(operation) => [operation._id, operation],
				),
			).values(),
		].sort((left, right) => left.nextEventAt - right.nextEventAt);
		const hasStaleOwnedOperations = [...ownedInTransit, ...ownedReturning].some(
			(operation) => operation.nextEventAt <= now,
		);

		const colonySummaryCache = new Map<Id<"colonies">, { addressLabel: string; name: string }>();
		const getColonySummary = async (colonyId: Id<"colonies">) => {
			const cached = colonySummaryCache.get(colonyId);
			if (cached) {
				return cached;
			}
			const colonyRow = await ctx.db.get(colonyId);
			if (!colonyRow) {
				const fallback = {
					name: "Unknown colony",
					addressLabel: "Unknown",
				};
				colonySummaryCache.set(colonyId, fallback);
				return fallback;
			}
			const planetRow = await ctx.db.get(colonyRow.planetId);
			const summary = {
				name: colonyRow.name,
				addressLabel: planetRow ? toAddressLabel(planetRow) : "Unknown",
			};
			colonySummaryCache.set(colonyId, summary);
			return summary;
		};

		const rows = await Promise.all(
			activeOps.map(async (operation) => {
				const display = await resolveOperationDisplay({
					ctx,
					getColonySummary,
					ownerPlayerId: player._id,
					operation,
				});
				const isRelevant =
					display.displayOrigin.colonyId === colony._id ||
					display.displayTargetColonyId === colony._id;
				if (!isRelevant) {
					return null;
				}
				const relation: "incoming" | "outgoing" =
					display.displayOrigin.colonyId === colony._id ? "outgoing" : "incoming";

				return {
					id: operation._id,
					fleetId: operation.fleetId,
					kind: operation.kind,
					status: operation.status,
					relation,
					originColonyId: operation.originColonyId,
					originName: display.displayOrigin.name,
					originAddressLabel: display.displayOrigin.addressLabel,
					target: operation.target,
					targetPreview: display.displayTarget,
					shipCounts: normalizeShipCounts(operation.shipCounts),
					cargoRequested: {
						alloy: wholeUnits(operation.cargoRequested.alloy),
						crystal: wholeUnits(operation.cargoRequested.crystal),
						fuel: wholeUnits(operation.cargoRequested.fuel),
					},
					postDeliveryAction: operation.postDeliveryAction,
					departAt: operation.departAt,
					arriveAt: operation.arriveAt,
					nextEventAt: operation.nextEventAt,
					distance: operation.distance,
					canCancel: operation.status === "inTransit",
				};
			}),
		);

		return {
			active: rows.filter((row) => row !== null),
			hasStaleOwnedOperations,
			nextEventAt: rows.find((row) => row !== null)?.nextEventAt,
			serverNowMs: now,
		};
	},
});

export const resolveFleetTarget = query({
	args: {
		originColonyId: v.id("colonies"),
		missionKind: missionKindValidator,
		galaxyIndex: v.number(),
		sectorIndex: v.number(),
		systemIndex: v.number(),
		planetIndex: v.number(),
	},
	returns: resolveFleetTargetResultValidator,
	handler: async (ctx, args) => {
		const safeIndex = (value: number) =>
			Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
		const galaxyIndex = safeIndex(args.galaxyIndex);
		const sectorIndex = safeIndex(args.sectorIndex);
		const systemIndex = safeIndex(args.systemIndex);
		const planetIndex = safeIndex(args.planetIndex);

		const origin = await getOwnedColony({
			ctx,
			colonyId: args.originColonyId,
		});

		const planet = await ctx.db
			.query("planets")
			.withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
				q
					.eq("universeId", origin.colony.universeId)
					.eq("galaxyIndex", galaxyIndex)
					.eq("sectorIndex", sectorIndex)
					.eq("systemIndex", systemIndex)
					.eq("planetIndex", planetIndex),
			)
			.unique();

		if (!planet) {
			return {
				ok: false,
				reason: "No planet found at those coordinates",
			};
		}

		if (args.missionKind === "transport") {
			const targetColony = await ctx.db
				.query("colonies")
				.withIndex("by_planet_id", (q) => q.eq("planetId", planet._id))
				.unique();

			if (!targetColony) {
				return {
					ok: false,
					reason: "Transport missions require a colonized destination",
				};
			}

			const targetColonyState = await loadColonyState({
				colony: targetColony,
				ctx,
			});
			if ((targetColonyState.inboundMissionPolicy ?? "allowAll") === "denyAll") {
				return {
					ok: false,
					reason: "Destination colony does not accept inbound missions",
				};
			}

			const [originCoords, targetCoords] = await Promise.all([
				colonySystemCoords({
					colonyId: origin.colony._id,
					ctx,
				}),
				colonySystemCoords({
					colonyId: targetColony._id,
					ctx,
				}),
			]);

			const distance = euclideanDistance({
				x1: originCoords.x,
				y1: originCoords.y,
				x2: targetCoords.x,
				y2: targetCoords.y,
			});

			return {
				ok: true,
				distance,
				target: {
					kind: "colony" as const,
					colonyId: targetColony._id,
				},
				targetPreview: {
					kind: "colony" as const,
					label: `${targetColony.name} (${toAddressLabel(planet)})`,
					isOwnedByPlayer: targetColony.playerId === origin.player._id,
				},
			};
		}

		await loadPlanetState({
			planet,
			ctx,
		});
		if (
			!(await isPlanetCurrentlyColonizable({
				ctx,
				planetId: planet._id,
			}))
		) {
			return {
				ok: false,
				reason: "Target planet is not colonizable",
			};
		}

		const existingColony = await ctx.db
			.query("colonies")
			.withIndex("by_planet_id", (q) => q.eq("planetId", planet._id))
			.first();
		if (existingColony) {
			return {
				ok: false,
				reason: "Target planet is already colonized",
			};
		}

		const activeColonizeOps = await ctx.db
			.query("fleetOperations")
			.withIndex("by_tplanet_st_evt", (q) =>
				q.eq("target.planetId", planet._id).eq("status", "inTransit"),
			)
			.collect();
		if (activeColonizeOps.some((row) => row.kind === "colonize")) {
			return {
				ok: false,
				reason: "Target planet already has an active colonization mission",
			};
		}

		const [originCoords, targetCoords] = await Promise.all([
			colonySystemCoords({
				colonyId: origin.colony._id,
				ctx,
			}),
			planetSystemCoords({
				planetId: planet._id,
				ctx,
			}),
		]);
		const distance = euclideanDistance({
			x1: originCoords.x,
			y1: originCoords.y,
			x2: targetCoords.x,
			y2: targetCoords.y,
		});

		return {
			ok: true,
			distance,
			target: {
				kind: "planet" as const,
				planetId: planet._id,
			},
			targetPreview: {
				kind: "planet" as const,
				label: toAddressLabel(planet),
			},
		};
	},
});

export const getFleetOperation = query({
	args: {
		operationId: v.id("fleetOperations"),
	},
	returns: v.object({
		operation: operationSummaryValidator,
		resultCode: v.optional(v.string()),
		resultMessage: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const player = await resolveCurrentPlayer(ctx);
		if (!player?.player) {
			throw new ConvexError("Authentication required");
		}

		const operation = await ctx.db.get(args.operationId);
		if (!operation || operation.ownerPlayerId !== player.player._id) {
			throw new ConvexError("Operation not found");
		}

		const result = await ctx.db
			.query("fleetOperationResults")
			.withIndex("by_operation_id", (q) => q.eq("operationId", operation._id))
			.unique();

		return {
			operation: {
				id: operation._id,
				fleetId: operation.fleetId,
				kind: operation.kind,
				status: operation.status,
				originColonyId: operation.originColonyId,
				target: operation.target,
				shipCounts: normalizeShipCounts(operation.shipCounts),
				cargoRequested: {
					alloy: wholeUnits(operation.cargoRequested.alloy),
					crystal: wholeUnits(operation.cargoRequested.crystal),
					fuel: wholeUnits(operation.cargoRequested.fuel),
				},
				postDeliveryAction: operation.postDeliveryAction,
				departAt: operation.departAt,
				arriveAt: operation.arriveAt,
				nextEventAt: operation.nextEventAt,
				parentOperationId: operation.parentOperationId,
			},
			resultCode: result?.resultCode,
			resultMessage: result?.resultMessage,
		};
	},
});

export const getFleetOperationTimeline = query({
	args: {
		colonyId: v.optional(v.id("colonies")),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		events: v.array(
			v.object({
				id: v.id("fleetEvents"),
				operationId: v.id("fleetOperations"),
				fleetId: v.id("fleets"),
				eventType: v.string(),
				occurredAt: v.number(),
				dataJson: v.string(),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const player = await resolveCurrentPlayer(ctx);
		if (!player?.player) {
			throw new ConvexError("Authentication required");
		}

		if (args.colonyId) {
			await getOwnedColony({
				ctx,
				colonyId: args.colonyId,
			});
		}

		const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)));
		const rows = await ctx.db
			.query("fleetEvents")
			.withIndex("by_owner_time", (q) => q.eq("ownerPlayerId", player.player._id))
			.order("desc")
			.take(limit);

		return {
			events: rows.map((row) => ({
				id: row._id,
				operationId: row.operationId,
				fleetId: row.fleetId,
				eventType: row.eventType,
				occurredAt: row.occurredAt,
				dataJson: row.dataJson,
			})),
		};
	},
});

export const syncFleetState = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		resolvedCount: v.number(),
		syncedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const { player } = await getOwnedColony({
			colonyId: args.colonyId,
			ctx,
		});

		const settled = await settleDueFleetOperations({
			ctx,
			now,
			ownerPlayerId: player._id,
		});
		for (const operationId of settled.affectedOperationIds) {
			await reconcileFleetOperationSchedule({
				ctx,
				operationId,
			});
		}

		return {
			resolvedCount: settled.resolvedCount,
			syncedAt: now,
		};
	},
});

export const createOperation = mutation({
	args: {
		originColonyId: v.id("colonies"),
		kind: fleetOperationKindValidator,
		target: fleetTargetValidator,
		shipCounts: shipCountsValidator,
		cargoRequested: resourceBucketValidator,
		postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
	},
	returns: v.object({
		operationId: v.id("fleetOperations"),
		fleetId: v.id("fleets"),
		departAt: v.number(),
		arriveAt: v.number(),
		distance: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const normalizedShips = normalizeShipCounts(args.shipCounts);
		const cargoRequested = normalizeMissionCargo(args.cargoRequested);

		if (args.kind !== "transport" && args.kind !== "colonize") {
			throw new ConvexError(`${args.kind} operations are not implemented yet`);
		}

		if (missionCargoTotal(cargoRequested) > getFleetCargoCapacity(normalizedShips)) {
			throw new ConvexError("Cargo exceeds fleet cargo capacity");
		}

		const origin = await getOwnedColony({
			colonyId: args.originColonyId,
			ctx,
		});

		const settled = await settleDueFleetOperations({
			ctx,
			now,
			ownerPlayerId: origin.player._id,
		});
		for (const operationId of settled.affectedOperationIds) {
			await reconcileFleetOperationSchedule({
				ctx,
				operationId,
			});
		}

		await settleShipyardQueue({
			colony: origin.colony,
			ctx,
			now,
		});
		await settleDefenseQueue({
			colony: origin.colony,
			ctx,
			now,
		});

		await decrementShipsOrThrow({
			colony: origin.colony,
			ctx,
			now,
			requested: normalizedShips,
		});

		let distance = 1;
		if (args.kind === "transport") {
			if (normalizedShips.colonyShip > 0) {
				throw new ConvexError("Transport operations cannot include colony ships");
			}
			if (args.target.kind !== "colony" || !args.target.colonyId) {
				throw new ConvexError("Transport operations require a target colony");
			}

			const destinationBase = await ctx.db.get(args.target.colonyId);
			if (!destinationBase) {
				throw new ConvexError("Transport destination not found");
			}
			const destination = await loadColonyState({
				colony: destinationBase,
				ctx,
			});
			if (destination.universeId !== origin.colony.universeId) {
				throw new ConvexError("Target colony is in a different universe");
			}
			const targetPolicy = destination.inboundMissionPolicy ?? "allowAll";
			if (targetPolicy === "denyAll") {
				throw new ConvexError("Destination colony does not accept inbound missions");
			}
			if (
				args.postDeliveryAction === "stationAtDestination" &&
				destination.playerId !== origin.player._id
			) {
				throw new ConvexError("Cross-player stationing is not allowed");
			}

			const originCoords = await colonySystemCoords({
				colonyId: origin.colony._id,
				ctx,
			});
			const destinationCoords = await colonySystemCoords({
				colonyId: destination._id,
				ctx,
			});
			distance = euclideanDistance({
				x1: originCoords.x,
				y1: originCoords.y,
				x2: destinationCoords.x,
				y2: destinationCoords.y,
			});
		}

		if (args.kind === "colonize") {
			if (normalizedShips.colonyShip !== 1) {
				throw new ConvexError("Colonization requires exactly one colony ship");
			}
			if (args.target.kind !== "planet" || !args.target.planetId) {
				throw new ConvexError("Colonization operations require a target planet");
			}

			const targetPlanetBase = await ctx.db.get(args.target.planetId);
			if (!targetPlanetBase) {
				throw new ConvexError("Target planet not found");
			}
			const targetPlanet = await loadPlanetState({
				planet: targetPlanetBase,
				ctx,
			});
			if (
				!(await isPlanetCurrentlyColonizable({
					ctx,
					planetId: targetPlanet._id,
				}))
			) {
				throw new ConvexError("Target planet is not colonizable");
			}
			if (targetPlanet.universeId !== origin.colony.universeId) {
				throw new ConvexError("Target planet is in a different universe");
			}

			const occupied = await ctx.db
				.query("colonies")
				.withIndex("by_planet_id", (q) => q.eq("planetId", targetPlanet._id))
				.first();
			if (occupied) {
				throw new ConvexError("Target planet is already colonized");
			}

			const activePlanetOps = await ctx.db
				.query("fleetOperations")
				.withIndex("by_tplanet_st_evt", (q) =>
					q.eq("target.planetId", targetPlanet._id).eq("status", "inTransit"),
				)
				.collect();
			if (activePlanetOps.some((row) => row.kind === "colonize")) {
				throw new ConvexError("Target planet already has an active colonization operation");
			}

			const originCoords = await colonySystemCoords({
				colonyId: origin.colony._id,
				ctx,
			});
			const targetCoords = await planetSystemCoords({
				planetId: targetPlanet._id,
				ctx,
			});
			distance = euclideanDistance({
				x1: originCoords.x,
				y1: originCoords.y,
				x2: targetCoords.x,
				y2: targetCoords.y,
			});
		}

		const durationMs = durationMsForFleet({
			distance,
			shipCounts: normalizedShips,
		});

		const oneWayFuelScaled = scaledUnits(
			getFleetFuelCostForDistance({ distance, shipCounts: normalizedShips }),
		);
		const fuelScaled =
			args.kind === "transport" && args.postDeliveryAction === "returnToOrigin"
				? oneWayFuelScaled * 2
				: oneWayFuelScaled;

		const cargoScaled = resourceMapToScaledBucket(cargoRequested);
		const deduction: ResourceBucket = {
			alloy: cargoScaled.alloy,
			crystal: cargoScaled.crystal,
			fuel: cargoScaled.fuel + fuelScaled,
		};

		const latestOriginBase = await ctx.db.get(origin.colony._id);
		if (!latestOriginBase) {
			throw new ConvexError("Origin colony not found");
		}
		const latestOrigin = await loadColonyState({
			colony: latestOriginBase,
			ctx,
		});

		for (const key of RESOURCE_KEYS) {
			if (latestOrigin.resources[key] < deduction[key]) {
				throw new ConvexError(`Not enough ${key} for this operation`);
			}
		}

		await ctx.db.patch(latestOrigin._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...latestOrigin,
				resources: {
					alloy: latestOrigin.resources.alloy - deduction.alloy,
					crystal: latestOrigin.resources.crystal - deduction.crystal,
					fuel: latestOrigin.resources.fuel - deduction.fuel,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});

		const fleetId = await ctx.db.insert("fleets", {
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			homeColonyId: latestOrigin._id,
			state: "inTransit",
			locationKind: "route",
			locationColonyId: latestOrigin._id,
			locationPlanetId: undefined,
			routeOperationId: undefined,
			shipCounts: normalizedShips,
			cargo: cargoScaled,
			createdAt: now,
			updatedAt: now,
		});

		const operationId = await ctx.db.insert("fleetOperations", {
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			fleetId,
			kind: args.kind,
			status: "inTransit",
			originColonyId: latestOrigin._id,
			target: args.target,
			postDeliveryAction:
				args.kind === "transport" ? (args.postDeliveryAction ?? "returnToOrigin") : undefined,
			parentOperationId: undefined,
			shipCounts: normalizedShips,
			cargoRequested: cargoScaled,
			fuelCharged: fuelScaled,
			distance,
			departAt: now,
			arriveAt: now + durationMs,
			nextEventAt: now + durationMs,
			createdAt: now,
			updatedAt: now,
		});

		await ctx.db.insert("fleetOperationResults", {
			operationId,
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			cargoDeliveredToStorage: emptyResourceBucket(),
			cargoDeliveredToOverflow: emptyResourceBucket(),
			fuelWaived: undefined,
			cancelledAt: undefined,
			resolvedAt: undefined,
			resultCode: undefined,
			resultMessage: undefined,
			createdAt: now,
			updatedAt: now,
		});

		await ctx.db.patch(fleetId, {
			routeOperationId: operationId,
			updatedAt: now,
		});

		await appendFleetEvent({
			ctx,
			data: {
				kind: args.kind,
				target: args.target,
			},
			eventType: "created",
			fleetId,
			now,
			operationId,
			ownerPlayerId: latestOrigin.playerId,
			universeId: latestOrigin.universeId,
		});
		await reconcileFleetOperationSchedule({
			ctx,
			operationId,
		});

		if (args.kind === "transport" && args.target.kind === "colony" && args.target.colonyId) {
			const destinationBase = await ctx.db.get(args.target.colonyId);
			if (!destinationBase) {
				throw new ConvexError("Transport destination not found");
			}
			await emitTransportIncomingNotification({
				arriveAt: now + durationMs,
				cargoRequested: cargoScaled,
				ctx,
				destinationColonyId: destinationBase._id,
				destinationPlayerId: destinationBase.playerId,
				operationId,
				originColonyId: latestOrigin._id,
				occurredAt: now,
				universeId: latestOrigin.universeId,
			});
		}

		return {
			operationId,
			fleetId,
			departAt: now,
			arriveAt: now + durationMs,
			distance,
		};
	},
});

export const cancelOperation = mutation({
	args: {
		operationId: v.id("fleetOperations"),
	},
	returns: v.object({
		operationId: v.id("fleetOperations"),
		returnAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}

		const operation = await ctx.db.get(args.operationId);
		if (!operation || operation.ownerPlayerId !== playerResult.player._id) {
			throw new ConvexError("Operation not found");
		}
		if (operation.status !== "inTransit") {
			throw new ConvexError("Only in-transit operations can be cancelled");
		}
		if (now >= operation.arriveAt) {
			throw new ConvexError("Operation has already reached the target");
		}

		const linkedContract =
			operation.kind === "contract"
				? await ctx.db
						.query("contracts")
						.withIndex("by_operation_id", (q) => q.eq("operationId", operation._id))
						.unique()
				: null;

		const totalDuration = Math.max(1, operation.arriveAt - operation.departAt);
		const elapsed = Math.max(0, Math.min(totalDuration, now - operation.departAt));
		const elapsedRatio = elapsed / totalDuration;
		const returnDistance = Math.max(1, operation.distance * elapsedRatio);
		const returnDurationMs = Math.max(30_000, elapsed);

		let additionalFuelCharged = 0;
		let fuelWaived = 0;
		if (!(operation.kind === "transport" && operation.postDeliveryAction === "returnToOrigin")) {
			const extraFuelScaled = scaledUnits(
				getFleetFuelCostForDistance({
					distance: returnDistance,
					shipCounts: operation.shipCounts,
				}),
			);
			const originBase = await ctx.db.get(operation.originColonyId);
			if (!originBase) {
				throw new ConvexError("Origin colony not found");
			}
			const origin = await loadColonyState({
				colony: originBase,
				ctx,
			});
			const availableFuel = origin.resources.fuel;
			additionalFuelCharged = Math.min(extraFuelScaled, availableFuel);
			fuelWaived = Math.max(0, extraFuelScaled - additionalFuelCharged);

			await ctx.db.patch(origin._id, {
				updatedAt: now,
			});
			await upsertColonyCompanionRows({
				colony: {
					...origin,
					resources: {
						...origin.resources,
						fuel: origin.resources.fuel - additionalFuelCharged,
					},
					updatedAt: now,
				},
				ctx,
				now,
			});
		}

		await ctx.db.patch(operation.fleetId, {
			state: "returning",
			locationKind: "route",
			routeOperationId: operation._id,
			updatedAt: now,
		});

		await ctx.db.patch(operation._id, {
			status: "returning",
			departAt: now,
			arriveAt: now + returnDurationMs,
			nextEventAt: now + returnDurationMs,
			fuelCharged: operation.fuelCharged + additionalFuelCharged,
			updatedAt: now,
		});
		await upsertOperationResult({
			ctx,
			operation,
			now,
			patch: {
				cancelledAt: now,
				fuelWaived: fuelWaived > 0 ? fuelWaived : undefined,
			},
		});

		await appendFleetEvent({
			ctx,
			data: {
				returnAt: now + returnDurationMs,
			},
			eventType: "cancelled",
			fleetId: operation.fleetId,
			now,
			operationId: operation._id,
			ownerPlayerId: operation.ownerPlayerId,
			universeId: operation.universeId,
		});
		if (linkedContract && linkedContract.status === "inProgress") {
			await ctx.db.patch(linkedContract._id, {
				status: "failed",
				resolvedAt: now,
				updatedAt: now,
			});
			await advanceContractBoardSlot({
				ctx,
				colonyId: linkedContract.originColonyId ?? operation.originColonyId,
				now,
				planetId: linkedContract.planetId,
				playerId: linkedContract.playerId,
				slot: linkedContract.slot,
			});
		}
		await reconcileFleetOperationSchedule({
			ctx,
			operationId: operation._id,
		});

		return {
			operationId: operation._id,
			returnAt: now + returnDurationMs,
		};
	},
});

export const processDueOperationsCron = internalMutation({
	args: {},
	returns: v.object({
		processedPlayers: v.number(),
		resolvedCount: v.number(),
		runAt: v.number(),
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const activePlayers = await ctx.db
			.query("fleetOperations")
			.withIndex("by_stat_evt", (q) => q.eq("status", "inTransit").lte("nextEventAt", now))
			.collect();

		const returningPlayers = await ctx.db
			.query("fleetOperations")
			.withIndex("by_stat_evt", (q) => q.eq("status", "returning").lte("nextEventAt", now))
			.collect();

		const ownerIds = new Set<Id<"players">>();
		for (const row of activePlayers) {
			ownerIds.add(row.ownerPlayerId);
		}
		for (const row of returningPlayers) {
			ownerIds.add(row.ownerPlayerId);
		}

		let resolvedCount = 0;
		for (const ownerPlayerId of ownerIds) {
			const settled = await settleDueFleetOperations({
				ctx,
				now,
				ownerPlayerId,
			});
			resolvedCount += settled.resolvedCount;
			for (const operationId of settled.affectedOperationIds) {
				await reconcileFleetOperationSchedule({
					ctx,
					operationId,
				});
			}
		}

		return {
			processedPlayers: ownerIds.size,
			resolvedCount,
			runAt: now,
		};
	},
});
