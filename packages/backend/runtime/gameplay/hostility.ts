import {
	generateSciFiName,
	HOSTILE_FACTION_KEYS,
	type HostileFactionKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import { resolveCurrentPlayer, resolveUniverse } from "./shared";

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function hashString(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function hostileFraction(seed: string) {
	return (hashString(seed) % 10_000) / 10_000;
}

function pickFaction(seed: string): HostileFactionKey {
	return (
		HOSTILE_FACTION_KEYS[hashString(`${seed}:faction`) % HOSTILE_FACTION_KEYS.length] ??
		"spacePirates"
	);
}

function shouldSeedHostileSector(sector: Doc<"sectors">, universeHasFrontier: boolean) {
	const eligible = universeHasFrontier ? sector.sectorType === "frontier" : true;
	return eligible && hostileFraction(`${sector.seed}:hostile`) < 0.35;
}

function controlMaxForPlanet(planetSize: number) {
	return clamp(Math.round(planetSize * 20), 1_000, 3_000);
}

const HOSTILITY_SEEDING_CLAIM_STALE_MS = 60_000;

export async function getPlanetHostility(args: {
	ctx: QueryCtx | MutationCtx;
	planetId: Id<"planets">;
}) {
	return args.ctx.db
		.query("planetHostility")
		.withIndex("by_planet_id", (q) => q.eq("planetId", args.planetId))
		.unique();
}

export async function isPlanetCurrentlyColonizable(args: {
	ctx: QueryCtx | MutationCtx;
	planetId: Id<"planets">;
}) {
	const [planetEconomy, colony, hostility] = await Promise.all([
		args.ctx.db
			.query("planetEconomy")
			.withIndex("by_planet_id", (q) => q.eq("planetId", args.planetId))
			.unique(),
		args.ctx.db
			.query("colonies")
			.withIndex("by_planet_id", (q) => q.eq("planetId", args.planetId))
			.first(),
		getPlanetHostility({
			ctx: args.ctx,
			planetId: args.planetId,
		}),
	]);

	if (!planetEconomy || colony) {
		return false;
	}
	if (!planetEconomy.isColonizable) {
		return false;
	}
	return !hostility || hostility.status === "cleared";
}

export async function ensureUniverseHostilitySeeded(args: {
	ctx: MutationCtx;
	universeId: Id<"universes">;
}) {
	const universe = await args.ctx.db.get(args.universeId);
	if (!universe) {
		throw new ConvexError("Universe not found");
	}
	if (universe.hostilitySeededAt) {
		return {
			seededPlanets: 0,
			seededSectors: 0,
		};
	}

	const now = Date.now();
	const existingClaim = universe.hostilitySeedingClaimedAt;
	if (existingClaim !== undefined && existingClaim > now - HOSTILITY_SEEDING_CLAIM_STALE_MS) {
		return {
			seededPlanets: 0,
			seededSectors: 0,
		};
	}

	await args.ctx.db.patch(universe._id, {
		hostilitySeedingClaimedAt: now,
		updatedAt: now,
	});

	const sectors = await args.ctx.db
		.query("sectors")
		.withIndex("by_universe_id_and_sector_type", (q) => q.eq("universeId", args.universeId))
		.collect();
	const frontierCount = sectors.filter((sector) => sector.sectorType === "frontier").length;
	let seededSectors = 0;
	let seededPlanets = 0;

	for (const sector of sectors) {
		const existing = await args.ctx.db
			.query("sectorHostility")
			.withIndex("by_sector_id", (q) => q.eq("sectorId", sector._id))
			.unique();
		if (existing || !shouldSeedHostileSector(sector, frontierCount > 0)) {
			continue;
		}

		const systems = await args.ctx.db
			.query("systems")
			.withIndex("by_universe_and_galaxy_and_sector_and_system", (q) =>
				q
					.eq("universeId", args.universeId)
					.eq("galaxyIndex", sector.galaxyIndex)
					.eq("sectorIndex", sector.sectorIndex),
			)
			.collect();
		const faction = pickFaction(sector.seed);
		const planets: Doc<"planets">[] = [];
		for (const system of systems) {
			const systemPlanets = await args.ctx.db
				.query("planets")
				.withIndex("by_system_id_and_planet_index", (q) => q.eq("systemId", system._id))
				.collect();
			planets.push(...systemPlanets);
		}

		if (planets.length === 0) {
			continue;
		}

		await args.ctx.db.insert("sectorHostility", {
			universeId: args.universeId,
			sectorId: sector._id,
			hostileFactionKey: faction,
			status: "hostile",
			hostilePlanetCount: planets.length,
			clearedPlanetCount: 0,
			createdAt: now,
			updatedAt: now,
		});
		seededSectors += 1;

		for (const planet of planets) {
			await args.ctx.db.insert("planetHostility", {
				universeId: args.universeId,
				sectorId: sector._id,
				planetId: planet._id,
				hostileFactionKey: faction,
				controlMax: controlMaxForPlanet(planet.planetSize),
				controlCurrent: controlMaxForPlanet(planet.planetSize),
				status: "hostile",
				createdAt: now,
				updatedAt: now,
			});
			seededPlanets += 1;
		}
	}

	await args.ctx.db.patch(universe._id, {
		hostilitySeededAt: now,
		hostilitySeedingClaimedAt: undefined,
		updatedAt: now,
	});

	return {
		seededPlanets,
		seededSectors,
	};
}

export async function applyPlanetControlReduction(args: {
	controlReduction: number;
	ctx: MutationCtx;
	now: number;
	planetId: Id<"planets">;
}) {
	const hostility = await args.ctx.db
		.query("planetHostility")
		.withIndex("by_planet_id", (q) => q.eq("planetId", args.planetId))
		.unique();
	if (!hostility || hostility.status === "cleared") {
		return { sectorCleared: false, applied: 0, planetCleared: false };
	}
	const nextControl = Math.max(
		0,
		hostility.controlCurrent - Math.max(0, Math.floor(args.controlReduction)),
	);
	const applied = hostility.controlCurrent - nextControl;
	const planetCleared = nextControl === 0;
	await args.ctx.db.patch(hostility._id, {
		controlCurrent: nextControl,
		status: planetCleared ? "cleared" : hostility.status,
		clearedAt: planetCleared ? args.now : hostility.clearedAt,
		updatedAt: args.now,
	});

	if (!planetCleared) {
		return { sectorCleared: false, applied, planetCleared };
	}

	const sectorHostility = await args.ctx.db
		.query("sectorHostility")
		.withIndex("by_sector_id", (q) => q.eq("sectorId", hostility.sectorId))
		.unique();
	if (!sectorHostility) {
		throw new ConvexError("Sector hostility row missing");
	}
	const remaining = await args.ctx.db
		.query("planetHostility")
		.withIndex("by_sector_status", (q) =>
			q.eq("sectorId", hostility.sectorId).eq("status", "hostile"),
		)
		.collect();

	const sectorCleared = remaining.length === 0;
	await args.ctx.db.patch(sectorHostility._id, {
		clearedPlanetCount: sectorHostility.hostilePlanetCount - remaining.length,
		status: sectorCleared ? "cleared" : sectorHostility.status,
		updatedAt: args.now,
	});

	return {
		sectorCleared,
		applied,
		planetCleared,
	};
}

const planetHostilityViewValidator = v.object({
	planetId: v.id("planets"),
	hostileFactionKey: v.optional(v.union(v.literal("spacePirates"), v.literal("rogueAi"))),
	controlCurrent: v.optional(v.number()),
	controlMax: v.optional(v.number()),
	isCleared: v.boolean(),
	isHostile: v.boolean(),
});

export const getPlanetHostilityView = query({
	args: {
		planetId: v.id("planets"),
	},
	returns: planetHostilityViewValidator,
	handler: async (ctx, args) => {
		const hostility = await getPlanetHostility({
			ctx,
			planetId: args.planetId,
		});
		return {
			planetId: args.planetId,
			hostileFactionKey: hostility?.hostileFactionKey,
			controlCurrent: hostility?.controlCurrent,
			controlMax: hostility?.controlMax,
			isCleared: hostility?.status === "cleared",
			isHostile: hostility?.status === "hostile",
		};
	},
});

const hostileSectorViewValidator = v.object({
	sectorId: v.id("sectors"),
	hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
	status: v.union(v.literal("hostile"), v.literal("cleared")),
	hostilePlanetCount: v.number(),
	clearedPlanetCount: v.number(),
	addressLabel: v.string(),
	displayName: v.string(),
	centerX: v.number(),
	centerY: v.number(),
	planets: v.array(
		v.object({
			planetId: v.id("planets"),
			addressLabel: v.string(),
			displayName: v.string(),
			systemDisplayName: v.string(),
			hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
			controlCurrent: v.number(),
			controlMax: v.number(),
			status: v.union(v.literal("hostile"), v.literal("cleared")),
			systemIndex: v.number(),
			systemX: v.number(),
			systemY: v.number(),
		}),
	),
});

const hostileSectorsResponseValidator = v.object({
	originX: v.number(),
	originY: v.number(),
	sectors: v.array(hostileSectorViewValidator),
});

function planetAddressLabel(p: {
	galaxyIndex: number;
	sectorIndex: number;
	systemIndex: number;
	planetIndex: number;
}) {
	return `G${p.galaxyIndex}:S${p.sectorIndex}:SYS${p.systemIndex}:P${p.planetIndex}`;
}

function sectorAddressLabel(sector: Pick<Doc<"sectors">, "galaxyIndex" | "sectorIndex">) {
	return `G${sector.galaxyIndex}:S${sector.sectorIndex}`;
}

function displayNameFromStoredOrGenerated(addressLabel: string, storedName?: string) {
	const trimmed = storedName?.trim();
	if (trimmed && trimmed.length > 0) {
		return trimmed;
	}
	return generateSciFiName(addressLabel);
}

async function getDocsByIds<TableName extends keyof HostilityDocMap>(args: {
	ctx: MutationCtx | QueryCtx;
	ids: Id<TableName>[];
}): Promise<Map<Id<TableName>, HostilityDocMap[TableName]>> {
	const docs = await Promise.all(args.ids.map((id) => args.ctx.db.get(id)));
	const map = new Map<Id<TableName>, HostilityDocMap[TableName]>();
	for (const doc of docs) {
		if (doc) {
			map.set(doc._id, doc as HostilityDocMap[TableName]);
		}
	}
	return map;
}

type HostilityDocMap = {
	colonies: Doc<"colonies">;
	planets: Doc<"planets">;
	sectors: Doc<"sectors">;
	systems: Doc<"systems">;
};

export const getHostileSectorsForUniverse = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: hostileSectorsResponseValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const colony = await ctx.db.get(args.colonyId);
		if (!colony || colony.playerId !== playerResult.player._id) {
			throw new ConvexError("Colony not found");
		}

		const planet = await ctx.db.get(colony.planetId);
		const system = planet ? await ctx.db.get(planet.systemId) : null;
		const originX = system?.x ?? 0;
		const originY = system?.y ?? 0;

		const sectorHostilities = await ctx.db
			.query("sectorHostility")
			.withIndex("by_universe_status", (q) => q.eq("universeId", colony.universeId))
			.collect();
		const sectorById = await getDocsByIds({
			ctx,
			ids: sectorHostilities.map((sector) => sector.sectorId),
		});
		const planetHostilityGroups = await Promise.all(
			sectorHostilities.map((sector) =>
				ctx.db
					.query("planetHostility")
					.withIndex("by_sector_status", (q) => q.eq("sectorId", sector.sectorId))
					.collect(),
			),
		);
		const allPlanetHostilities = planetHostilityGroups.flat();
		const planetById = await getDocsByIds({
			ctx,
			ids: allPlanetHostilities.map((planetHostility) => planetHostility.planetId),
		});
		const systemById = await getDocsByIds({
			ctx,
			ids: Array.from(new Set(Array.from(planetById.values()).map((planet) => planet.systemId))),
		});
		const planetHostilitiesBySectorId = new Map<
			Id<"sectors">,
			Array<(typeof allPlanetHostilities)[number]>
		>();
		for (const planetHostility of allPlanetHostilities) {
			const existing = planetHostilitiesBySectorId.get(planetHostility.sectorId) ?? [];
			existing.push(planetHostility);
			planetHostilitiesBySectorId.set(planetHostility.sectorId, existing);
		}

		const sectors: Array<typeof hostileSectorViewValidator.type> = [];

		for (const sh of sectorHostilities) {
			const sector = sectorById.get(sh.sectorId);
			if (!sector) continue;

			const planetViews = (planetHostilitiesBySectorId.get(sh.sectorId) ?? [])
				.map((planetHostility) => {
					const planet = planetById.get(planetHostility.planetId);
					const systemForPlanet = planet ? systemById.get(planet.systemId) : null;
					if (!planet || !systemForPlanet) {
						return null;
					}
					return {
						planetId: planetHostility.planetId,
						addressLabel: planetAddressLabel(planet),
						displayName: displayNameFromStoredOrGenerated(planetAddressLabel(planet), planet.name),
						systemDisplayName: displayNameFromStoredOrGenerated(
							`G${planet.galaxyIndex}:S${planet.sectorIndex}:SYS${planet.systemIndex}`,
							systemForPlanet.name,
						),
						hostileFactionKey: planetHostility.hostileFactionKey,
						controlCurrent: planetHostility.controlCurrent,
						controlMax: planetHostility.controlMax,
						status: planetHostility.status as "hostile" | "cleared",
						systemIndex: planet.systemIndex,
						systemX: systemForPlanet.x,
						systemY: systemForPlanet.y,
					};
				})
				.filter((planetView): planetView is NonNullable<typeof planetView> => planetView !== null);

			const cx = (sector.minX + sector.maxX) / 2;
			const cy = (sector.minY + sector.maxY) / 2;

			sectors.push({
				sectorId: sh.sectorId,
				hostileFactionKey: sh.hostileFactionKey,
				status: sh.status as "hostile" | "cleared",
				hostilePlanetCount: sh.hostilePlanetCount,
				clearedPlanetCount: sh.clearedPlanetCount,
				addressLabel: sectorAddressLabel(sector),
				displayName: displayNameFromStoredOrGenerated(sectorAddressLabel(sector), sector.name),
				centerX: cx,
				centerY: cy,
				planets: planetViews,
			});
		}

		return { originX, originY, sectors };
	},
});

export const backfillUniverseHostility = mutation({
	args: {
		token: v.string(),
		universeSlug: v.optional(v.string()),
	},
	returns: v.object({
		seededPlanets: v.number(),
		seededSectors: v.number(),
		universeId: v.id("universes"),
	}),
	handler: async (ctx, args) => {
		const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
		if (!configuredToken) {
			throw new ConvexError("UNIVERSE_GEN_TOKEN is not configured");
		}
		if (args.token !== configuredToken) {
			throw new ConvexError("Invalid token");
		}
		const universe = await resolveUniverse(ctx);
		if (!universe) {
			throw new ConvexError("Universe not found");
		}
		const seeded = await ensureUniverseHostilitySeeded({
			ctx,
			universeId: universe._id,
		});
		return {
			...seeded,
			universeId: universe._id,
		};
	},
});
