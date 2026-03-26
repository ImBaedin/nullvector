import type { DefenseKey } from "./defenses";
import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";

export const FEATURE_KEYS = [
	"overview",
	"contracts",
	"raids",
	"colonization",
	"facilities",
	"fleet",
	"shipyard",
	"defenses",
	"notifications",
] as const;

export const MISSION_KEYS = ["contracts", "colonize", "transport"] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type MissionKey = (typeof MISSION_KEYS)[number];
export type FeatureAccessState = "hidden" | "locked" | "unlocked";
export type QuestCategory = "main" | "system" | "side";
export type QuestStatus = "active" | "claimable" | "claimed";
export type QuestStateStatus = "active" | "claimed";
export type QuestBindingStrategy = "none" | "activeColony" | "newestPlayerColony";
export type ObjectiveScope = "player" | "boundColony";
export type RaidProgressionMode = "off" | "tutorialOnly" | "full";

export type ContractProgressionRules = {
	activeLimit: number;
	difficultyTier: number;
	visibleSlots: number;
};

export type RaidProgressionRules = {
	difficultyTier: number;
	mode: RaidProgressionMode;
};

export type ProgressionFeatureMap = Record<FeatureKey, FeatureAccessState>;
export type FacilityAccessMap = Record<FacilityKey, FeatureAccessState>;
export type ShipAccessMap = Record<ShipKey, FeatureAccessState>;
export type MissionAccessMap = Record<MissionKey, FeatureAccessState>;

export type RankDefinition = {
	colonyCap: number;
	contractRules: ContractProgressionRules;
	features: ProgressionFeatureMap;
	facilityAccess: FacilityAccessMap;
	missionAccess: MissionAccessMap;
	raidRules: RaidProgressionRules;
	rank: number;
	shipAccess: ShipAccessMap;
	totalXpRequired: number;
};

export type QuestPrerequisite =
	| {
			kind: "questClaimed";
			questId: QuestId;
	  }
	| {
			kind: "minimumRank";
			rank: number;
	  };

type QuestObjectiveBase = {
	scope?: ObjectiveScope;
};

export type BuildingLevelObjective = QuestObjectiveBase & {
	buildingKey: BuildingKey;
	kind: "buildingLevelAtLeast";
	minLevel: number;
};

export type FacilityLevelObjective = QuestObjectiveBase & {
	facilityKey: FacilityKey;
	kind: "facilityLevelAtLeast";
	minLevel: number;
};

export type ShipCountObjective = QuestObjectiveBase & {
	kind: "shipCountAtLeast";
	minCount: number;
	shipKey: ShipKey;
};

export type DefenseCountObjective = QuestObjectiveBase & {
	defenseKey: DefenseKey;
	kind: "defenseCountAtLeast";
	minCount: number;
};

export type ColonyCountObjective = {
	kind: "colonyCountAtLeast";
	minCount: number;
};

export type ContractSuccessObjective = QuestObjectiveBase & {
	kind: "contractSuccessCountAtLeast";
	minCount: number;
};

export type ContractRewardResourcesObjective = QuestObjectiveBase & {
	kind: "contractRewardResourcesAtLeast";
	minAmount: number;
};

export type RaidDefenseSuccessObjective = QuestObjectiveBase & {
	kind: "raidDefenseSuccessCountAtLeast";
	minCount: number;
};

export type ColonizationSuccessObjective = QuestObjectiveBase & {
	kind: "colonizationSuccessCountAtLeast";
	minCount: number;
};

export type TransportDeliveryObjective = QuestObjectiveBase & {
	kind: "transportDeliveryCountAtLeast";
	minCount: number;
};

export type TransportDeliveredResourcesObjective = QuestObjectiveBase & {
	kind: "transportDeliveredResourcesAtLeast";
	minAmount: number;
};

export type QuestObjectiveDefinition =
	| BuildingLevelObjective
	| FacilityLevelObjective
	| ShipCountObjective
	| DefenseCountObjective
	| ColonyCountObjective
	| ContractSuccessObjective
	| ContractRewardResourcesObjective
	| RaidDefenseSuccessObjective
	| ColonizationSuccessObjective
	| TransportDeliveryObjective
	| TransportDeliveredResourcesObjective;

export type QuestReward =
	| {
			amount: number;
			kind: "credits";
	  }
	| {
			amount: number;
			kind: "xp";
	  }
	| {
			kind: "resources";
			resources: ResourceBucket;
	  };

export type QuestEffect = {
	kind: "spawnTutorialRaid";
};

export type HighlightTarget =
	| "tab-overview"
	| "tab-facilities"
	| "tab-shipyard"
	| "tab-defenses"
	| "tab-contracts"
	| "tab-fleet"
	| "tab-colonization"
	| "quest-button"
	| "star-map-button";

