import type { DefenseCounts } from "./defenses";
import type { ResourceBucket, ShipKey } from "./gameplay";
import type { HostileFactionKey } from "./hostility";

import { DEFENSE_KEYS, EMPTY_DEFENSE_COUNTS } from "./defenses";
import { HOSTILE_FACTION_KEYS } from "./hostility";
import {
	DEFAULT_SHIP_DEFINITIONS,
	EMPTY_SHIP_COUNTS,
	normalizeShipCounts,
	type ShipCounts,
} from "./ships";

export const COMBAT_MISSION_TYPE_KEYS = [
	"salvageSweep",
	"supplyCacheRaid",
	"cruiserTakedown",
	"bombingRun",
	"glassProductionFacilities",
	"supplyInterception",
	"defenseGridSabotage",
	"commandBunkerStrike",
	"occupationConvoyRaid",
	"reconInForce",
] as const;

export type CombatMissionTypeKey = (typeof COMBAT_MISSION_TYPE_KEYS)[number];

export type CombatPriorityProfile = {
	attackerTargetPriority: Array<ShipKey | keyof DefenseCounts>;
	defenderTargetPriority: ShipKey[];
};

export type MissionTemplate = {
	baseControlReduction: number;
	baseCredits: number;
	baseXp: number;
	baseResourceReward: ResourceBucket;
	combatBudgetMultiplier: number;
	defenseWeight: number;
	displayName: string;
	fleetWeight: number;
	key: CombatMissionTypeKey;
	minRank: number;
	priorityProfile: CombatPriorityProfile;
};

export type ContractSnapshot = {
	controlReduction: number;
	difficultyTier: number;
	enemyDefenses: DefenseCounts;
	enemyFleet: ShipCounts;
	hostileFactionKey: HostileFactionKey;
	missionTypeKey: CombatMissionTypeKey;
	priorityProfile: CombatPriorityProfile;
	requiredRank: number;
	rewardCredits: number;
	rewardXpFailure: number;
	rewardXpSuccess: number;
	rewardResources: ResourceBucket;
};

export const CONTRACT_EXPIRY_MS = 6 * 60 * 60 * 1_000;

