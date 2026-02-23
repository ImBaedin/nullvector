import {
  DEFAULT_GENERATOR_REGISTRY,
  getGeneratorProductionPerMinute,
  getUpgradeCost,
  getUpgradeDurationSeconds,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { RESOURCE_SCALE } from "./schema";
import { DEFAULT_UNIVERSE_SLUG } from "./lib/worldgen/config";
import { ensureCoreCapacityPipeline } from "./lib/worldgen/pipeline";

type ResourceBucket = {
  alloy: number;
  crystal: number;
  fuel: number;
};

type BuildingKey =
  | "alloyMineLevel"
  | "crystalMineLevel"
  | "fuelRefineryLevel"
  | "powerPlantLevel";

type QueueLane = "building" | "shipyard" | "research";
type QueueItemStatus = "queued" | "active" | "completed" | "cancelled" | "failed";
type QueueItemKind = "buildingUpgrade";

type ColonyWithRelations = {
  colony: Doc<"colonies">;
  planet: Doc<"planets">;
  player: Doc<"players">;
};

const RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const;
const ALL_BUILDING_KEYS = [
  "alloyMineLevel",
  "crystalMineLevel",
  "fuelRefineryLevel",
  "powerPlantLevel",
  "alloyStorageLevel",
  "crystalStorageLevel",
  "fuelStorageLevel",
  "shipyardLevel",
] as const;

const UPGRADE_BUILDING_KEYS = [
  "alloyMineLevel",
  "crystalMineLevel",
  "fuelRefineryLevel",
  "powerPlantLevel",
] as const satisfies readonly BuildingKey[];

const OPEN_QUEUE_STATUSES: ReadonlyArray<QueueItemStatus> = ["active", "queued"];
const BUILDING_LANE_CAPACITY = 2;
const LANE_QUEUE_CAPACITY: Record<QueueLane, number> = {
  building: BUILDING_LANE_CAPACITY,
  shipyard: 2,
  research: 2,
};

const ENERGY_BASE_CONSUMPTION: Record<Exclude<BuildingKey, "powerPlantLevel">, number> = {
  alloyMineLevel: 10,
  crystalMineLevel: 10,
  fuelRefineryLevel: 20,
};

const resourceBucketValidator = v.object({
  alloy: v.number(),
  crystal: v.number(),
  fuel: v.number(),
});

const buildingKeyValidator = v.union(
  v.literal("alloyMineLevel"),
  v.literal("crystalMineLevel"),
  v.literal("fuelRefineryLevel"),
  v.literal("powerPlantLevel")
);

const queueLaneValidator = v.union(
  v.literal("building"),
  v.literal("shipyard"),
  v.literal("research")
);

const queueItemStatusValidator = v.union(
  v.literal("queued"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed")
);

const queueItemKindValidator = v.literal("buildingUpgrade");

const queuePayloadValidator = v.object({
  buildingKey: buildingKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
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

function storedToWholeUnits(storedAmount: number) {
  return Math.max(0, Math.floor(storedAmount / RESOURCE_SCALE));
}

function formatResourceValue(units: number) {
  if (units >= 1_000_000) {
    return `${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 1_000) {
    return `${(units / 1_000).toFixed(1)}k`;
  }
  return units.toString();
}

function getGeneratorOrThrow(generatorId: string) {
  const generator = DEFAULT_GENERATOR_REGISTRY.get(generatorId);
  if (!generator) {
    throw new ConvexError(`Missing generator config: ${generatorId}`);
  }
  return generator;
}

const BUILDING_CONFIG: Record<
  BuildingKey,
  {
    generatorId: string;
    name: string;
    group: "Production" | "Power";
    resource: "alloy" | "crystal" | "fuel" | "energy";
    planetMultiplierKey?: "alloyMultiplier" | "crystalMultiplier" | "fuelMultiplier";
  }
> = {
  alloyMineLevel: {
    generatorId: "alloy_mine",
    name: "Alloy Mine",
    group: "Production",
    resource: "alloy",
    planetMultiplierKey: "alloyMultiplier",
  },
  crystalMineLevel: {
    generatorId: "crystal_mine",
    name: "Crystal Mine",
    group: "Production",
    resource: "crystal",
    planetMultiplierKey: "crystalMultiplier",
  },
  fuelRefineryLevel: {
    generatorId: "deuterium_extractor",
    name: "Fuel Refinery",
    group: "Production",
    resource: "fuel",
    planetMultiplierKey: "fuelMultiplier",
  },
  powerPlantLevel: {
    generatorId: "solar_plant",
    name: "Power Plant",
    group: "Power",
    resource: "energy",
  },
};

function storageCapForLevel(level: number) {
  if (level <= 0) {
    return 0;
  }
  const base = 10_000;
  return Math.round(base * Math.pow(1.7, level - 1));
}

function storageCapsFromBuildings(buildings: Doc<"colonies">["buildings"]): ResourceBucket {
  return {
    alloy: scaledUnits(storageCapForLevel(buildings.alloyStorageLevel)),
    crystal: scaledUnits(storageCapForLevel(buildings.crystalStorageLevel)),
    fuel: scaledUnits(storageCapForLevel(buildings.fuelStorageLevel)),
  };
}

function usedSlotsFromBuildings(buildings: Doc<"colonies">["buildings"]) {
  let used = 0;
  for (const key of ALL_BUILDING_KEYS) {
    if (buildings[key] > 0) {
      used += 1;
    }
  }
  return used;
}

function toAddressLabel(planet: Doc<"planets">) {
  return `G${planet.galaxyIndex}:S${planet.sectorIndex}:SYS${planet.systemIndex}:P${planet.planetIndex}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolvedAuthUserId(authUser: {
  userId?: string | null;
  id?: string | null;
  _id?: string | null;
}) {
  return authUser.userId ?? authUser.id ?? authUser._id ?? null;
}

function resolveDisplayName(authUser: {
  name?: string | null;
  email?: string | null;
}) {
  return authUser.name ?? authUser.email ?? "Pilot";
}

function energyConsumptionForLevel(
  buildingKey: Exclude<BuildingKey, "powerPlantLevel">,
  level: number
) {
  if (level <= 0) {
    return 0;
  }

  const base = ENERGY_BASE_CONSUMPTION[buildingKey];
  return Math.round(base * Math.pow(1.12, level - 1));
}

function productionRatesPerMinute(args: {
  buildings: Doc<"colonies">["buildings"];
  overflow: ResourceBucket;
  planet: Doc<"planets">;
}) {
  const { buildings, overflow, planet } = args;

  const alloyGenerator = getGeneratorOrThrow(BUILDING_CONFIG.alloyMineLevel.generatorId);
  const crystalGenerator = getGeneratorOrThrow(BUILDING_CONFIG.crystalMineLevel.generatorId);
  const fuelGenerator = getGeneratorOrThrow(BUILDING_CONFIG.fuelRefineryLevel.generatorId);
  const powerGenerator = getGeneratorOrThrow(BUILDING_CONFIG.powerPlantLevel.generatorId);

  const rawAlloyRate =
    getGeneratorProductionPerMinute(alloyGenerator, buildings.alloyMineLevel) *
    planet.alloyMultiplier;
  const rawCrystalRate =
    getGeneratorProductionPerMinute(crystalGenerator, buildings.crystalMineLevel) *
    planet.crystalMultiplier;
  const rawFuelRate =
    getGeneratorProductionPerMinute(fuelGenerator, buildings.fuelRefineryLevel) *
    planet.fuelMultiplier;

  const energyProduced = getGeneratorProductionPerMinute(
    powerGenerator,
    buildings.powerPlantLevel
  );
  const energyConsumed =
    energyConsumptionForLevel("alloyMineLevel", buildings.alloyMineLevel) +
    energyConsumptionForLevel("crystalMineLevel", buildings.crystalMineLevel) +
    energyConsumptionForLevel("fuelRefineryLevel", buildings.fuelRefineryLevel);

  const energyRatio =
    energyConsumed <= 0 ? 1 : Math.max(0, Math.min(1, energyProduced / energyConsumed));

  const alloyRate = overflow.alloy > 0 ? 0 : rawAlloyRate * energyRatio;
  const crystalRate = overflow.crystal > 0 ? 0 : rawCrystalRate * energyRatio;
  const fuelRate = overflow.fuel > 0 ? 0 : rawFuelRate * energyRatio;

  return {
    resources: {
      alloy: alloyRate,
      crystal: crystalRate,
      fuel: fuelRate,
    },
    energyProduced,
    energyConsumed,
    energyRatio,
  };
}

function applyAccrualSegment(args: {
  colony: Doc<"colonies">;
  planet: Doc<"planets">;
  segmentEndMs: number;
  resources: ResourceBucket;
}) {
  const { colony, planet, segmentEndMs, resources } = args;

  if (segmentEndMs <= colony.lastAccruedAt) {
    return {
      lastAccruedAt: colony.lastAccruedAt,
      resources,
    };
  }

  const minutesElapsed = (segmentEndMs - colony.lastAccruedAt) / 60_000;
  const rates = productionRatesPerMinute({
    buildings: colony.buildings,
    overflow: colony.overflow,
    planet,
  });

  const nextResources = cloneResourceBucket(resources);

  for (const key of RESOURCE_KEYS) {
    const generatedScaled = Math.floor(rates.resources[key] * minutesElapsed * RESOURCE_SCALE);
    const cappedValue = Math.min(
      colony.storageCaps[key],
      Math.max(0, nextResources[key] + generatedScaled)
    );
    nextResources[key] = cappedValue;
  }

  return {
    lastAccruedAt: segmentEndMs,
    resources: nextResources,
  };
}

function resourceMapToScaledBucket(resourceMap: Partial<Record<string, number>>): ResourceBucket {
  return {
    alloy: scaledUnits(resourceMap.alloy ?? 0),
    crystal: scaledUnits(resourceMap.crystal ?? 0),
    fuel: scaledUnits(resourceMap.fuel ?? 0),
  };
}

function resourceMapToWholeUnitBucket(resourceMap: Partial<Record<string, number>>): ResourceBucket {
  return {
    alloy: Math.max(0, Math.round(resourceMap.alloy ?? 0)),
    crystal: Math.max(0, Math.round(resourceMap.crystal ?? 0)),
    fuel: Math.max(0, Math.round(resourceMap.fuel ?? 0)),
  };
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

  if (players.length === 0) {
    return {
      authUser: {
        ...authUser,
        resolvedUserId: authUserId,
      },
      player: null,
    };
  }

  players.sort((left, right) => left._creationTime - right._creationTime);

  return {
    authUser: {
      ...authUser,
      resolvedUserId: authUserId,
    },
    player: players[0],
  };
}

async function resolveUniverse(ctx: QueryCtx | MutationCtx) {
  const active = await ctx.db
    .query("universes")
    .withIndex("by_is_active", (q) => q.eq("isActive", true))
    .unique();

  if (active) {
    return active;
  }

  return await ctx.db
    .query("universes")
    .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_UNIVERSE_SLUG))
    .unique();
}

async function getOwnedColony(args: {
  ctx: QueryCtx | MutationCtx;
  colonyId: Id<"colonies">;
}): Promise<ColonyWithRelations> {
  const { ctx, colonyId } = args;
  const playerResult = await resolveCurrentPlayer(ctx);
  if (!playerResult?.authUser || !playerResult.player) {
    throw new ConvexError("Authentication required");
  }

  const colony = await ctx.db.get(colonyId);
  if (!colony) {
    throw new ConvexError("Colony not found");
  }

  if (colony.playerId !== playerResult.player._id) {
    throw new ConvexError("Colony access denied");
  }

  const planet = await ctx.db.get(colony.planetId);
  if (!planet) {
    throw new ConvexError("Planet not found for colony");
  }

  return {
    colony,
    planet,
    player: playerResult.player,
  };
}

function compareQueueOrder(left: Doc<"colonyQueueItems">, right: Doc<"colonyQueueItems">) {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  if (left.queuedAt !== right.queuedAt) {
    return left.queuedAt - right.queuedAt;
  }
  return left._creationTime - right._creationTime;
}

async function listOpenLaneQueueItems(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
  lane: QueueLane;
}) {
  const rows = await args.ctx.db
    .query("colonyQueueItems")
    .withIndex("by_col_lane_ord", (q) => q.eq("colonyId", args.colonyId).eq("lane", args.lane))
    .collect();

  return rows
    .filter((row) => OPEN_QUEUE_STATUSES.includes(row.status))
    .sort(compareQueueOrder);
}

function queueItemFromToLevel(item: Doc<"colonyQueueItems">) {
  return {
    fromLevel: item.payload.fromLevel,
    toLevel: item.payload.toLevel,
  };
}

async function settleColonyAndPersist(args: {
  ctx: MutationCtx;
  colony: Doc<"colonies">;
  planet: Doc<"planets">;
  now: number;
}) {
  const { ctx, colony, planet, now } = args;

  let workingColony = {
    ...colony,
    resources: cloneResourceBucket(colony.resources),
    buildings: { ...colony.buildings },
    storageCaps: cloneResourceBucket(colony.storageCaps),
    overflow: cloneResourceBucket(colony.overflow),
  };
  const queueRows = await listOpenLaneQueueItems({
    colonyId: colony._id,
    ctx,
    lane: "building",
  });

  const queuePatchById = new Map<Id<"colonyQueueItems">, Partial<Doc<"colonyQueueItems">>>();
  let activeQueue = queueRows.find((row) => row.status === "active") ?? null;
  const queued = queueRows.filter((row) => row.status === "queued");

  const markPatch = (
    queueId: Id<"colonyQueueItems">,
    patch: Partial<Doc<"colonyQueueItems">>
  ) => {
    const existing = queuePatchById.get(queueId) ?? {};
    queuePatchById.set(queueId, { ...existing, ...patch });
  };

  if (!activeQueue && queued.length > 0) {
    activeQueue = queued.shift() ?? null;
    if (activeQueue) {
      markPatch(activeQueue._id, {
        status: "active",
        updatedAt: now,
      });
    }
  }

  const accrueTo = (segmentEndMs: number) => {
    const accrued = applyAccrualSegment({
      colony: workingColony,
      planet,
      segmentEndMs,
      resources: workingColony.resources,
    });

    workingColony.resources = accrued.resources;
    workingColony.lastAccruedAt = accrued.lastAccruedAt;
  };

  while (activeQueue) {
    if (activeQueue.startsAt > workingColony.lastAccruedAt) {
      const waitSegmentEnd = Math.min(now, activeQueue.startsAt);
      accrueTo(waitSegmentEnd);
      if (workingColony.lastAccruedAt >= now) {
        break;
      }
    }

    const activeSegmentEnd = Math.min(now, activeQueue.completesAt);
    accrueTo(activeSegmentEnd);
    if (activeSegmentEnd < activeQueue.completesAt) {
      break;
    }

    const { toLevel } = queueItemFromToLevel(activeQueue);
    const buildingKey = activeQueue.payload.buildingKey;
    workingColony.buildings[buildingKey] = Math.max(toLevel, workingColony.buildings[buildingKey]);
    workingColony.storageCaps = storageCapsFromBuildings(workingColony.buildings);

    markPatch(activeQueue._id, {
      resolvedAt: activeQueue.completesAt,
      status: "completed",
      updatedAt: now,
    });

    activeQueue = queued.shift() ?? null;
    if (!activeQueue) {
      break;
    }

    markPatch(activeQueue._id, {
      status: "active",
      updatedAt: now,
    });
  }

  if (!activeQueue && workingColony.lastAccruedAt < now) {
    accrueTo(now);
  }

  await ctx.db.patch(colony._id, {
    resources: workingColony.resources,
    buildings: workingColony.buildings,
    storageCaps: workingColony.storageCaps,
    usedSlots: usedSlotsFromBuildings(workingColony.buildings),
    activeUpgrade: undefined,
    lastAccruedAt: workingColony.lastAccruedAt,
    updatedAt: now,
  });

  for (const [queueId, patch] of queuePatchById.entries()) {
    await ctx.db.patch(queueId, patch);
  }

  return workingColony;
}

async function listPlayerColonies(args: { ctx: QueryCtx | MutationCtx; playerId: Id<"players"> }) {
  const { ctx, playerId } = args;
  const colonies = await ctx.db
    .query("colonies")
    .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
    .collect();

  colonies.sort((left, right) => left.createdAt - right.createdAt);
  return colonies;
}

async function listColonyQueueItems(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  return await args.ctx.db
    .query("colonyQueueItems")
    .withIndex("by_col_lane_ord", (q) => q.eq("colonyId", args.colonyId))
    .collect();
}

function sessionStateValidator() {
  return v.object({
    isAuthenticated: v.boolean(),
    playerId: v.optional(v.id("players")),
    defaultColonyId: v.optional(v.id("colonies")),
    colonyIds: v.array(v.id("colonies")),
  });
}

export const getSessionState = query({
  args: {},
  returns: sessionStateValidator(),
  handler: async (ctx) => {
    const playerResult = await resolveCurrentPlayer(ctx);
    if (!playerResult?.authUser) {
      return {
        isAuthenticated: false,
        colonyIds: [],
      };
    }

    if (!playerResult.player) {
      return {
        isAuthenticated: true,
        colonyIds: [],
      };
    }

    const colonies = await listPlayerColonies({
      ctx,
      playerId: playerResult.player._id,
    });

    return {
      isAuthenticated: true,
      playerId: playerResult.player._id,
      defaultColonyId: colonies[0]?._id,
      colonyIds: colonies.map((colony) => colony._id),
    };
  },
});

const bootstrapResponseValidator = v.object({
  playerId: v.id("players"),
  defaultColonyId: v.id("colonies"),
  isNewPlayer: v.boolean(),
  isNewColony: v.boolean(),
});

async function ensureSessionForAuthenticatedUser(ctx: MutationCtx) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    throw new ConvexError("Authentication required");
  }
  const authUserId = resolvedAuthUserId(authUser);
  if (!authUserId) {
    throw new ConvexError("Authenticated user is missing an id");
  }
  const displayName = resolveDisplayName(authUser);

  const now = Date.now();

  const existingPlayers = await ctx.db
    .query("players")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .collect();

  existingPlayers.sort((left, right) => left._creationTime - right._creationTime);

  let player: Doc<"players"> | null = existingPlayers[0] ?? null;
  let isNewPlayer = false;

  if (!player) {
    const playerId = await ctx.db.insert("players", {
      authUserId,
      displayName,
      createdAt: now,
      lastSeenAt: now,
    });
    const createdPlayer = await ctx.db.get(playerId);
    if (!createdPlayer) {
      throw new ConvexError("Failed to create player profile");
    }
    player = createdPlayer;
    isNewPlayer = true;
  } else {
    await ctx.db.patch(player._id, {
      displayName,
      lastSeenAt: now,
    });
  }

  const existingColonies = await listPlayerColonies({
    ctx,
    playerId: player._id,
  });

  if (existingColonies.length > 0) {
    return {
      playerId: player._id,
      defaultColonyId: existingColonies[0]._id,
      isNewPlayer,
      isNewColony: false,
    };
  }

  let universe = await resolveUniverse(ctx);

  if (!universe) {
    await ensureCoreCapacityPipeline(ctx, {
      universeSlug: DEFAULT_UNIVERSE_SLUG,
      dryRun: false,
      overrides: {},
    });
    universe = await resolveUniverse(ctx);
  }

  if (!universe) {
    throw new ConvexError("No active universe available for colony assignment");
  }

  const planets = await ctx.db
    .query("planets")
    .withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
      q.eq("universeId", universe._id)
    )
    .collect();

  const coloniesInUniverse = await ctx.db
    .query("colonies")
    .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
    .collect();

  const claimedPlanetIds = new Set(coloniesInUniverse.map((colony) => colony.planetId));
  let unclaimedColonizablePlanets = planets
    .filter((planet) => planet.isColonizable)
    .filter((planet) => !claimedPlanetIds.has(planet._id));

  if (unclaimedColonizablePlanets.length === 0) {
    await ensureCoreCapacityPipeline(ctx, {
      universeSlug: universe.slug,
      dryRun: false,
      overrides: {
        minUnclaimedColonizablePlanets: 24,
        maxSectorsPerRun: 6,
      },
    });

    const refreshedPlanets = await ctx.db
      .query("planets")
      .withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
        q.eq("universeId", universe._id)
      )
      .collect();

    const refreshedColonies = await ctx.db
      .query("colonies")
      .withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
      .collect();

    const refreshedClaimedPlanetIds = new Set(
      refreshedColonies.map((colony) => colony.planetId)
    );
    unclaimedColonizablePlanets = refreshedPlanets
      .filter((planet) => planet.isColonizable)
      .filter((planet) => !refreshedClaimedPlanetIds.has(planet._id));
  }

  if (unclaimedColonizablePlanets.length === 0) {
    throw new ConvexError("No colonizable planets are currently available");
  }

  unclaimedColonizablePlanets.sort((left, right) => {
    if (left.galaxyIndex !== right.galaxyIndex) {
      return left.galaxyIndex - right.galaxyIndex;
    }
    if (left.sectorIndex !== right.sectorIndex) {
      return left.sectorIndex - right.sectorIndex;
    }
    if (left.systemIndex !== right.systemIndex) {
      return left.systemIndex - right.systemIndex;
    }
    return left.planetIndex - right.planetIndex;
  });

  const selectionSeed = `${authUserId}:${player._id}:${now}`;
  const selectedIndex = hashString(selectionSeed) % unclaimedColonizablePlanets.length;
  const selectedPlanet = unclaimedColonizablePlanets[selectedIndex];

  const starterBuildings = {
    alloyMineLevel: 1,
    crystalMineLevel: 1,
    fuelRefineryLevel: 1,
    powerPlantLevel: 1,
    alloyStorageLevel: 1,
    crystalStorageLevel: 1,
    fuelStorageLevel: 1,
    shipyardLevel: 0,
  } satisfies Doc<"colonies">["buildings"];

  const storageCaps = storageCapsFromBuildings(starterBuildings);
  const resources: ResourceBucket = {
    alloy: Math.min(storageCaps.alloy, scaledUnits(5_000)),
    crystal: Math.min(storageCaps.crystal, scaledUnits(3_000)),
    fuel: Math.min(storageCaps.fuel, scaledUnits(1_000)),
  };

  const colonyId = await ctx.db.insert("colonies", {
    universeId: universe._id,
    playerId: player._id,
    planetId: selectedPlanet._id,
    name: `Colony ${selectedPlanet.galaxyIndex + 1}-${selectedPlanet.sectorIndex + 1}-${selectedPlanet.systemIndex + 1}`,
    resources,
    overflow: emptyResourceBucket(),
    storageCaps,
    buildings: starterBuildings,
    usedSlots: usedSlotsFromBuildings(starterBuildings),
    lastAccruedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    playerId: player._id,
    defaultColonyId: colonyId,
    isNewPlayer,
    isNewColony: true,
  };
}

