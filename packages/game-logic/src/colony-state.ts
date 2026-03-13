import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";

import {
	DEFAULT_DEFENSE_DEFINITIONS,
	getDefenseBuildDurationSeconds,
	normalizeDefenseCounts,
	type DefenseCounts,
	type DefenseKey,
} from "./defenses";
import { DEFAULT_FACILITY_REGISTRY, isFacilityUnlocked } from "./facilities";
import { DEFAULT_GENERATOR_REGISTRY } from "./generators";
import { getGeneratorConsumptionPerMinute, getGeneratorProductionPerMinute } from "./generators";
import {
	type ColonyQueueEntry,
	type ColonyQueueLanesView,
	type ColonyQueuePayload,
	projectQueueLanes,
	queueEventsNextAt,
} from "./queue";
import {
	DEFAULT_SHIP_DEFINITIONS,
	getFleetCargoCapacity,
	getShipBuildDurationSeconds,
	type ShipCounts,
	normalizeShipCounts,
} from "./ships";
import { getUpgradeCost, getUpgradeDurationSeconds } from "./structures";

export type ColonyBuildings = {
	alloyMineLevel: number;
	alloyStorageLevel: number;
	crystalMineLevel: number;
	crystalStorageLevel: number;
	defenseGridLevel: number;
	fuelRefineryLevel: number;
	fuelStorageLevel: number;
	powerPlantLevel: number;
	roboticsHubLevel: number;
	shipyardLevel: number;
};

export type ColonyEconomyState = {
	lastAccruedAt: number;
	overflow: ResourceBucket;
	resources: ResourceBucket;
	storageCaps: ResourceBucket;
};

export type ColonyMilitaryState = {
	defenses: DefenseCounts;
	ships: ShipCounts;
};

export type ColonyProjectionNow = {
	nowMs: number;
	serverNowMs: number;
};

export type ColonySnapshot = ColonyEconomyState &
	ColonyMilitaryState & {
		addressLabel: string;
		buildings: ColonyBuildings;
		colonyId: string;
		name: string;
		openQueues: ColonyQueueEntry[];
		planetMultipliers: {
			alloy: number;
			crystal: number;
			fuel: number;
		};
		policies?: {
			inboundMissionPolicy?: "alliesOnly" | "allowAll" | "denyAll";
		};
		schedule: {
			nextEventAt?: number;
		};
		serverNowMs: number;
	};

export type ColonyProjectedEconomy = ColonyEconomyState & {
	energyConsumed: number;
	energyProduced: number;
	energyRatio: number;
	queues: ColonyQueueLanesView;
	ratesPerMinute: ResourceBucket;
};

type PlanetMultiplierKey = "alloy" | "crystal" | "fuel";

type BuildingConfig =
	| {
			generatorId: string;
			group: "Power" | "Production";
			kind: "generator";
			name: string;
			resource: "alloy" | "crystal" | "energy" | "fuel";
			planetMultiplierKey?: PlanetMultiplierKey;
	  }
	| {
			group: "Storage";
			kind: "storage";
			maxLevel: number;
			name: string;
			resource: keyof ResourceBucket;
	  };

export const STORAGE_BUILDING_MAX_LEVEL = 25;
export const BUILDING_LANE_BASE_CAPACITY = 2;

export const BUILDING_CONFIG: Record<BuildingKey, BuildingConfig> = {
	alloyMineLevel: {
		generatorId: "alloy_mine",
		group: "Production",
		kind: "generator",
		name: "Alloy Mine",
		resource: "alloy",
		planetMultiplierKey: "alloy",
	},
	alloyStorageLevel: {
		group: "Storage",
		kind: "storage",
		maxLevel: STORAGE_BUILDING_MAX_LEVEL,
		name: "Alloy Depot",
		resource: "alloy",
	},
	crystalMineLevel: {
		generatorId: "crystal_mine",
		group: "Production",
		kind: "generator",
		name: "Crystal Mine",
		resource: "crystal",
		planetMultiplierKey: "crystal",
	},
	crystalStorageLevel: {
		group: "Storage",
		kind: "storage",
		maxLevel: STORAGE_BUILDING_MAX_LEVEL,
		name: "Crystal Vault",
		resource: "crystal",
	},
	fuelRefineryLevel: {
		generatorId: "deuterium_extractor",
		group: "Production",
		kind: "generator",
		name: "Fuel Refinery",
		resource: "fuel",
		planetMultiplierKey: "fuel",
	},
	fuelStorageLevel: {
		group: "Storage",
		kind: "storage",
		maxLevel: STORAGE_BUILDING_MAX_LEVEL,
		name: "Fuel Silo",
		resource: "fuel",
	},
	powerPlantLevel: {
		generatorId: "solar_plant",
		group: "Power",
		kind: "generator",
		name: "Power Plant",
		resource: "energy",
	},
};

