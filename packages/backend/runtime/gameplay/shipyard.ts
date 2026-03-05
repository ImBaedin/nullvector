import {
  DEFAULT_SHIP_DEFINITIONS,
  getShipBuildDurationSeconds,
} from "@nullvector/game-logic";
import type { ResourceBucket, ShipKey } from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import { mutation, query } from "../../convex/_generated/server";
import {
  LANE_QUEUE_CAPACITY,
  OPEN_QUEUE_STATUSES,
  RESOURCE_KEYS,
  buildLaneQueueView,
  cloneResourceBucket,
  getOwnedColony,
  isShipBuildQueueItem,
  laneQueueViewValidator,
  listColonyQueueItems,
  listOpenLaneQueueItems,
  queueEventsNextAt,
  queueItemStatusValidator,
  resourceMapToScaledBucket,
  settleColonyAndPersist,
  settleShipyardQueue,
  shipDefinitionViewValidator,
  shipKeyValidator,
} from "./shared";
export const getShipyardView = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    shipyardLevel: v.number(),
    nextEventAt: v.optional(v.number()),
    lane: laneQueueViewValidator,
    ships: v.array(shipDefinitionViewValidator),
  }),
  handler: async (ctx, args) => {
    const { colony } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const queueRows = await listColonyQueueItems({
      colonyId: colony._id,
      ctx,
    });
    const shipyardLane = buildLaneQueueView({
      lane: "shipyard",
      now: Date.now(),
      rows: queueRows,
    });
    const openShipyardRows = queueRows.filter(
      (row) =>
        row.lane === "shipyard" &&
        OPEN_QUEUE_STATUSES.includes(row.status) &&
        isShipBuildQueueItem(row),
    );
    const shipRows = await ctx.db
      .query("colonyShips")
      .withIndex("by_colony", (q) => q.eq("colonyId", colony._id))
      .collect();
    const countsByShip = new Map<ShipKey, number>();
    for (const row of shipRows) {
      countsByShip.set(row.shipKey, row.count);
    }

    const ships = (Object.keys(DEFAULT_SHIP_DEFINITIONS) as ShipKey[]).map(
      (shipKey) => {
        const definition = DEFAULT_SHIP_DEFINITIONS[shipKey];
        const costWhole = definition.cost;
        const costScaled = resourceMapToScaledBucket(costWhole);
        const queued = openShipyardRows.reduce((total, row) => {
          if (!isShipBuildQueueItem(row)) {
            return total;
          }
          if (row.payload.shipKey !== shipKey) {
            return total;
          }
          return total + Math.max(0, row.payload.quantity - row.payload.completedQuantity);
        }, 0);
        const canAfford = RESOURCE_KEYS.every(
          (resourceKey) => colony.resources[resourceKey] >= costScaled[resourceKey],
        );
        const unlocked = colony.buildings.shipyardLevel >= definition.requiredShipyardLevel;
        const canBuild = unlocked && canAfford && !shipyardLane.isFull;

        return {
          key: shipKey,
          name: definition.name,
          requiredShipyardLevel: definition.requiredShipyardLevel,
          owned: countsByShip.get(shipKey) ?? 0,
          queued,
          cargoCapacity: definition.cargoCapacity,
          speed: definition.speed,
          fuelPerDistance: definition.fuelPerDistance,
          cost: costWhole,
          perUnitDurationSeconds: getShipBuildDurationSeconds({
            shipKey,
            shipyardLevel: colony.buildings.shipyardLevel,
          }),
          canBuild,
        };
      },
    );

    return {
      colonyId: colony._id,
      shipyardLevel: colony.buildings.shipyardLevel,
      nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
      lane: shipyardLane,
      ships,
    };
  },
});

export const enqueueShipBuild = mutation({
  args: {
    colonyId: v.id("colonies"),
    shipKey: shipKeyValidator,
    quantity: v.number(),
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    queueItemId: v.id("colonyQueueItems"),
    shipKey: shipKeyValidator,
    quantity: v.number(),
    startsAt: v.number(),
    completesAt: v.number(),
    perUnitDurationSeconds: v.number(),
    status: queueItemStatusValidator,
  }),
  handler: async (ctx, args) => {
    const quantity = Math.max(0, Math.floor(args.quantity));
    if (quantity <= 0) {
      throw new ConvexError("Quantity must be a positive integer");
    }
    if (quantity > 10_000) {
      throw new ConvexError("Quantity exceeds maximum batch size");
    }

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

    const definition = DEFAULT_SHIP_DEFINITIONS[args.shipKey];
    if (settledColony.buildings.shipyardLevel < definition.requiredShipyardLevel) {
      throw new ConvexError("Shipyard level is too low for this ship");
    }

    const queueRows = await listOpenLaneQueueItems({
      colonyId: settledColony._id,
      ctx,
      lane: "shipyard",
    });
    if (queueRows.length >= LANE_QUEUE_CAPACITY.shipyard) {
      throw new ConvexError("Shipyard queue is full");
    }

    const perUnitCostScaled = resourceMapToScaledBucket(definition.cost);
    const totalCostScaled: ResourceBucket = {
      alloy: perUnitCostScaled.alloy * quantity,
      crystal: perUnitCostScaled.crystal * quantity,
      fuel: perUnitCostScaled.fuel * quantity,
    };

    for (const key of RESOURCE_KEYS) {
      if (settledColony.resources[key] < totalCostScaled[key]) {
        throw new ConvexError(`Not enough ${key} to queue ship build`);
      }
    }

    const nextResources = cloneResourceBucket(settledColony.resources);
    for (const key of RESOURCE_KEYS) {
      nextResources[key] -= totalCostScaled[key];
    }

    const perUnitDurationSeconds = getShipBuildDurationSeconds({
      shipKey: args.shipKey,
      shipyardLevel: settledColony.buildings.shipyardLevel,
    });

    const laneTail = queueRows[queueRows.length - 1];
    const startsAt = laneTail ? laneTail.completesAt : now;
    const completesAt = startsAt + perUnitDurationSeconds * quantity * 1_000;
    const status: "active" | "queued" = queueRows.length === 0 ? "active" : "queued";
    const laneOrder = (laneTail?.order ?? 0) + 1;

    await ctx.db.patch(settledColony._id, {
      resources: nextResources,
      updatedAt: now,
    });

    const queueItemId = await ctx.db.insert("colonyQueueItems", {
      universeId: settledColony.universeId,
      playerId: player._id,
      colonyId: settledColony._id,
      lane: "shipyard",
      kind: "shipBuild",
      status,
      order: laneOrder,
      queuedAt: now,
      startsAt,
      completesAt,
      cost: totalCostScaled,
      payload: {
        shipKey: args.shipKey,
        quantity,
        completedQuantity: 0,
        perUnitDurationSeconds,
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      colonyId: settledColony._id,
      queueItemId,
      shipKey: args.shipKey,
      quantity,
      startsAt,
      completesAt,
      perUnitDurationSeconds,
      status,
    };
  },
});
