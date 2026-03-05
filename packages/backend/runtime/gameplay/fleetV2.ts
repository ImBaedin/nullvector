import {
  getFleetCargoCapacity,
  getFleetFuelCostForDistance,
  getFleetSlowestSpeed,
  normalizeShipCounts,
  type ResourceBucket,
  type ShipCounts,
  type ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../convex/_generated/server";
import { RESOURCE_SCALE } from "../../convex/schema";
import {
  getOwnedColony,
  incrementColonyShipCount,
  resolveCurrentPlayer,
  resourceBucketValidator,
  settleShipyardQueue,
  shipKeyValidator,
} from "./shared";

const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;

const shipCountsValidator = v.object({
  smallCargo: v.number(),
  largeCargo: v.number(),
  colonyShip: v.number(),
});

const transportPostDeliveryActionValidator = v.union(
  v.literal("returnToOrigin"),
  v.literal("stationAtDestination"),
);

const fleetOperationKindValidator = v.union(
  v.literal("transport"),
  v.literal("colonize"),
  v.literal("contract"),
  v.literal("combat"),
);

const fleetOperationStatusValidator = v.union(
  v.literal("planned"),
  v.literal("inTransit"),
  v.literal("atTarget"),
  v.literal("returning"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed"),
);

const fleetTargetValidator = v.object({
  kind: v.union(
    v.literal("colony"),
    v.literal("planet"),
    v.literal("fleet"),
    v.literal("contractNode"),
  ),
  colonyId: v.optional(v.id("colonies")),
  planetId: v.optional(v.id("planets")),
  fleetId: v.optional(v.id("fleets")),
  contractNodeKey: v.optional(v.string()),
});

function emptyResourceBucket(): ResourceBucket {
  return {
    alloy: 0,
    crystal: 0,
    fuel: 0,
  };
}

function cloneResourceBucket(bucket: ResourceBucket): ResourceBucket {
  return {
    alloy: bucket.alloy,
    crystal: bucket.crystal,
    fuel: bucket.fuel,
  };
}

function scaledUnits(unscaledUnits: number) {
  return Math.round(Math.max(0, unscaledUnits) * RESOURCE_SCALE);
}

function wholeUnits(storedAmount: number) {
  return Math.max(0, Math.floor(storedAmount / RESOURCE_SCALE));
}

export function normalizeMissionCargo(
  cargo: Partial<ResourceBucket>,
): ResourceBucket {
  const normalizeValue = (value: number | undefined) => {
    if (!Number.isFinite(value ?? 0)) {
      return 0;
    }
    return Math.max(0, Math.floor(value ?? 0));
  };

  return {
    alloy: normalizeValue(cargo.alloy),
    crystal: normalizeValue(cargo.crystal),
    fuel: normalizeValue(cargo.fuel),
  };
}

function resourceMapToScaledBucket(
  resourceMap: Partial<Record<string, number>>,
): ResourceBucket {
  return {
    alloy: scaledUnits(resourceMap.alloy ?? 0),
    crystal: scaledUnits(resourceMap.crystal ?? 0),
    fuel: scaledUnits(resourceMap.fuel ?? 0),
  };
}

function missionCargoTotal(cargo: ResourceBucket) {
  return cargo.alloy + cargo.crystal + cargo.fuel;
}

export function durationMsForFleet(args: {
  distance: number;
  shipCounts: ShipCounts;
}) {
  const speed = getFleetSlowestSpeed(args.shipCounts);
  if (speed <= 0) {
    throw new ConvexError("Operation fleet has no ships");
  }
  return Math.max(30_000, Math.ceil((args.distance / speed) * 3_600_000));
}

export function euclideanDistance(args: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}) {
  return Math.max(1, Math.hypot(args.x1 - args.x2, args.y1 - args.y2));
}

function isActiveStatus(status: Doc<"fleetOperations">["status"]) {
  return (
    status === "planned" ||
    status === "inTransit" ||
    status === "atTarget" ||
    status === "returning"
  );
}

async function readColonyShipCounts(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  const rows = await args.ctx.db
    .query("colonyShips")
    .withIndex("by_colony", (q) => q.eq("colonyId", args.colonyId))
    .collect();
  const counts = normalizeShipCounts({});
  for (const row of rows) {
    counts[row.shipKey] = row.count;
  }
  return counts;
}

async function decrementShipsOrThrow(args: {
  colony: Doc<"colonies">;
  ctx: MutationCtx;
  now: number;
  requested: ShipCounts;
}) {
  const available = await readColonyShipCounts({
    colonyId: args.colony._id,
    ctx: args.ctx,
  });

  for (const key of Object.keys(args.requested) as ShipKey[]) {
    if (available[key] < args.requested[key]) {
      throw new ConvexError(`Not enough ${key} ships available`);
    }
  }

  for (const key of Object.keys(args.requested) as ShipKey[]) {
    if (args.requested[key] <= 0) {
      continue;
    }
    await incrementColonyShipCount({
      amount: -args.requested[key],
      colony: args.colony,
      ctx: args.ctx,
      now: args.now,
      shipKey: key,
    });
  }
}

async function colonySystemCoords(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  const colony = await args.ctx.db.get(args.colonyId);
  if (!colony) {
    throw new ConvexError("Colony not found");
  }
  const planet = await args.ctx.db.get(colony.planetId);
  if (!planet) {
    throw new ConvexError("Planet not found for colony");
  }
  const system = await args.ctx.db.get(planet.systemId);
  if (!system) {
    throw new ConvexError("System not found for colony");
  }
  return {
    x: system.x,
    y: system.y,
  };
}

async function planetSystemCoords(args: {
  planetId: Id<"planets">;
  ctx: QueryCtx | MutationCtx;
}) {
  const planet = await args.ctx.db.get(args.planetId);
  if (!planet) {
    throw new ConvexError("Planet not found");
  }
  const system = await args.ctx.db.get(planet.systemId);
  if (!system) {
    throw new ConvexError("System not found for planet");
  }
  return {
    x: system.x,
    y: system.y,
  };
}

function starterColonyBuildings(): Doc<"colonies">["buildings"] {
  return {
    alloyMineLevel: 1,
    crystalMineLevel: 1,
    fuelRefineryLevel: 1,
    powerPlantLevel: 1,
    alloyStorageLevel: 0,
    crystalStorageLevel: 0,
    fuelStorageLevel: 0,
    shipyardLevel: 0,
  };
}

function storageCapForLevel(level: number) {
  if (level <= 0) {
    return 0;
  }
  return Math.round(10_000 * Math.pow(1.7, level - 1));
}

function storageCapsFromBuildings(
  buildings: Doc<"colonies">["buildings"],
): ResourceBucket {
  return {
    alloy: scaledUnits(storageCapForLevel(buildings.alloyStorageLevel)),
    crystal: scaledUnits(storageCapForLevel(buildings.crystalStorageLevel)),
    fuel: scaledUnits(storageCapForLevel(buildings.fuelStorageLevel)),
  };
}

function usedSlotsFromBuildings(buildings: Doc<"colonies">["buildings"]) {
  const keys = [
    "alloyMineLevel",
    "crystalMineLevel",
    "fuelRefineryLevel",
    "powerPlantLevel",
    "alloyStorageLevel",
    "crystalStorageLevel",
    "fuelStorageLevel",
    "shipyardLevel",
  ] as const;

  let used = 0;
  for (const key of keys) {
    if (buildings[key] > 0) {
      used += 1;
    }
  }
  return used;
}

async function applyCargoToColony(args: {
  cargoScaled: ResourceBucket;
  colony: Doc<"colonies">;
  ctx: MutationCtx;
  now: number;
}) {
  const nextResources = cloneResourceBucket(args.colony.resources);
  const nextOverflow = cloneResourceBucket(args.colony.overflow);
  const deliveredToStorage = emptyResourceBucket();
  const deliveredToOverflow = emptyResourceBucket();

  for (const key of RESOURCE_KEYS) {
    const currentStored = nextResources[key];
    const cap = args.colony.storageCaps[key];
    const inbound = args.cargoScaled[key];
    const accepted = Math.max(0, Math.min(inbound, Math.max(0, cap - currentStored)));
    const overflow = Math.max(0, inbound - accepted);
    nextResources[key] = currentStored + accepted;
    nextOverflow[key] += overflow;
    deliveredToStorage[key] = accepted;
    deliveredToOverflow[key] = overflow;
  }

  await args.ctx.db.patch(args.colony._id, {
    resources: nextResources,
    overflow: nextOverflow,
    updatedAt: args.now,
  });

  return {
    deliveredToStorage,
    deliveredToOverflow,
  };
}

async function appendFleetEvent(args: {
  ctx: MutationCtx;
  data: Record<string, unknown>;
  eventType: Doc<"fleetEvents">["eventType"];
  fleetId: Id<"fleets">;
  now: number;
  operationId: Id<"fleetOperations">;
  ownerPlayerId: Id<"players">;
  universeId: Id<"universes">;
}) {
  await args.ctx.db.insert("fleetEvents", {
    universeId: args.universeId,
    ownerPlayerId: args.ownerPlayerId,
    fleetId: args.fleetId,
    operationId: args.operationId,
    eventType: args.eventType,
    occurredAt: args.now,
    dataJson: JSON.stringify(args.data),
    createdAt: args.now,
  });
}

async function settleTransportAtTarget(args: {
  ctx: MutationCtx;
  now: number;
  operation: Doc<"fleetOperations">;
}) {
  const destinationId = args.operation.target.colonyId;
  if (!destinationId) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Missing transport destination",
      updatedAt: args.now,
    });
    return;
  }

  const destination = await args.ctx.db.get(destinationId);
  if (!destination) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Destination colony not found",
      updatedAt: args.now,
    });
    return;
  }

  const delivery = await applyCargoToColony({
    cargoScaled: args.operation.cargoRequested,
    colony: destination,
    ctx: args.ctx,
    now: args.now,
  });

  if (args.operation.postDeliveryAction === "stationAtDestination") {
    if (destination.playerId !== args.operation.ownerPlayerId) {
      throw new ConvexError("Cross-player stationing is not allowed");
    }
    for (const key of Object.keys(args.operation.shipCounts) as ShipKey[]) {
      if (args.operation.shipCounts[key] <= 0) {
        continue;
      }
      await incrementColonyShipCount({
        amount: args.operation.shipCounts[key],
        colony: destination,
        ctx: args.ctx,
        now: args.now,
        shipKey: key,
      });
    }

    await args.ctx.db.patch(args.operation.fleetId, {
      state: "stationed",
      locationKind: "colony",
      locationColonyId: destination._id,
      routeOperationId: undefined,
      updatedAt: args.now,
    });

    await args.ctx.db.patch(args.operation._id, {
      status: "completed",
      resolvedAt: args.now,
      nextEventAt: args.now,
      cargoDeliveredToStorage: delivery.deliveredToStorage,
      cargoDeliveredToOverflow: delivery.deliveredToOverflow,
      resultCode: "delivered",
      updatedAt: args.now,
    });

    await appendFleetEvent({
      ctx: args.ctx,
      data: {
        deliveredToStorage: delivery.deliveredToStorage,
        deliveredToOverflow: delivery.deliveredToOverflow,
      },
      eventType: "cargoDelivered",
      fleetId: args.operation.fleetId,
      now: args.now,
      operationId: args.operation._id,
      ownerPlayerId: args.operation.ownerPlayerId,
      universeId: args.operation.universeId,
    });
    return;
  }

  await args.ctx.db.patch(args.operation.fleetId, {
    state: "returning",
    locationKind: "route",
    routeOperationId: args.operation._id,
    updatedAt: args.now,
  });

  const returnDuration = Math.max(30_000, args.operation.arriveAt - args.operation.departAt);
  await args.ctx.db.patch(args.operation._id, {
    status: "returning",
    departAt: args.now,
    arriveAt: args.now + returnDuration,
    nextEventAt: args.now + returnDuration,
    cargoDeliveredToStorage: delivery.deliveredToStorage,
    cargoDeliveredToOverflow: delivery.deliveredToOverflow,
    updatedAt: args.now,
  });

  await appendFleetEvent({
    ctx: args.ctx,
    data: {
      deliveredToStorage: delivery.deliveredToStorage,
      deliveredToOverflow: delivery.deliveredToOverflow,
      returnAt: args.now + returnDuration,
    },
    eventType: "arrived",
    fleetId: args.operation.fleetId,
    now: args.now,
    operationId: args.operation._id,
    ownerPlayerId: args.operation.ownerPlayerId,
    universeId: args.operation.universeId,
  });
}