const ALL_BUILDING_KEYS: Array<keyof ColonyBuildings> = [
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
];

const RESOURCE_KEYS: Array<keyof ResourceBucket> = ["alloy", "crystal", "fuel"];
const EMPTY_RESEARCH_LEVELS: Record<string, number> = {};

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

function isShipBuildPayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { shipKey: ShipKey }> {
	return "shipKey" in payload;
}

function isDefenseBuildPayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { defenseKey: DefenseKey }> {
	return "defenseKey" in payload;
}

function cloneResourceBucket(bucket: ResourceBucket): ResourceBucket {
	return { alloy: bucket.alloy, crystal: bucket.crystal, fuel: bucket.fuel };
}

function storageCapForLevel(level: number) {
	if (level <= 0) {
		return 0;
	}
	return Math.round(10_000 * Math.pow(1.7, level - 1));
}

export function computeStorageCaps(buildings: ColonyBuildings): ResourceBucket {
	return {
		alloy: storageCapForLevel(buildings.alloyStorageLevel),
		crystal: storageCapForLevel(buildings.crystalStorageLevel),
		fuel: storageCapForLevel(buildings.fuelStorageLevel),
	};
}

export function computeUsedSlots(buildings: ColonyBuildings) {
	let used = 0;
	for (const key of ALL_BUILDING_KEYS) {
		if (buildings[key] > 0) {
			used += 1;
		}
	}
	return used;
}

export function computeFacilityLevels(buildings: ColonyBuildings) {
	return {
		defense_grid: buildings.defenseGridLevel,
		robotics_hub: buildings.roboticsHubLevel,
		shipyard: buildings.shipyardLevel,
	} satisfies Partial<Record<string, number>>;
}

export function getBuildingLaneCapacity(buildings: ColonyBuildings) {
	return BUILDING_LANE_BASE_CAPACITY + Math.floor(Math.max(0, buildings.roboticsHubLevel) / 2);
}

export function setFacilityLevel(
	buildings: ColonyBuildings,
	facilityKey: FacilityKey,
	level: number,
) {
	if (facilityKey === "robotics_hub") {
		buildings.roboticsHubLevel = Math.max(buildings.roboticsHubLevel, level);
		return;
	}
	if (facilityKey === "shipyard") {
		buildings.shipyardLevel = Math.max(buildings.shipyardLevel, level);
		return;
	}
	buildings.defenseGridLevel = Math.max(buildings.defenseGridLevel, level);
}

export function productionRatesPerMinute(args: {
	buildings: ColonyBuildings;
	overflow: ResourceBucket;
	planetMultipliers: ColonySnapshot["planetMultipliers"];
}) {
	const alloyGenerator = DEFAULT_GENERATOR_REGISTRY.get("alloy_mine");
	const crystalGenerator = DEFAULT_GENERATOR_REGISTRY.get("crystal_mine");
	const fuelGenerator = DEFAULT_GENERATOR_REGISTRY.get("deuterium_extractor");
	const powerGenerator = DEFAULT_GENERATOR_REGISTRY.get("solar_plant");

	if (!alloyGenerator || !crystalGenerator || !fuelGenerator || !powerGenerator) {
		throw new Error("Missing generator registry entries for colony projection");
	}

	const rawAlloyRate =
		getGeneratorProductionPerMinute(alloyGenerator, args.buildings.alloyMineLevel) *
		args.planetMultipliers.alloy;
	const rawCrystalRate =
		getGeneratorProductionPerMinute(crystalGenerator, args.buildings.crystalMineLevel) *
		args.planetMultipliers.crystal;
	const rawFuelRate =
		getGeneratorProductionPerMinute(fuelGenerator, args.buildings.fuelRefineryLevel) *
		args.planetMultipliers.fuel;

	const energyProduced = getGeneratorProductionPerMinute(
		powerGenerator,
		args.buildings.powerPlantLevel,
	);
	const energyConsumed =
		getGeneratorConsumptionPerMinute(alloyGenerator, args.buildings.alloyMineLevel) +
		getGeneratorConsumptionPerMinute(crystalGenerator, args.buildings.crystalMineLevel) +
		getGeneratorConsumptionPerMinute(fuelGenerator, args.buildings.fuelRefineryLevel);
	const energyRatio =
		energyConsumed <= 0 ? 1 : Math.max(0, Math.min(1, energyProduced / energyConsumed));

	return {
		energyConsumed,
		energyProduced,
		energyRatio,
		resources: {
			alloy: args.overflow.alloy > 0 ? 0 : rawAlloyRate * energyRatio,
			crystal: args.overflow.crystal > 0 ? 0 : rawCrystalRate * energyRatio,
			fuel: args.overflow.fuel > 0 ? 0 : rawFuelRate * energyRatio,
		},
	};
}

