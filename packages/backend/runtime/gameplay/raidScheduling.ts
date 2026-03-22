import { HOSTILE_FACTION_KEYS, type HostileFactionKey } from "@nullvector/game-logic";

import type { Id } from "../../convex/_generated/dataModel";

export const RAID_MIN_PLAYER_RANK = 3;
const RAID_INTERVAL_MS = 12 * 60 * 60 * 1_000;
const RAID_SCHEDULE_JITTER_MS = 30 * 60 * 1_000;
const RAID_TRAVEL_BASE_MS = 45 * 60 * 1_000;
const RAID_TRAVEL_JITTER_MS = 15 * 60 * 1_000;

function hashString(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function computeNextNpcRaidAt(args: { anchorAt: number; colonyId: Id<"colonies"> }) {
	return args.anchorAt + RAID_INTERVAL_MS + (hashString(args.colonyId) % RAID_SCHEDULE_JITTER_MS);
}

export function computeNpcRaidTravelDurationMs(args: {
	colonyId: Id<"colonies">;
	scheduledAt: number;
}) {
	return (
		RAID_TRAVEL_BASE_MS +
		(hashString(`${args.colonyId}:${args.scheduledAt}:travel`) % RAID_TRAVEL_JITTER_MS)
	);
}

export function pickNpcRaidFaction(args: {
	colonyId: Id<"colonies">;
	scheduledAt: number;
}): HostileFactionKey {
	const index =
		hashString(`${args.colonyId}:${args.scheduledAt}:faction`) % HOSTILE_FACTION_KEYS.length;
	return HOSTILE_FACTION_KEYS[index] ?? "spacePirates";
}
