import type { ResourceBucket, ShipKey } from "./gameplay";

export type ShipDefinition = {
	attack: number;
	baseBuildSeconds: number;
	cargoCapacity: number;
	cost: ResourceBucket;
	fuelPerDistance: number;
	hull: number;
	key: ShipKey;
	name: string;
	requiredShipyardLevel: number;
	role: "civilian" | "combat";
	shield: number;
	speed: number;
};

export type ShipCounts = Record<ShipKey, number>;

export const EMPTY_SHIP_COUNTS: ShipCounts = {
	colonyShip: 0,
	cruiser: 0,
	bomber: 0,
	interceptor: 0,
	frigate: 0,
	largeCargo: 0,
	smallCargo: 0,
};

export const DEFAULT_SHIP_DEFINITIONS: Record<ShipKey, ShipDefinition> = {
	smallCargo: {
		key: "smallCargo",
		name: "Small Cargo",
		role: "civilian",
		requiredShipyardLevel: 1,
		cargoCapacity: 5_000,
		speed: 10_000,
		attack: 35,
		shield: 40,
		hull: 400,
		baseBuildSeconds: 60,
		fuelPerDistance: 1,
		cost: {
			alloy: 2_000,
			crystal: 2_000,
			fuel: 0,
		},
	},
	largeCargo: {
		key: "largeCargo",
		name: "Large Cargo",
		role: "civilian",
		requiredShipyardLevel: 3,
		cargoCapacity: 25_000,
		speed: 7_500,
		attack: 70,
		shield: 90,
		hull: 1_250,
		baseBuildSeconds: 180,
		fuelPerDistance: 2,
		cost: {
			alloy: 6_000,
			crystal: 6_000,
			fuel: 0,
		},
	},
	colonyShip: {
		key: "colonyShip",
		name: "Colony Ship",
		role: "civilian",
		requiredShipyardLevel: 5,
		cargoCapacity: 7_500,
		speed: 2_500,
		attack: 120,
		shield: 180,
		hull: 2_200,
		baseBuildSeconds: 900,
		fuelPerDistance: 8,
		cost: {
			alloy: 10_000,
			crystal: 20_000,
			fuel: 10_000,
		},
	},
	interceptor: {
		key: "interceptor",
		name: "Interceptor",
		role: "combat",
		requiredShipyardLevel: 2,
		cargoCapacity: 250,
		speed: 15_000,
		attack: 180,
		shield: 80,
		hull: 650,
		baseBuildSeconds: 95,
		fuelPerDistance: 2,
		cost: {
			alloy: 3_000,
			crystal: 1_500,
			fuel: 500,
		},
	},
	frigate: {
		key: "frigate",
		name: "Frigate",
		role: "combat",
		requiredShipyardLevel: 4,
		cargoCapacity: 600,
		speed: 11_500,
		attack: 420,
		shield: 180,
		hull: 1_500,
		baseBuildSeconds: 180,
		fuelPerDistance: 4,
		cost: {
			alloy: 8_000,
			crystal: 4_500,
			fuel: 1_500,
		},
	},
	cruiser: {
		key: "cruiser",
		name: "Cruiser",
		role: "combat",
		requiredShipyardLevel: 6,
		cargoCapacity: 1_500,
		speed: 9_000,
		attack: 950,
		shield: 400,
		hull: 3_400,
		baseBuildSeconds: 420,
		fuelPerDistance: 8,
		cost: {
			alloy: 20_000,
			crystal: 11_000,
			fuel: 4_500,
		},
	},
	bomber: {
		key: "bomber",
		name: "Bomber",
		role: "combat",
		requiredShipyardLevel: 8,
		cargoCapacity: 900,
		speed: 6_000,
		attack: 1_450,
		shield: 520,
		hull: 5_500,
		baseBuildSeconds: 720,
		fuelPerDistance: 10,
		cost: {
			alloy: 30_000,
			crystal: 18_000,
			fuel: 9_000,
		},
	},
};

function sanitizeCount(count: number | undefined) {
	if (!Number.isFinite(count ?? 0)) {
		return 0;
	}
	return Math.max(0, Math.floor(count ?? 0));
}

export function normalizeShipCounts(shipCounts: Partial<ShipCounts> | undefined): ShipCounts {
	return {
		colonyShip: sanitizeCount(shipCounts?.colonyShip),
		cruiser: sanitizeCount(shipCounts?.cruiser),
		bomber: sanitizeCount(shipCounts?.bomber),
		interceptor: sanitizeCount(shipCounts?.interceptor),
		frigate: sanitizeCount(shipCounts?.frigate),
		largeCargo: sanitizeCount(shipCounts?.largeCargo),
		smallCargo: sanitizeCount(shipCounts?.smallCargo),
	};
}

export function getShipBuildDurationSeconds(args: { shipKey: ShipKey; shipyardLevel: number }) {
	const definition = DEFAULT_SHIP_DEFINITIONS[args.shipKey];
	const level = Math.max(0, Math.floor(args.shipyardLevel));
	const multiplier = Math.pow(0.95, Math.max(0, level - 1));
	return Math.max(1, Math.round(definition.baseBuildSeconds * multiplier));
}

export function getFleetCargoCapacity(shipCounts: Partial<ShipCounts>) {
	const normalized = normalizeShipCounts(shipCounts);
	let total = 0;

	for (const key of Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]) {
		total += DEFAULT_SHIP_DEFINITIONS[key].cargoCapacity * normalized[key];
	}

	return total;
}

export function getFleetSlowestSpeed(shipCounts: Partial<ShipCounts>) {
	const normalized = normalizeShipCounts(shipCounts);
	let minSpeed: number | null = null;

	for (const key of Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]) {
		if (normalized[key] <= 0) {
			continue;
		}

		const speed = DEFAULT_SHIP_DEFINITIONS[key].speed;
		minSpeed = minSpeed === null ? speed : Math.min(minSpeed, speed);
	}

	return minSpeed ?? 0;
}

export function getFleetFuelCostForDistance(args: {
	distance: number;
	shipCounts: Partial<ShipCounts>;
}) {
	const normalized = normalizeShipCounts(args.shipCounts);
	const distance = Math.max(0, args.distance);
	let total = 0;

	for (const key of Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]) {
		total += normalized[key] * DEFAULT_SHIP_DEFINITIONS[key].fuelPerDistance * distance;
	}

	return Math.max(0, Math.ceil(total));
}
