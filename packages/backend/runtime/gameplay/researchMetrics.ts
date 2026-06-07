import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { internalMutation, type MutationCtx } from "../../convex/_generated/server";

type ResearchMetricSourceKind =
	| "contractResult"
	| "npcRaidResult"
	| "fleetOperationResult"
	| "colonyInfrastructure"
	| "researchSpend"
	| "researchEarn"
	| "colonization";

type BackfillCursorState = {
	contractResultsCursor?: string;
	fleetOperationResultsCursor?: string;
	npcRaidResultsCursor?: string;
};

function nonNegativeInteger(value: number | undefined) {
	return Math.max(0, Math.floor(value ?? 0));
}

function metaMatterTotal(bundle: { common: number; rare: number; mythic: number }) {
	return (
		nonNegativeInteger(bundle.common) +
		nonNegativeInteger(bundle.rare) +
		nonNegativeInteger(bundle.mythic)
	);
}

export async function ensurePlayerResearchMetrics(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("playerResearchMetrics")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchMetrics", {
		playerId: args.playerId,
		contractsCompleted: 0,
		rank3ContractsCompleted: 0,
		raidDefensesSucceeded: 0,
		successfulTransports: 0,
		coloniesFounded: 0,
		crossSystemColoniesFounded: 0,
		crossSectorColoniesFounded: 0,
		metaMatterSpentCommon: 0,
		metaMatterSpentRare: 0,
		metaMatterSpentMythic: 0,
		metaMatterEarnedCommon: 0,
		metaMatterEarnedRare: 0,
		metaMatterEarnedMythic: 0,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(id);
	if (!inserted) {
		throw new ConvexError("Failed to create player research metrics");
	}
	return inserted;
}

export async function ensureColonyResearchMetrics(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("colonyResearchMetrics")
		.withIndex("by_player_colony", (q) =>
			q.eq("playerId", args.playerId).eq("colonyId", args.colonyId),
		)
		.unique();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const id = await args.ctx.db.insert("colonyResearchMetrics", {
		playerId: args.playerId,
		colonyId: args.colonyId,
		maxResourceProductionBuildingLevel: 0,
		maxStorageBuildingLevel: 0,
		resourceAndStorageLevelTotal: 0,
		maxFacilityLevel: 0,
		facilityLevelTotal: 0,
		successfulTransportsOrigin: 0,
		successfulTransportsTarget: 0,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(id);
	if (!inserted) {
		throw new ConvexError("Failed to create colony research metrics");
	}
	return inserted;
}

export async function markResearchMetricSourceProcessed(args: {
	ctx: MutationCtx;
	now?: number;
	sourceId: string;
	sourceKind: ResearchMetricSourceKind;
}) {
	const existing = await args.ctx.db
		.query("researchMetricMarks")
		.withIndex("by_source", (q) =>
			q.eq("sourceKind", args.sourceKind).eq("sourceId", args.sourceId),
		)
		.unique();
	if (existing) {
		return false;
	}
	await args.ctx.db.insert("researchMetricMarks", {
		sourceKind: args.sourceKind,
		sourceId: args.sourceId,
		createdAt: args.now ?? Date.now(),
	});
	return true;
}

export async function incrementResearchContractMetrics(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
	originColonyId?: Id<"colonies">;
	rank?: number;
	rewardMetaMatter?: { common: number; rare: number; mythic: number };
	success: boolean;
}) {
	if (!args.success) {
		return;
	}
	const metrics = await ensurePlayerResearchMetrics(args);
	const reward = args.rewardMetaMatter ?? { common: 0, rare: 0, mythic: 0 };
	await args.ctx.db.patch(metrics._id, {
		contractsCompleted: metrics.contractsCompleted + 1,
		rank3ContractsCompleted:
			metrics.rank3ContractsCompleted + (nonNegativeInteger(args.rank) >= 3 ? 1 : 0),
		metaMatterEarnedCommon: metrics.metaMatterEarnedCommon + nonNegativeInteger(reward.common),
		metaMatterEarnedRare: metrics.metaMatterEarnedRare + nonNegativeInteger(reward.rare),
		metaMatterEarnedMythic: metrics.metaMatterEarnedMythic + nonNegativeInteger(reward.mythic),
		updatedAt: Date.now(),
	});
	if (args.originColonyId) {
		await ensureColonyResearchMetrics({
			ctx: args.ctx,
			playerId: args.playerId,
			colonyId: args.originColonyId,
		});
	}
}

export async function incrementResearchRaidMetrics(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
	colonyId: Id<"colonies">;
	defended: boolean;
}) {
	if (!args.defended) {
		return;
	}
	const [playerMetrics] = await Promise.all([
		ensurePlayerResearchMetrics(args),
		ensureColonyResearchMetrics(args),
	]);
	await args.ctx.db.patch(playerMetrics._id, {
		raidDefensesSucceeded: playerMetrics.raidDefensesSucceeded + 1,
		updatedAt: Date.now(),
	});
}

