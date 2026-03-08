import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { DEFAULT_UNIVERSE_SLUG } from "./lib/worldgen/config";
import { ensureCoreCapacityPipeline } from "./lib/worldgen/pipeline";

const ensureCoreCapacityArgsValidator = {
  token: v.string(),
  universeSlug: v.optional(v.string()),
  minCoreSectors: v.optional(v.number()),
  minUnclaimedColonizablePlanets: v.optional(v.number()),
  maxSectorsPerRun: v.optional(v.number()),
  dryRun: v.optional(v.boolean()),
};

const ensureCoreCapacityResultValidator = v.object({
  universeId: v.id("universes"),
  universeSlug: v.string(),
  created: v.object({
    galaxies: v.number(),
    sectors: v.number(),
    systems: v.number(),
    planets: v.number(),
  }),
  capacityBefore: v.object({
    coreSectors: v.number(),
    unclaimedColonizable: v.number(),
  }),
  capacityAfter: v.object({
    coreSectors: v.number(),
    unclaimedColonizable: v.number(),
  }),
  targetsApplied: v.object({
    minCoreSectors: v.number(),
    minUnclaimedColonizablePlanets: v.number(),
    maxSectorsPerRun: v.number(),
  }),
  needsMore: v.boolean(),
  dryRun: v.boolean(),
});

const wipeUniverseArgsValidator = {
  token: v.string(),
  universeSlug: v.optional(v.string()),
  dryRun: v.optional(v.boolean()),
};

const wipeUniverseResultValidator = v.object({
  universeId: v.id("universes"),
  universeSlug: v.string(),
  deleted: v.object({
    universeGeneration: v.number(),
    fleetOperations: v.number(),
    fleetOperationResults: v.number(),
    fleets: v.number(),
    fleetEvents: v.number(),
    colonyShips: v.number(),
    colonyQueueItems: v.number(),
    colonyQueuePayloads: v.number(),
    colonyEconomy: v.number(),
    colonyInfrastructure: v.number(),
    colonyPolicy: v.number(),
    colonies: v.number(),
    planetEconomy: v.number(),
    planets: v.number(),
    systems: v.number(),
    sectors: v.number(),
    galaxies: v.number(),
    universe: v.number(),
  }),
  dryRun: v.boolean(),
});

function assertGenerationToken(token: string) {
  const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
  if (!configuredToken) {
    throw new ConvexError(
      "UNIVERSE_GEN_TOKEN is not configured on this Convex deployment"
    );
  }

  if (token !== configuredToken) {
    throw new ConvexError("Invalid generation token");
  }
}

async function resolveUniverse(
  ctx: MutationCtx,
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

async function deleteAllByQuery(args: {
  queryFactory: () => Promise<Array<{ _id: Id<any> }>>;
  ctx: MutationCtx;
  dryRun: boolean;
}) {
  const { queryFactory, ctx, dryRun } = args;
  const docs = await queryFactory();
  let deleted = 0;

  for (const doc of docs) {
    if (!dryRun) {
      await ctx.db.delete(doc._id);
    }
    deleted += 1;
  }

  return deleted;
}

export const ensureCoreCapacity = mutation({
  args: ensureCoreCapacityArgsValidator,
  returns: ensureCoreCapacityResultValidator,
  handler: async (ctx, args) => {
    assertGenerationToken(args.token);

    try {
      return await ensureCoreCapacityPipeline(ctx, {
        universeSlug: args.universeSlug,
        dryRun: args.dryRun ?? false,
        overrides: {
          minCoreSectors: args.minCoreSectors,
          minUnclaimedColonizablePlanets: args.minUnclaimedColonizablePlanets,
          maxSectorsPerRun: args.maxSectorsPerRun,
        },
      });
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "Universe generation failed";
      throw new ConvexError(message);
    }
  },
});

export const wipeUniverse = mutation({
  args: wipeUniverseArgsValidator,
  returns: wipeUniverseResultValidator,
  handler: async (ctx, args) => {
    assertGenerationToken(args.token);

    const universe = await resolveUniverse(ctx, args.universeSlug);
    const dryRun = args.dryRun ?? false;
    const coloniesInUniverse = await ctx.db
      .query("colonies")
      .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
      .collect();
    const colonyIdSet = new Set(coloniesInUniverse.map((row) => row._id));

    const deleted = {
      universeGeneration: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("universeGeneration")
            .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
            .collect(),
      }),
      fleetOperations: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("fleetOperations")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      fleetOperationResults: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("fleetOperationResults")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      fleets: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("fleets")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      fleetEvents: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("fleetEvents")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      colonyShips: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyShips")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      colonyQueueItems: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyQueueItems")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      colonyQueuePayloads: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyQueuePayloads")
            .collect()
            .then((rows) =>
              rows.filter((row) => row.universeId === universe._id)
            ),
      }),
      colonyEconomy: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyEconomy")
            .collect()
            .then((rows) =>
              rows.filter((row) => colonyIdSet.has(row.colonyId))
            ),
      }),
      colonyInfrastructure: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyInfrastructure")
            .collect()
            .then((rows) =>
              rows.filter((row) => colonyIdSet.has(row.colonyId))
            ),
      }),
      colonyPolicy: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("colonyPolicy")
            .collect()
            .then((rows) =>
              rows.filter((row) => colonyIdSet.has(row.colonyId))
            ),
      }),
      colonies: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: async () => coloniesInUniverse,
      }),
      planetEconomy: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("planetEconomy")
            .withIndex("by_uni_colon", (q) =>
              q.eq("universeId", universe._id)
            )
            .collect(),
      }),
      planets: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("planets")
            .withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
              q.eq("universeId", universe._id)
            )
            .collect(),
      }),
      systems: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("systems")
            .withIndex("by_universe_and_galaxy_and_sector_and_system", (q) =>
              q.eq("universeId", universe._id)
            )
            .collect(),
      }),
      sectors: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("sectors")
            .withIndex("by_universe_id_and_sector_type", (q) =>
              q.eq("universeId", universe._id)
            )
            .collect(),
      }),
      galaxies: await deleteAllByQuery({
        ctx,
        dryRun,
        queryFactory: () =>
          ctx.db
            .query("galaxies")
            .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
            .collect(),
      }),
      universe: 0,
    };

    if (!dryRun) {
      await ctx.db.delete(universe._id);
      deleted.universe = 1;
    }

    return {
      universeId: universe._id,
      universeSlug: universe.slug,
      deleted,
      dryRun,
    };
  },
});
