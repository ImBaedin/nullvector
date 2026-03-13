import { expect, test } from "bun:test";

import {
	applyColonyIntent,
	buildEmptySnapshot,
	computeStorageCaps,
	getBuildingUpgradeCost,
	getBuildingUpgradeDurationSeconds,
	getDefenseBuildInfo,
	getShipBuildBatchCost,
	getShipBuildInfo,
	projectColonyEconomy,
	reconcileOverflowIntoStorage,
	selectBuildingCards,
	selectDefenseView,
	selectFacilityCards,
	selectHudResources,
	selectQueueLanes,
	selectShipyardView,
	settleBuildingAndFacilityQueue,
	settleDefenseQueue,
	settleShipyardQueue,
	type ColonyQueueEntry,
} from "../index";

function makeQueueEntry(
	entry: Omit<ColonyQueueEntry, "cost" | "id" | "order" | "queuedAt"> &
		Partial<Pick<ColonyQueueEntry, "cost" | "id" | "order" | "queuedAt">>,
): ColonyQueueEntry {
	return {
		cost: { alloy: 0, crystal: 0, fuel: 0 },
		id: "queue-item",
		order: 1,
		queuedAt: entry.startsAt,
		...entry,
	};
}

test("reconcileOverflowIntoStorage drains overflow into available headroom", () => {
	const reconciled = reconcileOverflowIntoStorage({
		lastAccruedAt: 0,
		overflow: { alloy: 25, crystal: 10, fuel: 6 },
		resources: { alloy: 90, crystal: 100, fuel: 48 },
		storageCaps: { alloy: 100, crystal: 100, fuel: 50 },
	});

	expect(reconciled.resources).toEqual({ alloy: 100, crystal: 100, fuel: 50 });
	expect(reconciled.overflow).toEqual({ alloy: 15, crystal: 10, fuel: 4 });
});

test("building settlement segments accrual across completion boundaries and updates storage caps", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.serverNowMs = 0;
	snapshot.lastAccruedAt = 0;
	snapshot.buildings.alloyMineLevel = 1;
	snapshot.buildings.powerPlantLevel = 1;
	snapshot.buildings.alloyStorageLevel = 1;
	snapshot.resources = { alloy: 1_000, crystal: 0, fuel: 0 };
	snapshot.storageCaps = computeStorageCaps(snapshot.buildings);

	const durationSeconds = getBuildingUpgradeDurationSeconds("alloyMineLevel", 1);
	const cost = getBuildingUpgradeCost("alloyMineLevel", 1);
	snapshot.openQueues = [
		makeQueueEntry({
			completesAt: durationSeconds * 1_000,
			cost,
			kind: "buildingUpgrade",
			lane: "building",
			payload: {
				buildingKey: "alloyMineLevel",
				fromLevel: 1,
				toLevel: 2,
			},
			startsAt: 0,
			status: "active",
		}),
	];

	const beforeCompletion = settleBuildingAndFacilityQueue(
		snapshot,
		durationSeconds * 1_000 - 1_000,
	);
	const afterCompletion = settleBuildingAndFacilityQueue(
		snapshot,
		durationSeconds * 1_000 + 60_000,
	);

	expect(beforeCompletion.buildings.alloyMineLevel).toBe(1);
	expect(afterCompletion.buildings.alloyMineLevel).toBe(2);
	expect(afterCompletion.storageCaps.alloy).toBe(
		computeStorageCaps(afterCompletion.buildings).alloy,
	);
	expect(afterCompletion.resources.alloy).toBeGreaterThan(beforeCompletion.resources.alloy);
	expect(afterCompletion.openQueues[0]?.status).toBe("completed");
});

test("shipyard settlement materializes partial completion", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.buildings.shipyardLevel = 2;
	const shipInfo = getShipBuildInfo(snapshot.buildings, "smallCargo");
	snapshot.openQueues = [
		makeQueueEntry({
			completesAt: shipInfo.perUnitDurationSeconds * 3 * 1_000,
			cost: getShipBuildBatchCost("smallCargo", 3),
			kind: "shipBuild",
			lane: "shipyard",
			payload: {
				completedQuantity: 0,
				perUnitDurationSeconds: shipInfo.perUnitDurationSeconds,
				quantity: 3,
				shipKey: "smallCargo",
			},
			startsAt: 0,
			status: "active",
		}),
	];

	const settled = settleShipyardQueue(snapshot, shipInfo.perUnitDurationSeconds * 1_000 + 1);
	const shipQueueItem = settled.openQueues[0];

	expect(settled.ships.smallCargo).toBe(1);
	expect(shipQueueItem?.status).toBe("active");
	if (shipQueueItem?.kind !== "shipBuild" || !("completedQuantity" in shipQueueItem.payload)) {
		throw new Error("Expected ship build queue item");
	}
	expect(shipQueueItem.payload.completedQuantity).toBe(1);
});

test("defense settlement materializes partial completion", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.buildings.defenseGridLevel = 2;
	const defenseInfo = getDefenseBuildInfo(snapshot.buildings, "missileBattery");
	snapshot.openQueues = [
		makeQueueEntry({
			completesAt: defenseInfo.perUnitDurationSeconds * 2 * 1_000,
			kind: "defenseBuild",
			lane: "defense",
			payload: {
				completedQuantity: 0,
				defenseKey: "missileBattery",
				perUnitDurationSeconds: defenseInfo.perUnitDurationSeconds,
				quantity: 2,
			},
			startsAt: 0,
			status: "active",
		}),
	];

	const settled = settleDefenseQueue(snapshot, defenseInfo.perUnitDurationSeconds * 1_000 + 1);
	const defenseQueueItem = settled.openQueues[0];

	expect(settled.defenses.missileBattery).toBe(1);
	expect(defenseQueueItem?.status).toBe("active");
	if (
		defenseQueueItem?.kind !== "defenseBuild" ||
		!("completedQuantity" in defenseQueueItem.payload)
	) {
		throw new Error("Expected defense build queue item");
	}
	expect(defenseQueueItem.payload.completedQuantity).toBe(1);
});

