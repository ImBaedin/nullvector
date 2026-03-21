import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { internalMutation, type MutationCtx } from "../../convex/_generated/server";
import { RESOURCE_SCALE } from "../../convex/schema";

type BackfillSourceKind = "contractResult" | "npcRaidResult" | "fleetOperationResult";

type BackfillCursorState = {
	contractResultsCursor?: string;
	npcRaidResultsCursor?: string;
	fleetOperationResultsCursor?: string;
};

function wholeUnitsFromScaledBucket(resources: {
	alloy: number;
	crystal: number;
	fuel: number;
}) {
	return Math.floor((resources.alloy + resources.crystal + resources.fuel) / RESOURCE_SCALE);
}

export async function ensurePlayerQuestMetrics(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("playerQuestMetrics")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const metricsId = await args.ctx.db.insert("playerQuestMetrics", {
		playerId: args.playerId,
		colonizationSuccessCount: 0,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(metricsId);
	if (!inserted) {
		throw new ConvexError("Failed to create player quest metrics");
	}
	return inserted;
}

export async function ensureColonyQuestMetrics(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("colonyQuestMetrics")
		.withIndex("by_player_colony", (q) =>
			q.eq("playerId", args.playerId).eq("colonyId", args.colonyId),
		)
		.unique();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const metricsId = await args.ctx.db.insert("colonyQuestMetrics", {
		playerId: args.playerId,
		colonyId: args.colonyId,
		contractSuccessCount: 0,
		contractRewardResourcesTotal: 0,
		raidDefenseSuccessCount: 0,
		transportDeliveryCount: 0,
		transportDeliveredResourcesTotal: 0,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(metricsId);
	if (!inserted) {
		throw new ConvexError("Failed to create colony quest metrics");
	}
	return inserted;
}

export async function incrementColonizationSuccess(args: {
	amount?: number;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const metrics = await ensurePlayerQuestMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		colonizationSuccessCount:
			metrics.colonizationSuccessCount + Math.max(0, Math.floor(args.amount ?? 1)),
		updatedAt: Date.now(),
	});
}

export async function incrementContractSuccess(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
	resourceAmount?: number;
	successCount?: number;
}) {
	const metrics = await ensureColonyQuestMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		contractSuccessCount: metrics.contractSuccessCount + Math.max(0, args.successCount ?? 1),
		contractRewardResourcesTotal:
			metrics.contractRewardResourcesTotal + Math.max(0, Math.floor(args.resourceAmount ?? 0)),
		updatedAt: Date.now(),
	});
}

export async function incrementRaidDefenseSuccess(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
	successCount?: number;
}) {
	const metrics = await ensureColonyQuestMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		raidDefenseSuccessCount:
			metrics.raidDefenseSuccessCount + Math.max(0, args.successCount ?? 1),
		updatedAt: Date.now(),
	});
}

export async function incrementTransportDelivery(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
	resourceAmount?: number;
	successCount?: number;
}) {
	const metrics = await ensureColonyQuestMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		transportDeliveryCount: metrics.transportDeliveryCount + Math.max(0, args.successCount ?? 1),
		transportDeliveredResourcesTotal:
			metrics.transportDeliveredResourcesTotal + Math.max(0, Math.floor(args.resourceAmount ?? 0)),
		updatedAt: Date.now(),
	});
}

async function isSourceMarked(args: {
	ctx: MutationCtx;
	sourceId: string;
	sourceKind: BackfillSourceKind;
}) {
	return args.ctx.db
		.query("questMetricBackfillMarks")
		.withIndex("by_source", (q) =>
			q.eq("sourceKind", args.sourceKind).eq("sourceId", args.sourceId),
		)
		.unique();
}

async function markSourceProcessed(args: {
	ctx: MutationCtx;
	now: number;
	sourceId: string;
	sourceKind: BackfillSourceKind;
}) {
	const existing = await isSourceMarked(args);
	if (existing) {
		return false;
	}
	await args.ctx.db.insert("questMetricBackfillMarks", {
		sourceKind: args.sourceKind,
		sourceId: args.sourceId,
		createdAt: args.now,
	});
	return true;
}

async function processContractResults(args: {
	cursor: string | null;
	ctx: MutationCtx;
	limit: number;
	now: number;
}) {
	const result = await args.ctx.db
		.query("contractResults")
		.paginate({ numItems: args.limit, cursor: args.cursor });
	let processed = 0;

	for (const row of result.page) {
		if (!(await markSourceProcessed({
			ctx: args.ctx,
			now: args.now,
			sourceKind: "contractResult",
			sourceId: String(row._id),
		}))) {
			continue;
		}
		if (row.success && row.originColonyId) {
			await incrementContractSuccess({
				ctx: args.ctx,
				playerId: row.playerId,
				colonyId: row.originColonyId,
				resourceAmount: wholeUnitsFromScaledBucket(row.rewardCargoLoaded),
			});
		}
		processed += 1;
	}

	return {
		cursor: result.continueCursor,
		isDone: result.isDone,
		processed,
	};
}

