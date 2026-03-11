import type { DefenseCounts } from "./defenses";
import type { ShipKey } from "./gameplay";
import type { ShipCounts } from "./ships";

import { DEFAULT_DEFENSE_DEFINITIONS, normalizeDefenseCounts, type DefenseKey } from "./defenses";
import { DEFAULT_SHIP_DEFINITIONS, getFleetCargoCapacity, normalizeShipCounts } from "./ships";

type CombatUnitKey = ShipKey | DefenseKey;

type CombatUnitState = {
	count: number;
	damageOnFrontUnit: number;
	hull: number;
	key: CombatUnitKey;
	shield: number;
};

export type CombatSide = {
	defenses?: Partial<DefenseCounts>;
	ships?: Partial<ShipCounts>;
	targetPriority: CombatUnitKey[];
};

export type CombatRoundSummary = {
	attackerRemaining: ShipCounts;
	defenderDefensesRemaining: DefenseCounts;
	defenderFleetRemaining: ShipCounts;
	round: number;
};

export type CombatResult = {
	attackerRemaining: ShipCounts;
	cargoCapacityRemaining: number;
	combatLogSummary: CombatRoundSummary[];
	defenderDefenseRemaining: DefenseCounts;
	defenderFleetRemaining: ShipCounts;
	roundsFought: number;
	success: boolean;
};

function isDefenseKey(key: CombatUnitKey): key is DefenseKey {
	return key in DEFAULT_DEFENSE_DEFINITIONS;
}

function getUnitAttack(key: CombatUnitKey) {
	return isDefenseKey(key)
		? DEFAULT_DEFENSE_DEFINITIONS[key].attack
		: DEFAULT_SHIP_DEFINITIONS[key].attack;
}

function getUnitHull(key: CombatUnitKey) {
	return isDefenseKey(key)
		? DEFAULT_DEFENSE_DEFINITIONS[key].hull
		: DEFAULT_SHIP_DEFINITIONS[key].hull;
}

function getUnitShield(key: CombatUnitKey) {
	return isDefenseKey(key)
		? DEFAULT_DEFENSE_DEFINITIONS[key].shield
		: DEFAULT_SHIP_DEFINITIONS[key].shield;
}

function createShipState(shipCounts: Partial<ShipCounts>) {
	const normalized = normalizeShipCounts(shipCounts);
	return (Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[])
		.map((key) => ({
			key,
			count: normalized[key],
			damageOnFrontUnit: 0,
			hull: DEFAULT_SHIP_DEFINITIONS[key].hull,
			shield: DEFAULT_SHIP_DEFINITIONS[key].shield,
		}))
		.filter((unit) => unit.count > 0);
}

function createDefenseState(defenseCounts: Partial<DefenseCounts>) {
	const normalized = normalizeDefenseCounts(defenseCounts);
	return (Object.keys(DEFAULT_DEFENSE_DEFINITIONS) as DefenseKey[])
		.map((key) => ({
			key,
			count: normalized[key],
			damageOnFrontUnit: 0,
			hull: DEFAULT_DEFENSE_DEFINITIONS[key].hull,
			shield: DEFAULT_DEFENSE_DEFINITIONS[key].shield,
		}))
		.filter((unit) => unit.count > 0);
}

function pickTarget(
	targetPriority: CombatUnitKey[],
	targetShips: CombatUnitState[],
	targetDefenses: CombatUnitState[],
) {
	for (const key of targetPriority) {
		const source = isDefenseKey(key) ? targetDefenses : targetShips;
		const match = source.find((unit) => unit.key === key && unit.count > 0);
		if (match) {
			return match;
		}
	}

	const fallback = [...targetShips, ...targetDefenses]
		.filter((unit) => unit.count > 0)
		.sort((left, right) => right.count - left.count)[0];
	return fallback ?? null;
}

function applyDamage(target: CombatUnitState, incomingDamage: number) {
	let damage = Math.max(0, Math.floor(incomingDamage));
	if (damage <= 0 || target.count <= 0) {
		return 0;
	}

	damage = Math.max(0, damage - target.shield);
	if (damage <= 0) {
		return 0;
	}

	let remainingHull = target.hull - target.damageOnFrontUnit;
	while (damage >= remainingHull && target.count > 0) {
		damage -= remainingHull;
		target.count -= 1;
		target.damageOnFrontUnit = 0;
		remainingHull = target.hull;
	}

	if (target.count > 0 && damage > 0) {
		target.damageOnFrontUnit += damage;
	}

	return incomingDamage;
}

