import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// All resource quantities are stored as scaled integers to avoid floating drift.
// Example: 1.0 resource unit is represented as 1000 in storage.
export const RESOURCE_SCALE = 1_000;

// Sector availability model for expansion.
const sectorTypeValidator = v.union(v.literal("core"), v.literal("frontier"));
// Broad planet makeup used by generation and multiplier logic.
const planetCompositionTypeValidator = v.union(
  v.literal("metallic"),
  v.literal("silicate"),
  v.literal("icy"),
  v.literal("volatileRich")
);
// MVP transport lifecycle.
const transportStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("inTransit"),
  v.literal("delivered")
);

// Shared resource shape used in colony state and transport payloads.
const resourceBucketValidator = v.object({
  alloy: v.number(),
  crystal: v.number(),
  fuel: v.number(),
});

// Explicit building fields keep mutations and migrations predictable.
const buildingLevelsValidator = v.object({
  alloyMineLevel: v.number(),
  crystalMineLevel: v.number(),
  fuelRefineryLevel: v.number(),
  powerPlantLevel: v.number(),
  alloyStorageLevel: v.number(),
  crystalStorageLevel: v.number(),
  fuelStorageLevel: v.number(),
  shipyardLevel: v.number(),
});

const upgradeBuildingKeyValidator = v.union(
  v.literal("alloyMineLevel"),
  v.literal("crystalMineLevel"),
  v.literal("fuelRefineryLevel"),
  v.literal("powerPlantLevel")
);

const activeUpgradeValidator = v.object({
  buildingKey: upgradeBuildingKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
  queuedAt: v.number(),
  completesAt: v.number(),
  cost: resourceBucketValidator,
});

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
  buildingKey: upgradeBuildingKeyValidator,
  fromLevel: v.number(),
  toLevel: v.number(),
});

