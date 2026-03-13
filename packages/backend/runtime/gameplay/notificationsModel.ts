import { v } from "convex/values";

import type { Id } from "../../convex/_generated/dataModel";

export const NOTIFICATION_CATEGORIES = ["combat", "fleet", "colony", "system"] as const;
export const NOTIFICATION_KINDS = [
	"raidIncoming",
	"raidResolved",
	"contractResolved",
	"transportIncoming",
	"transportDelivered",
	"transportReceived",
	"transportReturned",
	"operationFailed",
] as const;
export const MUTABLE_NOTIFICATION_PREFERENCE_KINDS = [
	"raidResolved",
	"contractResolved",
	"transportIncoming",
	"transportDelivered",
	"transportReceived",
	"transportReturned",
	"operationFailed",
] as const;
export const NOTIFICATION_PREFERENCE_KINDS = [
	"raidIncoming",
	...MUTABLE_NOTIFICATION_PREFERENCE_KINDS,
] as const;
export const NOTIFICATION_SEVERITIES = ["info", "warning", "danger"] as const;
export const NOTIFICATION_STATUSES = ["unread", "read", "archived"] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type MutableNotificationPreferenceKind =
	(typeof MUTABLE_NOTIFICATION_PREFERENCE_KINDS)[number];
export type NotificationPreferenceKind = (typeof NOTIFICATION_PREFERENCE_KINDS)[number];
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type NotificationSourceKind =
	| "npcRaidOperation"
	| "npcRaidResult"
	| "contractResult"
	| "fleetOperation";
export type NotificationTab =
	| "resources"
	| "facilities"
	| "shipyard"
	| "defenses"
	| "fleet"
	| "contracts";

type ResourceBucket = {
	alloy: number;
	crystal: number;
	fuel: number;
};

type ShipCounts = {
	smallCargo: number;
	largeCargo: number;
	colonyShip: number;
	interceptor?: number;
	frigate?: number;
	cruiser?: number;
	bomber?: number;
};

export type NotificationDestination = {
	kind: "colonyTab";
	colonyId: Id<"colonies">;
	tab: NotificationTab;
};

export type RaidIncomingNotification = {
	kind: "raidIncoming";
	raidOperationId: Id<"npcRaidOperations">;
	targetColonyId: Id<"colonies">;
	hostileFactionKey: "spacePirates" | "rogueAi";
	difficultyTier: number;
	arriveAt: number;
	attackerFleet: ShipCounts;
};

export type RaidResolvedNotification = {
	kind: "raidResolved";
	raidOperationId: Id<"npcRaidOperations">;
	targetColonyId: Id<"colonies">;
	hostileFactionKey: "spacePirates" | "rogueAi";
	success: boolean;
	roundsFought: number;
	resourcesLooted: ResourceBucket;
	salvageGranted: ResourceBucket;
	rankXpDelta: number;
};

export type ContractResolvedNotification = {
	kind: "contractResolved";
	contractId: Id<"contracts">;
	operationId: Id<"fleetOperations">;
	planetId: Id<"planets">;
	originColonyId: Id<"colonies">;
	success: boolean;
	roundsFought: number;
	rewardCreditsGranted: number;
	rewardRankXpGranted: number;
	rewardCargoLoaded: ResourceBucket;
	rewardCargoLostByCapacity: ResourceBucket;
	controlReductionApplied: number;
};

export type TransportDeliveredNotification = {
	kind: "transportDelivered";
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	destinationColonyId: Id<"colonies">;
	deliveredToStorage: ResourceBucket;
	deliveredToOverflow: ResourceBucket;
	returnAt?: number;
};

export type TransportIncomingNotification = {
	kind: "transportIncoming";
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	destinationColonyId: Id<"colonies">;
	cargoRequested: ResourceBucket;
	arriveAt: number;
};

export type TransportReceivedNotification = {
	kind: "transportReceived";
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
	destinationColonyId: Id<"colonies">;
	deliveredToStorage: ResourceBucket;
	deliveredToOverflow: ResourceBucket;
};

export type TransportReturnedNotification = {
	kind: "transportReturned";
	operationId: Id<"fleetOperations">;
	originColonyId: Id<"colonies">;
};

export type OperationFailedNotification = {
	kind: "operationFailed";
	operationId: Id<"fleetOperations">;
	operationKind: "transport" | "colonize" | "contract" | "combat";
	originColonyId: Id<"colonies">;
	resultCode?: "delivered" | "colonized" | "cancelledInFlight" | "notImplemented" | "failed";
	resultMessage: string;
};

