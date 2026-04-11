import type { DefenseKey } from "./defenses";
import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";
import type { ResourceKey, UnlockRule } from "./types";

import { isUnlockSatisfied } from "./unlocks";

export const META_MATTER_RARITIES = ["common", "rare", "mythic"] as const;

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

export type ResearchVisibility = "hidden" | "silhouette" | "visible";
export type ResearchNodeShape = "circle" | "hex" | "square" | "capstone";
export type ResearchLayoutLane =
	| "outerLeft"
	| "innerLeft"
	| "bridgeLeft"
	| "bridgeRight"
	| "innerRight"
	| "outerRight"
	| "axis";

export type ResearchTierUnlockRule =
	| { type: "always" }
	| { type: "contractsCompleted"; count: number }
	| { type: "highestBuildingLevelReached"; level: number }
	| { type: "coloniesFounded"; count: number }
	| { type: "highestResearchDirectorateLevelReached"; level: number }
	| { type: "shipsOwned"; count: number }
	| { type: "defensesOwned"; count: number }
	| { type: "successfulTransports"; count: number }
	| { type: "all"; rules: readonly ResearchTierUnlockRule[] }
	| { type: "any"; rules: readonly ResearchTierUnlockRule[] };

export type ResearchTierUnlockContext = {
	coloniesFounded: number;
	contractsCompleted: number;
	defensesOwned: number;
	highestBuildingLevel: number;
	highestResearchDirectorateLevel: number;
	shipsOwned: number;
	successfulTransports: number;
};

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

type AuthoredResearchNode = {
	id: string;
	name: string;
	description: string;
	layout: {
		lane: ResearchLayoutLane;
		shape: ResearchNodeShape;
	};
	prerequisites: readonly string[];
	maxLevel: number;
	requiredResearchFacilityLevel: number;
	requiredCombinedResearchCapacity?: number;
	costs: readonly ResearchNodeCost[];
	effects: readonly ResearchEffect[];
	effectLabels?: readonly string[];
};

type AuthoredResearchTier = {
	tier: 1 | 2 | 3 | 4;
	unlock: ResearchTierUnlockRule;
	nodes: readonly AuthoredResearchNode[];
};

type AuthoredResearchBranch = {
	label: string;
	shortLabel: string;
	themeColor: string;
	themeColorSoft: string;
	ditherWaveColor: readonly [number, number, number];
	ditherPixelSize: number;
	tiers: readonly AuthoredResearchTier[];
};

type AuthoredResearchTree = {
	branches: Record<string, AuthoredResearchBranch>;
};