async function processNpcRaidResults(args: {
	cursor: string | null;
	ctx: MutationCtx;
	limit: number;
	now: number;
}) {
	const result = await args.ctx.db
		.query("npcRaidResults")
		.paginate({ numItems: args.limit, cursor: args.cursor });
	let processed = 0;

	for (const row of result.page) {
		if (!(await markSourceProcessed({
			ctx: args.ctx,
			now: args.now,
			sourceKind: "npcRaidResult",
			sourceId: String(row._id),
		}))) {
			continue;
		}
		if (row.success === false) {
			await incrementRaidDefenseSuccess({
				ctx: args.ctx,
				playerId: row.targetPlayerId,
				colonyId: row.targetColonyId,
			});
		}
		processed += 1;
	}

	return {
		cursor: result.continueCursor,
		isDone: result.isDone,
		processed,
	};
}

async function processFleetOperationResults(args: {
	cursor: string | null;
	ctx: MutationCtx;
	limit: number;
	now: number;
}) {
	const result = await args.ctx.db
		.query("fleetOperationResults")
		.paginate({ numItems: args.limit, cursor: args.cursor });
	let processed = 0;

	for (const row of result.page) {
		if (!(await markSourceProcessed({
			ctx: args.ctx,
			now: args.now,
			sourceKind: "fleetOperationResult",
			sourceId: String(row._id),
		}))) {
			continue;
		}

		if (row.operationKind === "colonize" && row.resultCode === "colonized") {
			await incrementColonizationSuccess({
				ctx: args.ctx,
				playerId: row.ownerPlayerId,
			});
		}

		if (row.operationKind === "transport" && row.resultCode === "delivered" && row.targetColonyId) {
			await incrementTransportDelivery({
				ctx: args.ctx,
				playerId: row.ownerPlayerId,
				colonyId: row.targetColonyId,
				resourceAmount: wholeUnitsFromScaledBucket(row.cargoDeliveredToStorage),
			});
		}

		processed += 1;
	}

	return {
		cursor: result.continueCursor,
		isDone: result.isDone,
		processed,
	};
}

export const backfillQuestMetricsBatch = internalMutation({
	args: {
		cursor: v.optional(
			v.object({
				contractResultsCursor: v.optional(v.string()),
				npcRaidResultsCursor: v.optional(v.string()),
				fleetOperationResultsCursor: v.optional(v.string()),
			}),
		),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		cursor: v.object({
			contractResultsCursor: v.optional(v.string()),
			npcRaidResultsCursor: v.optional(v.string()),
			fleetOperationResultsCursor: v.optional(v.string()),
		}),
		processed: v.number(),
		done: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const limit = Math.max(1, Math.min(256, Math.floor(args.limit ?? 128)));
		const cursor: BackfillCursorState = args.cursor ?? {};
		const now = Date.now();

		const contractBatch = await processContractResults({
			ctx,
			cursor: cursor.contractResultsCursor ?? null,
			limit,
			now,
		});
		const raidBatch = contractBatch.isDone
			? await processNpcRaidResults({
					ctx,
					cursor: cursor.npcRaidResultsCursor ?? null,
					limit,
					now,
				})
			: { cursor: cursor.npcRaidResultsCursor ?? null, isDone: false, processed: 0 };
		const fleetBatch =
			contractBatch.isDone && raidBatch.isDone
				? await processFleetOperationResults({
						ctx,
						cursor: cursor.fleetOperationResultsCursor ?? null,
						limit,
						now,
					})
				: { cursor: cursor.fleetOperationResultsCursor ?? null, isDone: false, processed: 0 };

		return {
			cursor: {
				contractResultsCursor: contractBatch.isDone ? undefined : (contractBatch.cursor ?? undefined),
				npcRaidResultsCursor: raidBatch.isDone ? undefined : (raidBatch.cursor ?? undefined),
				fleetOperationResultsCursor: fleetBatch.isDone
					? undefined
					: (fleetBatch.cursor ?? undefined),
			},
			processed: contractBatch.processed + raidBatch.processed + fleetBatch.processed,
			done: contractBatch.isDone && raidBatch.isDone && fleetBatch.isDone,
		};
	},
});

export function contractRewardResourcesTotal(row: Pick<Doc<"contractResults">, "rewardCargoLoaded">) {
	return wholeUnitsFromScaledBucket(row.rewardCargoLoaded);
}

export function transportDeliveredResourcesTotal(
	row: Pick<Doc<"fleetOperationResults">, "cargoDeliveredToStorage">,
) {
	return wholeUnitsFromScaledBucket(row.cargoDeliveredToStorage);
}
