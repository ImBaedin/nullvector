import {
	generateContractSnapshot,
	getConcurrentContractLimit,
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getDifficultyTierForRank,
	getVisibleContractSlotCount,
	generateSciFiName,
	normalizeDefenseCounts,
	normalizeShipCounts,
	type ContractSnapshot,
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
	colonySystemCoords,
	decrementShipsOrThrow,
	durationMsForFleet,
	euclideanDistance,
} from "./fleetV2";
import {
	ensureUniverseHostilitySeeded,
	getPlanetHostility,
} from "./hostility";
import { ensurePlayerProgression } from "./progression";
import { reconcileFleetOperationSchedule } from "./scheduling";
import {
	emptyResourceBucket,
	getOwnedColony,
	loadColonyState,
	resolveCurrentPlayer,
	settleDefenseQueue,
	settleShipyardQueue,
	upsertColonyCompanionRows,
} from "./shared";

const contractStatusValidator = v.union(
	v.literal("available"),
	v.literal("inProgress"),
	v.literal("completed"),
	v.literal("failed"),
	v.literal("expired"),
	v.literal("replaced"),
);

const contractViewValidator = v.object({
	id: v.union(v.id("contracts"), v.string()),
	planetId: v.id("planets"),
	slot: v.number(),
	status: contractStatusValidator,
	missionTypeKey: v.string(),
	requiredRank: v.number(),
	difficultyTier: v.number(),
	expiresAt: v.optional(v.number()),
	acceptedAt: v.optional(v.number()),
	resolvedAt: v.optional(v.number()),
	offerSequence: v.optional(v.number()),
	rewardCredits: v.number(),
	rewardRankXpSuccess: v.number(),
	rewardRankXpFailure: v.number(),
	rewardResources: v.object({
		alloy: v.number(),
		crystal: v.number(),
		fuel: v.number(),
	}),
	controlReduction: v.number(),
	enemyFleet: v.object({
		colonyShip: v.number(),
		cruiser: v.number(),
		bomber: v.number(),
		interceptor: v.number(),
		frigate: v.number(),
		largeCargo: v.number(),
		smallCargo: v.number(),
	}),
	enemyDefenses: v.object({
		missileBattery: v.number(),
		laserTurret: v.number(),
		gaussCannon: v.number(),
		shieldDome: v.number(),
	}),
});

const recommendedContractViewValidator = v.object({
	id: contractViewValidator.fields.id,
	planetId: contractViewValidator.fields.planetId,
	slot: contractViewValidator.fields.slot,
	status: contractViewValidator.fields.status,
	missionTypeKey: contractViewValidator.fields.missionTypeKey,
	requiredRank: contractViewValidator.fields.requiredRank,
	difficultyTier: contractViewValidator.fields.difficultyTier,
	expiresAt: contractViewValidator.fields.expiresAt,
	acceptedAt: contractViewValidator.fields.acceptedAt,
	resolvedAt: contractViewValidator.fields.resolvedAt,
	offerSequence: contractViewValidator.fields.offerSequence,
	rewardCredits: contractViewValidator.fields.rewardCredits,
	rewardRankXpSuccess: contractViewValidator.fields.rewardRankXpSuccess,
	rewardRankXpFailure: contractViewValidator.fields.rewardRankXpFailure,
	rewardResources: contractViewValidator.fields.rewardResources,
	controlReduction: contractViewValidator.fields.controlReduction,
	enemyFleet: contractViewValidator.fields.enemyFleet,
	enemyDefenses: contractViewValidator.fields.enemyDefenses,
	planetDisplayName: v.string(),
	planetAddressLabel: v.string(),
	sectorDisplayName: v.string(),
	hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
	distance: v.number(),
});

type ContractStatus = "available" | "inProgress" | "completed" | "failed" | "expired" | "replaced";
type ContractRow = Doc<"contracts">;

type CandidateDocMap = {
	planets: Doc<"planets">;
	planetHostility: Doc<"planetHostility">;
	sectors: Doc<"sectors">;
	systems: Doc<"systems">;
};

type DerivedOffer = typeof contractViewValidator.type & { offerSequence: number };
const MAX_DISCOVERY_SECTORS = 8;
const MAX_DISCOVERY_PLANETS = 64;
const REBUILD_MIN_HOSTILE_CANDIDATES = 32;
const MAX_RECOMMENDED_PLANETS = 6;
const MAX_RECOMMENDED_CONTRACTS = 6;