const AUTHORED_RESEARCH_TREE = {
	branches: {
		appliedIndustry: {
			label: "Applied Industry",
			shortLabel: "Industry",
			themeColor: "#ff914f",
			themeColorSoft: "rgba(255,145,79,0.14)",
			ditherWaveColor: [0.65, 0.35, 0.12],
			ditherPixelSize: 2,
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						{
							id: "automatedSmelting",
							name: "Automated Smelting",
							description: "Improves alloy output.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 4 },
									resources: { alloy: 250, crystal: 120 },
									seconds: 120,
								},
								{
									metaMatter: { common: 7 },
									resources: { alloy: 380, crystal: 180 },
									seconds: 240,
								},
								{
									metaMatter: { common: 10 },
									resources: { alloy: 520, crystal: 260 },
									seconds: 420,
								},
							],
							effects: [
								{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.05 },
							],
						},
						{
							id: "crystalLatticeRefinement",
							name: "Crystal Lattice Refinement",
							description: "Improves crystal output.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 4 },
									resources: { alloy: 180, crystal: 250 },
									seconds: 120,
								},
								{
									metaMatter: { common: 7 },
									resources: { alloy: 260, crystal: 380 },
									seconds: 240,
								},
								{
									metaMatter: { common: 10 },
									resources: { alloy: 360, crystal: 520 },
									seconds: 420,
								},
							],
							effects: [
								{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.05 },
							],
						},
					],
				},
				{
					tier: 2,
					unlock: { type: "highestBuildingLevelReached", level: 5 },
					nodes: [
						{
							id: "fuelCompression",
							name: "Fuel Compression",
							description: "Improves fuel storage capacity.",
							layout: { lane: "outerLeft", shape: "circle" },
							prerequisites: ["automatedSmelting", "crystalLatticeRefinement"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 9 },
									resources: { alloy: 500, crystal: 420 },
									seconds: 360,
								},
								{
									metaMatter: { common: 14, rare: 1 },
									resources: { alloy: 750, crystal: 620 },
									seconds: 720,
								},
							],
							effects: [
								{ kind: "resource_storage_multiplier", resource: "fuel", multiplier: 1.12 },
							],
						},
						{
							id: "modularAssemblyStandards",
							name: "Modular Assembly Standards",
							description: "Reduces building upgrade times.",
							layout: { lane: "outerRight", shape: "square" },
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
					],
				},
				{
					tier: 3,
					unlock: { type: "highestBuildingLevelReached", level: 15 },
					nodes: [
						{
							id: "distributedRobotics",
							name: "Distributed Robotics",
							description: "Raises robotics and mine infrastructure ceilings.",
							layout: { lane: "bridgeLeft", shape: "square" },
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
							id: "adaptiveFabricators",
							name: "Adaptive Fabricators",
							description: "Stand-in industrial node for later tuning.",
							layout: { lane: "bridgeRight", shape: "hex" },
							prerequisites: ["fuelCompression", "modularAssemblyStandards"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 4,
							costs: [
								{
									metaMatter: { rare: 5 },
									resources: { alloy: 1600, crystal: 1200, fuel: 300 },
									seconds: 1500,
								},
							],
							effects: [],
							effectLabels: ["Placeholder: industrial specialization bonus"],
						},
					],
				},
				{
					tier: 4,
					unlock: { type: "highestBuildingLevelReached", level: 30 },
					nodes: [
						{
							id: "industrialOverclockDoctrine",
							name: "Industrial Overclock Doctrine",
							description: "Pushes mature colony infrastructure beyond standard tolerances.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["distributedRobotics", "adaptiveFabricators"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 7,
							costs: [
								{
									metaMatter: { rare: 14, mythic: 2 },
									resources: { alloy: 4200, crystal: 3400, fuel: 1200 },
									seconds: 4200,
								},
							],
							effects: [
								{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.08 },
								{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.08 },
								{ kind: "resource_production_multiplier", resource: "fuel", multiplier: 1.08 },
							],
						},
					],
				},
			],
		},
		militarySystems: {
			label: "Military Systems",
			shortLabel: "Military",
			themeColor: "#ff6f88",
			themeColorSoft: "rgba(255,111,136,0.14)",
			ditherWaveColor: [0.6, 0.15, 0.2],
			ditherPixelSize: 2,
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						{
							id: "pointDefenseTheory",
							name: "Point Defense Theory",
							description: "Unlocks laser turret emplacements.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 5 },
									resources: { alloy: 260, crystal: 180 },
									seconds: 240,
								},
							],
							effects: [{ kind: "unlock_defense", defenseKey: "laserTurret" }],
						},
						{
							id: "missileGuidanceSuites",
							name: "Missile Guidance Suites",
							description: "Unlocks advanced interceptor doctrine.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 5 },
									resources: { alloy: 240, crystal: 210 },
									seconds: 240,
								},
							],
							effects: [{ kind: "unlock_ship", shipKey: "frigate" }],
						},
					],
				},
				{
					tier: 2,
					unlock: { type: "contractsCompleted", count: 1 },
					nodes: [
						{
							id: "reactorHardenedHulls",
							name: "Reactor-Hardened Hulls",
							description: "Speeds advanced ship construction.",
							layout: { lane: "outerLeft", shape: "circle" },
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
							description: "Unlocks heavier defensive screens and cannons.",
							layout: { lane: "outerRight", shape: "hex" },
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
					],
				},
				{
					tier: 3,
					unlock: { type: "contractsCompleted", count: 3 },
					nodes: [
						{
							id: "advancedStrikeCraft",
							name: "Advanced Strike Craft",
							description: "Unlocks cruiser and bomber-class hulls.",
							layout: { lane: "bridgeLeft", shape: "hex" },
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
						{
							id: "battlefieldTelemetry",
							name: "Battlefield Telemetry",
							description: "Stand-in combat analytics node for later tuning.",
							layout: { lane: "bridgeRight", shape: "circle" },
							prerequisites: ["reactorHardenedHulls", "shieldFieldModulation"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 5,
							costs: [
								{
									metaMatter: { rare: 8 },
									resources: { alloy: 2100, crystal: 1700, fuel: 500 },
									seconds: 2100,
								},
								{
									metaMatter: { rare: 12, mythic: 1 },
									resources: { alloy: 3000, crystal: 2300, fuel: 750 },
									seconds: 3300,
								},
							],
							effects: [{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.96 }],
						},
					],
				},
				{
					tier: 4,
					unlock: { type: "contractsCompleted", count: 6 },
					nodes: [
						{
							id: "theaterCommandSystems",
							name: "Theater Command Systems",
							description: "Stand-in military capstone for later task force tuning.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["advancedStrikeCraft", "battlefieldTelemetry"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 8,
							costs: [
								{
									metaMatter: { rare: 16, mythic: 3 },
									resources: { alloy: 5200, crystal: 3600, fuel: 1800 },
									seconds: 5400,
								},
							],
							effects: [{ kind: "defense_build_time_multiplier", multiplier: 0.9 }],
							effectLabels: ["-10% defense build time", "Placeholder: task force coordination"],
						},
					],
				},
			],
		},
		scientificInfrastructure: {
			label: "Scientific Infrastructure",
			shortLabel: "Science",
			themeColor: "#9b7cff",
			themeColorSoft: "rgba(155,124,255,0.14)",
			ditherWaveColor: [0.3, 0.2, 0.6],
			ditherPixelSize: 3,
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						{
							id: "archiveCompression",
							name: "Archive Compression",
							description: "Improves baseline research throughput.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 4 },
									resources: { alloy: 300, crystal: 200 },
									seconds: 120,
								},
								{
									metaMatter: { common: 7 },
									resources: { alloy: 500, crystal: 300 },
									seconds: 240,
								},
								{
									metaMatter: { common: 12, rare: 1 },
									resources: { alloy: 800, crystal: 500 },
									seconds: 480,
								},
							],
							effects: [{ kind: "research_duration_multiplier", multiplier: 0.94 }],
						},
						{
							id: "experimentalMethodology",
							name: "Experimental Methodology",
							description: "Stand-in research efficiency node for later tuning.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: [],
							maxLevel: 2,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 6 },
									resources: { alloy: 250, crystal: 260 },
									seconds: 180,
								},
								{
									metaMatter: { common: 9 },
									resources: { alloy: 420, crystal: 460 },
									seconds: 360,
								},
							],
							effects: [{ kind: "meta_matter_reward_multiplier", multiplier: 1.03 }],
						},
					],
				},
				{
					tier: 2,
					unlock: { type: "highestResearchDirectorateLevelReached", level: 2 },
					nodes: [
						{
							id: "parallelInquiry",
							name: "Parallel Inquiry",
							description: "Makes facility upgrades complete faster.",
							layout: { lane: "outerLeft", shape: "hex" },
							prerequisites: ["archiveCompression"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 10 },
									resources: { alloy: 800, crystal: 600 },
									seconds: 360,
								},
								{
									metaMatter: { common: 15, rare: 2 },
									resources: { alloy: 1200, crystal: 900 },
									seconds: 720,
								},
							],
							effects: [{ kind: "facility_upgrade_time_multiplier", multiplier: 0.94 }],
						},
						{
							id: "peerReviewProtocols",
							name: "Peer Review Protocols",
							description: "Stand-in science governance node for later tuning.",
							layout: { lane: "outerRight", shape: "square" },
							prerequisites: ["experimentalMethodology"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 11, rare: 1 },
									resources: { alloy: 700, crystal: 700 },
									seconds: 540,
								},
							],
							effects: [],
							effectLabels: ["Placeholder: research governance bonus"],
						},
					],
				},
				{
					tier: 3,
					unlock: { type: "highestResearchDirectorateLevelReached", level: 4 },
					nodes: [
						{
							id: "federatedDatabanks",
							name: "Federated Databanks",
							description: "Raises the practical ceiling for research infrastructure.",
							layout: { lane: "bridgeLeft", shape: "square" },
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
							effects: [
								{
									kind: "facility_max_level_bonus",
									facilityKey: "research_directorate",
									amount: 5,
								},
							],
						},
						{
							id: "quantumIndexing",
							name: "Quantum Indexing",
							description: "Stand-in archive acceleration node for later tuning.",
							layout: { lane: "bridgeRight", shape: "circle" },
							prerequisites: ["parallelInquiry", "peerReviewProtocols"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 4,
							costs: [
								{
									metaMatter: { common: 18, rare: 3 },
									resources: { alloy: 1500, crystal: 1700 },
									seconds: 900,
								},
								{
									metaMatter: { rare: 6 },
									resources: { alloy: 2200, crystal: 2400, fuel: 400 },
									seconds: 1800,
								},
							],
							effects: [{ kind: "research_duration_multiplier", multiplier: 0.97 }],
						},
					],
				},
				{
					tier: 4,
					unlock: { type: "highestResearchDirectorateLevelReached", level: 6 },
					nodes: [
						{
							id: "unifiedTheoryInitiative",
							name: "Unified Theory Initiative",
							description: "Further improves research timing for developed empires.",
							layout: { lane: "outerLeft", shape: "capstone" },
							prerequisites: ["federatedDatabanks", "quantumIndexing"],
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
							description: "Allows select late-game research to use combined research capacity.",
							layout: { lane: "outerRight", shape: "capstone" },
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
					],
				},
			],
		},
		expansionLogistics: {
			label: "Expansion & Logistics",
			shortLabel: "Expansion",
			themeColor: "#64f8bb",
			themeColorSoft: "rgba(100,248,187,0.14)",
			ditherWaveColor: [0.12, 0.5, 0.35],
			ditherPixelSize: 2,
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						{
							id: "cargoStandardization",
							name: "Cargo Standardization",
							description: "Improves transport hold efficiency.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 2,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 5 },
									resources: { alloy: 240, crystal: 180 },
									seconds: 180,
								},
								{
									metaMatter: { common: 8 },
									resources: { alloy: 340, crystal: 260 },
									seconds: 360,
								},
							],
							effects: [{ kind: "cargo_capacity_multiplier", multiplier: 1.1 }],
						},
						{
							id: "deepSpaceRefueling",
							name: "Deep Space Refueling",
							description: "Reduces fleet fuel burden.",
							layout: { lane: "innerRight", shape: "circle" },
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
					],
				},
				{
					tier: 2,
					unlock: { type: "coloniesFounded", count: 1 },
					nodes: [
						{
							id: "colonialBureaucracy",
							name: "Colonial Bureaucracy",
							description: "Expands storage on alloy depots and crystal vaults.",
							layout: { lane: "outerLeft", shape: "square" },
							prerequisites: ["cargoStandardization"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 10 },
									resources: { alloy: 520, crystal: 520 },
									seconds: 540,
								},
							],
							effects: [
								{ kind: "building_max_level_bonus", buildingKey: "alloyStorageLevel", amount: 2 },
								{ kind: "building_max_level_bonus", buildingKey: "crystalStorageLevel", amount: 2 },
							],
						},
						{
							id: "frontierSupplyDoctrine",
							name: "Frontier Supply Doctrine",
							description: "Unlocks larger civilian logistics hulls.",
							layout: { lane: "outerRight", shape: "square" },
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
					],
				},
				{
					tier: 3,
					unlock: { type: "successfulTransports", count: 3 },
					nodes: [
						{
							id: "surveyUplinks",
							name: "Survey Uplinks",
							description: "Improves future contract-side research yields.",
							layout: { lane: "bridgeLeft", shape: "hex" },
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
							id: "logisticsBackbone",
							name: "Logistics Backbone",
							description: "Stand-in transport infrastructure node for later tuning.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["colonialBureaucracy", "frontierSupplyDoctrine"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 5,
							costs: [
								{
									metaMatter: { rare: 5 },
									resources: { alloy: 1600, crystal: 1300, fuel: 600 },
									seconds: 1500,
								},
								{
									metaMatter: { rare: 8, mythic: 1 },
									resources: { alloy: 2300, crystal: 1800, fuel: 900 },
									seconds: 2700,
								},
							],
							effects: [{ kind: "cargo_capacity_multiplier", multiplier: 1.05 }],
						},
					],
				},
				{
					tier: 4,
					unlock: {
						type: "all",
						rules: [
							{ type: "coloniesFounded", count: 3 },
							{ type: "successfulTransports", count: 8 },
						],
					},
					nodes: [
						{
							id: "interstellarTransitNetwork",
							name: "Interstellar Transit Network",
							description: "Stand-in expansion capstone for later tuning.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["surveyUplinks", "logisticsBackbone"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 7,
							requiredCombinedResearchCapacity: 10,
							costs: [
								{
									metaMatter: { rare: 14, mythic: 2 },
									resources: { alloy: 4200, crystal: 3600, fuel: 2400 },
									seconds: 4800,
								},
							],
							effects: [
								{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.9 },
								{ kind: "cargo_capacity_multiplier", multiplier: 1.12 },
							],
						},
					],
				},
			],
		},
		colonySpecialization: {
			label: "Colony Specialization",
			shortLabel: "Colony",
			themeColor: "#ffd166",
			themeColorSoft: "rgba(255,209,102,0.14)",
			ditherWaveColor: [0.55, 0.45, 0.15],
			ditherPixelSize: 2,
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						{
							id: "defenseGridArchitecture",
							name: "Defense Grid Architecture",
							description: "Stand-in colony defense specialization node.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 5 },
									resources: { alloy: 320, crystal: 160 },
									seconds: 240,
								},
							],
							effects: [],
							effectLabels: ["Placeholder: defense grid specialization"],
						},
						{
							id: "navalProductionCoordination",
							name: "Naval Production Coordination",
							description: "Stand-in colony shipyard specialization node.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							requiredResearchFacilityLevel: 1,
							costs: [
								{
									metaMatter: { common: 5 },
									resources: { alloy: 340, crystal: 180 },
									seconds: 240,
								},
							],
							effects: [],
							effectLabels: ["Placeholder: shipyard specialization"],
						},
					],
				},
				{
					tier: 2,
					unlock: { type: "coloniesFounded", count: 2 },
					nodes: [
						{
							id: "advancedRoboticsAdministration",
							name: "Advanced Robotics Administration",
							description: "Stand-in robotics specialization node.",
							layout: { lane: "outerLeft", shape: "circle" },
							prerequisites: ["defenseGridArchitecture"],
							maxLevel: 3,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 10 },
									resources: { alloy: 700, crystal: 380 },
									seconds: 540,
								},
								{
									metaMatter: { common: 14, rare: 1 },
									resources: { alloy: 980, crystal: 520 },
									seconds: 900,
								},
								{
									metaMatter: { common: 20, rare: 2 },
									resources: { alloy: 1400, crystal: 760 },
									seconds: 1500,
								},
							],
							effects: [
								{ kind: "facility_max_level_bonus", facilityKey: "robotics_hub", amount: 1 },
							],
						},
						{
							id: "planetarySurveyMethods",
							name: "Planetary Survey Methods",
							description: "Stand-in survey specialization node.",
							layout: { lane: "outerRight", shape: "hex" },
							prerequisites: ["navalProductionCoordination"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 2,
							costs: [
								{
									metaMatter: { common: 11, rare: 1 },
									resources: { alloy: 620, crystal: 760 },
									seconds: 720,
								},
							],
							effects: [],
							effectLabels: ["Placeholder: planetary scanner unlock"],
						},
					],
				},
				{
					tier: 3,
					unlock: { type: "highestBuildingLevelReached", level: 20 },
					nodes: [
						{
							id: "infrastructureSynergy",
							name: "Infrastructure Synergy",
							description: "Stand-in colony infrastructure cross-link node.",
							layout: { lane: "bridgeLeft", shape: "square" },
							prerequisites: ["advancedRoboticsAdministration", "planetarySurveyMethods"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 4,
							costs: [
								{
									metaMatter: { rare: 5 },
									resources: { alloy: 1500, crystal: 1500, fuel: 300 },
									seconds: 1500,
								},
							],
							effects: [
								{ kind: "building_max_level_bonus", buildingKey: "fuelRefineryLevel", amount: 2 },
							],
						},
						{
							id: "specializedProcessing",
							name: "Specialized Processing",
							description: "Stand-in colony output specialization node.",
							layout: { lane: "bridgeRight", shape: "circle" },
							prerequisites: ["advancedRoboticsAdministration"],
							maxLevel: 2,
							requiredResearchFacilityLevel: 4,
							costs: [
								{
									metaMatter: { rare: 4 },
									resources: { alloy: 1300, crystal: 1100, fuel: 400 },
									seconds: 1200,
								},
								{
									metaMatter: { rare: 7, mythic: 1 },
									resources: { alloy: 2000, crystal: 1600, fuel: 650 },
									seconds: 2100,
								},
							],
							effects: [
								{ kind: "resource_production_multiplier", resource: "fuel", multiplier: 1.04 },
							],
						},
					],
				},
				{
					tier: 4,
					unlock: { type: "defensesOwned", count: 25 },
					nodes: [
						{
							id: "controlledAutomation",
							name: "Controlled Automation",
							description: "Stand-in colony specialization capstone.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["infrastructureSynergy", "specializedProcessing"],
							maxLevel: 1,
							requiredResearchFacilityLevel: 7,
							costs: [
								{
									metaMatter: { rare: 12, mythic: 2 },
									resources: { alloy: 3600, crystal: 3200, fuel: 1200 },
									seconds: 4200,
								},
							],
							effects: [{ kind: "facility_upgrade_time_multiplier", multiplier: 0.92 }],
							effectLabels: ["-8% facility upgrade time", "Placeholder: specialized colony output"],
						},
					],
				},
			],
		},
	},
} as const satisfies AuthoredResearchTree;

