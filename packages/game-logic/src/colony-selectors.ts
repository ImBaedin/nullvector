import type { ResourceBuildingCardData } from "./gameplay";

import {
	BUILDING_CONFIG,
	type ColonySnapshot,
	type ColonyProjectedEconomy,
	STORAGE_BUILDING_MAX_LEVEL,
	computeFacilityLevels,
	getBuildingUpgradeCost,
	getBuildingUpgradeDurationSeconds,
	getDefenseBuildInfo,
	getFacilityUpgradeCost,
	getFacilityUpgradeDurationSeconds,
	getShipBuildInfo,
	isFacilityCurrentlyUnlocked,
	projectColonyEconomy,
} from "./colony-state";
import { DEFAULT_DEFENSE_DEFINITIONS, DEFENSE_KEYS } from "./defenses";
import { DEFAULT_FACILITY_REGISTRY } from "./facilities";
import { BUILDING_KEYS } from "./gameplay";
import { DEFAULT_GENERATOR_REGISTRY, getGeneratorConsumptionPerMinute } from "./generators";
import { type ColonyQueueEntry, type ColonyQueuePayload } from "./queue";
import { DEFAULT_SHIP_DEFINITIONS, type ShipCounts } from "./ships";

function isBuildingUpgradePayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { buildingKey: keyof typeof BUILDING_CONFIG }> {
	return "buildingKey" in payload;
}

function isFacilityUpgradePayload(
	payload: ColonyQueuePayload,
): payload is Extract<
	ColonyQueuePayload,
	{ facilityKey: "defense_grid" | "robotics_hub" | "shipyard" }
> {
	return "facilityKey" in payload;
}

function isShipBuildPayload(
	payload: ColonyQueuePayload,
): payload is Extract<ColonyQueuePayload, { shipKey: keyof ShipCounts }> {
	return "shipKey" in payload;
}

const SHIP_ORDER = [
	"smallCargo",
	"largeCargo",
	"colonyShip",
	"interceptor",
	"frigate",
	"cruiser",
	"bomber",
] as const;

export type ColonyHudDatum = {
	deltaPerMinute?: string;
	deltaPerMinuteAmount?: number;
	energyBalance?: number;
	key: "alloy" | "crystal" | "energy" | "fuel";
	overflowAmount?: number;
	overflowLabel?: string;
	pausedByOverflow?: boolean;
	storageCapAmount?: number;
	storageCapLabel?: string;
	storageCurrentAmount?: number;
	storageCurrentLabel?: string;
	storagePercent?: number;
	value: string;
	valueAmount?: number;
};

export type BuildingCardView = ResourceBuildingCardData;

export type FacilityCardView = {
	category: "infrastructure" | "military" | "research";
	currentLevel: number;
	isQueued: boolean;
	isUnlocked: boolean;
	isUpgrading: boolean;
	key: "defense_grid" | "robotics_hub" | "shipyard";
	maxLevel: number;
	name: string;
	nextUpgradeCost: { alloy: number; crystal: number; fuel: number };
	nextUpgradeDurationSeconds: number;
	status: "Constructing" | "Locked" | "Maxed" | "Online" | "Queued";
};

export type ShipyardStateView = {
	colonyId: string;
	lane: ColonyProjectedEconomy["queues"]["lanes"]["shipyard"];
	nextEventAt?: number;
	shipStates: Array<{
		key: (typeof SHIP_ORDER)[number];
		owned: number;
		perUnitDurationSeconds: number;
		queued: number;
	}>;
	shipyardLevel: number;
};

export type DefenseStateView = {
	colonyId: string;
	defenseGridLevel: number;
	defenseStates: Array<{
		isUnlocked: boolean;
		key: (typeof DEFENSE_KEYS)[number];
		owned: number;
		perUnitDurationSeconds: number;
		queued: number;
	}>;
	lane: ColonyProjectedEconomy["queues"]["lanes"]["defense"];
	nextEventAt?: number;
};

function formatResourceValue(units: number) {
	if (units >= 1_000_000) {
		return `${(units / 1_000_000).toFixed(1)}M`;
	}
	if (units >= 1_000) {
		return `${(units / 1_000).toFixed(1)}k`;
	}
	return units.toString();
}