export const ensureSession = mutation({
  args: {},
  returns: bootstrapResponseValidator,
  handler: async (ctx) => {
    return await ensureSessionForAuthenticatedUser(ctx);
  },
});

export const bootstrapSession = mutation({
  args: {},
  returns: bootstrapResponseValidator,
  handler: async (ctx) => {
    return await ensureSessionForAuthenticatedUser(ctx);
  },
});

const queueViewItemValidator = v.object({
  id: v.id("colonyQueueItems"),
  lane: queueLaneValidator,
  kind: queueItemKindValidator,
  status: queueItemStatusValidator,
  order: v.number(),
  queuedAt: v.number(),
  startsAt: v.number(),
  completesAt: v.number(),
  remainingMs: v.number(),
  isComplete: v.boolean(),
  cost: resourceBucketValidator,
  payload: queuePayloadValidator,
});

const laneQueueViewValidator = v.object({
  lane: queueLaneValidator,
  maxItems: v.number(),
  totalItems: v.number(),
  isFull: v.boolean(),
  activeItem: v.optional(queueViewItemValidator),
  pendingItems: v.array(queueViewItemValidator),
});

const queuesViewValidator = v.object({
  nextEventAt: v.optional(v.number()),
  lanes: v.object({
    building: laneQueueViewValidator,
    shipyard: laneQueueViewValidator,
    research: laneQueueViewValidator,
  }),
});

