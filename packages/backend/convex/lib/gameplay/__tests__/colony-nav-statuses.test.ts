import { describe, expect, it } from "vitest";

import type { Id } from "../../../_generated/dataModel";

import { mapColonyQueueStatuses } from "../../../../runtime/gameplay/colonyNav";

describe("colony nav queue status aggregation", () => {
	it("defaults to Stable and upgrades precedence to active", () => {
		const colonyA = "colonyA" as Id<"colonies">;
		const colonyB = "colonyB" as Id<"colonies">;
		const colonyC = "colonyC" as Id<"colonies">;

		const statuses = mapColonyQueueStatuses({
			colonyIds: [colonyA, colonyB, colonyC],
			queuedRows: [{ colonyId: colonyA }, { colonyId: colonyB }],
			activeRows: [{ colonyId: colonyB }],
		});

		expect(statuses).toEqual([
			{ colonyId: colonyA, status: "Queued" },
			{ colonyId: colonyB, status: "Upgrading" },
			{ colonyId: colonyC, status: "Stable" },
		]);
	});

	it("ignores queue rows for colonies outside the player's colony list", () => {
		const colonyA = "colonyA" as Id<"colonies">;
		const foreignColony = "foreignColony" as Id<"colonies">;

		const statuses = mapColonyQueueStatuses({
			colonyIds: [colonyA],
			queuedRows: [{ colonyId: foreignColony }],
			activeRows: [{ colonyId: foreignColony }],
		});

		expect(statuses).toEqual([{ colonyId: colonyA, status: "Stable" }]);
	});
});