function hashString(seed: string) {
	let hash = 2166136261;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function contractAddressLabel(planet: Pick<Doc<"planets">, "galaxyIndex" | "sectorIndex" | "systemIndex" | "planetIndex">) {
	return `G${planet.galaxyIndex}:S${planet.sectorIndex}:SYS${planet.systemIndex}:P${planet.planetIndex}`;
}

function sectorAddressLabel(sector: Pick<Doc<"sectors">, "galaxyIndex" | "sectorIndex">) {
	return `G${sector.galaxyIndex}:S${sector.sectorIndex}`;
}

function systemAddressLabel(system: Pick<Doc<"systems">, "galaxyIndex" | "sectorIndex" | "systemIndex">) {
	return `G${system.galaxyIndex}:S${system.sectorIndex}:SYS${system.systemIndex}`;
}

function displayNameFromStoredOrGenerated(addressLabel: string, storedName?: string) {
	const trimmed = storedName?.trim();
	if (trimmed && trimmed.length > 0) {
		return trimmed;
	}
	return generateSciFiName(addressLabel);
}

async function getDocsByIds<TableName extends keyof CandidateDocMap>(args: {
	ctx: MutationCtx | QueryCtx;
	ids: Id<TableName>[];
}) {
	const docs = await Promise.all(args.ids.map((id) => args.ctx.db.get(id)));
	const map = new Map<Id<TableName>, CandidateDocMap[TableName]>();
	for (const doc of docs) {
		if (doc) {
			map.set(doc._id, doc as CandidateDocMap[TableName]);
		}
	}
	return map;
}

async function getOwnedColonyBase(args: {
	ctx: MutationCtx | QueryCtx;
	colonyId: Id<"colonies">;
}) {
	const playerResult = await resolveCurrentPlayer(args.ctx);
	if (!playerResult?.player) {
		throw new ConvexError("Authentication required");
	}

	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		throw new ConvexError("Colony not found");
	}
	if (colony.playerId !== playerResult.player._id) {
		throw new ConvexError("Colony access denied");
	}

	return {
		colony,
		player: playerResult.player,
	};
}

async function getColonyBaseById(args: {
	ctx: MutationCtx;
	colonyId: Id<"colonies">;
}) {
	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		throw new ConvexError("Colony not found");
	}
	const player = await args.ctx.db.get(colony.playerId);
	if (!player) {
		throw new ConvexError("Player not found");
	}
	return { colony, player };
}

async function getColonyOriginCoords(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx | QueryCtx;
}) {
	const planet = await args.ctx.db.get(args.colony.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found for colony");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for colony");
	}
	return { x: system.x, y: system.y };
}

async function getPlanetSystemCoords(args: {
	ctx: MutationCtx | QueryCtx;
	planetId: Id<"planets">;
}) {
	const planet = await args.ctx.db.get(args.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for planet");
	}
	return { x: system.x, y: system.y };
}

async function getInProgressContractCount(args: {
	ctx: MutationCtx | QueryCtx;
	playerId: Id<"players">;
}) {
	const rows = await args.ctx.db
		.query("contracts")
		.withIndex("by_player_status", (q) =>
			q.eq("playerId", args.playerId).eq("status", "inProgress"),
		)
		.collect();
	return rows.length;
}

async function listRecentResolvedContracts(args: {
	ctx: MutationCtx | QueryCtx;
	playerId: Id<"players">;
	planetId?: Id<"planets">;
	status: "completed" | "failed";
	limit: number;
}): Promise<ContractRow[]> {
	if (args.planetId !== undefined) {
		return args.ctx.db
			.query("contracts")
			.withIndex("by_p_pl_st_res", (q) =>
				q.eq("playerId", args.playerId).eq("planetId", args.planetId!).eq("status", args.status),
			)
			.order("desc")
			.take(args.limit);
	}

	return args.ctx.db
		.query("contracts")
		.withIndex("by_p_st_res", (q) =>
			q.eq("playerId", args.playerId).eq("status", args.status),
		)
		.order("desc")
		.take(args.limit);
}

