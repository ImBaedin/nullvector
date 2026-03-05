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
  v.literal("volatileRich"),
);
// Shared resource shape used in colony state, queue costs, and fleet payloads.
const resourceBucketValidator = v.object({
  alloy: v.number(),
  crystal: v.number(),
  fuel: v.number(),
});

const shipKeyValidator = v.union(
  v.literal("smallCargo"),
  v.literal("largeCargo"),
  v.literal("colonyShip"),
);

const shipCountsValidator = v.object({
  smallCargo: v.number(),
  largeCargo: v.number(),
  colonyShip: v.number(),
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
  v.literal("powerPlantLevel"),
  v.literal("alloyStorageLevel"),
  v.literal("crystalStorageLevel"),
  v.literal("fuelStorageLevel"),
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
  v.literal("research"),
);

const queueItemStatusValidator = v.union(
  v.literal("queued"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed"),
);

const queueItemKindValidator = v.union(
  v.literal("buildingUpgrade"),
  v.literal("facilityUpgrade"),
  v.literal("shipBuild"),
);

const facilityKeyValidator = v.union(v.literal("shipyard"));

const queuePayloadValidator = v.union(
  v.object({
    buildingKey: upgradeBuildingKeyValidator,
    fromLevel: v.number(),
    toLevel: v.number(),
  }),
  v.object({
    facilityKey: facilityKeyValidator,
    fromLevel: v.number(),
    toLevel: v.number(),
  }),
  v.object({
    shipKey: shipKeyValidator,
    quantity: v.number(),
    completedQuantity: v.number(),
    perUnitDurationSeconds: v.number(),
  }),
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

const transportPostDeliveryActionValidator = v.union(
  v.literal("returnToOrigin"),
  v.literal("stationAtDestination"),
);

const inboundMissionPolicyValidator = v.union(
  v.literal("allowAll"),
  v.literal("denyAll"),
  v.literal("alliesOnly"),
);

const fleetStateValidator = v.union(
  v.literal("stationed"),
  v.literal("inTransit"),
  v.literal("atTarget"),
  v.literal("returning"),
  v.literal("destroyed"),
);

const fleetLocationKindValidator = v.union(
  v.literal("colony"),
  v.literal("route"),
  v.literal("planetOrbit"),
  v.literal("contractNode"),
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

const fleetOperationTargetKindValidator = v.union(
  v.literal("colony"),
  v.literal("planet"),
  v.literal("fleet"),
  v.literal("contractNode"),
);

const fleetOperationTargetValidator = v.object({
  kind: fleetOperationTargetKindValidator,
  colonyId: v.optional(v.id("colonies")),
  planetId: v.optional(v.id("planets")),
  fleetId: v.optional(v.id("fleets")),
  contractNodeKey: v.optional(v.string()),
});

const fleetOperationResultCodeValidator = v.union(
  v.literal("delivered"),
  v.literal("colonized"),
  v.literal("cancelledInFlight"),
  v.literal("notImplemented"),
  v.literal("failed"),
);

const fleetEventTypeValidator = v.union(
  v.literal("created"),
  v.literal("departed"),
  v.literal("arrived"),
  v.literal("cargoDelivered"),
  v.literal("colonyFounded"),
  v.literal("cancelled"),
  v.literal("returned"),
  v.literal("failed"),
);

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
      }),
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
    // Default allowAll keeps current behavior while enabling future controls.
    inboundMissionPolicy: v.optional(inboundMissionPolicyValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_player_id", ["playerId"])
    .index("by_planet_id", ["planetId"])
    .index("by_player_id_and_universe_id", ["playerId", "universeId"])
    .index("by_universe_id", ["universeId"]),

  colonyShips: defineTable({
    universeId: v.id("universes"),
    playerId: v.id("players"),
    colonyId: v.id("colonies"),
    shipKey: shipKeyValidator,
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_colony_and_ship_key", ["colonyId", "shipKey"])
    .index("by_colony", ["colonyId"])
    .index("by_player", ["playerId"]),

  // Unified outbound/return fleet missions.
  fleetMissions: defineTable({
    universeId: v.id("universes"),
    playerId: v.id("players"),
    missionType: fleetMissionTypeValidator,
    status: fleetMissionStatusValidator,
    originColonyId: v.id("colonies"),
    targetColonyId: v.optional(v.id("colonies")),
    targetPlanetId: v.optional(v.id("planets")),
    postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
    parentMissionId: v.optional(v.id("fleetMissions")),
    shipCounts: shipCountsValidator,
    // Requested cargo at dispatch time.
    cargoRequested: resourceBucketValidator,
    // Portion accepted into destination storage on arrival.
    cargoDeliveredToStorage: resourceBucketValidator,
    // Portion routed into destination overflow when storage is full.
    cargoDeliveredToOverflow: resourceBucketValidator,
    // Scaled integer fuel charge booked against this mission leg.
    fuelCharged: v.number(),
    // Optional waived fuel (used on cancellation return shortfall policy).
    fuelWaived: v.optional(v.number()),
    // Distance basis used to derive travel duration and fuel cost.
    distance: v.number(),
    departAt: v.number(),
    arriveAt: v.number(),
    cancelledAt: v.optional(v.number()),
    // Populated when mission reaches a terminal state.
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_player_status_arrive", ["playerId", "status", "arriveAt"])
    .index("by_target_planet_status", ["targetPlanetId", "status"])
    .index("by_origin_status_arrive", ["originColonyId", "status", "arriveAt"])
    .index("by_parent", ["parentMissionId"]),

  // Persistent movable assets used by the V2 fleet operation engine.
  fleets: defineTable({
    universeId: v.id("universes"),
    ownerPlayerId: v.id("players"),
    homeColonyId: v.id("colonies"),
    state: fleetStateValidator,
    locationKind: fleetLocationKindValidator,
    locationColonyId: v.optional(v.id("colonies")),
    locationPlanetId: v.optional(v.id("planets")),
    routeOperationId: v.optional(v.id("fleetOperations")),
    shipCounts: shipCountsValidator,
    cargo: resourceBucketValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_state", ["ownerPlayerId", "state"])
    .index("by_owner_home", ["ownerPlayerId", "homeColonyId"])
    .index("by_home_state", ["homeColonyId", "state"]),

  // Generic fleet operation records with kind-specific behavior in runtime.
  fleetOperations: defineTable({
    universeId: v.id("universes"),
    ownerPlayerId: v.id("players"),
    fleetId: v.id("fleets"),
    kind: fleetOperationKindValidator,
    status: fleetOperationStatusValidator,
    originColonyId: v.id("colonies"),
    target: fleetOperationTargetValidator,
    postDeliveryAction: v.optional(transportPostDeliveryActionValidator),
    parentOperationId: v.optional(v.id("fleetOperations")),
    shipCounts: shipCountsValidator,
    cargoRequested: resourceBucketValidator,
    cargoDeliveredToStorage: resourceBucketValidator,
    cargoDeliveredToOverflow: resourceBucketValidator,
    fuelCharged: v.number(),
    fuelWaived: v.optional(v.number()),
    distance: v.number(),
    departAt: v.number(),
    arriveAt: v.number(),
    nextEventAt: v.number(),
    cancelledAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    resultCode: v.optional(fleetOperationResultCodeValidator),
    resultMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_stat_evt", ["ownerPlayerId", "status", "nextEventAt"])
    .index("by_stat_evt", ["status", "nextEventAt"])
    .index("by_origin_stat_evt", ["originColonyId", "status", "nextEventAt"])
    .index("by_target_planet_stat", ["target.planetId", "status"])
    .index("by_parent_op", ["parentOperationId"])
    .index("by_fleet_stat", ["fleetId", "status"]),

  // Append-only audit trail for timelines and debugging.
  fleetEvents: defineTable({
    universeId: v.id("universes"),
    ownerPlayerId: v.id("players"),
    fleetId: v.id("fleets"),
    operationId: v.id("fleetOperations"),
    eventType: fleetEventTypeValidator,
    occurredAt: v.number(),
    // Keep payload flexible while retaining top-level typed envelope.
    dataJson: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner_time", ["ownerPlayerId", "occurredAt"])
    .index("by_op_time", ["operationId", "occurredAt"])
    .index("by_fleet_time", ["fleetId", "occurredAt"]),

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
