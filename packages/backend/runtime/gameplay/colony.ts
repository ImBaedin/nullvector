import {
	normalizeDefenseCounts,
	normalizeShipCounts,
	type ColonySnapshot,
} from "@nullvector/game-logic";
import { v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { type QueryCtx, query } from "../../convex/_generated/server";
import {
	getOwnedColony,
	listOpenColonyQueueItems,
	listPlayerColonies,
	listPlayerColonyPlanets,
	queueViewItemValidator,
	readColonyDefenseCounts,
	resourceBucketValidator,
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

export const colonySnapshotValidator = v.object({
	addressLabel: v.string(),
	buildings: colonyBuildingsValidator,
	colonyId: v.id("colonies"),
	defenses: defenseCountsValidator,
	lastAccruedAt: v.number(),
	name: v.string(),
	openQueues: v.array(queueViewItemValidator),
	overflow: resourceBucketValidator,
	planetMultipliers: v.object({
		alloy: v.number(),
		crystal: v.number(),
		fuel: v.number(),
	}),
	policies: v.optional(
		v.object({
			inboundMissionPolicy: v.optional(
				v.union(v.literal("allowAll"), v.literal("denyAll"), v.literal("alliesOnly")),
			),
		}),
	),
	resources: resourceBucketValidator,
	schedule: v.object({
		nextEventAt: v.optional(v.number()),
	}),
	serverNowMs: v.number(),
	ships: shipCountsValidator,
	storageCaps: resourceBucketValidator,
});

const colonyStatusValidator = v.union(
	v.literal("Upgrading"),
	v.literal("Queued"),
	v.literal("Stable"),
);

export const colonySessionSnapshotValidator = v.object({
	activeColonyId: v.id("colonies"),
	colonies: v.array(
		v.object({
			addressLabel: v.string(),
			id: v.id("colonies"),
			name: v.string(),
			status: colonyStatusValidator,
		}),
	),
	title: v.string(),
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

export const getColonySnapshot = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonySnapshotValidator,
	handler: async (ctx, args) => {
		const serverNowMs = Date.now();
		const { colony, planet } = await getOwnedColony({
			colonyId: args.colonyId,
			ctx,
		});
		const [queueRows, shipCounts, defenseCounts] = await Promise.all([
			listOpenColonyQueueItems({
				colonyId: colony._id,
				ctx,
			}),
			loadShipCounts(ctx.db, colony._id),
			readColonyDefenseCounts({
				colonyId: colony._id,
				ctx,
			}),
		]);

		return {
			addressLabel: toAddressLabel(planet),
			buildings: colony.buildings,
			colonyId: colony._id,
			defenses: defenseCounts,
			lastAccruedAt: colony.lastAccruedAt,
			name: colony.name,
			openQueues: queueRows.map((row) => toQueueViewItem({ item: row, now: serverNowMs })),
			overflow: {
				alloy: Math.floor(colony.overflow.alloy / 1_000),
				crystal: Math.floor(colony.overflow.crystal / 1_000),
				fuel: Math.floor(colony.overflow.fuel / 1_000),
			},
			planetMultipliers: {
				alloy: planet.alloyMultiplier,
				crystal: planet.crystalMultiplier,
				fuel: planet.fuelMultiplier,
			},
			policies: {
				inboundMissionPolicy: colony.inboundMissionPolicy,
			},
			resources: {
				alloy: Math.floor(colony.resources.alloy / 1_000),
				crystal: Math.floor(colony.resources.crystal / 1_000),
				fuel: Math.floor(colony.resources.fuel / 1_000),
			},
			schedule: {
				nextEventAt:
					queueRows.length > 0 ? Math.min(...queueRows.map((row) => row.completesAt)) : undefined,
			},
			serverNowMs,
			ships: shipCounts,
			storageCaps: {
				alloy: Math.floor(colony.storageCaps.alloy / 1_000),
				crystal: Math.floor(colony.storageCaps.crystal / 1_000),
				fuel: Math.floor(colony.storageCaps.fuel / 1_000),
			},
		};
	},
});

async function getBuildingQueueStatus(
	ctx: QueryCtx,
	colonyId: Id<"colonies">,
): Promise<"Queued" | "Stable" | "Upgrading"> {
	const queueRows = await listOpenColonyQueueItems({
		colonyId,
		ctx,
	});
	const hasActive = queueRows.some((row) => row.status === "active");
	const hasQueued = queueRows.some((row) => row.status === "queued");
	return hasActive ? "Upgrading" : hasQueued ? "Queued" : "Stable";
}

export const getColonySessionSnapshot = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonySessionSnapshotValidator,
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			colonyId: args.colonyId,
			ctx,
		});
		const playerColonies = await listPlayerColonies({
			ctx,
			playerId: player._id,
		});
		const planetsById = await listPlayerColonyPlanets({
			colonies: playerColonies,
			ctx,
		});
		const colonies = await Promise.all(
			playerColonies.map(async (entry) => {
				const planet = planetsById.get(entry.planetId);
				const status = await getBuildingQueueStatus(ctx, entry._id);
				return {
					addressLabel: planet ? toAddressLabel(planet) : "Unknown",
					id: entry._id,
					name: entry.name,
					status,
				};
			}),
		);
		return {
			activeColonyId: colony._id,
			colonies,
			title: `${colony.name} Resources`,
		};
	},
});