export type NotificationPayload =
	| RaidIncomingNotification
	| RaidResolvedNotification
	| ContractResolvedNotification
	| TransportIncomingNotification
	| TransportDeliveredNotification
	| TransportReceivedNotification
	| TransportReturnedNotification
	| OperationFailedNotification;

export type NotificationPreferenceSetting = {
	editable: boolean;
	enabled: boolean;
};

export type NotificationPreferencesView = {
	playerId: Id<"players">;
	settings: Record<NotificationPreferenceKind, NotificationPreferenceSetting>;
	updatedAt?: number;
};

type NotificationPreferenceStorage = Partial<
	Record<`${MutableNotificationPreferenceKind}Enabled`, boolean>
> & {
	updatedAt?: number;
};

const resourceBucketValidator = v.object({
	alloy: v.number(),
	crystal: v.number(),
	fuel: v.number(),
});

const shipCountsValidator = v.object({
	smallCargo: v.number(),
	largeCargo: v.number(),
	colonyShip: v.number(),
	interceptor: v.optional(v.number()),
	frigate: v.optional(v.number()),
	cruiser: v.optional(v.number()),
	bomber: v.optional(v.number()),
});

export const notificationCategoryValidator = v.union(
	v.literal("combat"),
	v.literal("fleet"),
	v.literal("colony"),
	v.literal("system"),
);

export const notificationKindValidator = v.union(
	v.literal("raidIncoming"),
	v.literal("raidResolved"),
	v.literal("contractResolved"),
	v.literal("transportIncoming"),
	v.literal("transportDelivered"),
	v.literal("transportReceived"),
	v.literal("transportReturned"),
	v.literal("operationFailed"),
);

export const notificationSeverityValidator = v.union(
	v.literal("info"),
	v.literal("warning"),
	v.literal("danger"),
);

export const notificationStatusValidator = v.union(
	v.literal("unread"),
	v.literal("read"),
	v.literal("archived"),
);

export const notificationSourceKindValidator = v.union(
	v.literal("npcRaidOperation"),
	v.literal("npcRaidResult"),
	v.literal("contractResult"),
	v.literal("fleetOperation"),
);

export const notificationDestinationValidator = v.object({
	kind: v.literal("colonyTab"),
	colonyId: v.id("colonies"),
	tab: v.union(
		v.literal("resources"),
		v.literal("facilities"),
		v.literal("shipyard"),
		v.literal("defenses"),
		v.literal("fleet"),
		v.literal("contracts"),
	),
});

export const notificationPayloadValidator = v.union(
	v.object({
		kind: v.literal("raidIncoming"),
		raidOperationId: v.id("npcRaidOperations"),
		targetColonyId: v.id("colonies"),
		hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
		difficultyTier: v.number(),
		arriveAt: v.number(),
		attackerFleet: shipCountsValidator,
	}),
	v.object({
		kind: v.literal("raidResolved"),
		raidOperationId: v.id("npcRaidOperations"),
		targetColonyId: v.id("colonies"),
		hostileFactionKey: v.union(v.literal("spacePirates"), v.literal("rogueAi")),
		success: v.boolean(),
		roundsFought: v.number(),
		resourcesLooted: resourceBucketValidator,
		salvageGranted: resourceBucketValidator,
		rankXpDelta: v.number(),
	}),
	v.object({
		kind: v.literal("contractResolved"),
		contractId: v.id("contracts"),
		operationId: v.id("fleetOperations"),
		planetId: v.id("planets"),
		originColonyId: v.id("colonies"),
		success: v.boolean(),
		roundsFought: v.number(),
		rewardCreditsGranted: v.number(),
		rewardRankXpGranted: v.number(),
		rewardCargoLoaded: resourceBucketValidator,
		rewardCargoLostByCapacity: resourceBucketValidator,
		controlReductionApplied: v.number(),
	}),
	v.object({
		kind: v.literal("transportIncoming"),
		operationId: v.id("fleetOperations"),
		originColonyId: v.id("colonies"),
		destinationColonyId: v.id("colonies"),
		cargoRequested: resourceBucketValidator,
		arriveAt: v.number(),
	}),
	v.object({
		kind: v.literal("transportDelivered"),
		operationId: v.id("fleetOperations"),
		originColonyId: v.id("colonies"),
		destinationColonyId: v.id("colonies"),
		deliveredToStorage: resourceBucketValidator,
		deliveredToOverflow: resourceBucketValidator,
		returnAt: v.optional(v.number()),
	}),
	v.object({
		kind: v.literal("transportReceived"),
		operationId: v.id("fleetOperations"),
		originColonyId: v.id("colonies"),
		destinationColonyId: v.id("colonies"),
		deliveredToStorage: resourceBucketValidator,
		deliveredToOverflow: resourceBucketValidator,
	}),
	v.object({
		kind: v.literal("transportReturned"),
		operationId: v.id("fleetOperations"),
		originColonyId: v.id("colonies"),
	}),
	v.object({
		kind: v.literal("operationFailed"),
		operationId: v.id("fleetOperations"),
		operationKind: v.union(
			v.literal("transport"),
			v.literal("colonize"),
			v.literal("contract"),
			v.literal("combat"),
		),
		originColonyId: v.id("colonies"),
		resultCode: v.optional(
			v.union(
				v.literal("delivered"),
				v.literal("colonized"),
				v.literal("cancelledInFlight"),
				v.literal("notImplemented"),
				v.literal("failed"),
			),
		),
		resultMessage: v.string(),
	}),
);

