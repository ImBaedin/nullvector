import { mutation, query } from "../../convex/_generated/server";
import { ConvexError, v } from "convex/values";

import {
  buildHudResources,
  colonyCoordinatesValidator,
  colonyStatusValidator,
  getBuildingQueueStatusForColony,
  getOwnedColony,
  listColonyQueueItems,
  listPlayerColonies,
  listPlayerColonyPlanets,
  queueEventsNextAt,
  resourceHudDatumValidator,
  sessionColonyValidator,
  toAddressLabel,
} from "./shared";

export const getColonyNav = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    activeColonyId: v.id("colonies"),
    title: v.string(),
    colonies: v.array(sessionColonyValidator),
  }),
  handler: async (ctx, args) => {
    const { colony, player } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const playerColonies = await listPlayerColonies({
      ctx,
      playerId: player._id,
    });
    const planetsById = await listPlayerColonyPlanets({
      colonies: playerColonies,
      ctx,
    });

    return {
      activeColonyId: colony._id,
      title: `${colony.name} Resources`,
      colonies: playerColonies.map((entry) => {
        const colonyPlanet = planetsById.get(entry.planetId);
        return {
          id: entry._id,
          name: entry.name,
          addressLabel: colonyPlanet ? toAddressLabel(colonyPlanet) : "Unknown",
        };
      }),
    };
  },
});

export const getColonyResourceStrip = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    resources: v.array(resourceHudDatumValidator),
  }),
  handler: async (ctx, args) => {
    const { colony, planet } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    return {
      resources: buildHudResources({ colony, planet }),
    };
  },
});

export const getColonyQueueSummary = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    activeColonyId: v.id("colonies"),
    nextEventAt: v.optional(v.number()),
    statuses: v.array(colonyStatusValidator),
  }),
  handler: async (ctx, args) => {
    const { colony, player } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });
    const playerColonies = await listPlayerColonies({
      ctx,
      playerId: player._id,
    });
    const colonyQueueRows = await listColonyQueueItems({
      colonyId: colony._id,
      ctx,
    });

    const statuses = await Promise.all(
      playerColonies.map(async (entry) => ({
        colonyId: entry._id,
        status: await getBuildingQueueStatusForColony({
          colonyId: entry._id,
          ctx,
        }),
      })),
    );

    return {
      activeColonyId: colony._id,
      nextEventAt: queueEventsNextAt(colonyQueueRows) ?? undefined,
      statuses,
    };
  },
});

export const getColonyCoordinates = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: colonyCoordinatesValidator,
  handler: async (ctx, args) => {
    const { colony, planet } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });
    const system = await ctx.db.get(planet.systemId);
    if (!system) {
      throw new ConvexError("System not found for colony");
    }

    const universe = await ctx.db.get(colony.universeId);
    if (!universe) {
      throw new ConvexError("Universe not found for colony");
    }

    const nowSeconds = (Date.now() - universe.orbitEpochMs) / 1_000;
    const phase =
      planet.orbitPhaseRad + planet.orbitAngularVelocityRadPerSec * nowSeconds;

    return {
      galaxyId: system.galaxyId,
      sectorId: system.sectorId,
      systemId: system._id,
      planetId: planet._id,
      focusX: system.x + Math.cos(phase) * planet.orbitRadius,
      focusY: system.y + Math.sin(phase) * planet.orbitRadius,
      addressLabel: toAddressLabel(planet),
    };
  },
});

export const renameColony = mutation({
  args: {
    colonyId: v.id("colonies"),
    name: v.string(),
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const { colony } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const trimmedName = args.name.trim().replace(/\s+/g, " ");
    if (trimmedName.length < 3) {
      throw new ConvexError("Colony name must be at least 3 characters");
    }
    if (trimmedName.length > 40) {
      throw new ConvexError("Colony name must be 40 characters or fewer");
    }

    if (trimmedName === colony.name) {
      return {
        colonyId: colony._id,
        name: colony.name,
      };
    }

    await ctx.db.patch(colony._id, {
      name: trimmedName,
    });

    return {
      colonyId: colony._id,
      name: trimmedName,
    };
  },
});
