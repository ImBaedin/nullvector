import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const RESOURCE_SCALE = 1_000;

const sectorTypeValidator = v.union(v.literal("core"), v.literal("frontier"));
const planetCompositionTypeValidator = v.union(
	v.literal("metallic"),
	v.literal("silicate"),
	v.literal("icy"),
	v.literal("volatileRich"),
);

const resourceBucketValidator = v.object({
	alloy: v.number(),
	crystal: v.number(),
	fuel: v.number(),
});

const shipKeyValidator = v.union(
	v.literal("smallCargo"),
	v.literal("largeCargo"),
	v.literal("colonyShip"),
	v.literal("interceptor"),
	v.literal("frigate"),
	v.literal("cruiser"),
	v.literal("bomber"),
);

const shipCountsValidator = v.object({
	smallCargo: v.number(),
	largeCargo: v.number(),
	colonyShip: v.number(),
	interceptor: v.optional(v.number()),
	frigate: v.optional(v.number()),
	cruiser: v.optional(v.number()),
	bomber: v.optional(v.number()),
});

const defenseKeyValidator = v.union(
	v.literal("missileBattery"),
	v.literal("laserTurret"),
	v.literal("gaussCannon"),
	v.literal("shieldDome"),
);

const defenseCountsValidator = v.object({
	missileBattery: v.number(),
	laserTurret: v.number(),
	gaussCannon: v.number(),
	shieldDome: v.number(),
});

const hostileFactionKeyValidator = v.union(v.literal("spacePirates"), v.literal("rogueAi"));
const hostilityStatusValidator = v.union(v.literal("hostile"), v.literal("cleared"));
const contractStatusValidator = v.union(
	v.literal("available"),
	v.literal("inProgress"),
	v.literal("completed"),
	v.literal("failed"),
	v.literal("expired"),
	v.literal("replaced"),
);
const combatMissionTypeKeyValidator = v.union(
	v.literal("salvageSweep"),
	v.literal("supplyCacheRaid"),
	v.literal("cruiserTakedown"),
	v.literal("bombingRun"),
	v.literal("glassProductionFacilities"),
	v.literal("supplyInterception"),
	v.literal("defenseGridSabotage"),
	v.literal("commandBunkerStrike"),
	v.literal("occupationConvoyRaid"),
	v.literal("reconInForce"),
);

const combatPriorityProfileValidator = v.object({
	attackerTargetPriority: v.array(v.union(shipKeyValidator, defenseKeyValidator)),
	defenderTargetPriority: v.array(shipKeyValidator),
});

const contractSnapshotValidator = v.object({
	controlReduction: v.number(),
	difficultyTier: v.number(),
	enemyDefenses: defenseCountsValidator,
	enemyFleet: shipCountsValidator,
	hostileFactionKey: hostileFactionKeyValidator,
	missionTypeKey: combatMissionTypeKeyValidator,
	priorityProfile: combatPriorityProfileValidator,
	requiredRank: v.number(),
	rewardCredits: v.number(),
	rewardRankXpFailure: v.number(),
	rewardRankXpSuccess: v.number(),
	rewardResources: resourceBucketValidator,
});

