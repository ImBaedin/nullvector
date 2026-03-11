import { expect, test } from "bun:test";

import {
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

test("fuel cost scales with distance and ship composition", () => {
	const fuel = getFleetFuelCostForDistance({
		distance: 100,
		shipCounts: {
			colonyShip: 1,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 0,
			largeCargo: 2,
			smallCargo: 4,
		},
	});

	expect(fuel).toBe(100 * (1 * 8 + 2 * 2 + 4 * 1));
});
