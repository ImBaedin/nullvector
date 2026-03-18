import { describe, expect, it } from "vitest";

import {
	deriveOverviewStatus,
	deriveShieldLabel,
} from "../../../../runtime/gameplay/colonyOverview";

describe("colony overview helpers", () => {
	it("marks colonies under attack when a raid is active", () => {
		expect(
			deriveOverviewStatus({
				activeRaid: {
					_id: "raid_1",
				} as never,
				hasOpenQueue: true,
				hostileInboundCount: 0,
				inboundFriendlyCount: 2,
				outboundCount: 1,
			}),
		).toBe("under attack");
	});

	it("marks colonies high traffic when fleet activity is heavy", () => {
		expect(
			deriveOverviewStatus({
				activeRaid: null,
				hasOpenQueue: false,
				hostileInboundCount: 0,
				inboundFriendlyCount: 2,
				outboundCount: 2,
			}),
		).toBe("high traffic");
	});

	it("marks colonies upgrading when queues are open without combat traffic", () => {
		expect(
			deriveOverviewStatus({
				activeRaid: null,
				hasOpenQueue: true,
				hostileInboundCount: 0,
				inboundFriendlyCount: 0,
				outboundCount: 0,
			}),
		).toBe("upgrading");
	});

	it("falls back to calm when nothing is happening", () => {
		expect(
			deriveOverviewStatus({
				activeRaid: null,
				hasOpenQueue: false,
				hostileInboundCount: 0,
				inboundFriendlyCount: 0,
				outboundCount: 0,
			}),
		).toBe("calm");
	});

	it("derives damaged shields while a raid is active", () => {
		expect(
			deriveShieldLabel({
				activeRaid: {
					_id: "raid_1",
				} as never,
				lastRaidResult: null,
			}),
		).toBe("damaged");
	});

	it("derives recovering shields after a successful defense", () => {
		expect(
			deriveShieldLabel({
				activeRaid: null,
				lastRaidResult: {
					success: false,
				} as never,
			}),
		).toBe("recovering");
	});

	it("keeps shields damaged after a breached defense", () => {
		expect(
			deriveShieldLabel({
				activeRaid: null,
				lastRaidResult: {
					success: true,
				} as never,
			}),
		).toBe("damaged");
	});

	it("derives stable shields when no raid pressure exists", () => {
		expect(
			deriveShieldLabel({
				activeRaid: null,
				lastRaidResult: null,
			}),
		).toBe("stable");
	});
});
