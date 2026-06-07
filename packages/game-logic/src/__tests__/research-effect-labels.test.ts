import { describe, expect, test } from "bun:test";

import {
	buildResearchEffectLabels,
	DEFAULT_RESEARCH_TREE,
	describeResearchEffect,
	type ResearchEffect,
} from "../index";

describe("research effect labels", () => {
	test("groups identical effects applied at every level", () => {
		const effect = {
			kind: "ship_stat_multiplier",
			stat: "hull",
			multiplier: 1.08,
		} satisfies ResearchEffect;

		expect(buildResearchEffectLabels([[effect], [effect], [effect]])).toEqual([
			"Combat ship hull increased by 8% per level",
		]);
	});

	test("separates effects introduced at milestone levels", () => {
		const durationEffect = {
			kind: "building_upgrade_time_multiplier",
			multiplier: 0.92,
		} satisfies ResearchEffect;
		const queueEffect = {
			kind: "building_queue_capacity_bonus",
			amount: 1,
		} satisfies ResearchEffect;

		expect(
			buildResearchEffectLabels([
				[durationEffect],
				[durationEffect],
				[durationEffect, queueEffect],
			]),
		).toEqual(["Building upgrade time reduced by 8% per level", "Level 3 +1 building queue slot"]);
	});

	test("does not describe repeated replacement effects as cumulative", () => {
		const effect = {
			kind: "transport_storage_reservation",
			multiplier: 1,
		} satisfies ResearchEffect;

		expect(buildResearchEffectLabels([[effect], [effect]])).toEqual([
			"Own-colony transport storage reservation",
		]);
	});

	test("uses player-facing names instead of internal keys", () => {
		expect(
			describeResearchEffect({
				kind: "facility_max_level_bonus",
				facilityKey: "robotics_hub",
				amount: 2,
			}),
		).toBe("Robotics Hub max level +2");
		expect(
			describeResearchEffect({
				kind: "route_speed_multiplier",
				routeClass: "interSystem",
				multiplier: 0.5,
			}),
		).toBe("inter-system travel time reduced by 50%");
	});

	test("active nodes do not contain duplicate effect labels", () => {
		for (const node of DEFAULT_RESEARCH_TREE) {
			expect(new Set(node.effectLabels).size, node.id).toBe(node.effectLabels.length);
		}
	});
});
