import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { mutation, query, type MutationCtx, type QueryCtx } from "../../convex/_generated/server";
import {
	MUTABLE_NOTIFICATION_PREFERENCE_KINDS,
	buildNotificationPreferencesView,
	buildNotificationSourceKey,
	buildTransportNotificationAudiencePlayerIds,
	categoryForNotificationKind,
	defaultNotificationPreferenceRecord,
	destinationForNotification,
	isNotificationKindEnabled,
	notificationPreferenceFieldForKind,
	notificationPreferencePatchValidator,
	notificationPreferencesViewValidator,
	notificationViewValidator,
	severityForNotificationKind,
	type ContractResolvedNotification,
	type NotificationCategory,
	type NotificationDestination,
	type NotificationKind,
	type NotificationPayload,
	type NotificationSeverity,
	type NotificationSourceKind,
	type OperationFailedNotification,
	type RaidIncomingNotification,
	type RaidResolvedNotification,
	type TransportDeliveredNotification,
	type TransportIncomingNotification,
	type TransportReceivedNotification,
	type TransportReturnedNotification,
} from "./notificationsModel";
import { getOwnedColony, resolveCurrentPlayer } from "./shared";

const notificationFeedStatusFilterValidator = v.union(
	v.literal("all"),
	v.literal("unread"),
	v.literal("read"),
	v.literal("archived"),
);

const notificationFeedCategoryFilterValidator = v.union(
	v.literal("all"),
	v.literal("combat"),
	v.literal("fleet"),
	v.literal("colony"),
	v.literal("system"),
);

type NotificationRow = Doc<"notifications">;

