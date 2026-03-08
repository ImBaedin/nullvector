import {
  BUILDING_KEYS,
  DEFAULT_GENERATOR_REGISTRY,
  getGeneratorProductionPerMinute,
} from "@nullvector/game-logic";
import type {
  BuildingKey,
  FacilityKey,
  ResourceBucket,
  ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
} from "../../convex/_generated/server";
import { authComponent } from "../../convex/auth";
import { RESOURCE_SCALE } from "../../convex/schema";
import { DEFAULT_UNIVERSE_SLUG } from "../../convex/lib/worldgen/config";

export type ProductionBuildingKey =
  | "alloyMineLevel"
  | "crystalMineLevel"
  | "fuelRefineryLevel";
export type StorageBuildingKey =
  | "alloyStorageLevel"
  | "crystalStorageLevel"
  | "fuelStorageLevel";
type GeneratorBuildingKey = ProductionBuildingKey | "powerPlantLevel";

type QueueLane = "building" | "shipyard" | "research";
type QueueItemStatus =
  | "queued"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";
type QueueItemKind = "buildingUpgrade" | "facilityUpgrade" | "shipBuild";

type ColonyState = {
  buildings: {
    alloyMineLevel: number;
    crystalMineLevel: number;
    fuelRefineryLevel: number;
    powerPlantLevel: number;
    alloyStorageLevel: number;
    crystalStorageLevel: number;
    fuelStorageLevel: number;
    roboticsHubLevel: number;
    shipyardLevel: number;
  };
  inboundMissionPolicy?: "allowAll" | "denyAll" | "alliesOnly";
  lastAccruedAt: number;
  overflow: ResourceBucket;
  resources: ResourceBucket;
  storageCaps: ResourceBucket;
  usedSlots: number;
};

type PlanetEconomyState = {
  alloyMultiplier: number;
  compositionType: "metallic" | "silicate" | "icy" | "volatileRich";
  crystalMultiplier: number;
  fuelMultiplier: number;
  isColonizable: boolean;
  maxBuildingSlots: number;
};

type BuildingQueuePayload = {
  buildingKey: BuildingKey;
  fromLevel: number;
  toLevel: number;
};

type FacilityQueuePayload = {
  facilityKey: FacilityKey;
  fromLevel: number;
  toLevel: number;
};

type ShipBuildQueuePayload = {
  shipKey: ShipKey;
  quantity: number;
  completedQuantity: number;
  perUnitDurationSeconds: number;
};

type QueuePayload = BuildingQueuePayload | FacilityQueuePayload | ShipBuildQueuePayload;

type QueuePayloadState = {
  cost: ResourceBucket;
  payload: QueuePayload;
};

type ColonyWithRelations = {
  colony: Doc<"colonies"> & ColonyState;
  planet: Doc<"planets"> & PlanetEconomyState;
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
  "roboticsHubLevel",
  "shipyardLevel",
] as const;

const UPGRADE_BUILDING_KEYS =
  BUILDING_KEYS satisfies readonly BuildingKey[];

const OPEN_QUEUE_STATUSES: ReadonlyArray<QueueItemStatus> = [
  "active",
  "queued",
];
const BUILDING_LANE_BASE_CAPACITY = 2;
const LANE_QUEUE_CAPACITY: Record<QueueLane, number> = {
  building: BUILDING_LANE_BASE_CAPACITY,
  shipyard: 5,
  research: 2,
};

const ENERGY_BASE_CONSUMPTION: Record<ProductionBuildingKey, number> = {
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
  v.literal("powerPlantLevel"),
  v.literal("alloyStorageLevel"),
  v.literal("crystalStorageLevel"),
  v.literal("fuelStorageLevel"),
);
const facilityKeyValidator = v.union(
  v.literal("robotics_hub"),
  v.literal("shipyard"),
);

const queueLaneValidator = v.union(
  v.literal("building"),
  v.literal("shipyard"),
  v.literal("research"),
);

