import { ConvexError, v } from "convex/values";

import { mutation } from "../../convex/_generated/server";

export const backfillRoboticsHubLevel = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const configuredToken = process.env.UNIVERSE_GEN_TOKEN;
    if (!configuredToken) {
      throw new ConvexError("UNIVERSE_GEN_TOKEN is not configured");
    }
    if (args.token !== configuredToken) {
      throw new ConvexError("Invalid token");
    }

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