function toNotificationView(row: NotificationRow) {
	return {
		id: row._id,
		playerId: row.playerId,
		universeId: row.universeId,
		colonyId: row.colonyId,
		category: row.category,
		kind: row.kind,
		severity: row.severity,
		status: row.status,
		sourceKind: row.sourceKind,
		sourceKey: row.sourceKey,
		payload: row.payload,
		destination: row.destination,
		occurredAt: row.occurredAt,
		readAt: row.readAt,
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function resolveNotificationPlayer(args: {
	colonyId?: Id<"colonies">;
	ctx: QueryCtx | MutationCtx;
}) {
	if (args.colonyId) {
		const owned = await getOwnedColony({
			ctx: args.ctx,
			colonyId: args.colonyId,
		});
		return {
			colonyId: owned.colony._id,
			playerId: owned.player._id,
		};
	}

	const playerResult = await resolveCurrentPlayer(args.ctx);
	if (!playerResult?.player) {
		throw new ConvexError("Authentication required");
	}

	return {
		colonyId: undefined,
		playerId: playerResult.player._id,
	};
}

async function getOwnedNotification(args: {
	ctx: QueryCtx | MutationCtx;
	notificationId: Id<"notifications">;
}) {
	const playerResult = await resolveCurrentPlayer(args.ctx);
	if (!playerResult?.player) {
		throw new ConvexError("Authentication required");
	}

	const notification = await args.ctx.db.get(args.notificationId);
	if (!notification || notification.playerId !== playerResult.player._id) {
		throw new ConvexError("Notification not found");
	}

	return notification;
}

async function getNotificationPreferenceRow(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	return args.ctx.db
		.query("playerNotificationPreferences")
		.withIndex("by_player_id", (q) => q.eq("playerId", args.playerId))
		.unique();
}

async function getResolvedNotificationPreferences(args: {
	ctx: QueryCtx | MutationCtx;
	playerId: Id<"players">;
}) {
	const row = await getNotificationPreferenceRow(args);
	return buildNotificationPreferencesView({
		playerId: args.playerId,
		stored: row,
	});
}

async function shouldEmitNotificationForPlayer(args: {
	ctx: MutationCtx;
	kind: NotificationKind;
	playerId: Id<"players">;
}) {
	if (args.kind === "raidIncoming") {
		return true;
	}

	const preferences = await getResolvedNotificationPreferences({
		ctx: args.ctx,
		playerId: args.playerId,
	});
	return isNotificationKindEnabled({
		kind: args.kind,
		preferences,
	});
}

async function insertNotificationIfMissing(args: {
	category: NotificationCategory;
	colonyId?: Id<"colonies">;
	ctx: MutationCtx;
	destination: NotificationDestination;
	kind: NotificationKind;
	occurredAt: number;
	payload: NotificationPayload;
	playerId: Id<"players">;
	severity: NotificationSeverity;
	sourceId: Id<"contracts"> | Id<"fleetOperations"> | Id<"npcRaidOperations">;
	sourceKind: NotificationSourceKind;
	universeId: Id<"universes">;
}) {
	if (
		!(await shouldEmitNotificationForPlayer({
			ctx: args.ctx,
			kind: args.kind,
			playerId: args.playerId,
		}))
	) {
		return null;
	}

	const sourceKey = buildNotificationSourceKey({
		kind: args.kind,
		playerId: args.playerId,
		sourceId: args.sourceId,
	});
	const existing = await args.ctx.db
		.query("notifications")
		.withIndex("by_pl_src", (q) => q.eq("playerId", args.playerId).eq("sourceKey", sourceKey))
		.unique();
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const notificationId = await args.ctx.db.insert("notifications", {
		universeId: args.universeId,
		playerId: args.playerId,
		colonyId: args.colonyId,
		category: args.category,
		kind: args.kind,
		severity: args.severity,
		status: "unread",
		sourceKind: args.sourceKind,
		sourceKey,
		payload: args.payload,
		destination: args.destination,
		occurredAt: args.occurredAt,
		readAt: undefined,
		archivedAt: undefined,
		createdAt: now,
		updatedAt: now,
	});
	const inserted = await args.ctx.db.get(notificationId);
	if (!inserted) {
		throw new ConvexError("Failed to create notification");
	}
	return inserted;
}

export async function emitRaidIncomingNotification(args: {
	arriveAt: number;
	attackerFleet: RaidIncomingNotification["attackerFleet"];
	ctx: MutationCtx;
	difficultyTier: number;
	hostileFactionKey: RaidIncomingNotification["hostileFactionKey"];
	occurredAt: number;
	playerId: Id<"players">;
	raidOperationId: Id<"npcRaidOperations">;
	targetColonyId: Id<"colonies">;
	universeId: Id<"universes">;
}) {
	const payload: RaidIncomingNotification = {
		kind: "raidIncoming",
		raidOperationId: args.raidOperationId,
		targetColonyId: args.targetColonyId,
		hostileFactionKey: args.hostileFactionKey,
		difficultyTier: args.difficultyTier,
		arriveAt: args.arriveAt,
		attackerFleet: args.attackerFleet,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.targetColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.occurredAt,
		payload,
		playerId: args.playerId,
		severity: severityForNotificationKind({ kind: payload.kind }),
		sourceId: args.raidOperationId,
		sourceKind: "npcRaidOperation",
		universeId: args.universeId,
	});
}

export async function emitRaidResolvedNotification(args: {
	ctx: MutationCtx;
	hostileFactionKey: RaidResolvedNotification["hostileFactionKey"];
	playerId: Id<"players">;
	raidOperationId: Id<"npcRaidOperations">;
	resolvedAt: number;
	resourcesLooted: RaidResolvedNotification["resourcesLooted"];
	roundsFought: number;
	salvageGranted: RaidResolvedNotification["salvageGranted"];
	success: boolean;
	targetColonyId: Id<"colonies">;
	universeId: Id<"universes">;
}) {
	const payload: RaidResolvedNotification = {
		kind: "raidResolved",
		raidOperationId: args.raidOperationId,
		targetColonyId: args.targetColonyId,
		hostileFactionKey: args.hostileFactionKey,
		success: args.success,
		roundsFought: args.roundsFought,
		resourcesLooted: args.resourcesLooted,
		salvageGranted: args.salvageGranted,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.targetColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.resolvedAt,
		payload,
		playerId: args.playerId,
		severity: severityForNotificationKind({
			kind: payload.kind,
			success: args.success,
		}),
		sourceId: args.raidOperationId,
		sourceKind: "npcRaidResult",
		universeId: args.universeId,
	});
}

