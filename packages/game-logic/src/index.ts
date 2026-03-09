export {
	evaluateLevelFormula,
	exponentialAtLevel,
	makeExponentialOperationalFormula,
	makeExponentialUpgradeFormula,
	roundResourceMap,
} from "./curves";

export {
	createGeneratorRegistry,
	DEFAULT_GENERATORS,
	DEFAULT_GENERATOR_REGISTRY,
	getGeneratorConsumptionPerMinute,
	getGeneratorProductionPerMinute,
	isGeneratorUnlocked,
} from "./generators";

export {
	createFacilityRegistry,
	DEFAULT_FACILITIES,
	DEFAULT_FACILITY_REGISTRY,
	getFacilityBuffs,
	isFacilityUnlocked,
} from "./facilities";

export {
	createRegistry,
	getCostAtLevel,
	getUpgradeDurationSeconds,
	getUpgradeCost,
	isStructureUnlocked,
} from "./structures";

export { isUnlockSatisfied } from "./unlocks";
export { BUILDING_KEYS, FACILITY_KEYS } from "./gameplay";
export {
	DEFAULT_SHIP_DEFINITIONS,
	EMPTY_SHIP_COUNTS,
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	getShipBuildDurationSeconds,
	normalizeShipCounts,
} from "./ships";

export type {
	ColonyBuff,
	CalculationContext,
	CostCurve,
	FacilityCategory,
	FacilityDefinition,
	FacilityRegistry,
	GeneratorCategory,
	GeneratorDefinition,
	GeneratorRegistry,
	LevelFormula,
	RateCurve,
	ResourceKey,
	ResourceMap,
	StructureDefinition,
	UnlockContext,
	UnlockRule,
	UpgradeTimeCurve,
} from "./types";
export type {
	BuildingKey,
	BuildingUpgradeQueuePayload,
	FacilityKey,
	FacilityUpgradeQueuePayload,
	LaneQueueItem,
	QueueItemKind,
	QueueItemStatus,
	QueueLane,
	ResourceBucket,
	ResourceBuildingCardData,
	ResourceBuildingLevelRow,
	ShipBuildQueuePayload,
	ShipKey,
} from "./gameplay";
export type { ShipCounts, ShipDefinition } from "./ships";
