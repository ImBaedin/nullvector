import { ConvexError, v } from "convex/values";

import { query, type QueryCtx } from "./_generated/server";

const DEFAULT_UNIVERSE_SLUG = "main";

const universeSummaryValidator = v.object({
  id: v.id("universes"),
  slug: v.string(),
  name: v.string(),
});

const galaxySummaryValidator = v.object({
  id: v.id("galaxies"),
  galaxyIndex: v.number(),
  name: v.string(),
  gx: v.number(),
  gy: v.number(),
  addressLabel: v.string(),
  displayName: v.string(),
});

const sectorSummaryValidator = v.object({
  id: v.id("sectors"),
  sectorIndex: v.number(),
  sectorType: v.union(v.literal("core"), v.literal("frontier")),
  minX: v.number(),
  maxX: v.number(),
  minY: v.number(),
  maxY: v.number(),
  centerX: v.number(),
  centerY: v.number(),
  addressLabel: v.string(),
  displayName: v.string(),
});

const systemSummaryValidator = v.object({
  id: v.id("systems"),
  systemIndex: v.number(),
  x: v.number(),
  y: v.number(),
  addressLabel: v.string(),
  displayName: v.string(),
});

const planetSummaryValidator = v.object({
  id: v.id("planets"),
  planetIndex: v.number(),
  orbitRadius: v.number(),
  orbitPhaseRad: v.number(),
  orbitAngularVelocityRadPerSec: v.number(),
  orbitX: v.number(),
  orbitY: v.number(),
  isColonizable: v.boolean(),
  addressLabel: v.string(),
  displayName: v.string(),
});

const universeWithOrbitValidator = v.object({
  id: v.id("universes"),
  slug: v.string(),
  name: v.string(),
  orbitEpochMs: v.number(),
});

function formatGalaxyName(galaxyIndex: number, storedName: string) {
  const trimmed = storedName.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return `Galaxy ${galaxyIndex + 1}`;
}

function formatSectorName(sectorIndex: number) {
  return `Sector ${sectorIndex + 1}`;
}

function formatSystemName(systemIndex: number) {
  return `System ${systemIndex + 1}`;
}

function formatPlanetName(planetIndex: number) {
  return `Planet ${planetIndex + 1}`;
}

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
  planetIndex: number
) {
  return `G${galaxyIndex}:S${sectorIndex}:SYS${systemIndex}:P${planetIndex}`;
}

async function resolveUniverse(
  ctx: QueryCtx,
  universeSlug?: string
) {
  if (universeSlug) {
    const bySlug = await ctx.db
      .query("universes")
      .withIndex("by_slug", (q) => q.eq("slug", universeSlug))
      .unique();

    if (!bySlug) {
      throw new ConvexError(`Universe '${universeSlug}' not found`);
    }

    return bySlug;
  }

  const active = await ctx.db
    .query("universes")
    .withIndex("by_is_active", (q) => q.eq("isActive", true))
    .unique();

  if (active) {
    return active;
  }

  const fallback = await ctx.db
    .query("universes")
    .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_UNIVERSE_SLUG))
    .unique();

  if (!fallback) {
    throw new ConvexError("No active or default universe found");
  }

  return fallback;
}

export const getUniverseExplorerOverview = query({
  args: {
    universeSlug: v.optional(v.string()),
  },
  returns: v.object({
    universe: universeWithOrbitValidator,
    galaxies: v.array(galaxySummaryValidator),
  }),
  handler: async (ctx, args) => {
    const universe = await resolveUniverse(ctx, args.universeSlug);

    const galaxies = await ctx.db
      .query("galaxies")
      .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
      .collect();

    const orderedGalaxies = galaxies
      .slice()
      .sort((a, b) => a.galaxyIndex - b.galaxyIndex)
      .map((galaxy) => ({
        id: galaxy._id,
        galaxyIndex: galaxy.galaxyIndex,
        name: galaxy.name,
        gx: galaxy.gx,
        gy: galaxy.gy,
        addressLabel: galaxyAddress(galaxy.galaxyIndex),
        displayName: formatGalaxyName(galaxy.galaxyIndex, galaxy.name),
      }));

    return {
      universe: {
        id: universe._id,
        slug: universe.slug,
        name: universe.name,
        orbitEpochMs: universe.orbitEpochMs,
      },
      galaxies: orderedGalaxies,
    };
  },
});

