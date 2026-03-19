import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import {
	DEFAULT_SHIP_DEFINITIONS,
	EMPTY_SHIP_COUNTS,
	HOSTILE_FACTIONS,
	MISSION_TEMPLATES,
	normalizeDefenseCounts,
	normalizeShipCounts,
	simulateCombat,
	type CombatMissionTypeKey,
	type DefenseCounts,
	type DefenseKey,
	type HostileFactionKey,
	type ShipCounts,
	type ShipKey,
} from "@nullvector/game-logic";

export type ContractView = {
	id: Id<"contracts"> | string;
	planetId: Id<"planets">;
	slot: number;
	status: "available" | "inProgress" | "completed" | "failed" | "expired" | "replaced";
	missionTypeKey: string;
	requiredRank: number;
	difficultyTier: number;
	expiresAt?: number;
	acceptedAt?: number;
	resolvedAt?: number;
	offerSequence?: number;
	rewardCredits: number;
	rewardRankXpSuccess: number;
	rewardRankXpFailure: number;
	rewardResources: { alloy: number; crystal: number; fuel: number };
	controlReduction: number;
	enemyFleet: ShipCounts;
	enemyDefenses: DefenseCounts;
};

export type RecommendedContractView = ContractView & {
	planetDisplayName: string;
	planetAddressLabel: string;
	sectorDisplayName: string;
	hostileFactionKey: HostileFactionKey;
	distance: number;
};

export type SelectedContractContext = {
	contract: ContractView;
	planet: {
		displayName: string;
		addressLabel: string;
		hostileFactionKey: HostileFactionKey;
		sectorDisplayName: string;
	};
	distance: number;
};

export type ShipAssignment = Pick<
	(typeof DEFAULT_SHIP_DEFINITIONS)[ShipKey],
	"cargoCapacity" | "fuelLaunchCost" | "fuelDistanceRate" | "key" | "name" | "speed"
> & {
	available: number;
};

export type ContractForecast = {
	label: string;
	tone: "emerald" | "amber" | "rose";
	detail: string;
	projectedSurvivors: ShipCounts;
	projectedLosses: ShipCounts;
	projectedEnemyFleetRemaining: ShipCounts;
	projectedEnemyDefensesRemaining: DefenseCounts;
	roundsFought: number;
	rewardCargoRecoverable: number;
	rewardCargoLost: number;
};

const SHIP_ICON_MAP: Record<string, string> = {
	smallCargo: "small-cargo",
	largeCargo: "large-cargo",
	colonyShip: "colony-ship",
	interceptor: "interceptor",
	frigate: "frigate",
	cruiser: "cruiser",
	bomber: "bomber",
};

const DEFENSE_ICON_MAP: Record<string, string> = {
	missileBattery: "missile-battery",
	laserTurret: "laser-turret",
	gaussCannon: "gauss-cannon",
	shieldDome: "shield-dome",
};

export const DEFAULT_SELECTED_SHIPS: Record<ShipKey, number> = { ...EMPTY_SHIP_COUNTS };

export const SHIP_DISPLAY_ORDER: ShipKey[] = [
	"interceptor",
	"frigate",
	"cruiser",
	"bomber",
	"smallCargo",
	"largeCargo",
	"colonyShip",
];

export const DEFENSE_DISPLAY_ORDER: DefenseKey[] = [
	"missileBattery",
	"laserTurret",
	"gaussCannon",
	"shieldDome",
];

export function shipIconSrc(key: string): string {
	return `/game-icons/ships/${SHIP_ICON_MAP[key] ?? key}.png`;
}

export function defenseIconSrc(key: string): string {
	return `/game-icons/defenses/${DEFENSE_ICON_MAP[key] ?? key}.png`;
}

export function factionIconSrc(factionKey: HostileFactionKey): string {
	return `/game-icons/factions/${HOSTILE_FACTIONS[factionKey].iconAsset}.png`;
}

export function factionColor(factionKey: HostileFactionKey): {
	accent: string;
	bg: string;
	border: string;
	text: string;
} {
	if (factionKey === "rogueAi") {
		return {
			accent: "violet",
			bg: "bg-violet-400/10",
			border: "border-violet-300/25",
			text: "text-violet-200",
		};
	}

	return {
		accent: "rose",
		bg: "bg-rose-400/10",
		border: "border-rose-300/25",
		text: "text-rose-200",
	};
}

export function sumShipCounts(shipCounts: Partial<ShipCounts>): number {
	return Object.values(normalizeShipCounts(shipCounts)).reduce((sum, count) => sum + count, 0);
}

export function sumDefenseCounts(defenseCounts: Partial<DefenseCounts>): number {
	return Object.values(normalizeDefenseCounts(defenseCounts)).reduce(
		(sum, count) => sum + count,
		0,
	);
}

