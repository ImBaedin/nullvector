import { describe, expect, it } from "vitest";

import {
	buildHostilePlanetDetailView,
	buildHostileSectorSummaryView,
	compareHostilePlanetDetails,
} from "../../../../runtime/gameplay/hostility";

describe("hostility browser helpers", () => {
	it("sorts hostile planets before cleared planets", () => {
		const hostilePlanet = {
			status: "hostile" as const,
			controlCurrent: 400,
			controlMax: 1_000,
		};
		const clearedPlanet = {
			status: "cleared" as const,
			controlCurrent: 50,
			controlMax: 1_000,
		};

		expect(
			compareHostilePlanetDetails(
				{
					planetId: "planet_hostile" as never,
					addressLabel: "G0:S0:SYS0:P0",
					displayName: "Hostile",
					systemDisplayName: "System",
					hostileFactionKey: "spacePirates",
					systemIndex: 0,
					systemX: 0,
					systemY: 0,
					...hostilePlanet,
				},
				{
					planetId: "planet_cleared" as never,
					addressLabel: "G0:S0:SYS0:P1",
					displayName: "Cleared",
					systemDisplayName: "System",
					hostileFactionKey: "spacePirates",
					systemIndex: 0,
					systemX: 0,
					systemY: 0,
					...clearedPlanet,
				},
			),
		).toBeLessThan(0);
	});

	it("sorts equal-status planets by lower control percentage first", () => {
		expect(
			compareHostilePlanetDetails(
				{
					planetId: "planet_low" as never,
					addressLabel: "G0:S0:SYS0:P0",
					displayName: "Low",
					systemDisplayName: "System",
					hostileFactionKey: "spacePirates",
					controlCurrent: 200,
					controlMax: 1_000,
					status: "hostile",
					systemIndex: 0,
					systemX: 0,
					systemY: 0,
				},
				{
					planetId: "planet_high" as never,
					addressLabel: "G0:S0:SYS0:P1",
					displayName: "High",
					systemDisplayName: "System",
					hostileFactionKey: "spacePirates",
					controlCurrent: 600,
					controlMax: 1_000,
					status: "hostile",
					systemIndex: 0,
					systemX: 0,
					systemY: 0,
				},
			),
		).toBeLessThan(0);
	});

	it("builds sector summaries without planet detail", () => {
		expect(
			buildHostileSectorSummaryView({
				sector: {
					_id: "sector_1",
					_creationTime: 0,
					universeId: "universe_1",
					galaxyId: "galaxy_1",
					galaxyIndex: 2,
					sectorIndex: 4,
					sectorType: "core",
					minX: 10,
					maxX: 30,
					minY: 100,
					maxY: 160,
					seed: "seed",
					name: "Needle Reach",
					createdAt: 0,
				} as never,
				sectorHostility: {
					_id: "sector_hostility_1",
					_creationTime: 0,
					universeId: "universe_1",
					sectorId: "sector_1",
					hostileFactionKey: "rogueAi",
					status: "cleared",
					hostilePlanetCount: 6,
					clearedPlanetCount: 6,
					createdAt: 0,
					updatedAt: 0,
				} as never,
			}),
		).toEqual({
			sectorId: "sector_1",
			hostileFactionKey: "rogueAi",
			status: "cleared",
			hostilePlanetCount: 6,
			clearedPlanetCount: 6,
			addressLabel: "G2:S4",
			displayName: "Needle Reach",
			centerX: 20,
			centerY: 130,
		});
	});

	it("builds planet detail rows with stored names and system coords", () => {
		expect(
			buildHostilePlanetDetailView({
				planet: {
					_id: "planet_1",
					_creationTime: 0,
					universeId: "universe_1",
					sectorId: "sector_1",
					systemId: "system_1",
					galaxyIndex: 2,
					sectorIndex: 4,
					systemIndex: 1,
					planetIndex: 3,
					name: "Khepri",
					orbitRadius: 0,
					orbitPhaseRad: 0,
					orbitAngularVelocityRadPerSec: 0,
					orbitalDistance: 0,
					planetSize: 100,
					seed: "planet_seed",
					createdAt: 0,
				} as never,
				planetHostility: {
					_id: "planet_hostility_1",
					_creationTime: 0,
					universeId: "universe_1",
					sectorId: "sector_1",
					planetId: "planet_1",
					hostileFactionKey: "spacePirates",
					controlMax: 2_000,
					controlCurrent: 750,
					status: "hostile",
					createdAt: 0,
					updatedAt: 0,
				} as never,
				system: {
					_id: "system_1",
					_creationTime: 0,
					universeId: "universe_1",
					sectorId: "sector_1",
					galaxyId: "galaxy_1",
					galaxyIndex: 2,
					sectorIndex: 4,
					systemIndex: 1,
					starKind: "yellowDwarf",
					x: 444,
					y: 555,
					seed: "system_seed",
					name: "Aster",
					createdAt: 0,
				} as never,
			}),
		).toEqual({
			planetId: "planet_1",
			addressLabel: "G2:S4:SYS1:P3",
			displayName: "Khepri",
			systemDisplayName: "Aster",
			hostileFactionKey: "spacePirates",
			controlCurrent: 750,
			controlMax: 2_000,
			status: "hostile",
			systemIndex: 1,
			systemX: 444,
			systemY: 555,
		});
	});
});