type AuthoredBranches = typeof AUTHORED_RESEARCH_TREE.branches;
type AuthoredBranchKey = keyof AuthoredBranches;
type AuthoredBranchNode<Key extends AuthoredBranchKey> =
	AuthoredBranches[Key]["tiers"][number]["nodes"][number];
type AuthoredNode = AuthoredBranchNode<AuthoredBranchKey>;

export type ResearchBranchKey = AuthoredBranchKey;
export type ResearchKey = AuthoredNode["id"];

export const RESEARCH_BRANCH_KEYS = Object.keys(
	AUTHORED_RESEARCH_TREE.branches,
) as ResearchBranchKey[];

export type ResearchNodeLayout = {
	lane: ResearchLayoutLane;
	shape: ResearchNodeShape;
};

export type ResearchNodeDefinition = {
	id: ResearchKey;
	name: string;
	branch: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4;
	description: string;
	position: { x: number; y: number };
	layout: ResearchNodeLayout;
	prerequisites: ResearchKey[];
	maxLevel: number;
	requiredResearchFacilityLevel: number;
	requiredCombinedResearchCapacity?: number;
	costs: ResearchNodeCost[];
	effects: ResearchEffect[];
	effectLabels: string[];
};

export type ResearchTierDefinition = {
	tier: 1 | 2 | 3 | 4;
	unlock: ResearchTierUnlockRule;
	nodes: ResearchNodeDefinition[];
};

