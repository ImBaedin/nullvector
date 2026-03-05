import {
  getUpgradeCost,
  getUpgradeDurationSeconds,
} from "@nullvector/game-logic";
import type {
  ResourceBucket,
  ResourceBuildingCardData,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import { mutation, query } from "../../convex/_generated/server";
import {
  BUILDING_CONFIG,
  BUILDING_LANE_CAPACITY,
  OPEN_QUEUE_STATUSES,
  RESOURCE_KEYS,
  STORAGE_BUILDING_MAX_LEVEL,
  UPGRADE_BUILDING_KEYS,
  buildLaneQueueView,
  buildingCardValidator,
  buildingKeyValidator,
  cloneResourceBucket,
  emptyLaneQueueView,
  emptyResourceBucket,
  energyConsumptionForLevel,
  getGeneratorOrThrow,
  getOwnedColony,
  isBuildingUpgradeQueueItem,
  isStorageBuildingKey,
  listOpenColonyQueueItems,
  listOpenLaneQueueItems,
  productionRatesPerMinute,
  queueEventsNextAt,
  queueLaneValidator,
  queueItemStatusValidator,
  queuesViewValidator,
  resourceBucketValidator,
  resourceMapToScaledBucket,
  resourceMapToWholeUnitBucket,
  scaledUnits,
  settleColonyAndPersist,
  storageCapsFromBuildings,
  storageUpgradeCost,
  storageUpgradeDurationSeconds,
  storedToWholeUnits,
  toAddressLabel,
} from "./shared";
import type { ProductionBuildingKey, StorageBuildingKey } from "./shared";
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
    planetMultipliers: v.object({
      alloy: v.number(),
      crystal: v.number(),
      fuel: v.number(),
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

    const queueRows = await listOpenColonyQueueItems({
      colonyId: colony._id,
      ctx,
    });
    const buildingLane = buildLaneQueueView({
      lane: "building",
      now,
      rows: queueRows,
    });
    const shipyardLane = buildLaneQueueView({
      lane: "shipyard",
      now,
      rows: queueRows,
    });
    const researchLane = emptyLaneQueueView("research");
    const queueBlocked = buildingLane.isFull;
    const openBuildingQueueRows = queueRows.filter(
      (row) =>
        row.lane === "building" && OPEN_QUEUE_STATUSES.includes(row.status),
    );

    const affordable = (cost: ResourceBucket) =>
      RESOURCE_KEYS.every(
        (key) => colony.resources[key] >= scaledUnits(cost[key]),
      );

    const cards: ResourceBuildingCardData[] = UPGRADE_BUILDING_KEYS.map((key) => {
      const config = BUILDING_CONFIG[key];
      const currentLevel = colony.buildings[key];
      const projectedLevel = openBuildingQueueRows.reduce((level, row) => {
        if (!isBuildingUpgradeQueueItem(row) || row.payload.buildingKey !== key) {
          return level;
        }
        return Math.max(level, row.payload.toLevel);
      }, currentLevel);
      const isUpgrading = Boolean(
        buildingLane.activeItem &&
        "buildingKey" in buildingLane.activeItem.payload &&
        buildingLane.activeItem.payload.buildingKey === key,
      );
      const isQueued = buildingLane.pendingItems.some(
        (item) =>
          "buildingKey" in item.payload && item.payload.buildingKey === key,
      );

      let maxLevel = STORAGE_BUILDING_MAX_LEVEL;
      let outputPerMinute = 0;
      let outputLabel = `${config.resource} / min`;
      let energyUsePerMinute = 0;

      if (config.kind === "generator") {
        const generator = getGeneratorOrThrow(config.generatorId);
        maxLevel = generator.maxLevel;

        outputPerMinute =
          config.group === "Power"
            ? rates.energyProduced
            : Math.max(
                0,
                Math.floor(
                  rates.resources[config.resource as keyof ResourceBucket] ?? 0,
                ),
              );
        outputLabel =
          config.group === "Power" ? "MW" : `${config.resource} / min`;
        energyUsePerMinute =
          key === "powerPlantLevel"
            ? 0
            : energyConsumptionForLevel(
                key as ProductionBuildingKey,
                currentLevel,
              );
      } else {
        maxLevel = config.maxLevel;
        outputPerMinute = storedToWholeUnits(
          colony.storageCaps[config.resource],
        );
        outputLabel = `${config.resource} cap`;
        energyUsePerMinute = 0;
      }

      let nextUpgradeCost: ResourceBucket = emptyResourceBucket();
      let nextUpgradeDurationSeconds: number | undefined;
      let canUpgrade = false;

      if (projectedLevel < maxLevel) {
        if (config.kind === "generator") {
          const generator = getGeneratorOrThrow(config.generatorId);
          nextUpgradeCost = resourceMapToWholeUnitBucket(
            getUpgradeCost(generator, projectedLevel),
          );
          nextUpgradeDurationSeconds = getUpgradeDurationSeconds(
            generator,
            projectedLevel,
          );
        } else {
          nextUpgradeCost = storageUpgradeCost(
            key as StorageBuildingKey,
            projectedLevel,
          );
          nextUpgradeDurationSeconds = storageUpgradeDurationSeconds(
            key as StorageBuildingKey,
            projectedLevel,
          );
        }
        canUpgrade = !queueBlocked && affordable(nextUpgradeCost);
      }

      const status: "Running" | "Overflow" | "Paused" | "Upgrading" | "Queued" =
        isUpgrading
          ? "Upgrading"
          : isQueued
            ? "Queued"
            : config.group === "Production" &&
                colony.overflow[config.resource as keyof ResourceBucket] > 0
              ? "Overflow"
              : rates.energyRatio <= 0 && config.group === "Production"
                ? "Paused"
                : "Running";

      return {
        key,
        name: config.name,
        group: config.group,
        currentLevel,
        maxLevel,
        isUpgrading,
        isQueued,
        status,
        outputPerMinute,
        outputLabel,
        energyUsePerMinute,
        canUpgrade,
        nextUpgradeDurationSeconds,
        nextUpgradeCost,
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
      planetMultipliers: {
        alloy: planet.alloyMultiplier,
        crystal: planet.crystalMultiplier,
        fuel: planet.fuelMultiplier,
      },
      buildings: cards,
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

    const config = BUILDING_CONFIG[args.buildingKey];
    let projectedLevel = settledColony.buildings[args.buildingKey];
    for (const row of queueRows) {
      if (!isBuildingUpgradeQueueItem(row)) {
        continue;
      }
      if (row.payload.buildingKey !== args.buildingKey) {
        continue;
      }
      projectedLevel = Math.max(projectedLevel, row.payload.toLevel);
    }

    const fromLevel = projectedLevel;
    const maxLevel =
      config.kind === "generator"
        ? getGeneratorOrThrow(config.generatorId).maxLevel
        : config.maxLevel;
    if (fromLevel >= maxLevel) {
      throw new ConvexError("Building is already at max level");
    }

    const toLevel = fromLevel + 1;
    const upgradeCostScaled = (() => {
      if (config.kind === "generator") {
        return resourceMapToScaledBucket(
          getUpgradeCost(getGeneratorOrThrow(config.generatorId), fromLevel),
        );
      }
      if (!isStorageBuildingKey(args.buildingKey)) {
        throw new ConvexError("Storage upgrade key mismatch");
      }
      return resourceMapToScaledBucket(
        storageUpgradeCost(args.buildingKey, fromLevel),
      );
    })();

    for (const key of RESOURCE_KEYS) {
      if (settledColony.resources[key] < upgradeCostScaled[key]) {
        throw new ConvexError(`Not enough ${key} to queue upgrade`);
      }
    }

    const nextResources = cloneResourceBucket(settledColony.resources);
    for (const key of RESOURCE_KEYS) {
      nextResources[key] -= upgradeCostScaled[key];
    }

    const durationSeconds = (() => {
      if (config.kind === "generator") {
        return getUpgradeDurationSeconds(
          getGeneratorOrThrow(config.generatorId),
          fromLevel,
        );
      }
      if (!isStorageBuildingKey(args.buildingKey)) {
        throw new ConvexError("Storage upgrade key mismatch");
      }
      return storageUpgradeDurationSeconds(args.buildingKey, fromLevel);
    })();
    const laneTail = queueRows[queueRows.length - 1];
    const startsAt = laneTail ? laneTail.completesAt : now;
    const completesAt = startsAt + durationSeconds * 1_000;

    await ctx.db.patch(settledColony._id, {
      resources: nextResources,
      activeUpgrade: undefined,
      updatedAt: now,
    });

    const lane = "building" as const;
    const status: "active" | "queued" = queueRows.length === 0 ? "active" : "queued";
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
