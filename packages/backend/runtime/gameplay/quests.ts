import {
	QUEST_DEFINITIONS,
	buildQuestEvaluationContextFromFacts,
	evaluateQuestDefinition,
	type QuestBindings,
	type QuestClientColonyFacts,
	type QuestClientColonyMetric,
	type QuestClientFacts,
	type QuestDefinition,
	type QuestStateRowView,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "../../convex/_generated/server";
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
	resolveCurrentPlayer,
	scaledUnits,
	upsertColonyCompanionRows,
} from "./shared";

const questBindingsValidator = v.object({
	colonyId: v.optional(v.string()),
});

const questStateRowViewValidator = v.object({
	questId: v.string(),
	status: v.union(v.literal("active"), v.literal("claimed")),
	questVersion: v.number(),
	bindings: questBindingsValidator,
	activatedAt: v.number(),
	claimedAt: v.optional(v.number()),
});

const questClientColonyFactsValidator = v.object({
	colonyId: v.string(),
	buildings: v.object({
		alloyMineLevel: v.optional(v.number()),
		crystalMineLevel: v.optional(v.number()),
		fuelRefineryLevel: v.optional(v.number()),
		powerPlantLevel: v.optional(v.number()),
		alloyStorageLevel: v.optional(v.number()),
		crystalStorageLevel: v.optional(v.number()),
		fuelStorageLevel: v.optional(v.number()),
	}),
	facilities: v.object({
		robotics_hub: v.optional(v.number()),
		shipyard: v.optional(v.number()),
		defense_grid: v.optional(v.number()),
	}),
	defenses: v.object({
		missileBattery: v.optional(v.number()),
		laserTurret: v.optional(v.number()),
		gaussCannon: v.optional(v.number()),
		shieldDome: v.optional(v.number()),
	}),
	ships: v.object({
		smallCargo: v.optional(v.number()),
		largeCargo: v.optional(v.number()),
		colonyShip: v.optional(v.number()),
		interceptor: v.optional(v.number()),
		frigate: v.optional(v.number()),
		cruiser: v.optional(v.number()),
		bomber: v.optional(v.number()),
	}),
});

const questClientColonyMetricValidator = v.object({
	colonyId: v.string(),
	contractSuccessCount: v.number(),
	contractRewardResourcesTotal: v.number(),
	raidDefenseSuccessCount: v.number(),
	transportDeliveryCount: v.number(),
	transportDeliveredResourcesTotal: v.number(),
});

const questClientFactsValidator = v.object({
	colonyCount: v.number(),
	colonizationSuccessCount: v.number(),
	colonies: v.array(questClientColonyFactsValidator),
	colonyMetrics: v.array(questClientColonyMetricValidator),
});

const getClientStateResultValidator = v.object({
	questRows: v.array(questStateRowViewValidator),
	facts: questClientFactsValidator,
});

const ensureActivationsResultValidator = v.object({
	activatedQuestIds: v.array(v.string()),
});

const claimResultValidator = v.object({
	claimedQuestId: v.string(),
	status: v.literal("claimed"),
});

function normalizeQuestRowStatus(status: Doc<"playerQuestStates">["status"]): "active" | "claimed" {
	return status === "claimed" ? "claimed" : "active";
}

function toQuestStateRowView(row: Doc<"playerQuestStates">): QuestStateRowView {
	return {
		questId: row.questId as never,
		status: normalizeQuestRowStatus(row.status),
		questVersion: row.questVersion,
		bindings: row.bindings ?? {},
		activatedAt: row.activatedAt,
		claimedAt: row.claimedAt,
	};
}

async function readQuestRowsByPlayer(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	return args.ctx.db
		.query("playerQuestStates")
		.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
		.collect();
}

function arePrerequisitesSatisfied(args: {
	claimedQuestIds: Set<string>;
	playerRank: number;
	prerequisites: QuestDefinition["prerequisites"];
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
	colonies: Array<Pick<Doc<"colonies">, "_id">>;
	definition: QuestDefinition;
}) {
	const colonyIds = new Set(args.colonies.map((colony) => colony._id));
	if (args.definition.bindingStrategy === "activeColony") {
		if (!args.activeColonyId || !colonyIds.has(args.activeColonyId)) {
			return null;
		}
		return { colonyId: args.activeColonyId };
	}
	if (args.definition.bindingStrategy === "newestPlayerColony") {
		const newestColony = args.colonies[args.colonies.length - 1];
		return newestColony ? { colonyId: newestColony._id } : null;
	}
	return {};
}

function sanitizeQuestBindings(args: {
	bindings: QuestBindings;
	colonies: Array<Pick<Doc<"colonies">, "_id">>;
	definition: QuestDefinition;
}) {
	if (args.definition.bindingStrategy === "none") {
		return {};
	}
	const colonyIds = new Set(args.colonies.map((colony) => colony._id));
	if (!args.bindings.colonyId) {
		return null;
	}
	return colonyIds.has(args.bindings.colonyId as Id<"colonies">) ? args.bindings : null;
}