export type QuestHighlight = {
	target: HighlightTarget;
	hint?: string;
};

export type QuestDefinition = {
	bindingStrategy: QuestBindingStrategy;
	category: QuestCategory;
	description: string;
	effects?: QuestEffect[];
	highlights?: QuestHighlight[];
	id: QuestId;
	objectives: QuestObjectiveDefinition[];
	order: number;
	prerequisites: QuestPrerequisite[];
	rewards: QuestReward[];
	title: string;
	version: number;
};

export type QuestBindings = {
	colonyId?: string;
};

export type QuestEvaluationColony = {
	buildings: Partial<Record<BuildingKey, number>>;
	colonyId: string;
	defenses: Partial<Record<DefenseKey, number>>;
	facilities: Partial<Record<FacilityKey, number>>;
	ships: Partial<Record<ShipKey, number>>;
};

export type QuestEvaluationContext = {
	colonies: QuestEvaluationColony[];
	colonyCount: number;
	colonizationSuccessCount: number;
	contractRewardResourcesByColony: Record<string, number>;
	contractSuccessCountByColony: Record<string, number>;
	raidDefenseSuccessCountByColony: Record<string, number>;
	transportDeliveredResourcesByColony: Record<string, number>;
	transportDeliveryCountByColony: Record<string, number>;
};

export type QuestStateRowView = {
	questId: QuestId;
	status: QuestStateStatus;
	questVersion: number;
	bindings: QuestBindings;
	activatedAt: number;
	claimedAt?: number;
};

export type QuestClientColonyFacts = {
	colonyId: string;
	buildings: Partial<Record<BuildingKey, number>>;
	facilities: Partial<Record<FacilityKey, number>>;
	defenses: Partial<Record<DefenseKey, number>>;
	ships: Partial<Record<ShipKey, number>>;
};

export type QuestClientColonyMetric = {
	colonyId: string;
	contractSuccessCount: number;
	contractRewardResourcesTotal: number;
	raidDefenseSuccessCount: number;
	transportDeliveryCount: number;
	transportDeliveredResourcesTotal: number;
};

export type QuestClientFacts = {
	colonyCount: number;
	colonizationSuccessCount: number;
	colonies: QuestClientColonyFacts[];
	colonyMetrics: QuestClientColonyMetric[];
};

export type QuestObjectiveProgress = {
	complete: boolean;
	current: number;
	required: number;
};

export type QuestEvaluationResult = {
	complete: boolean;
	objectives: QuestObjectiveProgress[];
};

export type ProgressionOverview = {
	colonyCap: number;
	contractRules: ContractProgressionRules;
	features: ProgressionFeatureMap;
	facilityAccess: FacilityAccessMap;
	missionAccess: MissionAccessMap;
	nextRank: number | null;
	nextRankXpRequired: number | null;
	questTrackerCount: number;
	raidRules: RaidProgressionRules;
	rank: number;
	rankXpTotal: number;
	shipAccess: ShipAccessMap;
	xpIntoCurrentRank: number;
	xpToNextRank: number | null;
};

export type QuestTrackerItem = {
	category: QuestCategory;
	claimable: boolean;
	description: string;
	id: QuestId;
	objectives: QuestObjectiveProgress[];
	order: number;
	rewards: QuestReward[];
	status: QuestStatus;
	title: string;
};

export type QuestLogItem = QuestTrackerItem & {
	bindings: QuestBindings;
	version: number;
};

export type QuestTimelineStatus = QuestStatus | "upcoming" | "locked";

export type QuestTimelinePrerequisite = {
	questId: string;
	title: string;
	satisfied: boolean;
};

export type QuestTimelineItem = {
	category: QuestCategory;
	claimable: boolean;
	description: string;
	id: QuestId;
	objectives: QuestObjectiveProgress[];
	order: number;
	prerequisites: QuestTimelinePrerequisite[];
	rewards: QuestReward[];
	status: QuestTimelineStatus;
	title: string;
};

export const QUEST_IDS = [
	"main_welcome_to_nullvector",
	"main_scaling_production",
	"main_increasing_storage_capacity",
	"main_restore_power_balance",
	"main_build_robotics_hub",
	"main_upgrade_robotics_hub",
	"main_establish_defense_grid",
	"main_arm_missile_batteries",
	"main_hold_the_line",
	"main_build_shipyard",
	"main_upgrade_shipyard",
	"main_assemble_interceptors",
	"main_complete_first_contract",
	"main_profit_from_conflict",
	"main_build_small_cargo",
	"main_expand_shipyard_for_colonization",
	"main_commission_colony_ship",
	"main_found_second_colony",
	"main_stabilize_new_outpost",
	"main_open_supply_line",
] as const;

export type QuestId = (typeof QUEST_IDS)[number];

