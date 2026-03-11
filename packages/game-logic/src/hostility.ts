export const HOSTILE_FACTION_KEYS = ["spacePirates", "rogueAi"] as const;

export type HostileFactionKey = (typeof HOSTILE_FACTION_KEYS)[number];

export const HOSTILE_FACTIONS: Record<
	HostileFactionKey,
	{
		description: string;
		displayName: string;
		iconAsset: string;
		uiAccentHex: string;
	}
> = {
	spacePirates: {
		description: "Raiders and scavengers holding strategic lanes through force.",
		displayName: "Space Pirates",
		iconAsset: "space-pirates",
		uiAccentHex: "#fda4af",
	},
	rogueAi: {
		description: "Autonomous machine collectives operating hostile occupation grids.",
		displayName: "Rogue AI",
		iconAsset: "rogue-ai",
		uiAccentHex: "#c4b5fd",
	},
};
