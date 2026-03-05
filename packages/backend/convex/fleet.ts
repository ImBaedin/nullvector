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

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { settleShipyardQueue } from "../runtime/gameplay/shared";
import { authComponent } from "./auth";
import { RESOURCE_SCALE } from "./schema";

const MAX_COLONIES = 3;
const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;

const resourceBucketValidator = v.object({
  alloy: v.number(),
  crystal: v.number(),
  fuel: v.number(),
});

const shipCountsValidator = v.object({
  smallCargo: v.number(),
  largeCargo: v.number(),
  colonyShip: v.number(),
});

const shipKeyValidator = v.union(
  v.literal("smallCargo"),
  v.literal("largeCargo"),
  v.literal("colonyShip"),
);

const transportPostDeliveryActionValidator = v.union(
  v.literal("returnToOrigin"),
  v.literal("stationAtDestination"),
);

const fleetMissionTypeValidator = v.union(
  v.literal("colonize"),
  v.literal("transport"),
  v.literal("return"),
);

const fleetMissionStatusValidator = v.union(
  v.literal("inTransit"),
  v.literal("completed"),
  v.literal("cancelled"),
);

function emptyResourceBucket(): ResourceBucket {
  return {
    alloy: 0,
    crystal: 0,
    fuel: 0,
  };
}

function scaledUnits(unscaledUnits: number) {
  return Math.round(Math.max(0, unscaledUnits) * RESOURCE_SCALE);
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

function normalizeMissionCargo(cargo: Partial<ResourceBucket>): ResourceBucket {
  return {
    alloy: Math.max(0, Math.floor(cargo.alloy ?? 0)),
    crystal: Math.max(0, Math.floor(cargo.crystal ?? 0)),
    fuel: Math.max(0, Math.floor(cargo.fuel ?? 0)),
  };
}

function missionCargoTotal(cargo: ResourceBucket) {
  return cargo.alloy + cargo.crystal + cargo.fuel;
}

function cloneResourceBucket(bucket: ResourceBucket): ResourceBucket {
  return {
    alloy: bucket.alloy,
    crystal: bucket.crystal,
    fuel: bucket.fuel,
  };
}

function resolvedAuthUserId(authUser: {
  userId?: string | null;
  id?: string | null;
  _id?: string | null;
}) {
  return authUser.userId ?? authUser.id ?? authUser._id ?? null;
}

async function resolveCurrentPlayer(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    return null;
  }

  const authUserId = resolvedAuthUserId(authUser);
  if (!authUserId) {
    throw new ConvexError("Authenticated user is missing an id");
  }

  const players = await ctx.db
    .query("players")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .collect();

  players.sort((left, right) => left._creationTime - right._creationTime);
  return players[0] ?? null;
}

async function getOwnedColony(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  const player = await resolveCurrentPlayer(args.ctx);
  if (!player) {
    throw new ConvexError("Authentication required");
  }

  const colony = await args.ctx.db.get(args.colonyId);
  if (!colony) {
    throw new ConvexError("Colony not found");
  }
  if (colony.playerId !== player._id) {
    throw new ConvexError("Colony access denied");
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
    player,
    colony,
    planet,
    system,
  };
}