export function getProjectedLosses(
	start: Partial<ShipCounts>,
	end: Partial<ShipCounts>,
): ShipCounts {
	const startCounts = normalizeShipCounts(start);
	const endCounts = normalizeShipCounts(end);
	const losses = normalizeShipCounts({});

	for (const key of Object.keys(startCounts) as ShipKey[]) {
		losses[key] = Math.max(0, startCounts[key] - endCounts[key]);
	}

	return losses;
}

export function getForecastToneClass(tone: ContractForecast["tone"]): string {
	if (tone === "emerald") {
		return "border-emerald-300/20 bg-emerald-400/8 text-emerald-100";
	}
	if (tone === "amber") {
		return "border-amber-300/20 bg-amber-400/8 text-amber-100";
	}
	return "border-rose-300/20 bg-rose-400/8 text-rose-100";
}

export function getEnemyWeightLabel(fleetWeight: number): string {
	if (fleetWeight > 0.5) {
		return "Heavy";
	}
	if (fleetWeight > 0.2) {
		return "Medium";
	}
	return "Light";
}

export function buildContractForecast(
	contract: ContractView,
	selectedShips: Partial<ShipCounts>,
): ContractForecast | null {
	const template = MISSION_TEMPLATES[contract.missionTypeKey as CombatMissionTypeKey];
	if (!template) {
		return null;
	}

	const attackerShips = normalizeShipCounts(selectedShips);
	if (!Object.values(attackerShips).some((count) => count > 0)) {
		return null;
	}

	const combat = simulateCombat({
		attacker: {
			ships: attackerShips,
			targetPriority: template.priorityProfile.attackerTargetPriority,
		},
		defender: {
			ships: contract.enemyFleet,
			defenses: contract.enemyDefenses,
			targetPriority: template.priorityProfile.defenderTargetPriority,
		},
		maxRounds: 6,
	});

	const projectedLosses = getProjectedLosses(attackerShips, combat.attackerRemaining);
	const totalStartingShips = sumShipCounts(attackerShips);
	const survivingShips = sumShipCounts(combat.attackerRemaining);
	const enemyUnitsRemaining =
		sumShipCounts(combat.defenderFleetRemaining) +
		sumDefenseCounts(combat.defenderDefenseRemaining);
	const rewardCargoTotal =
		contract.rewardResources.alloy +
		contract.rewardResources.crystal +
		contract.rewardResources.fuel;
	const rewardCargoRecoverable = combat.success
		? Math.min(rewardCargoTotal, combat.cargoCapacityRemaining)
		: 0;
	const rewardCargoLost = combat.success
		? Math.max(0, rewardCargoTotal - rewardCargoRecoverable)
		: 0;

	if (combat.success && survivingShips === totalStartingShips) {
		return {
			label: "Overwhelming",
			tone: "emerald",
			detail: "Clean win projected with no combat losses.",
			projectedSurvivors: combat.attackerRemaining,
			projectedLosses,
			projectedEnemyFleetRemaining: combat.defenderFleetRemaining,
			projectedEnemyDefensesRemaining: combat.defenderDefenseRemaining,
			roundsFought: combat.roundsFought,
			rewardCargoRecoverable,
			rewardCargoLost,
		};
	}

	if (combat.success) {
		return {
			label: "Advantageous",
			tone: "emerald",
			detail: `Victory projected in ${combat.roundsFought} rounds with losses.`,
			projectedSurvivors: combat.attackerRemaining,
			projectedLosses,
			projectedEnemyFleetRemaining: combat.defenderFleetRemaining,
			projectedEnemyDefensesRemaining: combat.defenderDefenseRemaining,
			roundsFought: combat.roundsFought,
			rewardCargoRecoverable,
			rewardCargoLost,
		};
	}

	if (survivingShips > 0) {
		return {
			label: "Contested",
			tone: "amber",
			detail:
				enemyUnitsRemaining > 0
					? `Projected stalemate after ${combat.roundsFought} rounds; surviving ships return empty.`
					: "Projected pyrrhic outcome; review fleet mix before launching.",
			projectedSurvivors: combat.attackerRemaining,
			projectedLosses,
			projectedEnemyFleetRemaining: combat.defenderFleetRemaining,
			projectedEnemyDefensesRemaining: combat.defenderDefenseRemaining,
			roundsFought: combat.roundsFought,
			rewardCargoRecoverable,
			rewardCargoLost,
		};
	}

	return {
		label: "Unfavorable",
		tone: "rose",
		detail: `Fleet projected to be destroyed within ${combat.roundsFought} rounds.`,
		projectedSurvivors: combat.attackerRemaining,
		projectedLosses,
		projectedEnemyFleetRemaining: combat.defenderFleetRemaining,
		projectedEnemyDefensesRemaining: combat.defenderDefenseRemaining,
		roundsFought: combat.roundsFought,
		rewardCargoRecoverable,
		rewardCargoLost,
	};
}
