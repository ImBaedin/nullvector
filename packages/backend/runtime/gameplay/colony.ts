import { normalizeDefenseCounts, normalizeShipCounts } from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { query, type QueryCtx } from "../../convex/_generated/server";
import {
	getColonyRowOrThrow,
	getPlanetRowOrThrow,
	listOpenColonyQueueItems,
	queueEventsNextAt,
	queueViewItemValidator,
	readColonyDefenseCounts,
	requireOwnedColonyAccess,
	requireOwnedColonyRow,
	resourceBucketValidator,
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
	planetId: v.id("planets"),
});

export const colonyEconomyValidator = v.object({
	colonyId: v.id("colonies"),
	lastAccruedAt: v.number(),
	overflow: resourceBucketValidator,
	resources: resourceBucketValidator,
	serverNowMs: v.number(),
	storageCaps: resourceBucketValidator,
});

export const planetEconomyViewValidator = v.object({
	planetId: v.id("planets"),
	multipliers: v.object({
		alloy: v.number(),
		crystal: v.number(),
		fuel: v.number(),
	}),
	compositionType: v.union(
		v.literal("metallic"),
		v.literal("silicate"),
		v.literal("icy"),
		v.literal("volatileRich"),
	),
	maxBuildingSlots: v.number(),
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
		const colony = await getColonyRowOrThrow({
			colonyId: args.colonyId,
			ctx,
		});
		const planet = await getPlanetRowOrThrow({
			ctx,
			planetId: colony.planetId,
		});

		return {
			addressLabel: toAddressLabel(planet),
			colonyId: colony._id,
			name: colony.name,
			planetId: planet._id,
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
		const { colonyId } = await requireOwnedColonyAccess({
			colonyId: args.colonyId,
			ctx,
		});

		const economy = await ctx.db
			.query("colonyEconomy")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", colonyId))
			.unique();

		if (!economy) {
			throw new ConvexError("Colony economy row missing");
		}

		return {
			colonyId,
			lastAccruedAt: economy.lastAccruedAt,
			overflow: {
				alloy: storedToWholeUnits(economy.overflow.alloy),
				crystal: storedToWholeUnits(economy.overflow.crystal),
				fuel: storedToWholeUnits(economy.overflow.fuel),
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

export const getPlanetEconomy = query({
	args: {
		planetId: v.id("planets"),
	},
	returns: planetEconomyViewValidator,
	handler: async (ctx, args) => {
		const planetEconomy = await ctx.db
			.query("planetEconomy")
			.withIndex("by_planet_id", (q) => q.eq("planetId", args.planetId))
			.unique();
		if (!planetEconomy) {
			throw new ConvexError("Planet economy row missing");
		}

		return {
			planetId: args.planetId,
			multipliers: {
				alloy: planetEconomy.alloyMultiplier,
				crystal: planetEconomy.crystalMultiplier,
				fuel: planetEconomy.fuelMultiplier,
			},
			compositionType: planetEconomy.compositionType,
			maxBuildingSlots: planetEconomy.maxBuildingSlots,
		};
	},
});

export const getColonyInfrastructure = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyInfrastructureValidator,
	handler: async (ctx, args) => {
		await requireOwnedColonyAccess({
			colonyId: args.colonyId,
			ctx,
		});
		const infrastructure = await ctx.db
			.query("colonyInfrastructure")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", args.colonyId))
			.unique();
		if (!infrastructure) {
			throw new ConvexError("Colony infrastructure row missing");
		}

		return {
			buildings: normalizeBuildings(infrastructure.buildings),
			colonyId: args.colonyId,
		};
	},
});

export const getColonyPolicy = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyPolicyValidator,
	handler: async (ctx, args) => {
		await requireOwnedColonyAccess({
			colonyId: args.colonyId,
			ctx,
		});
		const policy = await ctx.db
			.query("colonyPolicy")
			.withIndex("by_colony_id", (q) => q.eq("colonyId", args.colonyId))
			.unique();

		return {
			colonyId: args.colonyId,
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
		const { colony } = await requireOwnedColonyRow({
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
		const { colonyId } = await requireOwnedColonyAccess({
			colonyId: args.colonyId,
			ctx,
		});

		return {
			colonyId,
			ships: await loadShipCounts(ctx.db, colonyId),
		};
	},
});

export const getColonyDefenses = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyDefensesValidator,
	handler: async (ctx, args) => {
		const { colonyId } = await requireOwnedColonyAccess({
			colonyId: args.colonyId,
			ctx,
		});

		return {
			colonyId,
			defenses: normalizeDefenseCounts(
				await readColonyDefenseCounts({
					colonyId,
					ctx,
				}),
			),
		};
	},
});
