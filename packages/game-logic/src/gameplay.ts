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

export type ResourceBucket = {
  alloy: number;
  crystal: number;
  fuel: number;
};

export type QueueLane = "building" | "shipyard" | "research";

export type QueueItemStatus =
  | "queued"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export type BuildingUpgradeQueuePayload = {
  buildingKey: BuildingKey;
  fromLevel: number;
  toLevel: number;
};

export const SHIP_KEYS = ["smallCargo", "largeCargo", "colonyShip"] as const;
export type ShipKey = (typeof SHIP_KEYS)[number];

export type ShipBuildQueuePayload = {
  completedQuantity: number;
  perUnitDurationSeconds: number;
  quantity: number;
  shipKey: ShipKey;
};

export type QueueItemKind = "buildingUpgrade" | "shipBuild";

export type LaneQueueItem = {
  completesAt: number;
  kind: QueueItemKind;
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
  canUpgrade: boolean;
  currentLevel: number;
  energyUsePerMinute: number;
  group: "Production" | "Power" | "Storage";
  isQueued: boolean;
  isUpgrading: boolean;
  key: BuildingKey;
  levelTable: ResourceBuildingLevelRow[];
  maxLevel: number;
  name: string;
  nextUpgradeCost: ResourceBucket;
  nextUpgradeDurationSeconds?: number;
  outputLabel: string;
  outputPerMinute: number;
  status: "Running" | "Overflow" | "Paused" | "Upgrading" | "Queued";
};
