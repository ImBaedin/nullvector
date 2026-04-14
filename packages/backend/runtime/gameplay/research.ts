import {
	DEFAULT_RESEARCH_BRANCHES,
	buildResearchModifierSnapshot,
	canResearchNodeStart,
	getResearchNode,
	getResearchNodeRequirementStatuses,
	getResearchTierUnlockRequirementStatuses,
	getResearchVisibility,
	isResearchTierUnlockSatisfied,
	rollMetaMatterBundle,
	type MetaMatterBundle,
	type ResearchKey,
	type ResearchLevelMap,
	type ResearchRequirementStatus,
	type ResearchTierUnlockContext,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import {
	internalMutation,
	mutation,
	query,
	type MutationCtx,
	type QueryCtx,
} from "../../convex/_generated/server";
import { adjustResearchMetaMatterSpent, ensurePlayerResearchRuntimeState } from "./researchMetrics";
import { scaledUnits } from "./shared";
import { getOwnedColony, resolveCurrentPlayer, upsertColonyCompanionRows } from "./shared";

const metaMatterValidator = v.object({
	common: v.number(),
	rare: v.number(),
	mythic: v.number(),
});

const authoredResourceCostValidator = v.object({
	alloy: v.number(),
	crystal: v.number(),
	fuel: v.number(),
});

const researchRequirementStatusValidator = v.object({
	key: v.string(),
	label: v.string(),
	met: v.boolean(),
});

const researchNodeVisibilityValidator = v.union(
	v.literal("hidden"),
	v.literal("silhouette"),
	v.literal("visible"),
);

const researchNodeStatusValidator = v.union(
	v.literal("completed"),
	v.literal("available"),
	v.literal("locked"),
	v.literal("researching"),
	v.literal("hidden"),
);

const researchNodeViewValidator = v.object({
	id: v.string(),
	name: v.string(),
	branch: v.string(),
	tier: v.number(),
	description: v.string(),
	layout: v.object({
		lane: v.string(),
		shape: v.string(),
	}),
	position: v.object({
		x: v.number(),
		y: v.number(),
	}),
	prerequisites: v.array(v.string()),
	level: v.number(),
	maxLevel: v.number(),
	visibility: researchNodeVisibilityValidator,
	status: researchNodeStatusValidator,
	canStart: v.boolean(),
	requiredResearchNetworkSize: v.number(),
	requiredResearchFacilityLevel: v.number(),
	requiredCombinedResearchCapacity: v.optional(v.number()),
	requirements: v.array(researchRequirementStatusValidator),
	effects: v.array(v.string()),
	nextCost: v.union(
		v.object({
			metaMatter: metaMatterValidator,
			resources: authoredResourceCostValidator,
			seconds: v.number(),
		}),
		v.null(),
	),
});

const researchTierViewValidator = v.object({
	tier: v.number(),
	unlocked: v.boolean(),
	requirements: v.array(researchRequirementStatusValidator),
	nodes: v.array(researchNodeViewValidator),
});

const researchBranchViewValidator = v.object({
	key: v.string(),
	label: v.string(),
	shortLabel: v.string(),
	themeColor: v.string(),
	themeColorSoft: v.string(),
	ditherWaveColor: v.array(v.number()),
	ditherPixelSize: v.number(),
	tiers: v.array(researchTierViewValidator),
});

const researchTierUnlockContextValidator = v.object({
	coloniesFounded: v.number(),
	contractsCompleted: v.number(),
	crossSectorColoniesFounded: v.number(),
	crossSystemColoniesFounded: v.number(),
	defensesOwned: v.number(),
	facilityLevelTotalOnOneColony: v.number(),
	highestBuildingLevel: v.number(),
	highestFacilityLevel: v.number(),
	highestResearchDirectorateLevel: v.number(),
	maxResourceAndStorageLevelTotal: v.number(),
	maxResourceProductionBuildingLevel: v.number(),
	maxStorageBuildingLevel: v.number(),
	metaMatterEarnedCommon: v.number(),
	metaMatterEarnedMythic: v.number(),
	metaMatterEarnedRare: v.number(),
	metaMatterSpentTotal: v.number(),
	raidDefensesSucceeded: v.number(),
	rank3ContractsCompleted: v.number(),
	researchNetworkSize: v.number(),
	shipsOwned: v.number(),
	successfulTransports: v.number(),
});

const researchQueueStatusValidator = v.union(
	v.literal("queued"),
	v.literal("active"),
	v.literal("completed"),
	v.literal("cancelled"),
	v.literal("failed"),
);

const researchStateViewValidator = v.object({
	playerId: v.id("players"),
	colonyId: v.id("colonies"),
	levels: v.record(v.string(), v.number()),
	balances: metaMatterValidator,
	researchNetworkSize: v.number(),
	combinedResearchCapacity: v.number(),
	localResearchFacilityLevel: v.number(),
	serverNow: v.number(),
	tierUnlockContext: researchTierUnlockContextValidator,
	tree: v.array(researchBranchViewValidator),
	activeResearch: v.union(
		v.object({
			queueItemId: v.id("playerResearchQueueItems"),
			researchKey: v.string(),
			fromLevel: v.number(),
			toLevel: v.number(),
			status: researchQueueStatusValidator,
			queuedAt: v.number(),
			startsAt: v.number(),
			completesAt: v.number(),
			costMetaMatter: metaMatterValidator,
			costResources: v.object({
				alloy: v.number(),
				crystal: v.number(),
				fuel: v.number(),
			}),
		}),
		v.null(),
	),
});

function emptyMetaMatter(): MetaMatterBundle {
	return {
		common: 0,
		rare: 0,
		mythic: 0,
	};
}

function cloneMetaMatter(bundle: Partial<MetaMatterBundle> | undefined): MetaMatterBundle {
	return {
		common: Math.max(0, Math.floor(bundle?.common ?? 0)),
		rare: Math.max(0, Math.floor(bundle?.rare ?? 0)),
		mythic: Math.max(0, Math.floor(bundle?.mythic ?? 0)),
	};
}

function pickCanonicalRow<T extends { _creationTime: number }>(rows: T[]) {
	if (rows.length === 0) {
		return null;
	}
	rows.sort((left, right) => left._creationTime - right._creationTime);
	return rows[0]!;
}

async function getPlayerResearchStateRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchState")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getPlayerResearchBalancesRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchBalances")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getPlayerResearchSchedulingRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("playerResearchScheduling")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	return pickCanonicalRow(rows);
}

