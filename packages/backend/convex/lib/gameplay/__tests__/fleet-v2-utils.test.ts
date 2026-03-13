import { getFleetFuelCostForDistance } from "@nullvector/game-logic";
import { describe, expect, it } from "vitest";

import {
	durationMsForFleet,
	euclideanDistance,
	normalizeMissionCargo,
} from "../../../../runtime/gameplay/fleetV2";

describe("fleet V2 utility helpers", () => {
	it("normalizes cargo to non-negative whole units", () => {
		expect(
			normalizeMissionCargo({
				alloy: 12.7,
				crystal: -5,
				fuel: Number.NaN,
			}),
		).toEqual({
			alloy: 12,
			crystal: 0,
			fuel: 0,
		});
	});

	it("enforces minimum euclidean distance of 1", () => {
		expect(
			euclideanDistance({
				x1: 5,
				y1: 5,
				x2: 5,
				y2: 5,
			}),
		).toBe(1);
	});

	it("applies a minimum travel duration floor", () => {
		const duration = durationMsForFleet({
			distance: 1,
			shipCounts: {
				smallCargo: 1,
				largeCargo: 0,
				colonyShip: 0,
				interceptor: 0,
				frigate: 0,
				cruiser: 0,
				bomber: 0,
			},
		});

		expect(duration).toBeGreaterThanOrEqual(30_000);
	});

	it("computes softened one-way fuel using the shared sqrt distance model", () => {
		const fuel = getFleetFuelCostForDistance({
			distance: 20_000,
			shipCounts: {
				smallCargo: 0,
				largeCargo: 0,
				colonyShip: 0,
				interceptor: 3,
				frigate: 2,
				cruiser: 0,
				bomber: 0,
			},
		});

		expect(fuel).toBe(1_124);
	});

	it("round-trip transport fuel remains exactly double one-way fuel", () => {
		const oneWayFuel = getFleetFuelCostForDistance({
			distance: 20_000,
			shipCounts: {
				smallCargo: 1,
				largeCargo: 0,
				colonyShip: 0,
				interceptor: 0,
				frigate: 0,
				cruiser: 0,
				bomber: 0,
			},
		});

		expect(oneWayFuel).toBe(157);
		expect(oneWayFuel * 2).toBe(314);
	});

	it("partial return fuel also uses the softened sqrt distance model", () => {
		const returnFuel = getFleetFuelCostForDistance({
			distance: 5_000,
			shipCounts: {
				smallCargo: 0,
				largeCargo: 0,
				colonyShip: 0,
				interceptor: 0,
				frigate: 1,
				cruiser: 0,
				bomber: 0,
			},
		});

		expect(returnFuel).toBe(177);
	});
});