function toQuestColonyFacts(
	colonyId: Id<"colonies">,
	infrastructure: Doc<"colonyInfrastructure"> | null,
	ships: Doc<"colonyShips">[],
	defenses: Doc<"colonyDefenses">[],
): QuestClientColonyFacts {
	const shipCounts = ships.reduce<QuestClientColonyFacts["ships"]>((acc, row) => {
		acc[row.shipKey] = row.count;
		return acc;
	}, {});
	const defenseCounts = defenses.reduce<QuestClientColonyFacts["defenses"]>((acc, row) => {
		acc[row.defenseKey] = row.count;
		return acc;
	}, {});
	const buildings = infrastructure?.buildings;

	return {
		colonyId,
		buildings: {
			alloyMineLevel: buildings?.alloyMineLevel,
			crystalMineLevel: buildings?.crystalMineLevel,
			fuelRefineryLevel: buildings?.fuelRefineryLevel,
			powerPlantLevel: buildings?.powerPlantLevel,
			alloyStorageLevel: buildings?.alloyStorageLevel,
			crystalStorageLevel: buildings?.crystalStorageLevel,
			fuelStorageLevel: buildings?.fuelStorageLevel,
		},
		facilities: {
			robotics_hub: buildings?.roboticsHubLevel ?? 0,
			shipyard: buildings?.shipyardLevel ?? 0,
			defense_grid: buildings?.defenseGridLevel ?? 0,
		},
		defenses: defenseCounts,
		ships: shipCounts,
	};
}

async function loadQuestColonyFacts(args: {
	colonyIds: Id<"colonies">[];
	ctx: QueryCtx | MutationCtx;
}) {
	return Promise.all(
		args.colonyIds.map(async (colonyId) => {
			const [infrastructure, ships, defenses] = await Promise.all([
				args.ctx.db
					.query("colonyInfrastructure")
					.withIndex("by_colony_id", (q) => q.eq("colonyId", colonyId))
					.unique(),
				args.ctx.db
					.query("colonyShips")
					.withIndex("by_colony", (q) => q.eq("colonyId", colonyId))
					.collect(),
				args.ctx.db
					.query("colonyDefenses")
					.withIndex("by_colony", (q) => q.eq("colonyId", colonyId))
					.collect(),
			]);
			return toQuestColonyFacts(colonyId, infrastructure, ships, defenses);
		}),
	);
}

