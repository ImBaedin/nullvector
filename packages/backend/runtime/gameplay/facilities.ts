import type { FacilityKey } from "@nullvector/game-logic";

import {
	DEFAULT_FACILITY_REGISTRY,
	getUpgradeCost,
	getUpgradeDurationSeconds,
	isFacilityUnlocked,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import { mutation } from "../../convex/_generated/server";
import { buildProgressionRules, requireFacilityAccess, requireFeatureAccess } from "./progression";
import { rescheduleColonyQueueResolution } from "./scheduling";
import {
	EMPTY_RESEARCH_LEVELS,
	RESOURCE_KEYS,
	SHIPYARD_FACILITY_KEY,
	facilityKeyValidator,
	facilityLevelFromColony,
	facilityLevelsFromColony,
	getBuildingLaneCapacity,
	getOwnedColony,
	isFacilityUpgradeQueueItem,
	listOpenLaneQueueItems,
	queueLaneValidator,
	queueItemStatusValidator,
	resourceMapToScaledBucket,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	cloneResourceBucket,
	upsertColonyCompanionRows,
	upsertQueuePayloadRow,
} from "./shared";

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

		const settledColony = await settleColonyAndPersist({
			ctx,
			colony,
			planet,
			now,
		});
		await settleShipyardQueue({
			colony: settledColony,
			ctx,
			now,
		});
		await settleDefenseQueue({
			colony: settledColony,
			ctx,
			now,
		});

		return {
			colonyId: colony._id,
			syncedAt: now,
		};
	},
});

export const enqueueFacilityUpgrade = mutation({
	args: {
		colonyId: v.id("colonies"),
		facilityKey: facilityKeyValidator,
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
		lane: queueLaneValidator,
		facilityKey: facilityKeyValidator,
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
		const progression = await buildProgressionRules({
			ctx,
			playerId: player._id,
		});
		requireFeatureAccess({
			featureKey: "facilities",
			label: "Facilities",
			progression,
		});
		requireFacilityAccess({
			facilityKey: args.facilityKey,
			label: "Facility",
			progression,
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

		const facility = DEFAULT_FACILITY_REGISTRY.get(args.facilityKey);
		if (!facility) {
			throw new ConvexError("Unknown facility");
		}

		const isUnlocked = isFacilityUnlocked(facility, {
			facilityLevels: facilityLevelsFromColony(settledColony),
			researchLevels: EMPTY_RESEARCH_LEVELS,
		});
		if (!isUnlocked) {
			throw new ConvexError("Facility is locked");
		}

		let projectedLevel = facilityLevelFromColony(settledColony, args.facilityKey);
		for (const row of queueRows) {
			if (!isFacilityUpgradeQueueItem(row)) {
				continue;
			}
			if (row.payload.facilityKey !== args.facilityKey) {
				continue;
			}
			projectedLevel = Math.max(projectedLevel, row.payload.toLevel);
		}

		const fromLevel = projectedLevel;
		if (fromLevel >= facility.maxLevel) {
			throw new ConvexError("Facility is already at max level");
		}
		const toLevel = fromLevel + 1;
		const upgradeCostScaled = resourceMapToScaledBucket(getUpgradeCost(facility, fromLevel));

		for (const key of RESOURCE_KEYS) {
			if (settledColony.resources[key] < upgradeCostScaled[key]) {
				throw new ConvexError(`Not enough ${key} to queue upgrade`);
			}
		}

		const nextResources = cloneResourceBucket(settledColony.resources);
		for (const key of RESOURCE_KEYS) {
			nextResources[key] -= upgradeCostScaled[key];
		}

		const durationSeconds = getUpgradeDurationSeconds(facility, fromLevel);
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
			kind: "facilityUpgrade",
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
						facilityKey: args.facilityKey,
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
			facilityKey: args.facilityKey,
			fromLevel,
			toLevel,
			startsAt,
			completesAt,
			durationSeconds,
			status,
		};
	},
});