export const MISSION_TEMPLATES: Record<CombatMissionTypeKey, MissionTemplate> = {
	bombingRun: {
		key: "bombingRun",
		displayName: "Bombing Run",
		minRank: 3,
		fleetWeight: 0.25,
		defenseWeight: 0.75,
		combatBudgetMultiplier: 0.6,
		baseControlReduction: 45,
		baseCredits: 50,
		baseXp: 90,
		baseResourceReward: { alloy: 720, crystal: 325, fuel: 195 },
		priorityProfile: {
			attackerTargetPriority: [
				"shieldDome",
				"gaussCannon",
				"laserTurret",
				"missileBattery",
				"cruiser",
				"frigate",
				"interceptor",
				"bomber",
				"smallCargo",
				"largeCargo",
				"colonyShip",
			],
			defenderTargetPriority: [
				"bomber",
				"cruiser",
				"frigate",
				"interceptor",
				"largeCargo",
				"smallCargo",
				"colonyShip",
			],
		},
	},
	commandBunkerStrike: {
		key: "commandBunkerStrike",
		displayName: "Command Bunker Strike",
		minRank: 10,
		fleetWeight: 0.4,
		defenseWeight: 0.6,
		combatBudgetMultiplier: 1,
		baseControlReduction: 120,
		baseCredits: 360,
		baseXp: 175,
		baseResourceReward: { alloy: 455, crystal: 585, fuel: 285 },
		priorityProfile: {
			attackerTargetPriority: [
				"shieldDome",
				"gaussCannon",
				"laserTurret",
				"missileBattery",
				"cruiser",
				"bomber",
				"frigate",
				"interceptor",
				"smallCargo",
				"largeCargo",
				"colonyShip",
			],
			defenderTargetPriority: [
				"cruiser",
				"bomber",
				"frigate",
				"interceptor",
				"largeCargo",
				"smallCargo",
				"colonyShip",
			],
		},
	},
	cruiserTakedown: {
		key: "cruiserTakedown",
		displayName: "Cruiser Takedown",
		minRank: 4,
		fleetWeight: 0.9,
		defenseWeight: 0.1,
		combatBudgetMultiplier: 0.72,
		baseControlReduction: 52,
		baseCredits: 70,
		baseXp: 100,
		baseResourceReward: { alloy: 415, crystal: 415, fuel: 285 },
		priorityProfile: {
			attackerTargetPriority: [
				"cruiser",
				"frigate",
				"interceptor",
				"bomber",
				"smallCargo",
				"largeCargo",
				"colonyShip",
				"gaussCannon",
				"laserTurret",
				"missileBattery",
				"shieldDome",
			],
			defenderTargetPriority: [
				"cruiser",
				"bomber",
				"frigate",
				"interceptor",
				"largeCargo",
				"smallCargo",
				"colonyShip",
			],
		},
	},
	defenseGridSabotage: {
		key: "defenseGridSabotage",
		displayName: "Defense Grid Sabotage",
		minRank: 5,
		fleetWeight: 0.1,
		defenseWeight: 0.9,
		combatBudgetMultiplier: 1,
		baseControlReduction: 110,
		baseCredits: 320,
		baseXp: 160,
		baseResourceReward: { alloy: 910, crystal: 650, fuel: 235 },
		priorityProfile: {
			attackerTargetPriority: [
				"gaussCannon",
				"shieldDome",
				"laserTurret",
				"missileBattery",
				"cruiser",
				"frigate",
				"interceptor",
				"bomber",
				"smallCargo",
				"largeCargo",
				"colonyShip",
			],
			defenderTargetPriority: [
				"bomber",
				"cruiser",
				"frigate",
				"interceptor",
				"largeCargo",
				"smallCargo",
				"colonyShip",
			],
		},
	},
	glassProductionFacilities: {
		key: "glassProductionFacilities",
		displayName: "Glass Production Facilities",
		minRank: 5,
		fleetWeight: 0.2,
		defenseWeight: 0.8,
		combatBudgetMultiplier: 0.9,
		baseControlReduction: 100,
		baseCredits: 290,
		baseXp: 140,
		baseResourceReward: { alloy: 1_105, crystal: 845, fuel: 155 },
		priorityProfile: {
			attackerTargetPriority: [
				"laserTurret",
				"missileBattery",
				"gaussCannon",
				"shieldDome",
				"frigate",
				"interceptor",
				"cruiser",
				"bomber",
				"smallCargo",
				"largeCargo",
				"colonyShip",
			],
			defenderTargetPriority: [
				"frigate",
				"bomber",
				"cruiser",
				"interceptor",
				"largeCargo",
				"smallCargo",
				"colonyShip",
			],
		},
	},
	occupationConvoyRaid: {
		key: "occupationConvoyRaid",
		displayName: "Occupation Convoy Raid",
		minRank: 7,
		fleetWeight: 0.6,
		defenseWeight: 0.4,
		combatBudgetMultiplier: 1,
		baseControlReduction: 85,
		baseCredits: 310,
		baseXp: 150,
		baseResourceReward: { alloy: 650, crystal: 520, fuel: 585 },
		priorityProfile: {
			attackerTargetPriority: [
				"largeCargo",
				"smallCargo",
				"frigate",
				"interceptor",
				"cruiser",
				"bomber",
				"colonyShip",
				"laserTurret",
				"missileBattery",
				"gaussCannon",
				"shieldDome",
			],
			defenderTargetPriority: [
				"largeCargo",
				"smallCargo",
				"cruiser",
				"bomber",
				"frigate",
				"interceptor",
				"colonyShip",
			],
		},
	},
	reconInForce: {
		key: "reconInForce",
		displayName: "Recon In Force",
		minRank: 1,
		fleetWeight: 0.45,
		defenseWeight: 0.55,
		combatBudgetMultiplier: 0.25,
		baseControlReduction: 16,
		baseCredits: 10,
		baseXp: 45,
		baseResourceReward: { alloy: 415, crystal: 235, fuel: 235 },
		priorityProfile: {
			attackerTargetPriority: [
				"interceptor",
				"frigate",
				"smallCargo",
				"largeCargo",
				"cruiser",
				"bomber",
				"colonyShip",
				"missileBattery",
				"laserTurret",
				"gaussCannon",
				"shieldDome",
			],
			defenderTargetPriority: [
				"interceptor",
				"frigate",
				"cruiser",
				"bomber",
				"smallCargo",
				"largeCargo",
				"colonyShip",
			],
		},
	},
	salvageSweep: {
		key: "salvageSweep",
		displayName: "Salvage Sweep",
		minRank: 1,
		fleetWeight: 0.2,
		defenseWeight: 0.8,
		combatBudgetMultiplier: 0.28,
		baseControlReduction: 18,
		baseCredits: 0,
		baseXp: 55,
		baseResourceReward: { alloy: 1_235, crystal: 340, fuel: 145 },
		priorityProfile: {
			attackerTargetPriority: [
				"missileBattery",
				"laserTurret",
				"smallCargo",
				"largeCargo",
				"gaussCannon",
				"shieldDome",
				"interceptor",
				"frigate",
				"cruiser",
				"bomber",
				"colonyShip",
			],
			defenderTargetPriority: [
				"smallCargo",
				"interceptor",
				"frigate",
				"largeCargo",
				"cruiser",
				"bomber",
				"colonyShip",
			],
		},
	},
	supplyCacheRaid: {
		key: "supplyCacheRaid",
		displayName: "Supply Cache Raid",
		minRank: 1,
		fleetWeight: 0.55,
		defenseWeight: 0.45,
		combatBudgetMultiplier: 0.34,
		baseControlReduction: 24,
		baseCredits: 20,
		baseXp: 60,
		baseResourceReward: { alloy: 625, crystal: 310, fuel: 805 },
		priorityProfile: {
			attackerTargetPriority: [
				"largeCargo",
				"smallCargo",
				"interceptor",
				"frigate",
				"missileBattery",
				"laserTurret",
				"cruiser",
				"bomber",
				"gaussCannon",
				"shieldDome",
				"colonyShip",
			],
			defenderTargetPriority: [
				"largeCargo",
				"smallCargo",
				"interceptor",
				"frigate",
				"cruiser",
				"bomber",
				"colonyShip",
			],
		},
	},
	supplyInterception: {
		key: "supplyInterception",
		displayName: "Supply Interception",
		minRank: 2,
		fleetWeight: 0.85,
		defenseWeight: 0.15,
		combatBudgetMultiplier: 0.5,
		baseControlReduction: 32,
		baseCredits: 35,
		baseXp: 75,
		baseResourceReward: { alloy: 585, crystal: 325, fuel: 585 },
		priorityProfile: {
			attackerTargetPriority: [
				"largeCargo",
				"smallCargo",
				"interceptor",
				"frigate",
				"cruiser",
				"bomber",
				"colonyShip",
				"missileBattery",
				"laserTurret",
				"gaussCannon",
				"shieldDome",
			],
			defenderTargetPriority: [
				"largeCargo",
				"smallCargo",
				"frigate",
				"interceptor",
				"cruiser",
				"bomber",
				"colonyShip",
			],
		},
	},
};