const queueItemStatusValidator = v.union(
  v.literal("queued"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed"),
);

const shipKeyValidator = v.union(
  v.literal("smallCargo"),
  v.literal("largeCargo"),
  v.literal("colonyShip"),
);

const queueItemKindValidator = v.union(
  v.literal("buildingUpgrade"),
  v.literal("facilityUpgrade"),
  v.literal("shipBuild"),
);

const buildingQueuePayloadValidator = v.object({
  buildingKey: buildingKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
});
const facilityQueuePayloadValidator = v.object({
  facilityKey: facilityKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
});

const shipBuildQueuePayloadValidator = v.object({
  shipKey: shipKeyValidator,
  quantity: v.number(),
  completedQuantity: v.number(),
  perUnitDurationSeconds: v.number(),
});

const queuePayloadValidator = v.union(
  buildingQueuePayloadValidator,
  facilityQueuePayloadValidator,
  shipBuildQueuePayloadValidator,
);

function emptyResourceBucket(): ResourceBucket {
  return {
    alloy: 0,
    crystal: 0,
    fuel: 0,
  };
}

async function upsertColonyCompanionRows(args: {
  colony: Doc<"colonies"> & ColonyState;
  ctx: MutationCtx;
  now: number;
}) {
  const { colony, ctx, now } = args;

  const [economyRow, infraRow, policyRow] = await Promise.all([
    ctx.db
      .query("colonyEconomy")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
      .unique(),
    ctx.db
      .query("colonyInfrastructure")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
      .unique(),
    ctx.db
      .query("colonyPolicy")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
      .unique(),
  ]);

  if (economyRow) {
    await ctx.db.patch(economyRow._id, {
      resources: cloneResourceBucket(colony.resources),
      overflow: cloneResourceBucket(colony.overflow),
      storageCaps: cloneResourceBucket(colony.storageCaps),
      lastAccruedAt: colony.lastAccruedAt,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("colonyEconomy", {
      colonyId: colony._id,
      resources: cloneResourceBucket(colony.resources),
      overflow: cloneResourceBucket(colony.overflow),
      storageCaps: cloneResourceBucket(colony.storageCaps),
      lastAccruedAt: colony.lastAccruedAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (infraRow) {
    await ctx.db.patch(infraRow._id, {
      buildings: { ...colony.buildings },
      usedSlots: colony.usedSlots,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("colonyInfrastructure", {
      colonyId: colony._id,
      buildings: { ...colony.buildings },
      usedSlots: colony.usedSlots,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (policyRow) {
    await ctx.db.patch(policyRow._id, {
      inboundMissionPolicy: colony.inboundMissionPolicy,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("colonyPolicy", {
    colonyId: colony._id,
    inboundMissionPolicy: colony.inboundMissionPolicy,
    createdAt: now,
    updatedAt: now,
  });
}

async function upsertQueuePayloadRow(args: {
  ctx: MutationCtx;
  item: Doc<"colonyQueueItems"> & QueuePayloadState;
  now: number;
}) {
  const existing = await args.ctx.db
    .query("colonyQueuePayloads")
    .withIndex("by_queue_item_id", (q) => q.eq("queueItemId", args.item._id))
    .unique();

  if (existing) {
    await args.ctx.db.patch(existing._id, {
      universeId: args.item.universeId,
      playerId: args.item.playerId,
      colonyId: args.item.colonyId,
      lane: args.item.lane,
      kind: args.item.kind,
      cost: cloneResourceBucket(args.item.cost),
      payload: args.item.payload,
      updatedAt: args.now,
    });
    return;
  }

  await args.ctx.db.insert("colonyQueuePayloads", {
    queueItemId: args.item._id,
    universeId: args.item.universeId,
    playerId: args.item.playerId,
    colonyId: args.item.colonyId,
    lane: args.item.lane,
    kind: args.item.kind,
    cost: cloneResourceBucket(args.item.cost),
    payload: args.item.payload,
    createdAt: args.now,
    updatedAt: args.now,
  });
}

async function loadColonyState(args: {
  colony: Doc<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  const [economy, infrastructure, policy] = await Promise.all([
    args.ctx.db
      .query("colonyEconomy")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", args.colony._id))
      .unique(),
    args.ctx.db
      .query("colonyInfrastructure")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", args.colony._id))
      .unique(),
    args.ctx.db
      .query("colonyPolicy")
      .withIndex("by_colony_id", (q) => q.eq("colonyId", args.colony._id))
      .unique(),
  ]);
  if (!economy || !infrastructure) {
    throw new ConvexError("Colony companion rows missing");
  }
  const buildings = {
    ...infrastructure.buildings,
    roboticsHubLevel: infrastructure.buildings.roboticsHubLevel ?? 0,
  };
  return {
    ...args.colony,
    resources: economy.resources,
    overflow: economy.overflow,
    storageCaps: economy.storageCaps,
    lastAccruedAt: economy.lastAccruedAt,
    buildings,
    usedSlots: infrastructure.usedSlots,
    inboundMissionPolicy: policy?.inboundMissionPolicy,
  } as Doc<"colonies"> & ColonyState;
}

async function loadPlanetState(args: {
  planet: Doc<"planets">;
  ctx: QueryCtx | MutationCtx;
}) {
  const economy = await args.ctx.db
    .query("planetEconomy")
    .withIndex("by_planet_id", (q) => q.eq("planetId", args.planet._id))
    .unique();
  if (!economy) {
    throw new ConvexError("Planet economy row missing");
  }
  return {
    ...args.planet,
    compositionType: economy.compositionType,
    maxBuildingSlots: economy.maxBuildingSlots,
    alloyMultiplier: economy.alloyMultiplier,
    crystalMultiplier: economy.crystalMultiplier,
    fuelMultiplier: economy.fuelMultiplier,
    isColonizable: economy.isColonizable,
  } as Doc<"planets"> & PlanetEconomyState;
}

async function loadQueueWithPayload(args: {
  ctx: QueryCtx | MutationCtx;
  row: Doc<"colonyQueueItems">;
}) {
  const payload = await args.ctx.db
    .query("colonyQueuePayloads")
    .withIndex("by_queue_item_id", (q) => q.eq("queueItemId", args.row._id))
    .unique();
  if (!payload) {
    throw new ConvexError("Queue payload row missing");
  }
  return {
    ...args.row,
    cost: payload.cost,
    payload: payload.payload as QueuePayloadState["payload"],
  } as Doc<"colonyQueueItems"> & QueuePayloadState;
}

function cloneResourceBucket(bucket: ResourceBucket): ResourceBucket {
  return {
    alloy: bucket.alloy,
    crystal: bucket.crystal,
    fuel: bucket.fuel,
  };
}

export function scaledUnits(unscaledUnits: number) {
  return Math.round(Math.max(0, unscaledUnits) * RESOURCE_SCALE);
}

export function storedToWholeUnits(storedAmount: number) {
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

const STORAGE_BUILDING_MAX_LEVEL = 25;
const STORAGE_CAP_BASE_UNITS = 10_000;
const STORAGE_CAP_GROWTH = 1.7;

const STORAGE_UPGRADE_CONFIG: Record<
  StorageBuildingKey,
  {
    costBase: ResourceBucket;
    costGrowth: number;
    durationBaseSeconds: number;
    durationGrowth: number;
  }
> = {
  alloyStorageLevel: {
    costBase: { alloy: 160, crystal: 60, fuel: 0 },
    costGrowth: 1.58,
    durationBaseSeconds: 110,
    durationGrowth: 1.2,
  },
  crystalStorageLevel: {
    costBase: { alloy: 130, crystal: 95, fuel: 0 },
    costGrowth: 1.58,
    durationBaseSeconds: 118,
    durationGrowth: 1.2,
  },
  fuelStorageLevel: {
    costBase: { alloy: 210, crystal: 90, fuel: 0 },
    costGrowth: 1.6,
    durationBaseSeconds: 126,
    durationGrowth: 1.21,
  },
};

type BuildingConfig =
  | {
      kind: "generator";
      generatorId: string;
      name: string;
      group: "Production" | "Power";
      resource: "alloy" | "crystal" | "fuel" | "energy";
      planetMultiplierKey?:
        | "alloyMultiplier"
        | "crystalMultiplier"
        | "fuelMultiplier";
    }
  | {
      kind: "storage";
      name: string;
      group: "Storage";
      resource: keyof ResourceBucket;
      maxLevel: number;
    };

const BUILDING_CONFIG: Record<BuildingKey, BuildingConfig> = {
  alloyMineLevel: {
    kind: "generator",
    generatorId: "alloy_mine",
    name: "Alloy Mine",
    group: "Production",
    resource: "alloy",
    planetMultiplierKey: "alloyMultiplier",
  },
  crystalMineLevel: {
    kind: "generator",
    generatorId: "crystal_mine",
    name: "Crystal Mine",
    group: "Production",
    resource: "crystal",
    planetMultiplierKey: "crystalMultiplier",
  },
  fuelRefineryLevel: {
    kind: "generator",
    generatorId: "deuterium_extractor",
    name: "Fuel Refinery",
    group: "Production",
    resource: "fuel",
    planetMultiplierKey: "fuelMultiplier",
  },
  powerPlantLevel: {
    kind: "generator",
    generatorId: "solar_plant",
    name: "Power Plant",
    group: "Power",
    resource: "energy",
  },
  alloyStorageLevel: {
    kind: "storage",
    name: "Alloy Depot",
    group: "Storage",
    resource: "alloy",
    maxLevel: STORAGE_BUILDING_MAX_LEVEL,
  },
  crystalStorageLevel: {
    kind: "storage",
    name: "Crystal Vault",
    group: "Storage",
    resource: "crystal",
    maxLevel: STORAGE_BUILDING_MAX_LEVEL,
  },
  fuelStorageLevel: {
    kind: "storage",
    name: "Fuel Silo",
    group: "Storage",
    resource: "fuel",
    maxLevel: STORAGE_BUILDING_MAX_LEVEL,
  },
};

const SHIPYARD_FACILITY_KEY: FacilityKey = "shipyard";
const ROBOTICS_HUB_FACILITY_KEY: FacilityKey = "robotics_hub";
const EMPTY_RESEARCH_LEVELS: Record<string, number> = {};

function getBuildingLaneCapacity(colony: Pick<ColonyState, "buildings">) {
  return (
    BUILDING_LANE_BASE_CAPACITY +
    Math.floor(Math.max(0, colony.buildings.roboticsHubLevel) / 2)
  );
}

function facilityLevelFromColony(
  colony: Pick<ColonyState, "buildings">,
  facilityKey: FacilityKey,
) {
  if (facilityKey === ROBOTICS_HUB_FACILITY_KEY) {
    return colony.buildings.roboticsHubLevel;
  }
  if (facilityKey === "shipyard") {
    return colony.buildings.shipyardLevel;
  }
  return 0;
}

function facilityLevelsFromColony(colony: Pick<ColonyState, "buildings">) {
  return {
    robotics_hub: colony.buildings.roboticsHubLevel,
    shipyard: colony.buildings.shipyardLevel,
  } satisfies Partial<Record<string, number>>;
}

function setFacilityLevelOnBuildings(args: {
  buildings: ColonyState["buildings"];
  facilityKey: FacilityKey;
  level: number;
}) {
  if (args.facilityKey === ROBOTICS_HUB_FACILITY_KEY) {
    args.buildings.roboticsHubLevel = Math.max(
      args.level,
      args.buildings.roboticsHubLevel,
    );
    return;
  }
  if (args.facilityKey === "shipyard") {
    args.buildings.shipyardLevel = Math.max(args.level, args.buildings.shipyardLevel);
  }
}

function generatorConfigForBuilding(buildingKey: GeneratorBuildingKey) {
  const config = BUILDING_CONFIG[buildingKey];
  if (config.kind !== "generator") {
    throw new ConvexError(`Missing generator config for ${buildingKey}`);
  }
  return config;
}

function storageCapForLevel(level: number) {
  if (level <= 0) {
    return 0;
  }
  return Math.round(
    STORAGE_CAP_BASE_UNITS * Math.pow(STORAGE_CAP_GROWTH, level - 1),
  );
}

function isStorageBuildingKey(
  buildingKey: BuildingKey,
): buildingKey is StorageBuildingKey {
  return (
    buildingKey === "alloyStorageLevel" ||
    buildingKey === "crystalStorageLevel" ||
    buildingKey === "fuelStorageLevel"
  );
}

function storageUpgradeCost(
  buildingKey: StorageBuildingKey,
  currentLevel: number,
): ResourceBucket {
  const config = STORAGE_UPGRADE_CONFIG[buildingKey];

  return {
    alloy: Math.round(
      config.costBase.alloy * Math.pow(config.costGrowth, currentLevel),
    ),
    crystal: Math.round(
      config.costBase.crystal * Math.pow(config.costGrowth, currentLevel),
    ),
    fuel: Math.round(
      config.costBase.fuel * Math.pow(config.costGrowth, currentLevel),
    ),
  };
}

function storageUpgradeDurationSeconds(
  buildingKey: StorageBuildingKey,
  currentLevel: number,
) {
  const config = STORAGE_UPGRADE_CONFIG[buildingKey];
  return Math.round(
    config.durationBaseSeconds * Math.pow(config.durationGrowth, currentLevel),
  );
}

function storageCapsFromBuildings(
  buildings: ColonyState["buildings"],
): ResourceBucket {
  return {
    alloy: scaledUnits(storageCapForLevel(buildings.alloyStorageLevel)),
    crystal: scaledUnits(storageCapForLevel(buildings.crystalStorageLevel)),
    fuel: scaledUnits(storageCapForLevel(buildings.fuelStorageLevel)),
  };
}

function usedSlotsFromBuildings(buildings: ColonyState["buildings"]) {
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
  buildingKey: ProductionBuildingKey,
  level: number,
) {
  if (level <= 0) {
    return 0;
  }

  const base = ENERGY_BASE_CONSUMPTION[buildingKey];
  return Math.round(base * Math.pow(1.12, level - 1));
}

function productionRatesPerMinute(args: {
  buildings: ColonyState["buildings"];
  overflow: ResourceBucket;
  planet: Doc<"planets"> & PlanetEconomyState;
}) {
  const { buildings, overflow, planet } = args;

  const alloyGenerator = getGeneratorOrThrow(
    generatorConfigForBuilding("alloyMineLevel").generatorId,
  );
  const crystalGenerator = getGeneratorOrThrow(
    generatorConfigForBuilding("crystalMineLevel").generatorId,
  );
  const fuelGenerator = getGeneratorOrThrow(
    generatorConfigForBuilding("fuelRefineryLevel").generatorId,
  );
  const powerGenerator = getGeneratorOrThrow(
    generatorConfigForBuilding("powerPlantLevel").generatorId,
  );

  const rawAlloyRate =
    getGeneratorProductionPerMinute(alloyGenerator, buildings.alloyMineLevel) *
    planet.alloyMultiplier;
  const rawCrystalRate =
    getGeneratorProductionPerMinute(
      crystalGenerator,
      buildings.crystalMineLevel,
    ) * planet.crystalMultiplier;
  const rawFuelRate =
    getGeneratorProductionPerMinute(
      fuelGenerator,
      buildings.fuelRefineryLevel,
    ) * planet.fuelMultiplier;

  const energyProduced = getGeneratorProductionPerMinute(
    powerGenerator,
    buildings.powerPlantLevel,
  );
  const energyConsumed =
    energyConsumptionForLevel("alloyMineLevel", buildings.alloyMineLevel) +
    energyConsumptionForLevel("crystalMineLevel", buildings.crystalMineLevel) +
    energyConsumptionForLevel("fuelRefineryLevel", buildings.fuelRefineryLevel);

  const energyRatio =
    energyConsumed <= 0
      ? 1
      : Math.max(0, Math.min(1, energyProduced / energyConsumed));

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

export function applyAccrualSegment(args: {
  colony: Doc<"colonies"> & ColonyState;
  planet: Doc<"planets"> & PlanetEconomyState;
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
    const generatedScaled = Math.floor(
      rates.resources[key] * minutesElapsed * RESOURCE_SCALE,
    );
    const cappedValue = Math.min(
      colony.storageCaps[key],
      Math.max(0, nextResources[key] + generatedScaled),
    );
    nextResources[key] = cappedValue;
  }

  return {
    lastAccruedAt: segmentEndMs,
    resources: nextResources,
  };
}

function reconcileOverflowIntoStorage(args: {
  overflow: ResourceBucket;
  resources: ResourceBucket;
  storageCaps: ResourceBucket;
}) {
  const { overflow, resources, storageCaps } = args;
  for (const key of RESOURCE_KEYS) {
    if (overflow[key] <= 0) {
      continue;
    }
    const headroom = Math.max(0, storageCaps[key] - resources[key]);
    if (headroom <= 0) {
      continue;
    }
    const transfer = Math.min(headroom, overflow[key]);
    resources[key] += transfer;
    overflow[key] -= transfer;
  }
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

function resourceMapToWholeUnitBucket(
  resourceMap: Partial<Record<string, number>>,
): ResourceBucket {
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

  const colonyWithState = await loadColonyState({ colony, ctx });

  const planet = await ctx.db.get(colonyWithState.planetId);
  if (!planet) {
    throw new ConvexError("Planet not found for colony");
  }
  const planetWithState = await loadPlanetState({
    planet,
    ctx,
  });

  return {
    colony: colonyWithState,
    planet: planetWithState,
    player: playerResult.player,
  };
}

export function compareQueueOrder(
  left: Doc<"colonyQueueItems"> & QueuePayloadState,
  right: Doc<"colonyQueueItems"> & QueuePayloadState,
) {
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
  const [activeRows, queuedRows] = await Promise.all([
    args.ctx.db
      .query("colonyQueueItems")
      .withIndex("by_col_lane_st", (q) =>
        q
          .eq("colonyId", args.colonyId)
          .eq("lane", args.lane)
          .eq("status", "active"),
      )
      .collect(),
    args.ctx.db
      .query("colonyQueueItems")
      .withIndex("by_col_lane_st", (q) =>
        q
          .eq("colonyId", args.colonyId)
          .eq("lane", args.lane)
          .eq("status", "queued"),
      )
      .collect(),
  ]);

  const openRows = [...activeRows, ...queuedRows].sort((l, r) => {
    if (l.order !== r.order) {
      return l.order - r.order;
    }
    if (l.queuedAt !== r.queuedAt) {
      return l.queuedAt - r.queuedAt;
    }
    return l._creationTime - r._creationTime;
  });
  return await Promise.all(
    openRows.map((row) =>
      loadQueueWithPayload({
        ctx: args.ctx,
        row,
      }),
    ),
  );
}

function isBuildingUpgradeQueueItem(
  item: Doc<"colonyQueueItems"> & QueuePayloadState,
): item is Doc<"colonyQueueItems"> & QueuePayloadState & {
  kind: "buildingUpgrade";
  payload: BuildingQueuePayload;
} {
  return item.kind === "buildingUpgrade" && "buildingKey" in item.payload;
}

function isFacilityUpgradeQueueItem(
  item: Doc<"colonyQueueItems"> & QueuePayloadState,
): item is Doc<"colonyQueueItems"> & QueuePayloadState & {
  kind: "facilityUpgrade";
  payload: FacilityQueuePayload;
} {
  return item.kind === "facilityUpgrade" && "facilityKey" in item.payload;
}

function isShipBuildQueueItem(
  item: Doc<"colonyQueueItems"> & QueuePayloadState,
): item is Doc<"colonyQueueItems"> & QueuePayloadState & {
  kind: "shipBuild";
  payload: ShipBuildQueuePayload;
} {
  return item.kind === "shipBuild" && "shipKey" in item.payload;
}

function queueItemFromToLevel(item: Doc<"colonyQueueItems"> & QueuePayloadState) {
  if (!isBuildingUpgradeQueueItem(item) && !isFacilityUpgradeQueueItem(item)) {
    throw new ConvexError("Queue item is not an upgrade");
  }
  return {
    fromLevel: item.payload.fromLevel,
    toLevel: item.payload.toLevel,
  };
}

async function settleColonyAndPersist(args: {
  ctx: MutationCtx;
  colony: Doc<"colonies"> & ColonyState;
  planet: Doc<"planets"> & PlanetEconomyState;
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

  const queuePatchById = new Map<
    Id<"colonyQueueItems">,
    Partial<Doc<"colonyQueueItems">>
  >();
  let activeQueue =
    queueRows.find(
      (row) =>
        row.status === "active" &&
        (isBuildingUpgradeQueueItem(row) || isFacilityUpgradeQueueItem(row)),
    ) ?? null;
  const queued = queueRows.filter(
    (row) =>
      row.status === "queued" &&
      (isBuildingUpgradeQueueItem(row) || isFacilityUpgradeQueueItem(row)),
  );

  const markPatch = (
    queueId: Id<"colonyQueueItems">,
    patch: Partial<Doc<"colonyQueueItems">>,
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
    reconcileOverflowIntoStorage({
      overflow: workingColony.overflow,
      resources: workingColony.resources,
      storageCaps: workingColony.storageCaps,
    });

    const accrued = applyAccrualSegment({
      colony: workingColony,
      planet,
      segmentEndMs,
      resources: workingColony.resources,
    });

    workingColony.resources = accrued.resources;
    workingColony.lastAccruedAt = accrued.lastAccruedAt;

    reconcileOverflowIntoStorage({
      overflow: workingColony.overflow,
      resources: workingColony.resources,
      storageCaps: workingColony.storageCaps,
    });
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
    if (isBuildingUpgradeQueueItem(activeQueue)) {
      const buildingKey = activeQueue.payload.buildingKey;
      workingColony.buildings[buildingKey] = Math.max(
        toLevel,
        workingColony.buildings[buildingKey],
      );
    } else if (isFacilityUpgradeQueueItem(activeQueue)) {
      setFacilityLevelOnBuildings({
        buildings: workingColony.buildings,
        facilityKey: activeQueue.payload.facilityKey,
        level: toLevel,
      });
    }
    workingColony.storageCaps = storageCapsFromBuildings(
      workingColony.buildings,
    );
    reconcileOverflowIntoStorage({
      overflow: workingColony.overflow,
      resources: workingColony.resources,
      storageCaps: workingColony.storageCaps,
    });

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
    updatedAt: now,
  });
  await upsertColonyCompanionRows({
    colony: {
      ...colony,
      resources: workingColony.resources,
      overflow: workingColony.overflow,
      buildings: workingColony.buildings,
      storageCaps: workingColony.storageCaps,
      usedSlots: usedSlotsFromBuildings(workingColony.buildings),
      lastAccruedAt: workingColony.lastAccruedAt,
      updatedAt: now,
    },
    ctx,
    now,
  });

  for (const [queueId, patch] of queuePatchById.entries()) {
    await ctx.db.patch(queueId, patch);
  }

  return workingColony;
}

async function getColonyShipCount(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
  shipKey: ShipKey;
}) {
  const row = await args.ctx.db
    .query("colonyShips")
    .withIndex("by_colony_and_ship_key", (q) =>
      q.eq("colonyId", args.colonyId).eq("shipKey", args.shipKey),
    )
    .unique();
  return row?.count ?? 0;
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

async function settleShipyardQueue(args: {
  colony: Doc<"colonies">;
  ctx: MutationCtx;
  now: number;
}) {
  const queueRows = await listOpenLaneQueueItems({
    colonyId: args.colony._id,
    ctx: args.ctx,
    lane: "shipyard",
  });

  const queuePatchById = new Map<
    Id<"colonyQueueItems">,
    Partial<Doc<"colonyQueueItems">>
  >();
  let activeQueue =
    queueRows.find((row) => row.status === "active" && isShipBuildQueueItem(row)) ??
    null;
  const queued = queueRows.filter(
    (row) => row.status === "queued" && isShipBuildQueueItem(row),
  );

  const markPatch = (
    queueId: Id<"colonyQueueItems">,
    patch: Partial<Doc<"colonyQueueItems">>,
  ) => {
    const existing = queuePatchById.get(queueId) ?? {};
    queuePatchById.set(queueId, { ...existing, ...patch });
  };

  if (!activeQueue && queued.length > 0) {
    activeQueue = queued.shift() ?? null;
    if (activeQueue) {
      markPatch(activeQueue._id, {
        status: "active",
        updatedAt: args.now,
      });
    }
  }

  while (activeQueue) {
    if (!isShipBuildQueueItem(activeQueue)) {
      throw new ConvexError("Expected ship build queue item");
    }
    const payload = activeQueue.payload;
    let completedQuantity = payload.completedQuantity;
    const unitDurationMs = payload.perUnitDurationSeconds * 1_000;

    while (completedQuantity < payload.quantity) {
      const nextUnitAt = activeQueue.startsAt + (completedQuantity + 1) * unitDurationMs;
      if (nextUnitAt > args.now) {
        break;
      }

      await incrementColonyShipCount({
        amount: 1,
        colony: args.colony,
        ctx: args.ctx,
        now: args.now,
        shipKey: payload.shipKey,
      });
      completedQuantity += 1;
    }

    const activeQueueId = activeQueue._id;
    const payloadRow = await args.ctx.db
      .query("colonyQueuePayloads")
      .withIndex("by_queue_item_id", (q) => q.eq("queueItemId", activeQueueId))
      .unique();
    if (payloadRow) {
      await args.ctx.db.patch(payloadRow._id, {
        payload: {
          ...payload,
          completedQuantity,
        },
        updatedAt: args.now,
      });
    }
    markPatch(activeQueue._id, { updatedAt: args.now });

    if (completedQuantity < payload.quantity) {
      break;
    }

    markPatch(activeQueue._id, {
      resolvedAt: args.now,
      status: "completed",
      updatedAt: args.now,
    });

    activeQueue = queued.shift() ?? null;
    if (!activeQueue) {
      break;
    }

    markPatch(activeQueue._id, {
      status: "active",
      updatedAt: args.now,
    });
  }

  for (const [queueId, patch] of queuePatchById.entries()) {
    await args.ctx.db.patch(queueId, patch);
  }
}

async function listPlayerColonies(args: {
  ctx: QueryCtx | MutationCtx;
  playerId: Id<"players">;
}) {
  const { ctx, playerId } = args;
  const colonies = await ctx.db
    .query("colonies")
    .withIndex("by_player_id", (q) => q.eq("playerId", playerId))
    .collect();

  colonies.sort((left, right) => left.createdAt - right.createdAt);
  return colonies;
}

async function listOpenColonyQueueItems(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx | MutationCtx;
}) {
  const [activeRows, queuedRows] = await Promise.all([
    args.ctx.db
      .query("colonyQueueItems")
      .withIndex("by_col_st_time", (q) =>
        q.eq("colonyId", args.colonyId).eq("status", "active"),
      )
      .collect(),
    args.ctx.db
      .query("colonyQueueItems")
      .withIndex("by_col_st_time", (q) =>
        q.eq("colonyId", args.colonyId).eq("status", "queued"),
      )
      .collect(),
  ]);

  const rows = [...activeRows, ...queuedRows].sort((l, r) => {
    if (l.order !== r.order) {
      return l.order - r.order;
    }
    if (l.queuedAt !== r.queuedAt) {
      return l.queuedAt - r.queuedAt;
    }
    return l._creationTime - r._creationTime;
  });
  return await Promise.all(
    rows.map((row) =>
      loadQueueWithPayload({
        ctx: args.ctx,
        row,
      }),
    ),
  );
}

function sessionStateValidator() {
  return v.object({
    isAuthenticated: v.boolean(),
    playerId: v.optional(v.id("players")),
    defaultColonyId: v.optional(v.id("colonies")),
    colonyIds: v.array(v.id("colonies")),
  });
}

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

function toQueueViewItem(args: {
  item: Doc<"colonyQueueItems"> & QueuePayloadState;
  now: number;
}) {
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

export function queueEventsNextAt(rows: Array<Doc<"colonyQueueItems"> & QueuePayloadState>) {
  let nextAt: number | null = null;
  for (const row of rows) {
    if (!OPEN_QUEUE_STATUSES.includes(row.status)) {
      continue;
    }
    nextAt =
      nextAt === null ? row.completesAt : Math.min(nextAt, row.completesAt);
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
  maxItems?: number;
  now: number;
  rows: Array<Doc<"colonyQueueItems"> & QueuePayloadState>;
}) {
  const open = args.rows
    .filter(
      (row) =>
        row.lane === args.lane && OPEN_QUEUE_STATUSES.includes(row.status),
    )
    .sort(compareQueueOrder);

  const active = open.find((row) => row.status === "active");
  const pending = open.filter((row) => row.status === "queued");
  const totalItems = open.length;
  const maxItems = args.maxItems ?? LANE_QUEUE_CAPACITY[args.lane];

  return {
    lane: args.lane,
    maxItems,
    totalItems,
    isFull: totalItems >= maxItems,
    activeItem: active
      ? toQueueViewItem({ item: active, now: args.now })
      : undefined,
    pendingItems: pending.map((item) =>
      toQueueViewItem({ item, now: args.now }),
    ),
  };
}

const sessionColonyValidator = v.object({
  id: v.id("colonies"),
  name: v.string(),
  addressLabel: v.string(),
});

const resourceHudDatumValidator = v.object({
  key: v.union(
    v.literal("alloy"),
    v.literal("crystal"),
    v.literal("fuel"),
    v.literal("energy"),
  ),
  value: v.string(),
  valueAmount: v.optional(v.number()),
  deltaPerMinute: v.optional(v.string()),
  deltaPerMinuteAmount: v.optional(v.number()),
  storageCurrentAmount: v.optional(v.number()),
  storageCurrentLabel: v.optional(v.string()),
  storageCapAmount: v.optional(v.number()),
  storageCapLabel: v.optional(v.string()),
  storagePercent: v.optional(v.number()),
  overflowAmount: v.optional(v.number()),
  overflowLabel: v.optional(v.string()),
  pausedByOverflow: v.optional(v.boolean()),
  energyBalance: v.optional(v.number()),
});

const colonyQueueStatusValidator = v.union(
  v.literal("Upgrading"),
  v.literal("Queued"),
  v.literal("Stable"),
);
type ColonyQueueStatus = "Upgrading" | "Queued" | "Stable";

const colonyStatusValidator = v.object({
  colonyId: v.id("colonies"),
  status: colonyQueueStatusValidator,
});

const colonyCoordinatesValidator = v.object({
  galaxyId: v.id("galaxies"),
  sectorId: v.id("sectors"),
  systemId: v.id("systems"),
  planetId: v.id("planets"),
  focusX: v.number(),
  focusY: v.number(),
  addressLabel: v.string(),
});

function buildHudResources(args: {
  colony: Doc<"colonies"> & ColonyState;
  planet: Doc<"planets"> & PlanetEconomyState;
}) {
  const { colony, planet } = args;
  const rates = productionRatesPerMinute({
    buildings: colony.buildings,
    overflow: colony.overflow,
    planet,
  });

  const alloyUnits = storedToWholeUnits(colony.resources.alloy);
  const crystalUnits = storedToWholeUnits(colony.resources.crystal);
  const fuelUnits = storedToWholeUnits(colony.resources.fuel);
  const alloyOverflowUnits = storedToWholeUnits(colony.overflow.alloy);
  const crystalOverflowUnits = storedToWholeUnits(colony.overflow.crystal);
  const fuelOverflowUnits = storedToWholeUnits(colony.overflow.fuel);

  const alloyCap = storedToWholeUnits(colony.storageCaps.alloy);
  const crystalCap = storedToWholeUnits(colony.storageCaps.crystal);
  const fuelCap = storedToWholeUnits(colony.storageCaps.fuel);

  return [
    {
      key: "alloy" as const,
      value: formatResourceValue(alloyUnits),
      valueAmount: alloyUnits,
      deltaPerMinute:
        alloyOverflowUnits > 0
          ? "Paused by overflow"
          : `+${Math.max(0, Math.floor(rates.resources.alloy)).toLocaleString()}/m`,
      deltaPerMinuteAmount:
        alloyOverflowUnits > 0 ? 0 : Math.max(0, Math.floor(rates.resources.alloy)),
      storageCurrentAmount: alloyUnits,
      storageCurrentLabel: formatResourceValue(alloyUnits),
      storageCapAmount: alloyCap,
      storageCapLabel: formatResourceValue(alloyCap),
      storagePercent:
        alloyCap <= 0 ? 0 : Math.min(100, (alloyUnits / alloyCap) * 100),
      overflowAmount: alloyOverflowUnits,
      overflowLabel: formatResourceValue(alloyOverflowUnits),
      pausedByOverflow: alloyOverflowUnits > 0,
    },
    {
      key: "crystal" as const,
      value: formatResourceValue(crystalUnits),
      valueAmount: crystalUnits,
      deltaPerMinute:
        crystalOverflowUnits > 0
          ? "Paused by overflow"
          : `+${Math.max(0, Math.floor(rates.resources.crystal)).toLocaleString()}/m`,
      deltaPerMinuteAmount:
        crystalOverflowUnits > 0
          ? 0
          : Math.max(0, Math.floor(rates.resources.crystal)),
      storageCurrentAmount: crystalUnits,
      storageCurrentLabel: formatResourceValue(crystalUnits),
      storageCapAmount: crystalCap,
      storageCapLabel: formatResourceValue(crystalCap),
      storagePercent:
        crystalCap <= 0 ? 0 : Math.min(100, (crystalUnits / crystalCap) * 100),
      overflowAmount: crystalOverflowUnits,
      overflowLabel: formatResourceValue(crystalOverflowUnits),
      pausedByOverflow: crystalOverflowUnits > 0,
    },
    {
      key: "fuel" as const,
      value: formatResourceValue(fuelUnits),
      valueAmount: fuelUnits,
      deltaPerMinute:
        fuelOverflowUnits > 0
          ? "Paused by overflow"
          : `+${Math.max(0, Math.floor(rates.resources.fuel)).toLocaleString()}/m`,
      deltaPerMinuteAmount:
        fuelOverflowUnits > 0 ? 0 : Math.max(0, Math.floor(rates.resources.fuel)),
      storageCurrentAmount: fuelUnits,
      storageCurrentLabel: formatResourceValue(fuelUnits),
      storageCapAmount: fuelCap,
      storageCapLabel: formatResourceValue(fuelCap),
      storagePercent:
        fuelCap <= 0 ? 0 : Math.min(100, (fuelUnits / fuelCap) * 100),
      overflowAmount: fuelOverflowUnits,
      overflowLabel: formatResourceValue(fuelOverflowUnits),
      pausedByOverflow: fuelOverflowUnits > 0,
    },
    {
      key: "energy" as const,
      value: `${Math.round(rates.energyRatio * 100)}%`,
      energyBalance: Math.round(rates.energyProduced - rates.energyConsumed),
    },
  ];
}

async function listPlayerColonyPlanets(args: {
  colonies: Array<Doc<"colonies">>;
  ctx: QueryCtx;
}) {
  const planetsById = new Map<Id<"planets">, Doc<"planets">>();
  await Promise.all(
    args.colonies.map(async (entry) => {
      if (planetsById.has(entry.planetId)) {
        return;
      }
      const colonyPlanet = await args.ctx.db.get(entry.planetId);
      if (colonyPlanet) {
        planetsById.set(colonyPlanet._id, colonyPlanet);
      }
    }),
  );
  return planetsById;
}

async function getBuildingQueueStatusForColony(args: {
  colonyId: Id<"colonies">;
  ctx: QueryCtx;
}): Promise<ColonyQueueStatus> {
  const queueRows = await listOpenLaneQueueItems({
    colonyId: args.colonyId,
    ctx: args.ctx,
    lane: "building",
  });
  const hasActive = queueRows.some((row) => row.status === "active");
  const hasPending = queueRows.some((row) => row.status === "queued");
  const status: ColonyQueueStatus = hasActive
    ? "Upgrading"
    : hasPending
      ? "Queued"
      : "Stable";
  return status;
}

const buildingCardValidator = v.object({
  key: buildingKeyValidator,
  name: v.string(),
  group: v.union(
    v.literal("Production"),
    v.literal("Power"),
    v.literal("Storage"),
  ),
  currentLevel: v.number(),
  maxLevel: v.number(),
  isUpgrading: v.boolean(),
  isQueued: v.boolean(),
  status: v.union(
    v.literal("Running"),
    v.literal("Overflow"),
    v.literal("Paused"),
    v.literal("Upgrading"),
    v.literal("Queued"),
  ),
  outputPerMinute: v.number(),
  outputLabel: v.string(),
  energyUsePerMinute: v.number(),
  canUpgrade: v.boolean(),
  nextUpgradeDurationSeconds: v.optional(v.number()),
  nextUpgradeCost: resourceBucketValidator,
});

const facilityCardValidator = v.object({
  key: facilityKeyValidator,
  name: v.string(),
  category: v.union(
    v.literal("infrastructure"),
    v.literal("research"),
    v.literal("military"),
  ),
  currentLevel: v.number(),
  maxLevel: v.number(),
  isUnlocked: v.boolean(),
  isUpgrading: v.boolean(),
  isQueued: v.boolean(),
  canUpgrade: v.boolean(),
  status: v.union(
    v.literal("Online"),
    v.literal("Queued"),
    v.literal("Constructing"),
    v.literal("Locked"),
    v.literal("Maxed"),
  ),
  nextUpgradeDurationSeconds: v.optional(v.number()),
  nextUpgradeCost: resourceBucketValidator,
});

const shipDefinitionViewValidator = v.object({
  key: shipKeyValidator,
  name: v.string(),
  requiredShipyardLevel: v.number(),
  owned: v.number(),
  queued: v.number(),
  cargoCapacity: v.number(),
  speed: v.number(),
  fuelPerDistance: v.number(),
  cost: resourceBucketValidator,
  perUnitDurationSeconds: v.number(),
  canBuild: v.boolean(),
});


export {
  BUILDING_LANE_BASE_CAPACITY,
  BUILDING_CONFIG,
  EMPTY_RESEARCH_LEVELS,
  ENERGY_BASE_CONSUMPTION,
  LANE_QUEUE_CAPACITY,
  OPEN_QUEUE_STATUSES,
  RESOURCE_KEYS,
  SHIPYARD_FACILITY_KEY,
  STORAGE_BUILDING_MAX_LEVEL,
  UPGRADE_BUILDING_KEYS,
  ALL_BUILDING_KEYS,
  buildHudResources,
  buildLaneQueueView,
  buildingCardValidator,
  buildingKeyValidator,
  cloneResourceBucket,
  colonyCoordinatesValidator,
  colonyStatusValidator,
  emptyLaneQueueView,
  emptyResourceBucket,
  energyConsumptionForLevel,
  facilityCardValidator,
  facilityKeyValidator,
  facilityLevelFromColony,
  facilityLevelsFromColony,
  formatResourceValue,
  getBuildingLaneCapacity,
  generatorConfigForBuilding,
  getBuildingQueueStatusForColony,
  getGeneratorOrThrow,
  getOwnedColony,
  getColonyShipCount,
  hashString,
  isBuildingUpgradeQueueItem,
  isFacilityUpgradeQueueItem,
  isShipBuildQueueItem,
  isStorageBuildingKey,
  incrementColonyShipCount,
  laneQueueViewValidator,
  listOpenColonyQueueItems,
  listOpenLaneQueueItems,
  listPlayerColonyPlanets,
  listPlayerColonies,
  loadColonyState,
  loadPlanetState,
  loadQueueWithPayload,
  productionRatesPerMinute,
  queueItemFromToLevel,
  queueLaneValidator,
  queueItemKindValidator,
  queueItemStatusValidator,
  queuePayloadValidator,
  queueViewItemValidator,
  resolveCurrentPlayer,
  resolvedAuthUserId,
  resolveDisplayName,
  resolveUniverse,
  resourceBucketValidator,
  resourceHudDatumValidator,
  resourceMapToScaledBucket,
  resourceMapToWholeUnitBucket,
  sessionStateValidator,
  sessionColonyValidator,
  setFacilityLevelOnBuildings,
  settleColonyAndPersist,
  settleShipyardQueue,
  shipDefinitionViewValidator,
  shipKeyValidator,
  storageCapsFromBuildings,
  storageUpgradeCost,
  storageUpgradeDurationSeconds,
  toAddressLabel,
  upsertColonyCompanionRows,
  upsertQueuePayloadRow,
  usedSlotsFromBuildings,
  queuesViewValidator,
  colonyQueueStatusValidator,
};
