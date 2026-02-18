import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
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

export const ensureCoreCapacity = mutation({
  args: ensureCoreCapacityArgsValidator,
  returns: ensureCoreCapacityResultValidator,
  handler: async (ctx, args) => {
    const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
    if (!configuredToken) {
      throw new ConvexError(
        "UNIVERSE_GEN_TOKEN is not configured on this Convex deployment"
      );
    }

    if (args.token !== configuredToken) {
      throw new ConvexError("Invalid generation token");
    }

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
