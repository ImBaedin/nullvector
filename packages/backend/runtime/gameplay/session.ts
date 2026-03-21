import { ConvexError, v } from "convex/values";

import type { Doc } from "../../convex/_generated/dataModel";

import { internal } from "../../convex/_generated/api";
import { mutation, query, type MutationCtx } from "../../convex/_generated/server";
import { authComponent } from "../../convex/auth";
import { DEFAULT_UNIVERSE_SLUG } from "../../convex/lib/worldgen/config";
import { ensureCoreCapacityPipeline } from "../../convex/lib/worldgen/pipeline";
import { ensureUniverseHostilitySeeded, isPlanetCurrentlyColonizable } from "./hostility";
import { ensurePlayerProgression } from "./progression";
import { ensureQuestActivationsForPlayer } from "./quests";
import {
	emptyResourceBucket,
	hashString,
	listPlayerColonies,
	resolveCurrentPlayer,
	resolveDisplayName,
	resolvedAuthUserId,
	resolveUniverse,
	storageCapsFromBuildings,
	usedSlotsFromBuildings,
	sessionStateValidator,
} from "./shared";

const bootstrapResponseValidator = v.object({
	playerId: v.id("players"),
	defaultColonyId: v.id("colonies"),
	isNewPlayer: v.boolean(),
	isNewColony: v.boolean(),
});

async function ensureQuestActivationsBestEffort(args: {
	activeColonyId: Doc<"colonies">["_id"];
	ctx: MutationCtx;
	playerId: Doc<"players">["_id"];
}) {
	try {
		await ensureQuestActivationsForPlayer(args);
	} catch (error) {
		console.error("Session quest activation ensure failed", {
			activeColonyId: args.activeColonyId,
			error,
			playerId: args.playerId,
		});
	}
}