export function reconcileOverflowIntoStorage<T extends ColonyEconomyState>(state: T): T {
	const resources = cloneResourceBucket(state.resources);
	const overflow = cloneResourceBucket(state.overflow);
	for (const key of RESOURCE_KEYS) {
		if (overflow[key] <= 0) {
			continue;
		}
		const headroom = Math.max(0, state.storageCaps[key] - resources[key]);
		if (headroom <= 0) {
			continue;
		}
		const transfer = Math.min(headroom, overflow[key]);
		resources[key] += transfer;
		overflow[key] -= transfer;
	}
	return {
		...state,
		overflow,
		resources,
	} satisfies T;
}

export function applyAccrualSegment<
	T extends ColonyEconomyState & {
		buildings: ColonyBuildings;
		planetMultipliers: ColonySnapshot["planetMultipliers"];
	},
>(state: T, segmentEndMs: number) {
	if (segmentEndMs <= state.lastAccruedAt) {
		return state;
	}
	const minutesElapsed = (segmentEndMs - state.lastAccruedAt) / 60_000;
	const rates = productionRatesPerMinute({
		buildings: state.buildings,
		overflow: state.overflow,
		planetMultipliers: state.planetMultipliers,
	});
	const resources = cloneResourceBucket(state.resources);
	for (const key of RESOURCE_KEYS) {
		resources[key] = Math.min(
			state.storageCaps[key],
			Math.max(0, Math.floor(resources[key] + rates.resources[key] * minutesElapsed)),
		);
	}
	return {
		...state,
		lastAccruedAt: segmentEndMs,
		resources,
	} satisfies T;
}

function settleCountsQueue<TState extends ColonySnapshot>(args: {
	lane: "defense" | "shipyard";
	nowMs: number;
	onIncrement: (state: TState, item: ColonyQueueEntry) => TState;
	state: TState;
}) {
	const openQueues = args.state.openQueues
		.filter(
			(entry) =>
				entry.lane === args.lane && (entry.status === "active" || entry.status === "queued"),
		)
		.sort((left, right) => left.order - right.order);
	let state = {
		...args.state,
		openQueues: args.state.openQueues.map((entry) => ({ ...entry })),
	};
	let active = openQueues.find((entry) => entry.status === "active") ?? null;
	const queued = openQueues.filter((entry) => entry.status === "queued");

	if (!active && queued.length > 0) {
		active = queued.shift() ?? null;
		if (active) {
			const target = state.openQueues.find((entry) => entry.id === active?.id);
			if (target) target.status = "active";
		}
	}

	while (active) {
		if (!isShipBuildPayload(active.payload) && !isDefenseBuildPayload(active.payload)) {
			break;
		}
		let completedQuantity = active.payload.completedQuantity;
		const unitDurationMs = active.payload.perUnitDurationSeconds * 1_000;
		while (completedQuantity < active.payload.quantity) {
			const nextUnitAt = active.startsAt + (completedQuantity + 1) * unitDurationMs;
			if (nextUnitAt > args.nowMs) {
				break;
			}
			state = args.onIncrement(state, active);
			completedQuantity += 1;
		}
		const target = state.openQueues.find((entry) => entry.id === active?.id);
		if (
			!target ||
			(!isShipBuildPayload(target.payload) && !isDefenseBuildPayload(target.payload))
		) {
			break;
		}
		target.payload = {
			...target.payload,
			completedQuantity,
		};
		if (completedQuantity < target.payload.quantity) {
			break;
		}
		target.status = "completed";
		active = queued.shift() ?? null;
		if (active) {
			const next = state.openQueues.find((entry) => entry.id === active?.id);
			if (next) {
				next.status = "active";
			}
		}
	}
	return state;
}

