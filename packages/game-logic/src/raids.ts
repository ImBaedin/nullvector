import type { DefenseCounts } from "./defenses";
import type { ShipKey } from "./gameplay";
import type { HostileFactionKey } from "./hostility";
import type { ShipCounts } from "./ships";

import { DEFAULT_DEFENSE_DEFINITIONS } from "./defenses";
import { normalizeShipCounts, DEFAULT_SHIP_DEFINITIONS } from "./ships";

const RAID_ATTACKER_TARGET_PRIORITY: Array<ShipKey | keyof DefenseCounts> = [
	"shieldDome",
	"gaussCannon",
	"laserTurret",
	"missileBattery",
	"cruiser",
	"frigate",
	"interceptor",
	"bomber",
	"largeCargo",
	"smallCargo",
	"colonyShip",
];

const RAID_DEFENDER_TARGET_PRIORITY: ShipKey[] = [
	"bomber",
	"cruiser",
	"frigate",
	"interceptor",
	"largeCargo",
	"smallCargo",
	"colonyShip",
];

function hashString(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function pickShipsForBudget(args: {
	budget: number;
	hostileFactionKey: HostileFactionKey;
	seed: string;
}) {
	const counts = normalizeShipCounts({});
	const weightedChoices =
		args.hostileFactionKey === "rogueAi"
			? (["interceptor", "frigate", "cruiser", "bomber"] as const)
			: (["smallCargo", "interceptor", "frigate", "cruiser"] as const);
	let remaining = Math.max(1, Math.floor(args.budget));
	let cursor = hashString(args.seed);

	while (remaining > 0) {
		const key = weightedChoices[cursor % weightedChoices.length] ?? "interceptor";
		const definition = DEFAULT_SHIP_DEFINITIONS[key];
		const shipPower = definition.attack + definition.hull + definition.shield;
		if (
			shipPower <= remaining ||
			counts.smallCargo + counts.interceptor + counts.frigate + counts.cruiser + counts.bomber === 0
		) {
			counts[key] += 1;
			remaining = Math.max(0, remaining - shipPower);
		} else {
			const affordable = weightedChoices.find((candidate) => {
				const ship = DEFAULT_SHIP_DEFINITIONS[candidate];
				return ship.attack + ship.hull + ship.shield <= remaining;
			});
			if (!affordable) {
				break;
			}
			counts[affordable] += 1;
			const ship = DEFAULT_SHIP_DEFINITIONS[affordable];
			remaining = Math.max(0, remaining - (ship.attack + ship.hull + ship.shield));
		}
		cursor = hashString(`${args.seed}:${cursor}:${key}`);
	}

	return counts;
}

export function estimateColonyDefensePower(args: {
	defenses: Partial<DefenseCounts>;
	ships: Partial<ShipCounts>;
}) {
	const ships = normalizeShipCounts(args.ships);
	let total = 0;

	for (const [key, count] of Object.entries(ships) as Array<[ShipKey, number]>) {
		if (count <= 0) {
			continue;
		}
		const definition = DEFAULT_SHIP_DEFINITIONS[key];
		total += count * (definition.attack + definition.hull + definition.shield);
	}

	for (const [key, count] of Object.entries(args.defenses) as Array<
		[keyof DefenseCounts, number]
	>) {
		if ((count ?? 0) <= 0) {
			continue;
		}
		const definition = DEFAULT_DEFENSE_DEFINITIONS[key];
		total += count * (definition.attack + definition.hull + definition.shield);
	}

	return total;
}

export function generateNpcRaidSnapshot(args: {
	difficultyTier: number;
	hostileFactionKey: HostileFactionKey;
	seed: string;
}) {
	const difficultyTier = Math.max(1, Math.floor(args.difficultyTier));
	const budget = 1_000 + difficultyTier * 1_500;
	return {
		attackerFleet: pickShipsForBudget({
			budget,
			hostileFactionKey: args.hostileFactionKey,
			seed: args.seed,
		}),
		attackerTargetPriority: RAID_ATTACKER_TARGET_PRIORITY,
		defenderTargetPriority: RAID_DEFENDER_TARGET_PRIORITY,
	};
}