const HIDDEN: FeatureAccessState = "hidden";
const LOCKED: FeatureAccessState = "locked";
const UNLOCKED: FeatureAccessState = "unlocked";

const DEFAULT_FACILITY_ACCESS: FacilityAccessMap = {
	robotics_hub: HIDDEN,
	shipyard: LOCKED,
	defense_grid: HIDDEN,
};

const DEFAULT_SHIP_ACCESS: ShipAccessMap = {
	smallCargo: HIDDEN,
	largeCargo: HIDDEN,
	colonyShip: HIDDEN,
	interceptor: HIDDEN,
	frigate: HIDDEN,
	cruiser: HIDDEN,
	bomber: HIDDEN,
};

const DEFAULT_MISSION_ACCESS: MissionAccessMap = {
	contracts: HIDDEN,
	colonize: HIDDEN,
	transport: HIDDEN,
};

const DEFAULT_FEATURES: ProgressionFeatureMap = {
	overview: HIDDEN,
	contracts: HIDDEN,
	raids: HIDDEN,
	colonization: HIDDEN,
	facilities: HIDDEN,
	fleet: HIDDEN,
	shipyard: HIDDEN,
	defenses: HIDDEN,
	notifications: UNLOCKED,
};

function nextRankXpRequirement(rank: number) {
	if (rank <= 0) {
		return 100;
	}
	return Math.max(100, Math.round(100 * Math.pow(1.4, Math.max(0, rank - 1))));
}

function createOnboardingRankDefinition(
	rank: number,
): Omit<RankDefinition, "contractRules" | "rank" | "totalXpRequired"> {
	switch (rank) {
		case 0:
			return {
				colonyCap: 1,
				features: {
					...DEFAULT_FEATURES,
				},
				facilityAccess: {
					...DEFAULT_FACILITY_ACCESS,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
				},
				raidRules: {
					mode: "off",
					difficultyTier: 1,
				},
			};
		case 1:
			return {
				colonyCap: 1,
				features: {
					...DEFAULT_FEATURES,
					facilities: UNLOCKED,
				},
				facilityAccess: {
					...DEFAULT_FACILITY_ACCESS,
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
				},
				raidRules: {
					mode: "off",
					difficultyTier: 1,
				},
			};
		case 2:
			return {
				colonyCap: 1,
				features: {
					...DEFAULT_FEATURES,
					facilities: UNLOCKED,
					defenses: UNLOCKED,
				},
				facilityAccess: {
					...DEFAULT_FACILITY_ACCESS,
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
				},
				raidRules: {
					mode: "off",
					difficultyTier: 1,
				},
			};
		case 3:
			return {
				colonyCap: 1,
				features: {
					...DEFAULT_FEATURES,
					facilities: UNLOCKED,
					defenses: UNLOCKED,
					shipyard: UNLOCKED,
					contracts: UNLOCKED,
					raids: UNLOCKED,
				},
				facilityAccess: {
					...DEFAULT_FACILITY_ACCESS,
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
					shipyard: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
					interceptor: UNLOCKED,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
					contracts: UNLOCKED,
				},
				raidRules: {
					mode: "full",
					difficultyTier: 1,
				},
			};
		case 4:
			return {
				colonyCap: 1,
				features: {
					...DEFAULT_FEATURES,
					facilities: UNLOCKED,
					defenses: UNLOCKED,
					shipyard: UNLOCKED,
					contracts: UNLOCKED,
					fleet: UNLOCKED,
					raids: UNLOCKED,
				},
				facilityAccess: {
					...DEFAULT_FACILITY_ACCESS,
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
					shipyard: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
					interceptor: UNLOCKED,
					smallCargo: UNLOCKED,
					colonyShip: UNLOCKED,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
					contracts: UNLOCKED,
				},
				raidRules: {
					mode: "off",
					difficultyTier: 1,
				},
			};
		case 5:
			return {
				colonyCap: 2,
				features: {
					...DEFAULT_FEATURES,
					facilities: UNLOCKED,
					defenses: UNLOCKED,
					shipyard: UNLOCKED,
					contracts: UNLOCKED,
					fleet: UNLOCKED,
					colonization: UNLOCKED,
					raids: UNLOCKED,
				},
				facilityAccess: {
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
					shipyard: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
					interceptor: UNLOCKED,
					smallCargo: UNLOCKED,
					colonyShip: UNLOCKED,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
					contracts: UNLOCKED,
					colonize: UNLOCKED,
					transport: UNLOCKED,
				},
				raidRules: {
					mode: "full",
					difficultyTier: 1,
				},
			};
		default:
			return {
				colonyCap: 2,
				features: {
					...DEFAULT_FEATURES,
					overview: UNLOCKED,
					facilities: UNLOCKED,
					defenses: UNLOCKED,
					shipyard: UNLOCKED,
					contracts: UNLOCKED,
					fleet: UNLOCKED,
					colonization: UNLOCKED,
					raids: UNLOCKED,
				},
				facilityAccess: {
					robotics_hub: UNLOCKED,
					defense_grid: UNLOCKED,
					shipyard: UNLOCKED,
				},
				shipAccess: {
					...DEFAULT_SHIP_ACCESS,
					interceptor: UNLOCKED,
					smallCargo: UNLOCKED,
					colonyShip: UNLOCKED,
				},
				missionAccess: {
					...DEFAULT_MISSION_ACCESS,
					contracts: UNLOCKED,
					colonize: UNLOCKED,
					transport: UNLOCKED,
				},
				raidRules: {
					mode: "full",
					difficultyTier: 1,
				},
			};
	}
}

