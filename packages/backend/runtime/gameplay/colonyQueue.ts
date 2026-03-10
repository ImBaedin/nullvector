import { v } from "convex/values";

import { mutation, query } from "../../convex/_generated/server";
import { rescheduleColonyQueueResolution } from "./scheduling";
import {
	buildLaneQueueView,
	emptyLaneQueueView,
	getBuildingLaneCapacity,
	getOwnedColony,
	listOpenColonyQueueItems,
	queueEventsNextAt,
	queuesViewValidator,
	settleColonyAndPersist,
	settleShipyardQueue,
} from "./shared";

export const getColonyQueueLanes = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: queuesViewValidator,
	handler: async (ctx, args) => {
		const { colony } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});
		const now = Date.now();
		const queueRows = await listOpenColonyQueueItems({
			colonyId: colony._id,
			ctx,
		});
		return {
			nextEventAt: queueEventsNextAt(queueRows) ?? undefined,
			lanes: {
				building: buildLaneQueueView({
					lane: "building",
					maxItems: getBuildingLaneCapacity(colony),
					now,
					rows: queueRows,
				}),
				shipyard: buildLaneQueueView({
					lane: "shipyard",
					now,
					rows: queueRows,
				}),
				research: emptyLaneQueueView("research"),
			},
		};
	},
});

export const syncColony = mutation({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: v.object({
		colonyId: v.id("colonies"),
		syncedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const { colony, planet } = await getOwnedColony({
			ctx,
			colonyId: args.colonyId,
		});

		const settledColony = await settleColonyAndPersist({
			ctx,
			colony,
			planet,
			now,
		});
		await settleShipyardQueue({
			colony: settledColony,
			ctx,
			now,
		});
		await rescheduleColonyQueueResolution({
			colonyId: colony._id,
			ctx,
		});

		return {
			colonyId: colony._id,
			syncedAt: now,
		};
	},
});
