import { mutation, query } from "../../convex/_generated/server";
import { v } from "convex/values";
import {
  buildLaneQueueView,
  emptyLaneQueueView,
  getOwnedColony,
  listOpenColonyQueueItems,
  queueEventsNextAt,
  queuesViewValidator,
  settleColonyAndPersist,
  settleShipyardQueue,
} from "./shared";
import { settleDueFleetOperations } from "./fleetV2";

export const getColonyQueueLanes = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: queuesViewValidator,
  handler: async (ctx, args) => {
    const { colony } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });
    const now = Date.now();
    const queueRows = await listOpenColonyQueueItems({
      colonyId: colony._id,
      ctx,
    });
    return {
      nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
      lanes: {
        building: buildLaneQueueView({
          lane: "building",
          now,
          rows: queueRows,
        }),
        shipyard: buildLaneQueueView({
          lane: "shipyard",
          now,
          rows: queueRows,
        }),
        research: emptyLaneQueueView("research"),
      },
    };
  },
});

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
    const { colony, planet, player } = await getOwnedColony({
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
    await settleDueFleetOperations({
      ctx,
      now,
      ownerPlayerId: player._id,
    });

    return {
      colonyId: colony._id,
      syncedAt: now,
    };
  },
});