function createRankDefinition(rank: number): RankDefinition {
	let totalXpRequired = 0;
	for (let current = 0; current < rank; current += 1) {
		totalXpRequired += nextRankXpRequirement(current);
	}
	const effectiveRank = Math.max(1, Math.floor(rank));
	const onboarding = createOnboardingRankDefinition(rank);
	return {
		rank,
		totalXpRequired,
		colonyCap: onboarding.colonyCap,
		contractRules: {
			visibleSlots: rank >= 3 ? 2 + Math.floor((effectiveRank - 1) / 5) : 0,
			activeLimit: rank >= 3 ? 1 + Math.floor((effectiveRank - 1) / 5) : 0,
			difficultyTier: rank >= 3 ? 1 + Math.floor((effectiveRank - 1) / 5) : 1,
		},
		raidRules: onboarding.raidRules,
		features: onboarding.features,
		facilityAccess: onboarding.facilityAccess,
		shipAccess: onboarding.shipAccess,
		missionAccess: onboarding.missionAccess,
	};
}

export const RANK_DEFINITIONS = Array.from({ length: 26 }, (_, rank) => createRankDefinition(rank));

export function getRankDefinition(rank: number) {
	const safeRank = Math.max(0, Math.floor(rank));
	return RANK_DEFINITIONS[Math.min(safeRank, RANK_DEFINITIONS.length - 1)] ?? RANK_DEFINITIONS[0]!;
}

export function getRankForXpTotal(rankXpTotal: number) {
	const safeXp = Math.max(0, Math.floor(rankXpTotal));
	let resolved = RANK_DEFINITIONS[0]!;
	for (const candidate of RANK_DEFINITIONS) {
		if (candidate.totalXpRequired > safeXp) {
			break;
		}
		resolved = candidate;
	}
	return resolved;
}

export function getProgressionOverview(args: {
	questTrackerCount?: number;
	rankXpTotal: number;
}): ProgressionOverview {
	const definition = getRankForXpTotal(args.rankXpTotal);
	const nextRank = definition.rank + 1;
	const nextDefinition =
		nextRank < RANK_DEFINITIONS.length ? (RANK_DEFINITIONS[nextRank] ?? null) : null;
	return {
		rank: definition.rank,
		rankXpTotal: Math.max(0, Math.floor(args.rankXpTotal)),
		xpIntoCurrentRank: Math.max(0, Math.floor(args.rankXpTotal) - definition.totalXpRequired),
		xpToNextRank:
			nextDefinition === null
				? null
				: Math.max(0, nextDefinition.totalXpRequired - Math.max(0, Math.floor(args.rankXpTotal))),
		nextRank: nextDefinition?.rank ?? null,
		nextRankXpRequired: nextDefinition?.totalXpRequired ?? null,
		features: definition.features,
		facilityAccess: definition.facilityAccess,
		shipAccess: definition.shipAccess,
		missionAccess: definition.missionAccess,
		contractRules: definition.contractRules,
		raidRules: definition.raidRules,
		colonyCap: definition.colonyCap,
		questTrackerCount: Math.max(0, Math.floor(args.questTrackerCount ?? 0)),
	};
}

