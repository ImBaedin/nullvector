import { ConvexError, v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

import { mutation, query } from "../../convex/_generated/server";
import {
	buildHudResources,
	colonyCoordinatesValidator,
	colonyStatusValidator,
	getOwnedColony,
	listOpenColonyQueueItems,
	listPlayerColonies,
	listPlayerColonyPlanets,
	queueEventsNextAt,
	resourceHudDatumValidator,
	sessionColonyValidator,
	toAddressLabel,
} from "./shared";

export function mapColonyQueueStatuses(args: {
	activeRows: Array<{ colonyId: Id<"colonies"> }>;
	colonyIds: Array<Id<"colonies">>;
	queuedRows: Array<{ colonyId: Id<"colonies"> }>;
}) {
	const statusByColonyId = new Map<Id<"colonies">, "Upgrading" | "Queued" | "Stable">(
		args.colonyIds.map((colonyId) => [colonyId, "Stable"]),
	);

	for (const row of args.queuedRows) {
		if (!statusByColonyId.has(row.colonyId)) {
			continue;
		}
		statusByColonyId.set(row.colonyId, "Queued");
	}
	for (const row of args.activeRows) {
		if (!statusByColonyId.has(row.colonyId)) {
			continue;
		}
		statusByColonyId.set(row.colonyId, "Upgrading");
	}

	return args.colonyIds.map((colonyId) => ({
		colonyId,
		status: statusByColonyId.get(colonyId) ?? "Stable",
	}));
}

export const getColonyNav = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		activeColonyId: v.id("colonies"),
		title: v.string(),
		colonies: v.array(sessionColonyValidator),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const playerColonies = await listPlayerColonies({
			ctx,
			playerId: player._id,
		});
		const planetsById = await listPlayerColonyPlanets({
			colonies: playerColonies,
			ctx,
		});

		return {
			activeColonyId: colony._id,
			title: `${colony.name} Resources`,
			colonies: playerColonies.map((entry) => {
				const colonyPlanet = planetsById.get(entry.planetId);
				return {
					id: entry._id,
					name: entry.name,
					addressLabel: colonyPlanet ? toAddressLabel(colonyPlanet) : "Unknown",
				};
			}),
		};
	},
});

export const getColonyResourceStrip = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		resources: v.array(resourceHudDatumValidator),
	}),
	handler: async (ctx, args) => {
		const { colony, planet } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		return {
			resources: buildHudResources({ colony, planet }),
		};
	},
});

export const getActiveColonyNextEvent = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		activeColonyId: v.id("colonies"),
		nextEventAt: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const colonyQueueRows = await listOpenColonyQueueItems({
			colonyId: colony._id,
			ctx,
		});

		return {
			activeColonyId: colony._id,
			nextEventAt: queueEventsNextAt(colonyQueueRows) ?? undefined,
		};
	},
});

export const getAllColonyQueueStatuses = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		activeColonyId: v.id("colonies"),
		statuses: v.array(colonyStatusValidator),
	}),
	handler: async (ctx, args) => {
		const { colony, player } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const playerColonies = await listPlayerColonies({
			ctx,
			playerId: player._id,
		});

		const [activeBuildingRows, queuedBuildingRows] = await Promise.all([
			ctx.db
				.query("colonyQueueItems")
				.withIndex("by_pl_lane_st_time", (q) =>
					q.eq("playerId", player._id).eq("lane", "building").eq("status", "active"),
				)
				.collect(),
			ctx.db
				.query("colonyQueueItems")
				.withIndex("by_pl_lane_st_time", (q) =>
					q.eq("playerId", player._id).eq("lane", "building").eq("status", "queued"),
				)
				.collect(),
		]);

		const colonyIds = playerColonies.map((entry) => entry._id);

		return {
			activeColonyId: colony._id,
			statuses: mapColonyQueueStatuses({
				colonyIds,
				activeRows: activeBuildingRows,
				queuedRows: queuedBuildingRows,
			}),
		};
	},
});

export const getColonyCoordinates = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyCoordinatesValidator,
	handler: async (ctx, args) => {
		const { colony, planet } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const system = await ctx.db.get(planet.systemId);
		if (!system) {
			throw new ConvexError("System not found for colony");
		}

		const universe = await ctx.db.get(colony.universeId);
		if (!universe) {
			throw new ConvexError("Universe not found for colony");
		}

		const nowSeconds = (Date.now() - universe.orbitEpochMs) / 1_000;
		const phase = planet.orbitPhaseRad + planet.orbitAngularVelocityRadPerSec * nowSeconds;

		return {
			galaxyId: system.galaxyId,
			sectorId: system.sectorId,
			systemId: system._id,
			planetId: planet._id,
			focusX: system.x + Math.cos(phase) * planet.orbitRadius,
			focusY: system.y + Math.sin(phase) * planet.orbitRadius,
			addressLabel: toAddressLabel(planet),
		};
	},
});

export const renameColony = mutation({
	args: {
		colonyId: v.id("colonies"),
		name: v.string(),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		name: v.string(),
	}),
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const trimmedName = args.name.trim().replace(/\s+/g, " ");
		if (trimmedName.length < 3) {
			throw new ConvexError("Colony name must be at least 3 characters");
		}
		if (trimmedName.length > 40) {
			throw new ConvexError("Colony name must be 40 characters or fewer");
		}

		if (trimmedName === colony.name) {
			return {
				colonyId: colony._id,
				name: colony.name,
			};
		}

		await ctx.db.patch(colony._id, {
			name: trimmedName,
		});

		return {
			colonyId: colony._id,
			name: trimmedName,
		};
	},
});