export const mutableNotificationPreferenceKindValidator = v.union(
	v.literal("raidResolved"),
	v.literal("contractResolved"),
	v.literal("transportIncoming"),
	v.literal("transportDelivered"),
	v.literal("transportReceived"),
	v.literal("transportReturned"),
	v.literal("operationFailed"),
);

export const notificationPreferenceSettingValidator = v.object({
	editable: v.boolean(),
	enabled: v.boolean(),
});

export const notificationPreferencePatchValidator = v.object({
	raidResolved: v.optional(v.boolean()),
	contractResolved: v.optional(v.boolean()),
	transportIncoming: v.optional(v.boolean()),
	transportDelivered: v.optional(v.boolean()),
	transportReceived: v.optional(v.boolean()),
	transportReturned: v.optional(v.boolean()),
	operationFailed: v.optional(v.boolean()),
});

export const notificationPreferencesViewValidator = v.object({
	playerId: v.id("players"),
	settings: v.object({
		raidIncoming: notificationPreferenceSettingValidator,
		raidResolved: notificationPreferenceSettingValidator,
		contractResolved: notificationPreferenceSettingValidator,
		transportIncoming: notificationPreferenceSettingValidator,
		transportDelivered: notificationPreferenceSettingValidator,
		transportReceived: notificationPreferenceSettingValidator,
		transportReturned: notificationPreferenceSettingValidator,
		operationFailed: notificationPreferenceSettingValidator,
	}),
	updatedAt: v.optional(v.number()),
});

export const notificationViewValidator = v.object({
	id: v.id("notifications"),
	playerId: v.id("players"),
	universeId: v.id("universes"),
	colonyId: v.optional(v.id("colonies")),
	category: notificationCategoryValidator,
	kind: notificationKindValidator,
	severity: notificationSeverityValidator,
	status: notificationStatusValidator,
	sourceKind: notificationSourceKindValidator,
	sourceKey: v.string(),
	payload: notificationPayloadValidator,
	destination: v.optional(notificationDestinationValidator),
	occurredAt: v.number(),
	readAt: v.optional(v.number()),
	archivedAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
});

export function buildNotificationSourceKey(args: {
	kind: NotificationKind;
	playerId: Id<"players">;
	sourceId: Id<"contracts"> | Id<"fleetOperations"> | Id<"npcRaidOperations">;
}) {
	return `${args.kind}:${args.sourceId}:${args.playerId}`;
}

export function buildTransportNotificationAudiencePlayerIds(args: {
	destinationPlayerId: Id<"players">;
	ownerPlayerId: Id<"players">;
}) {
	return args.destinationPlayerId === args.ownerPlayerId
		? [args.ownerPlayerId]
		: [args.ownerPlayerId, args.destinationPlayerId];
}

export function notificationPreferenceFieldForKind(kind: MutableNotificationPreferenceKind) {
	switch (kind) {
		case "raidResolved":
			return "raidResolvedEnabled";
		case "contractResolved":
			return "contractResolvedEnabled";
		case "transportIncoming":
			return "transportIncomingEnabled";
		case "transportDelivered":
			return "transportDeliveredEnabled";
		case "transportReceived":
			return "transportReceivedEnabled";
		case "transportReturned":
			return "transportReturnedEnabled";
		case "operationFailed":
			return "operationFailedEnabled";
	}
}