async function ensureSessionForAuthenticatedUser(ctx: MutationCtx) {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser) {
		throw new ConvexError("Authentication required");
	}
	const authUserId = resolvedAuthUserId(authUser);
	if (!authUserId) {
		throw new ConvexError("Authenticated user is missing an id");
	}
	const displayName = resolveDisplayName(authUser);

	const now = Date.now();

	const existingPlayers = await ctx.db
		.query("players")
		.withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
		.collect();

	existingPlayers.sort((left, right) => left._creationTime - right._creationTime);

	let player: Doc<"players"> | null = existingPlayers[0] ?? null;
	let isNewPlayer = false;

	if (!player) {
		const playerId = await ctx.db.insert("players", {
			authUserId,
			displayName,
			createdAt: now,
			lastSeenAt: now,
		});
		const createdPlayer = await ctx.db.get(playerId);
		if (!createdPlayer) {
			throw new ConvexError("Failed to create player profile");
		}
		player = createdPlayer;
		isNewPlayer = true;
	} else {
		await ctx.db.patch(player._id, {
			lastSeenAt: now,
		});
	}

	if (!player) {
		throw new ConvexError("Failed to resolve player profile");
	}
	await ensurePlayerProgression({
		ctx,
		playerId: player._id,
	});

	const existingColonies = await listPlayerColonies({
		ctx,
		playerId: player._id,
	});

	if (existingColonies.length > 0 && existingColonies[0]) {
		await ensureQuestActivationsBestEffort({
			ctx,
			playerId: player._id,
			activeColonyId: existingColonies[0]._id,
		});
		return {
			playerId: player._id,
			defaultColonyId: existingColonies[0]._id,
			isNewPlayer,
			isNewColony: false,
		};
	}

	let universe = await resolveUniverse(ctx);

	if (!universe) {
		await ensureCoreCapacityPipeline(ctx, {
			universeSlug: DEFAULT_UNIVERSE_SLUG,
			dryRun: false,
			overrides: {},
		});
		universe = await resolveUniverse(ctx);
	}

	if (!universe) {
		throw new ConvexError("No active universe available for colony assignment");
	}
	await ensureUniverseHostilitySeeded({
		ctx,
		universeId: universe._id,
	});

	const planets = await ctx.db
		.query("planets")
		.withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
			q.eq("universeId", universe._id),
		)
		.collect();
	const planetEconomyRows = await ctx.db
		.query("planetEconomy")
		.withIndex("by_uni_colon", (q) => q.eq("universeId", universe._id))
		.collect();
	const colonizablePlanetIds = new Set(
		planetEconomyRows.filter((row) => row.isColonizable).map((row) => row.planetId),
	);

	const coloniesInUniverse = await ctx.db
		.query("colonies")
		.withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
		.collect();

	const claimedPlanetIds = new Set(coloniesInUniverse.map((colony) => colony.planetId));
	let unclaimedColonizablePlanets = planets
		.filter((planet) => colonizablePlanetIds.has(planet._id))
		.filter((planet) => !claimedPlanetIds.has(planet._id));
	unclaimedColonizablePlanets = (
		await Promise.all(
			unclaimedColonizablePlanets.map(async (planet) =>
				(await isPlanetCurrentlyColonizable({
					ctx,
					planetId: planet._id,
				}))
					? planet
					: null,
			),
		)
	).filter((planet): planet is (typeof unclaimedColonizablePlanets)[number] => planet !== null);

	if (unclaimedColonizablePlanets.length === 0) {
		await ensureCoreCapacityPipeline(ctx, {
			universeSlug: universe.slug,
			dryRun: false,
			overrides: {
				minUnclaimedColonizablePlanets: 24,
				maxSectorsPerRun: 6,
			},
		});

		const refreshedPlanets = await ctx.db
			.query("planets")
			.withIndex("by_universe_and_galaxy_and_sector_and_system_and_planet", (q) =>
				q.eq("universeId", universe._id),
			)
			.collect();
		const refreshedPlanetEconomyRows = await ctx.db
			.query("planetEconomy")
			.withIndex("by_uni_colon", (q) => q.eq("universeId", universe._id))
			.collect();
		const refreshedColonizablePlanetIds = new Set(
			refreshedPlanetEconomyRows.filter((row) => row.isColonizable).map((row) => row.planetId),
		);

		const refreshedColonies = await ctx.db
			.query("colonies")
			.withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
			.collect();

		const refreshedClaimedPlanetIds = new Set(refreshedColonies.map((colony) => colony.planetId));
		unclaimedColonizablePlanets = refreshedPlanets
			.filter((planet) => refreshedColonizablePlanetIds.has(planet._id))
			.filter((planet) => !refreshedClaimedPlanetIds.has(planet._id));
		unclaimedColonizablePlanets = (
			await Promise.all(
				unclaimedColonizablePlanets.map(async (planet) =>
					(await isPlanetCurrentlyColonizable({
						ctx,
						planetId: planet._id,
					}))
						? planet
						: null,
				),
			)
		).filter((planet): planet is (typeof unclaimedColonizablePlanets)[number] => planet !== null);
	}

	if (unclaimedColonizablePlanets.length === 0) {
		throw new ConvexError("No colonizable planets are currently available");
	}

	unclaimedColonizablePlanets.sort((left, right) => {
		if (left.galaxyIndex !== right.galaxyIndex) {
			return left.galaxyIndex - right.galaxyIndex;
		}
		if (left.sectorIndex !== right.sectorIndex) {
			return left.sectorIndex - right.sectorIndex;
		}
		if (left.systemIndex !== right.systemIndex) {
			return left.systemIndex - right.systemIndex;
		}
		return left.planetIndex - right.planetIndex;
	});

	const selectionSeed = `${authUserId}:${player._id}:${now}`;
	const selectedIndex = hashString(selectionSeed) % unclaimedColonizablePlanets.length;
	const selectedPlanet = unclaimedColonizablePlanets[selectedIndex];

	const starterBuildings = {
		alloyMineLevel: 1,
		crystalMineLevel: 1,
		fuelRefineryLevel: 1,
		powerPlantLevel: 1,
		alloyStorageLevel: 1,
		crystalStorageLevel: 1,
		fuelStorageLevel: 1,
		roboticsHubLevel: 0,
		shipyardLevel: 0,
		defenseGridLevel: 0,
	} satisfies Doc<"colonyInfrastructure">["buildings"];

	const storageCaps = storageCapsFromBuildings(starterBuildings);
	const resources = emptyResourceBucket();

	if (!selectedPlanet) {
		throw new ConvexError("No colonizable planet selected");
	}

	const colonyId = await ctx.db.insert("colonies", {
		universeId: universe._id,
		playerId: player._id,
		planetId: selectedPlanet._id,
		name: `Colony ${selectedPlanet.galaxyIndex + 1}-${selectedPlanet.sectorIndex + 1}-${selectedPlanet.systemIndex + 1}`,
		createdAt: now,
		updatedAt: now,
	});
	await ctx.db.insert("colonyEconomy", {
		colonyId,
		resources,
		overflow: emptyResourceBucket(),
		storageCaps,
		lastAccruedAt: now,
		createdAt: now,
		updatedAt: now,
	});
	await ctx.db.insert("colonyInfrastructure", {
		colonyId,
		buildings: starterBuildings,
		usedSlots: usedSlotsFromBuildings(starterBuildings),
		createdAt: now,
		updatedAt: now,
	});
	await ctx.db.insert("colonyPolicy", {
		colonyId,
		inboundMissionPolicy: "allowAll",
		createdAt: now,
		updatedAt: now,
	});
	await ctx.scheduler.runAfter(0, internal.raids.reconcileNpcRaidSchedule, {
		colonyId,
	});
	await ctx.scheduler.runAfter(0, internal.contracts.rebuildContractDiscoveryForColony, {
		colonyId,
	});
	await ensureQuestActivationsBestEffort({
		ctx,
		playerId: player._id,
		activeColonyId: colonyId,
	});
	return {
		playerId: player._id,
		defaultColonyId: colonyId,
		isNewPlayer,
		isNewColony: true,
	};
}

export const getSessionState = query({
	args: {},
	returns: sessionStateValidator(),
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.authUser) {
			return {
				isAuthenticated: false,
				colonyIds: [],
			};
		}

		if (!playerResult.player) {
			return {
				isAuthenticated: true,
				colonyIds: [],
			};
		}

		const colonies = await listPlayerColonies({
			ctx,
			playerId: playerResult.player._id,
		});

		return {
			isAuthenticated: true,
			playerId: playerResult.player._id,
			defaultColonyId: colonies[0]?._id,
			colonyIds: colonies.map((colony) => colony._id),
		};
	},
});

export const ensureSession = mutation({
	args: {},
	returns: bootstrapResponseValidator,
	handler: async (ctx) => {
		return await ensureSessionForAuthenticatedUser(ctx);
	},
});

export const bootstrapSession = mutation({
	args: {},
	returns: bootstrapResponseValidator,
	handler: async (ctx) => {
		return await ensureSessionForAuthenticatedUser(ctx);
	},
});
