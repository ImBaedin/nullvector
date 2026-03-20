import type { ResourceBucket, ShipKey } from "@nullvector/game-logic";

import { DEFAULT_SHIP_DEFINITIONS, getShipBuildDurationSeconds } from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { mutation } from "../../convex/_generated/server";
import { RESOURCE_SCALE } from "../../convex/schema";
import { buildProgressionRules, requireFeatureAccess, requireShipAccess } from "./progression";
import { rescheduleColonyQueueResolution } from "./scheduling";
import {
	LANE_QUEUE_CAPACITY,
	RESOURCE_KEYS,
	cloneResourceBucket,
	getOwnedColony,
	isShipBuildQueueItem,
	loadColonyState,
	listOpenLaneQueueItems,
	queueItemStatusValidator,
	resourceMapToScaledBucket,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	shipKeyValidator,
	upsertColonyCompanionRows,
	upsertQueuePayloadRow,
} from "./shared";

type QueueItemId = Id<"colonyQueueItems"> | string;
type ShipQueueTimingPatch = {
	completesAt: number;
	queueItemId: QueueItemId;
	startsAt: number;
	status: "active" | "queued";
};

type ReschedulableShipQueueRow = {
	payload: {
		perUnitDurationSeconds: number;
		quantity: number;
	};
	queueItemId: QueueItemId;
	startsAt: number;
	status: "active" | "queued";
};

export function computeScaledRefundForRemaining(args: {
	completedQuantity: number;
	quantity: number;
	totalScaledCost: ResourceBucket;
}) {
	const { completedQuantity, quantity, totalScaledCost } = args;
	const safeQuantity = Math.max(1, quantity);
	const remainingQuantity = Math.max(0, quantity - completedQuantity);

	return {
		remainingQuantity,
		refundedScaled: {
			alloy: Math.floor((totalScaledCost.alloy * remainingQuantity) / safeQuantity),
			crystal: Math.floor((totalScaledCost.crystal * remainingQuantity) / safeQuantity),
			fuel: Math.floor((totalScaledCost.fuel * remainingQuantity) / safeQuantity),
		},
	};
}

export function buildShipyardReschedulePatches(args: {
	now: number;
	rows: ReschedulableShipQueueRow[];
}) {
	const sorted = [...args.rows];
	const currentActive = sorted.find((row) => row.status === "active");
	const patches: ShipQueueTimingPatch[] = [];
	let previousCompletesAt = 0;

	for (const [index, row] of sorted.entries()) {
		const status: "active" | "queued" = index === 0 ? "active" : "queued";
		const startsAt =
			index === 0
				? currentActive && currentActive.queueItemId === row.queueItemId
					? row.startsAt
					: args.now
				: previousCompletesAt;
		const unitDurationMs = row.payload.perUnitDurationSeconds * 1_000;
		const completesAt = startsAt + row.payload.quantity * unitDurationMs;
		previousCompletesAt = completesAt;

		patches.push({
			queueItemId: row.queueItemId,
			status,
			startsAt,
			completesAt,
		});
	}

	return patches;
}

