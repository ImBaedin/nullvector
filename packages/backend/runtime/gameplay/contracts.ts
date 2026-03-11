import {
	CONTRACT_EXPIRY_MS,
	generateContractSnapshot,
	getConcurrentContractLimit,
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getDifficultyTierForRank,
	getVisibleContractSlotCount,
	generateSciFiName,
	normalizeShipCounts,
	normalizeDefenseCounts,
	type ContractSnapshot,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import {
	colonySystemCoords,
	decrementShipsOrThrow,
	durationMsForFleet,
	euclideanDistance,
} from "./fleetV2";
import {
	ensureUniverseHostilitySeeded,
	getPlanetHostility,
	isPlanetCurrentlyColonizable,
} from "./hostility";
import { ensurePlayerProgression } from "./progression";
import { reconcileFleetOperationSchedule } from "./scheduling";
import {
	emptyResourceBucket,
	getOwnedColony,
	loadColonyState,
	resolveCurrentPlayer,
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
	id: v.id("contracts"),
	planetId: v.id("planets"),
	slot: v.number(),
	status: contractStatusValidator,
	missionTypeKey: v.string(),
	requiredRank: v.number(),
	difficultyTier: v.number(),
	expiresAt: v.optional(v.number()),
	acceptedAt: v.optional(v.number()),
	resolvedAt: v.optional(v.number()),
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

type ContractStatus = "available" | "inProgress" | "completed" | "failed" | "expired" | "replaced";

type ContractRow = Doc<"contracts">;

type PlanetCandidate = {
	distance: number;
	hostileFactionKey: "spacePirates" | "rogueAi";
	planetAddressLabel: string;
	planetDisplayName: string;
	planetId: Id<"planets">;
	sectorDisplayName: string;
};

async function nextContractSequence(args: {
	ctx: MutationCtx;
	playerId: Id<"players">;
	planetId: Id<"planets">;
	slot: number;
}) {
	const rows = await args.ctx.db
		.query("contracts")
		.withIndex("by_player_planet_slot", (q) =>
			q.eq("playerId", args.playerId).eq("planetId", args.planetId).eq("slot", args.slot),
		)
		.collect();
	return rows.length + 1;
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

function contractAddressLabel(planet: Doc<"planets">): string {
	return `G${planet.galaxyIndex}:S${planet.sectorIndex}:SYS${planet.systemIndex}:P${planet.planetIndex}`;
}

function sectorAddressLabel(sector: Pick<Doc<"sectors">, "galaxyIndex" | "sectorIndex">): string {
	return `G${sector.galaxyIndex}:S${sector.sectorIndex}`;
}

function displayNameFromStoredOrGenerated(addressLabel: string, storedName?: string) {
	const trimmed = storedName?.trim();
	if (trimmed && trimmed.length > 0) {
		return trimmed;
	}
	return generateSciFiName(addressLabel);
}

async function getPlanetContractsByStatuses(args: {
	ctx: MutationCtx | QueryCtx;
	planetId: Id<"planets">;
	playerId: Id<"players">;
	statuses: ContractStatus[];
}): Promise<ContractRow[]> {
	const groups = await Promise.all(
		args.statuses.map((status) =>
			args.ctx.db
				.query("contracts")
				.withIndex("by_player_planet_status", (q) =>
					q.eq("playerId", args.playerId).eq("planetId", args.planetId).eq("status", status),
				)
				.collect(),
		),
	);
	return groups.flat();
}

async function getPlanetSystemCoords(args: {
	ctx: MutationCtx | QueryCtx;
	planetId: Id<"planets">;
}): Promise<{ x: number; y: number }> {
	const planet = await args.ctx.db.get(args.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found");
	}
	const system = await args.ctx.db.get(planet.systemId);
	if (!system) {
		throw new ConvexError("System not found for planet");
	}
	return {
		x: system.x,
		y: system.y,
	};
}

async function getDocsByIds<TableName extends keyof DocMap>(args: {
	ctx: MutationCtx | QueryCtx;
	ids: Id<TableName>[];
}): Promise<Map<Id<TableName>, DocMap[TableName]>> {
	const docs = await Promise.all(args.ids.map((id) => args.ctx.db.get(id)));
	const map = new Map<Id<TableName>, DocMap[TableName]>();
	for (const doc of docs) {
		if (doc) {
			map.set(doc._id, doc as DocMap[TableName]);
		}
	}
	return map;
}

type DocMap = {
	planets: Doc<"planets">;
	sectors: Doc<"sectors">;
	systems: Doc<"systems">;
};

async function listRecommendedPlanetCandidates(args: {
	ctx: MutationCtx;
	originCoords: { x: number; y: number };
	universeId: Id<"universes">;
}): Promise<PlanetCandidate[]> {
	const sectorHostilities = await args.ctx.db
		.query("sectorHostility")
		.withIndex("by_universe_status", (q) => q.eq("universeId", args.universeId))
		.collect();
	const hostileSectors = sectorHostilities.filter((sector) => sector.status === "hostile");
	if (hostileSectors.length === 0) {
		return [];
	}

	const sectorById = await getDocsByIds({
		ctx: args.ctx,
		ids: hostileSectors.map((sector) => sector.sectorId),
	});
	const planetHostilityGroups = await Promise.all(
		hostileSectors.map((sector) =>
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
	const systemIds = Array.from(
		new Set(Array.from(planetById.values()).map((planet) => planet.systemId)),
	);
	const systemById = await getDocsByIds({
		ctx: args.ctx,
		ids: systemIds,
	});

	return hostilePlanets
		.map((planetHostility) => {
			const planet = planetById.get(planetHostility.planetId);
			const system = planet ? systemById.get(planet.systemId) : null;
			const sectorHostility = hostileSectors.find(
				(sector) => sector.sectorId === planetHostility.sectorId,
			);
			const sector = sectorById.get(planetHostility.sectorId);
			if (!planet || !system || !sectorHostility || !sector) {
				return null;
			}
			return {
				distance: euclideanDistance({
					x1: args.originCoords.x,
					y1: args.originCoords.y,
					x2: system.x,
					y2: system.y,
				}),
				hostileFactionKey: sectorHostility.hostileFactionKey,
				planetAddressLabel: contractAddressLabel(planet),
				planetDisplayName: displayNameFromStoredOrGenerated(
					contractAddressLabel(planet),
					planet.name,
				),
				planetId: planet._id,
				sectorDisplayName: displayNameFromStoredOrGenerated(
					sectorAddressLabel(sector),
					sector.name,
				),
			} satisfies PlanetCandidate;
		})
		.filter((candidate): candidate is PlanetCandidate => candidate !== null)
		.sort((left, right) => left.distance - right.distance);
}

function snapshotToView(contract: {
	_id: Id<"contracts">;
	acceptedAt?: number;
	difficultyTier: number;
	expiresAt?: number;
	missionTypeKey: string;
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
	status: "available" | "inProgress" | "completed" | "failed" | "expired" | "replaced";
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
		rewardCredits: snapshot.rewardCredits,
		rewardRankXpSuccess: snapshot.rewardRankXpSuccess,
		rewardRankXpFailure: snapshot.rewardRankXpFailure,
		rewardResources: snapshot.rewardResources,
		controlReduction: snapshot.controlReduction,
		enemyFleet: snapshot.enemyFleet,
		enemyDefenses: snapshot.enemyDefenses,
	};
}

export async function reconcilePlanetContracts(args: {
	ctx: MutationCtx;
	now: number;
	planetId: Id<"planets">;
	playerId: Id<"players">;
	universeId: Id<"universes">;
}) {
	const progression = await ensurePlayerProgression({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	const hostility = await getPlanetHostility({
		ctx: args.ctx,
		planetId: args.planetId,
	});
	if (!hostility || hostility.status === "cleared") {
		return [];
	}

	const activeRows = await getPlanetContractsByStatuses({
		ctx: args.ctx,
		planetId: args.planetId,
		playerId: args.playerId,
		statuses: ["available"],
	});
	const lockedRows = await getPlanetContractsByStatuses({
		ctx: args.ctx,
		planetId: args.planetId,
		playerId: args.playerId,
		statuses: ["inProgress"],
	});

	for (const row of activeRows) {
		if (row.expiresAt && row.expiresAt <= args.now) {
			await args.ctx.db.patch(row._id, {
				status: "expired",
				resolvedAt: args.now,
				updatedAt: args.now,
			});
		}
	}

	const refreshedAvailable = await getPlanetContractsByStatuses({
		ctx: args.ctx,
		planetId: args.planetId,
		playerId: args.playerId,
		statuses: ["available"],
	});
	const slotCount = getVisibleContractSlotCount(progression.rank);
	const occupiedSlots = new Set<number>([
		...lockedRows.map((row) => row.slot),
		...refreshedAvailable.map((row) => row.slot),
	]);

	const planet = await args.ctx.db.get(args.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found");
	}

	for (let slot = 0; slot < slotCount; slot += 1) {
		if (occupiedSlots.has(slot)) {
			continue;
		}
		const sequence = await nextContractSequence({
			ctx: args.ctx,
			playerId: args.playerId,
			planetId: args.planetId,
			slot,
		});
		const snapshot = generateContractSnapshot({
			difficultyTier: getDifficultyTierForRank(progression.rank),
			planetControlMax: hostility.controlMax,
			playerRank: progression.rank,
			seed: `${planet.seed}:${args.playerId}:${slot}:${sequence}`,
			slot,
		});
		await args.ctx.db.insert("contracts", {
			universeId: args.universeId,
			playerId: args.playerId,
			sectorId: hostility.sectorId,
			planetId: args.planetId,
			hostileFactionKey: snapshot.hostileFactionKey,
			slot,
			status: "available",
			missionTypeKey: snapshot.missionTypeKey,
			difficultyTier: snapshot.difficultyTier,
			requiredRank: snapshot.requiredRank,
			expiresAt: args.now + CONTRACT_EXPIRY_MS,
			snapshot,
			createdAt: args.now,
			updatedAt: args.now,
		});
	}

	const rows = await args.ctx.db
		.query("contracts")
		.withIndex("by_player_status", (q) => q.eq("playerId", args.playerId))
		.collect();
	return rows
		.filter((row) => row.planetId === args.planetId)
		.filter((row) => row.status === "available" || row.status === "inProgress")
		.sort((left, right) => left.slot - right.slot);
}

export const getPlanetContracts = mutation({
	args: {
		originColonyId: v.id("colonies"),
		planetId: v.id("planets"),
	},
	returns: v.object({
		contracts: v.array(contractViewValidator),
		isCurrentlyColonizable: v.boolean(),
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
		const rows = await reconcilePlanetContracts({
			ctx,
			now: Date.now(),
			planetId: args.planetId,
			playerId: player._id,
			universeId: colony.universeId,
		});

		return {
			contracts: rows.map((row) => snapshotToView(row)),
			isCurrentlyColonizable: await isPlanetCurrentlyColonizable({
				ctx,
				planetId: args.planetId,
			}),
		};
	},
});

export const launchContract = mutation({
	args: {
		originColonyId: v.id("colonies"),
		contractId: v.id("contracts"),
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
		const contractBase = await ctx.db.get(args.contractId);
		if (!contractBase) {
			throw new ConvexError("Contract not found");
		}
		await reconcilePlanetContracts({
			ctx,
			now: Date.now(),
			planetId: contractBase.planetId,
			playerId: player._id,
			universeId: colony.universeId,
		});
		const contract = await ctx.db.get(args.contractId);
		if (!contract || contract.playerId !== player._id) {
			throw new ConvexError("Contract not found");
		}
		const progression = await ensurePlayerProgression({
			ctx,
			playerId: player._id,
		});
		const activeContractLimit = getConcurrentContractLimit(progression.rank);
		const activeContractCount = await getInProgressContractCount({
			ctx,
			playerId: player._id,
		});
		if (progression.rank < contract.requiredRank) {
			throw new ConvexError("Rank is too low for this contract");
		}
		if (activeContractCount >= activeContractLimit) {
			throw new ConvexError(
				`Contract limit reached (${activeContractCount}/${activeContractLimit} active)`,
			);
		}
		if (contract.status !== "available") {
			throw new ConvexError("Contract is not available");
		}
		const normalizedShips = normalizeShipCounts(args.shipCounts);
		if (getFleetCargoCapacity(normalizedShips) <= 0) {
			throw new ConvexError("Operation fleet has no ships");
		}

		const now = Date.now();
		await settleShipyardQueue({
			colony,
			ctx,
			now,
		});
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
			planetId: contract.planetId,
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
		const operationId = await ctx.db.insert("fleetOperations", {
			universeId: latestOrigin.universeId,
			ownerPlayerId: latestOrigin.playerId,
			fleetId,
			kind: "contract",
			status: "inTransit",
			originColonyId: latestOrigin._id,
			target: {
				kind: "contractNode",
				contractId: contract._id,
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
		await ctx.db.patch(contract._id, {
			status: "inProgress",
			acceptedAt: now,
			originColonyId: latestOrigin._id,
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

const MAX_RECOMMENDED_PLANETS = 3;
const MAX_RECOMMENDED_CONTRACTS = 6;

export const getRecommendedContracts = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		contracts: v.array(recommendedContractViewValidator),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		await ensureUniverseHostilitySeeded({
			ctx,
			universeId: colony.universeId,
		});

		const originCoords = await colonySystemCoords({
			colonyId: colony._id,
			ctx,
		});

		const selectedPlanets = (
			await listRecommendedPlanetCandidates({
				ctx,
				originCoords,
				universeId: colony.universeId,
			})
		).slice(0, MAX_RECOMMENDED_PLANETS);

		const now = Date.now();
		const enrichedContracts: Array<typeof recommendedContractViewValidator.type> = [];

		for (const candidate of selectedPlanets) {
			const rows = await reconcilePlanetContracts({
				ctx,
				now,
				planetId: candidate.planetId,
				playerId: player._id,
				universeId: colony.universeId,
			});
			for (const row of rows) {
				if (row.status !== "available") continue;
				enrichedContracts.push({
					...snapshotToView(row),
					planetDisplayName: candidate.planetDisplayName,
					planetAddressLabel: candidate.planetAddressLabel,
					sectorDisplayName: candidate.sectorDisplayName,
					hostileFactionKey: candidate.hostileFactionKey,
					distance: candidate.distance,
				});
			}
		}

		enrichedContracts.sort((a, b) => a.distance - b.distance);

		return {
			contracts: enrichedContracts.slice(0, MAX_RECOMMENDED_CONTRACTS),
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
		const progression = await ensurePlayerProgression({
			ctx,
			playerId: playerResult.player._id,
		});
		const rows = await ctx.db
			.query("contracts")
			.withIndex("by_player_status", (q) => q.eq("playerId", playerResult.player._id))
			.collect();
		const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)));
		const activeContractCount = rows.filter((row) => row.status === "inProgress").length;
		return {
			contracts: rows
				.filter((row) => row.status === "completed" || row.status === "failed")
				.filter((row) => (args.planetId ? row.planetId === args.planetId : true))
				.sort(
					(left, right) =>
						(right.resolvedAt ?? right._creationTime) - (left.resolvedAt ?? left._creationTime),
				)
				.slice(0, limit)
				.map((row) => snapshotToView(row)),
			activeContractCount,
			activeContractLimit: getConcurrentContractLimit(progression.rank),
		};
	},
});