export async function incrementResearchTransportMetrics(args: {
	ctx: MutationCtx;
	originColonyId: Id<"colonies">;
	playerId: Id<"players">;
	targetColonyId?: Id<"colonies">;
}) {
	const playerMetrics = await ensurePlayerResearchMetrics(args);
	const originMetrics = await ensureColonyResearchMetrics({
		ctx: args.ctx,
		playerId: args.playerId,
		colonyId: args.originColonyId,
	});
	await args.ctx.db.patch(playerMetrics._id, {
		successfulTransports: playerMetrics.successfulTransports + 1,
		updatedAt: Date.now(),
	});
	await args.ctx.db.patch(originMetrics._id, {
		successfulTransportsOrigin: originMetrics.successfulTransportsOrigin + 1,
		updatedAt: Date.now(),
	});
	if (args.targetColonyId) {
		const targetColony = await args.ctx.db.get(args.targetColonyId);
		if (targetColony) {
			const targetMetrics = await ensureColonyResearchMetrics({
				ctx: args.ctx,
				playerId: targetColony.playerId,
				colonyId: targetColony._id,
			});
			await args.ctx.db.patch(targetMetrics._id, {
				successfulTransportsTarget: targetMetrics.successfulTransportsTarget + 1,
				updatedAt: Date.now(),
			});
		}
	}
}

export async function incrementResearchColonizationMetrics(args: {
	ctx: MutationCtx;
	originColonyId: Id<"colonies">;
	playerId: Id<"players">;
	targetPlanetId: Id<"planets">;
}) {
	const metrics = await ensurePlayerResearchMetrics(args);
	const originColony = await args.ctx.db.get(args.originColonyId);
	const [originPlanet, targetPlanet] = await Promise.all([
		originColony ? args.ctx.db.get(originColony.planetId) : null,
		args.ctx.db.get(args.targetPlanetId),
	]);
	await args.ctx.db.patch(metrics._id, {
		coloniesFounded: metrics.coloniesFounded + 1,
		crossSystemColoniesFounded:
			metrics.crossSystemColoniesFounded +
			(originPlanet &&
			targetPlanet &&
			(originPlanet.systemIndex !== targetPlanet.systemIndex ||
				originPlanet.sectorIndex !== targetPlanet.sectorIndex)
				? 1
				: 0),
		crossSectorColoniesFounded:
			metrics.crossSectorColoniesFounded +
			(originPlanet && targetPlanet && originPlanet.sectorIndex !== targetPlanet.sectorIndex
				? 1
				: 0),
		updatedAt: Date.now(),
	});
}