async function loadQuestClientFacts(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}): Promise<QuestClientFacts> {
	const colonies = await listPlayerColonies({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const colonyIds = colonies.map((colony) => colony._id);
	const [colonyFacts, playerMetrics, colonyMetricRows] = await Promise.all([
		loadQuestColonyFacts({
			ctx: args.ctx,
			colonyIds,
		}),
		args.ctx.db
			.query("playerQuestMetrics")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.unique(),
		args.ctx.db
			.query("colonyQuestMetrics")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.collect(),
	]);
	const metricByColonyId = new Map(colonyMetricRows.map((row) => [row.colonyId, row]));
	const colonyMetrics: QuestClientColonyMetric[] = colonyIds.map((colonyId) => {
		const row = metricByColonyId.get(colonyId);
		return {
			colonyId,
			contractSuccessCount: row?.contractSuccessCount ?? 0,
			contractRewardResourcesTotal: row?.contractRewardResourcesTotal ?? 0,
			raidDefenseSuccessCount: row?.raidDefenseSuccessCount ?? 0,
			transportDeliveryCount: row?.transportDeliveryCount ?? 0,
			transportDeliveredResourcesTotal: row?.transportDeliveredResourcesTotal ?? 0,
		};
	});

	return {
		colonyCount: colonies.length,
		colonizationSuccessCount: playerMetrics?.colonizationSuccessCount ?? 0,
		colonies: colonyFacts,
		colonyMetrics,
	};
}

function needsAnyColonyFacts(definition: QuestDefinition) {
	return definition.objectives.some(
		(objective) =>
			objective.kind === "buildingLevelAtLeast" ||
			objective.kind === "facilityLevelAtLeast" ||
			objective.kind === "shipCountAtLeast" ||
			objective.kind === "defenseCountAtLeast",
	);
}

function needsAllColonyFacts(definition: QuestDefinition) {
	return definition.objectives.some(
		(objective) =>
			(objective.kind === "buildingLevelAtLeast" ||
				objective.kind === "facilityLevelAtLeast" ||
				objective.kind === "shipCountAtLeast" ||
				objective.kind === "defenseCountAtLeast") &&
			objective.scope !== "boundColony",
	);
}

function needsColonyMetrics(definition: QuestDefinition) {
	return definition.objectives.some(
		(objective) =>
			objective.kind === "contractSuccessCountAtLeast" ||
			objective.kind === "contractRewardResourcesAtLeast" ||
			objective.kind === "raidDefenseSuccessCountAtLeast" ||
			objective.kind === "transportDeliveryCountAtLeast" ||
			objective.kind === "transportDeliveredResourcesAtLeast",
	);
}

function needsAllColonyMetrics(definition: QuestDefinition) {
	return definition.objectives.some(
		(objective) =>
			(objective.kind === "contractSuccessCountAtLeast" ||
				objective.kind === "contractRewardResourcesAtLeast" ||
				objective.kind === "raidDefenseSuccessCountAtLeast" ||
				objective.kind === "transportDeliveryCountAtLeast" ||
				objective.kind === "transportDeliveredResourcesAtLeast") &&
			objective.scope !== "boundColony",
	);
}

async function loadQuestFactsForClaim(args: {
	bindings: QuestBindings;
	ctx: MutationCtx;
	definition: QuestDefinition;
	playerId: Id<"players">;
}): Promise<QuestClientFacts> {
	const needsColonyCount = args.definition.objectives.some(
		(objective) => objective.kind === "colonyCountAtLeast",
	);
	const needsPlayerMetric = args.definition.objectives.some(
		(objective) => objective.kind === "colonizationSuccessCountAtLeast",
	);
	const shouldLoadColonies =
		needsColonyCount ||
		needsAllColonyFacts(args.definition) ||
		needsAllColonyMetrics(args.definition);
	const colonies = shouldLoadColonies
		? await listPlayerColonies({
				ctx: args.ctx,
				playerId: args.playerId,
			})
		: [];
	const colonyCount = shouldLoadColonies ? colonies.length : 0;
	const boundColonyId = args.bindings.colonyId as Id<"colonies"> | undefined;

	let colonyFacts: QuestClientColonyFacts[] = [];
	if (needsAnyColonyFacts(args.definition)) {
		if (needsAllColonyFacts(args.definition)) {
			colonyFacts = await loadQuestColonyFacts({
				ctx: args.ctx,
				colonyIds: colonies.map((colony) => colony._id),
			});
		} else if (boundColonyId) {
			colonyFacts = await loadQuestColonyFacts({
				ctx: args.ctx,
				colonyIds: [boundColonyId],
			});
		}
	}

	let colonyMetrics: QuestClientColonyMetric[] = [];
	if (needsColonyMetrics(args.definition)) {
		if (needsAllColonyMetrics(args.definition)) {
			const rows = await args.ctx.db
				.query("colonyQuestMetrics")
				.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
				.collect();
			colonyMetrics = rows.map((row) => ({
				colonyId: row.colonyId,
				contractSuccessCount: row.contractSuccessCount,
				contractRewardResourcesTotal: row.contractRewardResourcesTotal,
				raidDefenseSuccessCount: row.raidDefenseSuccessCount,
				transportDeliveryCount: row.transportDeliveryCount,
				transportDeliveredResourcesTotal: row.transportDeliveredResourcesTotal,
			}));
		} else if (boundColonyId) {
			const row = await args.ctx.db
				.query("colonyQuestMetrics")
				.withIndex("by_colony_id", (q) => q.eq("colonyId", boundColonyId))
				.unique();
			if (row) {
				colonyMetrics = [
					{
						colonyId: row.colonyId,
						contractSuccessCount: row.contractSuccessCount,
						contractRewardResourcesTotal: row.contractRewardResourcesTotal,
						raidDefenseSuccessCount: row.raidDefenseSuccessCount,
						transportDeliveryCount: row.transportDeliveryCount,
						transportDeliveredResourcesTotal: row.transportDeliveredResourcesTotal,
					},
				];
			}
		}
	}

	const playerMetrics = needsPlayerMetric
		? await args.ctx.db
				.query("playerQuestMetrics")
				.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
				.unique()
		: null;

	return {
		colonyCount,
		colonizationSuccessCount: playerMetrics?.colonizationSuccessCount ?? 0,
		colonies: colonyFacts,
		colonyMetrics,
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

export async function ensureQuestActivationsForPlayer(args: {
	activeColonyId?: Id<"colonies">;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const [player, existingRows, colonies] = await Promise.all([
		args.ctx.db.get(args.playerId),
		readQuestRowsByPlayer({ ctx: args.ctx, playerId: args.playerId }),
		listPlayerColonies({ ctx: args.ctx, playerId: args.playerId }),
	]);
	if (!player) {
		throw new ConvexError("Player not found");
	}

	const progression = await buildProgressionOverview({
		ctx: args.ctx,
		player,
	});
	const claimedQuestIds = new Set(
		existingRows.filter((row) => row.status === "claimed").map((row) => row.questId),
	);
	const rowsByQuestId = new Map(existingRows.map((row) => [row.questId, row]));
	const activatedQuestIds: string[] = [];
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
		if (existing) {
			const patch: Partial<Doc<"playerQuestStates">> = {};
			if (
				existing.bindings.colonyId &&
				sanitizeQuestBindings({
					bindings: existing.bindings,
					colonies,
					definition,
				}) === null
			) {
				patch.bindings = {};
				patch.status = "active";
			}
			if (existing.questVersion !== definition.version) {
				patch.questVersion = definition.version;
			}
			if (existing.status === "claimable") {
				patch.status = "active";
			}
			if (Object.keys(patch).length > 0) {
				await args.ctx.db.patch(existing._id, {
					...patch,
					updatedAt: now,
				});
			}
			continue;
		}

		const bindings = resolveQuestBindings({
			activeColonyId: args.activeColonyId,
			colonies,
			definition,
		});
		if (bindings === null) {
			continue;
		}

		await args.ctx.db.insert("playerQuestStates", {
			playerId: args.playerId,
			questId: definition.id,
			status: "active",
			questVersion: definition.version,
			bindings,
			activatedAt: now,
			claimedAt: undefined,
			createdAt: now,
			updatedAt: now,
		});
		activatedQuestIds.push(definition.id);
	}

	return {
		activatedQuestIds,
	};
}

export const getClientState = query({
	args: {},
	returns: getClientStateResultValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const [questRows, facts] = await Promise.all([
			readQuestRowsByPlayer({
				ctx,
				playerId: playerResult.player._id,
			}),
			loadQuestClientFacts({
				ctx,
				playerId: playerResult.player._id,
			}),
		]);
		return {
			questRows: questRows.map(toQuestStateRowView),
			facts,
		};
	},
});

export const ensureActivations = mutation({
	args: {
		activeColonyId: v.optional(v.id("colonies")),
	},
	returns: ensureActivationsResultValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		return ensureQuestActivationsForPlayer({
			ctx,
			playerId: playerResult.player._id,
			activeColonyId: args.activeColonyId,
		});
	},
});

export const ensureActivationsForPlayerInternal = internalMutation({
	args: {
		playerId: v.id("players"),
		activeColonyId: v.optional(v.id("colonies")),
	},
	returns: ensureActivationsResultValidator,
	handler: async (ctx, args) =>
		ensureQuestActivationsForPlayer({
			ctx,
			playerId: args.playerId,
			activeColonyId: args.activeColonyId,
		}),
});

export const claim = mutation({
	args: {
		questId: v.string(),
		activeColonyId: v.optional(v.id("colonies")),
	},
	returns: claimResultValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const playerId = playerResult.player._id;
		const definition = requireQuestDefinition(args.questId);
		const colonies = await listPlayerColonies({
			ctx,
			playerId,
		});
		const row = await ctx.db
			.query("playerQuestStates")
			.withIndex("by_player_quest", (q) => q.eq("playerId", playerId).eq("questId", definition.id))
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
		const bindings = sanitizeQuestBindings({
			bindings: row.bindings ?? {},
			colonies,
			definition,
		});
		if (bindings === null) {
			throw new ConvexError("Quest binding is no longer valid");
		}

		const facts = await loadQuestFactsForClaim({
			ctx,
			playerId,
			definition,
			bindings,
		});
		const context = buildQuestEvaluationContextFromFacts(facts);
		const evaluation = evaluateQuestDefinition({
			quest: definition,
			context,
			bindings,
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
				bindings,
				resources: reward.resources,
			});
		}

		await ctx.db.patch(row._id, {
			status: "claimed",
			claimedAt: row.claimedAt ?? now,
			updatedAt: now,
		});

		for (const effect of definition.effects ?? []) {
			if (effect.kind !== "spawnTutorialRaid" || !bindings.colonyId) {
				continue;
			}
			const colony = await ctx.db.get(bindings.colonyId as Id<"colonies">);
			if (!colony) {
				continue;
			}
			const existingRaid = await ctx.db
				.query("npcRaidOperations")
				.withIndex("by_target_status_event", (q) =>
					q.eq("targetColonyId", colony._id).eq("status", "inTransit"),
				)
				.first();
			if (existingRaid) {
				continue;
			}
			await spawnNpcRaidImmediatelyForColony({
				colony,
				ctx,
				scheduledAt: now,
				spawnReason: "tutorialRank2",
			});
		}

		await ensureQuestActivationsForPlayer({
			ctx,
			playerId,
			activeColonyId: args.activeColonyId ?? (bindings.colonyId as Id<"colonies"> | undefined),
		});

		return {
			claimedQuestId: definition.id,
			status: "claimed" as const,
		};
	},
});
