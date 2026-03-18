import {
	getBuildingUpgradeCost,
	getBuildingUpgradeDurationSeconds,
	getUpgradeCost,
	getUpgradeDurationSeconds,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import { mutation } from "../../convex/_generated/server";
import { rescheduleColonyQueueResolution } from "./scheduling";
import {
	BUILDING_CONFIG,
	RESOURCE_KEYS,
	buildingKeyValidator,
	cloneResourceBucket,
	getGeneratorOrThrow,
	getBuildingLaneCapacity,
	getOwnedColony,
	isBuildingUpgradeQueueItem,
	listOpenLaneQueueItems,
	queueLaneValidator,
	queueItemStatusValidator,
	resourceMapToScaledBucket,
	settleColonyAndPersist,
	upsertColonyCompanionRows,
	upsertQueuePayloadRow,
} from "./shared";

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
		const laneCapacity = getBuildingLaneCapacity(settledColony);
		if (queueRows.length >= laneCapacity) {
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
			return resourceMapToScaledBucket(getBuildingUpgradeCost(args.buildingKey, fromLevel));
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
				return getUpgradeDurationSeconds(getGeneratorOrThrow(config.generatorId), fromLevel);
			}
			return getBuildingUpgradeDurationSeconds(args.buildingKey, fromLevel);
		})();
		const laneTail = queueRows[queueRows.length - 1];
		const startsAt = laneTail ? laneTail.completesAt : now;
		const completesAt = startsAt + durationSeconds * 1_000;

		await ctx.db.patch(settledColony._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...settledColony,
				resources: nextResources,
				updatedAt: now,
			},
			ctx,
			now,
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
			createdAt: now,
			updatedAt: now,
		});
		const insertedQueueItem = await ctx.db.get(queueItemId);
		if (insertedQueueItem) {
			await upsertQueuePayloadRow({
				ctx,
				item: {
					...insertedQueueItem,
					cost: upgradeCostScaled,
					payload: {
						buildingKey: args.buildingKey,
						fromLevel,
						toLevel,
					},
				},
				now,
			});
		}
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
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