export const QUEST_DEFINITIONS: QuestDefinition[] = [
	{
		id: "main_welcome_to_nullvector",
		version: 1,
		category: "main",
		order: 1,
		title: "Welcome to NullVector",
		description: "Claim your bootstrap package and prepare your first colony.",
		bindingStrategy: "activeColony",
		prerequisites: [],
		objectives: [],
		rewards: [
			{ kind: "resources", resources: { alloy: 5_000, crystal: 5_000, fuel: 5_000 } },
			{ kind: "xp", amount: 20 },
		],
	},
	{
		id: "main_scaling_production",
		version: 1,
		category: "main",
		order: 2,
		title: "Scaling Production",
		description: "Raise all three resource producers on your starter colony to level 4.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_welcome_to_nullvector" }],
		objectives: [
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "alloyMineLevel",
				minLevel: 4,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "crystalMineLevel",
				minLevel: 4,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "fuelRefineryLevel",
				minLevel: 4,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 30 }],
	},
	{
		id: "main_increasing_storage_capacity",
		version: 1,
		category: "main",
		order: 3,
		title: "Increasing Storage Capacity",
		description: "Upgrade each storage building to level 2 on your starter colony.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_scaling_production" }],
		objectives: [
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "alloyStorageLevel",
				minLevel: 2,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "crystalStorageLevel",
				minLevel: 2,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "fuelStorageLevel",
				minLevel: 2,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 25 }],
	},
	{
		id: "main_restore_power_balance",
		version: 1,
		category: "main",
		order: 4,
		title: "Restore Power Balance",
		description: "Upgrade the power plant to level 4 to stabilize your colony grid.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_increasing_storage_capacity" }],
		objectives: [
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "powerPlantLevel",
				minLevel: 4,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 25 }],
	},
	{
		id: "main_build_robotics_hub",
		version: 1,
		category: "main",
		order: 5,
		title: "Build Robotics Hub",
		description: "Construct a Robotics Hub on your starter colony.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_restore_power_balance" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "robotics_hub",
				minLevel: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 30 }],
		highlights: [{ target: "tab-facilities", hint: "Open Facilities to build the Robotics Hub" }],
	},
	{
		id: "main_upgrade_robotics_hub",
		version: 1,
		category: "main",
		order: 6,
		title: "Upgrade Robotics Hub",
		description: "Increase the Robotics Hub to level 2.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_build_robotics_hub" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "robotics_hub",
				minLevel: 2,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 30 }],
		highlights: [{ target: "tab-facilities" }],
	},
	{
		id: "main_establish_defense_grid",
		version: 1,
		category: "main",
		order: 7,
		title: "Establish Defense Grid",
		description: "Bring your Defense Grid online.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_upgrade_robotics_hub" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "defense_grid",
				minLevel: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 40 }],
		highlights: [{ target: "tab-defenses", hint: "Open Defenses to establish your defense grid" }],
	},
	{
		id: "main_arm_missile_batteries",
		version: 1,
		category: "main",
		order: 8,
		title: "Arm Missile Batteries",
		description: "Build five missile batteries to prepare for a hostile incursion.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_establish_defense_grid" }],
		objectives: [
			{
				kind: "defenseCountAtLeast",
				defenseKey: "missileBattery",
				minCount: 5,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 40 }],
		effects: [{ kind: "spawnTutorialRaid" }],
		highlights: [{ target: "tab-defenses" }],
	},
	{
		id: "main_hold_the_line",
		version: 1,
		category: "main",
		order: 9,
		title: "Hold The Line",
		description: "Successfully defend your colony from the incoming raid.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_arm_missile_batteries" }],
		objectives: [
			{
				kind: "raidDefenseSuccessCountAtLeast",
				minCount: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 100 }],
		highlights: [{ target: "tab-defenses" }],
	},
	{
		id: "main_build_shipyard",
		version: 1,
		category: "main",
		order: 10,
		title: "Build Shipyard",
		description: "Construct a Shipyard on your starter colony.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_hold_the_line" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "shipyard",
				minLevel: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 30 }],
		highlights: [{ target: "tab-facilities", hint: "Open Facilities to build your shipyard" }],
	},
	{
		id: "main_upgrade_shipyard",
		version: 1,
		category: "main",
		order: 11,
		title: "Upgrade Shipyard",
		description: "Upgrade the Shipyard to level 2.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_build_shipyard" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "shipyard",
				minLevel: 2,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 30 }],
		highlights: [{ target: "tab-facilities" }],
	},
	{
		id: "main_assemble_interceptors",
		version: 1,
		category: "main",
		order: 12,
		title: "Assemble Interceptors",
		description: "Build five interceptors to form your first combat wing.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_upgrade_shipyard" }],
		objectives: [
			{
				kind: "shipCountAtLeast",
				shipKey: "interceptor",
				minCount: 5,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 40 }],
		highlights: [{ target: "tab-shipyard" }],
	},
	{
		id: "main_complete_first_contract",
		version: 1,
		category: "main",
		order: 13,
		title: "Complete First Contract",
		description: "Send your interceptors on a contract and return successfully.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_assemble_interceptors" }],
		objectives: [
			{
				kind: "contractSuccessCountAtLeast",
				minCount: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 40 }],
		highlights: [{ target: "tab-contracts", hint: "Open Contracts to take your first contract" }],
	},
	{
		id: "main_profit_from_conflict",
		version: 1,
		category: "main",
		order: 14,
		title: "Profit From Conflict",
		description: "Bring back at least 1,000 resources from completed contracts.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_complete_first_contract" }],
		objectives: [
			{
				kind: "contractRewardResourcesAtLeast",
				minAmount: 1_000,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 56 }],
		highlights: [{ target: "tab-contracts" }],
	},
	{
		id: "main_build_small_cargo",
		version: 1,
		category: "main",
		order: 15,
		title: "Build Small Cargo",
		description: "Construct a small cargo ship for logistics support.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_profit_from_conflict" }],
		objectives: [
			{
				kind: "shipCountAtLeast",
				shipKey: "smallCargo",
				minCount: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 50 }],
		highlights: [{ target: "tab-shipyard" }],
	},
	{
		id: "main_expand_shipyard_for_colonization",
		version: 1,
		category: "main",
		order: 16,
		title: "Expand Shipyard For Colonization",
		description: "Upgrade the Shipyard to level 5 to support colony ship construction.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_build_small_cargo" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "shipyard",
				minLevel: 5,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 90 }],
		highlights: [{ target: "tab-shipyard" }],
	},
	{
		id: "main_commission_colony_ship",
		version: 1,
		category: "main",
		order: 17,
		title: "Commission Colony Ship",
		description: "Build your first colony ship.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_expand_shipyard_for_colonization" }],
		objectives: [
			{
				kind: "shipCountAtLeast",
				shipKey: "colonyShip",
				minCount: 1,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 134 }],
		highlights: [{ target: "tab-shipyard" }],
	},
	{
		id: "main_found_second_colony",
		version: 1,
		category: "main",
		order: 18,
		title: "Found Second Colony",
		description: "Send a colony ship to establish a second colony.",
		bindingStrategy: "none",
		prerequisites: [{ kind: "questClaimed", questId: "main_commission_colony_ship" }],
		objectives: [
			{
				kind: "colonizationSuccessCountAtLeast",
				minCount: 1,
			},
		],
		rewards: [{ kind: "xp", amount: 80 }],
		highlights: [{ target: "tab-fleet" }],
	},
	{
		id: "main_stabilize_new_outpost",
		version: 1,
		category: "main",
		order: 19,
		title: "Stabilize New Outpost",
		description: "Bring the new colony's production buildings and power online.",
		bindingStrategy: "newestPlayerColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_found_second_colony" }],
		objectives: [
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "alloyMineLevel",
				minLevel: 2,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "crystalMineLevel",
				minLevel: 2,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "fuelRefineryLevel",
				minLevel: 2,
				scope: "boundColony",
			},
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "powerPlantLevel",
				minLevel: 2,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 80 }],
	},
	{
		id: "main_open_supply_line",
		version: 1,
		category: "main",
		order: 20,
		title: "Open Supply Line",
		description: "Deliver resources to the new colony using a transport mission.",
		bindingStrategy: "newestPlayerColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_stabilize_new_outpost" }],
		objectives: [
			{
				kind: "transportDeliveryCountAtLeast",
				minCount: 1,
				scope: "boundColony",
			},
			{
				kind: "transportDeliveredResourcesAtLeast",
				minAmount: 2_500,
				scope: "boundColony",
			},
		],
		rewards: [{ kind: "xp", amount: 90 }],
	},
];