async function getContractHistorySummaryForPlayer(args: {
	ctx: MutationCtx | QueryCtx;
	playerId: Id<"players">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const activeContractCount = await getInProgressContractCount(args);

	return {
		activeContractCount,
		activeContractLimit: getConcurrentContractLimit(progression.rank),
	};
}

function snapshotToView(contract: {
	_id: Id<"contracts">;
	acceptedAt?: number;
	difficultyTier: number;
	expiresAt?: number;
	missionTypeKey: string;
	offerSequence?: number;
	planetId: Id<"planets">;
	requiredRank: number;
	resolvedAt?: number;
	slot: number;
	snapshot: {
		controlReduction: number;
		enemyDefenses: Partial<ContractSnapshot["enemyDefenses"]>;
		enemyFleet: Partial<ContractSnapshot["enemyFleet"]>;
		rewardCredits: number;
		rewardRankXpFailure: number;
		rewardRankXpSuccess: number;
		rewardResources: ContractSnapshot["rewardResources"];
	};
	status: ContractStatus;
}) {
	const snapshot = {
		...contract.snapshot,
		enemyFleet: normalizeShipCounts(contract.snapshot.enemyFleet),
		enemyDefenses: normalizeDefenseCounts(contract.snapshot.enemyDefenses),
	};
	return {
		id: contract._id,
		planetId: contract.planetId,
		slot: contract.slot,
		status: contract.status,
		missionTypeKey: contract.missionTypeKey,
		requiredRank: contract.requiredRank,
		difficultyTier: contract.difficultyTier,
		expiresAt: contract.expiresAt,
		acceptedAt: contract.acceptedAt,
		resolvedAt: contract.resolvedAt,
		offerSequence: contract.offerSequence,
		rewardCredits: snapshot.rewardCredits,
		rewardRankXpSuccess: snapshot.rewardRankXpSuccess,
		rewardRankXpFailure: snapshot.rewardRankXpFailure,
		rewardResources: snapshot.rewardResources,
		controlReduction: snapshot.controlReduction,
		enemyFleet: snapshot.enemyFleet,
		enemyDefenses: snapshot.enemyDefenses,
	};
}

async function listInProgressContractsForPlanet(args: {
	ctx: MutationCtx | QueryCtx;
	colonyId: Id<"colonies">;
	playerId: Id<"players">;
	planetId: Id<"planets">;
}) {
	const rows = await args.ctx.db
		.query("contracts")
		.withIndex("by_player_planet_status", (q) =>
			q.eq("playerId", args.playerId).eq("planetId", args.planetId).eq("status", "inProgress"),
		)
		.collect();
	return rows.filter((row) => row.originColonyId === undefined || row.originColonyId === args.colonyId);
}

function sequenceForSlot(slotSequences: number[], slot: number) {
	return slotSequences[slot] ?? 1;
}

async function getOrCreateBoardState(args: {
	ctx: MutationCtx;
	colony: Doc<"colonies">;
	now: number;
	planetId: Id<"planets">;
	playerId: Id<"players">;
}) {
	const existing = await args.ctx.db
		.query("contractBoardState")
		.withIndex("by_colony_planet", (q) =>
			q.eq("colonyId", args.colony._id).eq("planetId", args.planetId),
		)
		.unique();
	if (existing) {
		return existing;
	}

	const boardStateId = await args.ctx.db.insert("contractBoardState", {
		universeId: args.colony.universeId,
		playerId: args.playerId,
		colonyId: args.colony._id,
		planetId: args.planetId,
		slotSequences: [],
		version: 1,
		createdAt: args.now,
		updatedAt: args.now,
	});
	const created = await args.ctx.db.get(boardStateId);
	if (!created) {
		throw new ConvexError("Failed to create contract board state");
	}
	return created;
}

function deriveOffer(args: {
	colonyId: Id<"colonies">;
	controlMax: number;
	difficultyTier: number;
	offerSequence: number;
	planetId: Id<"planets">;
	planetSeed: string;
	playerRank: number;
	slot: number;
}) {
	const snapshot = generateContractSnapshot({
		difficultyTier: args.difficultyTier,
		planetControlMax: args.controlMax,
		playerRank: args.playerRank,
		seed: `${args.planetSeed}:${args.colonyId}:${args.slot}:${args.offerSequence}`,
		slot: args.slot,
	});
	return {
		id: `derived:${args.planetId}:${args.slot}:${args.offerSequence}`,
		planetId: args.planetId,
		slot: args.slot,
		status: "available" as const,
		missionTypeKey: snapshot.missionTypeKey,
		requiredRank: snapshot.requiredRank,
		difficultyTier: snapshot.difficultyTier,
		offerSequence: args.offerSequence,
		rewardCredits: snapshot.rewardCredits,
		rewardRankXpSuccess: snapshot.rewardRankXpSuccess,
		rewardRankXpFailure: snapshot.rewardRankXpFailure,
		rewardResources: snapshot.rewardResources,
		controlReduction: snapshot.controlReduction,
		enemyFleet: normalizeShipCounts(snapshot.enemyFleet),
		enemyDefenses: normalizeDefenseCounts(snapshot.enemyDefenses),
		expiresAt: undefined,
		acceptedAt: undefined,
		resolvedAt: undefined,
		snapshot,
	} satisfies DerivedOffer & { snapshot: ContractSnapshot };
}

type ComputedCandidate = {
	colonyId: Id<"colonies">;
	controlCurrent: number;
	controlMax: number;
	distance: number;
	hostileFactionKey: "spacePirates" | "rogueAi";
	planetAddressLabel: string;
	planetDisplayName: string;
	planetHostilityId: Id<"planetHostility">;
	planetId: Id<"planets">;
	planetSeed: string;
	playerId: Id<"players">;
	sectorAddressLabel: string;
	sectorDisplayName: string;
	sectorId: Id<"sectors">;
	sortOrder: number;
	systemDisplayName: string;
	systemId: Id<"systems">;
	systemIndex: number;
	systemX: number;
	systemY: number;
	universeId: Id<"universes">;
	status: "hostile" | "cleared";
};

async function computeContractCandidates(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx | QueryCtx;
	playerId: Id<"players">;
}) {
	const originCoords = await getColonyOriginCoords({
		colony: args.colony,
		ctx: args.ctx,
	});
	const sectorHostilities = await args.ctx.db
		.query("sectorHostility")
		.withIndex("by_universe_status", (q) =>
			q.eq("universeId", args.colony.universeId).eq("status", "hostile"),
		)
		.collect();
	if (sectorHostilities.length === 0) {
		return [] as ComputedCandidate[];
	}

	const sectorById = await getDocsByIds({
		ctx: args.ctx,
		ids: sectorHostilities.map((sector) => sector.sectorId),
	});
	const sectorsToScan: typeof sectorHostilities = [];
	let queuedHostilePlanetCount = 0;

	for (const sectorHostility of [...sectorHostilities].sort((left, right) => {
		const leftSector = sectorById.get(left.sectorId);
		const rightSector = sectorById.get(right.sectorId);
		const leftDistance = leftSector
			? euclideanDistance({
					x1: originCoords.x,
					y1: originCoords.y,
					x2: (leftSector.minX + leftSector.maxX) / 2,
					y2: (leftSector.minY + leftSector.maxY) / 2,
				})
			: Number.POSITIVE_INFINITY;
		const rightDistance = rightSector
			? euclideanDistance({
					x1: originCoords.x,
					y1: originCoords.y,
					x2: (rightSector.minX + rightSector.maxX) / 2,
					y2: (rightSector.minY + rightSector.maxY) / 2,
				})
			: Number.POSITIVE_INFINITY;
		return leftDistance - rightDistance;
	})) {
		sectorsToScan.push(sectorHostility);
		queuedHostilePlanetCount += sectorHostility.hostilePlanetCount - sectorHostility.clearedPlanetCount;
		if (
			sectorsToScan.length >= MAX_DISCOVERY_SECTORS ||
			queuedHostilePlanetCount >= MAX_DISCOVERY_PLANETS
		) {
			break;
		}
	}

	const planetHostilityGroups = await Promise.all(
		sectorsToScan.map((sector) =>
			args.ctx.db
				.query("planetHostility")
				.withIndex("by_sector_status", (q) =>
					q.eq("sectorId", sector.sectorId).eq("status", "hostile"),
				)
				.collect(),
		),
	);
	const hostilePlanets = planetHostilityGroups.flat();
	const planetById = await getDocsByIds({
		ctx: args.ctx,
		ids: hostilePlanets.map((planet) => planet.planetId),
	});
	const systemById = await getDocsByIds({
		ctx: args.ctx,
		ids: Array.from(new Set(Array.from(planetById.values()).map((planet) => planet.systemId))),
	});

	return hostilePlanets
		.map((planetHostility) => {
			const planet = planetById.get(planetHostility.planetId);
			const system = planet ? systemById.get(planet.systemId) : null;
			const sector = sectorById.get(planetHostility.sectorId);
			if (!planet || !system || !sector) {
				return null;
			}

			return {
				colonyId: args.colony._id,
				controlCurrent: planetHostility.controlCurrent,
				controlMax: planetHostility.controlMax,
				distance: euclideanDistance({
					x1: originCoords.x,
					y1: originCoords.y,
					x2: system.x,
					y2: system.y,
				}),
				hostileFactionKey: planetHostility.hostileFactionKey as "spacePirates" | "rogueAi",
				planetAddressLabel: contractAddressLabel(planet),
				planetDisplayName: displayNameFromStoredOrGenerated(contractAddressLabel(planet), planet.name),
				planetHostilityId: planetHostility._id,
				planetId: planet._id,
				planetSeed: planet.seed,
				playerId: args.playerId,
				sectorAddressLabel: sectorAddressLabel(sector),
				sectorDisplayName: displayNameFromStoredOrGenerated(sectorAddressLabel(sector), sector.name),
				sectorId: sector._id,
				sortOrder: 0,
				systemDisplayName: displayNameFromStoredOrGenerated(
					systemAddressLabel(system),
					system.name,
				),
				systemId: system._id,
				systemIndex: system.systemIndex,
				systemX: system.x,
				systemY: system.y,
				universeId: args.colony.universeId,
				status: planetHostility.status as "hostile" | "cleared",
			} satisfies ComputedCandidate;
		})
		.filter((candidate): candidate is ComputedCandidate => candidate !== null)
		.sort((left, right) => left.distance - right.distance)
		.slice(0, MAX_DISCOVERY_PLANETS)
		.map((candidate, index) => ({
			...candidate,
			sortOrder: index,
		}));
}

