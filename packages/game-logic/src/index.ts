export {
	evaluateLevelFormula,
	exponentialAtLevel,
	makeExponentialOperationalFormula,
	makeExponentialUpgradeFormula,
	roundResourceMap,
} from "./curves";
export { generateSciFiName } from "./object-names";
export {
	FEATURE_KEYS,
	QUEST_DEFINITIONS,
	QUEST_IDS,
	RANK_DEFINITIONS,
	evaluateQuestDefinition,
	evaluateQuestObjective,
	getProgressionOverview,
	getQuestDefinition,
	getRankDefinition,
	getRankForXpTotal,
} from "./progression";

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
export {
	estimateColonyDefensePower,
	generateNpcRaidSnapshot,
	generateTutorialNpcRaidSnapshot,
} from "./raids";
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
export {
	BUILDING_CONFIG,
	BUILDING_LANE_BASE_CAPACITY,
	STORAGE_BUILDING_MAX_LEVEL,
	type ColonyBuildings,
	type ColonyEconomyState,
	type ColonyMilitaryState,
	type ColonyProjectedEconomy,
	type ColonyProjectionNow,
	type ColonySnapshot,
	applyAccrualSegment,
	buildEmptyBuildings,
	buildEmptySnapshot,
	computeFacilityLevels,
	computeStorageCaps,
	computeUsedSlots,
	createQueueEntryId,
	getBuildingLaneCapacity,
	getBuildingUpgradeCost,
	getBuildingUpgradeDurationSeconds,
	getDefenseBuildBatchCost,
	getDefenseBuildInfo,
	getFacilityUpgradeCost,
	getFacilityUpgradeDurationSeconds,
	getFleetCargoCapacityForSnapshot,
	getShipBuildBatchCost,
	getShipBuildInfo,
	isFacilityCurrentlyUnlocked,
	productionRatesPerMinute,
	projectColonyEconomy,
	projectQueueLanesForSnapshot,
	reconcileOverflowIntoStorage,
	setFacilityLevel,
	settleBuildingAndFacilityQueue,
	settleDefenseQueue,
	settleShipyardQueue,
} from "./colony-state";
export { type ColonyIntent, applyColonyIntent, applyColonyIntents } from "./colony-intents";
export {
	type BuildingCardView,
	type ColonyHudDatum,
	type DefenseStateView,
	type FacilityCardView,
	type ShipyardStateView,
	selectBuildingCards,
	selectDefenseCatalog,
	selectDefenseView,
	selectFacilityCards,
	selectHudResources,
	selectQueueLanes,
	selectShipCatalog,
	selectShipyardView,
} from "./colony-selectors";
export {
	LANE_QUEUE_CAPACITY,
	type ColonyLaneQueueView,
	type ColonyQueueEntry,
	type ColonyQueueLanesView,
	type ColonyQueuePayload,
	type ColonyQueueSnapshot,
	type ColonyQueueViewItem,
	compareQueueOrder,
	emptyLaneQueueView,
	isOpenQueueStatus,
	projectQueueLane,
	projectQueueLanes,
	queueEventsNextAt,
	toQueueViewItem,
} from "./queue";

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
	DefenseBuildQueuePayload,
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
export type {
	ContractRewardResourcesObjective,
	ContractProgressionRules,
	ContractSuccessObjective,
	DefenseCountObjective,
	FacilityAccessMap,
	FeatureAccessState,
	FeatureKey,
	HighlightTarget,
	MissionAccessMap,
	MissionKey,
	ObjectiveScope,
	ProgressionFeatureMap,
	ProgressionOverview,
	QuestBindingStrategy,
	QuestBindings,
	QuestCategory,
	QuestDefinition,
	QuestEffect,
	QuestEvaluationColony,
	QuestEvaluationContext,
	QuestEvaluationResult,
	QuestHighlight,
	QuestId,
	QuestLogItem,
	QuestObjectiveDefinition,
	QuestObjectiveProgress,
	QuestPrerequisite,
	QuestReward,
	QuestStatus,
	QuestTrackerItem,
	RaidDefenseSuccessObjective,
	RaidProgressionMode,
	RaidProgressionRules,
	RankDefinition,
	ShipAccessMap,
	TransportDeliveredResourcesObjective,
	TransportDeliveryObjective,
} from "./progression";
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