function toQueueViewItem(args: { item: Doc<"colonyQueueItems">; now: number }) {
  const { item, now } = args;
  const remainingMs = Math.max(0, item.completesAt - now);

  return {
    id: item._id,
    lane: item.lane,
    kind: item.kind,
    status: item.status,
    order: item.order,
    queuedAt: item.queuedAt,
    startsAt: item.startsAt,
    completesAt: item.completesAt,
    remainingMs,
    isComplete: remainingMs === 0,
    cost: {
      alloy: storedToWholeUnits(item.cost.alloy),
      crystal: storedToWholeUnits(item.cost.crystal),
      fuel: storedToWholeUnits(item.cost.fuel),
    },
    payload: item.payload,
  };
}

function queueEventsNextAt(rows: Array<Doc<"colonyQueueItems">>) {
  let nextAt: number | null = null;
  for (const row of rows) {
    if (!OPEN_QUEUE_STATUSES.includes(row.status)) {
      continue;
    }
    nextAt = nextAt === null ? row.completesAt : Math.min(nextAt, row.completesAt);
  }

  return nextAt;
}

function emptyLaneQueueView(lane: QueueLane) {
  return {
    lane,
    maxItems: LANE_QUEUE_CAPACITY[lane],
    totalItems: 0,
    isFull: false,
    activeItem: undefined,
    pendingItems: [],
  };
}