async function loadCandidateRows(args: {
	ctx: MutationCtx | QueryCtx;
	colony: Doc<"colonies">;
}) {
	return args.ctx.db
		.query("colonyContractCandidates")
		.withIndex("by_colony_sort", (q) => q.eq("colonyId", args.colony._id))
		.collect();
}

async function persistContractCandidates(args: {
	colony: Doc<"colonies">;
	ctx: MutationCtx;
	player: Doc<"players">;
}) {
	const existing = await args.ctx.db
		.query("colonyContractCandidates")
		.withIndex("by_colony_sort", (q) => q.eq("colonyId", args.colony._id))
		.collect();
	for (const row of existing) {
		await args.ctx.db.delete(row._id);
	}

	const candidates = await computeContractCandidates({
		colony: args.colony,
		ctx: args.ctx,
		playerId: args.player._id,
	});
	const now = Date.now();
	const existingState = await args.ctx.db
		.query("colonyContractDiscoveryState")
		.withIndex("by_colony", (q) => q.eq("colonyId", args.colony._id))
		.unique();
	for (const candidate of candidates) {
		await args.ctx.db.insert("colonyContractCandidates", {
			universeId: candidate.universeId,
			playerId: candidate.playerId,
			colonyId: candidate.colonyId,
			planetId: candidate.planetId,
			planetHostilityId: candidate.planetHostilityId,
			hostileFactionKey: candidate.hostileFactionKey,
			controlCurrent: candidate.controlCurrent,
			controlMax: candidate.controlMax,
			status: candidate.status,
			sectorId: candidate.sectorId,
			systemId: candidate.systemId,
			systemIndex: candidate.systemIndex,
			sortOrder: candidate.sortOrder,
			distance: candidate.distance,
			systemX: candidate.systemX,
			systemY: candidate.systemY,
			sectorDisplayName: candidate.sectorDisplayName,
			sectorAddressLabel: candidate.sectorAddressLabel,
			systemDisplayName: candidate.systemDisplayName,
			planetDisplayName: candidate.planetDisplayName,
			planetAddressLabel: candidate.planetAddressLabel,
			planetSeed: candidate.planetSeed,
			createdAt: now,
			updatedAt: now,
		});
	}
	if (existingState) {
		await args.ctx.db.patch(existingState._id, {
			hostileCount: candidates.length,
			version: existingState.version + 1,
			updatedAt: now,
		});
	} else {
		await args.ctx.db.insert("colonyContractDiscoveryState", {
			universeId: args.colony.universeId,
			playerId: args.player._id,
			colonyId: args.colony._id,
			hostileCount: candidates.length,
			version: 1,
			createdAt: now,
			updatedAt: now,
		});
	}
	return candidates.length;
}

