import type { DefenseKey } from "./defenses";
import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";
import type { ResourceKey, UnlockRule } from "./types";

import { isUnlockSatisfied } from "./unlocks";

export const RESEARCH_BRANCH_KEYS = [
	"applied_industry",
	"military_systems",
	"expansion_logistics",
	"scientific_infrastructure",
] as const;

export const META_MATTER_RARITIES = ["common", "rare", "mythic"] as const;

export type ResearchBranchKey = (typeof RESEARCH_BRANCH_KEYS)[number];
export type MetaMatterRarity = (typeof META_MATTER_RARITIES)[number];

export type MetaMatterBundle = Record<MetaMatterRarity, number>;
export type ResearchLevelMap = Record<string, number>;

export type ResearchEffect =
	| { kind: "unlock_ship"; shipKey: ShipKey }
	| { kind: "unlock_defense"; defenseKey: DefenseKey }
	| { kind: "unlock_facility"; facilityKey: FacilityKey }
	| { kind: "unlock_building"; buildingKey: BuildingKey }
	| {
			kind: "resource_production_multiplier";
			resource: Exclude<ResourceKey, "energy">;
			multiplier: number;
	  }
	| {
			kind: "resource_storage_multiplier";
			resource: Exclude<ResourceKey, "energy">;
			multiplier: number;
	  }
	| { kind: "building_upgrade_time_multiplier"; multiplier: number; buildingKey?: BuildingKey }
	| { kind: "facility_upgrade_time_multiplier"; multiplier: number; facilityKey?: FacilityKey }
	| { kind: "research_duration_multiplier"; multiplier: number }
	| { kind: "ship_build_time_multiplier"; multiplier: number; shipKey?: ShipKey }
	| { kind: "defense_build_time_multiplier"; multiplier: number; defenseKey?: DefenseKey }
	| { kind: "fleet_fuel_cost_multiplier"; multiplier: number }
	| { kind: "cargo_capacity_multiplier"; multiplier: number }
	| { kind: "building_max_level_bonus"; buildingKey: BuildingKey; amount: number }
	| { kind: "facility_max_level_bonus"; facilityKey: FacilityKey; amount: number }
	| { kind: "combined_research_capacity" }
	| { kind: "meta_matter_reward_multiplier"; multiplier: number; rarity?: MetaMatterRarity };

export type ResearchNodeCost = {
	metaMatter: Partial<MetaMatterBundle>;
	resources?: Partial<ResourceBucket>;
	seconds: number;
};

export type ResearchNodeDefinition = {
	id: ResearchKey;
	name: string;
	branch: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4 | 5;
	description: string;
	position: { x: number; y: number };
	prerequisites: ResearchKey[];
	maxLevel: number;
	requiredResearchFacilityLevel: number;
	requiredCombinedResearchCapacity?: number;
	costs: ResearchNodeCost[];
	effects: ResearchEffect[];
};

export type ResearchVisibility = "hidden" | "silhouette" | "visible";

export type ResearchModifierSnapshot = {
	unlockedShips: Set<ShipKey>;
	unlockedDefenses: Set<DefenseKey>;
	unlockedFacilities: Set<FacilityKey>;
	unlockedBuildings: Set<BuildingKey>;
	resourceProductionMultipliers: Record<Exclude<ResourceKey, "energy">, number>;
	resourceStorageMultipliers: Record<Exclude<ResourceKey, "energy">, number>;
	buildingUpgradeTimeMultipliers: Partial<Record<BuildingKey, number>>;
	globalBuildingUpgradeTimeMultiplier: number;
	facilityUpgradeTimeMultipliers: Partial<Record<FacilityKey, number>>;
	globalFacilityUpgradeTimeMultiplier: number;
	researchDurationMultiplier: number;
	shipBuildTimeMultipliers: Partial<Record<ShipKey, number>>;
	globalShipBuildTimeMultiplier: number;
	defenseBuildTimeMultipliers: Partial<Record<DefenseKey, number>>;
	globalDefenseBuildTimeMultiplier: number;
	fleetFuelCostMultiplier: number;
	cargoCapacityMultiplier: number;
	buildingMaxLevelBonuses: Partial<Record<BuildingKey, number>>;
	facilityMaxLevelBonuses: Partial<Record<FacilityKey, number>>;
	metaMatterRewardMultipliers: Partial<Record<MetaMatterRarity, number>>;
	globalMetaMatterRewardMultiplier: number;
	combinedResearchCapacityUnlocked: boolean;
};