function buildLaneQueueView(args: {
  lane: QueueLane;
  now: number;
  rows: Array<Doc<"colonyQueueItems">>;
}) {
  const open = args.rows
    .filter((row) => row.lane === args.lane && OPEN_QUEUE_STATUSES.includes(row.status))
    .sort(compareQueueOrder);

  const active = open.find((row) => row.status === "active");
  const pending = open.filter((row) => row.status === "queued");
  const totalItems = open.length;

  return {
    lane: args.lane,
    maxItems: LANE_QUEUE_CAPACITY[args.lane],
    totalItems,
    isFull: totalItems >= LANE_QUEUE_CAPACITY[args.lane],
    activeItem: active ? toQueueViewItem({ item: active, now: args.now }) : undefined,
    pendingItems: pending.map((item) => toQueueViewItem({ item, now: args.now })),
  };
}

const sessionColonyValidator = v.object({
  id: v.id("colonies"),
  name: v.string(),
  addressLabel: v.string(),
  status: v.string(),
});

const resourceHudDatumValidator = v.object({
  key: v.union(v.literal("alloy"), v.literal("crystal"), v.literal("fuel"), v.literal("energy")),
  value: v.string(),
  valueAmount: v.optional(v.number()),
  deltaPerMinute: v.optional(v.string()),
  deltaPerMinuteAmount: v.optional(v.number()),
  storageCurrentAmount: v.optional(v.number()),
  storageCurrentLabel: v.optional(v.string()),
  storageCapAmount: v.optional(v.number()),
  storageCapLabel: v.optional(v.string()),
  storagePercent: v.optional(v.number()),
  energyBalance: v.optional(v.number()),
});