export function getQuestDefinition(questId: QuestId) {
	return QUEST_DEFINITIONS.find((quest) => quest.id === questId) ?? null;
}

function normalizeQuestStateStatus(status: QuestStateStatus | QuestStatus): QuestStateStatus {
	return status === "claimed" ? "claimed" : "active";
}

export function buildQuestEvaluationContextFromFacts(
	facts: QuestClientFacts,
): QuestEvaluationContext {
	const contractSuccessCountByColony: Record<string, number> = {};
	const contractRewardResourcesByColony: Record<string, number> = {};
	const raidDefenseSuccessCountByColony: Record<string, number> = {};
	const transportDeliveryCountByColony: Record<string, number> = {};
	const transportDeliveredResourcesByColony: Record<string, number> = {};

	for (const metric of facts.colonyMetrics) {
		contractSuccessCountByColony[metric.colonyId] = metric.contractSuccessCount;
		contractRewardResourcesByColony[metric.colonyId] = metric.contractRewardResourcesTotal;
		raidDefenseSuccessCountByColony[metric.colonyId] = metric.raidDefenseSuccessCount;
		transportDeliveryCountByColony[metric.colonyId] = metric.transportDeliveryCount;
		transportDeliveredResourcesByColony[metric.colonyId] = metric.transportDeliveredResourcesTotal;
	}

	return {
		colonies: facts.colonies.map((colony) => ({
			colonyId: colony.colonyId,
			buildings: colony.buildings,
			facilities: colony.facilities,
			defenses: colony.defenses,
			ships: colony.ships,
		})),
		colonyCount: facts.colonyCount,
		colonizationSuccessCount: facts.colonizationSuccessCount,
		contractRewardResourcesByColony,
		contractSuccessCountByColony,
		raidDefenseSuccessCountByColony,
		transportDeliveredResourcesByColony,
		transportDeliveryCountByColony,
	};
}

