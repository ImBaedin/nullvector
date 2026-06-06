import type { DefenseKey } from "./defenses";
import type { BuildingKey, FacilityKey, ResourceBucket, ShipKey } from "./gameplay";
import type { ResourceKey, UnlockRule } from "./types";

import { DEFENSE_KEYS } from "./defenses";
import { SHIP_KEYS } from "./gameplay";
import { isUnlockSatisfied } from "./unlocks";

export const META_MATTER_RARITIES = ["common", "rare", "mythic"] as const;

export type MetaMatterRarity = (typeof META_MATTER_RARITIES)[number];
export type MetaMatterBundle = Record<MetaMatterRarity, number>;
export type ResearchLevelMap = Record<string, number>;
export type ResearchImplementationStatus = "active" | "planned";
export type ColonyCharterKey = "industrial" | "refinery" | "research" | "naval" | "defensive";
export type IndustrialFocusKey = "alloy" | "crystal" | "fuel";
export type RouteClass = "local" | "interSystem" | "interSector" | "interGalactic";

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
	| { kind: "research_network_synchronization" }
	| { kind: "meta_matter_reward_multiplier"; multiplier: number; rarity?: MetaMatterRarity }
	| { kind: "energy_consumption_multiplier"; multiplier: number }
	| {
			kind: "storage_pressure_production_bonus";
			fullBonusBelow: number;
			maxBonus: number;
			zeroBonusAt: number;
	  }
	| { kind: "overflow_reintegration_multiplier"; multiplier: number }
	| { kind: "idle_building_queue_speed_bonus"; bonusPerIdleSlot: number; cap: number }
	| { kind: "building_queue_capacity_bonus"; amount: number }
	| { kind: "shipyard_queue_capacity_bonus"; amount: number; minShipyardLevel?: number }
	| { kind: "colony_count_production_bonus"; bonusPerExtraColony: number; cap: number }
	| { kind: "industrial_focus_unlock"; productionMultiplier: number; offFocusMultiplier: number }
	| {
			kind: "active_command_window";
			productionMultiplier: number;
			durationMinutes: number;
			scope: "colony" | "account";
	  }
	| { kind: "research_network_duration"; percentPerSite: number; freeSites: number; cap: number }
	| {
			kind: "research_cost_multiplier";
			metaMatterMultiplier: number;
			tierMax?: number;
			rarities?: MetaMatterRarity[];
	  }
	| {
			kind: "ship_stat_multiplier";
			stat: "attack" | "hull" | "shield";
			multiplier: number;
			shipKey?: ShipKey;
	  }
	| {
			kind: "defense_stat_multiplier";
			stat: "attack" | "hull" | "shield";
			multiplier: number;
			defenseKey?: DefenseKey;
	  }
	| {
			kind: "interceptor_wolfpack";
			minInterceptors: number;
			minShare: number;
			attackMultiplier?: number;
			hullMultiplier?: number;
			fuelMultiplier?: number;
	  }
	| { kind: "enemy_attack_multiplier"; multiplier: number }
	| { kind: "contract_active_limit_bonus"; amount: number }
	| { kind: "contract_visible_slot_bonus"; amount: number }
	| { kind: "contract_dispatch_fuel_multiplier"; multiplier: number }
	| { kind: "contract_recovery_resources"; recoveryRate: number }
	| { kind: "contract_ship_capture"; chance: number; eligibleShips: ShipKey[]; maxShips: number }
	| { kind: "contract_task_force_template_bonus"; fuelMultiplier: number; rewardMultiplier: number }
	| { kind: "meta_matter_bonus_chance"; rarity: MetaMatterRarity; chance: number; amount: number }
	| { kind: "research_predictive_progress"; progressFraction: number }
	| {
			kind: "research_cross_branch_discount";
			durationMultiplier: number;
			metaMatterMultiplier: number;
	  }
	| {
			kind: "meta_matter_daily_conversion";
			from: MetaMatterRarity;
			to: MetaMatterRarity;
			fromAmount: number;
			toAmount: number;
	  }
	| {
			kind: "research_network_exchange_duration";
			perSiteMultiplier: number;
			capMultiplier: number;
			minResearchSites: number;
	  }
	| { kind: "route_speed_multiplier"; routeClass: RouteClass; multiplier: number }
	| { kind: "route_streak_speed_bonus"; multiplierPerLevel: number; capMultiplier: number }
	| { kind: "transport_extra_stop_bonus"; amount: number; fuelMultiplierPerStop: number }
	| { kind: "transport_delivery_distance_bonus"; percentPerDistance: number; capMultiplier: number }
	| { kind: "transport_storage_reservation"; multiplier: number }
	| {
			kind: "contract_after_transport_meta_matter_multiplier";
			multiplier: number;
			durationHours: number;
	  }
	| { kind: "transport_return_duration_multiplier"; multiplier: number }
	| { kind: "colony_ship_build_time_multiplier"; multiplier: number }
	| { kind: "colony_ship_fuel_multiplier"; multiplier: number }
	| { kind: "colony_overcap_penalty_reduction"; amount: number }
	| { kind: "colony_charter_unlock"; productionMultiplier: number; penaltyMultiplier: number }
	| { kind: "colony_charter_penalty_removed" }
	| { kind: "charter_facility_upgrade_time_multiplier"; multiplier: number }
	| { kind: "charter_cooldown_hours"; hours: number }
	| { kind: "charter_ship_build_time_multiplier"; multiplier: number }
	| { kind: "charter_defense_build_time_multiplier"; multiplier: number }
	| {
			kind: "new_colony_bootstrap";
			buildingLevel: number;
			storageLevel: number;
			roboticsHubLevel?: number;
			logisticsNexusLevel?: number;
	  }
	| { kind: "new_colony_prefab_queue"; queuedBuildingUpgrades: number }
	| { kind: "protected_starting_resources"; storageFraction: number; durationHours: number }
	| { kind: "charter_transport_reservation"; storageFraction: number }
	| { kind: "colony_cap_bonus"; amount: number; minColonies: number }
	| {
			kind: "sector_capital_production";
			capitalMultiplier: number;
			sectorColonyMultiplier: number;
	  };

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
	| { type: "rankedContractsCompleted"; minRank: number; count: number }
	| { type: "raidDefensesSucceeded"; count: number }
	| { type: "highestBuildingLevelReached"; level: number }
	| { type: "resourceProductionBuildingLevelReached"; level: number }
	| { type: "storageBuildingLevelReached"; level: number }
	| { type: "resourceAndStorageLevelTotalReached"; level: number }
	| { type: "coloniesFounded"; count: number }
	| { type: "colonyInDifferentSystemFounded" }
	| { type: "colonyInDifferentSectorFounded" }
	| { type: "researchNetworkSize"; count: number }
	| { type: "highestResearchDirectorateLevelReached"; level: number }
	| { type: "facilityLevelReached"; level: number; facilityKey?: FacilityKey }
	| { type: "facilityLevelTotalOnOneColonyReached"; level: number }
	| { type: "shipsOwned"; count: number }
	| { type: "defensesOwned"; count: number }
	| { type: "successfulTransports"; count: number }
	| { type: "metaMatterSpentTotal"; amount: number }
	| { type: "metaMatterEarnedByRarity"; rarity: MetaMatterRarity; amount: number }
	| { type: "all"; rules: readonly ResearchTierUnlockRule[] }
	| { type: "any"; rules: readonly ResearchTierUnlockRule[] };