export function defaultNotificationPreferenceRecord(): Record<
	MutableNotificationPreferenceKind,
	boolean
> {
	return {
		raidResolved: true,
		contractResolved: true,
		transportIncoming: true,
		transportDelivered: true,
		transportReceived: true,
		transportReturned: true,
		operationFailed: true,
	};
}

export function buildNotificationPreferencesView(args: {
	playerId: Id<"players">;
	stored?: NotificationPreferenceStorage | null;
}): NotificationPreferencesView {
	const defaults = defaultNotificationPreferenceRecord();

	return {
		playerId: args.playerId,
		settings: {
			raidIncoming: {
				editable: false,
				enabled: true,
			},
			raidResolved: {
				editable: true,
				enabled: args.stored?.raidResolvedEnabled ?? defaults.raidResolved,
			},
			contractResolved: {
				editable: true,
				enabled: args.stored?.contractResolvedEnabled ?? defaults.contractResolved,
			},
			transportIncoming: {
				editable: true,
				enabled: args.stored?.transportIncomingEnabled ?? defaults.transportIncoming,
			},
			transportDelivered: {
				editable: true,
				enabled: args.stored?.transportDeliveredEnabled ?? defaults.transportDelivered,
			},
			transportReceived: {
				editable: true,
				enabled: args.stored?.transportReceivedEnabled ?? defaults.transportReceived,
			},
			transportReturned: {
				editable: true,
				enabled: args.stored?.transportReturnedEnabled ?? defaults.transportReturned,
			},
			operationFailed: {
				editable: true,
				enabled: args.stored?.operationFailedEnabled ?? defaults.operationFailed,
			},
		},
		updatedAt: args.stored?.updatedAt,
	};
}

export function isNotificationKindEnabled(args: {
	kind: NotificationKind;
	preferences: NotificationPreferencesView;
}) {
	return args.preferences.settings[args.kind].enabled;
}

export function categoryForNotificationKind(kind: NotificationKind): NotificationCategory {
	switch (kind) {
		case "raidIncoming":
		case "raidResolved":
		case "contractResolved":
			return "combat";
		case "transportIncoming":
		case "transportDelivered":
		case "transportReceived":
		case "transportReturned":
		case "operationFailed":
			return "fleet";
		default:
			return "system";
	}
}

export function severityForNotificationKind(args: {
	kind: NotificationKind;
	success?: boolean;
}): NotificationSeverity {
	switch (args.kind) {
		case "raidIncoming":
			return "danger";
		case "raidResolved":
			return args.success ? "warning" : "danger";
		case "contractResolved":
			return args.success ? "info" : "warning";
		case "operationFailed":
			return "warning";
		default:
			return "info";
	}
}

export function destinationForNotification(payload: NotificationPayload): NotificationDestination {
	switch (payload.kind) {
		case "raidIncoming":
		case "raidResolved":
			return {
				kind: "colonyTab",
				colonyId: payload.targetColonyId,
				tab: "defenses",
			};
		case "contractResolved":
			return {
				kind: "colonyTab",
				colonyId: payload.originColonyId,
				tab: "contracts",
			};
		case "transportIncoming":
			return {
				kind: "colonyTab",
				colonyId: payload.destinationColonyId,
				tab: "fleet",
			};
		case "transportDelivered":
			return {
				kind: "colonyTab",
				colonyId:
					payload.returnAt === undefined ? payload.destinationColonyId : payload.originColonyId,
				tab: "fleet",
			};
		case "transportReceived":
			return {
				kind: "colonyTab",
				colonyId: payload.destinationColonyId,
				tab: "fleet",
			};
		case "transportReturned":
		case "operationFailed":
			return {
				kind: "colonyTab",
				colonyId: payload.originColonyId,
				tab: "fleet",
			};
	}
}

function formatResourceBucket(bucket: ResourceBucket) {
	const parts = [
		bucket.alloy > 0 ? `${bucket.alloy.toLocaleString()} alloy` : null,
		bucket.crystal > 0 ? `${bucket.crystal.toLocaleString()} crystal` : null,
		bucket.fuel > 0 ? `${bucket.fuel.toLocaleString()} fuel` : null,
	].filter((value) => value !== null);

	return parts.length > 0 ? parts.join(", ") : "0 resources";
}