export async function emitContractResolvedNotification(args: {
	controlReductionApplied: number;
	ctx: MutationCtx;
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	planetId: Id<"planets">;
	playerId: Id<"players">;
	resolvedAt: number;
	rewardCargoLoaded: ContractResolvedNotification["rewardCargoLoaded"];
	rewardCargoLostByCapacity: ContractResolvedNotification["rewardCargoLostByCapacity"];
	rewardCreditsGranted: number;
	rewardXpGranted: number;
	roundsFought: number;
	success: boolean;
	contractId: Id<"contracts">;
	universeId: Id<"universes">;
}) {
	const payload: ContractResolvedNotification = {
		kind: "contractResolved",
		contractId: args.contractId,
		operationId: args.operationId,
		planetId: args.planetId,
		originColonyId: args.originColonyId,
		success: args.success,
		roundsFought: args.roundsFought,
		rewardCreditsGranted: args.rewardCreditsGranted,
		rewardXpGranted: args.rewardXpGranted,
		rewardCargoLoaded: args.rewardCargoLoaded,
		rewardCargoLostByCapacity: args.rewardCargoLostByCapacity,
		controlReductionApplied: args.controlReductionApplied,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.originColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.resolvedAt,
		payload,
		playerId: args.playerId,
		severity: severityForNotificationKind({
			kind: payload.kind,
			success: args.success,
		}),
		sourceId: args.operationId,
		sourceKind: "contractResult",
		universeId: args.universeId,
	});
}

export async function emitTransportDeliveredNotifications(args: {
	ctx: MutationCtx;
	deliveredAt: number;
	deliveredToOverflow: TransportDeliveredNotification["deliveredToOverflow"];
	deliveredToStorage: TransportDeliveredNotification["deliveredToStorage"];
	destinationColonyId: Id<"colonies">;
	destinationPlayerId: Id<"players">;
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	ownerPlayerId: Id<"players">;
	returnAt?: number;
	universeId: Id<"universes">;
}) {
	const audiencePlayerIds = buildTransportNotificationAudiencePlayerIds({
		ownerPlayerId: args.ownerPlayerId,
		destinationPlayerId: args.destinationPlayerId,
	});

	for (const playerId of audiencePlayerIds) {
		if (playerId === args.ownerPlayerId) {
			const payload: TransportDeliveredNotification = {
				kind: "transportDelivered",
				operationId: args.operationId,
				originColonyId: args.originColonyId,
				destinationColonyId: args.destinationColonyId,
				deliveredToStorage: args.deliveredToStorage,
				deliveredToOverflow: args.deliveredToOverflow,
				returnAt: args.returnAt,
			};
			await insertNotificationIfMissing({
				category: categoryForNotificationKind(payload.kind),
				colonyId: args.returnAt === undefined ? args.destinationColonyId : args.originColonyId,
				ctx: args.ctx,
				destination: destinationForNotification(payload),
				kind: payload.kind,
				occurredAt: args.deliveredAt,
				payload,
				playerId,
				severity: severityForNotificationKind({ kind: payload.kind }),
				sourceId: args.operationId,
				sourceKind: "fleetOperation",
				universeId: args.universeId,
			});
			continue;
		}

		const payload: TransportReceivedNotification = {
			kind: "transportReceived",
			operationId: args.operationId,
			originColonyId: args.originColonyId,
			destinationColonyId: args.destinationColonyId,
			deliveredToStorage: args.deliveredToStorage,
			deliveredToOverflow: args.deliveredToOverflow,
		};
		await insertNotificationIfMissing({
			category: categoryForNotificationKind(payload.kind),
			colonyId: args.destinationColonyId,
			ctx: args.ctx,
			destination: destinationForNotification(payload),
			kind: payload.kind,
			occurredAt: args.deliveredAt,
			payload,
			playerId,
			severity: severityForNotificationKind({ kind: payload.kind }),
			sourceId: args.operationId,
			sourceKind: "fleetOperation",
			universeId: args.universeId,
		});
	}
}