function deriveQuestItemStatus(args: {
	evaluation: QuestEvaluationResult;
	row: QuestStateRowView;
}): QuestStatus {
	if (normalizeQuestStateStatus(args.row.status) === "claimed") {
		return "claimed";
	}
	return args.evaluation.complete ? "claimable" : "active";
}

export function deriveQuestTrackerItems(args: {
	facts: QuestClientFacts;
	questDefinitions?: QuestDefinition[];
	questRows: QuestStateRowView[];
}): QuestTrackerItem[] {
	const context = buildQuestEvaluationContextFromFacts(args.facts);
	const definitions = args.questDefinitions ?? QUEST_DEFINITIONS;

	return args.questRows
		.filter((row) => normalizeQuestStateStatus(row.status) !== "claimed")
		.map((row) => {
			const definition = definitions.find((quest) => quest.id === row.questId);
			if (!definition) {
				return null;
			}
			const evaluation = evaluateQuestDefinition({
				quest: definition,
				context,
				bindings: row.bindings,
			});
			const status = deriveQuestItemStatus({ evaluation, row });
			return {
				id: definition.id,
				title: definition.title,
				description: definition.description,
				category: definition.category,
				order: definition.order,
				status,
				claimable: status === "claimable",
				rewards: definition.rewards,
				objectives: evaluation.objectives,
			} satisfies QuestTrackerItem;
		})
		.filter((item): item is QuestTrackerItem => item !== null)
		.sort((left, right) => left.order - right.order);
}

export function deriveQuestTimelineItems(args: {
	facts: QuestClientFacts;
	playerRank: number;
	questDefinitions?: QuestDefinition[];
	questRows: QuestStateRowView[];
}): QuestTimelineItem[] {
	const definitions = args.questDefinitions ?? QUEST_DEFINITIONS;
	const context = buildQuestEvaluationContextFromFacts(args.facts);
	const rowsByQuestId = new Map(args.questRows.map((row) => [row.questId, row]));
	const claimedQuestIds = new Set(
		args.questRows
			.filter((row) => normalizeQuestStateStatus(row.status) === "claimed")
			.map((row) => row.questId),
	);
	const questTitleById = new Map(
		definitions.map((definition) => [definition.id, definition.title]),
	);

	return definitions
		.map((definition) => {
			const row = rowsByQuestId.get(definition.id);
			const prerequisites = definition.prerequisites.map((prerequisite) => {
				if (prerequisite.kind === "questClaimed") {
					return {
						questId: prerequisite.questId,
						title: questTitleById.get(prerequisite.questId) ?? prerequisite.questId,
						satisfied: claimedQuestIds.has(prerequisite.questId),
					} satisfies QuestTimelinePrerequisite;
				}
				return {
					questId: `rank:${prerequisite.rank}`,
					title: `Reach rank ${prerequisite.rank}`,
					satisfied: args.playerRank >= prerequisite.rank,
				} satisfies QuestTimelinePrerequisite;
			});
			const prerequisitesSatisfied = prerequisites.every((prerequisite) => prerequisite.satisfied);
			const previewBindings =
				row?.bindings ??
				(definition.bindingStrategy === "newestPlayerColony"
					? { colonyId: args.facts.colonies[args.facts.colonies.length - 1]?.colonyId }
					: definition.bindingStrategy === "activeColony"
						? null
						: {});
			const evaluation = evaluateQuestDefinition({
				quest: definition,
				context,
				bindings: previewBindings ?? undefined,
			});
			const status: QuestTimelineStatus =
				row !== undefined
					? deriveQuestItemStatus({
							evaluation,
							row,
						})
					: prerequisitesSatisfied
						? "upcoming"
						: "locked";
			return {
				id: definition.id,
				title: definition.title,
				description: definition.description,
				category: definition.category,
				order: definition.order,
				status,
				claimable: status === "claimable",
				rewards: definition.rewards,
				objectives: evaluation.objectives,
				prerequisites,
			} satisfies QuestTimelineItem;
		})
		.sort((left, right) => left.order - right.order);
}

function clampProgress(current: number, required: number): QuestObjectiveProgress {
	return {
		current: Math.max(0, Math.floor(current)),
		required: Math.max(1, Math.floor(required)),
		complete: current >= required,
	};
}

function resolveObjectiveColonies(args: {
	bindings: QuestBindings;
	context: QuestEvaluationContext;
	scope: ObjectiveScope | undefined;
}) {
	if (args.scope === "boundColony") {
		if (!args.bindings.colonyId) {
			return [];
		}
		return args.context.colonies.filter((colony) => colony.colonyId === args.bindings.colonyId);
	}
	return args.context.colonies;
}

