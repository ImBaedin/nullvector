import type { DefenseKey } from "./defenses";
import type { BuildingKey, FacilityKey, ShipKey } from "./gameplay";
import type { ColonyQueueEntry, ColonyQueuePayload } from "./queue";

import {
	type ColonySnapshot,
	createQueueEntryId,
	getBuildingUpgradeCost,
	getBuildingUpgradeDurationSeconds,
	getDefenseBuildBatchCost,
	getDefenseBuildInfo,
	getFacilityUpgradeCost,
	getFacilityUpgradeDurationSeconds,
	getShipBuildBatchCost,
	getShipBuildInfo,
	projectColonyEconomy,
} from "./colony-state";

function isBuildingUpgradePayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { buildingKey: BuildingKey }> {
	return "buildingKey" in payload;
}

function isFacilityUpgradePayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { facilityKey: FacilityKey }> {
	return "facilityKey" in payload;
}

export type ColonyIntent =
	| {
			name: string;
			type: "renameColony";
	  }
	| {
			buildingKey: BuildingKey;
			type: "enqueueBuildingUpgrade";
	  }
	| {
			facilityKey: FacilityKey;
			type: "enqueueFacilityUpgrade";
	  }
	| {
			quantity: number;
			shipKey: ShipKey;
			type: "enqueueShipBuild";
	  }
	| {
			queueItemId: string;
			type: "cancelShipBuild";
	  }
	| {
			defenseKey: DefenseKey;
			quantity: number;
			type: "enqueueDefenseBuild";
	  }
	| {
			queueItemId: string;
			type: "cancelDefenseBuild";
	  };

function subtractCost(snapshot: ColonySnapshot, cost: ColonyQueueEntry["cost"]): ColonySnapshot {
	return {
		...snapshot,
		resources: {
			alloy: Math.max(0, snapshot.resources.alloy - cost.alloy),
			crystal: Math.max(0, snapshot.resources.crystal - cost.crystal),
			fuel: Math.max(0, snapshot.resources.fuel - cost.fuel),
		},
	};
}

function addCost(snapshot: ColonySnapshot, cost: ColonyQueueEntry["cost"]): ColonySnapshot {
	const resources = {
		alloy: snapshot.resources.alloy,
		crystal: snapshot.resources.crystal,
		fuel: snapshot.resources.fuel,
	};
	const overflow = {
		alloy: snapshot.overflow.alloy,
		crystal: snapshot.overflow.crystal,
		fuel: snapshot.overflow.fuel,
	};
	for (const key of ["alloy", "crystal", "fuel"] as const) {
		const nextStored = Math.min(snapshot.storageCaps[key], resources[key] + cost[key]);
		const remainder = Math.max(0, resources[key] + cost[key] - nextStored);
		resources[key] = nextStored;
		overflow[key] += remainder;
	}
	return {
		...snapshot,
		overflow,
		resources,
	};
}

function refundRemainingCost(target: ColonyQueueEntry): ColonyQueueEntry["cost"] {
	if (target.kind !== "shipBuild" && target.kind !== "defenseBuild") {
		return target.cost;
	}
	if (!("quantity" in target.payload) || !("completedQuantity" in target.payload)) {
		return target.cost;
	}
	const remainingQuantity = Math.max(0, target.payload.quantity - target.payload.completedQuantity);
	if (remainingQuantity <= 0 || target.payload.quantity <= 0) {
		return { alloy: 0, crystal: 0, fuel: 0 };
	}
	return {
		alloy: Math.floor((target.cost.alloy * remainingQuantity) / target.payload.quantity),
		crystal: Math.floor((target.cost.crystal * remainingQuantity) / target.payload.quantity),
		fuel: Math.floor((target.cost.fuel * remainingQuantity) / target.payload.quantity),
	};
}