export async function emitTransportIncomingNotification(args: {
	arriveAt: number;
	cargoRequested: TransportIncomingNotification["cargoRequested"];
	ctx: MutationCtx;
	destinationColonyId: Id<"colonies">;
	destinationPlayerId: Id<"players">;
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	occurredAt: number;
	universeId: Id<"universes">;
}) {
	const payload: TransportIncomingNotification = {
		kind: "transportIncoming",
		operationId: args.operationId,
		originColonyId: args.originColonyId,
		destinationColonyId: args.destinationColonyId,
		cargoRequested: args.cargoRequested,
		arriveAt: args.arriveAt,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.destinationColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.occurredAt,
		payload,
		playerId: args.destinationPlayerId,
		severity: severityForNotificationKind({ kind: payload.kind }),
		sourceId: args.operationId,
		sourceKind: "fleetOperation",
		universeId: args.universeId,
	});
}

export async function emitTransportReturnedNotification(args: {
	ctx: MutationCtx;
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	playerId: Id<"players">;
	returnedAt: number;
	universeId: Id<"universes">;
}) {
	const payload: TransportReturnedNotification = {
		kind: "transportReturned",
		operationId: args.operationId,
		originColonyId: args.originColonyId,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.originColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.returnedAt,
		payload,
		playerId: args.playerId,
		severity: severityForNotificationKind({ kind: payload.kind }),
		sourceId: args.operationId,
		sourceKind: "fleetOperation",
		universeId: args.universeId,
	});
}

export async function emitOperationFailedNotification(args: {
	ctx: MutationCtx;
	operationId: Id<"fleetOperations">;
	operationKind: OperationFailedNotification["operationKind"];
	originColonyId: Id<"colonies">;
	playerId: Id<"players">;
	resultCode?: OperationFailedNotification["resultCode"];
	resultMessage: string;
	resolvedAt: number;
	universeId: Id<"universes">;
}) {
	const payload: OperationFailedNotification = {
		kind: "operationFailed",
		operationId: args.operationId,
		operationKind: args.operationKind,
		originColonyId: args.originColonyId,
		resultCode: args.resultCode,
		resultMessage: args.resultMessage,
	};
	return insertNotificationIfMissing({
		category: categoryForNotificationKind(payload.kind),
		colonyId: args.originColonyId,
		ctx: args.ctx,
		destination: destinationForNotification(payload),
		kind: payload.kind,
		occurredAt: args.resolvedAt,
		payload,
		playerId: args.playerId,
		severity: severityForNotificationKind({ kind: payload.kind }),
		sourceId: args.operationId,
		sourceKind: "fleetOperation",
		universeId: args.universeId,
	});
}

export const getNotificationPreferences = query({
	args: {},
	returns: notificationPreferencesViewValidator,
	handler: async (ctx) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}

		return getResolvedNotificationPreferences({
			ctx,
			playerId: playerResult.player._id,
		});
	},
});