async function settleColonizeAtTarget(args: {
  ctx: MutationCtx;
  now: number;
  operation: Doc<"fleetOperations">;
}) {
  const targetPlanetId = args.operation.target.planetId;
  if (!targetPlanetId) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Missing colonization target planet",
      updatedAt: args.now,
    });
    return;
  }

  const targetPlanet = await args.ctx.db.get(targetPlanetId);
  if (!targetPlanet || !targetPlanet.isColonizable) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Target planet is not colonizable",
      updatedAt: args.now,
    });
    return;
  }

  const existing = await args.ctx.db
    .query("colonies")
    .withIndex("by_planet_id", (q) => q.eq("planetId", targetPlanetId))
    .first();

  if (existing) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Target planet already colonized",
      updatedAt: args.now,
    });
    return;
  }

  const starterBuildings = starterColonyBuildings();
  const storageCaps = storageCapsFromBuildings(starterBuildings);
  const colonyId = await args.ctx.db.insert("colonies", {
    universeId: args.operation.universeId,
    playerId: args.operation.ownerPlayerId,
    planetId: targetPlanetId,
    name: `Colony ${targetPlanet.galaxyIndex + 1}-${targetPlanet.sectorIndex + 1}-${targetPlanet.systemIndex + 1}`,
    resources: emptyResourceBucket(),
    overflow: emptyResourceBucket(),
    storageCaps,
    buildings: starterBuildings,
    usedSlots: usedSlotsFromBuildings(starterBuildings),
    lastAccruedAt: args.now,
    inboundMissionPolicy: "allowAll",
    createdAt: args.now,
    updatedAt: args.now,
  });

  const createdColony = await args.ctx.db.get(colonyId);
  if (!createdColony) {
    throw new ConvexError("Failed to create colony");
  }

  const delivery = await applyCargoToColony({
    cargoScaled: args.operation.cargoRequested,
    colony: createdColony,
    ctx: args.ctx,
    now: args.now,
  });

  for (const key of ["smallCargo", "largeCargo"] as const) {
    if (args.operation.shipCounts[key] <= 0) {
      continue;
    }
    await incrementColonyShipCount({
      amount: args.operation.shipCounts[key],
      colony: createdColony,
      ctx: args.ctx,
      now: args.now,
      shipKey: key,
    });
  }

  await args.ctx.db.patch(args.operation.fleetId, {
    state: "stationed",
    locationKind: "colony",
    locationColonyId: createdColony._id,
    routeOperationId: undefined,
    updatedAt: args.now,
  });

  await args.ctx.db.patch(args.operation._id, {
    status: "completed",
    resolvedAt: args.now,
    nextEventAt: args.now,
    cargoDeliveredToStorage: delivery.deliveredToStorage,
    cargoDeliveredToOverflow: delivery.deliveredToOverflow,
    resultCode: "colonized",
    updatedAt: args.now,
  });

  await appendFleetEvent({
    ctx: args.ctx,
    data: {
      colonyId: createdColony._id,
      planetId: targetPlanetId,
    },
    eventType: "colonyFounded",
    fleetId: args.operation.fleetId,
    now: args.now,
    operationId: args.operation._id,
    ownerPlayerId: args.operation.ownerPlayerId,
    universeId: args.operation.universeId,
  });
}