const buildingLevelsValidator = v.object({
	alloyMineLevel: v.number(),
	crystalMineLevel: v.number(),
	fuelRefineryLevel: v.number(),
	powerPlantLevel: v.number(),
	alloyStorageLevel: v.number(),
	crystalStorageLevel: v.number(),
	fuelStorageLevel: v.number(),
	roboticsHubLevel: v.optional(v.number()),
	shipyardLevel: v.number(),
	defenseGridLevel: v.optional(v.number()),
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

const queueLaneValidator = v.union(
	v.literal("building"),
	v.literal("shipyard"),
	v.literal("defense"),
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
	v.literal("defenseBuild"),
);

const facilityKeyValidator = v.union(
	v.literal("robotics_hub"),
	v.literal("shipyard"),
	v.literal("defense_grid"),
);

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
	v.object({
		defenseKey: defenseKeyValidator,
		quantity: v.number(),
		completedQuantity: v.number(),
		perUnitDurationSeconds: v.number(),
	}),
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
	contractId: v.optional(v.id("contracts")),
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

const devConsoleActionTypeValidator = v.union(
	v.literal("setColonyResources"),
	v.literal("setBuildingLevels"),
	v.literal("setFacilityLevels"),
	v.literal("setShipCounts"),
	v.literal("setDefenseCounts"),
	v.literal("triggerNpcRaid"),
	v.literal("completeActiveRaid"),
	v.literal("completeActiveQueueItem"),
	v.literal("completeActiveMission"),
);

export default defineSchema({
	universes: defineTable({
		slug: v.string(),
		name: v.string(),
		isActive: v.boolean(),
		orbitEpochMs: v.number(),
		hostilitySeededAt: v.optional(v.number()),
		hostilitySeedingClaimedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_is_active", ["isActive"]),

	universeGeneration: defineTable({
		universeId: v.id("universes"),
		seed: v.optional(v.string()),
		coordinateConfig: v.object({
			sectorWidth: v.number(),
			sectorHeight: v.number(),
			systemMinDistance: v.number(),
		}),
		generationConfig: v.object({
			galaxyCount: v.number(),
			systemsPerSector: v.number(),
			minPlanetsPerSystem: v.number(),
			maxPlanetsPerSystem: v.number(),
			minCoreSectors: v.optional(v.number()),
			minUnclaimedColonizablePlanets: v.optional(v.number()),
			maxSectorsPerRun: v.optional(v.number()),
		}),
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
	}).index("by_universe_id", ["universeId"]),

	galaxies: defineTable({
		universeId: v.id("universes"),
		galaxyIndex: v.number(),
		name: v.optional(v.string()),
		gx: v.number(),
		gy: v.number(),
		seed: v.string(),
		createdAt: v.number(),
	})
		.index("by_universe_id_and_galaxy_index", ["universeId", "galaxyIndex"])
		.index("by_universe_id", ["universeId"]),

	sectors: defineTable({
		universeId: v.id("universes"),
		galaxyId: v.id("galaxies"),
		galaxyIndex: v.number(),
		sectorIndex: v.number(),
		name: v.optional(v.string()),
		sectorType: sectorTypeValidator,
		seed: v.string(),
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

	systems: defineTable({
		universeId: v.id("universes"),
		galaxyId: v.id("galaxies"),
		sectorId: v.id("sectors"),
		galaxyIndex: v.number(),
		sectorIndex: v.number(),
		systemIndex: v.number(),
		name: v.optional(v.string()),
		x: v.number(),
		y: v.number(),
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

	planets: defineTable({
		universeId: v.id("universes"),
		systemId: v.id("systems"),
		galaxyIndex: v.number(),
		sectorIndex: v.number(),
		systemIndex: v.number(),
		planetIndex: v.number(),
		name: v.optional(v.string()),
		orbitRadius: v.number(),
		orbitPhaseRad: v.number(),
		orbitAngularVelocityRadPerSec: v.number(),
		orbitalDistance: v.number(),
		planetSize: v.number(),
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
		]),

	planetEconomy: defineTable({
		planetId: v.id("planets"),
		universeId: v.id("universes"),
		compositionType: planetCompositionTypeValidator,
		maxBuildingSlots: v.number(),
		alloyMultiplier: v.number(),
		crystalMultiplier: v.number(),
		fuelMultiplier: v.number(),
		isColonizable: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_planet_id", ["planetId"])
		.index("by_uni_colon", ["universeId", "isColonizable"]),

	sectorHostility: defineTable({
		universeId: v.id("universes"),
		sectorId: v.id("sectors"),
		hostileFactionKey: hostileFactionKeyValidator,
		status: hostilityStatusValidator,
		hostilePlanetCount: v.number(),
		clearedPlanetCount: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_sector_id", ["sectorId"])
		.index("by_universe_status", ["universeId", "status"])
		.index("by_universe_faction", ["universeId", "hostileFactionKey"]),

	planetHostility: defineTable({
		universeId: v.id("universes"),
		sectorId: v.id("sectors"),
		planetId: v.id("planets"),
		hostileFactionKey: hostileFactionKeyValidator,
		controlMax: v.number(),
		controlCurrent: v.number(),
		status: hostilityStatusValidator,
		clearedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_planet_id", ["planetId"])
		.index("by_sector_status", ["sectorId", "status"])
		.index("by_universe_status", ["universeId", "status"]),

	players: defineTable({
		authUserId: v.string(),
		displayName: v.string(),
		devConsoleEnabled: v.optional(v.boolean()),
		devConsoleUiEnabled: v.optional(v.boolean()),
		createdAt: v.number(),
		lastSeenAt: v.number(),
	})
		.index("by_auth_user_id", ["authUserId"])
		.index("by_created_at", ["createdAt"]),

	playerProgression: defineTable({
		playerId: v.id("players"),
		credits: v.number(),
		rank: v.number(),
		rankXp: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_player_id", ["playerId"]),

	devConsoleActions: defineTable({
		actorPlayerId: v.id("players"),
		actionType: devConsoleActionTypeValidator,
		targetColonyId: v.optional(v.id("colonies")),
		targetOperationId: v.optional(v.id("fleetOperations")),
		payloadJson: v.string(),
		resultJson: v.optional(v.string()),
		createdAt: v.number(),
	}).index("by_actor_created", ["actorPlayerId", "createdAt"]),

	colonies: defineTable({
		universeId: v.id("universes"),
		playerId: v.id("players"),
		planetId: v.id("planets"),
		name: v.string(),
		queueResolutionScheduledAt: v.optional(v.number()),
		queueResolutionJobId: v.optional(v.id("_scheduled_functions")),
		nextNpcRaidAt: v.optional(v.number()),
		npcRaidSchedulingJobId: v.optional(v.id("_scheduled_functions")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_player_id", ["playerId"])
		.index("by_planet_id", ["planetId"])
		.index("by_player_universe", ["playerId", "universeId"])
		.index("by_universe_id", ["universeId"]),

	colonyEconomy: defineTable({
		colonyId: v.id("colonies"),
		resources: resourceBucketValidator,
		overflow: resourceBucketValidator,
		storageCaps: resourceBucketValidator,
		lastAccruedAt: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_colony_id", ["colonyId"]),

	colonyInfrastructure: defineTable({
		colonyId: v.id("colonies"),
		buildings: buildingLevelsValidator,
		usedSlots: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_colony_id", ["colonyId"]),

	colonyPolicy: defineTable({
		colonyId: v.id("colonies"),
		inboundMissionPolicy: v.optional(inboundMissionPolicyValidator),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_colony_id", ["colonyId"]),

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

	colonyDefenses: defineTable({
		universeId: v.id("universes"),
		playerId: v.id("players"),
		colonyId: v.id("colonies"),
		defenseKey: defenseKeyValidator,
		count: v.number(),
		updatedAt: v.number(),
	})
		.index("by_colony_and_defense_key", ["colonyId", "defenseKey"])
		.index("by_colony", ["colonyId"])
		.index("by_player", ["playerId"]),

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
		fuelCharged: v.number(),
		distance: v.number(),
		departAt: v.number(),
		arriveAt: v.number(),
		nextEventAt: v.number(),
		resolutionScheduledAt: v.optional(v.number()),
		resolutionJobId: v.optional(v.id("_scheduled_functions")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner_stat_evt", ["ownerPlayerId", "status", "nextEventAt"])
		.index("by_stat_evt", ["status", "nextEventAt"])
		.index("by_origin_stat_evt", ["originColonyId", "status", "nextEventAt"])
		.index("by_target_planet_status", ["target.planetId", "status"])
		.index("by_tplanet_st_evt", ["target.planetId", "status", "nextEventAt"])
		.index("by_parent_op", ["parentOperationId"])
		.index("by_fleet_stat", ["fleetId", "status"]),

	fleetOperationResults: defineTable({
		operationId: v.id("fleetOperations"),
		universeId: v.id("universes"),
		ownerPlayerId: v.id("players"),
		cargoDeliveredToStorage: resourceBucketValidator,
		cargoDeliveredToOverflow: resourceBucketValidator,
		fuelWaived: v.optional(v.number()),
		cancelledAt: v.optional(v.number()),
		resolvedAt: v.optional(v.number()),
		resultCode: v.optional(fleetOperationResultCodeValidator),
		resultMessage: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_operation_id", ["operationId"])
		.index("by_owner_id", ["ownerPlayerId"]),

	fleetEvents: defineTable({
		universeId: v.id("universes"),
		ownerPlayerId: v.id("players"),
		fleetId: v.id("fleets"),
		operationId: v.id("fleetOperations"),
		eventType: fleetEventTypeValidator,
		occurredAt: v.number(),
		dataJson: v.string(),
		createdAt: v.number(),
	})
		.index("by_owner_time", ["ownerPlayerId", "occurredAt"])
		.index("by_operation_time", ["operationId", "occurredAt"])
		.index("by_fleet_time", ["fleetId", "occurredAt"]),

	npcRaidOperations: defineTable({
		universeId: v.id("universes"),
		targetColonyId: v.id("colonies"),
		targetPlayerId: v.id("players"),
		sourcePlanetId: v.optional(v.id("planets")),
		hostileFactionKey: hostileFactionKeyValidator,
		status: v.union(
			v.literal("scheduled"),
			v.literal("inTransit"),
			v.literal("resolved"),
			v.literal("cancelled"),
		),
		difficultyTier: v.number(),
		attackerFleet: shipCountsValidator,
		attackerTargetPriority: v.array(v.union(shipKeyValidator, defenseKeyValidator)),
		defenderTargetPriority: v.array(shipKeyValidator),
		departAt: v.number(),
		arriveAt: v.number(),
		nextEventAt: v.number(),
		resolutionScheduledAt: v.optional(v.number()),
		resolutionJobId: v.optional(v.id("_scheduled_functions")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_target_status_event", ["targetColonyId", "status", "nextEventAt"])
		.index("by_status_event", ["status", "nextEventAt"])
		.index("by_target_player_status_event", ["targetPlayerId", "status", "nextEventAt"]),

	npcRaidResults: defineTable({
		raidOperationId: v.id("npcRaidOperations"),
		universeId: v.id("universes"),
		targetColonyId: v.id("colonies"),
		targetPlayerId: v.id("players"),
		hostileFactionKey: hostileFactionKeyValidator,
		success: v.boolean(),
		roundsFought: v.number(),
		attackerSurvivors: shipCountsValidator,
		defenderSurvivors: v.object({
			fleet: shipCountsValidator,
			defenses: defenseCountsValidator,
		}),
		resourcesLooted: resourceBucketValidator,
		salvageGranted: resourceBucketValidator,
		rankXpDelta: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_raid_operation_id", ["raidOperationId"])
		.index("by_target_colony_id", ["targetColonyId"])
		.index("by_target_player_id", ["targetPlayerId"]),

	contracts: defineTable({
		universeId: v.id("universes"),
		playerId: v.id("players"),
		sectorId: v.id("sectors"),
		planetId: v.id("planets"),
		hostileFactionKey: hostileFactionKeyValidator,
		slot: v.number(),
		status: contractStatusValidator,
		missionTypeKey: combatMissionTypeKeyValidator,
		difficultyTier: v.number(),
		requiredRank: v.number(),
		expiresAt: v.optional(v.number()),
		acceptedAt: v.optional(v.number()),
		resolvedAt: v.optional(v.number()),
		originColonyId: v.optional(v.id("colonies")),
		operationId: v.optional(v.id("fleetOperations")),
		snapshot: contractSnapshotValidator,
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_player_planet_status", ["playerId", "planetId", "status"])
		.index("by_player_status", ["playerId", "status"])
		.index("by_operation_id", ["operationId"])
		.index("by_player_planet_slot", ["playerId", "planetId", "slot"]),

	contractResults: defineTable({
		contractId: v.id("contracts"),
		operationId: v.id("fleetOperations"),
		playerId: v.id("players"),
		planetId: v.id("planets"),
		success: v.boolean(),
		roundsFought: v.number(),
		attackerSurvivors: shipCountsValidator,
		defenderSurvivors: v.object({
			fleet: shipCountsValidator,
			defenses: defenseCountsValidator,
		}),
		rewardCreditsGranted: v.number(),
		rewardRankXpGranted: v.number(),
		rewardCargoLoaded: resourceBucketValidator,
		rewardCargoLostByCapacity: resourceBucketValidator,
		controlReductionApplied: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_contract_id", ["contractId"])
		.index("by_operation_id", ["operationId"])
		.index("by_player_id", ["playerId"]),

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
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_col_lane_ord", ["colonyId", "lane", "order"])
		.index("by_col_lane_st", ["colonyId", "lane", "status"])
		.index("by_col_st_time", ["colonyId", "status", "completesAt"])
		.index("by_col_lane_time", ["colonyId", "lane", "completesAt"])
		.index("by_player_st_time", ["playerId", "status", "completesAt"])
		.index("by_pl_lane_st_time", ["playerId", "lane", "status", "completesAt"]),

	colonyQueuePayloads: defineTable({
		queueItemId: v.id("colonyQueueItems"),
		universeId: v.id("universes"),
		playerId: v.id("players"),
		colonyId: v.id("colonies"),
		lane: queueLaneValidator,
		kind: queueItemKindValidator,
		cost: resourceBucketValidator,
		payload: queuePayloadValidator,
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_queue_item_id", ["queueItemId"])
		.index("by_colony_id", ["colonyId"]),
});