export const updateNotificationPreferences = mutation({
	args: {
		preferences: notificationPreferencePatchValidator,
	},
	returns: notificationPreferencesViewValidator,
	handler: async (ctx, args) => {
		const playerResult = await resolveCurrentPlayer(ctx);
		if (!playerResult?.player) {
			throw new ConvexError("Authentication required");
		}

		const now = Date.now();
		const existing = await getNotificationPreferenceRow({
			ctx,
			playerId: playerResult.player._id,
		});
		const defaults = defaultNotificationPreferenceRecord();
		const patch: {
			createdAt?: number;
			updatedAt: number;
			playerId?: Id<"players">;
			raidResolvedEnabled: boolean;
			contractResolvedEnabled: boolean;
			transportIncomingEnabled?: boolean;
			transportDeliveredEnabled: boolean;
			transportReceivedEnabled: boolean;
			transportReturnedEnabled: boolean;
			operationFailedEnabled: boolean;
		} = {
			updatedAt: now,
			raidResolvedEnabled: existing?.raidResolvedEnabled ?? defaults.raidResolved,
			contractResolvedEnabled: existing?.contractResolvedEnabled ?? defaults.contractResolved,
			transportIncomingEnabled: existing?.transportIncomingEnabled ?? defaults.transportIncoming,
			transportDeliveredEnabled: existing?.transportDeliveredEnabled ?? defaults.transportDelivered,
			transportReceivedEnabled: existing?.transportReceivedEnabled ?? defaults.transportReceived,
			transportReturnedEnabled: existing?.transportReturnedEnabled ?? defaults.transportReturned,
			operationFailedEnabled: existing?.operationFailedEnabled ?? defaults.operationFailed,
		};
		for (const kind of MUTABLE_NOTIFICATION_PREFERENCE_KINDS) {
			const nextValue = args.preferences[kind];
			if (nextValue === undefined) {
				continue;
			}
			const field = notificationPreferenceFieldForKind(kind);
			patch[field] = nextValue;
		}

		if (existing) {
			await ctx.db.patch(existing._id, patch);
		} else {
			await ctx.db.insert("playerNotificationPreferences", {
				playerId: playerResult.player._id,
				createdAt: now,
				...patch,
			});
		}

		const updated = await getNotificationPreferenceRow({
			ctx,
			playerId: playerResult.player._id,
		});
		return buildNotificationPreferencesView({
			playerId: playerResult.player._id,
			stored: updated,
		});
	},
});

