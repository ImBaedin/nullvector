import { describe, expect, it } from "vitest";

import {
	buildShipyardReschedulePatches,
	computeScaledRefundForRemaining,
} from "../../../../runtime/gameplay/shipyard";

describe("shipyard cancellation helpers", () => {
	it("refunds only unbuilt quantity from scaled snapshot cost", () => {
		const result = computeScaledRefundForRemaining({
			completedQuantity: 3,
			quantity: 10,
			totalScaledCost: {
				alloy: 20_000,
				crystal: 10_000,
				fuel: 0,
			},
		});

		expect(result.remainingQuantity).toBe(7);
		expect(result.refundedScaled).toEqual({
			alloy: 14_000,
			crystal: 7_000,
			fuel: 0,
		});
	});

	it("keeps existing active start time and shifts downstream queued items", () => {
		const patches = buildShipyardReschedulePatches({
			now: 25_000,
			rows: [
				{
					queueItemId: "active-a",
					status: "active",
					startsAt: 1_000,
					payload: {
						quantity: 2,
						perUnitDurationSeconds: 10,
					},
				},
				{
					queueItemId: "queued-c",
					status: "queued",
					startsAt: 51_000,
					payload: {
						quantity: 2,
						perUnitDurationSeconds: 5,
					},
				},
			],
		});

		expect(patches).toEqual([
			{
				queueItemId: "active-a",
				status: "active",
				startsAt: 1_000,
				completesAt: 21_000,
			},
			{
				queueItemId: "queued-c",
				status: "queued",
				startsAt: 21_000,
				completesAt: 31_000,
			},
		]);
	});

	it("promotes first queued item to active when active is removed", () => {
		const patches = buildShipyardReschedulePatches({
			now: 25_000,
			rows: [
				{
					queueItemId: "queued-b",
					status: "queued",
					startsAt: 21_000,
					payload: {
						quantity: 1,
						perUnitDurationSeconds: 30,
					},
				},
				{
					queueItemId: "queued-c",
					status: "queued",
					startsAt: 51_000,
					payload: {
						quantity: 2,
						perUnitDurationSeconds: 5,
					},
				},
			],
		});

		expect(patches).toEqual([
			{
				queueItemId: "queued-b",
				status: "active",
				startsAt: 25_000,
				completesAt: 55_000,
			},
			{
				queueItemId: "queued-c",
				status: "queued",
				startsAt: 55_000,
				completesAt: 65_000,
			},
		]);
	});
});