export function settleShipyardQueue(snapshot: ColonySnapshot, nowMs: number) {
	return settleCountsQueue({
		lane: "shipyard",
		nowMs,
		onIncrement: (state, item) => {
			if (item.kind !== "shipBuild" || !isShipBuildPayload(item.payload)) {
				return state;
			}
			const shipKey: ShipKey = item.payload.shipKey;
			return {
				...state,
				ships: {
					...state.ships,
					[shipKey]: state.ships[shipKey] + 1,
				},
			};
		},
		state: snapshot,
	});
}

export function settleDefenseQueue(snapshot: ColonySnapshot, nowMs: number) {
	return settleCountsQueue({
		lane: "defense",
		nowMs,
		onIncrement: (state, item) => {
			if (item.kind !== "defenseBuild" || !isDefenseBuildPayload(item.payload)) {
				return state;
			}
			const defenseKey: DefenseKey = item.payload.defenseKey;
			return {
				...state,
				defenses: {
					...state.defenses,
					[defenseKey]: state.defenses[defenseKey] + 1,
				},
			};
		},
		state: snapshot,
	});
}

export function settleBuildingAndFacilityQueue(snapshot: ColonySnapshot, nowMs: number) {
	let state: ColonySnapshot = {
		...snapshot,
		buildings: { ...snapshot.buildings },
		openQueues: snapshot.openQueues.map((entry) => ({ ...entry })),
		overflow: cloneResourceBucket(snapshot.overflow),
		resources: cloneResourceBucket(snapshot.resources),
		storageCaps: cloneResourceBucket(snapshot.storageCaps),
	};
	const buildingQueues = state.openQueues
		.filter(
			(entry) =>
				entry.lane === "building" && (entry.status === "active" || entry.status === "queued"),
		)
		.sort((left, right) => left.order - right.order);
	let active = buildingQueues.find((entry) => entry.status === "active") ?? null;
	const queued = buildingQueues.filter((entry) => entry.status === "queued");
	if (!active && queued.length > 0) {
		active = queued.shift() ?? null;
		if (active) {
			const target = state.openQueues.find((entry) => entry.id === active?.id);
			if (target) target.status = "active";
		}
	}

	const accrueTo = (segmentEndMs: number) => {
		const reconciled = reconcileOverflowIntoStorage(state);
		state = applyAccrualSegment(
			{
				...reconciled,
				buildings: state.buildings,
				planetMultipliers: state.planetMultipliers,
			},
			segmentEndMs,
		);
		state = {
			...state,
			overflow: reconcileOverflowIntoStorage(state).overflow,
			resources: reconcileOverflowIntoStorage(state).resources,
		};
	};

	while (active) {
		if (active.startsAt > state.lastAccruedAt) {
			accrueTo(Math.min(nowMs, active.startsAt));
			if (state.lastAccruedAt >= nowMs) {
				break;
			}
		}
		const activeSegmentEnd = Math.min(nowMs, active.completesAt);
		accrueTo(activeSegmentEnd);
		if (activeSegmentEnd < active.completesAt) {
			break;
		}
		if (active.kind === "buildingUpgrade" && isBuildingUpgradePayload(active.payload)) {
			const buildingKey: BuildingKey = active.payload.buildingKey;
			state.buildings[buildingKey] = Math.max(state.buildings[buildingKey], active.payload.toLevel);
		} else if (active.kind === "facilityUpgrade" && isFacilityUpgradePayload(active.payload)) {
			setFacilityLevel(state.buildings, active.payload.facilityKey, active.payload.toLevel);
		}
		state.storageCaps = computeStorageCaps(state.buildings);
		state = reconcileOverflowIntoStorage(state);
		const target = state.openQueues.find((entry) => entry.id === active?.id);
		if (target) {
			target.status = "completed";
		}
		active = queued.shift() ?? null;
		if (active) {
			const next = state.openQueues.find((entry) => entry.id === active?.id);
			if (next) next.status = "active";
		}
	}

	if (!active && state.lastAccruedAt < nowMs) {
		accrueTo(nowMs);
	}
	state.schedule = { nextEventAt: queueEventsNextAt(state.openQueues) };
	return state;
}