async function settleOperationReturn(args: {
  ctx: MutationCtx;
  now: number;
  operation: Doc<"fleetOperations">;
}) {
  const origin = await args.ctx.db.get(args.operation.originColonyId);
  if (!origin) {
    await args.ctx.db.patch(args.operation._id, {
      status: "failed",
      resolvedAt: args.now,
      resultCode: "failed",
      resultMessage: "Origin colony not found for return",
      updatedAt: args.now,
    });
    return;
  }

  for (const key of Object.keys(args.operation.shipCounts) as ShipKey[]) {
    if (args.operation.shipCounts[key] <= 0) {
      continue;
    }
    await incrementColonyShipCount({
      amount: args.operation.shipCounts[key],
      colony: origin,
      ctx: args.ctx,
      now: args.now,
      shipKey: key,
    });
  }

  await args.ctx.db.patch(args.operation.fleetId, {
    state: "stationed",
    locationKind: "colony",
    locationColonyId: origin._id,
    routeOperationId: undefined,
    updatedAt: args.now,
  });

  await args.ctx.db.patch(args.operation._id, {
    status: "completed",
    resolvedAt: args.now,
    nextEventAt: args.now,
    resultCode: args.operation.cancelledAt ? "cancelledInFlight" : "delivered",
    updatedAt: args.now,
  });

  await appendFleetEvent({
    ctx: args.ctx,
    data: {
      originColonyId: origin._id,
    },
    eventType: "returned",
    fleetId: args.operation.fleetId,
    now: args.now,
    operationId: args.operation._id,
    ownerPlayerId: args.operation.ownerPlayerId,
    universeId: args.operation.universeId,
  });
}