async function getOpenResearchQueueRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const rows = await Promise.all([
		args.ctx.db
			.query("playerResearchQueueItems")
			.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
			.collect(),
		args.ctx.db
			.query("playerResearchQueueItems")
			.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "queued"))
			.collect(),
	]);
	return pickCanonicalRow(rows[0]) ?? pickCanonicalRow(rows[1]) ?? null;
}

export async function ensurePlayerResearchState(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await getPlayerResearchStateRow(args);
	if (existing) {
		return existing;
	}
	if (!("patch" in args.ctx.db)) {
		return {
			_id: undefined,
			playerId: args.playerId,
			levels: {},
			unlockedAtByKey: {},
			createdAt: 0,
			updatedAt: 0,
		} as const;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchState", {
		playerId: args.playerId,
		levels: {},
		unlockedAtByKey: {},
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

export async function ensurePlayerResearchBalances(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const existing = await getPlayerResearchBalancesRow(args);
	if (existing) {
		return existing;
	}
	if (!("patch" in args.ctx.db)) {
		return {
			_id: undefined,
			playerId: args.playerId,
			...emptyMetaMatter(),
			createdAt: 0,
			updatedAt: 0,
		} as const;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchBalances", {
		playerId: args.playerId,
		...emptyMetaMatter(),
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

async function ensurePlayerResearchScheduling(args: { ctx: MutationCtx; playerId: Id<"players"> }) {
	const existing = await getPlayerResearchSchedulingRow(args);
	if (existing) {
		return existing;
	}
	const now = Date.now();
	const id = await args.ctx.db.insert("playerResearchScheduling", {
		playerId: args.playerId,
		resolutionScheduledAt: undefined,
		resolutionJobId: undefined,
		createdAt: now,
		updatedAt: now,
	});
	return (await args.ctx.db.get(id))!;
}

export async function loadPlayerResearchLevels(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}): Promise<ResearchLevelMap> {
	const row = await ensurePlayerResearchState(args);
	return { ...(row.levels ?? {}) };
}

export async function loadPlayerResearchModifierSnapshot(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	return buildResearchModifierSnapshot(await loadPlayerResearchLevels(args));
}

export async function getEffectiveResearchCapacity(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	return (await getResearchAccountFacts(args)).researchNetworkSize;
}

type ResearchAccountFacts = {
	combinedResearchCapacity: number;
	researchNetworkSize: number;
	tierUnlockContext: ResearchTierUnlockContext;
};

async function getResearchAccountFacts(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}): Promise<ResearchAccountFacts> {
	const colonies = await args.ctx.db
		.query("colonies")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.collect();
	let researchNetworkSize = 0;
	let highestBuildingLevel = 0;
	let highestFacilityLevel = 0;
	let highestResearchDirectorateLevel = 0;
	let maxResourceProductionBuildingLevel = 0;
	let maxStorageBuildingLevel = 0;
	let maxResourceAndStorageLevelTotal = 0;
	let facilityLevelTotalOnOneColony = 0;
	const colonyPlanets = await Promise.all(
		colonies.map((colony) => args.ctx.db.get(colony.planetId)),
	);
	const homePlanet = colonyPlanets[0] ?? null;
	let crossSystemColoniesFounded = 0;
	let crossSectorColoniesFounded = 0;
	for (const planet of colonyPlanets) {
		if (!planet || !homePlanet) {
			continue;
		}
		if (
			planet.systemIndex !== homePlanet.systemIndex ||
			planet.sectorIndex !== homePlanet.sectorIndex
		) {
			crossSystemColoniesFounded += 1;
		}
		if (planet.sectorIndex !== homePlanet.sectorIndex) {
			crossSectorColoniesFounded += 1;
		}
	}
	for (const colony of colonies) {
		const infraRows = await args.ctx.db
			.query("colonyInfrastructure")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
			.collect();
		const buildings = pickCanonicalRow(infraRows)?.buildings;
		if (!buildings) {
			continue;
		}
		const researchDirectorateLevel = Math.max(
			0,
			Math.floor(buildings.researchDirectorateLevel ?? 0),
		);
		const roboticsHubLevel = Math.max(0, Math.floor(buildings.roboticsHubLevel ?? 0));
		const shipyardLevel = Math.max(0, Math.floor(buildings.shipyardLevel ?? 0));
		const defenseGridLevel = Math.max(0, Math.floor(buildings.defenseGridLevel ?? 0));
		const facilityTotal =
			researchDirectorateLevel + roboticsHubLevel + shipyardLevel + defenseGridLevel;
		const resourceProductionMax = Math.max(
			Math.max(0, Math.floor(buildings.alloyMineLevel ?? 0)),
			Math.max(0, Math.floor(buildings.crystalMineLevel ?? 0)),
			Math.max(0, Math.floor(buildings.fuelRefineryLevel ?? 0)),
		);
		const storageMax = Math.max(
			Math.max(0, Math.floor(buildings.alloyStorageLevel ?? 0)),
			Math.max(0, Math.floor(buildings.crystalStorageLevel ?? 0)),
			Math.max(0, Math.floor(buildings.fuelStorageLevel ?? 0)),
		);
		const resourceAndStorageTotal =
			Math.max(0, Math.floor(buildings.alloyMineLevel ?? 0)) +
			Math.max(0, Math.floor(buildings.crystalMineLevel ?? 0)) +
			Math.max(0, Math.floor(buildings.fuelRefineryLevel ?? 0)) +
			Math.max(0, Math.floor(buildings.alloyStorageLevel ?? 0)) +
			Math.max(0, Math.floor(buildings.crystalStorageLevel ?? 0)) +
			Math.max(0, Math.floor(buildings.fuelStorageLevel ?? 0));
		if (researchDirectorateLevel > 0) {
			researchNetworkSize += 1;
		}
		highestResearchDirectorateLevel = Math.max(
			highestResearchDirectorateLevel,
			researchDirectorateLevel,
		);
		highestFacilityLevel = Math.max(
			highestFacilityLevel,
			researchDirectorateLevel,
			roboticsHubLevel,
			shipyardLevel,
			defenseGridLevel,
		);
		facilityLevelTotalOnOneColony = Math.max(facilityLevelTotalOnOneColony, facilityTotal);
		maxResourceProductionBuildingLevel = Math.max(
			maxResourceProductionBuildingLevel,
			resourceProductionMax,
		);
		maxStorageBuildingLevel = Math.max(maxStorageBuildingLevel, storageMax);
		maxResourceAndStorageLevelTotal = Math.max(
			maxResourceAndStorageLevelTotal,
			resourceAndStorageTotal,
		);
		for (const level of Object.values(buildings)) {
			highestBuildingLevel = Math.max(highestBuildingLevel, Math.max(0, Math.floor(level ?? 0)));
		}
	}
	const [contractResults, transportResults, raidResults, shipRows, defenseRows] = await Promise.all(
		[
			args.ctx.db
				.query("contractResults")
				.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
				.collect(),
			args.ctx.db
				.query("fleetOperationResults")
				.withIndex("by_owner_id", (q) => q.eq("ownerPlayerId", args.playerId))
				.collect(),
			args.ctx.db
				.query("npcRaidResults")
				.withIndex("by_target_player_id", (q) => q.eq("targetPlayerId", args.playerId))
				.collect(),
			args.ctx.db
				.query("colonyShips")
				.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
				.collect(),
			args.ctx.db
				.query("colonyDefenses")
				.withIndex("by_player", (q) => q.eq("playerId", args.playerId))
				.collect(),
		],
	);
	const contractsForResults = await Promise.all(
		contractResults.map((result) => args.ctx.db.get(result.contractId)),
	);
	const rank3ContractsCompleted = contractResults.filter((result, index) => {
		const contract = contractsForResults[index];
		return (
			result.success && (contract?.difficultyTier ?? contract?.snapshot.difficultyTier ?? 0) >= 3
		);
	}).length;
	const [playerResearchMetrics, colonyResearchMetrics] = await Promise.all([
		args.ctx.db
			.query("playerResearchMetrics")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.unique(),
		args.ctx.db
			.query("colonyResearchMetrics")
			.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
			.collect(),
	]);
	for (const metric of colonyResearchMetrics) {
		maxResourceProductionBuildingLevel = Math.max(
			maxResourceProductionBuildingLevel,
			metric.maxResourceProductionBuildingLevel,
		);
		maxStorageBuildingLevel = Math.max(maxStorageBuildingLevel, metric.maxStorageBuildingLevel);
		maxResourceAndStorageLevelTotal = Math.max(
			maxResourceAndStorageLevelTotal,
			metric.resourceAndStorageLevelTotal,
		);
		highestFacilityLevel = Math.max(highestFacilityLevel, metric.maxFacilityLevel);
		facilityLevelTotalOnOneColony = Math.max(
			facilityLevelTotalOnOneColony,
			metric.facilityLevelTotal,
		);
	}
	const metaMatterEarned = contractResults.reduce(
		(total, result) => ({
			common: total.common + Math.max(0, Math.floor(result.rewardMetaMatterGranted.common)),
			rare: total.rare + Math.max(0, Math.floor(result.rewardMetaMatterGranted.rare)),
			mythic: total.mythic + Math.max(0, Math.floor(result.rewardMetaMatterGranted.mythic)),
		}),
		{ common: 0, rare: 0, mythic: 0 },
	);

	return {
		combinedResearchCapacity: researchNetworkSize,
		researchNetworkSize,
		tierUnlockContext: {
			coloniesFounded: Math.max(colonies.length, playerResearchMetrics?.coloniesFounded ?? 0),
			crossSectorColoniesFounded: Math.max(
				crossSectorColoniesFounded,
				playerResearchMetrics?.crossSectorColoniesFounded ?? 0,
			),
			crossSystemColoniesFounded: Math.max(
				crossSystemColoniesFounded,
				playerResearchMetrics?.crossSystemColoniesFounded ?? 0,
			),
			contractsCompleted: Math.max(
				contractResults.filter((result) => result.success).length,
				playerResearchMetrics?.contractsCompleted ?? 0,
			),
			defensesOwned: defenseRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.count)), 0),
			facilityLevelTotalOnOneColony,
			highestBuildingLevel,
			highestFacilityLevel,
			highestResearchDirectorateLevel,
			maxResourceAndStorageLevelTotal,
			maxResourceProductionBuildingLevel,
			maxStorageBuildingLevel,
			metaMatterEarnedCommon: Math.max(
				metaMatterEarned.common,
				playerResearchMetrics?.metaMatterEarnedCommon ?? 0,
			),
			metaMatterEarnedMythic: Math.max(
				metaMatterEarned.mythic,
				playerResearchMetrics?.metaMatterEarnedMythic ?? 0,
			),
			metaMatterEarnedRare: Math.max(
				metaMatterEarned.rare,
				playerResearchMetrics?.metaMatterEarnedRare ?? 0,
			),
			metaMatterSpentTotal: playerResearchMetrics
				? playerResearchMetrics.metaMatterSpentCommon +
					playerResearchMetrics.metaMatterSpentRare +
					playerResearchMetrics.metaMatterSpentMythic
				: 0,
			raidDefensesSucceeded: Math.max(
				raidResults.filter((result) => result.success === false).length,
				playerResearchMetrics?.raidDefensesSucceeded ?? 0,
			),
			rank3ContractsCompleted: Math.max(
				rank3ContractsCompleted,
				playerResearchMetrics?.rank3ContractsCompleted ?? 0,
			),
			researchNetworkSize,
			shipsOwned: shipRows.reduce((sum, row) => sum + Math.max(0, Math.floor(row.count)), 0),
			successfulTransports: Math.max(
				transportResults.filter(
					(result) => result.operationKind === "transport" && result.resultCode === "delivered",
				).length,
				playerResearchMetrics?.successfulTransports ?? 0,
			),
		},
	};
}