export function projectColonyEconomy(
	snapshot: ColonySnapshot,
	nowMs: number,
): ColonyProjectedEconomy {
	const settledBuildings = settleBuildingAndFacilityQueue(snapshot, nowMs);
	const settledShips = settleShipyardQueue(settledBuildings, nowMs);
	const settled = settleDefenseQueue(settledShips, nowMs);
	const rates = productionRatesPerMinute({
		buildings: settled.buildings,
		overflow: settled.overflow,
		planetMultipliers: settled.planetMultipliers,
	});
	return {
		energyConsumed: rates.energyConsumed,
		energyProduced: rates.energyProduced,
		energyRatio: rates.energyRatio,
		lastAccruedAt: settled.lastAccruedAt,
		overflow: settled.overflow,
		queues: projectQueueLanes({
			buildingMaxItems: getBuildingLaneCapacity(settled.buildings),
			now: nowMs,
			openQueues: settled.openQueues,
		}),
		ratesPerMinute: {
			alloy: Math.max(0, Math.floor(rates.resources.alloy)),
			crystal: Math.max(0, Math.floor(rates.resources.crystal)),
			fuel: Math.max(0, Math.floor(rates.resources.fuel)),
		},
		resources: settled.resources,
		storageCaps: settled.storageCaps,
	};
}

export function projectQueueLanesForSnapshot(snapshot: ColonySnapshot, nowMs: number) {
	const settled = settleDefenseQueue(
		settleShipyardQueue(settleBuildingAndFacilityQueue(snapshot, nowMs), nowMs),
		nowMs,
	);
	return projectQueueLanes({
		buildingMaxItems: getBuildingLaneCapacity(settled.buildings),
		now: nowMs,
		openQueues: settled.openQueues,
	});
}

export function buildEmptyBuildings(): ColonyBuildings {
	return {
		alloyMineLevel: 0,
		alloyStorageLevel: 0,
		crystalMineLevel: 0,
		crystalStorageLevel: 0,
		defenseGridLevel: 0,
		fuelRefineryLevel: 0,
		fuelStorageLevel: 0,
		powerPlantLevel: 0,
		roboticsHubLevel: 0,
		shipyardLevel: 0,
	};
}

export function buildEmptySnapshot(): ColonySnapshot {
	const buildings = buildEmptyBuildings();
	return {
		addressLabel: "",
		buildings,
		colonyId: "",
		defenses: normalizeDefenseCounts({}),
		lastAccruedAt: 0,
		name: "",
		openQueues: [],
		overflow: { alloy: 0, crystal: 0, fuel: 0 },
		planetMultipliers: { alloy: 1, crystal: 1, fuel: 1 },
		resources: { alloy: 0, crystal: 0, fuel: 0 },
		schedule: {},
		serverNowMs: 0,
		ships: normalizeShipCounts({}),
		storageCaps: computeStorageCaps(buildings),
	};
}

export function createQueueEntryId(prefix: string, parts: Array<number | string>) {
	return `${prefix}:${parts.join(":")}`;
}

export function getShipCost(shipKey: ShipKey): ResourceBucket {
	const definition = DEFAULT_SHIP_DEFINITIONS[shipKey];
	return {
		alloy: definition.cost.alloy,
		crystal: definition.cost.crystal,
		fuel: definition.cost.fuel,
	};
}

export function getDefenseCost(defenseKey: DefenseKey): ResourceBucket {
	const definition = DEFAULT_DEFENSE_DEFINITIONS[defenseKey];
	return {
		alloy: definition.cost.alloy,
		crystal: definition.cost.crystal,
		fuel: definition.cost.fuel,
	};
}

export function getFacilityUpgradeCost(
	facilityKey: FacilityKey,
	currentLevel: number,
): ResourceBucket {
	const facility = DEFAULT_FACILITY_REGISTRY.get(facilityKey);
	if (!facility) {
		throw new Error(`Missing facility config for ${facilityKey}`);
	}
	const cost = getUpgradeCost(facility, currentLevel);
	return {
		alloy: Math.max(0, Math.round(cost.alloy ?? 0)),
		crystal: Math.max(0, Math.round(cost.crystal ?? 0)),
		fuel: Math.max(0, Math.round(cost.fuel ?? 0)),
	};
}