export async function settleDueFleetOperations(args: {
  ctx: MutationCtx;
  now: number;
  ownerPlayerId: Id<"players">;
}) {
  const [dueInTransit, dueReturning] = await Promise.all([
    args.ctx.db
      .query("fleetOperations")
      .withIndex("by_owner_stat_evt", (q) =>
        q
          .eq("ownerPlayerId", args.ownerPlayerId)
          .eq("status", "inTransit")
          .lte("nextEventAt", args.now),
      )
      .collect(),
    args.ctx.db
      .query("fleetOperations")
      .withIndex("by_owner_stat_evt", (q) =>
        q
          .eq("ownerPlayerId", args.ownerPlayerId)
          .eq("status", "returning")
          .lte("nextEventAt", args.now),
      )
      .collect(),
  ]);

  const due = [...dueInTransit, ...dueReturning].sort(
    (left, right) => left.nextEventAt - right.nextEventAt,
  );

  for (const operation of due) {
    const latest = await args.ctx.db.get(operation._id);
    if (!latest) {
      continue;
    }

    if (
      (latest.status !== "inTransit" && latest.status !== "returning") ||
      latest.nextEventAt > args.now
    ) {
      continue;
    }

    if (latest.status === "returning") {
      await settleOperationReturn({
        ctx: args.ctx,
        now: args.now,
        operation: latest,
      });
      continue;
    }

    if (latest.kind === "transport") {
      await settleTransportAtTarget({
        ctx: args.ctx,
        now: args.now,
        operation: latest,
      });
      continue;
    }

    if (latest.kind === "colonize") {
      await settleColonizeAtTarget({
        ctx: args.ctx,
        now: args.now,
        operation: latest,
      });
      continue;
    }

    const origin = await args.ctx.db.get(latest.originColonyId);
    if (origin) {
      for (const key of Object.keys(latest.shipCounts) as ShipKey[]) {
        if (latest.shipCounts[key] <= 0) {
          continue;
        }
        await incrementColonyShipCount({
          amount: latest.shipCounts[key],
          colony: origin,
          ctx: args.ctx,
          now: args.now,
          shipKey: key,
        });
      }
    }

    await args.ctx.db.patch(latest._id, {
      status: "failed",
      resolvedAt: args.now,
      nextEventAt: args.now,
      resultCode: "notImplemented",
      resultMessage: `${latest.kind} operations are not implemented yet`,
      updatedAt: args.now,
    });

    await args.ctx.db.patch(latest.fleetId, {
      state: origin ? "stationed" : "destroyed",
      locationKind: origin ? "colony" : "route",
      locationColonyId: origin?._id,
      routeOperationId: undefined,
      updatedAt: args.now,
    });

    await appendFleetEvent({
      ctx: args.ctx,
      data: {
        reason: `${latest.kind} operations are not implemented yet`,
      },
      eventType: "failed",
      fleetId: latest.fleetId,
      now: args.now,
      operationId: latest._id,
      ownerPlayerId: latest.ownerPlayerId,
      universeId: latest.universeId,
    });
  }

  return due.length;
}