export type ResearchTierUnlockContext = {
	coloniesFounded: number;
	contractsCompleted: number;
	crossSectorColoniesFounded: number;
	crossSystemColoniesFounded: number;
	defensesOwned: number;
	facilityLevelTotalOnOneColony: number;
	highestBuildingLevel: number;
	highestFacilityLevel: number;
	highestResearchDirectorateLevel: number;
	maxResourceAndStorageLevelTotal: number;
	maxResourceProductionBuildingLevel: number;
	maxStorageBuildingLevel: number;
	metaMatterEarnedCommon: number;
	metaMatterEarnedMythic: number;
	metaMatterEarnedRare: number;
	metaMatterSpentTotal: number;
	raidDefensesSucceeded: number;
	rank3ContractsCompleted: number;
	researchNetworkSize: number;
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
	researchNetworkSynchronizationUnlocked: boolean;
	energyConsumptionMultiplier: number;
	storagePressureProductionBonus?: Extract<
		ResearchEffect,
		{ kind: "storage_pressure_production_bonus" }
	>;
	overflowReintegrationMultiplier: number;
	idleBuildingQueueSpeedBonus?: Extract<
		ResearchEffect,
		{ kind: "idle_building_queue_speed_bonus" }
	>;
	buildingQueueCapacityBonus: number;
	shipyardQueueCapacityBonus: number;
	colonyCountProductionBonuses: Array<
		Extract<ResearchEffect, { kind: "colony_count_production_bonus" }>
	>;
	industrialFocus?: Extract<ResearchEffect, { kind: "industrial_focus_unlock" }>;
	activeCommandWindow?: Extract<ResearchEffect, { kind: "active_command_window" }>;
	researchNetworkDuration?: Extract<ResearchEffect, { kind: "research_network_duration" }>;
	researchCostMultipliers: Array<Extract<ResearchEffect, { kind: "research_cost_multiplier" }>>;
	shipStatMultipliers: Record<ShipKey, { attack: number; hull: number; shield: number }>;
	globalShipStatMultipliers: { attack: number; hull: number; shield: number };
	defenseStatMultipliers: Record<DefenseKey, { attack: number; hull: number; shield: number }>;
	globalDefenseStatMultipliers: { attack: number; hull: number; shield: number };
	interceptorWolfpack?: Extract<ResearchEffect, { kind: "interceptor_wolfpack" }>;
	enemyAttackMultiplier: number;
	contractActiveLimitBonus: number;
	contractVisibleSlotBonus: number;
	contractDispatchFuelMultiplier: number;
	contractRecoveryRate: number;
	contractShipCapture?: Extract<ResearchEffect, { kind: "contract_ship_capture" }>;
	contractTaskForceTemplateBonus?: Extract<
		ResearchEffect,
		{ kind: "contract_task_force_template_bonus" }
	>;
	metaMatterBonusChances: Array<Extract<ResearchEffect, { kind: "meta_matter_bonus_chance" }>>;
	researchPredictiveProgressFraction: number;
	researchCrossBranchDiscount?: Extract<ResearchEffect, { kind: "research_cross_branch_discount" }>;
	metaMatterDailyConversion?: Extract<ResearchEffect, { kind: "meta_matter_daily_conversion" }>;
	researchNetworkExchange?: Extract<ResearchEffect, { kind: "research_network_exchange_duration" }>;
	routeSpeedMultipliers: Record<RouteClass, number>;
	routeStreakSpeedBonus?: Extract<ResearchEffect, { kind: "route_streak_speed_bonus" }>;
	transportExtraStops: number;
	transportExtraStopFuelMultiplier: number;
	transportDeliveryDistanceBonus?: Extract<
		ResearchEffect,
		{ kind: "transport_delivery_distance_bonus" }
	>;
	transportStorageReservationMultiplier: number;
	contractAfterTransportMetaMatterMultiplier?: Extract<
		ResearchEffect,
		{ kind: "contract_after_transport_meta_matter_multiplier" }
	>;
	transportReturnDurationMultiplier: number;
	colonyShipBuildTimeMultiplier: number;
	colonyShipFuelMultiplier: number;
	colonyOvercapPenaltyReduction: number;
	colonyCharter?: Extract<ResearchEffect, { kind: "colony_charter_unlock" }>;
	colonyCharterPenaltyRemoved: boolean;
	charterFacilityUpgradeTimeMultiplier: number;
	charterCooldownHours?: number;
	charterShipBuildTimeMultiplier: number;
	charterDefenseBuildTimeMultiplier: number;
	newColonyBootstrap?: Extract<ResearchEffect, { kind: "new_colony_bootstrap" }>;
	newColonyPrefabQueue?: Extract<ResearchEffect, { kind: "new_colony_prefab_queue" }>;
	protectedStartingResources?: Extract<ResearchEffect, { kind: "protected_starting_resources" }>;
	charterTransportReservation?: Extract<ResearchEffect, { kind: "charter_transport_reservation" }>;
	colonyCapBonus: number;
	sectorCapitalProduction?: Extract<ResearchEffect, { kind: "sector_capital_production" }>;
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
	requiredResearchFacilityLevel?: number;
	requiredCombinedResearchCapacity?: number;
	costs: readonly ResearchNodeCost[];
	effects: readonly ResearchEffect[];
	effectsByLevel?: readonly (readonly ResearchEffect[])[];
	effectLabels?: readonly string[];
	implementationStatus?: ResearchImplementationStatus;
	plannedReason?: string;
	designPrerequisites?: readonly string[];
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
							description: "Links separate research sites into an empire-wide research network.",
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
							effects: [{ kind: "research_network_synchronization" }],
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

void AUTHORED_RESEARCH_TREE;

const RESEARCH_BRANCH_KEY_LIST = [
	"appliedIndustry",
	"militarySystems",
	"scientificInfrastructure",
	"expansionLogistics",
	"colonySpecialization",
] as const;

export type ResearchBranchKey = (typeof RESEARCH_BRANCH_KEY_LIST)[number];
export type ResearchKey = string;

type ResearchCostShape = "standard" | "capstone";

const BRANCH_RESOURCE_WEIGHTS = {
	appliedIndustry: { alloy: 0.45, crystal: 0.35, fuel: 0.2 },
	militarySystems: { alloy: 0.5, crystal: 0.3, fuel: 0.2 },
	scientificInfrastructure: { alloy: 0.25, crystal: 0.65, fuel: 0.1 },
	expansionLogistics: { alloy: 0.35, crystal: 0.3, fuel: 0.35 },
	colonySpecialization: { alloy: 0.4, crystal: 0.4, fuel: 0.2 },
} satisfies Record<ResearchBranchKey, Record<keyof ResourceBucket, number>>;

const RESEARCH_TIER_COST_BASE = {
	1: { metaMatter: { common: 4 }, resourcesTotal: 300, seconds: 180 },
	2: { metaMatter: { common: 12, rare: 1 }, resourcesTotal: 1_000, seconds: 720 },
	3: { metaMatter: { rare: 6 }, resourcesTotal: 2_500, seconds: 1_800 },
	4: { metaMatter: { rare: 12, mythic: 2 }, resourcesTotal: 5_000, seconds: 4_200 },
} satisfies Record<
	1 | 2 | 3 | 4,
	{ metaMatter: Partial<MetaMatterBundle>; resourcesTotal: number; seconds: number }
>;

const RESEARCH_LEVEL_COST_MULTIPLIERS = [1, 1.7, 2.8] as const;

const RESEARCH_TIER_BALANCE_MULTIPLIERS = {
	1: { metaMatter: 4, resources: 3, seconds: 10 },
	2: { metaMatter: 8, resources: 4, seconds: 15 },
	3: { metaMatter: 10, resources: 5, seconds: 20 },
	4: { metaMatter: 10, resources: 5, seconds: 25 },
} satisfies Record<1 | 2 | 3 | 4, { metaMatter: number; resources: number; seconds: number }>;

export function makeResearchCosts(args: {
	branch: ResearchBranchKey;
	maxLevel: number;
	shape?: ResearchCostShape;
	tier: 1 | 2 | 3 | 4;
}): ResearchNodeCost[] {
	const base = RESEARCH_TIER_COST_BASE[args.tier];
	const tierMultipliers = RESEARCH_TIER_BALANCE_MULTIPLIERS[args.tier];
	const weights = BRANCH_RESOURCE_WEIGHTS[args.branch];
	const shapeMultiplier = args.shape === "capstone" ? 2 : 1;
	const costs: ResearchNodeCost[] = [];
	for (let index = 0; index < args.maxLevel; index += 1) {
		const levelMultiplier =
			RESEARCH_LEVEL_COST_MULTIPLIERS[
				Math.min(index, RESEARCH_LEVEL_COST_MULTIPLIERS.length - 1)
			] ?? 1;
		const multiplier = levelMultiplier * shapeMultiplier;
		const baseMetaMatter: Partial<MetaMatterBundle> = base.metaMatter;
		const metaMatter: Partial<MetaMatterBundle> = {};
		for (const rarity of META_MATTER_RARITIES) {
			const amount = baseMetaMatter[rarity];
			if (typeof amount === "number" && amount > 0) {
				metaMatter[rarity] = Math.max(
					1,
					Math.round(amount * multiplier * tierMultipliers.metaMatter),
				);
			}
		}
		costs.push({
			metaMatter,
			resources: {
				alloy: Math.max(
					1,
					Math.round(base.resourcesTotal * weights.alloy * multiplier * tierMultipliers.resources),
				),
				crystal: Math.max(
					1,
					Math.round(
						base.resourcesTotal * weights.crystal * multiplier * tierMultipliers.resources,
					),
				),
				fuel: Math.max(
					1,
					Math.round(base.resourcesTotal * weights.fuel * multiplier * tierMultipliers.resources),
				),
			},
			seconds: Math.max(1, Math.round(base.seconds * multiplier * tierMultipliers.seconds)),
		});
	}
	return costs;
}

function branchThemes(branch: ResearchBranchKey): Omit<AuthoredResearchBranch, "tiers"> {
	const themes = {
		appliedIndustry: {
			label: "Applied Industry",
			shortLabel: "Industry",
			themeColor: "#ff914f",
			themeColorSoft: "#3d2418",
			ditherWaveColor: [1, 0.57, 0.31],
			ditherPixelSize: 5,
		},
		militarySystems: {
			label: "Military Systems",
			shortLabel: "Military",
			themeColor: "#f05252",
			themeColorSoft: "#3b1f25",
			ditherWaveColor: [0.94, 0.32, 0.32],
			ditherPixelSize: 4,
		},
		scientificInfrastructure: {
			label: "Scientific Infrastructure",
			shortLabel: "Science",
			themeColor: "#6ee7b7",
			themeColorSoft: "#18352d",
			ditherWaveColor: [0.43, 0.91, 0.72],
			ditherPixelSize: 6,
		},
		expansionLogistics: {
			label: "Expansion Logistics",
			shortLabel: "Logistics",
			themeColor: "#38bdf8",
			themeColorSoft: "#183344",
			ditherWaveColor: [0.22, 0.74, 0.97],
			ditherPixelSize: 5,
		},
		colonySpecialization: {
			label: "Colony Specialization",
			shortLabel: "Colony",
			themeColor: "#facc15",
			themeColorSoft: "#3a3215",
			ditherWaveColor: [0.98, 0.8, 0.08],
			ditherPixelSize: 4,
		},
	} satisfies Record<ResearchBranchKey, Omit<AuthoredResearchBranch, "tiers">>;
	return themes[branch];
}

function researchNetworkRequirementForTier(tier: 1 | 2 | 3 | 4) {
	if (tier >= 3) {
		return 5;
	}
	if (tier === 2) {
		return 3;
	}
	return 1;
}

function authoredNode(
	args: Omit<AuthoredResearchNode, "costs" | "effects"> & {
		branch: ResearchBranchKey;
		tier: 1 | 2 | 3 | 4;
	},
) {
	const effectsByLevel = args.effectsByLevel ?? [];
	const implementationStatus =
		args.implementationStatus ??
		(effectsByLevel.flat().some((effect) => UNIMPLEMENTED_RESEARCH_EFFECT_KINDS.has(effect.kind))
			? "planned"
			: "active");
	return {
		id: args.id,
		name: args.name,
		description: args.description,
		layout: args.layout,
		prerequisites: args.prerequisites,
		maxLevel: args.maxLevel,
		costs: makeResearchCosts({
			branch: args.branch,
			tier: args.tier,
			maxLevel: args.maxLevel,
			shape: args.layout.shape === "capstone" ? "capstone" : "standard",
		}),
		effects: effectsByLevel.flat(),
		effectsByLevel,
		effectLabels: args.effectLabels,
		implementationStatus,
		plannedReason: args.plannedReason,
		designPrerequisites: args.designPrerequisites ?? args.prerequisites,
	} satisfies AuthoredResearchNode;
}

function plannedReason(reason: string) {
	return {
		implementationStatus: "planned" as const,
		plannedReason: reason,
	};
}

const UNIMPLEMENTED_RESEARCH_EFFECT_KINDS = new Set<ResearchEffect["kind"]>([
	"active_command_window",
	"charter_cooldown_hours",
	"charter_defense_build_time_multiplier",
	"charter_facility_upgrade_time_multiplier",
	"charter_ship_build_time_multiplier",
	"charter_transport_reservation",
	"colony_cap_bonus",
	"colony_charter_penalty_removed",
	"colony_charter_unlock",
	"colony_count_production_bonus",
	"colony_overcap_penalty_reduction",
	"colony_ship_build_time_multiplier",
	"colony_ship_fuel_multiplier",
	"contract_after_transport_meta_matter_multiplier",
	"idle_building_queue_speed_bonus",
	"industrial_focus_unlock",
	"meta_matter_bonus_chance",
	"new_colony_bootstrap",
	"new_colony_prefab_queue",
	"overflow_reintegration_multiplier",
	"protected_starting_resources",
	"research_cost_multiplier",
	"research_cross_branch_discount",
	"research_network_duration",
	"research_network_exchange_duration",
	"research_network_synchronization",
	"research_predictive_progress",
	"route_streak_speed_bonus",
	"sector_capital_production",
	"shipyard_queue_capacity_bonus",
	"transport_extra_stop_bonus",
	"transport_storage_reservation",
	"unlock_building",
	"unlock_facility",
]);

function buildResearchTierThreeTree() {
	const planned = {
		boosters: plannedReason("Resource production boosting buildings do not exist yet."),
		fuelPlant: plannedReason("The fuelTurbinePlant facility/building does not exist yet."),
		galacticRoutes: plannedReason("Galactic route modeling is not available in current worldgen."),
		stargates: plannedReason("Fixed-route gate projects do not exist yet."),
		terraformer: plannedReason(
			"Terraformer facilities and planet trait mitigation do not exist yet.",
		),
	};
	const node = authoredNode;
	const branches: Record<ResearchBranchKey, AuthoredResearchBranch> = {
		appliedIndustry: {
			...branchThemes("appliedIndustry"),
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						node({
							branch: "appliedIndustry",
							tier: 1,
							id: "automatedSmelting",
							name: "Automated Smelting",
							description: "Machine-tuned alloy furnaces stabilize high-volume extraction.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "alloy", multiplier: 1.06 }],
							],
							effectLabels: [
								"Alloy production +6% per level",
								"Level 3 prepares future alloy boost buildings",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 1,
							id: "crystalLatticeRefinement",
							name: "Crystal Lattice Refinement",
							description: "Refined growth templates increase usable crystal yield.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "crystal", multiplier: 1.06 }],
							],
							effectLabels: [
								"Crystal production +6% per level",
								"Level 3 prepares future crystal boost buildings",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 1,
							id: "refineryFlowControl",
							name: "Refinery Flow Control",
							description: "Dynamic refinery routing extracts more fuel from volatile deposits.",
							layout: { lane: "bridgeLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "resource_production_multiplier", resource: "fuel", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "fuel", multiplier: 1.06 }],
								[{ kind: "resource_production_multiplier", resource: "fuel", multiplier: 1.06 }],
							],
							effectLabels: [
								"Fuel production +6% per level",
								"Level 3 prepares future fuel boost buildings",
							],
						}),
					],
				},
				{
					tier: 2,
					unlock: {
						type: "all",
						rules: [
							{ type: "resourceProductionBuildingLevelReached", level: 20 },
							{ type: "storageBuildingLevelReached", level: 12 },
						],
					},
					nodes: [
						node({
							branch: "appliedIndustry",
							tier: 2,
							id: "gridLoadBalancing",
							name: "Grid Load Balancing",
							description: "Predictive load shedding cuts mine and refinery energy demand.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["refineryFlowControl"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "energy_consumption_multiplier", multiplier: 0.88 }],
								[{ kind: "energy_consumption_multiplier", multiplier: 0.88 }],
							],
							effectLabels: ["Mine and refinery energy demand -12% per level"],
						}),
						node({
							branch: "appliedIndustry",
							tier: 2,
							id: "modularAssemblyStandards",
							name: "Modular Assembly Standards",
							description: "Common upgrade modules reduce site-specific construction delays.",
							layout: { lane: "outerLeft", shape: "circle" },
							prerequisites: ["automatedSmelting", "crystalLatticeRefinement"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "building_upgrade_time_multiplier", multiplier: 0.92 }],
								[{ kind: "building_upgrade_time_multiplier", multiplier: 0.92 }],
								[
									{ kind: "building_upgrade_time_multiplier", multiplier: 0.92 },
									{ kind: "building_queue_capacity_bonus", amount: 1 },
								],
							],
							effectLabels: [
								"Building upgrade duration -8% per level",
								"Level 3 grants +1 building queue slot",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 2,
							id: "scarcityDrivenThroughput",
							name: "Scarcity Driven Throughput",
							description: "Low stockpiles automatically prioritize the resource under pressure.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: [
								"automatedSmelting",
								"crystalLatticeRefinement",
								"refineryFlowControl",
							],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "storage_pressure_production_bonus",
										fullBonusBelow: 0.3,
										maxBonus: 0.25,
										zeroBonusAt: 0.8,
									},
								],
								[
									{
										kind: "storage_pressure_production_bonus",
										fullBonusBelow: 0.45,
										maxBonus: 0.25,
										zeroBonusAt: 0.8,
									},
								],
							],
							effectLabels: [
								"Low non-energy storage gives up to +25% matching production",
								"Level 2 raises the full-bonus threshold to 45% storage",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 2,
							id: "boosterAnnexBlueprints",
							name: "Booster Annex Blueprints",
							description: "Blueprints for specialized resource production annexes.",
							layout: { lane: "innerRight", shape: "square" },
							prerequisites: [
								"automatedSmelting",
								"crystalLatticeRefinement",
								"refineryFlowControl",
							],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks the future resource production boosting building family"],
							...planned.boosters,
						}),
						node({
							branch: "appliedIndustry",
							tier: 2,
							id: "storageCompressionLattices",
							name: "Storage Compression Lattices",
							description: "Compact lattice vaults stretch local storage without wider footprint.",
							layout: { lane: "outerRight", shape: "circle" },
							prerequisites: ["gridLoadBalancing"],
							maxLevel: 3,
							effectsByLevel: [
								[
									{ kind: "resource_storage_multiplier", resource: "alloy", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "crystal", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "fuel", multiplier: 1.15 },
								],
								[
									{ kind: "resource_storage_multiplier", resource: "alloy", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "crystal", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "fuel", multiplier: 1.15 },
								],
								[
									{ kind: "resource_storage_multiplier", resource: "alloy", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "crystal", multiplier: 1.15 },
									{ kind: "resource_storage_multiplier", resource: "fuel", multiplier: 1.15 },
									{ kind: "overflow_reintegration_multiplier", multiplier: 2 },
								],
							],
							effectLabels: [
								"All storage +15% per level",
								"Level 3 doubles overflow reintegration rate",
							],
						}),
					],
				},
				{
					tier: 3,
					unlock: {
						type: "all",
						rules: [{ type: "resourceAndStorageLevelTotalReached", level: 100 }],
					},
					nodes: [
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "distributedRobotics",
							name: "Distributed Robotics",
							description: "Robotic maintenance swarms extend mature industrial infrastructure.",
							layout: { lane: "outerLeft", shape: "square" },
							prerequisites: ["modularAssemblyStandards", "storageCompressionLattices"],
							designPrerequisites: ["modularAssemblyStandards", "boosterAnnexBlueprints"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{ kind: "building_max_level_bonus", buildingKey: "alloyMineLevel", amount: 5 },
									{ kind: "building_max_level_bonus", buildingKey: "crystalMineLevel", amount: 5 },
									{ kind: "building_max_level_bonus", buildingKey: "fuelRefineryLevel", amount: 5 },
									{ kind: "facility_max_level_bonus", facilityKey: "robotics_hub", amount: 2 },
								],
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "adaptiveAssemblySchedules",
							name: "Adaptive Assembly Schedules",
							description: "Idle construction teams are reassigned to active upgrade bottlenecks.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: ["modularAssemblyStandards", "gridLoadBalancing"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "idle_building_queue_speed_bonus", bonusPerIdleSlot: 0.04, cap: 0.12 }],
								[{ kind: "idle_building_queue_speed_bonus", bonusPerIdleSlot: 0.08, cap: 0.24 }],
								[
									{ kind: "idle_building_queue_speed_bonus", bonusPerIdleSlot: 0.12, cap: 0.36 },
									{ kind: "building_queue_capacity_bonus", amount: 1 },
								],
							],
							effectLabels: [
								"Idle building queue slots reduce building duration",
								"Level 3 grants +1 building queue slot",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "industrialNetworkEffects",
							name: "Industrial Network Effects",
							description: "Every colony improves procurement and throughput across the empire.",
							layout: { lane: "bridgeLeft", shape: "hex" },
							prerequisites: ["scarcityDrivenThroughput", "storageCompressionLattices"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "colony_count_production_bonus", bonusPerExtraColony: 0.05, cap: 0.25 }],
								[{ kind: "colony_count_production_bonus", bonusPerExtraColony: 0.05, cap: 0.4 }],
								[{ kind: "colony_count_production_bonus", bonusPerExtraColony: 0.05, cap: 0.6 }],
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "wasteHeatRecoveryGrid",
							name: "Waste Heat Recovery Grid",
							description: "Fuel turbine exhaust is reclaimed for additional local production.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: ["thermalExchangePlants", "storageCompressionLattices"],
							maxLevel: 2,
							effectsByLevel: [[]],
							effectLabels: [
								"Fuel-consuming power plants use less fuel and can convert excess energy into production",
							],
							...planned.fuelPlant,
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "thermalExchangePlants",
							name: "Thermal Exchange Plants",
							description: "Blueprints for fuel-consuming power generation under energy deficits.",
							layout: { lane: "bridgeRight", shape: "hex" },
							prerequisites: ["gridLoadBalancing", "refineryFlowControl"],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks the future fuelTurbinePlant"],
							...planned.fuelPlant,
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "planetaryScaleFabrication",
							name: "Planetary Scale Fabrication",
							description: "Facility fabrication moves to repeatable planet-wide standards.",
							layout: { lane: "outerRight", shape: "square" },
							prerequisites: ["distributedRobotics", "industrialNetworkEffects"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "facility_upgrade_time_multiplier",
										facilityKey: "robotics_hub",
										multiplier: 0.88,
									},
									{
										kind: "facility_upgrade_time_multiplier",
										facilityKey: "research_directorate",
										multiplier: 0.88,
									},
								],
								[
									{
										kind: "facility_upgrade_time_multiplier",
										facilityKey: "robotics_hub",
										multiplier: 0.88,
									},
									{
										kind: "facility_upgrade_time_multiplier",
										facilityKey: "research_directorate",
										multiplier: 0.88,
									},
									{ kind: "facility_max_level_bonus", facilityKey: "robotics_hub", amount: 1 },
									{
										kind: "facility_max_level_bonus",
										facilityKey: "defense_grid",
										amount: 1,
									},
								],
							],
							effectLabels: [
								"Selected facility upgrade duration -12% per level",
								"Level 2 adds +1 max level to robotics and defense facilities",
							],
						}),
						node({
							branch: "appliedIndustry",
							tier: 3,
							id: "industrialFoundryProtocol",
							name: "Industrial Foundry Protocol",
							description:
								"Colonies may specialize one industrial resource at a controlled tradeoff.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: [
								"distributedRobotics",
								"industrialNetworkEffects",
								"planetaryScaleFabrication",
							],
							maxLevel: 1,
							effectsByLevel: [
								[
									{
										kind: "industrial_focus_unlock",
										productionMultiplier: 1.3,
										offFocusMultiplier: 0.9,
									},
								],
							],
						}),
					],
				},
			],
		},
		militarySystems: {
			...branchThemes("militarySystems"),
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						node({
							branch: "militarySystems",
							tier: 1,
							id: "pointDefenseTheory",
							name: "Point Defense Theory",
							description: "Compact tracking and power systems enable laser turret deployment.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [[{ kind: "unlock_defense", defenseKey: "laserTurret" }]],
						}),
						node({
							branch: "militarySystems",
							tier: 1,
							id: "missileGuidanceSuites",
							name: "Missile Guidance Suites",
							description: "Fire-control improvements unlock frigate-class combat hulls.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [[{ kind: "unlock_ship", shipKey: "frigate" }]],
						}),
						node({
							branch: "militarySystems",
							tier: 1,
							id: "interceptorWolfpackDoctrine",
							name: "Interceptor Wolfpack Doctrine",
							description: "Interceptor groups coordinate strikes when deployed as the core force.",
							layout: { lane: "bridgeLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[
									{
										kind: "interceptor_wolfpack",
										minInterceptors: 5,
										minShare: 0.5,
										attackMultiplier: 1.2,
									},
								],
								[
									{
										kind: "interceptor_wolfpack",
										minInterceptors: 5,
										minShare: 0.5,
										hullMultiplier: 1.15,
									},
								],
								[
									{
										kind: "interceptor_wolfpack",
										minInterceptors: 5,
										minShare: 0.5,
										fuelMultiplier: 0.8,
									},
								],
							],
						}),
					],
				},
				{
					tier: 2,
					unlock: {
						type: "all",
						rules: [
							{ type: "contractsCompleted", count: 15 },
							{ type: "raidDefensesSucceeded", count: 15 },
						],
					},
					nodes: [
						node({
							branch: "militarySystems",
							tier: 2,
							id: "contractTriageCommand",
							name: "Contract Triage Command",
							description: "Dispatch doctrine strips waste from combat contract launches.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["interceptorWolfpackDoctrine"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "contract_dispatch_fuel_multiplier", multiplier: 0.9 }],
								[{ kind: "contract_dispatch_fuel_multiplier", multiplier: 0.9 }],
							],
							effectLabels: [
								"Contract dispatch fuel -10% per level",
								"Level 2 improves recommendation safety margins",
							],
						}),
						node({
							branch: "militarySystems",
							tier: 2,
							id: "reactorHardenedHulls",
							name: "Reactor Hardened Hulls",
							description: "Reactor shielding doubles as structural reinforcement.",
							layout: { lane: "outerLeft", shape: "circle" },
							prerequisites: ["missileGuidanceSuites"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "ship_stat_multiplier", stat: "hull", multiplier: 1.08 }],
								[{ kind: "ship_stat_multiplier", stat: "hull", multiplier: 1.08 }],
								[
									{ kind: "ship_stat_multiplier", stat: "hull", multiplier: 1.08 },
									{ kind: "ship_stat_multiplier", stat: "shield", multiplier: 1.05 },
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 2,
							id: "shieldFieldModulation",
							name: "Shield Field Modulation",
							description: "Shield modulation opens heavier defense emplacements.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: ["pointDefenseTheory", "reactorHardenedHulls"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{ kind: "unlock_defense", defenseKey: "gaussCannon" },
									{ kind: "unlock_defense", defenseKey: "shieldDome" },
									{ kind: "defense_build_time_multiplier", multiplier: 0.92 },
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 2,
							id: "targetSolutionEngines",
							name: "Target Solution Engines",
							description: "Battle computers improve firing calculations across combat ships.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: ["interceptorWolfpackDoctrine"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "ship_stat_multiplier", stat: "attack", multiplier: 1.06 }],
								[{ kind: "ship_stat_multiplier", stat: "attack", multiplier: 1.06 }],
								[
									{ kind: "ship_stat_multiplier", stat: "attack", multiplier: 1.06 },
									{
										kind: "ship_stat_multiplier",
										stat: "attack",
										shipKey: "interceptor",
										multiplier: 1.1,
									},
									{
										kind: "ship_stat_multiplier",
										stat: "attack",
										shipKey: "frigate",
										multiplier: 1.1,
									},
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 2,
							id: "battlefieldRecoveryCrews",
							name: "Battlefield Recovery Crews",
							description: "Recovery teams reclaim usable alloys and crystals after victories.",
							layout: { lane: "outerRight", shape: "square" },
							prerequisites: ["contractTriageCommand"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "contract_recovery_resources", recoveryRate: 0.1 }],
								[{ kind: "contract_recovery_resources", recoveryRate: 0.2 }],
							],
						}),
					],
				},
				{
					tier: 3,
					unlock: {
						type: "all",
						rules: [
							{ type: "contractsCompleted", count: 40 },
							{ type: "rankedContractsCompleted", minRank: 3, count: 5 },
							{ type: "shipsOwned", count: 500 },
						],
					},
					nodes: [
						node({
							branch: "militarySystems",
							tier: 3,
							id: "advancedStrikeCraft",
							name: "Advanced Strike Craft",
							description: "Heavy assault frames move from prototype to deployable doctrine.",
							layout: { lane: "outerLeft", shape: "hex" },
							prerequisites: ["shieldFieldModulation", "targetSolutionEngines"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{ kind: "unlock_ship", shipKey: "cruiser" },
									{ kind: "unlock_ship", shipKey: "bomber" },
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "munitionsThroughput",
							name: "Munitions Throughput",
							description: "Standardized ordnance lines accelerate combat ship construction.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: ["reactorHardenedHulls", "targetSolutionEngines"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "ship_build_time_multiplier", multiplier: 0.92 }],
								[{ kind: "ship_build_time_multiplier", multiplier: 0.92 }],
								[
									{ kind: "ship_build_time_multiplier", multiplier: 0.92 },
									{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.85 },
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "boardingDoctrine",
							name: "Boarding Doctrine",
							description: "Victory crews can capture lightly damaged hostile hulls.",
							layout: { lane: "bridgeLeft", shape: "hex" },
							prerequisites: ["battlefieldRecoveryCrews", "advancedStrikeCraft"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "contract_ship_capture",
										chance: 0.1,
										eligibleShips: ["interceptor"],
										maxShips: 1,
									},
								],
								[
									{
										kind: "contract_ship_capture",
										chance: 0.18,
										eligibleShips: ["interceptor", "frigate"],
										maxShips: 1,
									},
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "electronicWarfareSuites",
							name: "Electronic Warfare Suites",
							description:
								"Jamming suites reduce enemy attack when the committed force is sufficient.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: ["targetSolutionEngines", "shieldFieldModulation"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "enemy_attack_multiplier", multiplier: 0.92 }],
								[{ kind: "enemy_attack_multiplier", multiplier: 0.85 }],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "taskForceDelegation",
							name: "Task Force Delegation",
							description: "Delegated command channels allow one extra active contract.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["contractTriageCommand", "advancedStrikeCraft"],
							maxLevel: 1,
							effectsByLevel: [[{ kind: "contract_active_limit_bonus", amount: 1 }]],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "integratedDefenseDrills",
							name: "Integrated Defense Drills",
							description: "Planetary defenses coordinate overlapping fields and fire lanes.",
							layout: { lane: "outerRight", shape: "circle" },
							prerequisites: ["shieldFieldModulation"],
							maxLevel: 3,
							effectsByLevel: [
								[
									{ kind: "defense_stat_multiplier", stat: "attack", multiplier: 1.07 },
									{ kind: "defense_stat_multiplier", stat: "hull", multiplier: 1.07 },
								],
								[
									{ kind: "defense_stat_multiplier", stat: "attack", multiplier: 1.07 },
									{ kind: "defense_stat_multiplier", stat: "hull", multiplier: 1.07 },
								],
								[
									{ kind: "defense_stat_multiplier", stat: "attack", multiplier: 1.07 },
									{ kind: "defense_stat_multiplier", stat: "hull", multiplier: 1.07 },
									{
										kind: "defense_stat_multiplier",
										stat: "shield",
										defenseKey: "shieldDome",
										multiplier: 1.15,
									},
								],
							],
						}),
						node({
							branch: "militarySystems",
							tier: 3,
							id: "theaterCommandSystems",
							name: "Theater Command Systems",
							description: "Stored task force templates reward repeated operational planning.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["taskForceDelegation", "boardingDoctrine", "integratedDefenseDrills"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{
										kind: "contract_task_force_template_bonus",
										fuelMultiplier: 0.65,
										rewardMultiplier: 1.1,
									},
								],
							],
						}),
					],
				},
			],
		},
		scientificInfrastructure: {
			...branchThemes("scientificInfrastructure"),
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						node({
							branch: "scientificInfrastructure",
							tier: 1,
							id: "archiveCompression",
							name: "Archive Compression",
							description: "Compact research archives shorten repeated analysis loops.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "research_duration_multiplier", multiplier: 0.94 }],
								[{ kind: "research_duration_multiplier", multiplier: 0.94 }],
								[{ kind: "research_duration_multiplier", multiplier: 0.94 }],
							],
							effectLabels: [
								"Research duration -6% per level",
								"Level 3 improves locked-tier previewing",
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 1,
							id: "experimentalMethodology",
							name: "Experimental Methodology",
							description: "Better field protocols improve meta-matter recovery.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: [],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "meta_matter_reward_multiplier", multiplier: 1.05 }],
								[
									{ kind: "meta_matter_reward_multiplier", multiplier: 1.05 },
									{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.03, amount: 1 },
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 1,
							id: "stellarCartography",
							name: "Stellar Cartography",
							description: "Route-class charts expose system and sector travel categories.",
							layout: { lane: "bridgeLeft", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks route-class visibility in fleet planning"],
						}),
					],
				},
				{
					tier: 2,
					unlock: {
						type: "all",
						rules: [{ type: "metaMatterSpentTotal", amount: 200 }],
					},
					nodes: [
						node({
							branch: "scientificInfrastructure",
							tier: 2,
							id: "activeCommandWindows",
							name: "Active Command Windows",
							description: "Manual colony actions open short production command windows.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["archiveCompression", "experimentalMethodology"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "active_command_window",
										productionMultiplier: 1.1,
										durationMinutes: 20,
										scope: "colony",
									},
								],
								[
									{
										kind: "active_command_window",
										productionMultiplier: 1.1,
										durationMinutes: 20,
										scope: "account",
									},
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 2,
							id: "parallelInquiry",
							name: "Parallel Inquiry",
							description: "A larger research network speeds less demanding research.",
							layout: { lane: "outerLeft", shape: "circle" },
							prerequisites: ["archiveCompression"],
							maxLevel: 3,
							effectsByLevel: [
								[
									{
										kind: "research_network_duration",
										percentPerSite: 0.02,
										freeSites: 1,
										cap: 0.1,
									},
								],
								[
									{
										kind: "research_network_duration",
										percentPerSite: 0.02,
										freeSites: 1,
										cap: 0.15,
									},
								],
								[
									{
										kind: "research_network_duration",
										percentPerSite: 0.02,
										freeSites: 1,
										cap: 0.2,
									},
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 2,
							id: "xenologicSampling",
							name: "Xenologic Sampling",
							description: "Contract teams preserve stranger specimens from hostile sites.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: ["experimentalMethodology", "contractTriageCommand"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.05, amount: 1 }],
								[{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.05, amount: 1 }],
								[
									{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.05, amount: 1 },
									{ kind: "meta_matter_bonus_chance", rarity: "mythic", chance: 0.01, amount: 1 },
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 2,
							id: "peerReviewProtocols",
							name: "Peer Review Protocols",
							description: "Review channels cut waste in early and mid-tier research budgets.",
							layout: { lane: "innerRight", shape: "square" },
							prerequisites: ["archiveCompression", "experimentalMethodology"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "research_cost_multiplier",
										metaMatterMultiplier: 0.92,
										tierMax: 2,
										rarities: ["common"],
									},
								],
								[
									{
										kind: "research_cost_multiplier",
										metaMatterMultiplier: 0.92,
										tierMax: 2,
										rarities: ["common"],
									},
									{
										kind: "research_cost_multiplier",
										metaMatterMultiplier: 0.95,
										tierMax: 2,
										rarities: ["rare"],
									},
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 2,
							id: "contractAnalytics",
							name: "Contract Analytics",
							description: "Better candidate scoring expands the visible contract board.",
							layout: { lane: "outerRight", shape: "hex" },
							prerequisites: ["stellarCartography"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "contract_visible_slot_bonus", amount: 1 }],
								[{ kind: "contract_visible_slot_bonus", amount: 1 }],
							],
						}),
					],
				},
				{
					tier: 3,
					unlock: {
						type: "all",
						rules: [
							{ type: "metaMatterSpentTotal", amount: 2_000 },
							{ type: "metaMatterEarnedByRarity", rarity: "rare", amount: 25 },
						],
					},
					nodes: [
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "federatedDatabanks",
							name: "Federated Databanks",
							description: "Research sites share archives and project state across colonies.",
							layout: { lane: "outerLeft", shape: "square" },
							prerequisites: ["parallelInquiry", "peerReviewProtocols"],
							maxLevel: 1,
							effectsByLevel: [[{ kind: "research_network_synchronization" }]],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "directorateExchange",
							name: "Network Exchange",
							description: "Research sites exchange staff and shorten research time.",
							layout: { lane: "innerLeft", shape: "square" },
							prerequisites: ["federatedDatabanks", "activeCommandWindows"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "research_network_exchange_duration",
										perSiteMultiplier: 0.97,
										capMultiplier: 0.88,
										minResearchSites: 5,
									},
								],
								[
									{
										kind: "research_network_exchange_duration",
										perSiteMultiplier: 0.97,
										capMultiplier: 0.79,
										minResearchSites: 5,
									},
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "metaMatterSynthesis",
							name: "Meta-Matter Synthesis",
							description: "Common meta-matter traces can crystallize into rare matter.",
							layout: { lane: "bridgeLeft", shape: "circle" },
							prerequisites: ["xenologicSampling", "peerReviewProtocols"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.1, amount: 1 }],
								[{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.1, amount: 1 }],
								[
									{ kind: "meta_matter_bonus_chance", rarity: "rare", chance: 0.1, amount: 1 },
									{
										kind: "meta_matter_daily_conversion",
										from: "common",
										to: "rare",
										fromAmount: 50,
										toAmount: 1,
									},
								],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "anomalyContainment",
							name: "Anomaly Containment",
							description: "Hostile anomaly protocols increase mythic meta-matter recovery.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: ["metaMatterSynthesis", "stellarCartography"],
							designPrerequisites: ["metaMatterSynthesis", "graviticFieldTheory"],
							maxLevel: 1,
							effectsByLevel: [
								[{ kind: "meta_matter_bonus_chance", rarity: "mythic", chance: 0.02, amount: 1 }],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "graviticFieldTheory",
							name: "Gravitic Field Theory",
							description: "Galactic route theory for future galaxy-scale navigation.",
							layout: { lane: "bridgeRight", shape: "hex" },
							prerequisites: ["stellarCartography", "sectorGatePlotting"],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks future galactic route modeling"],
							...planned.galacticRoutes,
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "predictiveResearchModels",
							name: "Predictive Research Models",
							description: "Successful contracts feed active research with field data.",
							layout: { lane: "outerRight", shape: "square" },
							prerequisites: ["contractAnalytics", "federatedDatabanks"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "research_predictive_progress", progressFraction: 0.02 }],
								[{ kind: "research_predictive_progress", progressFraction: 0.04 }],
							],
						}),
						node({
							branch: "scientificInfrastructure",
							tier: 3,
							id: "crossDomainModels",
							name: "Cross-Domain Models",
							description: "Finishing one branch discounts the next different-branch research.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["predictiveResearchModels", "directorateExchange"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "research_cross_branch_discount",
										durationMultiplier: 0.9,
										metaMatterMultiplier: 0.95,
									},
								],
								[
									{
										kind: "research_cross_branch_discount",
										durationMultiplier: 0.82,
										metaMatterMultiplier: 0.9,
									},
								],
							],
						}),
					],
				},
			],
		},
		expansionLogistics: {
			...branchThemes("expansionLogistics"),
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						node({
							branch: "expansionLogistics",
							tier: 1,
							id: "cargoStandardization",
							name: "Cargo Standardization",
							description: "Standardized containers improve civilian cargo payloads.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "cargo_capacity_multiplier", multiplier: 1.12 }],
								[{ kind: "cargo_capacity_multiplier", multiplier: 1.12 }],
								[
									{ kind: "cargo_capacity_multiplier", multiplier: 1.12 },
									{ kind: "ship_build_time_multiplier", shipKey: "smallCargo", multiplier: 0.9 },
									{ kind: "ship_build_time_multiplier", shipKey: "largeCargo", multiplier: 0.9 },
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 1,
							id: "interSystemCharts",
							name: "Inter-System Charts",
							description: "Same-sector inter-system routes resolve at twice normal speed.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [
								[{ kind: "route_speed_multiplier", routeClass: "interSystem", multiplier: 0.5 }],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 1,
							id: "deepSpaceRefueling",
							name: "Deep Space Refueling",
							description: "Distributed refueling cuts fleet operating fuel.",
							layout: { lane: "bridgeLeft", shape: "circle" },
							prerequisites: [],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.9 }],
								[{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.9 }],
								[
									{ kind: "fleet_fuel_cost_multiplier", multiplier: 0.9 },
									{ kind: "colony_ship_fuel_multiplier", multiplier: 0.8 },
								],
							],
						}),
					],
				},
				{
					tier: 2,
					unlock: {
						type: "all",
						rules: [{ type: "colonyInDifferentSystemFounded" }],
					},
					nodes: [
						node({
							branch: "expansionLogistics",
							tier: 2,
							id: "transportEscrowProtocols",
							name: "Transport Escrow Protocols",
							description: "Own-colony transports reserve storage for their delivery.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["cargoStandardization", "deepSpaceRefueling"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "transport_storage_reservation", multiplier: 1 }],
								[{ kind: "transport_storage_reservation", multiplier: 1 }],
							],
							effectLabels: [
								"Own-colony transports reserve delivery storage",
								"Level 2 enables filled-storage fuel refund handling",
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 2,
							id: "sectorGatePlotting",
							name: "Sector Gate Plotting",
							description: "Same-galaxy inter-sector routes resolve at four times normal speed.",
							layout: { lane: "outerLeft", shape: "hex" },
							prerequisites: ["interSystemCharts", "stellarCartography"],
							maxLevel: 1,
							effectsByLevel: [
								[{ kind: "route_speed_multiplier", routeClass: "interSector", multiplier: 0.25 }],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 2,
							id: "frontierSupplyDoctrine",
							name: "Frontier Supply Doctrine",
							description: "Long-haul logistics unlock larger cargo and colony ship operations.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: ["cargoStandardization", "deepSpaceRefueling"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{ kind: "unlock_ship", shipKey: "largeCargo" },
									{ kind: "unlock_ship", shipKey: "colonyShip" },
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 2,
							id: "longHaulArbitrage",
							name: "Long Haul Arbitrage",
							description: "Own-colony resource transports gain value with distance.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: ["transportEscrowProtocols", "frontierSupplyDoctrine"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "transport_delivery_distance_bonus",
										percentPerDistance: 0.001,
										capMultiplier: 1.15,
									},
								],
								[
									{
										kind: "transport_delivery_distance_bonus",
										percentPerDistance: 0.001,
										capMultiplier: 1.3,
									},
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 2,
							id: "relayDockingStandards",
							name: "Relay Docking Standards",
							description: "Civilian shipyards build logistics ships faster.",
							layout: { lane: "outerRight", shape: "circle" },
							prerequisites: ["cargoStandardization", "frontierSupplyDoctrine"],
							maxLevel: 3,
							effectsByLevel: [
								[
									{ kind: "ship_build_time_multiplier", shipKey: "smallCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "largeCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "colonyShip", multiplier: 0.92 },
								],
								[
									{ kind: "ship_build_time_multiplier", shipKey: "smallCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "largeCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "colonyShip", multiplier: 0.92 },
								],
								[
									{ kind: "ship_build_time_multiplier", shipKey: "smallCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "largeCargo", multiplier: 0.92 },
									{ kind: "ship_build_time_multiplier", shipKey: "colonyShip", multiplier: 0.92 },
									{ kind: "transport_return_duration_multiplier", multiplier: 0.75 },
								],
							],
						}),
					],
				},
				{
					tier: 3,
					unlock: {
						type: "all",
						rules: [{ type: "colonyInDifferentSectorFounded" }],
					},
					nodes: [
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "galacticVectoring",
							name: "Galactic Vectoring",
							description: "Future inter-galactic routes resolve at sixteen times normal speed.",
							layout: { lane: "outerLeft", shape: "hex" },
							prerequisites: ["sectorGatePlotting", "graviticFieldTheory"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{
										kind: "route_speed_multiplier",
										routeClass: "interGalactic",
										multiplier: 0.0625,
									},
								],
							],
							...planned.galacticRoutes,
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "convoySlipstreams",
							name: "Convoy Slipstreams",
							description: "Repeated own-colony routes build temporary speed corridors.",
							layout: { lane: "innerLeft", shape: "circle" },
							prerequisites: ["longHaulArbitrage", "relayDockingStandards"],
							designPrerequisites: ["longHaulArbitrage", "logisticsBackbone"],
							maxLevel: 3,
							effectsByLevel: [
								[
									{
										kind: "route_streak_speed_bonus",
										multiplierPerLevel: 0.88,
										capMultiplier: 0.64,
									},
								],
								[
									{
										kind: "route_streak_speed_bonus",
										multiplierPerLevel: 0.88,
										capMultiplier: 0.64,
									},
								],
								[
									{
										kind: "route_streak_speed_bonus",
										multiplierPerLevel: 0.88,
										capMultiplier: 0.64,
									},
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "logisticsBackbone",
							name: "Logistics Backbone",
							description: "Transport missions can plan additional delivery stops.",
							layout: { lane: "bridgeLeft", shape: "square" },
							prerequisites: ["longHaulArbitrage", "relayDockingStandards"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "transport_extra_stop_bonus", amount: 1, fuelMultiplierPerStop: 1.05 }],
								[{ kind: "transport_extra_stop_bonus", amount: 1, fuelMultiplierPerStop: 1.05 }],
								[{ kind: "transport_extra_stop_bonus", amount: 1, fuelMultiplierPerStop: 1.05 }],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "intermodalFreightStandards",
							name: "Intermodal Freight Standards",
							description:
								"Cargo ships reserve extra target storage for in-flight own-colony deliveries.",
							layout: { lane: "innerRight", shape: "square" },
							prerequisites: ["transportEscrowProtocols", "relayDockingStandards"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "transport_storage_reservation", multiplier: 1.1 }],
								[{ kind: "transport_storage_reservation", multiplier: 1.2 }],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "colonialLaunchWindows",
							name: "Colonial Launch Windows",
							description: "Colony ship builds and launches are tuned around efficient windows.",
							layout: { lane: "bridgeRight", shape: "circle" },
							prerequisites: ["frontierSupplyDoctrine", "relayDockingStandards"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "colony_ship_build_time_multiplier", multiplier: 0.8 }],
								[
									{ kind: "colony_ship_build_time_multiplier", multiplier: 0.8 },
									{ kind: "colony_ship_fuel_multiplier", multiplier: 0.65 },
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "surveyUplinks",
							name: "Survey Uplinks",
							description:
								"Recent successful transports improve next-contract meta-matter rewards.",
							layout: { lane: "outerRight", shape: "hex" },
							prerequisites: ["sectorGatePlotting", "contractAnalytics"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "contract_after_transport_meta_matter_multiplier",
										multiplier: 1.1,
										durationHours: 24,
									},
								],
								[
									{
										kind: "contract_after_transport_meta_matter_multiplier",
										multiplier: 1.2,
										durationHours: 24,
									},
								],
							],
						}),
						node({
							branch: "expansionLogistics",
							tier: 3,
							id: "stargatePrecursorSurvey",
							name: "Stargate Precursor Survey",
							description: "Future fixed-route gate projects emerge from heavy route usage.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["galacticVectoring", "surveyUplinks"],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks the future fixed-route gate project"],
							...planned.stargates,
						}),
					],
				},
			],
		},
		colonySpecialization: {
			...branchThemes("colonySpecialization"),
			tiers: [
				{
					tier: 1,
					unlock: { type: "always" },
					nodes: [
						node({
							branch: "colonySpecialization",
							tier: 1,
							id: "defenseGridArchitecture",
							name: "Defense Grid Architecture",
							description: "Defense Grid infrastructure stays ahead of shipyard escalation.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [
								[{ kind: "facility_max_level_bonus", facilityKey: "defense_grid", amount: 2 }],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 1,
							id: "navalProductionCoordination",
							name: "Naval Production Coordination",
							description: "Shipyard teams coordinate a wider local production lane.",
							layout: { lane: "innerRight", shape: "hex" },
							prerequisites: [],
							maxLevel: 1,
							effectsByLevel: [
								[{ kind: "shipyard_queue_capacity_bonus", amount: 1, minShipyardLevel: 3 }],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 1,
							id: "colonialAdministration",
							name: "Colonial Administration",
							description: "Administrative overhead from future colony-cap pressure is reduced.",
							layout: { lane: "bridgeLeft", shape: "square" },
							prerequisites: [],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "colony_overcap_penalty_reduction", amount: 0.05 }],
								[{ kind: "colony_overcap_penalty_reduction", amount: 0.05 }],
							],
						}),
					],
				},
				{
					tier: 2,
					unlock: {
						type: "all",
						rules: [
							{ type: "coloniesFounded", count: 2 },
							{ type: "facilityLevelReached", level: 12 },
						],
					},
					nodes: [
						node({
							branch: "colonySpecialization",
							tier: 2,
							id: "localSpecializationCharters",
							name: "Local Specialization Charters",
							description:
								"Each colony can adopt an industrial, refinery, research, naval, or defensive charter.",
							layout: { lane: "bridgeRight", shape: "square" },
							prerequisites: ["colonialAdministration"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "colony_charter_unlock",
										productionMultiplier: 1.2,
										penaltyMultiplier: 0.95,
									},
								],
								[{ kind: "colony_charter_penalty_removed" }],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 2,
							id: "frontierBootstrapping",
							name: "Frontier Bootstrapping",
							description: "New colonies begin with stronger basic infrastructure packages.",
							layout: { lane: "outerLeft", shape: "square" },
							prerequisites: ["colonialAdministration"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "new_colony_bootstrap", buildingLevel: 2, storageLevel: 2 }],
								[
									{
										kind: "new_colony_bootstrap",
										buildingLevel: 4,
										storageLevel: 3,
										roboticsHubLevel: 1,
									},
								],
								[
									{
										kind: "new_colony_bootstrap",
										buildingLevel: 6,
										storageLevel: 5,
										roboticsHubLevel: 2,
										logisticsNexusLevel: 1,
									},
								],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 2,
							id: "planetarySurveyMethods",
							name: "Planetary Survey Methods",
							description:
								"Survey data gives colony specialization recommendations before settlement.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: ["localSpecializationCharters", "stellarCartography"],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Reveals planet specialization recommendations"],
						}),
						node({
							branch: "colonySpecialization",
							tier: 2,
							id: "emergencyStockpileDoctrine",
							name: "Emergency Stockpile Doctrine",
							description: "New colonies start with protected local resources.",
							layout: { lane: "innerRight", shape: "circle" },
							prerequisites: ["frontierBootstrapping", "storageCompressionLattices"],
							maxLevel: 2,
							effectsByLevel: [
								[
									{
										kind: "protected_starting_resources",
										storageFraction: 0.1,
										durationHours: 24,
									},
								],
								[
									{
										kind: "protected_starting_resources",
										storageFraction: 0.2,
										durationHours: 24,
									},
								],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 2,
							id: "prefecturePlanning",
							name: "Prefecture Planning",
							description: "Chartered colonies execute facility upgrades more cleanly.",
							layout: { lane: "outerRight", shape: "square" },
							prerequisites: ["defenseGridArchitecture", "navalProductionCoordination"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "charter_facility_upgrade_time_multiplier", multiplier: 0.9 }],
								[
									{ kind: "charter_facility_upgrade_time_multiplier", multiplier: 0.9 },
									{ kind: "charter_cooldown_hours", hours: 12 },
								],
							],
						}),
					],
				},
				{
					tier: 3,
					unlock: {
						type: "all",
						rules: [
							{ type: "coloniesFounded", count: 4 },
							{ type: "facilityLevelTotalOnOneColonyReached", level: 60 },
						],
					},
					nodes: [
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "terraformerFacilityDesign",
							name: "Terraformer Facility Design",
							description: "Blueprints for future planet trait mitigation.",
							layout: { lane: "outerLeft", shape: "hex" },
							prerequisites: ["planetarySurveyMethods", "federatedDatabanks"],
							maxLevel: 1,
							effectsByLevel: [[]],
							effectLabels: ["Unlocks the future terraformer facility"],
							...planned.terraformer,
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "habitatMegastructures",
							name: "Habitat Megastructures",
							description:
								"Habitat support increases colony capacity once the empire is wide enough.",
							layout: { lane: "innerLeft", shape: "hex" },
							prerequisites: ["planetarySurveyMethods", "frontierBootstrapping"],
							designPrerequisites: ["terraformerFacilityDesign", "frontierBootstrapping"],
							maxLevel: 1,
							effectsByLevel: [[{ kind: "colony_cap_bonus", amount: 1, minColonies: 4 }]],
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "prefabColonyKits",
							name: "Prefab Colony Kits",
							description: "Colony ships arrive with queued upgrade kits ready to install.",
							layout: { lane: "bridgeLeft", shape: "square" },
							prerequisites: ["frontierBootstrapping", "colonialLaunchWindows"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "new_colony_prefab_queue", queuedBuildingUpgrades: 1 }],
								[{ kind: "new_colony_prefab_queue", queuedBuildingUpgrades: 2 }],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "civicLogisticsAI",
							name: "Civic Logistics AI",
							description:
								"Chartered colonies reserve incoming transport capacity for charter needs.",
							layout: { lane: "innerRight", shape: "square" },
							prerequisites: ["prefabColonyKits", "localSpecializationCharters"],
							maxLevel: 2,
							effectsByLevel: [
								[{ kind: "charter_transport_reservation", storageFraction: 0.1 }],
								[{ kind: "charter_transport_reservation", storageFraction: 0.2 }],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "orbitalShipworks",
							name: "Orbital Shipworks",
							description: "Naval charters accelerate ship builds through orbital staging.",
							layout: { lane: "bridgeRight", shape: "circle" },
							prerequisites: ["navalProductionCoordination", "prefecturePlanning"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "charter_ship_build_time_multiplier", multiplier: 0.9 }],
								[{ kind: "charter_ship_build_time_multiplier", multiplier: 0.9 }],
								[
									{ kind: "charter_ship_build_time_multiplier", multiplier: 0.9 },
									{ kind: "ship_build_time_multiplier", shipKey: "smallCargo", multiplier: 0.9 },
									{ kind: "ship_build_time_multiplier", shipKey: "interceptor", multiplier: 0.9 },
								],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "fortifiedCivicGrid",
							name: "Fortified Civic Grid",
							description:
								"Defensive charters accelerate defense builds and reinforce early defenses.",
							layout: { lane: "outerRight", shape: "circle" },
							prerequisites: ["defenseGridArchitecture", "prefecturePlanning"],
							maxLevel: 3,
							effectsByLevel: [
								[{ kind: "charter_defense_build_time_multiplier", multiplier: 0.9 }],
								[{ kind: "charter_defense_build_time_multiplier", multiplier: 0.9 }],
								[
									{ kind: "charter_defense_build_time_multiplier", multiplier: 0.9 },
									{
										kind: "defense_stat_multiplier",
										stat: "hull",
										defenseKey: "missileBattery",
										multiplier: 1.1,
									},
									{
										kind: "defense_stat_multiplier",
										stat: "hull",
										defenseKey: "laserTurret",
										multiplier: 1.1,
									},
								],
							],
						}),
						node({
							branch: "colonySpecialization",
							tier: 3,
							id: "sectorCapitalPlanning",
							name: "Sector Capital Planning",
							description: "One colony per sector can become a local production capital.",
							layout: { lane: "axis", shape: "capstone" },
							prerequisites: ["habitatMegastructures", "orbitalShipworks", "fortifiedCivicGrid"],
							maxLevel: 1,
							effectsByLevel: [
								[
									{
										kind: "sector_capital_production",
										capitalMultiplier: 1.25,
										sectorColonyMultiplier: 1.08,
									},
								],
							],
						}),
					],
				},
			],
		},
	};
	return { branches } satisfies AuthoredResearchTree;
}