export const getColonyHud = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    activeColonyId: v.id("colonies"),
    title: v.string(),
    colonies: v.array(sessionColonyValidator),
    resources: v.array(resourceHudDatumValidator),
    queues: queuesViewValidator,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { colony, planet, player } = await getOwnedColony({
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

    const planetsById = new Map<Id<"planets">, Doc<"planets">>();
    const colonyStatusById = new Map<Id<"colonies">, string>();

    await Promise.all(
      playerColonies.map(async (entry) => {
        if (planetsById.has(entry.planetId)) {
          return;
        }
        const colonyPlanet = await ctx.db.get(entry.planetId);
        if (colonyPlanet) {
          planetsById.set(colonyPlanet._id, colonyPlanet);
        }
      })
    );
    await Promise.all(
      playerColonies.map(async (entry) => {
        const queueRows = await listOpenLaneQueueItems({
          colonyId: entry._id,
          ctx,
          lane: "building",
        });
        const hasActive = queueRows.some((row) => row.status === "active");
        const hasPending = queueRows.some((row) => row.status === "queued");
        colonyStatusById.set(entry._id, hasActive ? "Upgrading" : hasPending ? "Queued" : "Stable");
      })
    );

    const buildingLane = buildLaneQueueView({
      lane: "building",
      now,
      rows: colonyQueueRows,
    });
    const shipyardLane = emptyLaneQueueView("shipyard");
    const researchLane = emptyLaneQueueView("research");

    const rates = productionRatesPerMinute({
      buildings: colony.buildings,
      overflow: colony.overflow,
      planet,
    });

    const alloyUnits = storedToWholeUnits(colony.resources.alloy);
    const crystalUnits = storedToWholeUnits(colony.resources.crystal);
    const fuelUnits = storedToWholeUnits(colony.resources.fuel);

    const alloyCap = storedToWholeUnits(colony.storageCaps.alloy);
    const crystalCap = storedToWholeUnits(colony.storageCaps.crystal);
    const fuelCap = storedToWholeUnits(colony.storageCaps.fuel);

    const resources = [
      {
        key: "alloy" as const,
        value: formatResourceValue(alloyUnits),
        valueAmount: alloyUnits,
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.alloy)).toLocaleString()}/m`,
        deltaPerMinuteAmount: Math.max(0, Math.floor(rates.resources.alloy)),
        storageCurrentAmount: alloyUnits,
        storageCurrentLabel: formatResourceValue(alloyUnits),
        storageCapAmount: alloyCap,
        storageCapLabel: formatResourceValue(alloyCap),
        storagePercent: alloyCap <= 0 ? 0 : Math.min(100, (alloyUnits / alloyCap) * 100),
      },
      {
        key: "crystal" as const,
        value: formatResourceValue(crystalUnits),
        valueAmount: crystalUnits,
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.crystal)).toLocaleString()}/m`,
        deltaPerMinuteAmount: Math.max(0, Math.floor(rates.resources.crystal)),
        storageCurrentAmount: crystalUnits,
        storageCurrentLabel: formatResourceValue(crystalUnits),
        storageCapAmount: crystalCap,
        storageCapLabel: formatResourceValue(crystalCap),
        storagePercent:
          crystalCap <= 0 ? 0 : Math.min(100, (crystalUnits / crystalCap) * 100),
      },
      {
        key: "fuel" as const,
        value: formatResourceValue(fuelUnits),
        valueAmount: fuelUnits,
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.fuel)).toLocaleString()}/m`,
        deltaPerMinuteAmount: Math.max(0, Math.floor(rates.resources.fuel)),
        storageCurrentAmount: fuelUnits,
        storageCurrentLabel: formatResourceValue(fuelUnits),
        storageCapAmount: fuelCap,
        storageCapLabel: formatResourceValue(fuelCap),
        storagePercent: fuelCap <= 0 ? 0 : Math.min(100, (fuelUnits / fuelCap) * 100),
      },
      {
        key: "energy" as const,
        value: `${Math.round(rates.energyRatio * 100)}%`,
        energyBalance: Math.round(rates.energyProduced - rates.energyConsumed),
      },
    ];

    return {
      activeColonyId: colony._id,
      title: `${colony.name} Resources`,
      colonies: playerColonies.map((entry) => {
        const colonyPlanet = planetsById.get(entry.planetId);
        return {
          id: entry._id,
          name: entry.name,
          addressLabel: colonyPlanet ? toAddressLabel(colonyPlanet) : "Unknown",
          status: colonyStatusById.get(entry._id) ?? "Stable",
        };
      }),
      resources,
      queues: {
        nextEventAt: queueEventsNextAt(colonyQueueRows) ?? undefined,
        lanes: {
          building: buildingLane,
          shipyard: shipyardLane,
          research: researchLane,
        },
      },
    };
  },
});

const levelTableRowValidator = v.object({
  level: v.number(),
  outputPerMinute: v.number(),
  energyUsePerMinute: v.number(),
  deltaOutputPerMinute: v.number(),
  deltaEnergyPerMinute: v.number(),
  cost: resourceBucketValidator,
  durationSeconds: v.number(),
});

const buildingCardValidator = v.object({
  key: buildingKeyValidator,
  name: v.string(),
  group: v.union(v.literal("Production"), v.literal("Power")),
  currentLevel: v.number(),
  maxLevel: v.number(),
  isUpgrading: v.boolean(),
  isQueued: v.boolean(),
  status: v.union(
    v.literal("Running"),
    v.literal("Overflow"),
    v.literal("Paused"),
    v.literal("Upgrading"),
    v.literal("Queued")
  ),
  outputPerMinute: v.number(),
  outputLabel: v.string(),
  energyUsePerMinute: v.number(),
  canUpgrade: v.boolean(),
  nextUpgradeDurationSeconds: v.optional(v.number()),
  nextUpgradeCost: resourceBucketValidator,
  levelTable: v.array(levelTableRowValidator),
});

export const getResourceManagementView = query({
  args: {
    colonyId: v.id("colonies"),
  },
  returns: v.object({
    colony: v.object({
      id: v.id("colonies"),
      name: v.string(),
      addressLabel: v.string(),
      lastAccruedAt: v.number(),
    }),
    queues: queuesViewValidator,
    resources: v.object({
      stored: resourceBucketValidator,
      storageCaps: resourceBucketValidator,
      overflow: resourceBucketValidator,
      ratesPerMinute: resourceBucketValidator,
      energyProduced: v.number(),
      energyConsumed: v.number(),
      energyRatio: v.number(),
    }),
    buildings: v.array(buildingCardValidator),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const { colony, planet } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    const rates = productionRatesPerMinute({
      buildings: colony.buildings,
      overflow: colony.overflow,
      planet,
    });

    const queueRows = await listColonyQueueItems({
      colonyId: colony._id,
      ctx,
    });
    const buildingLane = buildLaneQueueView({
      lane: "building",
      now,
      rows: queueRows,
    });
    const shipyardLane = emptyLaneQueueView("shipyard");
    const researchLane = emptyLaneQueueView("research");
    const queueBlocked = buildingLane.isFull;
    const openBuildingQueueRows = queueRows.filter(
      (row) => row.lane === "building" && OPEN_QUEUE_STATUSES.includes(row.status)
    );

    const affordable = (cost: ResourceBucket) =>
      RESOURCE_KEYS.every((key) => colony.resources[key] >= scaledUnits(cost[key]));

    const cards = UPGRADE_BUILDING_KEYS.map((key) => {
      const config = BUILDING_CONFIG[key];
      const generator = getGeneratorOrThrow(config.generatorId);
      const currentLevel = colony.buildings[key];
      const projectedLevel = openBuildingQueueRows.reduce((level, row) => {
        if (row.kind !== "buildingUpgrade" || row.payload.buildingKey !== key) {
          return level;
        }
        return Math.max(level, row.payload.toLevel);
      }, currentLevel);
      const isUpgrading = buildingLane.activeItem?.payload.buildingKey === key;
      const isQueued = buildingLane.pendingItems.some((item) => item.payload.buildingKey === key);

      const outputPerMinute =
        config.group === "Power"
          ? rates.energyProduced
          : Math.max(0, Math.floor(rates.resources[config.resource as keyof ResourceBucket] ?? 0));

      const energyUsePerMinute =
        key === "powerPlantLevel"
          ? 0
          : energyConsumptionForLevel(
              key as Exclude<BuildingKey, "powerPlantLevel">,
              currentLevel
            );

      let nextUpgradeCost: ResourceBucket = emptyResourceBucket();
      let nextUpgradeDurationSeconds: number | undefined;
      let canUpgrade = false;

      if (projectedLevel < generator.maxLevel) {
        nextUpgradeCost = resourceMapToWholeUnitBucket(getUpgradeCost(generator, projectedLevel));
        nextUpgradeDurationSeconds = getUpgradeDurationSeconds(generator, projectedLevel);
        canUpgrade = !queueBlocked && affordable(nextUpgradeCost);
      }

      const status: "Running" | "Overflow" | "Paused" | "Upgrading" | "Queued" = isUpgrading
        ? "Upgrading"
        : isQueued
          ? "Queued"
        : config.group === "Production" && colony.overflow[config.resource as keyof ResourceBucket] > 0
          ? "Overflow"
          : rates.energyRatio <= 0 && config.group === "Production"
            ? "Paused"
            : "Running";

      const levelRows = [];
      const startLevel = Math.max(1, currentLevel);
      const endLevel = Math.min(generator.maxLevel, startLevel + 9);

      for (let level = startLevel; level <= endLevel; level += 1) {
        const previewBuildings = {
          ...colony.buildings,
          [key]: level,
        } satisfies Doc<"colonies">["buildings"];

        const previewRates = productionRatesPerMinute({
          buildings: previewBuildings,
          overflow: colony.overflow,
          planet,
        });

        const previewOutput =
          config.group === "Power"
            ? previewRates.energyProduced
            : Math.max(
                0,
                Math.floor(previewRates.resources[config.resource as keyof ResourceBucket] ?? 0)
              );

        const previewEnergy =
          key === "powerPlantLevel"
            ? 0
            : energyConsumptionForLevel(
                key as Exclude<BuildingKey, "powerPlantLevel">,
                level
              );

        let previewCost = emptyResourceBucket();
        let previewDurationSeconds = 0;

        if (level < generator.maxLevel) {
          previewCost = resourceMapToWholeUnitBucket(getUpgradeCost(generator, level));
          previewDurationSeconds = getUpgradeDurationSeconds(generator, level);
        }

        levelRows.push({
          level,
          outputPerMinute: previewOutput,
          energyUsePerMinute: previewEnergy,
          deltaOutputPerMinute: previewOutput - outputPerMinute,
          deltaEnergyPerMinute: previewEnergy - energyUsePerMinute,
          cost: previewCost,
          durationSeconds: previewDurationSeconds,
        });
      }

      return {
        key,
        name: config.name,
        group: config.group,
        currentLevel,
        maxLevel: generator.maxLevel,
        isUpgrading,
        isQueued,
        status,
        outputPerMinute,
        outputLabel: config.group === "Power" ? "MW" : `${config.resource} / min`,
        energyUsePerMinute,
        canUpgrade,
        nextUpgradeDurationSeconds,
        nextUpgradeCost,
        levelTable: levelRows,
      };
    });

    return {
      colony: {
        id: colony._id,
        name: colony.name,
        addressLabel: toAddressLabel(planet),
        lastAccruedAt: colony.lastAccruedAt,
      },
      queues: {
        nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
        lanes: {
          building: buildingLane,
          shipyard: shipyardLane,
          research: researchLane,
        },
      },
      resources: {
        stored: {
          alloy: storedToWholeUnits(colony.resources.alloy),
          crystal: storedToWholeUnits(colony.resources.crystal),
          fuel: storedToWholeUnits(colony.resources.fuel),
        },
        storageCaps: {
          alloy: storedToWholeUnits(colony.storageCaps.alloy),
          crystal: storedToWholeUnits(colony.storageCaps.crystal),
          fuel: storedToWholeUnits(colony.storageCaps.fuel),
        },
        overflow: {
          alloy: storedToWholeUnits(colony.overflow.alloy),
          crystal: storedToWholeUnits(colony.overflow.crystal),
          fuel: storedToWholeUnits(colony.overflow.fuel),
        },
        ratesPerMinute: {
          alloy: Math.max(0, Math.floor(rates.resources.alloy)),
          crystal: Math.max(0, Math.floor(rates.resources.crystal)),
          fuel: Math.max(0, Math.floor(rates.resources.fuel)),
        },
        energyProduced: rates.energyProduced,
        energyConsumed: rates.energyConsumed,
        energyRatio: rates.energyRatio,
      },
      buildings: cards,
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
    const { colony, planet } = await getOwnedColony({
      ctx,
      colonyId: args.colonyId,
    });

    await settleColonyAndPersist({
      ctx,
      colony,
      planet,
      now,
    });

    return {
      colonyId: colony._id,
      syncedAt: now,
    };
  },
});

export const enqueueBuildingUpgrade = mutation({
  args: {
    colonyId: v.id("colonies"),
    buildingKey: buildingKeyValidator,
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    queueItemId: v.id("colonyQueueItems"),
    lane: queueLaneValidator,
    buildingKey: buildingKeyValidator,
    fromLevel: v.number(),
    toLevel: v.number(),
    startsAt: v.number(),
    completesAt: v.number(),
    durationSeconds: v.number(),
    status: queueItemStatusValidator,
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

    const queueRows = await listOpenLaneQueueItems({
      colonyId: settledColony._id,
      ctx,
      lane: "building",
    });
    if (queueRows.length >= BUILDING_LANE_CAPACITY) {
      throw new ConvexError("Building queue is full");
    }

    const generator = getGeneratorOrThrow(BUILDING_CONFIG[args.buildingKey].generatorId);
    let projectedLevel = settledColony.buildings[args.buildingKey];
    for (const row of queueRows) {
      if (row.kind !== "buildingUpgrade") {
        continue;
      }
      if (row.payload.buildingKey !== args.buildingKey) {
        continue;
      }
      projectedLevel = Math.max(projectedLevel, row.payload.toLevel);
    }

    const fromLevel = projectedLevel;
    if (fromLevel >= generator.maxLevel) {
      throw new ConvexError("Building is already at max level");
    }

    const toLevel = fromLevel + 1;
    const upgradeCostScaled = resourceMapToScaledBucket(getUpgradeCost(generator, fromLevel));

    for (const key of RESOURCE_KEYS) {
      if (settledColony.resources[key] < upgradeCostScaled[key]) {
        throw new ConvexError(`Not enough ${key} to queue upgrade`);
      }
    }

    const nextResources = cloneResourceBucket(settledColony.resources);
    for (const key of RESOURCE_KEYS) {
      nextResources[key] -= upgradeCostScaled[key];
    }

    const durationSeconds = getUpgradeDurationSeconds(generator, fromLevel);
    const laneTail = queueRows[queueRows.length - 1];
    const startsAt = laneTail ? laneTail.completesAt : now;
    const completesAt = startsAt + durationSeconds * 1_000;

    await ctx.db.patch(settledColony._id, {
      resources: nextResources,
      activeUpgrade: undefined,
      updatedAt: now,
    });

    const lane: QueueLane = "building";
    const status: QueueItemStatus = queueRows.length === 0 ? "active" : "queued";
    const laneOrder = (laneTail?.order ?? 0) + 1;
    const queueItemId = await ctx.db.insert("colonyQueueItems", {
      universeId: settledColony.universeId,
      playerId: player._id,
      colonyId: settledColony._id,
      lane,
      kind: "buildingUpgrade",
      status,
      order: laneOrder,
      queuedAt: now,
      startsAt,
      completesAt,
      cost: upgradeCostScaled,
      payload: {
        buildingKey: args.buildingKey,
        fromLevel,
        toLevel,
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      colonyId: settledColony._id,
      queueItemId,
      lane,
      buildingKey: args.buildingKey,
      fromLevel,
      toLevel,
      startsAt,
      completesAt,
      durationSeconds,
      status,
    };
  },
});