type HydratedCandidateRow = (Doc<"colonyContractCandidates"> | ComputedCandidate) & {
	hostileFactionKey: "spacePirates" | "rogueAi";
	controlCurrent: number;
	controlMax: number;
	status: "hostile" | "cleared";
};

async function enrichCandidateRowsWithHostility(args: {
	ctx: MutationCtx | QueryCtx;
	candidateRows: Array<Doc<"colonyContractCandidates"> | ComputedCandidate>;
}): Promise<HydratedCandidateRow[]> {
	const missingRows = args.candidateRows.filter(
		(row) =>
			row.hostileFactionKey === undefined ||
			row.controlCurrent === undefined ||
			row.controlMax === undefined ||
			row.status === undefined,
	);
	if (missingRows.length === 0) {
		return args.candidateRows.map((row) => ({
			...row,
			hostileFactionKey: row.hostileFactionKey as "spacePirates" | "rogueAi",
			controlCurrent: row.controlCurrent as number,
			controlMax: row.controlMax as number,
			status: row.status as "hostile" | "cleared",
		}));
	}

	const fallbackEntries = await Promise.all(
		missingRows.map(async (row) => {
			const hostility = await args.ctx.db.get(row.planetHostilityId);
			return hostility ? ([row.planetHostilityId, hostility] as const) : null;
		}),
	);
	const fallbackById = new Map(
		fallbackEntries.filter(
			(entry): entry is readonly [Id<"planetHostility">, Doc<"planetHostility">] => entry !== null,
		),
	);

	return args.candidateRows.flatMap((row) => {
		const fallback = fallbackById.get(row.planetHostilityId);
		const hostileFactionKey =
			(row.hostileFactionKey as "spacePirates" | "rogueAi" | undefined) ??
			(fallback?.hostileFactionKey as "spacePirates" | "rogueAi" | undefined);
		const controlCurrent = row.controlCurrent ?? fallback?.controlCurrent;
		const controlMax = row.controlMax ?? fallback?.controlMax;
		const status =
			(row.status as "hostile" | "cleared" | undefined) ??
			(fallback?.status as "hostile" | "cleared" | undefined);
		if (
			hostileFactionKey === undefined ||
			controlCurrent === undefined ||
			controlMax === undefined ||
			status === undefined
		) {
			return [];
		}
		return [
			{
				...row,
				hostileFactionKey,
				controlCurrent,
				controlMax,
				status,
			},
		];
	});
}

function pickRecommendedOrdinals(args: {
	count: number;
	limit: number;
	seed: string;
}) {
	if (args.count <= 0 || args.limit <= 0) {
		return [] as number[];
	}
	const targetCount = Math.min(args.count, args.limit);
	const picked: number[] = [];
	const used = new Set<number>();
	let cursor = hashString(args.seed);

	while (picked.length < targetCount && used.size < args.count) {
		const start = cursor % args.count;
		for (let offset = 0; offset < args.count; offset += 1) {
			const ordinal = (start + offset) % args.count;
			if (used.has(ordinal)) {
				continue;
			}
			used.add(ordinal);
			picked.push(ordinal);
			break;
		}
		cursor = hashString(`${args.seed}:${cursor}:${picked.length}`);
	}

	return picked;
}