function cloneRequirementStatuses(
	requirements: readonly ResearchRequirementStatus[],
): ResearchRequirementStatus[] {
	return requirements.map((requirement) => ({ ...requirement }));
}

function buildResearchTreeView(args: {
	activeResearchKey: string | null;
	combinedResearchCapacity: number;
	hasOpenResearch: boolean;
	levels: ResearchLevelMap;
	tierUnlockContext: ResearchTierUnlockContext;
}) {
	return DEFAULT_RESEARCH_BRANCHES.map((branch) => ({
		key: branch.key,
		label: branch.label,
		shortLabel: branch.shortLabel,
		themeColor: branch.themeColor,
		themeColorSoft: branch.themeColorSoft,
		ditherWaveColor: branch.ditherWaveColor,
		ditherPixelSize: branch.ditherPixelSize,
		tiers: branch.tiers.map((tier) => {
			const tierRequirements = getResearchTierUnlockRequirementStatuses(
				tier.unlock,
				args.tierUnlockContext,
				`${branch.key}.${tier.tier}`,
			);
			return {
				tier: tier.tier,
				unlocked: isResearchTierUnlockSatisfied(tier.unlock, args.tierUnlockContext),
				requirements: cloneRequirementStatuses(tierRequirements),
				nodes: tier.nodes.map((node) => {
					const level = Math.max(0, Math.floor(args.levels[node.id] ?? 0));
					const visibility = getResearchVisibility({
						levels: args.levels,
						researchKey: node.id,
						tierUnlockContext: args.tierUnlockContext,
					});
					const canStart =
						!args.hasOpenResearch &&
						canResearchNodeStart({
							combinedResearchCapacity: args.combinedResearchCapacity,
							levels: args.levels,
							researchKey: node.id,
							tierUnlockContext: args.tierUnlockContext,
						});
					const status: "completed" | "available" | "locked" | "researching" | "hidden" =
						args.activeResearchKey === node.id
							? "researching"
							: level > 0
								? "completed"
								: visibility === "hidden"
									? "hidden"
									: canStart
										? "available"
										: "locked";
					const nextCost = node.costs[level];
					return {
						id: node.id,
						name: node.name,
						branch: node.branch,
						tier: node.tier,
						description: node.description,
						layout: node.layout,
						position: node.position,
						prerequisites: node.prerequisites,
						level,
						maxLevel: node.maxLevel,
						visibility,
						status,
						canStart,
						requiredResearchNetworkSize: node.requiredResearchNetworkSize,
						requiredResearchFacilityLevel: node.requiredResearchFacilityLevel,
						requiredCombinedResearchCapacity: node.requiredCombinedResearchCapacity,
						requirements: cloneRequirementStatuses(
							getResearchNodeRequirementStatuses({
								combinedResearchCapacity: args.combinedResearchCapacity,
								levels: args.levels,
								researchKey: node.id,
								tierUnlockContext: args.tierUnlockContext,
							}),
						),
						effects: node.effectLabels,
						nextCost: nextCost
							? {
									metaMatter: cloneMetaMatter(nextCost.metaMatter),
									resources: {
										alloy: nextCost.resources?.alloy ?? 0,
										crystal: nextCost.resources?.crystal ?? 0,
										fuel: nextCost.resources?.fuel ?? 0,
									},
									seconds: nextCost.seconds,
								}
							: null,
					};
				}),
			};
		}),
	}));
}