export const enqueueShipBuild = mutation({
	args: {
		colonyId: v.id("colonies"),
		shipKey: shipKeyValidator,
		quantity: v.number(),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
		shipKey: shipKeyValidator,
		quantity: v.number(),
		startsAt: v.number(),
		completesAt: v.number(),
		perUnitDurationSeconds: v.number(),
		status: queueItemStatusValidator,
	}),
	handler: async (ctx, args) => {
		const quantity = Math.max(0, Math.floor(args.quantity));
		if (quantity <= 0) {
			throw new ConvexError("Quantity must be a positive integer");
		}
		if (quantity > 10_000) {
			throw new ConvexError("Quantity exceeds maximum batch size");
		}

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
			featureKey: "shipyard",
			label: "Shipyard",
			progression,
		});
		requireShipAccess({
			label: "Ship",
			progression,
			shipKey: args.shipKey,
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

		const definition = DEFAULT_SHIP_DEFINITIONS[args.shipKey];
		if (settledColony.buildings.shipyardLevel < definition.requiredShipyardLevel) {
			throw new ConvexError("Shipyard level is too low for this ship");
		}

		const queueRows = await listOpenLaneQueueItems({
			colonyId: settledColony._id,
			ctx,
			lane: "shipyard",
		});
		if (queueRows.length >= LANE_QUEUE_CAPACITY.shipyard) {
			throw new ConvexError("Shipyard queue is full");
		}

		const perUnitCostScaled = resourceMapToScaledBucket(definition.cost);
		const totalCostScaled: ResourceBucket = {
			alloy: perUnitCostScaled.alloy * quantity,
			crystal: perUnitCostScaled.crystal * quantity,
			fuel: perUnitCostScaled.fuel * quantity,
		};

		for (const key of RESOURCE_KEYS) {
			if (settledColony.resources[key] < totalCostScaled[key]) {
				throw new ConvexError(`Not enough ${key} to queue ship build`);
			}
		}

		const nextResources = cloneResourceBucket(settledColony.resources);
		for (const key of RESOURCE_KEYS) {
			nextResources[key] -= totalCostScaled[key];
		}

		const perUnitDurationSeconds = getShipBuildDurationSeconds({
			shipKey: args.shipKey,
			shipyardLevel: settledColony.buildings.shipyardLevel,
		});

		const laneTail = queueRows[queueRows.length - 1];
		const startsAt = laneTail ? laneTail.completesAt : now;
		const completesAt = startsAt + perUnitDurationSeconds * quantity * 1_000;
		const status: "active" | "queued" = queueRows.length === 0 ? "active" : "queued";
		const laneOrder = (laneTail?.order ?? 0) + 1;

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

		const queueItemId = await ctx.db.insert("colonyQueueItems", {
			universeId: settledColony.universeId,
			playerId: player._id,
			colonyId: settledColony._id,
			lane: "shipyard",
			kind: "shipBuild",
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
					cost: totalCostScaled,
					payload: {
						shipKey: args.shipKey,
						quantity,
						completedQuantity: 0,
						perUnitDurationSeconds,
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
			shipKey: args.shipKey,
			quantity,
			startsAt,
			completesAt,
			perUnitDurationSeconds,
			status,
		};
	},
});

export const cancelShipBuildQueueItem = mutation({
	args: {
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
		shipKey: shipKeyValidator,
		cancelledRemainingQuantity: v.number(),
		refunded: v.object({
			alloy: v.number(),
			crystal: v.number(),
			fuel: v.number(),
		}),
		wasActive: v.boolean(),
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

		const queueRows = await listOpenLaneQueueItems({
			colonyId: settledColony._id,
			ctx,
			lane: "shipyard",
		});
		const targetRow = queueRows.find((row) => row._id === args.queueItemId);
		if (!targetRow || !isShipBuildQueueItem(targetRow)) {
			throw new ConvexError("Ship build queue item is not open");
		}
		const target = targetRow;

		const { refundedScaled, remainingQuantity } = computeScaledRefundForRemaining({
			completedQuantity: target.payload.completedQuantity,
			quantity: target.payload.quantity,
			totalScaledCost: target.cost,
		});

		const latestColonyBase = await ctx.db.get(settledColony._id);
		if (!latestColonyBase) {
			throw new ConvexError("Colony not found");
		}
		const latestColony = await loadColonyState({
			colony: latestColonyBase,
			ctx,
		});
		const nextResources = cloneResourceBucket(latestColony.resources);
		const nextOverflow = cloneResourceBucket(latestColony.overflow);
		for (const key of RESOURCE_KEYS) {
			const cap = latestColony.storageCaps[key];
			const storageRoom = Math.max(0, cap - nextResources[key]);
			const toStorage = Math.min(refundedScaled[key], storageRoom);
			const toOverflow = Math.max(0, refundedScaled[key] - toStorage);
			nextResources[key] += toStorage;
			nextOverflow[key] += toOverflow;
		}

		await ctx.db.patch(latestColony._id, {
			updatedAt: now,
		});
		await upsertColonyCompanionRows({
			colony: {
				...latestColony,
				resources: nextResources,
				overflow: nextOverflow,
				updatedAt: now,
			},
			ctx,
			now,
		});
		await ctx.db.patch(target._id, {
			resolvedAt: now,
			status: "cancelled",
			updatedAt: now,
		});

		const remainingRows = queueRows
			.filter((row) => row._id !== target._id)
			.filter(isShipBuildQueueItem)
			.sort((left, right) => left.order - right.order);

		if (remainingRows.length > 0) {
			const timingPatches = buildShipyardReschedulePatches({
				now,
				rows: remainingRows.map((row) => ({
					payload: {
						perUnitDurationSeconds: row.payload.perUnitDurationSeconds,
						quantity: row.payload.quantity,
					},
					queueItemId: row._id,
					startsAt: row.startsAt,
					status: row.status === "active" ? "active" : "queued",
				})),
			});

			for (const patch of timingPatches) {
				await ctx.db.patch(patch.queueItemId as Id<"colonyQueueItems">, {
					startsAt: patch.startsAt,
					completesAt: patch.completesAt,
					status: patch.status,
					updatedAt: now,
				});
			}
		}
		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		return {
			colonyId: settledColony._id,
			queueItemId: target._id,
			shipKey: target.payload.shipKey,
			cancelledRemainingQuantity: remainingQuantity,
			refunded: {
				alloy: Math.floor(refundedScaled.alloy / RESOURCE_SCALE),
				crystal: Math.floor(refundedScaled.crystal / RESOURCE_SCALE),
				fuel: Math.floor(refundedScaled.fuel / RESOURCE_SCALE),
			},
			wasActive: target.status === "active",
		};
	},
});