async function deriveRecommendedContractsByOrdinal(args: {
	ctx: MutationCtx | QueryCtx;
	colony: Doc<"colonies">;
	playerId: Id<"players">;
}) {
	const [progression, discoveryState, inProgressRows] = await Promise.all([
		ensurePlayerProgression({
			ctx: args.ctx,
			playerId: args.playerId,
		}),
		args.ctx.db
			.query("colonyContractDiscoveryState")
			.withIndex("by_colony", (q) => q.eq("colonyId", args.colony._id))
			.unique(),
		args.ctx.db
			.query("contracts")
			.withIndex("by_player_status", (q) =>
				q.eq("playerId", args.playerId).eq("status", "inProgress"),
			)
			.collect(),
	]);
	if (!discoveryState || discoveryState.hostileCount <= 0) {
		return [] as typeof recommendedContractViewValidator.type[];
	}

	const ordinals = pickRecommendedOrdinals({
		count: discoveryState.hostileCount,
		limit: MAX_RECOMMENDED_PLANETS,
		seed: `${args.colony._id}:${args.playerId}:${discoveryState.version}`,
	});
	const candidateRows = (
		await Promise.all(
			ordinals.map((ordinal) =>
				args.ctx.db
					.query("colonyContractCandidates")
					.withIndex("by_colony_sort", (q) =>
						q.eq("colonyId", args.colony._id).eq("sortOrder", ordinal),
					)
					.unique(),
			),
		)
	).filter((row): row is Doc<"colonyContractCandidates"> => row !== null);
	if (candidateRows.length === 0) {
		return [] as typeof recommendedContractViewValidator.type[];
	}

	const [hydratedCandidates, hostilities] = await Promise.all([
		enrichCandidateRowsWithHostility({
			ctx: args.ctx,
			candidateRows,
		}),
		Promise.all(candidateRows.map((row) => args.ctx.db.get(row.planetHostilityId))),
	]);
	const candidateByPlanetId = new Map(hydratedCandidates.map((row) => [row.planetId, row]));
	const liveHostilityByPlanetId = new Map(
		hostilities
			.map((hostility, index) => (hostility ? [candidateRows[index]!.planetId, hostility] : null))
			.filter((entry): entry is [Id<"planets">, Doc<"planetHostility">] => entry !== null),
	);
	const boardStates = await Promise.all(
		hydratedCandidates.map((candidate) =>
			args.ctx.db
				.query("contractBoardState")
				.withIndex("by_colony_planet", (q) =>
					q.eq("colonyId", args.colony._id).eq("planetId", candidate.planetId),
				)
				.unique(),
		),
	);
	const inProgressByPlanet = new Map<Id<"planets">, ContractRow[]>();
	for (const row of inProgressRows) {
		if (row.originColonyId !== undefined && row.originColonyId !== args.colony._id) {
			continue;
		}
		const existing = inProgressByPlanet.get(row.planetId);
		if (existing) {
			existing.push(row);
		} else {
			inProgressByPlanet.set(row.planetId, [row]);
		}
	}

	const difficultyTier = getDifficultyTierForRank(progression.rank);
	const visibleSlots = getVisibleContractSlotCount(progression.rank);
	const contracts: Array<typeof recommendedContractViewValidator.type> = [];
	for (const [index, candidate] of hydratedCandidates.entries()) {
		const liveHostility = liveHostilityByPlanetId.get(candidate.planetId);
		if (!liveHostility || liveHostility.status !== "hostile") {
			continue;
		}
		const boardState = boardStates[index];
		const inProgressBySlot = new Map(
			(inProgressByPlanet.get(candidate.planetId) ?? []).map((row) => [row.slot, row]),
		);
		for (let slot = 0; slot < visibleSlots; slot += 1) {
			if (inProgressBySlot.has(slot)) {
				continue;
			}
			const offer = deriveOffer({
				colonyId: args.colony._id,
				controlMax: liveHostility.controlMax,
				difficultyTier,
				offerSequence: sequenceForSlot(boardState?.slotSequences ?? [], slot),
				planetId: candidate.planetId,
				planetSeed: candidate.planetSeed,
				playerRank: progression.rank,
				slot,
			});
			const { snapshot, ...offerView } = offer;
			contracts.push({
				...offerView,
				expiresAt: undefined,
				planetDisplayName: candidate.planetDisplayName,
				planetAddressLabel: candidate.planetAddressLabel,
				sectorDisplayName: candidate.sectorDisplayName,
				hostileFactionKey: (candidateByPlanetId.get(candidate.planetId) ?? candidate).hostileFactionKey,
				distance: candidate.distance,
			});
		}
	}

	contracts.sort((left, right) => left.distance - right.distance);
	return contracts.slice(0, MAX_RECOMMENDED_CONTRACTS);
}

export async function advanceContractBoardSlot(args: {
	ctx: MutationCtx;
	colonyId: Id<"colonies">;
	now: number;
	planetId: Id<"planets">;
	playerId: Id<"players">;
	slot: number;
}) {
	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		return null;
	}
	const boardState = await getOrCreateBoardState({
		ctx: args.ctx,
		colony,
		now: args.now,
		planetId: args.planetId,
		playerId: args.playerId,
	});
	const slotSequences = [...boardState.slotSequences];
	slotSequences[args.slot] = sequenceForSlot(slotSequences, args.slot) + 1;
	await args.ctx.db.patch(boardState._id, {
		slotSequences,
		version: boardState.version + 1,
		updatedAt: args.now,
	});
	return true;
}

export const rebuildContractDiscoveryForColony = internalMutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		candidateCount: v.number(),
		colonyId: v.id("colonies"),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getColonyBaseById({
			ctx,
			colonyId: args.colonyId,
		});
		await ensureUniverseHostilitySeeded({
			ctx,
			universeId: colony.universeId,
		});
		const candidateCount = await persistContractCandidates({
			colony,
			ctx,
			player,
		});

		return {
			candidateCount,
			colonyId: colony._id,
		};
	},
});