export default defineSchema({
  // Global world config. MVP expects one active universe, but all gameplay rows
  // still carry universeId for future multi-universe support.
  universes: defineTable({
    // Stable lookup key, e.g. "main".
    slug: v.string(),
    name: v.string(),
    // Used by the app layer to enforce exactly one active universe.
    isActive: v.boolean(),
    // Absolute time anchor for orbit simulation:
    // angle = phase + velocity * ((nowMs - orbitEpochMs) / 1000).
    orbitEpochMs: v.number(),
    // Root deterministic seed for all generation branches in this universe.
    seed: v.optional(v.string()),
    // Rendering-space conventions for galaxy/sector maps.
    coordinateConfig: v.object({
      sectorWidth: v.number(),
      sectorHeight: v.number(),
      systemMinDistance: v.number(),
    }),
    // Generation knobs for deterministic world creation.
    generationConfig: v.object({
      galaxyCount: v.number(),
      systemsPerSector: v.number(),
      minPlanetsPerSystem: v.number(),
      maxPlanetsPerSystem: v.number(),
      // Optional policy defaults for lazy core-capacity generation.
      minCoreSectors: v.optional(v.number()),
      minUnclaimedColonizablePlanets: v.optional(v.number()),
      maxSectorsPerRun: v.optional(v.number()),
    }),
    // Lazy generation progress counters for bounded/resumable expansion.
    generationState: v.optional(
      v.object({
        schemaVersion: v.number(),
        nextCoreSectorIndexByGalaxy: v.array(v.number()),
        nextGalaxyCursor: v.number(),
        coreSectorsGenerated: v.number(),
        colonizablePlanetsGenerated: v.number(),
        lastRunAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_is_active", ["isActive"]),

  // Top-level world partitions. gx/gy are world-space anchors for each galaxy.
  galaxies: defineTable({
    universeId: v.id("universes"),
    // Logical address component, 0-based inside a universe.
    galaxyIndex: v.number(),
    name: v.string(),
    // Galaxy world-space anchor offset.
    gx: v.number(),
    gy: v.number(),
    // Deterministic generation seed for child structures.
    seed: v.string(),
    createdAt: v.number(),
  })
    .index("by_universe_id_and_galaxy_index", ["universeId", "galaxyIndex"])
    .index("by_universe_id", ["universeId"]),

  // Instancing unit for expansion (core/frontier) and map chunking.
  sectors: defineTable({
    universeId: v.id("universes"),
    galaxyId: v.id("galaxies"),
    // Duplicated for fast address-based queries without extra joins.
    galaxyIndex: v.number(),
    // Logical address component, 0-based inside a galaxy.
    sectorIndex: v.number(),
    sectorType: sectorTypeValidator,
    seed: v.string(),
    // World-space bounding box used for placement and map rendering.
    minX: v.number(),
    maxX: v.number(),
    minY: v.number(),
    maxY: v.number(),
    createdAt: v.number(),
  })
    .index("by_universe_id_and_galaxy_index_and_sector_index", [
      "universeId",
      "galaxyIndex",
      "sectorIndex",
    ])
    .index("by_universe_id_and_sector_type", ["universeId", "sectorType"])
    .index("by_galaxy_id", ["galaxyId"]),

  // Solar systems with stable logical addresses and sector-space coordinates.
  systems: defineTable({
    universeId: v.id("universes"),
    galaxyId: v.id("galaxies"),
    sectorId: v.id("sectors"),
    // Denormalized address fields for efficient filtering and sorting.
    galaxyIndex: v.number(),
    sectorIndex: v.number(),
    // Logical address component, 0-based inside a sector.
    systemIndex: v.number(),
    // Universe-space coordinates derived from galaxy-anchored sector bounds.
    x: v.number(),
    y: v.number(),
    // Minimal star descriptor for presentation and future rules.
    starKind: v.string(),
    seed: v.string(),
    createdAt: v.number(),
  })
    .index("by_sector_id_and_system_index", ["sectorId", "systemIndex"])
    .index("by_sector_id_and_x_and_y", ["sectorId", "x", "y"])
    .index("by_universe_and_galaxy_and_sector_and_system", [
      "universeId",
      "galaxyIndex",
      "sectorIndex",
      "systemIndex",
    ]),

  // Colonizable bodies and their economic/orbital characteristics.
  planets: defineTable({
    universeId: v.id("universes"),
    systemId: v.id("systems"),
    // Denormalized address fields for direct address lookups.
    galaxyIndex: v.number(),
    sectorIndex: v.number(),
    systemIndex: v.number(),
    // Logical address component, 0-based inside a system.
    planetIndex: v.number(),
    // Orbit values for deterministic in-system placement over time.
    orbitRadius: v.number(),
    orbitPhaseRad: v.number(),
    orbitAngularVelocityRadPerSec: v.number(),
    // Gameplay orbital distance input (separate from visual radius if needed).
    orbitalDistance: v.number(),
    planetSize: v.number(),
    compositionType: planetCompositionTypeValidator,
    maxBuildingSlots: v.number(),
    // Per-resource production multipliers, clamped by the application layer.
    alloyMultiplier: v.number(),
    crystalMultiplier: v.number(),
    fuelMultiplier: v.number(),
    isColonizable: v.boolean(),
    seed: v.string(),
    createdAt: v.number(),
  })
    .index("by_system_id_and_planet_index", ["systemId", "planetIndex"])
    .index("by_universe_and_galaxy_and_sector_and_system_and_planet", [
      "universeId",
      "galaxyIndex",
      "sectorIndex",
      "systemIndex",
      "planetIndex",
    ])
    .index("by_system_id_and_is_colonizable", ["systemId", "isColonizable"]),

  // Game profile mapped from Better Auth identity.
  players: defineTable({
    // Better Auth user document _id.
    authUserId: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_created_at", ["createdAt"]),

  // Planet-local player state. Resources are not globally shared.
  colonies: defineTable({
    universeId: v.id("universes"),
    playerId: v.id("players"),
    planetId: v.id("planets"),
    name: v.string(),
    // Current storable amounts (scaled integers).
    resources: resourceBucketValidator,
    // Excess from transport arrival. If overflow.resource > 0, local production
    // for that resource is paused until overflow is cleared by later logic.
    overflow: resourceBucketValidator,
    // Max storable amounts from storage building levels.
    storageCaps: resourceBucketValidator,
    buildings: buildingLevelsValidator,
    // Current occupied building slots on this planet.
    usedSlots: v.number(),
    // Tickless accrual anchor timestamp for production calculations.
    lastAccruedAt: v.number(),
    // Deprecated legacy single-upgrade state. New runtime uses colonyQueueItems.
    activeUpgrade: v.optional(activeUpgradeValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_player_id", ["playerId"])
    .index("by_planet_id", ["planetId"])
    .index("by_player_id_and_universe_id", ["playerId", "universeId"])
    .index("by_universe_id", ["universeId"]),

  // Resource shipment records between a player's colonies.
  transports: defineTable({
    universeId: v.id("universes"),
    playerId: v.id("players"),
    originColonyId: v.id("colonies"),
    destinationColonyId: v.id("colonies"),
    // Requested cargo at dispatch time.
    cargoRequested: resourceBucketValidator,
    // Portion accepted into destination storage on arrival.
    cargoDeliveredToStorage: resourceBucketValidator,
    // Portion routed into destination overflow when storage is full.
    cargoDeliveredToOverflow: resourceBucketValidator,
    // Scaled integer fuel charge for this mission.
    fuelCost: v.number(),
    // Distance basis used to derive travel duration and fuel cost.
    distance: v.number(),
    departAt: v.number(),
    arriveAt: v.number(),
    status: transportStatusValidator,
    // Populated when mission reaches a terminal state.
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_player_id_and_status", ["playerId", "status"])
    .index("by_player_id_and_arrive_at", ["playerId", "arriveAt"])
    .index("by_destination_colony_id_and_status", [
      "destinationColonyId",
      "status",
    ])
    .index("by_universe_id_and_status_and_arrive_at", [
      "universeId",
      "status",
      "arriveAt",
    ]),

  // Lane-scoped production/build queues and their history.
  colonyQueueItems: defineTable({
    universeId: v.id("universes"),
    playerId: v.id("players"),
    colonyId: v.id("colonies"),
    lane: queueLaneValidator,
    kind: queueItemKindValidator,
    status: queueItemStatusValidator,
    order: v.number(),
    queuedAt: v.number(),
    startsAt: v.number(),
    completesAt: v.number(),
    resolvedAt: v.optional(v.number()),
    cost: resourceBucketValidator,
    payload: queuePayloadValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_col_lane_ord", ["colonyId", "lane", "order"])
    .index("by_col_lane_st", ["colonyId", "lane", "status"])
    .index("by_col_st_time", ["colonyId", "status", "completesAt"])
    .index("by_col_lane_time", ["colonyId", "lane", "completesAt"])
    .index("by_player_st_time", ["playerId", "status", "completesAt"]),
});