function rescheduleLaneQueue(
	snapshot: ColonySnapshot,
	lane: "defense" | "shipyard",
	nowMs: number,
): ColonySnapshot {
	const laneEntries = snapshot.openQueues
		.filter(
			(entry) => entry.lane === lane && (entry.status === "active" || entry.status === "queued"),
		)
		.sort((left, right) => left.order - right.order);
	let cursor = nowMs;
	const nextEntries = snapshot.openQueues.map((entry) => ({ ...entry }));

	for (let index = 0; index < laneEntries.length; index += 1) {
		const source = laneEntries[index];
		if (!source) {
			continue;
		}
		const target = nextEntries.find((entry) => entry.id === source.id);
		if (!target) {
			continue;
		}
		const payload = target.payload;
		if (
			(target.kind !== "shipBuild" && target.kind !== "defenseBuild") ||
			!("quantity" in payload) ||
			!("completedQuantity" in payload) ||
			!("perUnitDurationSeconds" in payload)
		) {
			continue;
		}
		const remainingQuantity = Math.max(0, payload.quantity - payload.completedQuantity);
		const startsAt = index === 0 ? nowMs : cursor;
		const completesAt = startsAt + remainingQuantity * payload.perUnitDurationSeconds * 1_000;
		target.startsAt = startsAt;
		target.completesAt = completesAt;
		target.status = index === 0 ? "active" : "queued";
		cursor = completesAt;
	}

	return {
		...snapshot,
		openQueues: nextEntries,
		schedule: {
			nextEventAt:
				nextEntries.length > 0
					? nextEntries
							.filter((entry) => entry.status === "active" || entry.status === "queued")
							.reduce<number | undefined>(
								(nextAt, entry) =>
									nextAt === undefined ? entry.completesAt : Math.min(nextAt, entry.completesAt),
								undefined,
							)
					: undefined,
		},
	};
}

function laneTail(snapshot: ColonySnapshot, lane: ColonyQueueEntry["lane"]) {
	const laneItems = snapshot.openQueues
		.filter(
			(entry) => entry.lane === lane && (entry.status === "active" || entry.status === "queued"),
		)
		.sort((left, right) => left.order - right.order);
	return laneItems[laneItems.length - 1];
}

function withQueueEntry(snapshot: ColonySnapshot, entry: ColonyQueueEntry) {
	return {
		...snapshot,
		openQueues: [...snapshot.openQueues, entry],
		schedule: {
			nextEventAt:
				snapshot.schedule.nextEventAt === undefined
					? entry.completesAt
					: Math.min(snapshot.schedule.nextEventAt, entry.completesAt),
		},
	};
}