export const rebuildContractDiscovery = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		candidateCount: v.number(),
		colonyId: v.id("colonies"),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColonyBase({
			ctx,
			colonyId: args.colonyId,
		});
		await ensureUniverseHostilitySeeded({
			ctx,
			universeId: colony.universeId,
		});
		const candidateCount = await persistContractCandidates({
			colony,
			ctx,
			player,
		});

		return {
			candidateCount,
			colonyId: colony._id,
		};
	},
});

export const getRecommendedContracts = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		needsRebuild: v.boolean(),
		recommendedContracts: v.array(recommendedContractViewValidator),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColonyBase({
			ctx,
			colonyId: args.colonyId,
		});
		const discoveryState = await ctx.db
			.query("colonyContractDiscoveryState")
			.withIndex("by_colony", (q) => q.eq("colonyId", colony._id))
			.unique();
		if (!discoveryState || discoveryState.hostileCount <= 0) {
			return {
				needsRebuild: true,
				recommendedContracts: [],
			};
		}
		return {
			needsRebuild: false,
			recommendedContracts: await deriveRecommendedContractsByOrdinal({
				ctx,
				colony,
				playerId: player._id,
			}),
		};
	},
});

export const launchContract = mutation({
	args: {
		originColonyId: v.id("colonies"),
		planetId: v.id("planets"),
		slot: v.number(),
		offerSequence: v.number(),
		shipCounts: v.object({
			smallCargo: v.number(),
			largeCargo: v.number(),
			colonyShip: v.number(),
			interceptor: v.number(),
			frigate: v.number(),
			cruiser: v.number(),
			bomber: v.number(),
		}),
	},
	returns: v.object({
		operationId: v.id("fleetOperations"),
		fleetId: v.id("fleets"),
		departAt: v.number(),
		arriveAt: v.number(),
		distance: v.number(),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.originColonyId,
		});
		await ensureUniverseHostilitySeeded({
			ctx,
			universeId: colony.universeId,
		});

		const candidate = await ctx.db
			.query("colonyContractCandidates")
			.withIndex("by_colony_planet", (q) =>
				q.eq("colonyId", colony._id).eq("planetId", args.planetId),
			)
			.unique();
		if (!candidate) {
			throw new ConvexError("Planet is outside this colony's nearby contracts scope");
		}

		const hostility = await ctx.db.get(candidate.planetHostilityId);
		if (!hostility || hostility.status === "cleared") {
			throw new ConvexError("Planet is no longer hostile");
		}

		const progression = await ensurePlayerProgression({
			ctx,
			playerId: player._id,
		});
		const visibleSlots = getVisibleContractSlotCount(progression.rank);
		if (args.slot < 0 || args.slot >= visibleSlots) {
			throw new ConvexError("Contract slot is not available at your rank");
		}

		const activeContractLimit = getConcurrentContractLimit(progression.rank);
		const activeContractCount = await getInProgressContractCount({
			ctx,
			playerId: player._id,
		});
		if (activeContractCount >= activeContractLimit) {
			throw new ConvexError(
				`Contract limit reached (${activeContractCount}/${activeContractLimit} active)`,
			);
		}

		const inProgress = await listInProgressContractsForPlanet({
			ctx,
			colonyId: colony._id,
			playerId: player._id,
			planetId: args.planetId,
		});
		if (inProgress.some((row) => row.slot === args.slot)) {
			throw new ConvexError("Contract slot is already occupied");
		}

		const boardState = await getOrCreateBoardState({
			ctx,
			colony,
			now: Date.now(),
			planetId: args.planetId,
			playerId: player._id,
		});
		const currentSequence = sequenceForSlot(boardState.slotSequences, args.slot);
		if (currentSequence !== args.offerSequence) {
			throw new ConvexError("Contract offer is stale");
		}

		const offer = deriveOffer({
			colonyId: colony._id,
			controlMax: hostility.controlMax,
			difficultyTier: getDifficultyTierForRank(progression.rank),
			offerSequence: currentSequence,
			planetId: args.planetId,
			planetSeed: candidate.planetSeed,
			playerRank: progression.rank,
			slot: args.slot,
		});
		if (progression.rank < offer.requiredRank) {
			throw new ConvexError("Rank is too low for this contract");
		}

		const normalizedShips = normalizeShipCounts(args.shipCounts);
		if (getFleetCargoCapacity(normalizedShips) <= 0) {
			throw new ConvexError("Operation fleet has no ships");
		}

		const now = Date.now();
		await settleShipyardQueue({ colony, ctx, now });
		await settleDefenseQueue({ colony, ctx, now });
		await decrementShipsOrThrow({
			colony,
			ctx,
			now,
			requested: normalizedShips,
		});

		const originCoords = await colonySystemCoords({
			colonyId: colony._id,
			ctx,
		});
		const targetCoords = await getPlanetSystemCoords({
			ctx,
			planetId: args.planetId,
		});
		const distance = euclideanDistance({
			x1: originCoords.x,
			y1: originCoords.y,
			x2: targetCoords.x,
			y2: targetCoords.y,
		});
		const durationMs = durationMsForFleet({
			distance,
			shipCounts: normalizedShips,
		});
		const fuelScaled = Math.round(
			getFleetFuelCostForDistance({ distance, shipCounts: normalizedShips }) * 1_000,
		);
		const latestOrigin = await loadColonyState({
			colony,
			ctx,
		});
		if (latestOrigin.resources.fuel < fuelScaled) {
			throw new ConvexError("Not enough fuel for this operation");
		}
		await upsertColonyCompanionRows({
			colony: {
				...latestOrigin,
				resources: {
					...latestOrigin.resources,
					fuel: latestOrigin.resources.fuel - fuelScaled,
				},
				updatedAt: now,
			},
			ctx,
			now,
		});

		const fleetId = await ctx.db.insert("fleets", {
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			homeColonyId: latestOrigin._id,
			state: "inTransit",
			locationKind: "route",
			locationColonyId: latestOrigin._id,
			locationPlanetId: undefined,
			routeOperationId: undefined,
			shipCounts: normalizedShips,
			cargo: emptyResourceBucket(),
			createdAt: now,
			updatedAt: now,
		});

		const contractId = await ctx.db.insert("contracts", {
			universeId: colony.universeId,
			playerId: player._id,
			sectorId: candidate.sectorId,
			planetId: args.planetId,
			hostileFactionKey: offer.snapshot.hostileFactionKey,
			slot: args.slot,
			status: "inProgress",
			missionTypeKey: offer.snapshot.missionTypeKey,
			difficultyTier: offer.snapshot.difficultyTier,
			requiredRank: offer.snapshot.requiredRank,
			expiresAt: undefined,
			acceptedAt: now,
			resolvedAt: undefined,
			offerSequence: currentSequence,
			originColonyId: latestOrigin._id,
			operationId: undefined,
			snapshot: offer.snapshot,
			createdAt: now,
			updatedAt: now,
		});

		const operationId = await ctx.db.insert("fleetOperations", {
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			fleetId,
			kind: "contract",
			status: "inTransit",
			originColonyId: latestOrigin._id,
			target: {
				kind: "contractNode",
				contractId,
			},
			parentOperationId: undefined,
			shipCounts: normalizedShips,
			cargoRequested: emptyResourceBucket(),
			fuelCharged: fuelScaled,
			distance,
			departAt: now,
			arriveAt: now + durationMs,
			nextEventAt: now + durationMs,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.patch(fleetId, {
			routeOperationId: operationId,
			updatedAt: now,
		});
		await ctx.db.insert("fleetOperationResults", {
			operationId,
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			cargoDeliveredToStorage: emptyResourceBucket(),
			cargoDeliveredToOverflow: emptyResourceBucket(),
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.patch(contractId, {
			operationId,
			updatedAt: now,
		});
		await reconcileFleetOperationSchedule({
			ctx,
			operationId,
		});

		return {
			operationId,
			fleetId,
			departAt: now,
			arriveAt: now + durationMs,
			distance,
		};
	},
});

export const getContractHistory = query({
	args: {
		planetId: v.optional(v.id("planets")),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		contracts: v.array(contractViewValidator),
		activeContractCount: v.number(),
		activeContractLimit: v.number(),
	}),
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}
		const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)));
		const [summary, completedRows, failedRows] = await Promise.all([
			getContractHistorySummaryForPlayer({
				ctx,
				playerId: playerResult.player._id,
			}),
			listRecentResolvedContracts({
				ctx,
				playerId: playerResult.player._id,
				planetId: args.planetId,
				status: "completed",
				limit,
			}),
			listRecentResolvedContracts({
				ctx,
				playerId: playerResult.player._id,
				planetId: args.planetId,
				status: "failed",
				limit,
			}),
		]);

		return {
			contracts: [...completedRows, ...failedRows]
				.sort(
					(left, right) =>
						(right.resolvedAt ?? right._creationTime) - (left.resolvedAt ?? left._creationTime),
				)
				.slice(0, limit)
				.map((row) => snapshotToView(row)),
			activeContractCount: summary.activeContractCount,
			activeContractLimit: summary.activeContractLimit,
		};
	},
});

export const getContractHistorySummary = query({
	args: {},
	returns: v.object({
		activeContractCount: v.number(),
		activeContractLimit: v.number(),
	}),
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}

		return getContractHistorySummaryForPlayer({
			ctx,
			playerId: playerResult.player._id,
		});
	},
});

export async function maybeRebuildContractDiscoveryAfterClear(args: {
	ctx: MutationCtx;
	colonyId: Id<"colonies">;
	now: number;
}) {
	const rows = await args.ctx.db
		.query("colonyContractCandidates")
		.withIndex("by_colony_sort", (q) => q.eq("colonyId", args.colonyId))
		.collect();
	if (rows.length === 0) {
		return true;
	}

	const hostileCount = rows.filter((row) => row.status === "hostile").length;
	if (hostileCount >= REBUILD_MIN_HOSTILE_CANDIDATES) {
		return false;
	}
	const { colony, player } = await getColonyBaseById({
		ctx: args.ctx,
		colonyId: args.colonyId,
	});
	await persistContractCandidates({
		colony,
		ctx: args.ctx,
		player,
	});
	return true;
}