function countQueued(
	openQueues: ColonyQueueEntry[],
	kind: ColonyQueueEntry["kind"],
	matchKey: string,
) {
	return openQueues.reduce((total, row) => {
		if (row.kind !== kind || (row.status !== "active" && row.status !== "queued")) {
			return total;
		}
		if (
			(kind === "shipBuild" &&
				(!isShipBuildPayload(row.payload) || row.payload.shipKey !== matchKey)) ||
			(kind === "defenseBuild" &&
				!("defenseKey" in row.payload ? row.payload.defenseKey === matchKey : false)) ||
			(kind === "buildingUpgrade" &&
				(!isBuildingUpgradePayload(row.payload) || row.payload.buildingKey !== matchKey)) ||
			(kind === "facilityUpgrade" &&
				(!isFacilityUpgradePayload(row.payload) || row.payload.facilityKey !== matchKey))
		) {
			return total;
		}
		if (kind === "shipBuild" && isShipBuildPayload(row.payload)) {
			return total + Math.max(0, row.payload.quantity - row.payload.completedQuantity);
		}
		if (kind === "defenseBuild" && "defenseKey" in row.payload) {
			return total + Math.max(0, row.payload.quantity - row.payload.completedQuantity);
		}
		return total + 1;
	}, 0);
}

export function selectHudResources(
	snapshot: ColonySnapshot,
	nowMs = snapshot.serverNowMs,
): ColonyHudDatum[] {
	const economy = projectColonyEconomy(snapshot, nowMs);
	const alloyCap = economy.storageCaps.alloy;
	const crystalCap = economy.storageCaps.crystal;
	const fuelCap = economy.storageCaps.fuel;
	return [
		{
			deltaPerMinute:
				economy.overflow.alloy > 0
					? "Paused by overflow"
					: `+${economy.ratesPerMinute.alloy.toLocaleString()}/m`,
			deltaPerMinuteAmount: economy.overflow.alloy > 0 ? 0 : economy.ratesPerMinute.alloy,
			key: "alloy",
			overflowAmount: economy.overflow.alloy,
			overflowLabel: formatResourceValue(economy.overflow.alloy),
			pausedByOverflow: economy.overflow.alloy > 0,
			storageCapAmount: alloyCap,
			storageCapLabel: formatResourceValue(alloyCap),
			storageCurrentAmount: economy.resources.alloy,
			storageCurrentLabel: formatResourceValue(economy.resources.alloy),
			storagePercent: alloyCap <= 0 ? 0 : Math.min(100, (economy.resources.alloy / alloyCap) * 100),
			value: formatResourceValue(economy.resources.alloy),
			valueAmount: economy.resources.alloy,
		},
		{
			deltaPerMinute:
				economy.overflow.crystal > 0
					? "Paused by overflow"
					: `+${economy.ratesPerMinute.crystal.toLocaleString()}/m`,
			deltaPerMinuteAmount: economy.overflow.crystal > 0 ? 0 : economy.ratesPerMinute.crystal,
			key: "crystal",
			overflowAmount: economy.overflow.crystal,
			overflowLabel: formatResourceValue(economy.overflow.crystal),
			pausedByOverflow: economy.overflow.crystal > 0,
			storageCapAmount: crystalCap,
			storageCapLabel: formatResourceValue(crystalCap),
			storageCurrentAmount: economy.resources.crystal,
			storageCurrentLabel: formatResourceValue(economy.resources.crystal),
			storagePercent:
				crystalCap <= 0 ? 0 : Math.min(100, (economy.resources.crystal / crystalCap) * 100),
			value: formatResourceValue(economy.resources.crystal),
			valueAmount: economy.resources.crystal,
		},
		{
			deltaPerMinute:
				economy.overflow.fuel > 0
					? "Paused by overflow"
					: `+${economy.ratesPerMinute.fuel.toLocaleString()}/m`,
			deltaPerMinuteAmount: economy.overflow.fuel > 0 ? 0 : economy.ratesPerMinute.fuel,
			key: "fuel",
			overflowAmount: economy.overflow.fuel,
			overflowLabel: formatResourceValue(economy.overflow.fuel),
			pausedByOverflow: economy.overflow.fuel > 0,
			storageCapAmount: fuelCap,
			storageCapLabel: formatResourceValue(fuelCap),
			storageCurrentAmount: economy.resources.fuel,
			storageCurrentLabel: formatResourceValue(economy.resources.fuel),
			storagePercent: fuelCap <= 0 ? 0 : Math.min(100, (economy.resources.fuel / fuelCap) * 100),
			value: formatResourceValue(economy.resources.fuel),
			valueAmount: economy.resources.fuel,
		},
		{
			energyBalance: Math.round(economy.energyProduced - economy.energyConsumed),
			key: "energy",
			value: `${Math.round(economy.energyRatio * 100)}%`,
		},
	];
}