export function getFacilityUpgradeDurationSeconds(facilityKey: FacilityKey, currentLevel: number) {
	const facility = DEFAULT_FACILITY_REGISTRY.get(facilityKey);
	if (!facility) {
		throw new Error(`Missing facility config for ${facilityKey}`);
	}
	return getUpgradeDurationSeconds(facility, currentLevel);
}

export function isFacilityCurrentlyUnlocked(buildings: ColonyBuildings, facilityKey: FacilityKey) {
	const facility = DEFAULT_FACILITY_REGISTRY.get(facilityKey);
	if (!facility) {
		return false;
	}
	return isFacilityUnlocked(facility, {
		facilityLevels: computeFacilityLevels(buildings),
		researchLevels: EMPTY_RESEARCH_LEVELS,
	});
}

export function getBuildingUpgradeCost(
	buildingKey: BuildingKey,
	currentLevel: number,
): ResourceBucket {
	const config = BUILDING_CONFIG[buildingKey];
	if (config.kind === "storage") {
		const base =
			buildingKey === "alloyStorageLevel"
				? { alloy: 1_000, crystal: 500, fuel: 0 }
				: buildingKey === "crystalStorageLevel"
					? { alloy: 500, crystal: 1_000, fuel: 0 }
					: { alloy: 500, crystal: 500, fuel: 500 };
		const growth = 1.6;
		return {
			alloy: Math.round(base.alloy * Math.pow(growth, currentLevel)),
			crystal: Math.round(base.crystal * Math.pow(growth, currentLevel)),
			fuel: Math.round(base.fuel * Math.pow(growth, currentLevel)),
		};
	}
	const generator = DEFAULT_GENERATOR_REGISTRY.get(config.generatorId);
	if (!generator) {
		throw new Error(`Missing generator config for ${buildingKey}`);
	}
	const cost = getUpgradeCost(generator, currentLevel);
	return {
		alloy: Math.max(0, Math.round(cost.alloy ?? 0)),
		crystal: Math.max(0, Math.round(cost.crystal ?? 0)),
		fuel: Math.max(0, Math.round(cost.fuel ?? 0)),
	};
}

export function getBuildingUpgradeDurationSeconds(buildingKey: BuildingKey, currentLevel: number) {
	const config = BUILDING_CONFIG[buildingKey];
	if (config.kind === "storage") {
		return Math.round(60 * Math.pow(1.5, currentLevel));
	}
	const generator = DEFAULT_GENERATOR_REGISTRY.get(config.generatorId);
	if (!generator) {
		throw new Error(`Missing generator config for ${buildingKey}`);
	}
	return getUpgradeDurationSeconds(generator, currentLevel);
}

export function getShipBuildBatchCost(shipKey: ShipKey, quantity: number): ResourceBucket {
	const perUnit = getShipCost(shipKey);
	return {
		alloy: perUnit.alloy * quantity,
		crystal: perUnit.crystal * quantity,
		fuel: perUnit.fuel * quantity,
	};
}

export function getDefenseBuildBatchCost(defenseKey: DefenseKey, quantity: number): ResourceBucket {
	const perUnit = getDefenseCost(defenseKey);
	return {
		alloy: perUnit.alloy * quantity,
		crystal: perUnit.crystal * quantity,
		fuel: perUnit.fuel * quantity,
	};
}

export function getShipBuildInfo(buildings: ColonyBuildings, shipKey: ShipKey) {
	return {
		cost: getShipCost(shipKey),
		perUnitDurationSeconds: getShipBuildDurationSeconds({
			shipKey,
			shipyardLevel: buildings.shipyardLevel,
		}),
	};
}

export function getDefenseBuildInfo(buildings: ColonyBuildings, defenseKey: DefenseKey) {
	return {
		cost: getDefenseCost(defenseKey),
		perUnitDurationSeconds: getDefenseBuildDurationSeconds({
			defenseGridLevel: buildings.defenseGridLevel,
			defenseKey,
		}),
	};
}

export function getFleetCargoCapacityForSnapshot(snapshot: ColonySnapshot) {
	return getFleetCargoCapacity(snapshot.ships);
}
