import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";

export const FEATURE_KEYS = [
	"contracts",
	"raids",
	"colonization",
	"fleet",
	"shipyard",
	"defenses",
	"notifications",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureAccessState = "hidden" | "locked" | "unlocked";
export type QuestCategory = "main" | "system" | "side";
export type QuestStatus = "active" | "claimable" | "claimed";
export type QuestBindingStrategy = "none" | "activeColony";
export type ObjectiveScope = "player" | "boundColony";

export type ContractProgressionRules = {
	activeLimit: number;
	difficultyTier: number;
	visibleSlots: number;
};

export type RaidProgressionRules = {
	difficultyTier: number;
	enabled: boolean;
};

export type ProgressionFeatureMap = Record<FeatureKey, FeatureAccessState>;

export type RankDefinition = {
	colonyCap: number;
	contractRules: ContractProgressionRules;
	features: ProgressionFeatureMap;
	raidRules: RaidProgressionRules;
	rank: number;
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

export type ColonyCountObjective = {
	kind: "colonyCountAtLeast";
	minCount: number;
};

export type QuestObjectiveDefinition =
	| BuildingLevelObjective
	| FacilityLevelObjective
	| ShipCountObjective
	| ColonyCountObjective;

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

export type QuestDefinition = {
	bindingStrategy: QuestBindingStrategy;
	category: QuestCategory;
	description: string;
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
	facilities: Partial<Record<FacilityKey, number>>;
	ships: Partial<Record<ShipKey, number>>;
};

export type QuestEvaluationContext = {
	colonies: QuestEvaluationColony[];
	colonyCount: number;
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
	nextRank: number | null;
	nextRankXpRequired: number | null;
	questTrackerCount: number;
	raidRules: RaidProgressionRules;
	rank: number;
	rankXpTotal: number;
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

export const QUEST_IDS = [
	"main_raise_alloy_output",
	"main_upgrade_shipyard",
	"main_build_interceptor",
	"main_expand_to_second_colony",
] as const;

export type QuestId = (typeof QUEST_IDS)[number];

const DEFAULT_FEATURES: ProgressionFeatureMap = {
	contracts: "unlocked",
	raids: "locked",
	colonization: "locked",
	fleet: "unlocked",
	shipyard: "unlocked",
	defenses: "unlocked",
	notifications: "unlocked",
};

function nextRankXpRequirement(rank: number) {
	if (rank <= 0) {
		return 100;
	}
	return Math.max(100, Math.round(100 * Math.pow(1.4, Math.max(0, rank - 1))));
}

function createRankDefinition(rank: number): RankDefinition {
	let totalXpRequired = 0;
	for (let current = 0; current < rank; current += 1) {
		totalXpRequired += nextRankXpRequirement(current);
	}
	const effectiveRank = Math.max(1, Math.floor(rank));
	return {
		rank,
		totalXpRequired,
		colonyCap: rank >= 5 ? 2 : 1,
		contractRules: {
			visibleSlots: 2 + Math.floor((effectiveRank - 1) / 5),
			activeLimit: 1 + Math.floor((effectiveRank - 1) / 5),
			difficultyTier: 1 + Math.floor((effectiveRank - 1) / 5),
		},
		raidRules: {
			enabled: rank >= 5,
			difficultyTier: 1 + Math.floor((effectiveRank - 1) / 5),
		},
		features: {
			...DEFAULT_FEATURES,
			colonization: rank >= 5 ? "unlocked" : "locked",
			raids: rank >= 5 ? "unlocked" : "locked",
		},
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
		contractRules: definition.contractRules,
		raidRules: definition.raidRules,
		colonyCap: definition.colonyCap,
		questTrackerCount: Math.max(0, Math.floor(args.questTrackerCount ?? 0)),
	};
}

export const QUEST_DEFINITIONS: QuestDefinition[] = [
	{
		id: "main_raise_alloy_output",
		version: 1,
		category: "main",
		order: 1,
		title: "Expand Alloy Output",
		description: "Raise the alloy mine on your starter colony to level 2.",
		bindingStrategy: "activeColony",
		prerequisites: [],
		objectives: [
			{
				kind: "buildingLevelAtLeast",
				buildingKey: "alloyMineLevel",
				minLevel: 2,
				scope: "boundColony",
			},
		],
		rewards: [
			{ kind: "xp", amount: 80 },
			{ kind: "resources", resources: { alloy: 250, crystal: 100, fuel: 0 } },
		],
	},
	{
		id: "main_upgrade_shipyard",
		version: 1,
		category: "main",
		order: 2,
		title: "Bring The Yard Online",
		description: "Upgrade the shipyard on your starter colony to level 1.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_raise_alloy_output" }],
		objectives: [
			{
				kind: "facilityLevelAtLeast",
				facilityKey: "shipyard",
				minLevel: 1,
				scope: "boundColony",
			},
		],
		rewards: [
			{ kind: "xp", amount: 120 },
			{ kind: "credits", amount: 50 },
		],
	},
	{
		id: "main_build_interceptor",
		version: 1,
		category: "main",
		order: 3,
		title: "Launch A Combat Hull",
		description: "Build your first interceptor on the starter colony.",
		bindingStrategy: "activeColony",
		prerequisites: [{ kind: "questClaimed", questId: "main_upgrade_shipyard" }],
		objectives: [
			{
				kind: "shipCountAtLeast",
				shipKey: "interceptor",
				minCount: 1,
				scope: "boundColony",
			},
		],
		rewards: [
			{ kind: "xp", amount: 180 },
			{ kind: "resources", resources: { alloy: 0, crystal: 200, fuel: 100 } },
		],
	},
	{
		id: "main_expand_to_second_colony",
		version: 1,
		category: "main",
		order: 4,
		title: "Claim A Second World",
		description: "Expand your empire to two colonies.",
		bindingStrategy: "none",
		prerequisites: [{ kind: "questClaimed", questId: "main_build_interceptor" }],
		objectives: [{ kind: "colonyCountAtLeast", minCount: 2 }],
		rewards: [
			{ kind: "xp", amount: 250 },
			{ kind: "credits", amount: 150 },
		],
	},
];

export function getQuestDefinition(questId: QuestId) {
	return QUEST_DEFINITIONS.find((quest) => quest.id === questId) ?? null;
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
	if (args.scope === "boundColony" && args.bindings.colonyId) {
		return args.context.colonies.filter((colony) => colony.colonyId === args.bindings.colonyId);
	}
	return args.context.colonies;
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
		case "colonyCountAtLeast":
			return clampProgress(args.context.colonyCount, args.objective.minCount);
	}
}

export function evaluateQuestDefinition(args: {
	bindings?: QuestBindings;
	context: QuestEvaluationContext;
	quest: QuestDefinition;
}): QuestEvaluationResult {
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
