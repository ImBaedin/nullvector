export {
	evaluateLevelFormula,
	exponentialAtLevel,
	makeExponentialOperationalFormula,
	makeExponentialUpgradeFormula,
	roundResourceMap,
} from "./curves";
export { generateSciFiName } from "./object-names";

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
export {
	DEFAULT_DEFENSE_DEFINITIONS,
	DEFENSE_KEYS,
	EMPTY_DEFENSE_COUNTS,
	getDefenseBuildDurationSeconds,
	normalizeDefenseCounts,
} from "./defenses";
export { estimateColonyDefensePower, generateNpcRaidSnapshot } from "./raids";
export {
	COMBAT_MISSION_TYPE_KEYS,
	CONTRACT_EXPIRY_MS,
	MISSION_TEMPLATES,
	getConcurrentContractLimit,
	generateContractSnapshot,
	getDifficultyTierForRank,
	getVisibleContractSlotCount,
} from "./contracts";
export { HOSTILE_FACTIONS, HOSTILE_FACTION_KEYS } from "./hostility";
export { simulateCombat } from "./combat";

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
	DefenseBuildQueuePayload,
	ShipBuildQueuePayload,
	ShipKey,
} from "./gameplay";
export type { ShipCounts, ShipDefinition } from "./ships";
export type { DefenseCounts, DefenseDefinition, DefenseKey } from "./defenses";
export type {
	CombatMissionTypeKey,
	CombatPriorityProfile,
	ContractSnapshot,
	MissionTemplate,
} from "./contracts";
export type { HostileFactionKey } from "./hostility";
export type { CombatResult, CombatRoundSummary, CombatSide } from "./combat";
