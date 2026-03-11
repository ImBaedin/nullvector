export const DEFENSE_KEYS = ["missileBattery", "laserTurret", "gaussCannon", "shieldDome"] as const;

export type DefenseKey = (typeof DEFENSE_KEYS)[number];

export type DefenseDefinition = {
	attack: number;
	hull: number;
	key: DefenseKey;
	name: string;
	shield: number;
};

export const DEFAULT_DEFENSE_DEFINITIONS: Record<DefenseKey, DefenseDefinition> = {
	gaussCannon: {
		key: "gaussCannon",
		name: "Gauss Cannon",
		attack: 1_400,
		shield: 350,
		hull: 4_500,
	},
	laserTurret: {
		key: "laserTurret",
		name: "Laser Turret",
		attack: 350,
		shield: 120,
		hull: 1_100,
	},
	missileBattery: {
		key: "missileBattery",
		name: "Missile Battery",
		attack: 220,
		shield: 60,
		hull: 700,
	},
	shieldDome: {
		key: "shieldDome",
		name: "Shield Dome",
		attack: 0,
		shield: 1_000,
		hull: 8_500,
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