function resolveSideAttack(args: {
	attackers: CombatUnitState[];
	targetDefenses: CombatUnitState[];
	targetPriority: CombatUnitKey[];
	targetShips: CombatUnitState[];
}) {
	for (const attacker of args.attackers) {
		if (attacker.count <= 0) {
			continue;
		}
		let remainingDamage = attacker.count * getUnitAttack(attacker.key);

		while (remainingDamage > 0) {
			const target = pickTarget(args.targetPriority, args.targetShips, args.targetDefenses);
			if (!target) {
				return;
			}

			const fullTargetHull = getUnitHull(target.key);
			const targetShield = getUnitShield(target.key);
			const frontRemaining = fullTargetHull - target.damageOnFrontUnit;
			const effectiveHull =
				frontRemaining + targetShield + Math.max(0, (target.count - 1) * fullTargetHull);
			if (effectiveHull <= 0) {
				break;
			}

			const volley = Math.min(remainingDamage, effectiveHull);
			applyDamage(target, volley);
			remainingDamage -= volley;
		}
	}
}

function toShipCounts(units: CombatUnitState[]) {
	const counts = normalizeShipCounts({});
	for (const unit of units) {
		if (isDefenseKey(unit.key)) {
			continue;
		}
		counts[unit.key] = unit.count;
	}
	return counts;
}

function toDefenseCounts(units: CombatUnitState[]) {
	const counts = normalizeDefenseCounts({});
	for (const unit of units) {
		if (!isDefenseKey(unit.key)) {
			continue;
		}
		counts[unit.key] = unit.count;
	}
	return counts;
}

function hasLivingUnits(units: CombatUnitState[]) {
	return units.some((unit) => unit.count > 0);
}

export function simulateCombat(args: {
	attacker: CombatSide;
	defender: CombatSide;
	maxRounds?: number;
}) {
	const attackerShips = createShipState(args.attacker.ships ?? {});
	const defenderShips = createShipState(args.defender.ships ?? {});
	const defenderDefenses = createDefenseState(args.defender.defenses ?? {});
	const rounds = Math.max(1, Math.floor(args.maxRounds ?? 6));
	const combatLogSummary: CombatRoundSummary[] = [];

	for (let round = 1; round <= rounds; round += 1) {
		if (
			!hasLivingUnits(attackerShips) ||
			(!hasLivingUnits(defenderShips) && !hasLivingUnits(defenderDefenses))
		) {
			break;
		}

		resolveSideAttack({
			attackers: attackerShips,
			targetShips: defenderShips,
			targetDefenses: defenderDefenses,
			targetPriority: args.attacker.targetPriority,
		});

		if (hasLivingUnits(defenderShips) || hasLivingUnits(defenderDefenses)) {
			resolveSideAttack({
				attackers: [...defenderShips, ...defenderDefenses],
				targetShips: attackerShips,
				targetDefenses: [],
				targetPriority: args.defender.targetPriority,
			});
		}

		combatLogSummary.push({
			round,
			attackerRemaining: toShipCounts(attackerShips),
			defenderFleetRemaining: toShipCounts(defenderShips),
			defenderDefensesRemaining: toDefenseCounts(defenderDefenses),
		});
	}

	const attackerRemaining = toShipCounts(attackerShips);
	const defenderFleetRemaining = toShipCounts(defenderShips);
	const defenderDefenseRemaining = toDefenseCounts(defenderDefenses);
	const success =
		Object.values(defenderFleetRemaining).every((count) => count === 0) &&
		Object.values(defenderDefenseRemaining).every((count) => count === 0) &&
		Object.values(attackerRemaining).some((count) => count > 0);

	return {
		attackerRemaining,
		cargoCapacityRemaining: getFleetCargoCapacity(attackerRemaining),
		combatLogSummary,
		defenderDefenseRemaining,
		defenderFleetRemaining,
		roundsFought: combatLogSummary.length,
		success,
	} satisfies CombatResult;
}
