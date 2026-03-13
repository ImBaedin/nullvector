import { expect, test } from "bun:test";

import {
	getDefenseBuildDurationSeconds,
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	getShipBuildDurationSeconds,
	normalizeShipCounts,
} from "../index";

test("normalizeShipCounts clamps invalid values", () => {
	const normalized = normalizeShipCounts({
		colonyShip: -3,
		largeCargo: Number.NaN,
		smallCargo: 2.9,
	});

	expect(normalized).toEqual({
		colonyShip: 0,
		cruiser: 0,
		bomber: 0,
		interceptor: 0,
		frigate: 0,
		largeCargo: 0,
		smallCargo: 2,
	});
});

test("shipyard level speeds up per-ship build duration", () => {
	const level1 = getShipBuildDurationSeconds({
		shipKey: "colonyShip",
		shipyardLevel: 1,
	});
	const level6 = getShipBuildDurationSeconds({
		shipKey: "colonyShip",
		shipyardLevel: 6,
	});

	expect(level6).toBeLessThan(level1);
});

test("defense grid level speeds up defense build duration", () => {
	const level1 = getDefenseBuildDurationSeconds({
		defenseKey: "shieldDome",
		defenseGridLevel: 1,
	});
	const level6 = getDefenseBuildDurationSeconds({
		defenseKey: "shieldDome",
		defenseGridLevel: 6,
	});

	expect(level6).toBeLessThan(level1);
});

test("fleet cargo capacity aggregates from all ship types", () => {
	const capacity = getFleetCargoCapacity({
		colonyShip: 1,
		cruiser: 0,
		bomber: 0,
		interceptor: 0,
		frigate: 0,
		largeCargo: 2,
		smallCargo: 3,
	});

	expect(capacity).toBe(7_500 + 50_000 + 15_000);
});

test("fleet speed is bounded by slowest ship in fleet", () => {
	expect(
		getFleetSlowestSpeed({
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 0,
			smallCargo: 4,
			largeCargo: 0,
		}),
	).toBe(10_000);

	expect(
		getFleetSlowestSpeed({
			colonyShip: 1,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 0,
			largeCargo: 2,
			smallCargo: 10,
		}),
	).toBe(2_500);
});

test("fleet fuel uses launch cost at zero distance", () => {
	const fuel = getFleetFuelCostForDistance({
		distance: 0,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 0,
			largeCargo: 0,
			smallCargo: 1,
		},
	});

	expect(fuel).toBe(15);
});

test("fleet fuel uses compressed sqrt distance", () => {
	const fuel = getFleetFuelCostForDistance({
		distance: 20_000,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 1,
			largeCargo: 0,
			smallCargo: 1,
		},
	});

	expect(fuel).toBe(157 + 319);
});

test("fleet fuel scales with ship composition under the soft model", () => {
	const fuel = getFleetFuelCostForDistance({
		distance: 20_000,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 2,
			largeCargo: 0,
			smallCargo: 0,
		},
	});

	expect(fuel).toBe(1_124);
});

test("fleet fuel remains monotonic with distance", () => {
	const closeFuel = getFleetFuelCostForDistance({
		distance: 100,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 2,
			largeCargo: 0,
			smallCargo: 0,
		},
	});
	const mediumFuel = getFleetFuelCostForDistance({
		distance: 2_500,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 2,
			largeCargo: 0,
			smallCargo: 0,
		},
	});
	const longFuel = getFleetFuelCostForDistance({
		distance: 20_000,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 2,
			largeCargo: 0,
			smallCargo: 0,
		},
	});

	expect(closeFuel).toBeLessThan(mediumFuel);
	expect(mediumFuel).toBeLessThan(longFuel);
});

test("fleet fuel remains monotonic with ship count", () => {
	const baseFuel = getFleetFuelCostForDistance({
		distance: 2_500,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 1,
			largeCargo: 0,
			smallCargo: 0,
		},
	});
	const additionalFuel = getFleetFuelCostForDistance({
		distance: 2_500,
		shipCounts: {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 3,
			frigate: 2,
			largeCargo: 0,
			smallCargo: 0,
		},
	});

	expect(baseFuel).toBeLessThan(additionalFuel);
});