export function applyColonyIntent(
	snapshot: ColonySnapshot,
	intent: ColonyIntent,
	nowMs = snapshot.serverNowMs,
): ColonySnapshot {
	if (intent.type === "renameColony") {
		return {
			...snapshot,
			name: intent.name,
		};
	}

	if (intent.type === "enqueueBuildingUpgrade") {
		const economy = projectColonyEconomy(snapshot, nowMs);
		const buildingLane = economy.queues.lanes.building;
		const projectedLevel = [
			...(buildingLane.activeItem ? [buildingLane.activeItem] : []),
			...buildingLane.pendingItems,
		].reduce((level, row) => {
			if (
				row.kind !== "buildingUpgrade" ||
				!isBuildingUpgradePayload(row.payload) ||
				row.payload.buildingKey !== intent.buildingKey
			) {
				return level;
			}
			return Math.max(level, row.payload.toLevel);
		}, snapshot.buildings[intent.buildingKey]);
		const tail = laneTail(snapshot, "building");
		const startsAt = tail ? tail.completesAt : nowMs;
		const durationSeconds = getBuildingUpgradeDurationSeconds(intent.buildingKey, projectedLevel);
		const entry: ColonyQueueEntry = {
			completesAt: startsAt + durationSeconds * 1_000,
			cost: getBuildingUpgradeCost(intent.buildingKey, projectedLevel),
			id: createQueueEntryId("optimistic-building", [
				snapshot.colonyId,
				intent.buildingKey,
				startsAt,
			]),
			kind: "buildingUpgrade",
			lane: "building",
			order: (tail?.order ?? 0) + 1,
			payload: {
				buildingKey: intent.buildingKey,
				fromLevel: projectedLevel,
				toLevel: projectedLevel + 1,
			},
			queuedAt: nowMs,
			startsAt,
			status: tail ? "queued" : "active",
		};
		return withQueueEntry(subtractCost(snapshot, entry.cost), entry);
	}

	if (intent.type === "enqueueFacilityUpgrade") {
		const economy = projectColonyEconomy(snapshot, nowMs);
		const buildingLane = economy.queues.lanes.building;
		const facilityLevels = {
			defense_grid: snapshot.buildings.defenseGridLevel,
			robotics_hub: snapshot.buildings.roboticsHubLevel,
			shipyard: snapshot.buildings.shipyardLevel,
		};
		const projectedLevel = [
			...(buildingLane.activeItem ? [buildingLane.activeItem] : []),
			...buildingLane.pendingItems,
		].reduce((level, row) => {
			if (
				row.kind !== "facilityUpgrade" ||
				!isFacilityUpgradePayload(row.payload) ||
				row.payload.facilityKey !== intent.facilityKey
			) {
				return level;
			}
			return Math.max(level, row.payload.toLevel);
		}, facilityLevels[intent.facilityKey]);
		const tail = laneTail(snapshot, "building");
		const startsAt = tail ? tail.completesAt : nowMs;
		const durationSeconds = getFacilityUpgradeDurationSeconds(intent.facilityKey, projectedLevel);
		const entry: ColonyQueueEntry = {
			completesAt: startsAt + durationSeconds * 1_000,
			cost: getFacilityUpgradeCost(intent.facilityKey, projectedLevel),
			id: createQueueEntryId("optimistic-facility", [
				snapshot.colonyId,
				intent.facilityKey,
				startsAt,
			]),
			kind: "facilityUpgrade",
			lane: "building",
			order: (tail?.order ?? 0) + 1,
			payload: {
				facilityKey: intent.facilityKey,
				fromLevel: projectedLevel,
				toLevel: projectedLevel + 1,
			},
			queuedAt: nowMs,
			startsAt,
			status: tail ? "queued" : "active",
		};
		return withQueueEntry(subtractCost(snapshot, entry.cost), entry);
	}

	if (intent.type === "enqueueShipBuild") {
		const tail = laneTail(snapshot, "shipyard");
		const info = getShipBuildInfo(snapshot.buildings, intent.shipKey);
		const startsAt = tail ? tail.completesAt : nowMs;
		const entry: ColonyQueueEntry = {
			completesAt: startsAt + info.perUnitDurationSeconds * intent.quantity * 1_000,
			cost: getShipBuildBatchCost(intent.shipKey, intent.quantity),
			id: createQueueEntryId("optimistic-ship", [snapshot.colonyId, intent.shipKey, startsAt]),
			kind: "shipBuild",
			lane: "shipyard",
			order: (tail?.order ?? 0) + 1,
			payload: {
				completedQuantity: 0,
				perUnitDurationSeconds: info.perUnitDurationSeconds,
				quantity: intent.quantity,
				shipKey: intent.shipKey,
			},
			queuedAt: nowMs,
			startsAt,
			status: tail ? "queued" : "active",
		};
		return withQueueEntry(subtractCost(snapshot, entry.cost), entry);
	}

	if (intent.type === "enqueueDefenseBuild") {
		const tail = laneTail(snapshot, "defense");
		const info = getDefenseBuildInfo(snapshot.buildings, intent.defenseKey);
		const startsAt = tail ? tail.completesAt : nowMs;
		const entry: ColonyQueueEntry = {
			completesAt: startsAt + info.perUnitDurationSeconds * intent.quantity * 1_000,
			cost: getDefenseBuildBatchCost(intent.defenseKey, intent.quantity),
			id: createQueueEntryId("optimistic-defense", [
				snapshot.colonyId,
				intent.defenseKey,
				startsAt,
			]),
			kind: "defenseBuild",
			lane: "defense",
			order: (tail?.order ?? 0) + 1,
			payload: {
				completedQuantity: 0,
				defenseKey: intent.defenseKey,
				perUnitDurationSeconds: info.perUnitDurationSeconds,
				quantity: intent.quantity,
			},
			queuedAt: nowMs,
			startsAt,
			status: tail ? "queued" : "active",
		};
		return withQueueEntry(subtractCost(snapshot, entry.cost), entry);
	}

	if (intent.type === "cancelShipBuild" || intent.type === "cancelDefenseBuild") {
		const target = snapshot.openQueues.find((entry) => entry.id === intent.queueItemId);
		if (!target || (target.kind !== "shipBuild" && target.kind !== "defenseBuild")) {
			return snapshot;
		}
		const lane = target.kind === "shipBuild" ? "shipyard" : "defense";
		return rescheduleLaneQueue(
			addCost(
				{
					...snapshot,
					openQueues: snapshot.openQueues.filter((entry) => entry.id !== intent.queueItemId),
				},
				refundRemainingCost(target),
			),
			lane,
			nowMs,
		);
	}

	return snapshot;
}

export function applyColonyIntents(
	snapshot: ColonySnapshot,
	intents: ColonyIntent[],
	nowMs = snapshot.serverNowMs,
) {
	return intents.reduce((current, intent) => applyColonyIntent(current, intent, nowMs), snapshot);
}
