import {
	QUEST_DEFINITIONS,
	evaluateQuestDefinition,
	type QuestDefinition,
	type QuestBindings,
	type QuestEvaluationContext,
	type QuestLogItem,
	type QuestStatus,
	type QuestTrackerItem,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import { RESOURCE_SCALE } from "../../convex/schema";
import {
	buildProgressionOverview,
	ensurePlayerProgression,
	grantPlayerCredits,
	grantProgressionXp,
	requireQuestDefinition,
} from "./progression";
import { spawnNpcRaidImmediatelyForColony } from "./raids";
import {
	RESOURCE_KEYS,
	cloneResourceBucket,
	listPlayerColonies,
	loadColonyState,
	readColonyDefenseCounts,
	resolveCurrentPlayer,
	scaledUnits,
	upsertColonyCompanionRows,
} from "./shared";

const questRewardValidator = v.union(
	v.object({
		kind: v.literal("credits"),
		amount: v.number(),
	}),
	v.object({
		kind: v.literal("xp"),
		amount: v.number(),
	}),
	v.object({
		kind: v.literal("resources"),
		resources: v.object({
			alloy: v.number(),
			crystal: v.number(),
			fuel: v.number(),
		}),
	}),
);

const objectiveProgressValidator = v.object({
	complete: v.boolean(),
	current: v.number(),
	required: v.number(),
});

const questStatusValidator = v.union(
	v.literal("active"),
	v.literal("claimable"),
	v.literal("claimed"),
);

const questItemValidator = v.object({
	id: v.string(),
	title: v.string(),
	description: v.string(),
	category: v.union(v.literal("main"), v.literal("system"), v.literal("side")),
	order: v.number(),
	status: questStatusValidator,
	claimable: v.boolean(),
	version: v.number(),
	bindings: v.object({
		colonyId: v.optional(v.string()),
	}),
	rewards: v.array(questRewardValidator),
	objectives: v.array(objectiveProgressValidator),
});

const trackerValidator = v.object({
	items: v.array(
		v.object({
			id: v.string(),
			title: v.string(),
			description: v.string(),
			category: v.union(v.literal("main"), v.literal("system"), v.literal("side")),
			order: v.number(),
			status: questStatusValidator,
			claimable: v.boolean(),
			rewards: v.array(questRewardValidator),
			objectives: v.array(objectiveProgressValidator),
		}),
	),
});

const syncResultValidator = v.object({
	activatedQuestIds: v.array(v.string()),
	claimableQuestIds: v.array(v.string()),
});

const claimResultValidator = v.object({
	claimedQuestId: v.string(),
	status: v.literal("claimed"),
});

async function buildQuestEvaluationContext(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}): Promise<QuestEvaluationContext> {
	const colonies = await listPlayerColonies({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const [contractResults, raidResults, fleetOperationResults] = await Promise.all([
		args.ctx.db
			.query("contractResults")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.collect(),
		args.ctx.db
			.query("npcRaidResults")
			.withIndex("by_target_player_id", (q) => q.eq("targetPlayerId", args.playerId))
			.collect(),
		args.ctx.db
			.query("fleetOperationResults")
			.withIndex("by_owner_id", (q) => q.eq("ownerPlayerId", args.playerId))
			.collect(),
	]);
	const contextColonies = await Promise.all(
		colonies.map(async (colony) => {
			const state = await loadColonyState({
				colony,
				ctx: args.ctx,
			});
			const shipRows = await args.ctx.db
				.query("colonyShips")
				.withIndex("by_colony", (q) => q.eq("colonyId", colony._id))
				.collect();
			const ships = shipRows.reduce<Record<string, number>>((acc, row) => {
				acc[row.shipKey] = row.count;
				return acc;
			}, {});
			const defenses = await readColonyDefenseCounts({
				colonyId: colony._id,
				ctx: args.ctx,
			});
			return {
				colonyId: colony._id,
				buildings: {
					alloyMineLevel: state.buildings.alloyMineLevel,
					crystalMineLevel: state.buildings.crystalMineLevel,
					fuelRefineryLevel: state.buildings.fuelRefineryLevel,
					powerPlantLevel: state.buildings.powerPlantLevel,
					alloyStorageLevel: state.buildings.alloyStorageLevel,
					crystalStorageLevel: state.buildings.crystalStorageLevel,
					fuelStorageLevel: state.buildings.fuelStorageLevel,
				},
				facilities: {
					robotics_hub: state.buildings.roboticsHubLevel ?? 0,
					shipyard: state.buildings.shipyardLevel ?? 0,
					defense_grid: state.buildings.defenseGridLevel ?? 0,
				},
				defenses,
				ships,
			};
		}),
	);

	const contractSuccessCountByColony: Record<string, number> = {};
	const contractRewardResourcesByColony: Record<string, number> = {};
	for (const result of contractResults) {
		const originColonyId = result.originColonyId;
		if (!originColonyId || !result.success) {
			continue;
		}
		contractSuccessCountByColony[originColonyId] =
			(contractSuccessCountByColony[originColonyId] ?? 0) + 1;
		contractRewardResourcesByColony[originColonyId] =
			(contractRewardResourcesByColony[originColonyId] ?? 0) +
			Math.floor(
				(result.rewardCargoLoaded.alloy +
					result.rewardCargoLoaded.crystal +
					result.rewardCargoLoaded.fuel) /
					RESOURCE_SCALE,
			);
	}

	const raidDefenseSuccessCountByColony: Record<string, number> = {};
	for (const result of raidResults) {
		if (result.success) {
			continue;
		}
		raidDefenseSuccessCountByColony[result.targetColonyId] =
			(raidDefenseSuccessCountByColony[result.targetColonyId] ?? 0) + 1;
	}

	let colonizationSuccessCount = 0;
	const transportDeliveryCountByColony: Record<string, number> = {};
	const transportDeliveredResourcesByColony: Record<string, number> = {};
	for (const result of fleetOperationResults) {
		if (result.resultCode === "colonized" && result.operationKind === "colonize") {
			colonizationSuccessCount += 1;
		}
		if (result.resultCode !== "delivered" || result.operationKind !== "transport") {
			continue;
		}
		const targetColonyId = result.targetColonyId;
		if (!targetColonyId) {
			continue;
		}
		transportDeliveryCountByColony[targetColonyId] =
			(transportDeliveryCountByColony[targetColonyId] ?? 0) + 1;
		transportDeliveredResourcesByColony[targetColonyId] =
			(transportDeliveredResourcesByColony[targetColonyId] ?? 0) +
			Math.floor(
				(result.cargoDeliveredToStorage.alloy +
					result.cargoDeliveredToStorage.crystal +
					result.cargoDeliveredToStorage.fuel) /
					RESOURCE_SCALE,
			);
	}

	return {
		colonies: contextColonies,
		colonyCount: contextColonies.length,
		colonizationSuccessCount,
		contractRewardResourcesByColony,
		contractSuccessCountByColony,
		raidDefenseSuccessCountByColony,
		transportDeliveredResourcesByColony,
		transportDeliveryCountByColony,
	};
}

async function readQuestRowsByPlayer(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerQuestStates")
		.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
		.collect();
	const active = rows.filter((row) => row.status === "active");
	const claimable = rows.filter((row) => row.status === "claimable");
	const claimed = rows.filter((row) => row.status === "claimed");
	return [...active, ...claimable, ...claimed];
}

function arePrerequisitesSatisfied(args: {
	claimedQuestIds: Set<string>;
	playerRank: number;
	prerequisites: (typeof QUEST_DEFINITIONS)[number]["prerequisites"];
}) {
	return args.prerequisites.every((prerequisite) => {
		if (prerequisite.kind === "minimumRank") {
			return args.playerRank >= prerequisite.rank;
		}
		return args.claimedQuestIds.has(prerequisite.questId);
	});
}

function resolveQuestBindings(args: {
	activeColonyId?: Id<"colonies">;
	colonies: QuestEvaluationContext["colonies"];
	definition: QuestDefinition;
	existing?: Doc<"playerQuestStates"> | null;
}) {
	if (args.existing?.bindings) {
		return args.existing.bindings;
	}
	if (args.definition.bindingStrategy === "activeColony" && args.activeColonyId) {
		return { colonyId: args.activeColonyId };
	}
	if (args.definition.bindingStrategy === "newestPlayerColony") {
		const newestColony = args.colonies[args.colonies.length - 1];
		if (newestColony) {
			return { colonyId: newestColony.colonyId };
		}
	}
	return {};
}

function rowToBindings(row: Doc<"playerQuestStates"> | null | undefined): QuestBindings {
	return row?.bindings ?? {};
}

function toQuestLogItem(args: {
	evaluation: ReturnType<typeof evaluateQuestDefinition>;
	row: Doc<"playerQuestStates">;
}): QuestLogItem {
	const definition = requireQuestDefinition(args.row.questId);
	return {
		id: definition.id,
		title: definition.title,
		description: definition.description,
		category: definition.category,
		order: definition.order,
		status: args.row.status as QuestStatus,
		claimable: args.row.status === "claimable",
		version: definition.version,
		bindings: rowToBindings(args.row),
		rewards: definition.rewards,
		objectives: args.evaluation.objectives,
	};
}

async function applyResourceRewards(args: {
	bindings: QuestBindings;
	ctx: MutationCtx;
	now: number;
	playerId: Id<"players">;
	resources: { alloy: number; crystal: number; fuel: number };
}) {
	const colonies = await listPlayerColonies({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const targetColony =
		(args.bindings.colonyId
			? colonies.find((colony) => colony._id === args.bindings.colonyId)
			: null) ?? colonies[0];
	if (!targetColony) {
		console.error("Quest resource rewards skipped because no target colony was found", {
			boundColonyId: args.bindings.colonyId,
			colonyCount: colonies.length,
			playerId: args.playerId,
		});
		return;
	}
	const colony = await loadColonyState({
		colony: targetColony,
		ctx: args.ctx,
	});
	const nextResources = cloneResourceBucket(colony.resources);
	const nextOverflow = cloneResourceBucket(colony.overflow);
	for (const key of RESOURCE_KEYS) {
		const currentStored = nextResources[key];
		const cap = colony.storageCaps[key];
		const inbound = scaledUnits(args.resources[key]);
		const accepted = Math.max(0, Math.min(inbound, Math.max(0, cap - currentStored)));
		const overflow = Math.max(0, inbound - accepted);
		nextResources[key] = currentStored + accepted;
		nextOverflow[key] += overflow;
	}
	await args.ctx.db.patch(colony._id, {
		updatedAt: args.now,
	});
	await upsertColonyCompanionRows({
		colony: {
			...colony,
			resources: nextResources,
			overflow: nextOverflow,
			updatedAt: args.now,
		},
		ctx: args.ctx,
		now: args.now,
	});
}

async function evaluateQuestRows(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
	rows: Doc<"playerQuestStates">[];
}) {
	const context = await buildQuestEvaluationContext({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	return args.rows
		.map((row): QuestLogItem => {
			const definition = requireQuestDefinition(row.questId);
			const evaluation = evaluateQuestDefinition({
				quest: definition,
				context,
				bindings: rowToBindings(row),
			});
			return toQuestLogItem({
				evaluation,
				row,
			});
		})
		.sort((left: QuestLogItem, right: QuestLogItem) => left.order - right.order);
}

export async function syncQuestAvailabilityForPlayer(args: {
	activeColonyId?: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const [player, existingRows, questContext] = await Promise.all([
		args.ctx.db.get(args.playerId),
		readQuestRowsByPlayer({ ctx: args.ctx, playerId: args.playerId }),
		buildQuestEvaluationContext({ ctx: args.ctx, playerId: args.playerId }),
	]);
	if (!player) {
		throw new ConvexError("Player not found");
	}
	const progression = await buildProgressionOverview({
		ctx: args.ctx,
		player,
	});
	const rowsByQuestId = new Map(existingRows.map((row) => [row.questId, row]));
	const claimedQuestIds = new Set(
		existingRows.filter((row) => row.status === "claimed").map((row) => row.questId),
	);
	const activatedQuestIds: string[] = [];
	const claimableQuestIds: string[] = [];
	const now = Date.now();

	for (const definition of QUEST_DEFINITIONS) {
		if (
			!arePrerequisitesSatisfied({
				claimedQuestIds,
				playerRank: progression.rank,
				prerequisites: definition.prerequisites,
			})
		) {
			continue;
		}
		const existing = rowsByQuestId.get(definition.id);
		const bindings: QuestBindings = resolveQuestBindings({
			activeColonyId: args.activeColonyId,
			colonies: questContext.colonies,
			definition,
			existing,
		});
		const evaluation = evaluateQuestDefinition({
			quest: definition,
			context: questContext,
			bindings,
		});
		if (!existing) {
			const status = evaluation.complete ? "claimable" : "active";
			await args.ctx.db.insert("playerQuestStates", {
				playerId: args.playerId,
				questId: definition.id,
				status,
				questVersion: definition.version,
				bindings,
				activatedAt: now,
				claimableAt: status === "claimable" ? now : undefined,
				claimedAt: undefined,
				createdAt: now,
				updatedAt: now,
			});
			activatedQuestIds.push(definition.id);
			if (status === "claimable") {
				claimableQuestIds.push(definition.id);
			}
			continue;
		}
		if (existing.status === "claimed") {
			continue;
		}
		if (existing.status === "active" && evaluation.complete) {
			await args.ctx.db.patch(existing._id, {
				status: "claimable",
				claimableAt: existing.claimableAt ?? now,
				updatedAt: now,
			});
			claimableQuestIds.push(definition.id);
			continue;
		}
		if (existing.questVersion !== definition.version) {
			await args.ctx.db.patch(existing._id, {
				questVersion: definition.version,
				updatedAt: now,
			});
		}
	}

	return {
		activatedQuestIds,
		claimableQuestIds,
	};
}

export const syncAvailability = mutation({
	args: {
		activeColonyId: v.optional(v.id("colonies")),
	},
	returns: syncResultValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		return syncQuestAvailabilityForPlayer({
			ctx,
			playerId: playerResult.player._id,
			activeColonyId: args.activeColonyId,
		});
	},
});

export const getLog = query({
	args: {},
	returns: v.object({
		items: v.array(questItemValidator),
	}),
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const rows = await readQuestRowsByPlayer({
			ctx,
			playerId: playerResult.player._id,
		});
		const items = await evaluateQuestRows({
			ctx,
			playerId: playerResult.player._id,
			rows,
		});
		return { items };
	},
});

export const getTracker = query({
	args: {},
	returns: trackerValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const rows = await readQuestRowsByPlayer({
			ctx,
			playerId: playerResult.player._id,
		});
		const items = (
			await evaluateQuestRows({
				ctx,
				playerId: playerResult.player._id,
				rows: rows.filter((row) => row.status !== "claimed"),
			})
		).map<QuestTrackerItem>((item: QuestLogItem) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			category: item.category,
			order: item.order,
			status: item.status,
			claimable: item.claimable,
			rewards: item.rewards,
			objectives: item.objectives,
		}));
		return { items };
	},
});

export const claim = mutation({
	args: {
		questId: v.string(),
	},
	returns: claimResultValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const playerId = playerResult.player._id;
		const definition = requireQuestDefinition(args.questId);
		await syncQuestAvailabilityForPlayer({
			ctx,
			playerId,
		});
		const row = await ctx.db
			.query("playerQuestStates")
			.withIndex("by_player_quest", (q) =>
				q.eq("playerId", playerId).eq("questId", definition.id),
			)
			.unique();
		if (!row) {
			throw new ConvexError("Quest is not available");
		}
		if (row.status === "claimed") {
			return {
				claimedQuestId: definition.id,
				status: "claimed" as const,
			};
		}
		const questContext = await buildQuestEvaluationContext({
			ctx,
			playerId,
		});
		const evaluation = evaluateQuestDefinition({
			quest: definition,
			context: questContext,
			bindings: rowToBindings(row),
		});
		if (!evaluation.complete) {
			throw new ConvexError("Quest objectives are not complete");
		}
		const now = Date.now();
		for (const reward of definition.rewards) {
			if (reward.kind === "xp") {
				await grantProgressionXp({
					ctx,
						playerId,
					amount: reward.amount,
				});
				continue;
			}
			if (reward.kind === "credits") {
				await grantPlayerCredits({
					ctx,
						playerId,
					amount: reward.amount,
				});
				continue;
			}
			await applyResourceRewards({
				ctx,
				playerId,
				now,
				bindings: rowToBindings(row),
				resources: reward.resources,
			});
		}
		await ctx.db.patch(row._id, {
			status: "claimed",
			claimedAt: row.claimedAt ?? now,
			claimableAt: row.claimableAt ?? now,
			updatedAt: now,
		});
		for (const effect of definition.effects ?? []) {
			if (effect.kind !== "spawnTutorialRaid" || !row.bindings.colonyId) {
				continue;
			}
			const colony = await ctx.db.get(row.bindings.colonyId as Id<"colonies">);
			if (!colony) {
				continue;
			}
			const existingRaid = await ctx.db
				.query("npcRaidOperations")
				.withIndex("by_target_status_event", (q) =>
					q.eq("targetColonyId", colony._id).eq("status", "inTransit"),
				)
				.first();
			if (existingRaid?.spawnReason === "tutorialRank2") {
				continue;
			}
			await spawnNpcRaidImmediatelyForColony({
				colony,
				ctx,
				scheduledAt: now,
				spawnReason: "tutorialRank2",
			});
		}
		await syncQuestAvailabilityForPlayer({
			ctx,
			playerId: playerResult.player._id,
			activeColonyId: row.bindings.colonyId as Id<"colonies"> | undefined,
		});
		return {
			claimedQuestId: definition.id,
			status: "claimed" as const,
		};
	},
});