export function selectBuildingCards(
	snapshot: ColonySnapshot,
	nowMs = snapshot.serverNowMs,
): BuildingCardView[] {
	const settled = projectColonyEconomy(snapshot, nowMs);
	return BUILDING_KEYS.map((key) => {
		const config = BUILDING_CONFIG[key];
		const currentLevel = snapshot.buildings[key];
		const projectedLevel = settled.queues.lanes.building.pendingItems
			.concat(
				settled.queues.lanes.building.activeItem ? [settled.queues.lanes.building.activeItem] : [],
			)
			.reduce((level, row) => {
				if (
					row.kind !== "buildingUpgrade" ||
					!isBuildingUpgradePayload(row.payload) ||
					row.payload.buildingKey !== key
				) {
					return level;
				}
				return Math.max(level, row.payload.toLevel);
			}, currentLevel);
		const isUpgrading =
			settled.queues.lanes.building.activeItem?.kind === "buildingUpgrade" &&
			isBuildingUpgradePayload(settled.queues.lanes.building.activeItem.payload) &&
			settled.queues.lanes.building.activeItem.payload.buildingKey === key;
		const isQueued =
			countQueued(snapshot.openQueues, "buildingUpgrade", key) > (isUpgrading ? 1 : 0);
		const maxLevel =
			config.kind === "storage"
				? STORAGE_BUILDING_MAX_LEVEL
				: (DEFAULT_GENERATOR_REGISTRY.get(config.generatorId)?.maxLevel ?? 0);
		const nextUpgradeCost =
			projectedLevel < maxLevel
				? getBuildingUpgradeCost(key, projectedLevel)
				: { alloy: 0, crystal: 0, fuel: 0 };
		const nextUpgradeDurationSeconds =
			projectedLevel < maxLevel
				? getBuildingUpgradeDurationSeconds(key, projectedLevel)
				: undefined;
		const outputPerMinute =
			config.kind === "storage"
				? settled.storageCaps[config.resource]
				: config.group === "Power"
					? settled.energyProduced
					: settled.ratesPerMinute[config.resource as keyof typeof settled.ratesPerMinute];
		const status: BuildingCardView["status"] = isUpgrading
			? "Upgrading"
			: isQueued
				? "Queued"
				: config.group === "Production" &&
					  settled.overflow[config.resource as keyof typeof settled.overflow] > 0
					? "Overflow"
					: settled.energyRatio <= 0 && config.group === "Production"
						? "Paused"
						: "Running";

		return {
			currentLevel,
			energyUsePerMinute:
				config.kind === "generator" && key !== "powerPlantLevel"
					? (() => {
							const generator = DEFAULT_GENERATOR_REGISTRY.get(config.generatorId);
							return generator ? getGeneratorConsumptionPerMinute(generator, currentLevel) : 0;
						})()
					: 0,
			group: config.group,
			isQueued,
			isUpgrading,
			key,
			maxLevel,
			name: config.name,
			nextUpgradeCost,
			nextUpgradeDurationSeconds,
			outputLabel:
				config.group === "Power"
					? "MW"
					: config.kind === "storage"
						? `${config.resource} cap`
						: `${config.resource} / min`,
			outputPerMinute,
			status,
		};
	});
}

