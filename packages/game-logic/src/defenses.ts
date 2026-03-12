import type { ResourceBucket } from "./gameplay";

export const DEFENSE_KEYS = ["missileBattery", "laserTurret", "gaussCannon", "shieldDome"] as const;

export type DefenseKey = (typeof DEFENSE_KEYS)[number];

export type DefenseDefinition = {
	attack: number;
	baseBuildDurationSeconds: number;
	cost: ResourceBucket;
	hull: number;
	key: DefenseKey;
	name: string;
	requiredDefenseGridLevel: number;
	shield: number;
};

export const DEFAULT_DEFENSE_DEFINITIONS: Record<DefenseKey, DefenseDefinition> = {
	gaussCannon: {
		key: "gaussCannon",
		name: "Gauss Cannon",
		attack: 1_400,
		baseBuildDurationSeconds: 360,
		cost: {
			alloy: 1_600,
			crystal: 850,
			fuel: 120,
		},
		shield: 350,
		hull: 4_500,
		requiredDefenseGridLevel: 5,
	},
	laserTurret: {
		key: "laserTurret",
		name: "Laser Turret",
		attack: 350,
		baseBuildDurationSeconds: 90,
		cost: {
			alloy: 420,
			crystal: 210,
			fuel: 0,
		},
		shield: 120,
		hull: 1_100,
		requiredDefenseGridLevel: 2,
	},
	missileBattery: {
		key: "missileBattery",
		name: "Missile Battery",
		attack: 220,
		baseBuildDurationSeconds: 45,
		cost: {
			alloy: 220,
			crystal: 90,
			fuel: 0,
		},
		shield: 60,
		hull: 700,
		requiredDefenseGridLevel: 1,
	},
	shieldDome: {
		key: "shieldDome",
		name: "Shield Dome",
		attack: 0,
		baseBuildDurationSeconds: 720,
		cost: {
			alloy: 2_800,
			crystal: 2_200,
			fuel: 400,
		},
		shield: 1_000,
		hull: 8_500,
		requiredDefenseGridLevel: 7,
	},
};

export type DefenseCounts = Record<DefenseKey, number>;

export const EMPTY_DEFENSE_COUNTS: DefenseCounts = {
	gaussCannon: 0,
	laserTurret: 0,
	missileBattery: 0,
	shieldDome: 0,
};

function sanitizeCount(count: number | undefined) {
	if (!Number.isFinite(count ?? 0)) {
		return 0;
	}
	return Math.max(0, Math.floor(count ?? 0));
}

export function normalizeDefenseCounts(
	defenseCounts: Partial<DefenseCounts> | undefined,
): DefenseCounts {
	return {
		gaussCannon: sanitizeCount(defenseCounts?.gaussCannon),
		laserTurret: sanitizeCount(defenseCounts?.laserTurret),
		missileBattery: sanitizeCount(defenseCounts?.missileBattery),
		shieldDome: sanitizeCount(defenseCounts?.shieldDome),
	};
}

export function getDefenseBuildDurationSeconds(args: {
	defenseKey: DefenseKey;
	defenseGridLevel: number;
}) {
	const definition = DEFAULT_DEFENSE_DEFINITIONS[args.defenseKey];
	const level = Math.max(0, Math.floor(args.defenseGridLevel));
	const multiplier = Math.pow(0.94, Math.max(0, level - 1));
	return Math.max(1, Math.round(definition.baseBuildDurationSeconds * multiplier));
}
