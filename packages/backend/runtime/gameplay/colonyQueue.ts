import { mutation } from "../../convex/_generated/server";
import { v } from "convex/values";
import { getOwnedColony, settleColonyAndPersist, settleShipyardQueue } from "./shared";
export const syncColony = mutation({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    syncedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { colony, planet } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const settledColony = await settleColonyAndPersist({
      ctx,
      colony,
      planet,
      now,
    });
    await settleShipyardQueue({
      colony: settledColony,
      ctx,
      now,
    });

    return {
      colonyId: colony._id,
      syncedAt: now,
    };
  },
});
