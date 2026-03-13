import { describe, expect, it } from "vitest";

import {
	buildNotificationPreferencesView,
	buildNotificationSourceKey,
	buildTransportNotificationAudiencePlayerIds,
	categoryForNotificationKind,
	defaultNotificationPreferenceRecord,
	destinationForNotification,
	isNotificationKindEnabled,
	notificationPreferenceFieldForKind,
	severityForNotificationKind,
} from "../../../../runtime/gameplay/notificationsModel";

describe("notification helpers", () => {
	it("builds stable source keys with kind and recipient", () => {
		expect(
			buildNotificationSourceKey({
				kind: "contractResolved",
				playerId: "player_1" as never,
				sourceId: "fleet_op_1" as never,
			}),
		).toBe("contractResolved:fleet_op_1:player_1");
	});

	it("maps destinations to the expected colony tab", () => {
		expect(
			destinationForNotification({
				kind: "raidResolved",
				raidOperationId: "raid_1" as never,
				targetColonyId: "colony_1" as never,
				hostileFactionKey: "spacePirates",
				success: true,
				roundsFought: 4,
				resourcesLooted: {
					alloy: 0,
					crystal: 0,
					fuel: 0,
				},
				salvageGranted: {
					alloy: 100,
					crystal: 0,
					fuel: 0,
				},
				rankXpDelta: 0,
			}),
		).toEqual({
			kind: "colonyTab",
			colonyId: "colony_1",
			tab: "defenses",
		});

		expect(
			destinationForNotification({
				kind: "transportDelivered",
				operationId: "op_1" as never,
				originColonyId: "origin_1" as never,
				destinationColonyId: "dest_1" as never,
				deliveredToStorage: {
					alloy: 100,
					crystal: 0,
					fuel: 0,
				},
				deliveredToOverflow: {
					alloy: 0,
					crystal: 0,
					fuel: 0,
				},
				returnAt: 10_000,
			}),
		).toEqual({
			kind: "colonyTab",
			colonyId: "origin_1",
			tab: "fleet",
		});
	});

	it("dedupes transport audience players when sender and recipient match", () => {
		expect(
			buildTransportNotificationAudiencePlayerIds({
				ownerPlayerId: "player_1" as never,
				destinationPlayerId: "player_1" as never,
			}),
		).toEqual(["player_1"]);
		expect(
			buildTransportNotificationAudiencePlayerIds({
				ownerPlayerId: "player_1" as never,
				destinationPlayerId: "player_2" as never,
			}),
		).toEqual(["player_1", "player_2"]);
	});

	it("maps category and severity consistently", () => {
		expect(categoryForNotificationKind("raidIncoming")).toBe("combat");
		expect(categoryForNotificationKind("transportReturned")).toBe("fleet");
		expect(severityForNotificationKind({ kind: "raidIncoming" })).toBe("danger");
		expect(
			severityForNotificationKind({
				kind: "contractResolved",
				success: false,
			}),
		).toBe("warning");
	});

	it("builds default notification preferences with raid incoming locked on", () => {
		const preferences = buildNotificationPreferencesView({
			playerId: "player_1" as never,
		});

		expect(preferences.settings.raidIncoming).toEqual({
			editable: false,
			enabled: true,
		});
		expect(preferences.settings.transportReturned).toEqual({
			editable: true,
			enabled: true,
		});
	});

	it("resolves stored notification preferences and kind checks", () => {
		const preferences = buildNotificationPreferencesView({
			playerId: "player_1" as never,
			stored: {
				raidResolvedEnabled: false,
				transportReturnedEnabled: false,
				updatedAt: 123,
			},
		});

		expect(preferences.updatedAt).toBe(123);
		expect(isNotificationKindEnabled({ kind: "raidIncoming", preferences })).toBe(true);
		expect(isNotificationKindEnabled({ kind: "raidResolved", preferences })).toBe(false);
		expect(isNotificationKindEnabled({ kind: "transportReturned", preferences })).toBe(false);
	});

	it("maps mutable preference kinds to storage fields", () => {
		expect(defaultNotificationPreferenceRecord()).toEqual({
			raidResolved: true,
			contractResolved: true,
			transportDelivered: true,
			transportReceived: true,
			transportReturned: true,
			operationFailed: true,
		});
		expect(notificationPreferenceFieldForKind("operationFailed")).toBe("operationFailedEnabled");
	});
});