const RESEARCH_TREE = buildResearchTierThreeTree();

export const RESEARCH_BRANCH_KEYS = [...RESEARCH_BRANCH_KEY_LIST];

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
	requiredResearchNetworkSize: number;
	costs: ResearchNodeCost[];
	effects: ResearchEffect[];
	effectsByLevel: ResearchEffect[][];
	effectLabels: string[];
	implementationStatus: ResearchImplementationStatus;
	plannedReason?: string;
	designPrerequisites: ResearchKey[];
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

function emptyStatMultipliers<T extends string>(
	keys: readonly T[],
): Record<T, { attack: number; hull: number; shield: number }> {
	return Object.fromEntries(keys.map((key) => [key, { attack: 1, hull: 1, shield: 1 }])) as Record<
		T,
		{ attack: number; hull: number; shield: number }
	>;
}

function mergeInterceptorWolfpack(
	current: Extract<ResearchEffect, { kind: "interceptor_wolfpack" }> | undefined,
	next: Extract<ResearchEffect, { kind: "interceptor_wolfpack" }>,
) {
	return {
		kind: "interceptor_wolfpack",
		minInterceptors: next.minInterceptors,
		minShare: next.minShare,
		attackMultiplier: (current?.attackMultiplier ?? 1) * (next.attackMultiplier ?? 1),
		hullMultiplier: (current?.hullMultiplier ?? 1) * (next.hullMultiplier ?? 1),
		fuelMultiplier: (current?.fuelMultiplier ?? 1) * (next.fuelMultiplier ?? 1),
	} satisfies Extract<ResearchEffect, { kind: "interceptor_wolfpack" }>;
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
		case "research_network_synchronization":
			return "Synchronize the research network";
		case "meta_matter_reward_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${
				effect.rarity ?? "all"
			} meta-matter rewards`;
		case "energy_consumption_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% energy consumption`;
		case "storage_pressure_production_bonus":
			return `Up to +${Math.round(effect.maxBonus * 100)}% production when storage is low`;
		case "overflow_reintegration_multiplier":
			return `${effect.multiplier}x overflow reintegration`;
		case "idle_building_queue_speed_bonus":
			return `Idle building queues reduce upgrade duration`;
		case "building_queue_capacity_bonus":
			return `+${effect.amount} building queue slot${effect.amount === 1 ? "" : "s"}`;
		case "shipyard_queue_capacity_bonus":
			return `+${effect.amount} shipyard queue slot${effect.amount === 1 ? "" : "s"}`;
		case "colony_count_production_bonus":
			return `+${Math.round(effect.bonusPerExtraColony * 100)}% production per extra colony`;
		case "industrial_focus_unlock":
			return "Unlock colony industrial focus";
		case "active_command_window":
			return `Active command windows increase ${effect.scope} production`;
		case "research_network_duration":
			return `Research network duration discount`;
		case "research_cost_multiplier":
			return `${Math.round((1 - effect.metaMatterMultiplier) * 100)}% research meta-matter cost`;
		case "ship_stat_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${effect.shipKey ?? "combat ship"} ${effect.stat}`;
		case "defense_stat_multiplier":
			return `${Math.round((effect.multiplier - 1) * 100)}% ${effect.defenseKey ?? "defense"} ${effect.stat}`;
		case "interceptor_wolfpack": {
			const trigger = `${effect.minInterceptors}+ Interceptors at ${Math.round(effect.minShare * 100)}%+ force share`;
			if (effect.attackMultiplier) {
				return `Wolfpack: +${Math.round((effect.attackMultiplier - 1) * 100)}% Interceptor attack on contracts (${trigger})`;
			}
			if (effect.hullMultiplier) {
				return `Wolfpack: +${Math.round((effect.hullMultiplier - 1) * 100)}% Interceptor hull on contracts (${trigger})`;
			}
			if (effect.fuelMultiplier) {
				return `Wolfpack: ${Math.round((1 - effect.fuelMultiplier) * 100)}% lower contract fuel (${trigger})`;
			}
			return `Wolfpack contract formation bonus (${trigger})`;
		}
		case "enemy_attack_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% enemy attack`;
		case "contract_active_limit_bonus":
			return `+${effect.amount} active contract limit`;
		case "contract_visible_slot_bonus":
			return `+${effect.amount} visible contract slot${effect.amount === 1 ? "" : "s"}`;
		case "contract_dispatch_fuel_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% contract dispatch fuel`;
		case "contract_recovery_resources":
			return `${Math.round(effect.recoveryRate * 100)}% contract recovery resources`;
		case "contract_ship_capture":
			return `${Math.round(effect.chance * 100)}% chance to capture enemy ships`;
		case "contract_task_force_template_bonus":
			return "Unlock task force template reuse bonus";
		case "meta_matter_bonus_chance":
			return `+${Math.round(effect.chance * 100)}pp ${effect.rarity} meta-matter chance`;
		case "research_predictive_progress":
			return `${Math.round(effect.progressFraction * 100)}% successful-contract research progress`;
		case "research_cross_branch_discount":
			return "Discount the next different-branch research";
		case "meta_matter_daily_conversion":
			return `Convert ${effect.fromAmount} ${effect.from} to ${effect.toAmount} ${effect.to} daily`;
		case "research_network_exchange_duration":
			return "Research duration scales with research network size";
		case "route_speed_multiplier":
			return `${Math.round((1 / effect.multiplier - 1) * 100)}% ${effect.routeClass} travel speed`;
		case "route_streak_speed_bonus":
			return "Repeated route transport speed bonus";
		case "transport_extra_stop_bonus":
			return `+${effect.amount} planned transport stop`;
		case "transport_delivery_distance_bonus":
			return "Own-colony transport delivery scales with distance";
		case "transport_storage_reservation":
			return "Own-colony transport storage reservation";
		case "contract_after_transport_meta_matter_multiplier":
			return "Recent transport boosts next contract meta-matter";
		case "transport_return_duration_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% transport return duration`;
		case "colony_ship_build_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% colony ship build time`;
		case "colony_ship_fuel_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% colony ship fuel`;
		case "colony_overcap_penalty_reduction":
			return `-${Math.round(effect.amount * 100)}pp future colony over-cap penalty`;
		case "colony_charter_unlock":
			return "Unlock colony specialization charters";
		case "colony_charter_penalty_removed":
			return "Remove colony charter production penalty";
		case "charter_facility_upgrade_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% chartered facility upgrade duration`;
		case "charter_cooldown_hours":
			return `${effect.hours}h charter change cooldown`;
		case "charter_ship_build_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% naval charter ship build time`;
		case "charter_defense_build_time_multiplier":
			return `${Math.round((1 - effect.multiplier) * 100)}% defensive charter defense build time`;
		case "new_colony_bootstrap":
			return `New colony bootstrap package level ${effect.buildingLevel}`;
		case "new_colony_prefab_queue":
			return `+${effect.queuedBuildingUpgrades} queued new-colony upgrade`;
		case "protected_starting_resources":
			return `${Math.round(effect.storageFraction * 100)}% protected starting resources`;
		case "charter_transport_reservation":
			return `${Math.round(effect.storageFraction * 100)}% charter transport reservation`;
		case "colony_cap_bonus":
			return `+${effect.amount} colony cap`;
		case "sector_capital_production":
			return "Unlock sector capital production";
	}
}