export async function ensurePlayerResearchRuntimeState(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("playerResearchRuntimeState")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
	if (existing) {
		return existing;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchRuntimeState", {
		playerId: args.playerId,
		activeCommandColonyId: undefined,
		activeCommandExpiresAt: undefined,
		activeCommandAccountExpiresAt: undefined,
		crossBranchDiscountBranch: undefined,
		crossBranchDiscountExpiresAt: undefined,
		metaMatterConversionDay: undefined,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(id);
	if (!inserted) {
		throw new ConvexError("Failed to create player research runtime state");
	}
	return inserted;
}

export async function incrementResearchMetaMatterEarned(args: {
	amount: { common: number; rare: number; mythic: number };
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	if (metaMatterTotal(args.amount) <= 0) {
		return;
	}
	const metrics = await ensurePlayerResearchMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		metaMatterEarnedCommon: metrics.metaMatterEarnedCommon + nonNegativeInteger(args.amount.common),
		metaMatterEarnedRare: metrics.metaMatterEarnedRare + nonNegativeInteger(args.amount.rare),
		metaMatterEarnedMythic: metrics.metaMatterEarnedMythic + nonNegativeInteger(args.amount.mythic),
		updatedAt: Date.now(),
	});
}

export async function incrementResearchMetaMatterSpent(args: {
	amount: { common: number; rare: number; mythic: number };
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	if (metaMatterTotal(args.amount) <= 0) {
		return;
	}
	const metrics = await ensurePlayerResearchMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		metaMatterSpentCommon: metrics.metaMatterSpentCommon + nonNegativeInteger(args.amount.common),
		metaMatterSpentRare: metrics.metaMatterSpentRare + nonNegativeInteger(args.amount.rare),
		metaMatterSpentMythic: metrics.metaMatterSpentMythic + nonNegativeInteger(args.amount.mythic),
		updatedAt: Date.now(),
	});
}

export async function adjustResearchMetaMatterSpent(args: {
	amount: { common: number; rare: number; mythic: number };
	ctx: MutationCtx;
	direction: 1 | -1;
	playerId: Id<"players">;
}) {
	if (metaMatterTotal(args.amount) <= 0) {
		return;
	}
	const metrics = await ensurePlayerResearchMetrics(args);
	await args.ctx.db.patch(metrics._id, {
		metaMatterSpentCommon: Math.max(
			0,
			metrics.metaMatterSpentCommon + args.direction * nonNegativeInteger(args.amount.common),
		),
		metaMatterSpentRare: Math.max(
			0,
			metrics.metaMatterSpentRare + args.direction * nonNegativeInteger(args.amount.rare),
		),
		metaMatterSpentMythic: Math.max(
			0,
			metrics.metaMatterSpentMythic + args.direction * nonNegativeInteger(args.amount.mythic),
		),
		updatedAt: Date.now(),
	});
}

