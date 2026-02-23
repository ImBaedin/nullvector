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

  const activeUpgrade = workingColony.activeUpgrade;

  if (!activeUpgrade) {
    const accrued = applyAccrualSegment({
      colony: workingColony,
      planet,
      segmentEndMs: now,
      resources: workingColony.resources,
    });

    workingColony.resources = accrued.resources;
    workingColony.lastAccruedAt = accrued.lastAccruedAt;
  } else {
    const firstSegmentEnd = Math.min(now, activeUpgrade.completesAt);

    const firstAccrual = applyAccrualSegment({
      colony: workingColony,
      planet,
      segmentEndMs: firstSegmentEnd,
      resources: workingColony.resources,
    });

    workingColony.resources = firstAccrual.resources;
    workingColony.lastAccruedAt = firstAccrual.lastAccruedAt;

    if (now >= activeUpgrade.completesAt) {
      const toLevel = Math.max(activeUpgrade.toLevel, workingColony.buildings[activeUpgrade.buildingKey]);
      workingColony.buildings[activeUpgrade.buildingKey] = toLevel;
      workingColony.storageCaps = storageCapsFromBuildings(workingColony.buildings);

      const secondAccrual = applyAccrualSegment({
        colony: {
          ...workingColony,
          lastAccruedAt: activeUpgrade.completesAt,
        },
        planet,
        segmentEndMs: now,
        resources: workingColony.resources,
      });

      workingColony.resources = secondAccrual.resources;
      workingColony.lastAccruedAt = secondAccrual.lastAccruedAt;
      workingColony.activeUpgrade = undefined;
    }
  }

  await ctx.db.patch(colony._id, {
    resources: workingColony.resources,
    buildings: workingColony.buildings,
    storageCaps: workingColony.storageCaps,
    usedSlots: usedSlotsFromBuildings(workingColony.buildings),
    activeUpgrade: workingColony.activeUpgrade,
    lastAccruedAt: workingColony.lastAccruedAt,
    updatedAt: now,
  });

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

function queueStatus(args: {
  colony: Doc<"colonies">;
  now: number;
}) {
  const { colony, now } = args;
  const active = colony.activeUpgrade;
  if (!active) {
    return null;
  }

  const remainingMs = Math.max(0, active.completesAt - now);
  return {
    buildingKey: active.buildingKey,
    fromLevel: active.fromLevel,
    toLevel: active.toLevel,
    queuedAt: active.queuedAt,
    completesAt: active.completesAt,
    remainingMs,
    isComplete: remainingMs === 0,
    cost: {
      alloy: storedToWholeUnits(active.cost.alloy),
      crystal: storedToWholeUnits(active.cost.crystal),
      fuel: storedToWholeUnits(active.cost.fuel),
    },
  };
}

const upgradeStatusValidator = v.object({
  buildingKey: buildingKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
  queuedAt: v.number(),
  completesAt: v.number(),
  remainingMs: v.number(),
  isComplete: v.boolean(),
  cost: resourceBucketValidator,
});

const sessionColonyValidator = v.object({
  id: v.id("colonies"),
  name: v.string(),
  addressLabel: v.string(),
  status: v.string(),
});

const resourceHudDatumValidator = v.object({
  key: v.union(v.literal("alloy"), v.literal("crystal"), v.literal("fuel"), v.literal("energy")),
  value: v.string(),
  deltaPerMinute: v.optional(v.string()),
  storageCurrentLabel: v.optional(v.string()),
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
    activeUpgrade: v.optional(upgradeStatusValidator),
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

    const planetsById = new Map<Id<"planets">, Doc<"planets">>();
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
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.alloy)).toLocaleString()}/m`,
        storageCurrentLabel: formatResourceValue(alloyUnits),
        storageCapLabel: formatResourceValue(alloyCap),
        storagePercent: alloyCap <= 0 ? 0 : Math.min(100, (alloyUnits / alloyCap) * 100),
      },
      {
        key: "crystal" as const,
        value: formatResourceValue(crystalUnits),
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.crystal)).toLocaleString()}/m`,
        storageCurrentLabel: formatResourceValue(crystalUnits),
        storageCapLabel: formatResourceValue(crystalCap),
        storagePercent:
          crystalCap <= 0 ? 0 : Math.min(100, (crystalUnits / crystalCap) * 100),
      },
      {
        key: "fuel" as const,
        value: formatResourceValue(fuelUnits),
        deltaPerMinute: `+${Math.max(0, Math.floor(rates.resources.fuel)).toLocaleString()}/m`,
        storageCurrentLabel: formatResourceValue(fuelUnits),
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
          status: entry.activeUpgrade ? "Upgrading" : "Stable",
        };
      }),
      resources,
      activeUpgrade: queueStatus({
        colony,
        now,
      }) ?? undefined,
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
  status: v.union(
    v.literal("Running"),
    v.literal("Overflow"),
    v.literal("Paused"),
    v.literal("Upgrading")
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
      activeUpgrade: v.optional(upgradeStatusValidator),
    }),
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

    const queue = colony.activeUpgrade;
    const queueBlocked = !!queue;

    const affordable = (cost: ResourceBucket) =>
      RESOURCE_KEYS.every((key) => colony.resources[key] >= scaledUnits(cost[key]));

    const cards = UPGRADE_BUILDING_KEYS.map((key) => {
      const config = BUILDING_CONFIG[key];
      const generator = getGeneratorOrThrow(config.generatorId);
      const currentLevel = colony.buildings[key];
      const isUpgrading = queue?.buildingKey === key;

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

      if (currentLevel < generator.maxLevel) {
        nextUpgradeCost = resourceMapToWholeUnitBucket(getUpgradeCost(generator, currentLevel));
        nextUpgradeDurationSeconds = getUpgradeDurationSeconds(generator, currentLevel);
        canUpgrade = !queueBlocked && affordable(nextUpgradeCost);
      }

      const status: "Running" | "Overflow" | "Paused" | "Upgrading" = isUpgrading
        ? "Upgrading"
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
        activeUpgrade: queueStatus({
          colony,
          now,
        }) ?? undefined,
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

export const queueUpgrade = mutation({
  args: {
    colonyId: v.id("colonies"),
    buildingKey: buildingKeyValidator,
  },
  returns: v.object({
    colonyId: v.id("colonies"),
    buildingKey: buildingKeyValidator,
    fromLevel: v.number(),
    toLevel: v.number(),
    completesAt: v.number(),
    durationSeconds: v.number(),
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

    if (settledColony.activeUpgrade) {
      throw new ConvexError("Only one upgrade can run at a time");
    }

    const generator = getGeneratorOrThrow(BUILDING_CONFIG[args.buildingKey].generatorId);
    const fromLevel = settledColony.buildings[args.buildingKey];
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
    const completesAt = now + durationSeconds * 1_000;

    await ctx.db.patch(settledColony._id, {
      resources: nextResources,
      activeUpgrade: {
        buildingKey: args.buildingKey,
        fromLevel,
        toLevel,
        queuedAt: now,
        completesAt,
        cost: upgradeCostScaled,
      },
      updatedAt: now,
    });

    return {
      colonyId: settledColony._id,
      buildingKey: args.buildingKey,
      fromLevel,
      toLevel,
      completesAt,
      durationSeconds,
    };
  },
});