test("selectors derive coherent views from one canonical snapshot", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.colonyId = "colony-1";
	snapshot.name = "Nova Prime";
	snapshot.addressLabel = "1:2:3";
	snapshot.buildings.alloyMineLevel = 2;
	snapshot.buildings.powerPlantLevel = 2;
	snapshot.buildings.shipyardLevel = 2;
	snapshot.buildings.defenseGridLevel = 2;
	snapshot.resources = { alloy: 800, crystal: 400, fuel: 200 };
	snapshot.storageCaps = computeStorageCaps(snapshot.buildings);
	const shipInfo = getShipBuildInfo(snapshot.buildings, "smallCargo");
	const defenseInfo = getDefenseBuildInfo(snapshot.buildings, "missileBattery");
	snapshot.openQueues = [
		makeQueueEntry({
			completesAt: 120_000,
			kind: "buildingUpgrade",
			lane: "building",
			payload: {
				buildingKey: "alloyMineLevel",
				fromLevel: 2,
				toLevel: 3,
			},
			startsAt: 0,
			status: "active",
		}),
		makeQueueEntry({
			completesAt: shipInfo.perUnitDurationSeconds * 2 * 1_000,
			cost: getShipBuildBatchCost("smallCargo", 2),
			id: "ship-queue",
			kind: "shipBuild",
			lane: "shipyard",
			order: 1,
			payload: {
				completedQuantity: 0,
				perUnitDurationSeconds: shipInfo.perUnitDurationSeconds,
				quantity: 2,
				shipKey: "smallCargo",
			},
			startsAt: 0,
			status: "active",
		}),
		makeQueueEntry({
			completesAt: defenseInfo.perUnitDurationSeconds * 2 * 1_000,
			id: "defense-queue",
			kind: "defenseBuild",
			lane: "defense",
			order: 1,
			payload: {
				completedQuantity: 0,
				defenseKey: "missileBattery",
				perUnitDurationSeconds: defenseInfo.perUnitDurationSeconds,
				quantity: 2,
			},
			startsAt: 0,
			status: "active",
		}),
	];

	const hud = selectHudResources(snapshot, 0);
	const buildingCards = selectBuildingCards(snapshot, 0);
	const facilities = selectFacilityCards(snapshot, 0);
	const shipyard = selectShipyardView(snapshot, 0);
	const defenses = selectDefenseView(snapshot, 0);
	const queueLanes = selectQueueLanes(snapshot, 0);

	expect(hud).toHaveLength(4);
	expect(buildingCards.find((card) => card.key === "alloyMineLevel")?.isUpgrading).toBe(true);
	expect(facilities.find((card) => card.key === "shipyard")?.isUnlocked).toBe(true);
	expect(shipyard.shipStates.find((ship) => ship.key === "smallCargo")?.queued).toBe(2);
	expect(defenses.defenseStates.find((defense) => defense.key === "missileBattery")?.queued).toBe(
		2,
	);
	expect(queueLanes.lanes.building.activeItem?.kind).toBe("buildingUpgrade");
});

test("optimistic enqueue and cancel intents update snapshot state deterministically", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.colonyId = "colony-1";
	snapshot.serverNowMs = 10_000;
	snapshot.buildings.shipyardLevel = 2;
	snapshot.resources = { alloy: 10_000, crystal: 10_000, fuel: 10_000 };
	snapshot.storageCaps = { alloy: 20_000, crystal: 20_000, fuel: 20_000 };

	const queued = applyColonyIntent(snapshot, {
		quantity: 3,
		shipKey: "smallCargo",
		type: "enqueueShipBuild",
	});
	const queuedItem = queued.openQueues[0];
	if (!queuedItem || queuedItem.kind !== "shipBuild") {
		throw new Error("Expected optimistic ship queue item");
	}

	expect(queued.resources.alloy).toBeLessThan(snapshot.resources.alloy);
	expect(queued.schedule.nextEventAt).toBe(queuedItem.completesAt);

	const partiallyBuilt = {
		...queued,
		openQueues: queued.openQueues.map((entry) =>
			entry.id === queuedItem.id && entry.kind === "shipBuild"
				? {
						...entry,
						payload: {
							...entry.payload,
							completedQuantity: 1,
						},
					}
				: entry,
		),
	};
	const cancelled = applyColonyIntent(
		partiallyBuilt,
		{
			queueItemId: queuedItem.id,
			type: "cancelShipBuild",
		},
		snapshot.serverNowMs + 5_000,
	);

	expect(cancelled.openQueues).toHaveLength(0);
	expect(cancelled.resources.alloy).toBeGreaterThan(queued.resources.alloy);
	expect(cancelled.resources.alloy).toBeLessThan(snapshot.resources.alloy);
	expect(cancelled.schedule.nextEventAt).toBeUndefined();
});

test("projectColonyEconomy settles queues and exposes updated rates", () => {
	const snapshot = buildEmptySnapshot();
	snapshot.buildings.alloyMineLevel = 5;
	snapshot.buildings.powerPlantLevel = 5;
	snapshot.resources = { alloy: 0, crystal: 0, fuel: 0 };
	snapshot.storageCaps = computeStorageCaps(snapshot.buildings);

	const projected = projectColonyEconomy(snapshot, 600_000);

	expect(projected.ratesPerMinute.alloy).toBeGreaterThan(0);
	expect(projected.energyProduced).toBeGreaterThan(0);
});
