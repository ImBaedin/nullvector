export const BUILDING_KEYS = [
	"alloyMineLevel",
	"crystalMineLevel",
	"fuelRefineryLevel",
	"powerPlantLevel",
	"alloyStorageLevel",
	"crystalStorageLevel",
	"fuelStorageLevel",
] as const;

export type BuildingKey = (typeof BUILDING_KEYS)[number];
export const FACILITY_KEYS = ["robotics_hub", "shipyard", "defense_grid"] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export type ResourceBucket = {
	alloy: number;
	crystal: number;
	fuel: number;
};

export type QueueLane = "building" | "shipyard" | "defense" | "research";

export type QueueItemStatus = "queued" | "active" | "completed" | "cancelled" | "failed";

export type BuildingUpgradeQueuePayload = {
	buildingKey: BuildingKey;
	fromLevel: number;
	toLevel: number;
};

export type FacilityUpgradeQueuePayload = {
	facilityKey: FacilityKey;
	fromLevel: number;
	toLevel: number;
};

export const SHIP_KEYS = [
	"smallCargo",
	"largeCargo",
	"colonyShip",
	"interceptor",
	"frigate",
	"cruiser",
	"bomber",
] as const;
export type ShipKey = (typeof SHIP_KEYS)[number];

export type ShipBuildQueuePayload = {
	completedQuantity: number;
	perUnitDurationSeconds: number;
	quantity: number;
	shipKey: ShipKey;
};

export type DefenseBuildQueuePayload = {
	completedQuantity: number;
	defenseKey: "missileBattery" | "laserTurret" | "gaussCannon" | "shieldDome";
	perUnitDurationSeconds: number;
	quantity: number;
};

export type QueueItemKind = "buildingUpgrade" | "facilityUpgrade" | "shipBuild" | "defenseBuild";

export type LaneQueueItem = {
	completesAt: number;
	kind: "buildingUpgrade";
	payload: BuildingUpgradeQueuePayload;
	status: QueueItemStatus;
};

export type ResourceBuildingLevelRow = {
	cost: ResourceBucket;
	deltaEnergyPerMinute: number;
	deltaOutputPerMinute: number;
	durationSeconds: number;
	energyUsePerMinute: number;
	level: number;
	outputPerMinute: number;
};

export type ResourceBuildingCardData = {
	currentLevel: number;
	energyUsePerMinute: number;
	group: "Production" | "Power" | "Storage";
	isQueued: boolean;
	isUpgrading: boolean;
	key: BuildingKey;
	maxLevel: number;
	name: string;
	nextUpgradeCost: ResourceBucket;
	nextUpgradeDurationSeconds?: number;
	outputLabel: string;
	outputPerMinute: number;
	status: "Running" | "Overflow" | "Paused" | "Upgrading" | "Queued";
};
