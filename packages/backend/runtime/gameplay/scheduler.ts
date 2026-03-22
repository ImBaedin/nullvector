import { v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import { internalMutation } from "../../convex/_generated/server";
import { settleDueFleetOperations } from "./fleetV2";
import {
	ACTIVE_FLEET_OPERATION_STATUSES,
	reconcileFleetOperationSchedule,
	rescheduleColonyQueueResolution,
} from "./scheduling";
import {
	getColonySchedulingState,
	loadColonyState,
	loadPlanetState,
	settleColonyAndPersist,
	settleDefenseQueue,
	settleShipyardQueue,
	upsertColonySchedulingState,
} from "./shared";

export const resolveColonyQueues = internalMutation({
	args: {
		colonyId: v.id("colonies"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		resolvedAt: v.number(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const colony = await ctx.db.get(args.colonyId);
		const now = Date.now();
		if (!colony) {
			return {
				colonyId: args.colonyId,
				resolvedAt: now,
				stale: true,
			};
		}
		const scheduling = await getColonySchedulingState({
			colonyId: args.colonyId,
			ctx,
		});
		if (scheduling.queueResolutionScheduledAt !== args.scheduledAt) {
			return {
				colonyId: args.colonyId,
				resolvedAt: now,
				stale: true,
			};
		}
		await upsertColonySchedulingState({
			colonyId: colony._id,
			ctx,
			now,
			patch: {
				queueResolutionJobId: undefined,
				queueResolutionScheduledAt: undefined,
			},
		});
		try {
			const planet = await ctx.db.get(colony.planetId);
			if (!planet) {
				throw new Error("Planet not found for scheduled colony resolution");
			}

			const colonyState = await loadColonyState({
				colony,
				ctx,
			});
			const planetState = await loadPlanetState({
				ctx,
				planet,
			});
			const settledColony = await settleColonyAndPersist({
				ctx,
				colony: colonyState,
				planet: planetState,
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
		} finally {
			await ctx.scheduler.runAfter(0, internal.scheduler.rearmColonyQueueResolution, {
				colonyId: colony._id,
			});
		}

		return {
			colonyId: colony._id,
			resolvedAt: now,
			stale: false,
		};
	},
});

export const resolveFleetOperation = internalMutation({
	args: {
		operationId: v.id("fleetOperations"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		affectedOperationIds: v.array(v.id("fleetOperations")),
		operationId: v.id("fleetOperations"),
		resolvedAt: v.number(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const operation = await ctx.db.get(args.operationId);
		const now = Date.now();
		if (
			!operation ||
			!ACTIVE_FLEET_OPERATION_STATUSES.has(operation.status) ||
			operation.nextEventAt !== args.scheduledAt
		) {
			return {
				affectedOperationIds: [],
				operationId: args.operationId,
				resolvedAt: now,
				stale: true,
			};
		}
		await ctx.db.patch(operation._id, {
			resolutionJobId: undefined,
			resolutionScheduledAt: undefined,
			updatedAt: now,
		});

		const settled = await settleDueFleetOperations({
			ctx,
			now,
			ownerPlayerId: operation.ownerPlayerId,
		});
		await ctx.scheduler.runAfter(0, internal.scheduler.rearmFleetOperationSchedules, {
			operationIds: settled.affectedOperationIds,
		});

		return {
			affectedOperationIds: settled.affectedOperationIds,
			operationId: args.operationId,
			resolvedAt: now,
			stale: false,
		};
	},
});

export const rearmColonyQueueResolution = internalMutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		nextDueAt: v.union(v.number(), v.null()),
	}),
	handler: async (ctx, args) => {
		const result = await rescheduleColonyQueueResolution({
			colonyId: args.colonyId,
			ctx,
			force: true,
			skipCancel: true,
		});
		return {
			colonyId: args.colonyId,
			nextDueAt: result.nextDueAt,
		};
	},
});

export const rearmFleetOperationSchedules = internalMutation({
	args: {
		operationIds: v.array(v.id("fleetOperations")),
	},
	returns: v.object({
		operationIds: v.array(v.id("fleetOperations")),
	}),
	handler: async (ctx, args) => {
		for (const operationId of args.operationIds) {
			await reconcileFleetOperationSchedule({
				ctx,
				operationId,
				force: true,
				skipCancel: true,
			});
		}
		return {
			operationIds: args.operationIds,
		};
	},
});

export const backfillScheduledResolutions = internalMutation({
	args: {},
	returns: v.object({
		activeFleetOperations: v.number(),
		coloniesWithQueues: v.number(),
		runAt: v.number(),
	}),
	handler: async (ctx) => {
		const now = Date.now();
		const queueRows = await ctx.db.query("colonyQueueItems").collect();
		const colonyIds = new Set<Id<"colonies">>();
		for (const row of queueRows) {
			if (row.status === "active" || row.status === "queued") {
				colonyIds.add(row.colonyId);
			}
		}

		for (const colonyId of colonyIds) {
			const colony = await ctx.db.get(colonyId);
			if (!colony) {
				continue;
			}
			const planet = await ctx.db.get(colony.planetId);
			if (!planet) {
				continue;
			}
			const colonyState = await loadColonyState({
				colony,
				ctx,
			});
			const planetState = await loadPlanetState({
				ctx,
				planet,
			});
			const settledColony = await settleColonyAndPersist({
				ctx,
				colony: colonyState,
				planet: planetState,
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
			await rescheduleColonyQueueResolution({
				colonyId,
				ctx,
				force: true,
				skipCancel: true,
			});
		}

		const operations = await ctx.db.query("fleetOperations").collect();
		const activeOperations = operations.filter((row) =>
			ACTIVE_FLEET_OPERATION_STATUSES.has(row.status),
		);
		const ownerIds = new Set(activeOperations.map((row) => row.ownerPlayerId));

		for (const ownerPlayerId of ownerIds) {
			const settled = await settleDueFleetOperations({
				ctx,
				now,
				ownerPlayerId,
			});
			for (const affectedOperationId of settled.affectedOperationIds) {
				await reconcileFleetOperationSchedule({
					ctx,
					operationId: affectedOperationId,
					force: true,
					skipCancel: true,
				});
			}
		}

		for (const operation of activeOperations) {
			await reconcileFleetOperationSchedule({
				ctx,
				operationId: operation._id,
				force: true,
				skipCancel: true,
			});
		}

		return {
			activeFleetOperations: activeOperations.length,
			coloniesWithQueues: colonyIds.size,
			runAt: now,
		};
	},
});