export function getVisibleContractSlotCount(rank: number) {
	const safeRank = Math.max(1, Math.floor(rank));
	return 2 + Math.floor((safeRank - 1) / 5);
}

export function getConcurrentContractLimit(rank: number) {
	const safeRank = Math.max(1, Math.floor(rank));
	return 1 + Math.floor((safeRank - 1) / 5);
}

export function getDifficultyTierForRank(rank: number) {
	const safeRank = Math.max(1, Math.floor(rank));
	return 1 + Math.floor((safeRank - 1) / 5);
}

function scaleValue(base: number, difficultyTier: number) {
	return Math.max(1, Math.round(base * Math.pow(1.2, Math.max(0, difficultyTier - 1))));
}

function createSeedHash(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function seededPick<T extends string>(seed: string, values: readonly T[]) {
	const hash = createSeedHash(seed);
	const picked = values[hash % values.length];
	if (!picked) {
		throw new Error("seededPick requires a non-empty values array");
	}
	return picked;
}

function distributeFleetBudget(args: { budget: number; seed: string; weights: ShipKey[] }) {
	const counts = { ...EMPTY_SHIP_COUNTS };
	let remaining = Math.max(0, Math.floor(args.budget));
	let cursor = 0;
	let stalledPasses = 0;
	while (remaining > 0) {
		const key = args.weights[cursor % args.weights.length];
		if (!key) {
			break;
		}
		const definition = DEFAULT_SHIP_DEFINITIONS[key];
		const divisor = Math.max(1, Math.round(definition.attack / 40));
		const amount = Math.floor(remaining / divisor / 4);
		if (amount <= 0) {
			cursor += 1;
			stalledPasses += 1;
			if (stalledPasses >= args.weights.length) {
				break;
			}
			continue;
		}
		counts[key] += amount;
		remaining -= amount * divisor;
		cursor += 1;
		stalledPasses = 0;
		if (cursor > 24) {
			break;
		}
	}
	return normalizeShipCounts(counts);
}

function distributeDefenseBudget(args: { budget: number; seed: string }) {
	const counts = { ...EMPTY_DEFENSE_COUNTS };
	let remaining = Math.max(0, Math.floor(args.budget));
	const order = [
		seededPick(`${args.seed}:a`, DEFENSE_KEYS),
		seededPick(`${args.seed}:b`, DEFENSE_KEYS),
		seededPick(`${args.seed}:c`, DEFENSE_KEYS),
		seededPick(`${args.seed}:d`, DEFENSE_KEYS),
	];

	for (const [index, key] of order.entries()) {
		if (!key) {
			continue;
		}
		const divisor = index === 0 ? 18 : index === 1 ? 24 : index === 2 ? 32 : 48;
		const amount = Math.max(0, Math.floor(remaining / divisor));
		counts[key] += amount;
		remaining -= amount * divisor;
	}

	if (counts.missileBattery + counts.laserTurret + counts.gaussCannon + counts.shieldDome <= 0) {
		counts.missileBattery = 1;
	}

	return counts;
}

export function generateContractSnapshot(args: {
	difficultyTier: number;
	planetControlMax: number;
	playerRank: number;
	seed: string;
	slot: number;
}) {
	const difficultyTier = Math.max(1, Math.floor(args.difficultyTier));
	const allowedTemplates = COMBAT_MISSION_TYPE_KEYS.map((key) => MISSION_TEMPLATES[key]).filter(
		(template) => template.minRank <= Math.max(1, Math.floor(args.playerRank)),
	);
	const template =
		allowedTemplates[
			createSeedHash(`${args.seed}:mission:${args.slot}`) % allowedTemplates.length
		] ?? MISSION_TEMPLATES.reconInForce;
	const hostileFactionKey = seededPick(`${args.seed}:faction`, HOSTILE_FACTION_KEYS);
	const combatBudget = Math.max(
		1,
		Math.round(scaleValue(120, difficultyTier) * template.combatBudgetMultiplier),
	);
	const enemyFleet = distributeFleetBudget({
		budget: Math.round(combatBudget * template.fleetWeight),
		seed: `${args.seed}:fleet`,
		weights: ["interceptor", "frigate", "cruiser", "bomber", "smallCargo", "largeCargo"],
	});
	const enemyDefenses = distributeDefenseBudget({
		budget: Math.round(combatBudget * template.defenseWeight),
		seed: `${args.seed}:defense`,
	});
	const rewardResources: ResourceBucket = {
		alloy: scaleValue(template.baseResourceReward.alloy, difficultyTier),
		crystal: scaleValue(template.baseResourceReward.crystal, difficultyTier),
		fuel: scaleValue(template.baseResourceReward.fuel, difficultyTier),
	};
	const rewardXpSuccess = scaleValue(template.baseXp, difficultyTier);

	return {
		controlReduction: Math.min(
			Math.max(1, args.planetControlMax),
			scaleValue(template.baseControlReduction, difficultyTier),
		),
		difficultyTier,
		enemyDefenses,
		enemyFleet,
		hostileFactionKey,
		missionTypeKey: template.key,
		priorityProfile: template.priorityProfile,
		requiredRank: template.minRank,
		rewardCredits: scaleValue(template.baseCredits, difficultyTier),
		rewardXpFailure: Math.floor(rewardXpSuccess * 0.2),
		rewardXpSuccess,
		rewardResources,
	} satisfies ContractSnapshot;
}