function withResearchNetworkTierRequirement(
	tier: 1 | 2 | 3 | 4,
	unlock: ResearchTierUnlockRule,
): ResearchTierUnlockRule {
	const networkRule = {
		type: "researchNetworkSize",
		count: researchNetworkRequirementForTier(tier),
	} satisfies ResearchTierUnlockRule;
	if (unlock.type === "always") {
		return networkRule;
	}
	return {
		type: "all",
		rules: [networkRule, unlock],
	};
}

function flattenResearchTree(options?: { activeOnly?: boolean }) {
	const branches: ResearchBranchDefinition[] = [];

	for (const branchKey of RESEARCH_BRANCH_KEYS) {
		const branch = RESEARCH_TREE.branches[branchKey];
		const tiers: ResearchTierDefinition[] = branch.tiers.map((tier) => ({
			tier: tier.tier,
			unlock: withResearchNetworkTierRequirement(tier.tier, tier.unlock),
			nodes: tier.nodes
				.filter(
					(node) => !options?.activeOnly || (node.implementationStatus ?? "active") === "active",
				)
				.map((node) => {
					const authoredNode: AuthoredResearchNode = node;
					const effectsByLevel = authoredNode.effectsByLevel?.map((effects) => [...effects]) ?? [
						[...authoredNode.effects],
					];
					const effects = effectsByLevel.flat();
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
						requiredResearchNetworkSize: researchNetworkRequirementForTier(tier.tier),
						costs: authoredNode.costs.map((cost) => ({
							metaMatter: { ...cost.metaMatter },
							resources: cost.resources ? { ...cost.resources } : undefined,
							seconds: cost.seconds,
						})),
						effects,
						effectsByLevel,
						effectLabels: authoredNode.effectLabels
							? [...authoredNode.effectLabels]
							: effects.map(describeResearchEffect),
						implementationStatus: authoredNode.implementationStatus ?? "active",
						plannedReason: authoredNode.plannedReason,
						designPrerequisites: [
							...(authoredNode.designPrerequisites ?? authoredNode.prerequisites),
						],
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

export const AUTHORED_RESEARCH_BRANCHES = flattenResearchTree();
export const AUTHORED_RESEARCH_TREE_NODES = AUTHORED_RESEARCH_BRANCHES.flatMap((branch) =>
	branch.tiers.flatMap((tier) => tier.nodes),
) as readonly ResearchNodeDefinition[];
export const DEFAULT_RESEARCH_BRANCHES = flattenResearchTree({ activeOnly: true });
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

export function getActiveResearchBranches() {
	return DEFAULT_RESEARCH_BRANCHES;
}

export function getActiveResearchTree() {
	return DEFAULT_RESEARCH_TREE;
}

export function getResearchTier(args: { branchKey: ResearchBranchKey; tier: number }) {
	return getResearchBranch(args.branchKey)?.tiers.find((tier) => tier.tier === args.tier);
}

export function emptyResearchTierUnlockContext(): ResearchTierUnlockContext {
	return {
		coloniesFounded: 0,
		contractsCompleted: 0,
		crossSectorColoniesFounded: 0,
		crossSystemColoniesFounded: 0,
		defensesOwned: 0,
		facilityLevelTotalOnOneColony: 0,
		highestBuildingLevel: 0,
		highestFacilityLevel: 0,
		highestResearchDirectorateLevel: 0,
		maxResourceAndStorageLevelTotal: 0,
		maxResourceProductionBuildingLevel: 0,
		maxStorageBuildingLevel: 0,
		metaMatterEarnedCommon: 0,
		metaMatterEarnedMythic: 0,
		metaMatterEarnedRare: 0,
		metaMatterSpentTotal: 0,
		raidDefensesSucceeded: 0,
		rank3ContractsCompleted: 0,
		researchNetworkSize: 0,
		shipsOwned: 0,
		successfulTransports: 0,
	};
}

function sanitizeTierUnlockMetric(value: number | undefined) {
	return Math.max(0, Math.floor(value ?? 0));
}

function normalizeTierUnlockContext(
	context: Partial<ResearchTierUnlockContext> | undefined,
): ResearchTierUnlockContext {
	const defaults = emptyResearchTierUnlockContext();
	return {
		coloniesFounded: sanitizeTierUnlockMetric(context?.coloniesFounded ?? defaults.coloniesFounded),
		contractsCompleted: sanitizeTierUnlockMetric(
			context?.contractsCompleted ?? defaults.contractsCompleted,
		),
		crossSectorColoniesFounded: sanitizeTierUnlockMetric(
			context?.crossSectorColoniesFounded ?? defaults.crossSectorColoniesFounded,
		),
		crossSystemColoniesFounded: sanitizeTierUnlockMetric(
			context?.crossSystemColoniesFounded ?? defaults.crossSystemColoniesFounded,
		),
		defensesOwned: sanitizeTierUnlockMetric(context?.defensesOwned ?? defaults.defensesOwned),
		facilityLevelTotalOnOneColony: sanitizeTierUnlockMetric(
			context?.facilityLevelTotalOnOneColony ?? defaults.facilityLevelTotalOnOneColony,
		),
		highestBuildingLevel: sanitizeTierUnlockMetric(
			context?.highestBuildingLevel ?? defaults.highestBuildingLevel,
		),
		highestFacilityLevel: sanitizeTierUnlockMetric(
			context?.highestFacilityLevel ?? defaults.highestFacilityLevel,
		),
		highestResearchDirectorateLevel: sanitizeTierUnlockMetric(
			context?.highestResearchDirectorateLevel ?? defaults.highestResearchDirectorateLevel,
		),
		maxResourceAndStorageLevelTotal: sanitizeTierUnlockMetric(
			context?.maxResourceAndStorageLevelTotal ?? defaults.maxResourceAndStorageLevelTotal,
		),
		maxResourceProductionBuildingLevel: sanitizeTierUnlockMetric(
			context?.maxResourceProductionBuildingLevel ?? defaults.maxResourceProductionBuildingLevel,
		),
		maxStorageBuildingLevel: sanitizeTierUnlockMetric(
			context?.maxStorageBuildingLevel ?? defaults.maxStorageBuildingLevel,
		),
		metaMatterEarnedCommon: sanitizeTierUnlockMetric(
			context?.metaMatterEarnedCommon ?? defaults.metaMatterEarnedCommon,
		),
		metaMatterEarnedMythic: sanitizeTierUnlockMetric(
			context?.metaMatterEarnedMythic ?? defaults.metaMatterEarnedMythic,
		),
		metaMatterEarnedRare: sanitizeTierUnlockMetric(
			context?.metaMatterEarnedRare ?? defaults.metaMatterEarnedRare,
		),
		metaMatterSpentTotal: sanitizeTierUnlockMetric(
			context?.metaMatterSpentTotal ?? defaults.metaMatterSpentTotal,
		),
		raidDefensesSucceeded: sanitizeTierUnlockMetric(
			context?.raidDefensesSucceeded ?? defaults.raidDefensesSucceeded,
		),
		rank3ContractsCompleted: sanitizeTierUnlockMetric(
			context?.rank3ContractsCompleted ?? defaults.rank3ContractsCompleted,
		),
		researchNetworkSize: sanitizeTierUnlockMetric(
			context?.researchNetworkSize ?? defaults.researchNetworkSize,
		),
		shipsOwned: sanitizeTierUnlockMetric(context?.shipsOwned ?? defaults.shipsOwned),
		successfulTransports: sanitizeTierUnlockMetric(
			context?.successfulTransports ?? defaults.successfulTransports,
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
		case "rankedContractsCompleted":
			if (rule.minRank <= 3) {
				return context.rank3ContractsCompleted >= rule.count;
			}
			return false;
		case "raidDefensesSucceeded":
			return context.raidDefensesSucceeded >= rule.count;
		case "highestBuildingLevelReached":
			return context.highestBuildingLevel >= rule.level;
		case "resourceProductionBuildingLevelReached":
			return context.maxResourceProductionBuildingLevel >= rule.level;
		case "storageBuildingLevelReached":
			return context.maxStorageBuildingLevel >= rule.level;
		case "resourceAndStorageLevelTotalReached":
			return context.maxResourceAndStorageLevelTotal >= rule.level;
		case "coloniesFounded":
			return context.coloniesFounded >= rule.count;
		case "colonyInDifferentSystemFounded":
			return context.crossSystemColoniesFounded > 0;
		case "colonyInDifferentSectorFounded":
			return context.crossSectorColoniesFounded > 0;
		case "researchNetworkSize":
			return context.researchNetworkSize >= rule.count;
		case "highestResearchDirectorateLevelReached":
			return context.researchNetworkSize >= Math.max(1, Math.ceil(rule.level / 4));
		case "facilityLevelReached":
			return context.highestFacilityLevel >= rule.level;
		case "facilityLevelTotalOnOneColonyReached":
			return context.facilityLevelTotalOnOneColony >= rule.level;
		case "shipsOwned":
			return context.shipsOwned >= rule.count;
		case "defensesOwned":
			return context.defensesOwned >= rule.count;
		case "successfulTransports":
			return context.successfulTransports >= rule.count;
		case "metaMatterSpentTotal":
			return context.metaMatterSpentTotal >= rule.amount;
		case "metaMatterEarnedByRarity":
			if (rule.rarity === "common") {
				return context.metaMatterEarnedCommon >= rule.amount;
			}
			if (rule.rarity === "rare") {
				return context.metaMatterEarnedRare >= rule.amount;
			}
			return context.metaMatterEarnedMythic >= rule.amount;
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
		case "rankedContractsCompleted":
			return `Complete ${rule.count} rank-${rule.minRank}+ contract${rule.count === 1 ? "" : "s"}`;
		case "raidDefensesSucceeded":
			return `Successfully defend against ${rule.count} raid${rule.count === 1 ? "" : "s"}`;
		case "highestBuildingLevelReached":
			return `Reach building level ${rule.level}`;
		case "resourceProductionBuildingLevelReached":
			return `Reach resource production building level ${rule.level}`;
		case "storageBuildingLevelReached":
			return `Reach storage building level ${rule.level}`;
		case "resourceAndStorageLevelTotalReached":
			return `Reach ${rule.level} combined resource production and storage levels on one colony`;
		case "coloniesFounded":
			return `Found ${rule.count} colon${rule.count === 1 ? "y" : "ies"}`;
		case "colonyInDifferentSystemFounded":
			return "Found a colony in another system";
		case "colonyInDifferentSectorFounded":
			return "Found a colony in another sector";
		case "researchNetworkSize":
			return `Build ${rule.count} research site${rule.count === 1 ? "" : "s"}`;
		case "highestResearchDirectorateLevelReached":
			return `Build ${Math.max(1, Math.ceil(rule.level / 4))} research sites`;
		case "facilityLevelReached":
			return `Reach ${rule.facilityKey ?? "any"} facility level ${rule.level}`;
		case "facilityLevelTotalOnOneColonyReached":
			return `Reach ${rule.level} combined facility levels on one colony`;
		case "shipsOwned":
			return `Own ${rule.count} ship${rule.count === 1 ? "" : "s"}`;
		case "defensesOwned":
			return `Own ${rule.count} defense${rule.count === 1 ? "" : "s"}`;
		case "successfulTransports":
			return `Complete ${rule.count} transport deliver${rule.count === 1 ? "y" : "ies"}`;
		case "metaMatterSpentTotal":
			return `Spend ${rule.amount} total meta-matter`;
		case "metaMatterEarnedByRarity":
			return `Earn ${rule.amount} ${rule.rarity} meta-matter`;
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

export const getResearchNodeVisibility = getResearchVisibility;

export function getResearchNodeRequirementStatuses(args: {
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
		researchNetworkSynchronizationUnlocked: false,
		energyConsumptionMultiplier: 1,
		overflowReintegrationMultiplier: 1,
		buildingQueueCapacityBonus: 0,
		shipyardQueueCapacityBonus: 0,
		colonyCountProductionBonuses: [],
		researchCostMultipliers: [],
		shipStatMultipliers: emptyStatMultipliers(SHIP_KEYS),
		globalShipStatMultipliers: { attack: 1, hull: 1, shield: 1 },
		defenseStatMultipliers: emptyStatMultipliers(DEFENSE_KEYS),
		globalDefenseStatMultipliers: { attack: 1, hull: 1, shield: 1 },
		enemyAttackMultiplier: 1,
		contractActiveLimitBonus: 0,
		contractVisibleSlotBonus: 0,
		contractDispatchFuelMultiplier: 1,
		contractRecoveryRate: 0,
		metaMatterBonusChances: [],
		researchPredictiveProgressFraction: 0,
		routeSpeedMultipliers: {
			local: 1,
			interSystem: 1,
			interSector: 1,
			interGalactic: 1,
		},
		transportExtraStops: 0,
		transportExtraStopFuelMultiplier: 1,
		transportStorageReservationMultiplier: 1,
		transportReturnDurationMultiplier: 1,
		colonyShipBuildTimeMultiplier: 1,
		colonyShipFuelMultiplier: 1,
		colonyOvercapPenaltyReduction: 0,
		colonyCharterPenaltyRemoved: false,
		charterFacilityUpgradeTimeMultiplier: 1,
		charterShipBuildTimeMultiplier: 1,
		charterDefenseBuildTimeMultiplier: 1,
		colonyCapBonus: 0,
	};

	for (const node of DEFAULT_RESEARCH_TREE) {
		const level = Math.max(0, Math.floor(levels?.[node.id] ?? 0));
		if (level <= 0) {
			continue;
		}
		const completedLevels = Math.min(level, node.maxLevel);
		for (let rank = 0; rank < completedLevels; rank += 1) {
			for (const effect of node.effectsByLevel[rank] ?? node.effects) {
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
					case "research_network_synchronization":
						snapshot.researchNetworkSynchronizationUnlocked = true;
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
					case "energy_consumption_multiplier":
						snapshot.energyConsumptionMultiplier *= effect.multiplier;
						break;
					case "storage_pressure_production_bonus":
						snapshot.storagePressureProductionBonus = effect;
						break;
					case "overflow_reintegration_multiplier":
						snapshot.overflowReintegrationMultiplier *= effect.multiplier;
						break;
					case "idle_building_queue_speed_bonus":
						snapshot.idleBuildingQueueSpeedBonus = effect;
						break;
					case "building_queue_capacity_bonus":
						snapshot.buildingQueueCapacityBonus += effect.amount;
						break;
					case "shipyard_queue_capacity_bonus":
						snapshot.shipyardQueueCapacityBonus += effect.amount;
						break;
					case "colony_count_production_bonus":
						snapshot.colonyCountProductionBonuses.push(effect);
						break;
					case "industrial_focus_unlock":
						snapshot.industrialFocus = effect;
						break;
					case "active_command_window":
						snapshot.activeCommandWindow = effect;
						break;
					case "research_network_duration":
						snapshot.researchNetworkDuration = effect;
						break;
					case "research_cost_multiplier":
						snapshot.researchCostMultipliers.push(effect);
						break;
					case "ship_stat_multiplier":
						if (effect.shipKey) {
							snapshot.shipStatMultipliers[effect.shipKey][effect.stat] *= effect.multiplier;
						} else {
							snapshot.globalShipStatMultipliers[effect.stat] *= effect.multiplier;
						}
						break;
					case "defense_stat_multiplier":
						if (effect.defenseKey) {
							snapshot.defenseStatMultipliers[effect.defenseKey][effect.stat] *= effect.multiplier;
						} else {
							snapshot.globalDefenseStatMultipliers[effect.stat] *= effect.multiplier;
						}
						break;
					case "interceptor_wolfpack":
						snapshot.interceptorWolfpack = mergeInterceptorWolfpack(
							snapshot.interceptorWolfpack,
							effect,
						);
						break;
					case "enemy_attack_multiplier":
						snapshot.enemyAttackMultiplier = Math.min(
							snapshot.enemyAttackMultiplier,
							effect.multiplier,
						);
						break;
					case "contract_active_limit_bonus":
						snapshot.contractActiveLimitBonus += effect.amount;
						break;
					case "contract_visible_slot_bonus":
						snapshot.contractVisibleSlotBonus += effect.amount;
						break;
					case "contract_dispatch_fuel_multiplier":
						snapshot.contractDispatchFuelMultiplier *= effect.multiplier;
						break;
					case "contract_recovery_resources":
						snapshot.contractRecoveryRate = Math.max(
							snapshot.contractRecoveryRate,
							effect.recoveryRate,
						);
						break;
					case "contract_ship_capture":
						snapshot.contractShipCapture = effect;
						break;
					case "contract_task_force_template_bonus":
						snapshot.contractTaskForceTemplateBonus = effect;
						break;
					case "meta_matter_bonus_chance":
						snapshot.metaMatterBonusChances.push(effect);
						break;
					case "research_predictive_progress":
						snapshot.researchPredictiveProgressFraction = Math.max(
							snapshot.researchPredictiveProgressFraction,
							effect.progressFraction,
						);
						break;
					case "research_cross_branch_discount":
						snapshot.researchCrossBranchDiscount = effect;
						break;
					case "meta_matter_daily_conversion":
						snapshot.metaMatterDailyConversion = effect;
						break;
					case "research_network_exchange_duration":
						snapshot.researchNetworkExchange = effect;
						break;
					case "route_speed_multiplier":
						snapshot.routeSpeedMultipliers[effect.routeClass] *= effect.multiplier;
						break;
					case "route_streak_speed_bonus":
						snapshot.routeStreakSpeedBonus = effect;
						break;
					case "transport_extra_stop_bonus":
						snapshot.transportExtraStops += effect.amount;
						snapshot.transportExtraStopFuelMultiplier *= effect.fuelMultiplierPerStop;
						break;
					case "transport_delivery_distance_bonus":
						snapshot.transportDeliveryDistanceBonus = effect;
						break;
					case "transport_storage_reservation":
						snapshot.transportStorageReservationMultiplier = Math.max(
							snapshot.transportStorageReservationMultiplier,
							effect.multiplier,
						);
						break;
					case "contract_after_transport_meta_matter_multiplier":
						snapshot.contractAfterTransportMetaMatterMultiplier = effect;
						break;
					case "transport_return_duration_multiplier":
						snapshot.transportReturnDurationMultiplier *= effect.multiplier;
						break;
					case "colony_ship_build_time_multiplier":
						snapshot.colonyShipBuildTimeMultiplier *= effect.multiplier;
						break;
					case "colony_ship_fuel_multiplier":
						snapshot.colonyShipFuelMultiplier *= effect.multiplier;
						break;
					case "colony_overcap_penalty_reduction":
						snapshot.colonyOvercapPenaltyReduction += effect.amount;
						break;
					case "colony_charter_unlock":
						snapshot.colonyCharter = effect;
						break;
					case "colony_charter_penalty_removed":
						snapshot.colonyCharterPenaltyRemoved = true;
						break;
					case "charter_facility_upgrade_time_multiplier":
						snapshot.charterFacilityUpgradeTimeMultiplier *= effect.multiplier;
						break;
					case "charter_cooldown_hours":
						snapshot.charterCooldownHours = effect.hours;
						break;
					case "charter_ship_build_time_multiplier":
						snapshot.charterShipBuildTimeMultiplier *= effect.multiplier;
						break;
					case "charter_defense_build_time_multiplier":
						snapshot.charterDefenseBuildTimeMultiplier *= effect.multiplier;
						break;
					case "new_colony_bootstrap":
						snapshot.newColonyBootstrap = effect;
						break;
					case "new_colony_prefab_queue":
						snapshot.newColonyPrefabQueue = effect;
						break;
					case "protected_starting_resources":
						snapshot.protectedStartingResources = effect;
						break;
					case "charter_transport_reservation":
						snapshot.charterTransportReservation = effect;
						break;
					case "colony_cap_bonus":
						snapshot.colonyCapBonus += effect.amount;
						break;
					case "sector_capital_production":
						snapshot.sectorCapitalProduction = effect;
						break;
				}
			}
		}
	}

	return snapshot;
}

export function getResearchEffectSnapshot(levels: Partial<ResearchLevelMap> | undefined) {
	return buildResearchModifierSnapshot(levels);
}

export function canResearchNodeStart(args: {
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