function resolveBoundMetricValue(args: {
	bindings: QuestBindings;
	byColony: Record<string, number>;
	scope: ObjectiveScope | undefined;
}) {
	if (args.scope === "boundColony") {
		if (!args.bindings.colonyId) {
			return 0;
		}
		return args.byColony[args.bindings.colonyId] ?? 0;
	}
	return Object.values(args.byColony).reduce((sum, value) => sum + value, 0);
}

export function evaluateQuestObjective(args: {
	bindings: QuestBindings;
	context: QuestEvaluationContext;
	objective: QuestObjectiveDefinition;
}): QuestObjectiveProgress {
	switch (args.objective.kind) {
		case "buildingLevelAtLeast": {
			const objective = args.objective;
			const colonies = resolveObjectiveColonies({
				bindings: args.bindings,
				context: args.context,
				scope: objective.scope,
			});
			const current = colonies.reduce((max, colony) => {
				return Math.max(max, colony.buildings[objective.buildingKey] ?? 0);
			}, 0);
			return clampProgress(current, objective.minLevel);
		}
		case "facilityLevelAtLeast": {
			const objective = args.objective;
			const colonies = resolveObjectiveColonies({
				bindings: args.bindings,
				context: args.context,
				scope: objective.scope,
			});
			const current = colonies.reduce((max, colony) => {
				return Math.max(max, colony.facilities[objective.facilityKey] ?? 0);
			}, 0);
			return clampProgress(current, objective.minLevel);
		}
		case "shipCountAtLeast": {
			const objective = args.objective;
			const colonies = resolveObjectiveColonies({
				bindings: args.bindings,
				context: args.context,
				scope: objective.scope,
			});
			const current = colonies.reduce((total, colony) => {
				return total + (colony.ships[objective.shipKey] ?? 0);
			}, 0);
			return clampProgress(current, objective.minCount);
		}
		case "defenseCountAtLeast": {
			const objective = args.objective;
			const colonies = resolveObjectiveColonies({
				bindings: args.bindings,
				context: args.context,
				scope: objective.scope,
			});
			const current = colonies.reduce((total, colony) => {
				return total + (colony.defenses[objective.defenseKey] ?? 0);
			}, 0);
			return clampProgress(current, objective.minCount);
		}
		case "colonyCountAtLeast":
			return clampProgress(args.context.colonyCount, args.objective.minCount);
		case "contractSuccessCountAtLeast": {
			const objective = args.objective;
			return clampProgress(
				resolveBoundMetricValue({
					bindings: args.bindings,
					byColony: args.context.contractSuccessCountByColony,
					scope: objective.scope,
				}),
				objective.minCount,
			);
		}
		case "contractRewardResourcesAtLeast": {
			const objective = args.objective;
			return clampProgress(
				resolveBoundMetricValue({
					bindings: args.bindings,
					byColony: args.context.contractRewardResourcesByColony,
					scope: objective.scope,
				}),
				objective.minAmount,
			);
		}
		case "raidDefenseSuccessCountAtLeast": {
			const objective = args.objective;
			return clampProgress(
				resolveBoundMetricValue({
					bindings: args.bindings,
					byColony: args.context.raidDefenseSuccessCountByColony,
					scope: objective.scope,
				}),
				objective.minCount,
			);
		}
		case "colonizationSuccessCountAtLeast":
			return clampProgress(args.context.colonizationSuccessCount, args.objective.minCount);
		case "transportDeliveryCountAtLeast": {
			const objective = args.objective;
			return clampProgress(
				resolveBoundMetricValue({
					bindings: args.bindings,
					byColony: args.context.transportDeliveryCountByColony,
					scope: objective.scope,
				}),
				objective.minCount,
			);
		}
		case "transportDeliveredResourcesAtLeast": {
			const objective = args.objective;
			return clampProgress(
				resolveBoundMetricValue({
					bindings: args.bindings,
					byColony: args.context.transportDeliveredResourcesByColony,
					scope: objective.scope,
				}),
				objective.minAmount,
			);
		}
	}
}

export function evaluateQuestDefinition(args: {
	bindings?: QuestBindings | null;
	context: QuestEvaluationContext;
	quest: QuestDefinition;
}): QuestEvaluationResult {
	if (args.bindings === null) {
		const objectives = args.quest.objectives.map((objective) =>
			clampProgress(
				0,
				"minAmount" in objective
					? objective.minAmount
					: "minCount" in objective
						? objective.minCount
						: "minLevel" in objective
							? objective.minLevel
							: 1,
			),
		);
		return {
			objectives,
			complete: false,
		};
	}
	const bindings = args.bindings ?? {};
	const objectives = args.quest.objectives.map((objective) =>
		evaluateQuestObjective({
			bindings,
			context: args.context,
			objective,
		}),
	);
	return {
		objectives,
		complete: objectives.every((objective) => objective.complete),
	};
}