async function incrementColonyShipCount(args: {
  amount: number;
  colony: Doc<"colonies">;
  ctx: MutationCtx;
  now: number;
  shipKey: ShipKey;
}) {
  const existing = await args.ctx.db
    .query("colonyShips")
    .withIndex("by_colony_and_ship_key", (q) =>
      q.eq("colonyId", args.colony._id).eq("shipKey", args.shipKey),
    )
    .unique();
  const nextCount = Math.max(0, (existing?.count ?? 0) + args.amount);
  if (existing) {
    await args.ctx.db.patch(existing._id, {
      count: nextCount,
      updatedAt: args.now,
    });
    return;
  }

  await args.ctx.db.insert("colonyShips", {
    universeId: args.colony.universeId,
    playerId: args.colony.playerId,
    colonyId: args.colony._id,
    shipKey: args.shipKey,
    count: nextCount,
    updatedAt: args.now,
  });
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

function durationMsForFleet(args: { distance: number; shipCounts: ShipCounts }) {
  const speed = getFleetSlowestSpeed(args.shipCounts);
  if (speed <= 0) {
    throw new ConvexError("Mission fleet has no ships");
  }
  return Math.max(30_000, Math.ceil((args.distance / speed) * 3_600_000));
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

function euclideanDistance(args: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}) {
  return Math.max(1, Math.hypot(args.x1 - args.x2, args.y1 - args.y2));
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
    nextOverflow[key] = nextOverflow[key] + overflow;
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

async function settleDueFleetMissions(args: {
  ctx: MutationCtx;
  now: number;
  playerId: Id<"players">;
}) {
  const due = await args.ctx.db
    .query("fleetMissions")
    .withIndex("by_player_status_arrive", (q) =>
      q.eq("playerId", args.playerId).eq("status", "inTransit").lte("arriveAt", args.now),
    )
    .collect();

  due.sort((left, right) => {
    if (left.arriveAt !== right.arriveAt) {
      return left.arriveAt - right.arriveAt;
    }
    return left._creationTime - right._creationTime;
  });

  for (const mission of due) {
    if (mission.status !== "inTransit") {
      continue;
    }

    if (mission.missionType === "return") {
      if (!mission.targetColonyId) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }
      const destination = await args.ctx.db.get(mission.targetColonyId);
      if (!destination) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      await applyCargoToColony({
        cargoScaled: mission.cargoRequested,
        colony: destination,
        ctx: args.ctx,
        now: args.now,
      });
      for (const key of Object.keys(mission.shipCounts) as ShipKey[]) {
        if (mission.shipCounts[key] <= 0) {
          continue;
        }
        await incrementColonyShipCount({
          amount: mission.shipCounts[key],
          colony: destination,
          ctx: args.ctx,
          now: args.now,
          shipKey: key,
        });
      }

      await args.ctx.db.patch(mission._id, {
        status: "completed",
        resolvedAt: args.now,
        updatedAt: args.now,
      });
      continue;
    }

    if (mission.missionType === "transport") {
      if (!mission.targetColonyId) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      const destination = await args.ctx.db.get(mission.targetColonyId);
      if (!destination) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      const delivery = await applyCargoToColony({
        cargoScaled: mission.cargoRequested,
        colony: destination,
        ctx: args.ctx,
        now: args.now,
      });

      if (mission.postDeliveryAction === "stationAtDestination") {
        for (const key of Object.keys(mission.shipCounts) as ShipKey[]) {
          if (mission.shipCounts[key] <= 0) {
            continue;
          }
          await incrementColonyShipCount({
            amount: mission.shipCounts[key],
            colony: destination,
            ctx: args.ctx,
            now: args.now,
            shipKey: key,
          });
        }
      } else {
        const durationMs = Math.max(30_000, mission.arriveAt - mission.departAt);
        await args.ctx.db.insert("fleetMissions", {
          universeId: mission.universeId,
          playerId: mission.playerId,
          missionType: "return",
          status: "inTransit",
          originColonyId: destination._id,
          targetColonyId: mission.originColonyId,
          targetPlanetId: undefined,
          postDeliveryAction: undefined,
          parentMissionId: mission._id,
          shipCounts: mission.shipCounts,
          cargoRequested: emptyResourceBucket(),
          cargoDeliveredToStorage: emptyResourceBucket(),
          cargoDeliveredToOverflow: emptyResourceBucket(),
          fuelCharged: 0,
          fuelWaived: undefined,
          distance: mission.distance,
          departAt: args.now,
          arriveAt: args.now + durationMs,
          cancelledAt: undefined,
          resolvedAt: undefined,
          createdAt: args.now,
          updatedAt: args.now,
        });
      }

      await args.ctx.db.patch(mission._id, {
        status: "completed",
        cargoDeliveredToStorage: delivery.deliveredToStorage,
        cargoDeliveredToOverflow: delivery.deliveredToOverflow,
        resolvedAt: args.now,
        updatedAt: args.now,
      });
      continue;
    }

    if (mission.missionType === "colonize") {
      if (!mission.targetPlanetId) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      const targetPlanet = await args.ctx.db.get(mission.targetPlanetId);
      if (!targetPlanet || !targetPlanet.isColonizable) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      const existing = await args.ctx.db
        .query("colonies")
        .withIndex("by_planet_id", (q) => q.eq("planetId", targetPlanet._id))
        .first();
      if (existing) {
        await args.ctx.db.patch(mission._id, {
          status: "cancelled",
          resolvedAt: args.now,
          updatedAt: args.now,
        });
        continue;
      }

      const starterBuildings = starterColonyBuildings();
      const storageCaps = storageCapsFromBuildings(starterBuildings);
      const colonyId = await args.ctx.db.insert("colonies", {
        universeId: mission.universeId,
        playerId: mission.playerId,
        planetId: targetPlanet._id,
        name: `Colony ${targetPlanet.galaxyIndex + 1}-${targetPlanet.sectorIndex + 1}-${targetPlanet.systemIndex + 1}`,
        resources: emptyResourceBucket(),
        overflow: emptyResourceBucket(),
        storageCaps,
        buildings: starterBuildings,
        usedSlots: usedSlotsFromBuildings(starterBuildings),
        lastAccruedAt: args.now,
        createdAt: args.now,
        updatedAt: args.now,
      });
      const createdColony = await args.ctx.db.get(colonyId);
      if (!createdColony) {
        throw new ConvexError("Failed to create colony");
      }

      const delivery = await applyCargoToColony({
        cargoScaled: mission.cargoRequested,
        colony: createdColony,
        ctx: args.ctx,
        now: args.now,
      });

      for (const key of ["smallCargo", "largeCargo"] as const) {
        if (mission.shipCounts[key] <= 0) {
          continue;
        }
        await incrementColonyShipCount({
          amount: mission.shipCounts[key],
          colony: createdColony,
          ctx: args.ctx,
          now: args.now,
          shipKey: key,
        });
      }

      await args.ctx.db.patch(mission._id, {
        status: "completed",
        cargoDeliveredToStorage: delivery.deliveredToStorage,
        cargoDeliveredToOverflow: delivery.deliveredToOverflow,
        resolvedAt: args.now,
        updatedAt: args.now,
      });
    }
  }
}

function missionSummaryValidator() {
  return v.object({
    id: v.id("fleetMissions"),
    missionType: fleetMissionTypeValidator,
    status: fleetMissionStatusValidator,
    originColonyId: v.id("colonies"),
    targetColonyId: v.optional(v.id("colonies")),
    targetPlanetId: v.optional(v.id("planets")),
    shipCounts: shipCountsValidator,
    cargoRequested: resourceBucketValidator,
    departAt: v.number(),
    arriveAt: v.number(),
    postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
    parentMissionId: v.optional(v.id("fleetMissions")),
  });
}

export const getFleetMissionsView = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    active: v.array(missionSummaryValidator()),
    nextEventAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const { player } = await getOwnedColony({
      colonyId: args.colonyId,
      ctx,
    });

    const active = await ctx.db
      .query("fleetMissions")
      .withIndex("by_player_status_arrive", (q) =>
        q.eq("playerId", player._id).eq("status", "inTransit"),
      )
      .collect();
    active.sort((left, right) => left.arriveAt - right.arriveAt);

    return {
      active: active.map((mission) => ({
        id: mission._id,
        missionType: mission.missionType,
        status: mission.status,
        originColonyId: mission.originColonyId,
        targetColonyId: mission.targetColonyId,
        targetPlanetId: mission.targetPlanetId,
        shipCounts: mission.shipCounts,
        cargoRequested: {
          alloy: Math.floor(mission.cargoRequested.alloy / RESOURCE_SCALE),
          crystal: Math.floor(mission.cargoRequested.crystal / RESOURCE_SCALE),
          fuel: Math.floor(mission.cargoRequested.fuel / RESOURCE_SCALE),
        },
        departAt: mission.departAt,
        arriveAt: mission.arriveAt,
        postDeliveryAction: mission.postDeliveryAction,
        parentMissionId: mission.parentMissionId,
      })),
      nextEventAt: active[0]?.arriveAt ?? undefined,
    };
  },
});