export const getGalaxySectors = query({
  args: {
    galaxyId: v.id("galaxies"),
  },
  returns: v.object({
    universe: universeSummaryValidator,
    galaxy: galaxySummaryValidator,
    sectors: v.array(sectorSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const galaxy = await ctx.db.get(args.galaxyId);
    if (!galaxy) {
      throw new ConvexError("Galaxy not found");
    }

    const universe = await ctx.db.get(galaxy.universeId);
    if (!universe) {
      throw new ConvexError("Universe not found for galaxy");
    }

    const sectors = await ctx.db
      .query("sectors")
      .withIndex("by_universe_id_and_galaxy_index_and_sector_index", (q) =>
        q.eq("universeId", galaxy.universeId).eq("galaxyIndex", galaxy.galaxyIndex)
      )
      .collect();

    const orderedSectors = sectors
      .filter((sector) => sector.galaxyId === galaxy._id)
      .sort((a, b) => a.sectorIndex - b.sectorIndex)
      .map((sector) => {
        const centerX = (sector.minX + sector.maxX) / 2;
        const centerY = (sector.minY + sector.maxY) / 2;

        return {
          id: sector._id,
          sectorIndex: sector.sectorIndex,
          sectorType: sector.sectorType,
          minX: sector.minX,
          maxX: sector.maxX,
          minY: sector.minY,
          maxY: sector.maxY,
          centerX,
          centerY,
          addressLabel: sectorAddress(galaxy.galaxyIndex, sector.sectorIndex),
          displayName: formatSectorName(sector.sectorIndex),
        };
      });

    return {
      universe: {
        id: universe._id,
        slug: universe.slug,
        name: universe.name,
      },
      galaxy: {
        id: galaxy._id,
        galaxyIndex: galaxy.galaxyIndex,
        name: galaxy.name,
        gx: galaxy.gx,
        gy: galaxy.gy,
        addressLabel: galaxyAddress(galaxy.galaxyIndex),
        displayName: formatGalaxyName(galaxy.galaxyIndex, galaxy.name),
      },
      sectors: orderedSectors,
    };
  },
});

export const getSectorSystems = query({
  args: {
    sectorId: v.id("sectors"),
  },
  returns: v.object({
    universe: universeSummaryValidator,
    galaxy: galaxySummaryValidator,
    sector: v.object({
      id: v.id("sectors"),
      sectorIndex: v.number(),
      sectorType: v.union(v.literal("core"), v.literal("frontier")),
      centerX: v.number(),
      centerY: v.number(),
      addressLabel: v.string(),
      displayName: v.string(),
    }),
    systems: v.array(systemSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const sector = await ctx.db.get(args.sectorId);
    if (!sector) {
      throw new ConvexError("Sector not found");
    }

    const [galaxy, universe] = await Promise.all([
      ctx.db.get(sector.galaxyId),
      ctx.db.get(sector.universeId),
    ]);

    if (!galaxy) {
      throw new ConvexError("Galaxy not found for sector");
    }

    if (!universe) {
      throw new ConvexError("Universe not found for sector");
    }

    const systems = await ctx.db
      .query("systems")
      .withIndex("by_sector_id_and_system_index", (q) => q.eq("sectorId", sector._id))
      .collect();

    const orderedSystems = systems
      .slice()
      .sort((a, b) => a.systemIndex - b.systemIndex)
      .map((system) => ({
        id: system._id,
        systemIndex: system.systemIndex,
        x: system.x,
        y: system.y,
        addressLabel: systemAddress(
          galaxy.galaxyIndex,
          sector.sectorIndex,
          system.systemIndex
        ),
        displayName: formatSystemName(system.systemIndex),
      }));

    return {
      universe: {
        id: universe._id,
        slug: universe.slug,
        name: universe.name,
      },
      galaxy: {
        id: galaxy._id,
        galaxyIndex: galaxy.galaxyIndex,
        name: galaxy.name,
        gx: galaxy.gx,
        gy: galaxy.gy,
        addressLabel: galaxyAddress(galaxy.galaxyIndex),
        displayName: formatGalaxyName(galaxy.galaxyIndex, galaxy.name),
      },
      sector: {
        id: sector._id,
        sectorIndex: sector.sectorIndex,
        sectorType: sector.sectorType,
        centerX: (sector.minX + sector.maxX) / 2,
        centerY: (sector.minY + sector.maxY) / 2,
        addressLabel: sectorAddress(galaxy.galaxyIndex, sector.sectorIndex),
        displayName: formatSectorName(sector.sectorIndex),
      },
      systems: orderedSystems,
    };
  },
});

export const getSystemPlanets = query({
  args: {
    systemId: v.id("systems"),
  },
  returns: v.object({
    universe: universeWithOrbitValidator,
    galaxy: galaxySummaryValidator,
    sector: v.object({
      id: v.id("sectors"),
      sectorIndex: v.number(),
      sectorType: v.union(v.literal("core"), v.literal("frontier")),
      addressLabel: v.string(),
      displayName: v.string(),
    }),
    system: systemSummaryValidator,
    planets: v.array(planetSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const system = await ctx.db.get(args.systemId);
    if (!system) {
      throw new ConvexError("System not found");
    }

    const [sector, galaxy, universe] = await Promise.all([
      ctx.db.get(system.sectorId),
      ctx.db.get(system.galaxyId),
      ctx.db.get(system.universeId),
    ]);

    if (!sector) {
      throw new ConvexError("Sector not found for system");
    }

    if (!galaxy) {
      throw new ConvexError("Galaxy not found for system");
    }

    if (!universe) {
      throw new ConvexError("Universe not found for system");
    }

    const planets = await ctx.db
      .query("planets")
      .withIndex("by_system_id_and_planet_index", (q) => q.eq("systemId", system._id))
      .collect();

    const orderedPlanets = planets
      .slice()
      .sort((a, b) => a.planetIndex - b.planetIndex)
      .map((planet) => ({
        id: planet._id,
        planetIndex: planet.planetIndex,
        orbitRadius: planet.orbitRadius,
        orbitPhaseRad: planet.orbitPhaseRad,
        orbitAngularVelocityRadPerSec: planet.orbitAngularVelocityRadPerSec,
        orbitX: Math.cos(planet.orbitPhaseRad) * planet.orbitRadius,
        orbitY: Math.sin(planet.orbitPhaseRad) * planet.orbitRadius,
        isColonizable: planet.isColonizable,
        addressLabel: planetAddress(
          galaxy.galaxyIndex,
          sector.sectorIndex,
          system.systemIndex,
          planet.planetIndex
        ),
        displayName: formatPlanetName(planet.planetIndex),
      }));

    return {
      universe: {
        id: universe._id,
        slug: universe.slug,
        name: universe.name,
        orbitEpochMs: universe.orbitEpochMs,
      },
      galaxy: {
        id: galaxy._id,
        galaxyIndex: galaxy.galaxyIndex,
        name: galaxy.name,
        gx: galaxy.gx,
        gy: galaxy.gy,
        addressLabel: galaxyAddress(galaxy.galaxyIndex),
        displayName: formatGalaxyName(galaxy.galaxyIndex, galaxy.name),
      },
      sector: {
        id: sector._id,
        sectorIndex: sector.sectorIndex,
        sectorType: sector.sectorType,
        addressLabel: sectorAddress(galaxy.galaxyIndex, sector.sectorIndex),
        displayName: formatSectorName(sector.sectorIndex),
      },
      system: {
        id: system._id,
        systemIndex: system.systemIndex,
        x: system.x,
        y: system.y,
        addressLabel: systemAddress(
          galaxy.galaxyIndex,
          sector.sectorIndex,
          system.systemIndex
        ),
        displayName: formatSystemName(system.systemIndex),
      },
      planets: orderedPlanets,
    };
  },
});
