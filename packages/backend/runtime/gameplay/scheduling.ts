import type { Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import { type MutationCtx } from "../../convex/_generated/server";
import {
	getColonySchedulingState,
	listOpenColonyQueueItems,
	queueEventsNextAt,
	upsertColonySchedulingState,
} from "./shared";

const ACTIVE_FLEET_OPERATION_STATUSES = new Set(["inTransit", "returning"]);

async function cancelScheduledFunctionIfPresent(args: {
	ctx: MutationCtx;
	jobId: Id<"_scheduled_functions"> | undefined;
}) {
	if (!args.jobId) {
		return;
	}
	await args.ctx.scheduler.cancel(args.jobId);
}

export { ACTIVE_FLEET_OPERATION_STATUSES };

export async function rescheduleColonyQueueResolution(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	force?: boolean;
	skipCancel?: boolean;
}) {
	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		return { colonyExists: false, nextDueAt: null as number | null };
	}
	const scheduling = await getColonySchedulingState({
		colonyId: args.colonyId,
		ctx: args.ctx,
	});

	const queueRows = await listOpenColonyQueueItems({
		colonyId: args.colonyId,
		ctx: args.ctx,
	});
	const nextDueAt = queueEventsNextAt(queueRows);

	if (nextDueAt === null) {
		if (!args.skipCancel) {
			await cancelScheduledFunctionIfPresent({
				ctx: args.ctx,
				jobId: scheduling.queueResolutionJobId,
			});
		}
		if (
			scheduling.queueResolutionJobId !== undefined ||
			scheduling.queueResolutionScheduledAt !== undefined
		) {
			await upsertColonySchedulingState({
				colonyId: args.colonyId,
				ctx: args.ctx,
				now: Date.now(),
				patch: {
					queueResolutionJobId: undefined,
					queueResolutionScheduledAt: undefined,
				},
			});
		}
		return { colonyExists: true, nextDueAt: null as number | null };
	}

	if (
		!args.force &&
		scheduling.queueResolutionScheduledAt === nextDueAt &&
		scheduling.queueResolutionJobId !== undefined
	) {
		return { colonyExists: true, nextDueAt };
	}

	if (!args.skipCancel) {
		await cancelScheduledFunctionIfPresent({
			ctx: args.ctx,
			jobId: scheduling.queueResolutionJobId,
		});
	}

	const runAt = Math.max(Date.now(), nextDueAt);
	const jobId = await args.ctx.scheduler.runAt(runAt, internal.scheduler.resolveColonyQueues, {
		colonyId: args.colonyId,
		scheduledAt: nextDueAt,
	});

	await upsertColonySchedulingState({
		colonyId: args.colonyId,
		ctx: args.ctx,
		now: Date.now(),
		patch: {
			queueResolutionJobId: jobId,
			queueResolutionScheduledAt: nextDueAt,
		},
	});

	return { colonyExists: true, nextDueAt };
}

export async function reconcileFleetOperationSchedule(args: {
	ctx: MutationCtx;
	operationId: Id<"fleetOperations">;
	force?: boolean;
	skipCancel?: boolean;
}) {
	const operation = await args.ctx.db.get(args.operationId);
	if (!operation) {
		return { operationExists: false, scheduledAt: null as number | null };
	}

	if (
		!ACTIVE_FLEET_OPERATION_STATUSES.has(operation.status) ||
		!Number.isFinite(operation.nextEventAt)
	) {
		if (!args.skipCancel) {
			await cancelScheduledFunctionIfPresent({
				ctx: args.ctx,
				jobId: operation.resolutionJobId,
			});
		}
		if (operation.resolutionJobId || operation.resolutionScheduledAt !== undefined) {
			await args.ctx.db.patch(operation._id, {
				resolutionJobId: undefined,
				resolutionScheduledAt: undefined,
				updatedAt: Date.now(),
			});
		}
		return { operationExists: true, scheduledAt: null as number | null };
	}

	if (
		!args.force &&
		operation.resolutionScheduledAt === operation.nextEventAt &&
		operation.resolutionJobId !== undefined
	) {
		return { operationExists: true, scheduledAt: operation.nextEventAt };
	}

	if (!args.skipCancel) {
		await cancelScheduledFunctionIfPresent({
			ctx: args.ctx,
			jobId: operation.resolutionJobId,
		});
	}

	const runAt = Math.max(Date.now(), operation.nextEventAt);
	const jobId = await args.ctx.scheduler.runAt(runAt, internal.scheduler.resolveFleetOperation, {
		operationId: operation._id,
		scheduledAt: operation.nextEventAt,
	});

	await args.ctx.db.patch(operation._id, {
		resolutionJobId: jobId,
		resolutionScheduledAt: operation.nextEventAt,
		updatedAt: Date.now(),
	});

	return { operationExists: true, scheduledAt: operation.nextEventAt };
}