function emptyMetaMatterBundle(): MetaMatterBundle {
	return {
		common: 0,
		rare: 0,
		mythic: 0,
	};
}

function multiplyIntoRecord<T extends string>(
	record: Partial<Record<T, number>>,
	key: T,
	value: number,
) {
	record[key] = (record[key] ?? 1) * value;
}

const DEFAULT_RESOURCE_MULTIPLIERS = {
	alloy: 1,
	crystal: 1,
	fuel: 1,
} satisfies Record<Exclude<ResourceKey, "energy">, number>;

export const DEFAULT_RESEARCH_TREE: readonly ResearchNodeDefinition[] = [
	{
		id: "archiveCompression",
		name: "Archive Compression",
		branch: "scientific_infrastructure",
		tier: 1,
		description: "Improves baseline research throughput.",
		position: { x: 0, y: 0 },
		prerequisites: [],
		maxLevel: 3,
		requiredResearchFacilityLevel: 1,
		costs: [
			{ metaMatter: { common: 4 }, resources: { alloy: 300, crystal: 200 }, seconds: 120 },
			{ metaMatter: { common: 7 }, resources: { alloy: 500, crystal: 300 }, seconds: 240 },
			{
				metaMatter: { common: 12, rare: 1 },
				resources: { alloy: 800, crystal: 500 },
				seconds: 480,
			},
		],
		effects: [{ kind: "research_duration_multiplier", multiplier: 0.94 }],
	},
	{
		id: "parallelInquiry",
		name: "Parallel Inquiry",
		branch: "scientific_infrastructure",
		tier: 2,
		description: "Makes facility upgrades complete faster.",
		position: { x: 160, y: 0 },
		prerequisites: ["archiveCompression"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 2,
		costs: [
			{ metaMatter: { common: 10 }, resources: { alloy: 800, crystal: 600 }, seconds: 360 },
			{
				metaMatter: { common: 15, rare: 2 },
				resources: { alloy: 1200, crystal: 900 },
				seconds: 720,
			},
		],
		effects: [{ kind: "facility_upgrade_time_multiplier", multiplier: 0.94 }],
	},
	{
		id: "federatedDatabanks",
		name: "Federated Databanks",
		branch: "scientific_infrastructure",
		tier: 3,
		description: "Raises the practical ceiling for research infrastructure.",
		position: { x: 320, y: 0 },
		prerequisites: ["parallelInquiry"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 4,
		costs: [
			{
				metaMatter: { common: 20, rare: 4 },
				resources: { alloy: 1800, crystal: 1600 },
				seconds: 1200,
			},
		],
		effects: [{ kind: "facility_max_level_bonus", facilityKey: "research_directorate", amount: 5 }],
	},
	{
		id: "unifiedTheoryInitiative",
		name: "Unified Theory Initiative",
		branch: "scientific_infrastructure",
		tier: 4,
		description: "Further improves research timing for developed empires.",
		position: { x: 480, y: 0 },
		prerequisites: ["federatedDatabanks"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 6,
		costs: [
			{
				metaMatter: { rare: 8 },
				resources: { alloy: 2500, crystal: 2600, fuel: 600 },
				seconds: 1800,
			},
			{
				metaMatter: { rare: 12, mythic: 1 },
				resources: { alloy: 3600, crystal: 3400, fuel: 900 },
				seconds: 3600,
			},
		],
		effects: [{ kind: "research_duration_multiplier", multiplier: 0.92 }],
	},
	{
		id: "interstellarResearchNetwork",
		name: "Interstellar Research Network",
		branch: "scientific_infrastructure",
		tier: 5,
		description: "Allows select late-game research to use combined research capacity.",
		position: { x: 640, y: 0 },
		prerequisites: ["unifiedTheoryInitiative"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 8,
		costs: [
			{
				metaMatter: { rare: 18, mythic: 3 },
				resources: { alloy: 5000, crystal: 4500, fuel: 1500 },
				seconds: 5400,
			},
		],
		effects: [{ kind: "combined_research_capacity" }],
	},
	{
		id: "automatedSmelting",
		name: "Automated Smelting",
		branch: "applied_industry",
		tier: 1,
		description: "Improves alloy output.",
		position: { x: 0, y: 180 },
		prerequisites: [],
		maxLevel: 3,
		requiredResearchFacilityLevel: 1,
		costs: [
			{ metaMatter: { common: 4 }, resources: { alloy: 250, crystal: 120 }, seconds: 120 },
			{ metaMatter: { common: 7 }, resources: { alloy: 380, crystal: 180 }, seconds: 240 },
			{ metaMatter: { common: 10 }, resources: { alloy: 520, crystal: 260 }, seconds: 420 },
		],
		effects: [{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.05 }],
	},
	{
		id: "crystalLatticeRefinement",
		name: "Crystal Lattice Refinement",
		branch: "applied_industry",
		tier: 1,
		description: "Improves crystal output.",
		position: { x: 160, y: 180 },
		prerequisites: [],
		maxLevel: 3,
		requiredResearchFacilityLevel: 1,
		costs: [
			{ metaMatter: { common: 4 }, resources: { alloy: 180, crystal: 250 }, seconds: 120 },
			{ metaMatter: { common: 7 }, resources: { alloy: 260, crystal: 380 }, seconds: 240 },
			{ metaMatter: { common: 10 }, resources: { alloy: 360, crystal: 520 }, seconds: 420 },
		],
		effects: [{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.05 }],
	},
	{
		id: "fuelCompression",
		name: "Fuel Compression",
		branch: "applied_industry",
		tier: 2,
		description: "Improves fuel storage capacity.",
		position: { x: 320, y: 180 },
		prerequisites: ["automatedSmelting", "crystalLatticeRefinement"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 2,
		costs: [
			{ metaMatter: { common: 9 }, resources: { alloy: 500, crystal: 420 }, seconds: 360 },
			{
				metaMatter: { common: 14, rare: 1 },
				resources: { alloy: 750, crystal: 620 },
				seconds: 720,
			},
		],
		effects: [{ kind: "resource_storage_multiplier", resource: "fuel", multiplier: 1.12 }],
	},
	{
		id: "modularAssemblyStandards",
		name: "Modular Assembly Standards",
		branch: "applied_industry",
		tier: 3,
		description: "Reduces building upgrade times.",
		position: { x: 480, y: 180 },
		prerequisites: ["fuelCompression"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 3,
		costs: [
			{
				metaMatter: { common: 14, rare: 2 },
				resources: { alloy: 900, crystal: 700 },
				seconds: 900,
			},
			{
				metaMatter: { common: 18, rare: 3 },
				resources: { alloy: 1300, crystal: 980 },
				seconds: 1500,
			},
		],
		effects: [{ kind: "building_upgrade_time_multiplier", multiplier: 0.93 }],
	},
	{
		id: "distributedRobotics",
		name: "Distributed Robotics",
		branch: "applied_industry",
		tier: 4,
		description: "Raises robotics and mine infrastructure ceilings.",
		position: { x: 640, y: 180 },
		prerequisites: ["modularAssemblyStandards"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 5,
		costs: [
			{
				metaMatter: { rare: 7 },
				resources: { alloy: 1800, crystal: 1500, fuel: 400 },
				seconds: 1800,
			},
		],
		effects: [
			{ kind: "building_max_level_bonus", buildingKey: "alloyMineLevel", amount: 3 },
			{ kind: "building_max_level_bonus", buildingKey: "crystalMineLevel", amount: 3 },
			{ kind: "facility_max_level_bonus", facilityKey: "robotics_hub", amount: 2 },
		],
	},
	{
		id: "cargoStandardization",
		name: "Cargo Standardization",
		branch: "expansion_logistics",
		tier: 1,
		description: "Improves transport hold efficiency.",
		position: { x: 0, y: 360 },
		prerequisites: [],
		maxLevel: 2,
		requiredResearchFacilityLevel: 1,
		costs: [
			{ metaMatter: { common: 5 }, resources: { alloy: 240, crystal: 180 }, seconds: 180 },
			{ metaMatter: { common: 8 }, resources: { alloy: 340, crystal: 260 }, seconds: 360 },
		],
		effects: [{ kind: "cargo_capacity_multiplier", multiplier: 1.1 }],
	},
	{
		id: "deepSpaceRefueling",
		name: "Deep Space Refueling",
		branch: "expansion_logistics",
		tier: 2,
		description: "Reduces fleet fuel burden.",
		position: { x: 160, y: 360 },
		prerequisites: ["cargoStandardization"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 2,
		costs: [
			{
				metaMatter: { common: 8 },
				resources: { alloy: 420, crystal: 220, fuel: 160 },
				seconds: 360,
			},
			{
				metaMatter: { common: 12, rare: 1 },
				resources: { alloy: 600, crystal: 340, fuel: 260 },
				seconds: 720,
			},
		],
		effects: [{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.92 }],
	},
	{
		id: "colonialBureaucracy",
		name: "Colonial Bureaucracy",
		branch: "expansion_logistics",
		tier: 2,
		description: "Expands storage on alloy depots and crystal vaults.",
		position: { x: 320, y: 360 },
		prerequisites: ["cargoStandardization"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 2,
		costs: [{ metaMatter: { common: 10 }, resources: { alloy: 520, crystal: 520 }, seconds: 540 }],
		effects: [
			{ kind: "building_max_level_bonus", buildingKey: "alloyStorageLevel", amount: 2 },
			{ kind: "building_max_level_bonus", buildingKey: "crystalStorageLevel", amount: 2 },
		],
	},
	{
		id: "frontierSupplyDoctrine",
		name: "Frontier Supply Doctrine",
		branch: "expansion_logistics",
		tier: 3,
		description: "Unlocks larger civilian logistics hulls.",
		position: { x: 480, y: 360 },
		prerequisites: ["deepSpaceRefueling", "colonialBureaucracy"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 4,
		costs: [
			{
				metaMatter: { common: 15, rare: 2 },
				resources: { alloy: 900, crystal: 700, fuel: 200 },
				seconds: 1200,
			},
		],
		effects: [
			{ kind: "unlock_ship", shipKey: "largeCargo" },
			{ kind: "unlock_ship", shipKey: "colonyShip" },
		],
	},
	{
		id: "surveyUplinks",
		name: "Survey Uplinks",
		branch: "expansion_logistics",
		tier: 4,
		description: "Improves future contract-side research yields.",
		position: { x: 640, y: 360 },
		prerequisites: ["frontierSupplyDoctrine"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 5,
		costs: [
			{
				metaMatter: { rare: 6 },
				resources: { alloy: 1400, crystal: 1200, fuel: 500 },
				seconds: 1800,
			},
		],
		effects: [{ kind: "meta_matter_reward_multiplier", multiplier: 1.08 }],
	},
	{
		id: "pointDefenseTheory",
		name: "Point Defense Theory",
		branch: "military_systems",
		tier: 1,
		description: "Unlocks laser turret emplacements.",
		position: { x: 0, y: 540 },
		prerequisites: [],
		maxLevel: 1,
		requiredResearchFacilityLevel: 1,
		costs: [{ metaMatter: { common: 5 }, resources: { alloy: 260, crystal: 180 }, seconds: 240 }],
		effects: [{ kind: "unlock_defense", defenseKey: "laserTurret" }],
	},
	{
		id: "missileGuidanceSuites",
		name: "Missile Guidance Suites",
		branch: "military_systems",
		tier: 1,
		description: "Unlocks advanced interceptor doctrine.",
		position: { x: 160, y: 540 },
		prerequisites: [],
		maxLevel: 1,
		requiredResearchFacilityLevel: 1,
		costs: [{ metaMatter: { common: 5 }, resources: { alloy: 240, crystal: 210 }, seconds: 240 }],
		effects: [{ kind: "unlock_ship", shipKey: "frigate" }],
	},
	{
		id: "reactorHardenedHulls",
		name: "Reactor-Hardened Hulls",
		branch: "military_systems",
		tier: 2,
		description: "Speeds advanced ship construction.",
		position: { x: 320, y: 540 },
		prerequisites: ["missileGuidanceSuites"],
		maxLevel: 2,
		requiredResearchFacilityLevel: 3,
		costs: [
			{
				metaMatter: { common: 12, rare: 1 },
				resources: { alloy: 700, crystal: 520 },
				seconds: 720,
			},
			{
				metaMatter: { common: 16, rare: 2 },
				resources: { alloy: 1100, crystal: 780 },
				seconds: 1500,
			},
		],
		effects: [{ kind: "ship_build_time_multiplier", multiplier: 0.92 }],
	},
	{
		id: "shieldFieldModulation",
		name: "Shield Field Modulation",
		branch: "military_systems",
		tier: 3,
		description: "Unlocks heavier defensive screens and cannons.",
		position: { x: 480, y: 540 },
		prerequisites: ["pointDefenseTheory", "reactorHardenedHulls"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 4,
		costs: [
			{
				metaMatter: { rare: 4 },
				resources: { alloy: 1100, crystal: 1000, fuel: 240 },
				seconds: 1500,
			},
		],
		effects: [
			{ kind: "unlock_defense", defenseKey: "gaussCannon" },
			{ kind: "unlock_defense", defenseKey: "shieldDome" },
			{ kind: "defense_build_time_multiplier", multiplier: 0.92 },
		],
	},
	{
		id: "advancedStrikeCraft",
		name: "Advanced Strike Craft",
		branch: "military_systems",
		tier: 4,
		description: "Unlocks cruiser and bomber-class hulls.",
		position: { x: 640, y: 540 },
		prerequisites: ["shieldFieldModulation"],
		maxLevel: 1,
		requiredResearchFacilityLevel: 6,
		costs: [
			{
				metaMatter: { rare: 10, mythic: 1 },
				resources: { alloy: 2400, crystal: 1800, fuel: 700 },
				seconds: 2400,
			},
		],
		effects: [
			{ kind: "unlock_ship", shipKey: "cruiser" },
			{ kind: "unlock_ship", shipKey: "bomber" },
		],
	},
] as const;

export const RESEARCH_KEYS = DEFAULT_RESEARCH_TREE.map((node) => node.id) as readonly string[];
export type ResearchKey = (typeof RESEARCH_KEYS)[number];

const DEFAULT_RESEARCH_REGISTRY = new Map(
	DEFAULT_RESEARCH_TREE.map((node) => [node.id, node] as const),
);

export function getResearchNode(researchKey: ResearchKey) {
	return DEFAULT_RESEARCH_REGISTRY.get(researchKey);
}

export function isResearchUnlocked(
	levels: Partial<ResearchLevelMap> | undefined,
	researchKey: ResearchKey,
) {
	return Math.max(0, Math.floor(levels?.[researchKey] ?? 0)) > 0;
}

export function getResearchVisibility(args: {
	researchKey: ResearchKey;
	levels: Partial<ResearchLevelMap> | undefined;
}) {
	const node = getResearchNode(args.researchKey);
	if (!node) {
		return "hidden" as const;
	}
	if (isResearchUnlocked(args.levels, args.researchKey)) {
		return "visible" as const;
	}
	if (node.prerequisites.length === 0) {
		return "silhouette" as const;
	}
	const directPrereqComplete = node.prerequisites.some((prereq) =>
		isResearchUnlocked(args.levels, prereq),
	);
	return directPrereqComplete ? ("silhouette" as const) : ("hidden" as const);
}

export function buildResearchModifierSnapshot(
	levels: Partial<ResearchLevelMap> | undefined,
): ResearchModifierSnapshot {
	const snapshot: ResearchModifierSnapshot = {
		unlockedShips: new Set(),
		unlockedDefenses: new Set(),
		unlockedFacilities: new Set(),
		unlockedBuildings: new Set(),
		resourceProductionMultipliers: { ...DEFAULT_RESOURCE_MULTIPLIERS },
		resourceStorageMultipliers: { ...DEFAULT_RESOURCE_MULTIPLIERS },
		buildingUpgradeTimeMultipliers: {},
		globalBuildingUpgradeTimeMultiplier: 1,
		facilityUpgradeTimeMultipliers: {},
		globalFacilityUpgradeTimeMultiplier: 1,
		researchDurationMultiplier: 1,
		shipBuildTimeMultipliers: {},
		globalShipBuildTimeMultiplier: 1,
		defenseBuildTimeMultipliers: {},
		globalDefenseBuildTimeMultiplier: 1,
		fleetFuelCostMultiplier: 1,
		cargoCapacityMultiplier: 1,
		buildingMaxLevelBonuses: {},
		facilityMaxLevelBonuses: {},
		metaMatterRewardMultipliers: {},
		globalMetaMatterRewardMultiplier: 1,
		combinedResearchCapacityUnlocked: false,
	};

	for (const node of DEFAULT_RESEARCH_TREE) {
		const level = Math.max(0, Math.floor(levels?.[node.id] ?? 0));
		if (level <= 0) {
			continue;
		}
		for (let rank = 0; rank < level; rank += 1) {
			for (const effect of node.effects) {
				switch (effect.kind) {
					case "unlock_ship":
						snapshot.unlockedShips.add(effect.shipKey);
						break;
					case "unlock_defense":
						snapshot.unlockedDefenses.add(effect.defenseKey);
						break;
					case "unlock_facility":
						snapshot.unlockedFacilities.add(effect.facilityKey);
						break;
					case "unlock_building":
						snapshot.unlockedBuildings.add(effect.buildingKey);
						break;
					case "resource_production_multiplier":
						snapshot.resourceProductionMultipliers[effect.resource] *= effect.multiplier;
						break;
					case "resource_storage_multiplier":
						snapshot.resourceStorageMultipliers[effect.resource] *= effect.multiplier;
						break;
					case "building_upgrade_time_multiplier":
						if (effect.buildingKey) {
							multiplyIntoRecord(
								snapshot.buildingUpgradeTimeMultipliers,
								effect.buildingKey,
								effect.multiplier,
							);
						} else {
							snapshot.globalBuildingUpgradeTimeMultiplier *= effect.multiplier;
						}
						break;
					case "facility_upgrade_time_multiplier":
						if (effect.facilityKey) {
							multiplyIntoRecord(
								snapshot.facilityUpgradeTimeMultipliers,
								effect.facilityKey,
								effect.multiplier,
							);
						} else {
							snapshot.globalFacilityUpgradeTimeMultiplier *= effect.multiplier;
						}
						break;
					case "research_duration_multiplier":
						snapshot.researchDurationMultiplier *= effect.multiplier;
						break;
					case "ship_build_time_multiplier":
						if (effect.shipKey) {
							multiplyIntoRecord(
								snapshot.shipBuildTimeMultipliers,
								effect.shipKey,
								effect.multiplier,
							);
						} else {
							snapshot.globalShipBuildTimeMultiplier *= effect.multiplier;
						}
						break;
					case "defense_build_time_multiplier":
						if (effect.defenseKey) {
							multiplyIntoRecord(
								snapshot.defenseBuildTimeMultipliers,
								effect.defenseKey,
								effect.multiplier,
							);
						} else {
							snapshot.globalDefenseBuildTimeMultiplier *= effect.multiplier;
						}
						break;
					case "fleet_fuel_cost_multiplier":
						snapshot.fleetFuelCostMultiplier *= effect.multiplier;
						break;
					case "cargo_capacity_multiplier":
						snapshot.cargoCapacityMultiplier *= effect.multiplier;
						break;
					case "building_max_level_bonus":
						snapshot.buildingMaxLevelBonuses[effect.buildingKey] =
							(snapshot.buildingMaxLevelBonuses[effect.buildingKey] ?? 0) + effect.amount;
						break;
					case "facility_max_level_bonus":
						snapshot.facilityMaxLevelBonuses[effect.facilityKey] =
							(snapshot.facilityMaxLevelBonuses[effect.facilityKey] ?? 0) + effect.amount;
						break;
					case "combined_research_capacity":
						snapshot.combinedResearchCapacityUnlocked = true;
						break;
					case "meta_matter_reward_multiplier":
						if (effect.rarity) {
							multiplyIntoRecord(
								snapshot.metaMatterRewardMultipliers,
								effect.rarity,
								effect.multiplier,
							);
						} else {
							snapshot.globalMetaMatterRewardMultiplier *= effect.multiplier;
						}
						break;
				}
			}
		}
	}

	return snapshot;
}

export function canResearchNodeStart(args: {
	combinedResearchCapacity: number;
	localResearchFacilityLevel: number;
	levels: Partial<ResearchLevelMap> | undefined;
	researchKey: ResearchKey;
}) {
	const node = getResearchNode(args.researchKey);
	if (!node) {
		return false;
	}
	const currentLevel = Math.max(0, Math.floor(args.levels?.[node.id] ?? 0));
	if (currentLevel >= node.maxLevel) {
		return false;
	}
	const prerequisites: UnlockRule | undefined =
		node.prerequisites.length === 0
			? undefined
			: {
					type: "all",
					rules: node.prerequisites.map((researchId) => ({
						type: "research_level" as const,
						researchId,
						minLevel: 1,
					})),
				};
	if (
		!isUnlockSatisfied(prerequisites, {
			facilityLevels: {},
			researchLevels: args.levels ?? {},
		})
	) {
		return false;
	}
	if (args.localResearchFacilityLevel < node.requiredResearchFacilityLevel) {
		return false;
	}
	if (
		typeof node.requiredCombinedResearchCapacity === "number" &&
		args.combinedResearchCapacity < node.requiredCombinedResearchCapacity
	) {
		return false;
	}
	return true;
}

const META_MATTER_REWARD_WEIGHTS: Record<
	number,
	Array<{ bundle: Partial<MetaMatterBundle>; weight: number }>
> = {
	1: [
		{ bundle: { common: 3 }, weight: 70 },
		{ bundle: { common: 4 }, weight: 30 },
	],
	2: [
		{ bundle: { common: 5 }, weight: 60 },
		{ bundle: { common: 6 }, weight: 40 },
	],
	3: [
		{ bundle: { common: 6, rare: 1 }, weight: 65 },
		{ bundle: { common: 7, rare: 1 }, weight: 35 },
	],
	4: [
		{ bundle: { rare: 3 }, weight: 65 },
		{ bundle: { rare: 4 }, weight: 35 },
	],
	5: [
		{ bundle: { rare: 5, mythic: 1 }, weight: 70 },
		{ bundle: { rare: 6, mythic: 1 }, weight: 30 },
	],
};

function hashSeed(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function rollMetaMatterBundle(args: {
	difficultyTier: number;
	modifierSnapshot?: Pick<
		ResearchModifierSnapshot,
		"globalMetaMatterRewardMultiplier" | "metaMatterRewardMultipliers"
	>;
	seed: string;
}) {
	const tier = Math.max(1, Math.min(5, Math.floor(args.difficultyTier))) as 1 | 2 | 3 | 4 | 5;
	const table = META_MATTER_REWARD_WEIGHTS[tier]!;
	const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
	let cursor = hashSeed(args.seed) % totalWeight;
	let chosen = table[0]!;
	for (const entry of table) {
		if (cursor < entry.weight) {
			chosen = entry;
			break;
		}
		cursor -= entry.weight;
	}
	const multiplierSnapshot = args.modifierSnapshot;
	const bundle = emptyMetaMatterBundle();
	for (const rarity of META_MATTER_RARITIES) {
		const baseAmount = Math.max(0, Math.floor(chosen.bundle[rarity] ?? 0));
		const multiplier =
			(multiplierSnapshot?.globalMetaMatterRewardMultiplier ?? 1) *
			(multiplierSnapshot?.metaMatterRewardMultipliers?.[rarity] ?? 1);
		bundle[rarity] = Math.max(0, Math.round(baseAmount * multiplier));
	}
	return bundle;
}