export function selectFacilityCards(
	snapshot: ColonySnapshot,
	nowMs = snapshot.serverNowMs,
): FacilityCardView[] {
	const settled = projectColonyEconomy(snapshot, nowMs);
	const buildingLane = settled.queues.lanes.building;
	return (["robotics_hub", "shipyard", "defense_grid"] as const).map((facilityKey) => {
		const facility = DEFAULT_FACILITY_REGISTRY.get(facilityKey);
		if (!facility) {
			throw new Error(`Missing facility config for ${facilityKey}`);
		}
		const currentLevel = computeFacilityLevels(snapshot.buildings)[facilityKey] ?? 0;
		const projectedLevel = [
			...(buildingLane.activeItem ? [buildingLane.activeItem] : []),
			...buildingLane.pendingItems,
		].reduce((level, row) => {
			if (
				row.kind !== "facilityUpgrade" ||
				!isFacilityUpgradePayload(row.payload) ||
				row.payload.facilityKey !== facilityKey
			) {
				return level;
			}
			return Math.max(level, row.payload.toLevel);
		}, currentLevel);
		const isUpgrading =
			buildingLane.activeItem?.kind === "facilityUpgrade" &&
			isFacilityUpgradePayload(buildingLane.activeItem.payload) &&
			buildingLane.activeItem.payload.facilityKey === facilityKey;
		const isQueued =
			countQueued(snapshot.openQueues, "facilityUpgrade", facilityKey) > (isUpgrading ? 1 : 0);
		const isUnlocked = isFacilityCurrentlyUnlocked(snapshot.buildings, facilityKey);
		const isMaxLevel = projectedLevel >= facility.maxLevel;
		return {
			category: facility.category,
			currentLevel,
			isQueued,
			isUnlocked,
			isUpgrading,
			key: facilityKey,
			maxLevel: facility.maxLevel,
			name: facility.name,
			nextUpgradeCost: !isMaxLevel
				? getFacilityUpgradeCost(facilityKey, projectedLevel)
				: { alloy: 0, crystal: 0, fuel: 0 },
			nextUpgradeDurationSeconds: !isMaxLevel
				? getFacilityUpgradeDurationSeconds(facilityKey, projectedLevel)
				: 0,
			status: !isUnlocked
				? "Locked"
				: isUpgrading
					? "Constructing"
					: isQueued
						? "Queued"
						: isMaxLevel
							? "Maxed"
							: "Online",
		};
	});
}

export function selectShipyardView(
	snapshot: ColonySnapshot,
	nowMs = snapshot.serverNowMs,
): ShipyardStateView {
	const settled = projectColonyEconomy(snapshot, nowMs);
	return {
		colonyId: snapshot.colonyId,
		lane: settled.queues.lanes.shipyard,
		nextEventAt: settled.queues.nextEventAt,
		shipStates: SHIP_ORDER.map((shipKey) => ({
			key: shipKey,
			owned: snapshot.ships[shipKey],
			perUnitDurationSeconds: getShipBuildInfo(snapshot.buildings, shipKey).perUnitDurationSeconds,
			queued: countQueued(snapshot.openQueues, "shipBuild", shipKey),
		})),
		shipyardLevel: snapshot.buildings.shipyardLevel,
	};
}

export function selectDefenseView(
	snapshot: ColonySnapshot,
	nowMs = snapshot.serverNowMs,
): DefenseStateView {
	const settled = projectColonyEconomy(snapshot, nowMs);
	return {
		colonyId: snapshot.colonyId,
		defenseGridLevel: snapshot.buildings.defenseGridLevel,
		defenseStates: DEFENSE_KEYS.map((defenseKey) => ({
			isUnlocked:
				snapshot.buildings.defenseGridLevel >=
				DEFAULT_DEFENSE_DEFINITIONS[defenseKey].requiredDefenseGridLevel,
			key: defenseKey,
			owned: snapshot.defenses[defenseKey],
			perUnitDurationSeconds: getDefenseBuildInfo(snapshot.buildings, defenseKey)
				.perUnitDurationSeconds,
			queued: countQueued(snapshot.openQueues, "defenseBuild", defenseKey),
		})),
		lane: settled.queues.lanes.defense,
		nextEventAt: settled.queues.nextEventAt,
	};
}

export function selectQueueLanes(snapshot: ColonySnapshot, nowMs = snapshot.serverNowMs) {
	return projectColonyEconomy(snapshot, nowMs).queues;
}

export function selectShipCatalog() {
	return SHIP_ORDER.map((shipKey) => {
		const definition = DEFAULT_SHIP_DEFINITIONS[shipKey];
		return {
			cargoCapacity: definition.cargoCapacity,
			cost: definition.cost,
			fuelDistanceRate: definition.fuelDistanceRate,
			fuelLaunchCost: definition.fuelLaunchCost,
			key: shipKey,
			name: definition.name,
			requiredShipyardLevel: definition.requiredShipyardLevel,
			speed: definition.speed,
		};
	});
}

export function selectDefenseCatalog() {
	return DEFENSE_KEYS.map((defenseKey) => {
		const definition = DEFAULT_DEFENSE_DEFINITIONS[defenseKey];
		return {
			attack: definition.attack,
			cost: definition.cost,
			hull: definition.hull,
			key: defenseKey,
			name: definition.name,
			requiredDefenseGridLevel: definition.requiredDefenseGridLevel,
			shield: definition.shield,
		};
	});
}
