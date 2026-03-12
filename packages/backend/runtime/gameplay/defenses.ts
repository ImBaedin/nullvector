import type { DefenseKey, ResourceBucket } from "@nullvector/game-logic";

import {
	DEFAULT_DEFENSE_DEFINITIONS,
	getDefenseBuildDurationSeconds,
	type DefenseCounts,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { mutation, query } from "../../convex/_generated/server";
import { rescheduleColonyQueueResolution } from "./scheduling";
import {
	LANE_QUEUE_CAPACITY,
	OPEN_QUEUE_STATUSES,
	RESOURCE_KEYS,
	buildLaneQueueView,
	cloneResourceBucket,
	getOwnedColony,
	incrementColonyDefenseCount,
	isDefenseBuildQueueItem,
	laneQueueViewValidator,
	listOpenColonyQueueItems,
	listOpenLaneQueueItems,
	queueEventsNextAt,
	queueItemStatusValidator,
	readColonyDefenseCounts,
	resourceMapToScaledBucket,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	upsertColonyCompanionRows,
	upsertQueuePayloadRow,
} from "./shared";
import { buildShipyardReschedulePatches, computeScaledRefundForRemaining } from "./shipyard";

const defenseKeyValidator = v.union(
	v.literal("missileBattery"),
	v.literal("laserTurret"),
	v.literal("gaussCannon"),
	v.literal("shieldDome"),
);

const defenseCatalogItemValidator = v.object({
	key: defenseKeyValidator,
	name: v.string(),
	requiredDefenseGridLevel: v.number(),
	attack: v.number(),
	shield: v.number(),
	hull: v.number(),
	cost: v.object({
		alloy: v.number(),
		crystal: v.number(),
		fuel: v.number(),
	}),
});

const defenseStateItemValidator = v.object({
	key: defenseKeyValidator,
	owned: v.number(),
	queued: v.number(),
	perUnitDurationSeconds: v.number(),
	isUnlocked: v.boolean(),
});

export const getDefenseCatalog = query({
	args: {},
	returns: v.object({
		defenses: v.array(defenseCatalogItemValidator),
	}),
	handler: async () => ({
		defenses: (Object.keys(DEFAULT_DEFENSE_DEFINITIONS) as DefenseKey[]).map((defenseKey) => {
			const definition = DEFAULT_DEFENSE_DEFINITIONS[defenseKey];
			return {
				key: defenseKey,
				name: definition.name,
				requiredDefenseGridLevel: definition.requiredDefenseGridLevel,
				attack: definition.attack,
				shield: definition.shield,
				hull: definition.hull,
				cost: definition.cost,
			};
		}),
	}),
});

export const getDefenseState = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		defenseGridLevel: v.number(),
		nextEventAt: v.optional(v.number()),
		lane: laneQueueViewValidator,
		defenseStates: v.array(defenseStateItemValidator),
	}),
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const [queueRows, defenseCounts] = await Promise.all([
			listOpenColonyQueueItems({
				colonyId: colony._id,
				ctx,
			}),
			readColonyDefenseCounts({
				colonyId: colony._id,
				ctx,
			}),
		]);
		const defenseLane = buildLaneQueueView({
			lane: "defense",
			now: Date.now(),
			rows: queueRows,
		});
		const openDefenseRows = queueRows.filter(
			(row) =>
				row.lane === "defense" &&
				OPEN_QUEUE_STATUSES.includes(row.status) &&
				isDefenseBuildQueueItem(row),
		);

		const defenseStates = (Object.keys(DEFAULT_DEFENSE_DEFINITIONS) as DefenseKey[]).map(
			(defenseKey) => {
				const definition = DEFAULT_DEFENSE_DEFINITIONS[defenseKey];
				const queued = openDefenseRows.reduce((total, row) => {
					if (!isDefenseBuildQueueItem(row) || row.payload.defenseKey !== defenseKey) {
						return total;
					}
					return total + Math.max(0, row.payload.quantity - row.payload.completedQuantity);
				}, 0);
				return {
					key: defenseKey,
					owned: defenseCounts[defenseKey] ?? 0,
					queued,
					perUnitDurationSeconds: getDefenseBuildDurationSeconds({
						defenseKey,
						defenseGridLevel: colony.buildings.defenseGridLevel,
					}),
					isUnlocked: colony.buildings.defenseGridLevel >= definition.requiredDefenseGridLevel,
				};
			},
		);

		return {
			colonyId: colony._id,
			defenseGridLevel: colony.buildings.defenseGridLevel,
			nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
			lane: defenseLane,
			defenseStates,
		};
	},
});

