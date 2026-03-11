import { ConvexError, v } from "convex/values";
import { generateSciFiName } from "@nullvector/game-logic";

import { mutation } from "../../convex/_generated/server";

function galaxyAddress(galaxyIndex: number) {
	return `G${galaxyIndex}`;
}

function sectorAddress(galaxyIndex: number, sectorIndex: number) {
	return `G${galaxyIndex}:S${sectorIndex}`;
}

function systemAddress(galaxyIndex: number, sectorIndex: number, systemIndex: number) {
	return `G${galaxyIndex}:S${sectorIndex}:SYS${systemIndex}`;
}

function planetAddress(
	galaxyIndex: number,
	sectorIndex: number,
	systemIndex: number,
	planetIndex: number,
) {
	return `G${galaxyIndex}:S${sectorIndex}:SYS${systemIndex}:P${planetIndex}`;
}

function assertGenerationToken(token: string) {
	const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
	if (!configuredToken) {
		throw new ConvexError("UNIVERSE_GEN_TOKEN is not configured");
	}
	if (token !== configuredToken) {
		throw new ConvexError("Invalid token");
	}
}

export const backfillRoboticsHubLevel = mutation({
	args: {
		token: v.string(),
	},
	returns: v.object({
		scanned: v.number(),
		updated: v.number(),
	}),
	handler: async (ctx, args) => {
		assertGenerationToken(args.token);

		const rows = await ctx.db.query("colonyInfrastructure").collect();
		let updated = 0;

		for (const row of rows) {
			if (typeof row.buildings.roboticsHubLevel === "number") {
				continue;
			}
			await ctx.db.patch(row._id, {
				buildings: {
					...row.buildings,
					roboticsHubLevel: 0,
				},
				updatedAt: Date.now(),
			});
			updated += 1;
		}

		return {
			scanned: rows.length,
			updated,
		};
	},
});

export const backfillUniverseObjectNames = mutation({
	args: {
		token: v.string(),
	},
	returns: v.object({
		scanned: v.object({
			galaxies: v.number(),
			sectors: v.number(),
			systems: v.number(),
			planets: v.number(),
		}),
		updated: v.object({
			galaxies: v.number(),
			sectors: v.number(),
			systems: v.number(),
			planets: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		assertGenerationToken(args.token);

		const [galaxies, sectors, systems, planets] = await Promise.all([
			ctx.db.query("galaxies").collect(),
			ctx.db.query("sectors").collect(),
			ctx.db.query("systems").collect(),
			ctx.db.query("planets").collect(),
		]);

		let updatedGalaxies = 0;
		for (const galaxy of galaxies) {
			const nextName = generateSciFiName(galaxyAddress(galaxy.galaxyIndex));
			if (galaxy.name === nextName) {
				continue;
			}

			await ctx.db.patch(galaxy._id, {
				name: nextName,
			});
			updatedGalaxies += 1;
		}

		let updatedSectors = 0;
		for (const sector of sectors) {
			const nextName = generateSciFiName(
				sectorAddress(sector.galaxyIndex, sector.sectorIndex),
			);
			if (sector.name === nextName) {
				continue;
			}

			await ctx.db.patch(sector._id, {
				name: nextName,
			});
			updatedSectors += 1;
		}

		let updatedSystems = 0;
		for (const system of systems) {
			const nextName = generateSciFiName(
				systemAddress(system.galaxyIndex, system.sectorIndex, system.systemIndex),
			);
			if (system.name === nextName) {
				continue;
			}

			await ctx.db.patch(system._id, {
				name: nextName,
			});
			updatedSystems += 1;
		}

		let updatedPlanets = 0;
		for (const planet of planets) {
			const nextName = generateSciFiName(
				planetAddress(
					planet.galaxyIndex,
					planet.sectorIndex,
					planet.systemIndex,
					planet.planetIndex,
				),
			);
			if (planet.name === nextName) {
				continue;
			}

			await ctx.db.patch(planet._id, {
				name: nextName,
			});
			updatedPlanets += 1;
		}

		return {
			scanned: {
				galaxies: galaxies.length,
				sectors: sectors.length,
				systems: systems.length,
				planets: planets.length,
			},
			updated: {
				galaxies: updatedGalaxies,
				sectors: updatedSectors,
				systems: updatedSystems,
				planets: updatedPlanets,
			},
		};
	},
});