export async function recomputeColonyResearchMetrics(args: {
	colonyId: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const metrics = await ensureColonyResearchMetrics(args);
	const infraRows = await args.ctx.db
		.query("colonyInfrastructure")
		.withIndex("by_colony_id", (q) => q.eq("colonyId", args.colonyId))
		.collect();
	const infra = infraRows.sort((left, right) => left._creationTime - right._creationTime)[0];
	if (!infra) {
		return metrics;
	}
	const values = deriveColonyResearchMetricValues(infra);
	await args.ctx.db.patch(metrics._id, {
		...values,
		updatedAt: Date.now(),
	});
	const updated = await args.ctx.db.get(metrics._id);
	return updated ?? metrics;
}

function deriveColonyResearchMetricValues(infra: Doc<"colonyInfrastructure">) {
	const buildings = infra.buildings;
	const resourceProductionLevels = [
		buildings.alloyMineLevel,
		buildings.crystalMineLevel,
		buildings.fuelRefineryLevel,
	].map(nonNegativeInteger);
	const storageLevels = [
		buildings.alloyStorageLevel,
		buildings.crystalStorageLevel,
		buildings.fuelStorageLevel,
	].map(nonNegativeInteger);
	const facilityLevels = [
		buildings.roboticsHubLevel,
		buildings.researchDirectorateLevel,
		buildings.shipyardLevel,
		buildings.defenseGridLevel,
	].map(nonNegativeInteger);
	return {
		maxResourceProductionBuildingLevel: Math.max(0, ...resourceProductionLevels),
		maxStorageBuildingLevel: Math.max(0, ...storageLevels),
		resourceAndStorageLevelTotal: [...resourceProductionLevels, ...storageLevels].reduce(
			(sum, level) => sum + level,
			0,
		),
		maxFacilityLevel: Math.max(0, ...facilityLevels),
		facilityLevelTotal: facilityLevels.reduce((sum, level) => sum + level, 0),
	};
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
		if (
			!(await markResearchMetricSourceProcessed({
				ctx: args.ctx,
				now: args.now,
				sourceKind: "contractResult",
				sourceId: String(row._id),
			}))
		) {
			continue;
		}
		const contract = await args.ctx.db.get(row.contractId);
		await incrementResearchContractMetrics({
			ctx: args.ctx,
			playerId: row.playerId,
			originColonyId: row.originColonyId,
			rank: contract?.difficultyTier ?? contract?.snapshot.difficultyTier ?? 0,
			rewardMetaMatter: row.rewardMetaMatterGranted,
			success: row.success,
		});
		processed += 1;
	}
	return { cursor: result.continueCursor, isDone: result.isDone, processed };
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
		if (
			!(await markResearchMetricSourceProcessed({
				ctx: args.ctx,
				now: args.now,
				sourceKind: "npcRaidResult",
				sourceId: String(row._id),
			}))
		) {
			continue;
		}
		await incrementResearchRaidMetrics({
			ctx: args.ctx,
			playerId: row.targetPlayerId,
			colonyId: row.targetColonyId,
			defended: row.success === false,
		});
		processed += 1;
	}
	return { cursor: result.continueCursor, isDone: result.isDone, processed };
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
		if (
			!(await markResearchMetricSourceProcessed({
				ctx: args.ctx,
				now: args.now,
				sourceKind: "fleetOperationResult",
				sourceId: String(row._id),
			}))
		) {
			continue;
		}
		if (row.operationKind === "transport" && row.resultCode === "delivered") {
			await incrementResearchTransportMetrics({
				ctx: args.ctx,
				playerId: row.ownerPlayerId,
				originColonyId: row.originColonyId,
				targetColonyId: row.targetColonyId,
			});
		}
		if (row.operationKind === "colonize" && row.resultCode === "colonized") {
			const metrics = await ensurePlayerResearchMetrics({
				ctx: args.ctx,
				playerId: row.ownerPlayerId,
			});
			await args.ctx.db.patch(metrics._id, {
				coloniesFounded: metrics.coloniesFounded + 1,
				updatedAt: args.now,
			});
		}
		processed += 1;
	}
	return { cursor: result.continueCursor, isDone: result.isDone, processed };
}

export const backfillResearchMetricsBatch = internalMutation({
	args: {
		cursor: v.optional(
			v.object({
				contractResultsCursor: v.optional(v.string()),
				fleetOperationResultsCursor: v.optional(v.string()),
				npcRaidResultsCursor: v.optional(v.string()),
			}),
		),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		cursor: v.object({
			contractResultsCursor: v.optional(v.string()),
			fleetOperationResultsCursor: v.optional(v.string()),
			npcRaidResultsCursor: v.optional(v.string()),
		}),
		done: v.boolean(),
		processed: v.number(),
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
				contractResultsCursor: contractBatch.isDone
					? undefined
					: (contractBatch.cursor ?? undefined),
				fleetOperationResultsCursor: fleetBatch.isDone
					? undefined
					: (fleetBatch.cursor ?? undefined),
				npcRaidResultsCursor: raidBatch.isDone ? undefined : (raidBatch.cursor ?? undefined),
			},
			done: contractBatch.isDone && raidBatch.isDone && fleetBatch.isDone,
			processed: contractBatch.processed + raidBatch.processed + fleetBatch.processed,
		};
	},
});