export const enqueueDefenseBuild = mutation({
	args: {
		colonyId: v.id("colonies"),
		defenseKey: defenseKeyValidator,
		quantity: v.number(),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
		defenseKey: defenseKeyValidator,
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

		if (settledColony.buildings.defenseGridLevel <= 0) {
			throw new ConvexError("Defense Grid is required to build defenses");
		}

		const definition = DEFAULT_DEFENSE_DEFINITIONS[args.defenseKey];
		if (settledColony.buildings.defenseGridLevel < definition.requiredDefenseGridLevel) {
			throw new ConvexError("Defense Grid level is too low for this defense");
		}

		const queueRows = await listOpenLaneQueueItems({
			colonyId: settledColony._id,
			ctx,
			lane: "defense",
		});
		if (queueRows.length >= LANE_QUEUE_CAPACITY.defense) {
			throw new ConvexError("Defense queue is full");
		}

		const perUnitCostScaled = resourceMapToScaledBucket(definition.cost);
		const totalCostScaled: ResourceBucket = {
			alloy: perUnitCostScaled.alloy * quantity,
			crystal: perUnitCostScaled.crystal * quantity,
			fuel: perUnitCostScaled.fuel * quantity,
		};
		for (const key of RESOURCE_KEYS) {
			if (settledColony.resources[key] < totalCostScaled[key]) {
				throw new ConvexError(`Not enough ${key} to queue defense build`);
			}
		}

		const nextResources = cloneResourceBucket(settledColony.resources);
		for (const key of RESOURCE_KEYS) {
			nextResources[key] -= totalCostScaled[key];
		}

		const perUnitDurationSeconds = getDefenseBuildDurationSeconds({
			defenseKey: args.defenseKey,
			defenseGridLevel: settledColony.buildings.defenseGridLevel,
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
			lane: "defense",
			kind: "defenseBuild",
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
						defenseKey: args.defenseKey,
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
			defenseKey: args.defenseKey,
			quantity,
			startsAt,
			completesAt,
			perUnitDurationSeconds,
			status,
		};
	},
});

export const cancelDefenseQueueItem = mutation({
	args: {
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		queueItemId: v.id("colonyQueueItems"),
		defenseKey: defenseKeyValidator,
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
			lane: "defense",
		});
		const targetRow = queueRows.find((row) => row._id === args.queueItemId);
		if (!targetRow || !isDefenseBuildQueueItem(targetRow)) {
			throw new ConvexError("Defense build queue item is not open");
		}

		const { refundedScaled, remainingQuantity } = computeScaledRefundForRemaining({
			completedQuantity: targetRow.payload.completedQuantity,
			quantity: targetRow.payload.quantity,
			totalScaledCost: targetRow.cost,
		});
		const wasActive = targetRow.status === "active";

		await ctx.db.patch(targetRow._id, {
			status: "cancelled",
			resolvedAt: now,
			updatedAt: now,
		});

		const payloadRow = await ctx.db
			.query("colonyQueuePayloads")
			.withIndex("by_queue_item_id", (q) => q.eq("queueItemId", targetRow._id))
			.unique();
		if (payloadRow) {
			await ctx.db.patch(payloadRow._id, {
				payload: {
					...targetRow.payload,
					completedQuantity: targetRow.payload.quantity,
				},
				updatedAt: now,
			});
		}

		if (remainingQuantity > 0) {
			await upsertColonyCompanionRows({
				colony: {
					...settledColony,
					resources: {
						alloy: settledColony.resources.alloy + refundedScaled.alloy,
						crystal: settledColony.resources.crystal + refundedScaled.crystal,
						fuel: settledColony.resources.fuel + refundedScaled.fuel,
					},
					updatedAt: now,
				},
				ctx,
				now,
			});
		}

		const remainingRows: Array<{
			queueItemId: Id<"colonyQueueItems">;
			status: "active" | "queued";
			startsAt: number;
			payload: {
				quantity: number;
				perUnitDurationSeconds: number;
			};
		}> = queueRows
			.filter(
				(row): row is typeof targetRow =>
					row._id !== targetRow._id &&
					row.status !== "completed" &&
					row.status !== "cancelled" &&
					row.status !== "failed" &&
					isDefenseBuildQueueItem(row),
			)
			.map((row) => ({
				queueItemId: row._id,
				status: row.status === "active" ? ("active" as const) : ("queued" as const),
				startsAt: row.startsAt,
				payload: {
					quantity: row.payload.quantity,
					perUnitDurationSeconds: row.payload.perUnitDurationSeconds,
				},
			}));
		const timingPatches = buildShipyardReschedulePatches({
			now,
			rows: remainingRows,
		});
		for (const patch of timingPatches) {
			await ctx.db.patch(patch.queueItemId as Id<"colonyQueueItems">, {
				status: patch.status,
				startsAt: patch.startsAt,
				completesAt: patch.completesAt,
				updatedAt: now,
			});
		}

		await rescheduleColonyQueueResolution({
			colonyId: settledColony._id,
			ctx,
		});

		return {
			colonyId: settledColony._id,
			queueItemId: targetRow._id,
			defenseKey: targetRow.payload.defenseKey,
			cancelledRemainingQuantity: remainingQuantity,
			refunded: {
				alloy: refundedScaled.alloy / 1_000,
				crystal: refundedScaled.crystal / 1_000,
				fuel: refundedScaled.fuel / 1_000,
			},
			wasActive,
		};
	},
});