export type ResearchBranchDefinition = {
	key: ResearchBranchKey;
	label: string;
	shortLabel: string;
	themeColor: string;
	themeColorSoft: string;
	ditherWaveColor: [number, number, number];
	ditherPixelSize: number;
	tiers: ResearchTierDefinition[];
};

export type ResearchRequirementStatus = {
	key: string;
	label: string;
	met: boolean;
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

function researchLayoutPosition(lane: ResearchLayoutLane, tier: number) {
	const laneAngles = {
		outerLeft: -140,
		bridgeLeft: -95,
		innerLeft: -50,
		innerRight: 40,
		bridgeRight: 85,
		outerRight: 130,
		axis: 180,
	} satisfies Record<ResearchLayoutLane, number>;
	const radii = [0, 200, 380, 540, 680] as const;
	const radians = (laneAngles[lane] * Math.PI) / 180;
	const radius = radii[Math.max(0, Math.min(4, tier)) as 0 | 1 | 2 | 3 | 4];
	return {
		x: Math.round(Math.cos(radians) * radius),
		y: Math.round(Math.sin(radians) * radius),
	};
}

function describeResearchEffect(effect: ResearchEffect) {
	switch (effect.kind) {
		case "unlock_ship":
			return `Unlock ship: ${effect.shipKey}`;
		case "unlock_defense":
			return `Unlock defense: ${effect.defenseKey}`;
		case "unlock_facility":
			return `Unlock facility: ${effect.facilityKey}`;
		case "unlock_building":
			return `Unlock building: ${effect.buildingKey}`;
		case "resource_production_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${effect.resource} production`;
		case "resource_storage_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${effect.resource} storage`;
		case "building_upgrade_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% building upgrade time`;
		case "facility_upgrade_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% facility upgrade time`;
		case "research_duration_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% research duration`;
		case "ship_build_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% ship build time`;
		case "defense_build_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% defense build time`;
		case "fleet_fuel_cost_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% fleet fuel cost`;
		case "cargo_capacity_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% cargo capacity`;
		case "building_max_level_bonus":
			return `+${effect.amount} max ${effect.buildingKey}`;
		case "facility_max_level_bonus":
			return `+${effect.amount} max ${effect.facilityKey}`;
		case "combined_research_capacity":
			return "Enable combined research capacity";
		case "meta_matter_reward_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${
				effect.rarity ?? "all"
			} meta-matter rewards`;
	}
}

function flattenResearchTree() {
	const branches: ResearchBranchDefinition[] = [];

	for (const branchKey of RESEARCH_BRANCH_KEYS) {
		const branch = AUTHORED_RESEARCH_TREE.branches[branchKey];
		const tiers: ResearchTierDefinition[] = branch.tiers.map((tier) => ({
			tier: tier.tier,
			unlock: tier.unlock,
			nodes: tier.nodes.map((node) => {
				const authoredNode: AuthoredResearchNode = node;
				const effects = [...authoredNode.effects];
				return {
					id: authoredNode.id as ResearchKey,
					name: authoredNode.name,
					branch: branchKey,
					tier: tier.tier,
					description: authoredNode.description,
					position: researchLayoutPosition(authoredNode.layout.lane, tier.tier),
					layout: { ...authoredNode.layout },
					prerequisites: [...authoredNode.prerequisites] as ResearchKey[],
					maxLevel: authoredNode.maxLevel,
					requiredResearchFacilityLevel: authoredNode.requiredResearchFacilityLevel,
					requiredCombinedResearchCapacity: authoredNode.requiredCombinedResearchCapacity,
					costs: authoredNode.costs.map((cost) => ({
						metaMatter: { ...cost.metaMatter },
						resources: cost.resources ? { ...cost.resources } : undefined,
						seconds: cost.seconds,
					})),
					effects,
					effectLabels: authoredNode.effectLabels
						? [...authoredNode.effectLabels]
						: effects.map(describeResearchEffect),
				};
			}),
		}));

		branches.push({
			key: branchKey,
			label: branch.label,
			shortLabel: branch.shortLabel,
			themeColor: branch.themeColor,
			themeColorSoft: branch.themeColorSoft,
			ditherWaveColor: [...branch.ditherWaveColor],
			ditherPixelSize: branch.ditherPixelSize,
			tiers,
		});
	}

	return branches;
}

const DEFAULT_RESOURCE_MULTIPLIERS = {
	alloy: 1,
	crystal: 1,
	fuel: 1,
} satisfies Record<Exclude<ResourceKey, "energy">, number>;

export const DEFAULT_RESEARCH_BRANCHES = flattenResearchTree();
export const DEFAULT_RESEARCH_TREE = DEFAULT_RESEARCH_BRANCHES.flatMap((branch) =>
	branch.tiers.flatMap((tier) => tier.nodes),
) as readonly ResearchNodeDefinition[];
export const RESEARCH_KEYS = DEFAULT_RESEARCH_TREE.map((node) => node.id) as readonly ResearchKey[];

const DEFAULT_RESEARCH_REGISTRY = new Map(
	DEFAULT_RESEARCH_TREE.map((node) => [node.id, node] as const),
);
const DEFAULT_RESEARCH_BRANCH_REGISTRY = new Map(
	DEFAULT_RESEARCH_BRANCHES.map((branch) => [branch.key, branch] as const),
);

export function getResearchNode(researchKey: ResearchKey) {
	return DEFAULT_RESEARCH_REGISTRY.get(researchKey);
}

export function getResearchBranch(branchKey: ResearchBranchKey) {
	return DEFAULT_RESEARCH_BRANCH_REGISTRY.get(branchKey);
}

export function getResearchTier(args: { branchKey: ResearchBranchKey; tier: number }) {
	return getResearchBranch(args.branchKey)?.tiers.find((tier) => tier.tier === args.tier);
}

export function emptyResearchTierUnlockContext(): ResearchTierUnlockContext {
	return {
		coloniesFounded: 0,
		contractsCompleted: 0,
		defensesOwned: 0,
		highestBuildingLevel: 0,
		highestResearchDirectorateLevel: 0,
		shipsOwned: 0,
		successfulTransports: 0,
	};
}

function normalizeTierUnlockContext(
	context: Partial<ResearchTierUnlockContext> | undefined,
): ResearchTierUnlockContext {
	const defaults = emptyResearchTierUnlockContext();
	return {
		coloniesFounded: Math.max(0, Math.floor(context?.coloniesFounded ?? defaults.coloniesFounded)),
		contractsCompleted: Math.max(
			0,
			Math.floor(context?.contractsCompleted ?? defaults.contractsCompleted),
		),
		defensesOwned: Math.max(0, Math.floor(context?.defensesOwned ?? defaults.defensesOwned)),
		highestBuildingLevel: Math.max(
			0,
			Math.floor(context?.highestBuildingLevel ?? defaults.highestBuildingLevel),
		),
		highestResearchDirectorateLevel: Math.max(
			0,
			Math.floor(
				context?.highestResearchDirectorateLevel ?? defaults.highestResearchDirectorateLevel,
			),
		),
		shipsOwned: Math.max(0, Math.floor(context?.shipsOwned ?? defaults.shipsOwned)),
		successfulTransports: Math.max(
			0,
			Math.floor(context?.successfulTransports ?? defaults.successfulTransports),
		),
	};
}

export function isResearchTierUnlockSatisfied(
	rule: ResearchTierUnlockRule,
	contextInput?: Partial<ResearchTierUnlockContext>,
): boolean {
	const context = normalizeTierUnlockContext(contextInput);
	switch (rule.type) {
		case "always":
			return true;
		case "contractsCompleted":
			return context.contractsCompleted >= rule.count;
		case "highestBuildingLevelReached":
			return context.highestBuildingLevel >= rule.level;
		case "coloniesFounded":
			return context.coloniesFounded >= rule.count;
		case "highestResearchDirectorateLevelReached":
			return context.highestResearchDirectorateLevel >= rule.level;
		case "shipsOwned":
			return context.shipsOwned >= rule.count;
		case "defensesOwned":
			return context.defensesOwned >= rule.count;
		case "successfulTransports":
			return context.successfulTransports >= rule.count;
		case "all":
			return rule.rules.every((child) => isResearchTierUnlockSatisfied(child, context));
		case "any":
			return rule.rules.some((child) => isResearchTierUnlockSatisfied(child, context));
	}
}

function researchTierUnlockRequirementLabel(rule: ResearchTierUnlockRule): string {
	switch (rule.type) {
		case "always":
			return "Unlocked";
		case "contractsCompleted":
			return `Complete ${rule.count} contract${rule.count === 1 ? "" : "s"}`;
		case "highestBuildingLevelReached":
			return `Reach building level ${rule.level}`;
		case "coloniesFounded":
			return `Found ${rule.count} colon${rule.count === 1 ? "y" : "ies"}`;
		case "highestResearchDirectorateLevelReached":
			return `Reach Research Directorate level ${rule.level}`;
		case "shipsOwned":
			return `Own ${rule.count} ship${rule.count === 1 ? "" : "s"}`;
		case "defensesOwned":
			return `Own ${rule.count} defense${rule.count === 1 ? "" : "s"}`;
		case "successfulTransports":
			return `Complete ${rule.count} transport deliver${rule.count === 1 ? "y" : "ies"}`;
		case "all":
			return "Meet all tier requirements";
		case "any":
			return "Meet any tier requirement";
	}
}

export function getResearchTierUnlockRequirementStatuses(
	rule: ResearchTierUnlockRule,
	contextInput?: Partial<ResearchTierUnlockContext>,
	prefix = "tier",
): ResearchRequirementStatus[] {
	if (rule.type === "all" || rule.type === "any") {
		return rule.rules.flatMap((child, index) =>
			getResearchTierUnlockRequirementStatuses(child, contextInput, `${prefix}.${index}`),
		);
	}
	if (rule.type === "always") {
		return [];
	}
	return [
		{
			key: prefix,
			label: researchTierUnlockRequirementLabel(rule),
			met: isResearchTierUnlockSatisfied(rule, contextInput),
		},
	];
}

export function isResearchTierUnlocked(args: {
	branchKey: ResearchBranchKey;
	tier: number;
	tierUnlockContext?: Partial<ResearchTierUnlockContext>;
}) {
	const tier = getResearchTier(args);
	if (!tier) {
		return false;
	}
	return isResearchTierUnlockSatisfied(tier.unlock, args.tierUnlockContext);
}

export function isResearchUnlocked(
	levels: Partial<ResearchLevelMap> | undefined,
	researchKey: ResearchKey,
) {
	return Math.max(0, Math.floor(levels?.[researchKey] ?? 0)) > 0;
}

function arePrerequisitesComplete(
	levels: Partial<ResearchLevelMap> | undefined,
	node: ResearchNodeDefinition,
) {
	if (node.prerequisites.length === 0) {
		return true;
	}
	return node.prerequisites.every((prereq) => isResearchUnlocked(levels, prereq));
}

export function getResearchVisibility(args: {
	researchKey: ResearchKey;
	levels: Partial<ResearchLevelMap> | undefined;
	tierUnlockContext?: Partial<ResearchTierUnlockContext>;
}) {
	const node = getResearchNode(args.researchKey);
	if (!node) {
		return "hidden" as const;
	}
	if (isResearchUnlocked(args.levels, args.researchKey)) {
		return "visible" as const;
	}
	if (
		!isResearchTierUnlocked({
			branchKey: node.branch,
			tier: node.tier,
			tierUnlockContext: args.tierUnlockContext,
		})
	) {
		return "hidden" as const;
	}
	return arePrerequisitesComplete(args.levels, node)
		? ("silhouette" as const)
		: ("hidden" as const);
}

export function getResearchNodeRequirementStatuses(args: {
	combinedResearchCapacity: number;
	localResearchFacilityLevel: number;
	levels: Partial<ResearchLevelMap> | undefined;
	researchKey: ResearchKey;
	tierUnlockContext?: Partial<ResearchTierUnlockContext>;
}) {
	const node = getResearchNode(args.researchKey);
	if (!node) {
		return [
			{
				key: "node",
				label: "Unknown research node",
				met: false,
			},
		];
	}
	const tier = getResearchTier({ branchKey: node.branch, tier: node.tier });
	const requirements: ResearchRequirementStatus[] = [];
	if (tier) {
		requirements.push(
			...getResearchTierUnlockRequirementStatuses(
				tier.unlock,
				args.tierUnlockContext,
				`${node.branch}.${node.tier}`,
			),
		);
	}
	for (const prereq of node.prerequisites) {
		requirements.push({
			key: `prereq.${prereq}`,
			label: `Complete ${getResearchNode(prereq)?.name ?? prereq}`,
			met: isResearchUnlocked(args.levels, prereq),
		});
	}
	requirements.push({
		key: "facility.researchDirectorate",
		label: `Research Directorate level ${node.requiredResearchFacilityLevel}`,
		met: args.localResearchFacilityLevel >= node.requiredResearchFacilityLevel,
	});
	if (typeof node.requiredCombinedResearchCapacity === "number") {
		requirements.push({
			key: "combinedResearchCapacity",
			label: `Combined research capacity ${node.requiredCombinedResearchCapacity}`,
			met: args.combinedResearchCapacity >= node.requiredCombinedResearchCapacity,
		});
	}
	return requirements;
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
	tierUnlockContext?: Partial<ResearchTierUnlockContext>;
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
		!isResearchTierUnlocked({
			branchKey: node.branch,
			tier: node.tier,
			tierUnlockContext: args.tierUnlockContext,
		})
	) {
		return false;
	}
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