export const syncFleetMissions = mutation({
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

    const dueBefore = await ctx.db
      .query("fleetMissions")
      .withIndex("by_player_status_arrive", (q) =>
        q.eq("playerId", player._id).eq("status", "inTransit").lte("arriveAt", now),
      )
      .collect();

    await settleDueFleetMissions({
      ctx,
      now,
      playerId: player._id,
    });

    return {
      resolvedCount: dueBefore.length,
      syncedAt: now,
    };
  },
});

export const dispatchColonizationMission = mutation({
  args: {
    originColonyId: v.id("colonies"),
    targetPlanetId: v.id("planets"),
    shipCounts: shipCountsValidator,
    cargoRequested: resourceBucketValidator,
  },
  returns: v.object({
    missionId: v.id("fleetMissions"),
    departAt: v.number(),
    arriveAt: v.number(),
    distance: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedShips = normalizeShipCounts(args.shipCounts);
    const cargoRequested = normalizeMissionCargo(args.cargoRequested);

    if (normalizedShips.colonyShip !== 1) {
      throw new ConvexError("Colonization requires exactly one colony ship");
    }

    const origin = await getOwnedColony({
      colonyId: args.originColonyId,
      ctx,
    });
    await settleDueFleetMissions({
      ctx,
      now,
      playerId: origin.player._id,
    });

    const targetPlanet = await ctx.db.get(args.targetPlanetId);
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

    const locked = await ctx.db
      .query("fleetMissions")
      .withIndex("by_target_planet_status", (q) =>
        q.eq("targetPlanetId", targetPlanet._id).eq("status", "inTransit"),
      )
      .collect();
    if (locked.some((row) => row.missionType === "colonize")) {
      throw new ConvexError("Target planet already has an active colonization mission");
    }

    const ownedColonies = await ctx.db
      .query("colonies")
      .withIndex("by_player_id", (q) => q.eq("playerId", origin.player._id))
      .collect();
    const activeColonize = await ctx.db
      .query("fleetMissions")
      .withIndex("by_player_status_arrive", (q) =>
        q.eq("playerId", origin.player._id).eq("status", "inTransit"),
      )
      .collect();
    const colonizeReservations = activeColonize.filter(
      (row) => row.missionType === "colonize",
    ).length;
    if (ownedColonies.length + colonizeReservations >= MAX_COLONIES) {
      throw new ConvexError("Maximum colony limit reached");
    }

    if (missionCargoTotal(cargoRequested) > getFleetCargoCapacity(normalizedShips)) {
      throw new ConvexError("Cargo exceeds fleet cargo capacity");
    }

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

    const originCoords = await colonySystemCoords({
      colonyId: origin.colony._id,
      ctx,
    });
    const targetCoords = await planetSystemCoords({
      planetId: targetPlanet._id,
      ctx,
    });
    const distance = euclideanDistance({
      x1: originCoords.x,
      y1: originCoords.y,
      x2: targetCoords.x,
      y2: targetCoords.y,
    });
    const durationMs = durationMsForFleet({
      distance,
      shipCounts: normalizedShips,
    });
    const fuelScaled = scaledUnits(
      getFleetFuelCostForDistance({ distance, shipCounts: normalizedShips }),
    );
    const cargoScaled = resourceMapToScaledBucket(cargoRequested);
    const deduction: ResourceBucket = {
      alloy: cargoScaled.alloy,
      crystal: cargoScaled.crystal,
      fuel: cargoScaled.fuel + fuelScaled,
    };

    for (const key of RESOURCE_KEYS) {
      if (origin.colony.resources[key] < deduction[key]) {
        throw new ConvexError(`Not enough ${key} for this mission`);
      }
    }

    await ctx.db.patch(origin.colony._id, {
      resources: {
        alloy: origin.colony.resources.alloy - deduction.alloy,
        crystal: origin.colony.resources.crystal - deduction.crystal,
        fuel: origin.colony.resources.fuel - deduction.fuel,
      },
      updatedAt: now,
    });

    const missionId = await ctx.db.insert("fleetMissions", {
      universeId: origin.colony.universeId,
      playerId: origin.player._id,
      missionType: "colonize",
      status: "inTransit",
      originColonyId: origin.colony._id,
      targetColonyId: undefined,
      targetPlanetId: targetPlanet._id,
      postDeliveryAction: undefined,
      parentMissionId: undefined,
      shipCounts: normalizedShips,
      cargoRequested: cargoScaled,
      cargoDeliveredToStorage: emptyResourceBucket(),
      cargoDeliveredToOverflow: emptyResourceBucket(),
      fuelCharged: fuelScaled,
      fuelWaived: undefined,
      distance,
      departAt: now,
      arriveAt: now + durationMs,
      cancelledAt: undefined,
      resolvedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      missionId,
      departAt: now,
      arriveAt: now + durationMs,
      distance,
    };
  },
});

export const dispatchTransportMission = mutation({
  args: {
    originColonyId: v.id("colonies"),
    targetColonyId: v.id("colonies"),
    shipCounts: shipCountsValidator,
    cargoRequested: resourceBucketValidator,
    postDeliveryAction: transportPostDeliveryActionValidator,
  },
  returns: v.object({
    missionId: v.id("fleetMissions"),
    departAt: v.number(),
    arriveAt: v.number(),
    distance: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedShips = normalizeShipCounts(args.shipCounts);
    const cargoRequested = normalizeMissionCargo(args.cargoRequested);

    if (normalizedShips.colonyShip > 0) {
      throw new ConvexError("Transport missions cannot include colony ships");
    }
    if (missionCargoTotal(cargoRequested) > getFleetCargoCapacity(normalizedShips)) {
      throw new ConvexError("Cargo exceeds fleet cargo capacity");
    }

    const origin = await getOwnedColony({
      colonyId: args.originColonyId,
      ctx,
    });
    const destination = await getOwnedColony({
      colonyId: args.targetColonyId,
      ctx,
    });
    if (origin.player._id !== destination.player._id) {
      throw new ConvexError("Transport destination must be owned by current player");
    }

    await settleDueFleetMissions({
      ctx,
      now,
      playerId: origin.player._id,
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

    const originCoords = await colonySystemCoords({
      colonyId: origin.colony._id,
      ctx,
    });
    const destinationCoords = await colonySystemCoords({
      colonyId: destination.colony._id,
      ctx,
    });
    const distance = euclideanDistance({
      x1: originCoords.x,
      y1: originCoords.y,
      x2: destinationCoords.x,
      y2: destinationCoords.y,
    });
    const durationMs = durationMsForFleet({
      distance,
      shipCounts: normalizedShips,
    });
    const oneWayFuelScaled = scaledUnits(
      getFleetFuelCostForDistance({ distance, shipCounts: normalizedShips }),
    );
    const fuelScaled =
      args.postDeliveryAction === "returnToOrigin"
        ? oneWayFuelScaled * 2
        : oneWayFuelScaled;
    const cargoScaled = resourceMapToScaledBucket(cargoRequested);
    const deduction: ResourceBucket = {
      alloy: cargoScaled.alloy,
      crystal: cargoScaled.crystal,
      fuel: cargoScaled.fuel + fuelScaled,
    };
    for (const key of RESOURCE_KEYS) {
      if (origin.colony.resources[key] < deduction[key]) {
        throw new ConvexError(`Not enough ${key} for this mission`);
      }
    }

    await ctx.db.patch(origin.colony._id, {
      resources: {
        alloy: origin.colony.resources.alloy - deduction.alloy,
        crystal: origin.colony.resources.crystal - deduction.crystal,
        fuel: origin.colony.resources.fuel - deduction.fuel,
      },
      updatedAt: now,
    });

    const missionId = await ctx.db.insert("fleetMissions", {
      universeId: origin.colony.universeId,
      playerId: origin.player._id,
      missionType: "transport",
      status: "inTransit",
      originColonyId: origin.colony._id,
      targetColonyId: destination.colony._id,
      targetPlanetId: undefined,
      postDeliveryAction: args.postDeliveryAction,
      parentMissionId: undefined,
      shipCounts: normalizedShips,
      cargoRequested: cargoScaled,
      cargoDeliveredToStorage: emptyResourceBucket(),
      cargoDeliveredToOverflow: emptyResourceBucket(),
      fuelCharged: fuelScaled,
      fuelWaived: undefined,
      distance,
      departAt: now,
      arriveAt: now + durationMs,
      cancelledAt: undefined,
      resolvedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      missionId,
      departAt: now,
      arriveAt: now + durationMs,
      distance,
    };
  },
});

export const cancelFleetMission = mutation({
  args: {
    missionId: v.id("fleetMissions"),
  },
  returns: v.object({
    cancelledMissionId: v.id("fleetMissions"),
    returnMissionId: v.id("fleetMissions"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const player = await resolveCurrentPlayer(ctx);
    if (!player) {
      throw new ConvexError("Authentication required");
    }

    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.playerId !== player._id) {
      throw new ConvexError("Mission not found");
    }
    if (mission.status !== "inTransit") {
      throw new ConvexError("Mission cannot be cancelled");
    }
    if (mission.missionType === "return") {
      throw new ConvexError("Return missions cannot be cancelled");
    }
    if (now >= mission.arriveAt) {
      throw new ConvexError("Mission has already arrived");
    }

    const totalDuration = Math.max(1, mission.arriveAt - mission.departAt);
    const elapsed = Math.max(0, Math.min(totalDuration, now - mission.departAt));
    const elapsedRatio = elapsed / totalDuration;
    const returnDistance = Math.max(1, mission.distance * elapsedRatio);
    const returnDurationMs = Math.max(30_000, elapsed);

    let additionalFuelCharged = 0;
    let fuelWaived = 0;
    if (!(mission.missionType === "transport" && mission.postDeliveryAction === "returnToOrigin")) {
      const extraFuelScaled = scaledUnits(
        getFleetFuelCostForDistance({
          distance: returnDistance,
          shipCounts: mission.shipCounts,
        }),
      );
      const origin = await ctx.db.get(mission.originColonyId);
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

    await ctx.db.patch(mission._id, {
      status: "cancelled",
      cancelledAt: now,
      resolvedAt: now,
      updatedAt: now,
    });

    const returnMissionId = await ctx.db.insert("fleetMissions", {
      universeId: mission.universeId,
      playerId: mission.playerId,
      missionType: "return",
      status: "inTransit",
      originColonyId: mission.originColonyId,
      targetColonyId: mission.originColonyId,
      targetPlanetId: undefined,
      postDeliveryAction: undefined,
      parentMissionId: mission._id,
      shipCounts: mission.shipCounts,
      cargoRequested: mission.cargoRequested,
      cargoDeliveredToStorage: emptyResourceBucket(),
      cargoDeliveredToOverflow: emptyResourceBucket(),
      fuelCharged: additionalFuelCharged,
      fuelWaived: fuelWaived > 0 ? fuelWaived : undefined,
      distance: returnDistance,
      departAt: now,
      arriveAt: now + returnDurationMs,
      cancelledAt: undefined,
      resolvedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      cancelledMissionId: mission._id,
      returnMissionId,
    };
  },
});
