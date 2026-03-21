import { normalizeDefenseCounts, normalizeShipCounts } from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { query, type QueryCtx } from "../../convex/_generated/server";
import {
	listOpenColonyQueueItems,
	queueEventsNextAt,
	queueViewItemValidator,
	readColonyDefenseCounts,
	resourceBucketValidator,
	resolveCurrentPlayer,
	storedToWholeUnits,
	toAddressLabel,
	toQueueViewItem,
} from "./shared";

const colonyBuildingsValidator = v.object({
	alloyMineLevel: v.number(),
	alloyStorageLevel: v.number(),
	crystalMineLevel: v.number(),
	crystalStorageLevel: v.number(),
	defenseGridLevel: v.number(),
	fuelRefineryLevel: v.number(),
	fuelStorageLevel: v.number(),
	powerPlantLevel: v.number(),
	roboticsHubLevel: v.number(),
	shipyardLevel: v.number(),
});

const shipCountsValidator = v.object({
	bomber: v.number(),
	colonyShip: v.number(),
	cruiser: v.number(),
	frigate: v.number(),
	interceptor: v.number(),
	largeCargo: v.number(),
	smallCargo: v.number(),
});

const defenseCountsValidator = v.object({
	gaussCannon: v.number(),
	laserTurret: v.number(),
	missileBattery: v.number(),
	shieldDome: v.number(),
});

export const colonyIdentityValidator = v.object({
	addressLabel: v.string(),
	colonyId: v.id("colonies"),
	name: v.string(),
});

export const colonyEconomyValidator = v.object({
	colonyId: v.id("colonies"),
	lastAccruedAt: v.number(),
	overflow: resourceBucketValidator,
	planetMultipliers: v.object({
		alloy: v.number(),
		crystal: v.number(),
		fuel: v.number(),
	}),
	resources: resourceBucketValidator,
	serverNowMs: v.number(),
	storageCaps: resourceBucketValidator,
});

export const colonyInfrastructureValidator = v.object({
	buildings: colonyBuildingsValidator,
	colonyId: v.id("colonies"),
});

export const colonyPolicyValidator = v.object({
	colonyId: v.id("colonies"),
	policies: v.object({
		inboundMissionPolicy: v.optional(
			v.union(v.literal("allowAll"), v.literal("denyAll"), v.literal("alliesOnly")),
		),
	}),
});

export const colonyQueueStateValidator = v.object({
	colonyId: v.id("colonies"),
	openQueues: v.array(queueViewItemValidator),
	schedule: v.object({
		nextEventAt: v.optional(v.number()),
	}),
	serverNowMs: v.number(),
});

export const colonyShipsValidator = v.object({
	colonyId: v.id("colonies"),
	ships: shipCountsValidator,
});

export const colonyDefensesValidator = v.object({
	colonyId: v.id("colonies"),
	defenses: defenseCountsValidator,
});

async function getOwnedColonyBase(args: { ctx: QueryCtx; colonyId: Id<"colonies"> }) {
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

	const planet = await args.ctx.db.get(colony.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found for colony");
	}

	return {
		colony,
		planet,
		player: playerResult.player,
	};
}

async function loadShipCounts(ctx: QueryCtx["db"], colonyId: Id<"colonies">) {
	const rows = await ctx
		.query("colonyShips")
		.withIndex("by_colony", (q) => q.eq("colonyId", colonyId))
		.collect();
	const counts = normalizeShipCounts({});
	for (const row of rows) {
		counts[row.shipKey] = row.count;
	}
	return counts;
}

function normalizeBuildings(
	infrastructure: Doc<"colonyInfrastructure">["buildings"],
): typeof colonyBuildingsValidator.type {
	return {
		...infrastructure,
		defenseGridLevel: infrastructure.defenseGridLevel ?? 0,
		roboticsHubLevel: infrastructure.roboticsHubLevel ?? 0,
	};
}

export const getColonyIdentity = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyIdentityValidator,
	handler: async (ctx, args) => {
		const { colony, planet } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});

		return {
			addressLabel: toAddressLabel(planet),
			colonyId: colony._id,
			name: colony.name,
		};
	},
});

export const getColonyEconomy = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyEconomyValidator,
	handler: async (ctx, args) => {
		const serverNowMs = Date.now();
		const { colony, planet } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});

		const [economy, planetEconomy] = await Promise.all([
			ctx.db
				.query("colonyEconomy")
				.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
				.unique(),
			ctx.db
				.query("planetEconomy")
				.withIndex("by_planet_id", (q) => q.eq("planetId", planet._id))
				.unique(),
		]);

		if (!economy) {
			throw new ConvexError("Colony economy row missing");
		}
		if (!planetEconomy) {
			throw new ConvexError("Planet economy row missing");
		}

		return {
			colonyId: colony._id,
			lastAccruedAt: economy.lastAccruedAt,
			overflow: {
				alloy: storedToWholeUnits(economy.overflow.alloy),
				crystal: storedToWholeUnits(economy.overflow.crystal),
				fuel: storedToWholeUnits(economy.overflow.fuel),
			},
			planetMultipliers: {
				alloy: planetEconomy.alloyMultiplier,
				crystal: planetEconomy.crystalMultiplier,
				fuel: planetEconomy.fuelMultiplier,
			},
			resources: {
				alloy: storedToWholeUnits(economy.resources.alloy),
				crystal: storedToWholeUnits(economy.resources.crystal),
				fuel: storedToWholeUnits(economy.resources.fuel),
			},
			serverNowMs,
			storageCaps: {
				alloy: storedToWholeUnits(economy.storageCaps.alloy),
				crystal: storedToWholeUnits(economy.storageCaps.crystal),
				fuel: storedToWholeUnits(economy.storageCaps.fuel),
			},
		};
	},
});

export const getColonyInfrastructure = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyInfrastructureValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});
		const infrastructure = await ctx.db
			.query("colonyInfrastructure")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
			.unique();
		if (!infrastructure) {
			throw new ConvexError("Colony infrastructure row missing");
		}

		return {
			buildings: normalizeBuildings(infrastructure.buildings),
			colonyId: colony._id,
		};
	},
});

export const getColonyPolicy = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyPolicyValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});
		const policy = await ctx.db
			.query("colonyPolicy")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", colony._id))
			.unique();

		return {
			colonyId: colony._id,
			policies: {
				inboundMissionPolicy: policy?.inboundMissionPolicy,
			},
		};
	},
});

export const getColonyQueueState = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyQueueStateValidator,
	handler: async (ctx, args) => {
		const serverNowMs = Date.now();
		const { colony } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});
		const queueRows = await listOpenColonyQueueItems({
			colonyId: colony._id,
			ctx,
		});

		return {
			colonyId: colony._id,
			openQueues: queueRows.map((row) => toQueueViewItem({ item: row, now: serverNowMs })),
			schedule: {
				nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
			},
			serverNowMs,
		};
	},
});

export const getColonyShips = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyShipsValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});

		return {
			colonyId: colony._id,
			ships: await loadShipCounts(ctx.db, colony._id),
		};
	},
});

export const getColonyDefenses = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyDefensesValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColonyBase({
			colonyId: args.colonyId,
			ctx,
		});

		return {
			colonyId: colony._id,
			defenses: normalizeDefenseCounts(
				await readColonyDefenseCounts({
					colonyId: colony._id,
					ctx,
				}),
			),
		};
	},
});