const operationSummaryValidator = v.object({
  id: v.id("fleetOperations"),
  fleetId: v.id("fleets"),
  kind: fleetOperationKindValidator,
  status: fleetOperationStatusValidator,
  originColonyId: v.id("colonies"),
  target: fleetTargetValidator,
  shipCounts: shipCountsValidator,
  cargoRequested: resourceBucketValidator,
  postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
  departAt: v.number(),
  arriveAt: v.number(),
  nextEventAt: v.number(),
  parentOperationId: v.optional(v.id("fleetOperations")),
});

export const getFleetDashboard = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    active: v.array(operationSummaryValidator),
    garrisonShips: shipCountsValidator,
    nextEventAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const { colony, player } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const [shipRows, operations] = await Promise.all([
      ctx.db
        .query("colonyShips")
        .withIndex("by_colony", (q) => q.eq("colonyId", colony._id))
        .collect(),
      ctx.db
        .query("fleetOperations")
        .withIndex("by_owner_stat_evt", (q) =>
          q.eq("ownerPlayerId", player._id).eq("status", "inTransit"),
        )
        .collect(),
    ]);

    const returning = await ctx.db
      .query("fleetOperations")
      .withIndex("by_owner_stat_evt", (q) =>
        q.eq("ownerPlayerId", player._id).eq("status", "returning"),
      )
      .collect();

    const activeOps = [...operations, ...returning].sort(
      (left, right) => left.nextEventAt - right.nextEventAt,
    );

    const garrisonShips = normalizeShipCounts({});
    for (const row of shipRows) {
      garrisonShips[row.shipKey] = row.count;
    }

    return {
      active: activeOps.map((operation) => ({
        id: operation._id,
        fleetId: operation.fleetId,
        kind: operation.kind,
        status: operation.status,
        originColonyId: operation.originColonyId,
        target: operation.target,
        shipCounts: operation.shipCounts,
        cargoRequested: {
          alloy: wholeUnits(operation.cargoRequested.alloy),
          crystal: wholeUnits(operation.cargoRequested.crystal),
          fuel: wholeUnits(operation.cargoRequested.fuel),
        },
        postDeliveryAction: operation.postDeliveryAction,
        departAt: operation.departAt,
        arriveAt: operation.arriveAt,
        nextEventAt: operation.nextEventAt,
        parentOperationId: operation.parentOperationId,
      })),
      garrisonShips,
      nextEventAt: activeOps[0]?.nextEventAt,
    };
  },
});