async function upsertPlayerResearchScheduling(args: {
	ctx: MutationCtx;
	now: number;
	playerId: Id<"players">;
	patch: Partial<
		Pick<Doc<"playerResearchScheduling">, "resolutionJobId" | "resolutionScheduledAt">
	>;
}) {
	const row = await ensurePlayerResearchScheduling({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (row._id) {
		await args.ctx.db.patch(row._id, {
			...args.patch,
			updatedAt: args.now,
		});
	}
}

async function cancelScheduledResearchIfPresent(args: {
	ctx: MutationCtx;
	jobId: Id<"_scheduled_functions"> | undefined;
}) {
	if (!args.jobId) {
		return;
	}
	await args.ctx.scheduler.cancel(args.jobId);
}

export async function reconcileResearchSchedule(args: {
	ctx: MutationCtx;
	force?: boolean;
	playerId: Id<"players">;
	skipCancel?: boolean;
}) {
	const scheduling = await ensurePlayerResearchScheduling({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const activeRows = await args.ctx.db
		.query("playerResearchQueueItems")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
		.collect();
	const active = pickCanonicalRow(activeRows);
	if (!active) {
		if (!args.skipCancel) {
			await cancelScheduledResearchIfPresent({
				ctx: args.ctx,
				jobId: scheduling.resolutionJobId,
			});
		}
		await upsertPlayerResearchScheduling({
			ctx: args.ctx,
			now: Date.now(),
			playerId: args.playerId,
			patch: {
				resolutionJobId: undefined,
				resolutionScheduledAt: undefined,
			},
		});
		return { nextDueAt: null as number | null };
	}
	if (
		!args.force &&
		scheduling.resolutionScheduledAt === active.completesAt &&
		scheduling.resolutionJobId !== undefined
	) {
		return { nextDueAt: active.completesAt };
	}
	if (!args.skipCancel) {
		await cancelScheduledResearchIfPresent({
			ctx: args.ctx,
			jobId: scheduling.resolutionJobId,
		});
	}
	const runAt = Math.max(Date.now(), active.completesAt);
	const jobId = await args.ctx.scheduler.runAt(runAt, internal.scheduler.resolvePlayerResearch, {
		playerId: args.playerId,
		scheduledAt: active.completesAt,
	});
	await upsertPlayerResearchScheduling({
		ctx: args.ctx,
		now: Date.now(),
		playerId: args.playerId,
		patch: {
			resolutionJobId: jobId,
			resolutionScheduledAt: active.completesAt,
		},
	});
	return { nextDueAt: active.completesAt };
}

export async function grantMetaMatter(args: {
	amounts: Partial<MetaMatterBundle>;
	ctx: MutationCtx;
	playerId: Id<"players">;
}) {
	const row = await ensurePlayerResearchBalances({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (!row._id) {
		throw new ConvexError("Research balances row missing");
	}
	await args.ctx.db.patch(row._id, {
		common: row.common + Math.max(0, Math.floor(args.amounts.common ?? 0)),
		rare: row.rare + Math.max(0, Math.floor(args.amounts.rare ?? 0)),
		mythic: row.mythic + Math.max(0, Math.floor(args.amounts.mythic ?? 0)),
		updatedAt: Date.now(),
	});
}

export async function getResearchState(args: {
	colonyId: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	const { colony, player } = await getOwnedColony({
		ctx: args.ctx,
		colonyId: args.colonyId,
	});
	const [state, balances, activeResearch, researchFacts] = await Promise.all([
		ensurePlayerResearchState({
			ctx: args.ctx,
			playerId: player._id,
		}),
		ensurePlayerResearchBalances({
			ctx: args.ctx,
			playerId: player._id,
		}),
		getOpenResearchQueueRow({
			ctx: args.ctx,
			playerId: player._id,
		}),
		getResearchAccountFacts({
			ctx: args.ctx,
			playerId: player._id,
		}),
	]);
	const levels = (state.levels ?? {}) as ResearchLevelMap;
	const localResearchFacilityLevel = Math.min(
		1,
		Math.max(0, Math.floor(colony.buildings.researchDirectorateLevel)),
	);
	const serverNow = Date.now();
	return {
		playerId: player._id,
		colonyId: colony._id,
		levels,
		balances: cloneMetaMatter(balances),
		researchNetworkSize: researchFacts.researchNetworkSize,
		combinedResearchCapacity: researchFacts.combinedResearchCapacity,
		localResearchFacilityLevel,
		serverNow,
		tierUnlockContext: researchFacts.tierUnlockContext,
		tree: buildResearchTreeView({
			activeResearchKey:
				activeResearch && (activeResearch.status === "active" || activeResearch.status === "queued")
					? activeResearch.researchKey
					: null,
			combinedResearchCapacity: researchFacts.combinedResearchCapacity,
			hasOpenResearch: Boolean(
				activeResearch &&
				(activeResearch.status === "active" || activeResearch.status === "queued"),
			),
			levels,
			tierUnlockContext: researchFacts.tierUnlockContext,
		}),
		activeResearch: activeResearch
			? {
					queueItemId: activeResearch._id,
					researchKey: activeResearch.researchKey,
					fromLevel: activeResearch.fromLevel,
					toLevel: activeResearch.toLevel,
					status: activeResearch.status,
					queuedAt: activeResearch.queuedAt,
					startsAt: activeResearch.startsAt,
					completesAt: activeResearch.completesAt,
					costMetaMatter: cloneMetaMatter(activeResearch.costMetaMatter),
					costResources: activeResearch.costResources,
				}
			: null,
	};
}

export async function settleResearchQueue(args: {
	ctx: MutationCtx;
	now: number;
	playerId: Id<"players">;
}) {
	const activeRows = await args.ctx.db
		.query("playerResearchQueueItems")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId).eq("status", "active"))
		.collect();
	const active = pickCanonicalRow(activeRows);
	if (!active || active.completesAt > args.now) {
		return { resolvedQueueItemId: null as Id<"playerResearchQueueItems"> | null };
	}
	const state = await ensurePlayerResearchState({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	if (!state._id) {
		throw new ConvexError("Research state row missing");
	}
	const nextLevels = {
		...(state.levels ?? {}),
		[active.researchKey]: active.toLevel,
	};
	const nextUnlockedAt = {
		...(state.unlockedAtByKey ?? {}),
		[active.researchKey]:
			active.fromLevel <= 0 ? args.now : (state.unlockedAtByKey?.[active.researchKey] ?? args.now),
	};
	await args.ctx.db.patch(state._id, {
		levels: nextLevels,
		unlockedAtByKey: nextUnlockedAt,
		updatedAt: args.now,
	});
	await args.ctx.db.patch(active._id, {
		status: "completed",
		resolvedAt: args.now,
		updatedAt: args.now,
	});
	await upsertPlayerResearchScheduling({
		ctx: args.ctx,
		now: args.now,
		playerId: args.playerId,
		patch: {
			resolutionJobId: undefined,
			resolutionScheduledAt: undefined,
		},
	});
	return { resolvedQueueItemId: active._id };
}

export const getState = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: researchStateViewValidator,
	handler: async (ctx, args) => {
		return getResearchState({
			colonyId: args.colonyId,
			ctx,
		});
	},
});

export const enqueue = mutation({
	args: {
		colonyId: v.id("colonies"),
		researchKey: v.string(),
	},
	returns: researchStateViewValidator.fields.activeResearch,
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const now = Date.now();
		const openResearch = await getOpenResearchQueueRow({
			ctx,
			playerId: player._id,
		});
		if (openResearch) {
			throw new ConvexError("Research queue already has an active item");
		}
		const node = getResearchNode(args.researchKey as ResearchKey);
		if (!node) {
			throw new ConvexError("Unknown research node");
		}
		const [state, balances, researchFacts, modifierSnapshot] = await Promise.all([
			ensurePlayerResearchState({
				ctx,
				playerId: player._id,
			}),
			ensurePlayerResearchBalances({
				ctx,
				playerId: player._id,
			}),
			getResearchAccountFacts({
				ctx,
				playerId: player._id,
			}),
			loadPlayerResearchModifierSnapshot({
				ctx,
				playerId: player._id,
			}),
		]);
		const levels = (state.levels ?? {}) as Record<string, number>;
		const fromLevel = Math.max(0, Math.floor(levels[node.id] ?? 0));
		if (
			!canResearchNodeStart({
				combinedResearchCapacity: researchFacts.combinedResearchCapacity,
				levels,
				researchKey: node.id,
				tierUnlockContext: researchFacts.tierUnlockContext,
			})
		) {
			throw new ConvexError("Research requirements not met");
		}
		const cost = node.costs[fromLevel];
		if (!cost) {
			throw new ConvexError("Research cost definition missing");
		}
		const costMetaMatter = cloneMetaMatter(cost.metaMatter);
		const costResources = {
			alloy: scaledUnits(cost.resources?.alloy ?? 0),
			crystal: scaledUnits(cost.resources?.crystal ?? 0),
			fuel: scaledUnits(cost.resources?.fuel ?? 0),
		};
		if (
			balances.common < costMetaMatter.common ||
			balances.rare < costMetaMatter.rare ||
			balances.mythic < costMetaMatter.mythic
		) {
			throw new ConvexError("Not enough meta-matter");
		}
		if (
			colony.resources.alloy < costResources.alloy ||
			colony.resources.crystal < costResources.crystal ||
			colony.resources.fuel < costResources.fuel
		) {
			throw new ConvexError("Not enough colony resources to start research");
		}
		if (!balances._id) {
			throw new ConvexError("Research balances row missing");
		}
		await ctx.db.patch(balances._id, {
			common: balances.common - costMetaMatter.common,
			rare: balances.rare - costMetaMatter.rare,
			mythic: balances.mythic - costMetaMatter.mythic,
			updatedAt: now,
		});
		await adjustResearchMetaMatterSpent({
			ctx,
			playerId: player._id,
			amount: costMetaMatter,
			direction: 1,
		});
		await upsertColonyCompanionRows({
			colony: {
				...colony,
				resources: {
					alloy: colony.resources.alloy - costResources.alloy,
					crystal: colony.resources.crystal - costResources.crystal,
					fuel: colony.resources.fuel - costResources.fuel,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});
		const durationSeconds = Math.max(
			1,
			Math.round(cost.seconds * modifierSnapshot.researchDurationMultiplier),
		);
		const startsAt = now;
		const completesAt = now + durationSeconds * 1000;
		const queueItemId = await ctx.db.insert("playerResearchQueueItems", {
			playerId: player._id,
			originColonyId: colony._id,
			researchKey: node.id,
			fromLevel,
			toLevel: fromLevel + 1,
			status: "active",
			queuedAt: now,
			startsAt,
			completesAt,
			resolvedAt: undefined,
			costMetaMatter,
			costResources,
			snapshot: {
				originResearchFacilityLevel: Math.min(
					1,
					Math.max(0, Math.floor(colony.buildings.researchDirectorateLevel)),
				),
				combinedResearchCapacity: researchFacts.combinedResearchCapacity,
				durationSeconds,
			},
			createdAt: now,
			updatedAt: now,
		});
		await reconcileResearchSchedule({
			ctx,
			playerId: player._id,
		});
		return {
			queueItemId,
			researchKey: node.id,
			fromLevel,
			toLevel: fromLevel + 1,
			status: "active" as const,
			queuedAt: now,
			startsAt,
			completesAt,
			costMetaMatter,
			costResources,
		};
	},
});

export const cancel = mutation({
	args: {
		queueItemId: v.id("playerResearchQueueItems"),
	},
	returns: v.object({
		queueItemId: v.id("playerResearchQueueItems"),
	}),
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const row = await ctx.db.get(args.queueItemId);
		if (!row || row.playerId !== playerResult.player._id) {
			throw new ConvexError("Research queue item not found");
		}
		if (row.status !== "active" && row.status !== "queued") {
			throw new ConvexError("Research item is not cancellable");
		}
		const [balances, colony] = await Promise.all([
			ensurePlayerResearchBalances({
				ctx,
				playerId: playerResult.player._id,
			}),
			getOwnedColony({
				ctx,
				colonyId: row.originColonyId,
			}),
		]);
		if (!balances._id) {
			throw new ConvexError("Research balances row missing");
		}
		const now = Date.now();
		await ctx.db.patch(balances._id, {
			common: balances.common + row.costMetaMatter.common,
			rare: balances.rare + row.costMetaMatter.rare,
			mythic: balances.mythic + row.costMetaMatter.mythic,
			updatedAt: now,
		});
		await adjustResearchMetaMatterSpent({
			ctx,
			playerId: playerResult.player._id,
			amount: row.costMetaMatter,
			direction: -1,
		});
		await upsertColonyCompanionRows({
			colony: {
				...colony.colony,
				resources: {
					alloy: colony.colony.resources.alloy + row.costResources.alloy,
					crystal: colony.colony.resources.crystal + row.costResources.crystal,
					fuel: colony.colony.resources.fuel + row.costResources.fuel,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});
		await ctx.db.patch(row._id, {
			status: "cancelled",
			resolvedAt: now,
			updatedAt: now,
		});
		await reconcileResearchSchedule({
			ctx,
			playerId: playerResult.player._id,
		});
		return {
			queueItemId: row._id,
		};
	},
});

export const convertMetaMatterDaily = mutation({
	args: {},
	returns: metaMatterValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const [balances, modifiers, runtimeState] = await Promise.all([
			ensurePlayerResearchBalances({
				ctx,
				playerId: playerResult.player._id,
			}),
			loadPlayerResearchModifierSnapshot({
				ctx,
				playerId: playerResult.player._id,
			}),
			ensurePlayerResearchRuntimeState({
				ctx,
				playerId: playerResult.player._id,
			}),
		]);
		const conversion = modifiers.metaMatterDailyConversion;
		if (!conversion) {
			throw new ConvexError("Meta-matter conversion is not unlocked");
		}
		const day = new Date().toISOString().slice(0, 10);
		if (runtimeState.metaMatterConversionDay === day) {
			throw new ConvexError("Meta-matter conversion already used today");
		}
		if ((balances[conversion.from] ?? 0) < conversion.fromAmount) {
			throw new ConvexError("Not enough meta-matter to convert");
		}
		const now = Date.now();
		const next = cloneMetaMatter(balances);
		next[conversion.from] -= conversion.fromAmount;
		next[conversion.to] += conversion.toAmount;
		if (!balances._id) {
			throw new ConvexError("Research balances row missing");
		}
		await ctx.db.patch(balances._id, {
			...next,
			updatedAt: now,
		});
		await ctx.db.patch(runtimeState._id, {
			metaMatterConversionDay: day,
			updatedAt: now,
		});
		return next;
	},
});

export const resolveScheduledResearch = internalMutation({
	args: {
		playerId: v.id("players"),
		scheduledAt: v.number(),
	},
	returns: v.object({
		playerId: v.id("players"),
		resolvedAt: v.number(),
		stale: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const scheduling = await ensurePlayerResearchScheduling({
			ctx,
			playerId: args.playerId,
		});
		const now = Date.now();
		if (scheduling.resolutionScheduledAt !== args.scheduledAt) {
			return {
				playerId: args.playerId,
				resolvedAt: now,
				stale: true,
			};
		}
		await settleResearchQueue({
			ctx,
			now,
			playerId: args.playerId,
		});
		await ctx.scheduler.runAfter(0, internal.scheduler.rearmPlayerResearchSchedule, {
			playerId: args.playerId,
		});
		return {
			playerId: args.playerId,
			resolvedAt: now,
			stale: false,
		};
	},
});

export function buildAcceptedContractMetaMatterReward(args: {
	difficultyTier: number;
	playerResearchLevels: Partial<ResearchLevelMap>;
	seed: string;
}) {
	const modifiers = buildResearchModifierSnapshot(args.playerResearchLevels);
	return rollMetaMatterBundle({
		difficultyTier: args.difficultyTier,
		modifierSnapshot: {
			globalMetaMatterRewardMultiplier: modifiers.globalMetaMatterRewardMultiplier,
			metaMatterRewardMultipliers: modifiers.metaMatterRewardMultipliers,
		},
		seed: args.seed,
	});
}