export const getNotificationFeed = query({
	args: {
		paginationOpts: paginationOptsValidator,
		status: v.optional(notificationFeedStatusFilterValidator),
		category: v.optional(notificationFeedCategoryFilterValidator),
		colonyId: v.optional(v.id("colonies")),
	},
	returns: v.object({
		page: v.array(notificationViewValidator),
		continueCursor: v.string(),
		isDone: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const resolved = await resolveNotificationPlayer({
			ctx,
			colonyId: args.colonyId,
		});
		const paginationOpts = {
			...args.paginationOpts,
			numItems: Math.max(1, Math.min(100, Math.floor(args.paginationOpts.numItems))),
		};
		const status = args.status ?? "all";
		const category = args.category ?? "all";
		let page;
		if (resolved.colonyId && category !== "all" && status !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_col_cat_st_t", (q) =>
					q
						.eq("playerId", resolved.playerId)
						.eq("colonyId", resolved.colonyId)
						.eq("category", category)
						.eq("status", status),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (resolved.colonyId && category !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_col_cat_t", (q) =>
					q
						.eq("playerId", resolved.playerId)
						.eq("colonyId", resolved.colonyId)
						.eq("category", category),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (resolved.colonyId && status !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_col_st_t", (q) =>
					q
						.eq("playerId", resolved.playerId)
						.eq("colonyId", resolved.colonyId)
						.eq("status", status),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (resolved.colonyId) {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_col_time", (q) =>
					q.eq("playerId", resolved.playerId).eq("colonyId", resolved.colonyId),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (category !== "all" && status !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_cat_st_t", (q) =>
					q.eq("playerId", resolved.playerId).eq("category", category).eq("status", status),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (category !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_cat_time", (q) =>
					q.eq("playerId", resolved.playerId).eq("category", category),
				)
				.order("desc")
				.paginate(paginationOpts);
		} else if (status !== "all") {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_st_time", (q) => q.eq("playerId", resolved.playerId).eq("status", status))
				.order("desc")
				.paginate(paginationOpts);
		} else {
			page = await ctx.db
				.query("notifications")
				.withIndex("by_pl_time", (q) => q.eq("playerId", resolved.playerId))
				.order("desc")
				.paginate(paginationOpts);
		}

		return {
			page: page.page.map(toNotificationView),
			continueCursor: page.continueCursor,
			isDone: page.isDone,
		};
	},
});

export const getNotificationUnreadSummary = query({
	args: {
		colonyId: v.optional(v.id("colonies")),
	},
	returns: v.object({
		total: v.number(),
		combat: v.number(),
		fleet: v.number(),
		colony: v.number(),
		system: v.number(),
	}),
	handler: async (ctx, args) => {
		const resolved = await resolveNotificationPlayer({
			ctx,
			colonyId: args.colonyId,
		});
		const rows = resolved.colonyId
			? await ctx.db
					.query("notifications")
					.withIndex("by_pl_col_st_t", (q) =>
						q
							.eq("playerId", resolved.playerId)
							.eq("colonyId", resolved.colonyId)
							.eq("status", "unread"),
					)
					.collect()
			: await ctx.db
					.query("notifications")
					.withIndex("by_pl_st_time", (q) =>
						q.eq("playerId", resolved.playerId).eq("status", "unread"),
					)
					.collect();

		const summary: Record<NotificationCategory, number> = {
			combat: 0,
			fleet: 0,
			colony: 0,
			system: 0,
		};
		for (const row of rows) {
			summary[row.category] += 1;
		}

		return {
			total: rows.length,
			combat: summary.combat,
			fleet: summary.fleet,
			colony: summary.colony,
			system: summary.system,
		};
	},
});

export const markNotificationRead = mutation({
	args: {
		notificationId: v.id("notifications"),
	},
	returns: v.object({
		notificationId: v.id("notifications"),
		status: v.union(v.literal("read"), v.literal("archived")),
	}),
	handler: async (ctx, args) => {
		const notification = await getOwnedNotification({
			ctx,
			notificationId: args.notificationId,
		});

		if (notification.status === "unread") {
			await ctx.db.patch(notification._id, {
				status: "read",
				readAt: Date.now(),
				updatedAt: Date.now(),
			});
			return {
				notificationId: notification._id,
				status: "read" as const,
			};
		}

		return {
			notificationId: notification._id,
			status: (notification.status === "archived" ? "archived" : "read") as "read" | "archived",
		};
	},
});

export const markAllNotificationsRead = mutation({
	args: {
		category: v.optional(notificationFeedCategoryFilterValidator),
		colonyId: v.optional(v.id("colonies")),
	},
	returns: v.object({
		updatedCount: v.number(),
		readAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const resolved = await resolveNotificationPlayer({
			ctx,
			colonyId: args.colonyId,
		});
		const category = args.category ?? "all";
		const now = Date.now();

		const rows = resolved.colonyId
			? await ctx.db
					.query("notifications")
					.withIndex("by_pl_col_st_t", (q) =>
						q
							.eq("playerId", resolved.playerId)
							.eq("colonyId", resolved.colonyId)
							.eq("status", "unread"),
					)
					.collect()
			: await ctx.db
					.query("notifications")
					.withIndex("by_pl_st_time", (q) =>
						q.eq("playerId", resolved.playerId).eq("status", "unread"),
					)
					.collect();

		const filtered = category === "all" ? rows : rows.filter((row) => row.category === category);
		for (const row of filtered) {
			await ctx.db.patch(row._id, {
				status: "read",
				readAt: now,
				updatedAt: now,
			});
		}

		return {
			updatedCount: filtered.length,
			readAt: now,
		};
	},
});

export const archiveNotification = mutation({
	args: {
		notificationId: v.id("notifications"),
	},
	returns: v.object({
		notificationId: v.id("notifications"),
		status: v.literal("archived"),
	}),
	handler: async (ctx, args) => {
		const notification = await getOwnedNotification({
			ctx,
			notificationId: args.notificationId,
		});
		if (notification.status !== "archived") {
			const now = Date.now();
			await ctx.db.patch(notification._id, {
				status: "archived",
				archivedAt: now,
				readAt: notification.readAt ?? now,
				updatedAt: now,
			});
		}

		return {
			notificationId: notification._id,
			status: "archived" as const,
		};
	},
});