export const getFleetOperation = query({
  args: {
    operationId: v.id("fleetOperations"),
  },
  returns: v.object({
    operation: operationSummaryValidator,
    resultCode: v.optional(v.string()),
    resultMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const player = await resolveCurrentPlayer(ctx);
    if (!player?.player) {
      throw new ConvexError("Authentication required");
    }

    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.ownerPlayerId !== player.player._id) {
      throw new ConvexError("Operation not found");
    }

    return {
      operation: {
        id: operation._id,
        fleetId: operation.fleetId,
        kind: operation.kind,
        status: operation.status,
        originColonyId: operation.originColonyId,
        target: operation.target,
        shipCounts: operation.shipCounts,
        cargoRequested: {
          alloy: wholeUnits(operation.cargoRequested.alloy),
          crystal: wholeUnits(operation.cargoRequested.crystal),
          fuel: wholeUnits(operation.cargoRequested.fuel),
        },
        postDeliveryAction: operation.postDeliveryAction,
        departAt: operation.departAt,
        arriveAt: operation.arriveAt,
        nextEventAt: operation.nextEventAt,
        parentOperationId: operation.parentOperationId,
      },
      resultCode: operation.resultCode,
      resultMessage: operation.resultMessage,
    };
  },
});

export const getFleetOperationTimeline = query({
  args: {
    colonyId: v.optional(v.id("colonies")),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    events: v.array(
      v.object({
        id: v.id("fleetEvents"),
        operationId: v.id("fleetOperations"),
        fleetId: v.id("fleets"),
        eventType: v.string(),
        occurredAt: v.number(),
        dataJson: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const player = await resolveCurrentPlayer(ctx);
    if (!player?.player) {
      throw new ConvexError("Authentication required");
    }

    if (args.colonyId) {
      await getOwnedColony({
        ctx,
        colonyId: args.colonyId,
      });
    }

    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)));
    const rows = await ctx.db
      .query("fleetEvents")
      .withIndex("by_owner_time", (q) => q.eq("ownerPlayerId", player.player._id))
      .order("desc")
      .take(limit);

    return {
      events: rows.map((row) => ({
        id: row._id,
        operationId: row.operationId,
        fleetId: row.fleetId,
        eventType: row.eventType,
        occurredAt: row.occurredAt,
        dataJson: row.dataJson,
      })),
    };
  },
});

export const syncFleetState = mutation({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    resolvedCount: v.number(),
    syncedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { player } = await getOwnedColony({
      colonyId: args.colonyId,
      ctx,
    });

    const resolvedCount = await settleDueFleetOperations({
      ctx,
      now,
      ownerPlayerId: player._id,
    });

    return {
      resolvedCount,
      syncedAt: now,
    };
  },
});

