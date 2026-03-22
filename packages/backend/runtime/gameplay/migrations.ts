import { generateSciFiName } from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

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
			if (
				typeof row.buildings.roboticsHubLevel === "number" &&
				typeof row.buildings.defenseGridLevel === "number"
			) {
				continue;
			}
			await ctx.db.patch(row._id, {
				buildings: {
					...row.buildings,
					roboticsHubLevel: 0,
					defenseGridLevel: row.buildings.defenseGridLevel ?? 0,
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
			const nextName = generateSciFiName(sectorAddress(sector.galaxyIndex, sector.sectorIndex));
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

export const backfillColonyAccessAndScheduling = mutation({
	args: {
		token: v.string(),
	},
	returns: v.object({
		scanned: v.number(),
		inserted: v.object({
			access: v.number(),
			queueScheduling: v.number(),
			raidScheduling: v.number(),
		}),
		cleanedColonies: v.number(),
	}),
	handler: async (ctx, args) => {
		assertGenerationToken(args.token);

		const colonies = await ctx.db.query("colonies").collect();
		let insertedAccess = 0;
		let insertedQueueScheduling = 0;
		let insertedRaidScheduling = 0;
		let cleanedColonies = 0;

		for (const colony of colonies) {
			const legacyColony = colony as typeof colony & {
				queueResolutionJobId?: Id<"_scheduled_functions">;
				queueResolutionScheduledAt?: number;
				nextNpcRaidAt?: number;
			};
			const existingAccess = await ctx.db
				.query("colonyAccess")
				.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
				.unique();
			if (!existingAccess) {
				await ctx.db.insert("colonyAccess", {
					colonyId: colony._id,
					playerId: colony.playerId,
					createdAt: colony.createdAt,
					updatedAt: colony.updatedAt,
				});
				insertedAccess += 1;
			}

			const existingScheduling = await ctx.db
				.query("colonyScheduling")
				.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
				.unique();
			if (!existingScheduling) {
				await ctx.db.insert("colonyScheduling", {
					colonyId: colony._id,
					queueResolutionJobId: legacyColony.queueResolutionJobId,
					queueResolutionScheduledAt: legacyColony.queueResolutionScheduledAt,
					createdAt: colony.createdAt,
					updatedAt: colony.updatedAt,
				});
				insertedQueueScheduling += 1;
			} else if (
				(legacyColony.queueResolutionJobId !== undefined &&
					existingScheduling.queueResolutionJobId === undefined) ||
				(legacyColony.queueResolutionScheduledAt !== undefined &&
					existingScheduling.queueResolutionScheduledAt === undefined)
			) {
				await ctx.db.patch(existingScheduling._id, {
					queueResolutionJobId:
						existingScheduling.queueResolutionJobId ?? legacyColony.queueResolutionJobId,
					queueResolutionScheduledAt:
						existingScheduling.queueResolutionScheduledAt ??
						legacyColony.queueResolutionScheduledAt,
					updatedAt: colony.updatedAt,
				});
			}

			const existingRaidScheduling = await ctx.db
				.query("colonyRaidScheduling")
				.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
				.unique();
			if (!existingRaidScheduling) {
				await ctx.db.insert("colonyRaidScheduling", {
					colonyId: colony._id,
					nextNpcRaidAt: legacyColony.nextNpcRaidAt,
					createdAt: colony.createdAt,
					updatedAt: colony.updatedAt,
				});
				insertedRaidScheduling += 1;
			} else if (
				legacyColony.nextNpcRaidAt !== undefined &&
				existingRaidScheduling.nextNpcRaidAt === undefined
			) {
				await ctx.db.patch(existingRaidScheduling._id, {
					nextNpcRaidAt: legacyColony.nextNpcRaidAt,
					updatedAt: colony.updatedAt,
				});
			}

			if (
				legacyColony.queueResolutionJobId !== undefined ||
				legacyColony.queueResolutionScheduledAt !== undefined ||
				legacyColony.nextNpcRaidAt !== undefined
			) {
				const {
					queueResolutionJobId: _queueResolutionJobId,
					queueResolutionScheduledAt: _queueResolutionScheduledAt,
					nextNpcRaidAt: _nextNpcRaidAt,
					...cleanColony
				} = legacyColony;
				await ctx.db.replace(colony._id, cleanColony);
				cleanedColonies += 1;
			}
		}

		return {
			scanned: colonies.length,
			inserted: {
				access: insertedAccess,
				queueScheduling: insertedQueueScheduling,
				raidScheduling: insertedRaidScheduling,
			},
			cleanedColonies,
		};
	},
});