export const createOperation = mutation({
  args: {
    originColonyId: v.id("colonies"),
    kind: fleetOperationKindValidator,
    target: fleetTargetValidator,
    shipCounts: shipCountsValidator,
    cargoRequested: resourceBucketValidator,
    postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
  },
  returns: v.object({
    operationId: v.id("fleetOperations"),
    fleetId: v.id("fleets"),
    departAt: v.number(),
    arriveAt: v.number(),
    distance: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedShips = normalizeShipCounts(args.shipCounts);
    const cargoRequested = normalizeMissionCargo(args.cargoRequested);

    if (args.kind !== "transport" && args.kind !== "colonize") {
      throw new ConvexError(`${args.kind} operations are not implemented yet`);
    }

    if (missionCargoTotal(cargoRequested) > getFleetCargoCapacity(normalizedShips)) {
      throw new ConvexError("Cargo exceeds fleet cargo capacity");
    }

    const origin = await getOwnedColony({
      colonyId: args.originColonyId,
      ctx,
    });

    await settleDueFleetOperations({
      ctx,
      now,
      ownerPlayerId: origin.player._id,
    });

    await settleShipyardQueue({
      colony: origin.colony,
      ctx,
      now,
    });

    await decrementShipsOrThrow({
      colony: origin.colony,
      ctx,
      now,
      requested: normalizedShips,
    });

    let distance = 1;
    if (args.kind === "transport") {
      if (normalizedShips.colonyShip > 0) {
        throw new ConvexError("Transport operations cannot include colony ships");
      }
      if (args.target.kind !== "colony" || !args.target.colonyId) {
        throw new ConvexError("Transport operations require a target colony");
      }

      const destination = await ctx.db.get(args.target.colonyId);
      if (!destination) {
        throw new ConvexError("Transport destination not found");
      }
      if (destination.universeId !== origin.colony.universeId) {
        throw new ConvexError("Target colony is in a different universe");
      }
      const targetPolicy = destination.inboundMissionPolicy ?? "allowAll";
      if (targetPolicy === "denyAll") {
        throw new ConvexError("Destination colony does not accept inbound missions");
      }
      if (
        args.postDeliveryAction === "stationAtDestination" &&
        destination.playerId !== origin.player._id
      ) {
        throw new ConvexError("Cross-player stationing is not allowed");
      }

      const originCoords = await colonySystemCoords({
        colonyId: origin.colony._id,
        ctx,
      });
      const destinationCoords = await colonySystemCoords({
        colonyId: destination._id,
        ctx,
      });
      distance = euclideanDistance({
        x1: originCoords.x,
        y1: originCoords.y,
        x2: destinationCoords.x,
        y2: destinationCoords.y,
      });
    }

    if (args.kind === "colonize") {
      if (normalizedShips.colonyShip !== 1) {
        throw new ConvexError("Colonization requires exactly one colony ship");
      }
      if (args.target.kind !== "planet" || !args.target.planetId) {
        throw new ConvexError("Colonization operations require a target planet");
      }

      const targetPlanet = await ctx.db.get(args.target.planetId);
      if (!targetPlanet || !targetPlanet.isColonizable) {
        throw new ConvexError("Target planet is not colonizable");
      }
      if (targetPlanet.universeId !== origin.colony.universeId) {
        throw new ConvexError("Target planet is in a different universe");
      }

      const occupied = await ctx.db
        .query("colonies")
        .withIndex("by_planet_id", (q) => q.eq("planetId", targetPlanet._id))
        .first();
      if (occupied) {
        throw new ConvexError("Target planet is already colonized");
      }

      const activePlanetOps = await ctx.db
        .query("fleetOperations")
        .withIndex("by_target_planet_stat", (q) =>
          q.eq("target.planetId", targetPlanet._id).eq("status", "inTransit"),
        )
        .collect();
      if (activePlanetOps.some((row) => row.kind === "colonize")) {
        throw new ConvexError("Target planet already has an active colonization operation");
      }

      const originCoords = await colonySystemCoords({
        colonyId: origin.colony._id,
        ctx,
      });
      const targetCoords = await planetSystemCoords({
        planetId: targetPlanet._id,
        ctx,
      });
      distance = euclideanDistance({
        x1: originCoords.x,
        y1: originCoords.y,
        x2: targetCoords.x,
        y2: targetCoords.y,
      });
    }

    const durationMs = durationMsForFleet({
      distance,
      shipCounts: normalizedShips,
    });

    const oneWayFuelScaled = scaledUnits(
      getFleetFuelCostForDistance({ distance, shipCounts: normalizedShips }),
    );
    const fuelScaled =
      args.kind === "transport" && args.postDeliveryAction === "returnToOrigin"
        ? oneWayFuelScaled * 2
        : oneWayFuelScaled;

    const cargoScaled = resourceMapToScaledBucket(cargoRequested);
    const deduction: ResourceBucket = {
      alloy: cargoScaled.alloy,
      crystal: cargoScaled.crystal,
      fuel: cargoScaled.fuel + fuelScaled,
    };

    const latestOrigin = await ctx.db.get(origin.colony._id);
    if (!latestOrigin) {
      throw new ConvexError("Origin colony not found");
    }
    for (const key of RESOURCE_KEYS) {
      if (latestOrigin.resources[key] < deduction[key]) {
        throw new ConvexError(`Not enough ${key} for this operation`);
      }
    }

    await ctx.db.patch(latestOrigin._id, {
      resources: {
        alloy: latestOrigin.resources.alloy - deduction.alloy,
        crystal: latestOrigin.resources.crystal - deduction.crystal,
        fuel: latestOrigin.resources.fuel - deduction.fuel,
      },
      updatedAt: now,
    });

    const fleetId = await ctx.db.insert("fleets", {
      universeId: latestOrigin.universeId,
      ownerPlayerId: latestOrigin.playerId,
      homeColonyId: latestOrigin._id,
      state: "inTransit",
      locationKind: "route",
      locationColonyId: latestOrigin._id,
      locationPlanetId: undefined,
      routeOperationId: undefined,
      shipCounts: normalizedShips,
      cargo: cargoScaled,
      createdAt: now,
      updatedAt: now,
    });

    const operationId = await ctx.db.insert("fleetOperations", {
      universeId: latestOrigin.universeId,
      ownerPlayerId: latestOrigin.playerId,
      fleetId,
      kind: args.kind,
      status: "inTransit",
      originColonyId: latestOrigin._id,
      target: args.target,
      postDeliveryAction:
        args.kind === "transport" ? (args.postDeliveryAction ?? "returnToOrigin") : undefined,
      parentOperationId: undefined,
      shipCounts: normalizedShips,
      cargoRequested: cargoScaled,
      cargoDeliveredToStorage: emptyResourceBucket(),
      cargoDeliveredToOverflow: emptyResourceBucket(),
      fuelCharged: fuelScaled,
      fuelWaived: undefined,
      distance,
      departAt: now,
      arriveAt: now + durationMs,
      nextEventAt: now + durationMs,
      cancelledAt: undefined,
      resolvedAt: undefined,
      resultCode: undefined,
      resultMessage: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(fleetId, {
      routeOperationId: operationId,
      updatedAt: now,
    });

    await appendFleetEvent({
      ctx,
      data: {
        kind: args.kind,
        target: args.target,
      },
      eventType: "created",
      fleetId,
      now,
      operationId,
      ownerPlayerId: latestOrigin.playerId,
      universeId: latestOrigin.universeId,
    });

    return {
      operationId,
      fleetId,
      departAt: now,
      arriveAt: now + durationMs,
      distance,
    };
  },
});

export const cancelOperation = mutation({
  args: {
    operationId: v.id("fleetOperations"),
  },
  returns: v.object({
    operationId: v.id("fleetOperations"),
    returnAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const playerResult = await resolveCurrentPlayer(ctx);
    if (!playerResult?.player) {
      throw new ConvexError("Authentication required");
    }

    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.ownerPlayerId !== playerResult.player._id) {
      throw new ConvexError("Operation not found");
    }
    if (operation.status !== "inTransit") {
      throw new ConvexError("Only in-transit operations can be cancelled");
    }
    if (now >= operation.arriveAt) {
      throw new ConvexError("Operation has already reached the target");
    }

    const totalDuration = Math.max(1, operation.arriveAt - operation.departAt);
    const elapsed = Math.max(0, Math.min(totalDuration, now - operation.departAt));
    const elapsedRatio = elapsed / totalDuration;
    const returnDistance = Math.max(1, operation.distance * elapsedRatio);
    const returnDurationMs = Math.max(30_000, elapsed);

    let additionalFuelCharged = 0;
    let fuelWaived = 0;
    if (!(operation.kind === "transport" && operation.postDeliveryAction === "returnToOrigin")) {
      const extraFuelScaled = scaledUnits(
        getFleetFuelCostForDistance({
          distance: returnDistance,
          shipCounts: operation.shipCounts,
        }),
      );
      const origin = await ctx.db.get(operation.originColonyId);
      if (!origin) {
        throw new ConvexError("Origin colony not found");
      }
      const availableFuel = origin.resources.fuel;
      additionalFuelCharged = Math.min(extraFuelScaled, availableFuel);
      fuelWaived = Math.max(0, extraFuelScaled - additionalFuelCharged);
      await ctx.db.patch(origin._id, {
        resources: {
          ...origin.resources,
          fuel: origin.resources.fuel - additionalFuelCharged,
        },
        updatedAt: now,
      });
    }

    await ctx.db.patch(operation.fleetId, {
      state: "returning",
      locationKind: "route",
      routeOperationId: operation._id,
      updatedAt: now,
    });

    await ctx.db.patch(operation._id, {
      status: "returning",
      cancelledAt: now,
      departAt: now,
      arriveAt: now + returnDurationMs,
      nextEventAt: now + returnDurationMs,
      fuelCharged: operation.fuelCharged + additionalFuelCharged,
      fuelWaived: fuelWaived > 0 ? fuelWaived : operation.fuelWaived,
      updatedAt: now,
    });

    await appendFleetEvent({
      ctx,
      data: {
        returnAt: now + returnDurationMs,
      },
      eventType: "cancelled",
      fleetId: operation.fleetId,
      now,
      operationId: operation._id,
      ownerPlayerId: operation.ownerPlayerId,
      universeId: operation.universeId,
    });

    return {
      operationId: operation._id,
      returnAt: now + returnDurationMs,
    };
  },
});

export const processDueOperationsCron = internalMutation({
  args: {},
  returns: v.object({
    processedPlayers: v.number(),
    resolvedCount: v.number(),
    runAt: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const activePlayers = await ctx.db
      .query("fleetOperations")
      .withIndex("by_stat_evt", (q) =>
        q.eq("status", "inTransit").lte("nextEventAt", now),
      )
      .collect();

    const returningPlayers = await ctx.db
      .query("fleetOperations")
      .withIndex("by_stat_evt", (q) =>
        q.eq("status", "returning").lte("nextEventAt", now),
      )
      .collect();

    const ownerIds = new Set<Id<"players">>();
    for (const row of activePlayers) {
      ownerIds.add(row.ownerPlayerId);
    }
    for (const row of returningPlayers) {
      ownerIds.add(row.ownerPlayerId);
    }

    let resolvedCount = 0;
    for (const ownerPlayerId of ownerIds) {
      resolvedCount += await settleDueFleetOperations({
        ctx,
        now,
        ownerPlayerId,
      });
    }

    return {
      processedPlayers: ownerIds.size,
      resolvedCount,
      runAt: now,
    };
  },
});
