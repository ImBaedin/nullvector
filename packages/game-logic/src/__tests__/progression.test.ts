import { expect, test } from "bun:test";

import {
	QUEST_DEFINITIONS,
	evaluateQuestDefinition,
	getProgressionOverview,
	getRankDefinition,
	getRankForXpTotal,
	RANK_DEFINITIONS,
} from "../progression";

test("progression overview derives onboarding gates from total xp", () => {
	const rankZero = getProgressionOverview({
		rankXpTotal: 0,
	});
	expect(rankZero.rank).toBe(0);
	expect(rankZero.colonyCap).toBe(1);
	expect(rankZero.features.facilities).toBe("hidden");
	expect(rankZero.features.defenses).toBe("hidden");
	expect(rankZero.features.shipyard).toBe("hidden");
	expect(rankZero.raidRules.mode).toBe("off");

	const rankThree = getRankDefinition(3);
	const overview = getProgressionOverview({
		rankXpTotal: rankThree.totalXpRequired,
	});
	expect(overview.rank).toBe(3);
	expect(RANK_DEFINITIONS[3]).toBeDefined();
	expect(rankThree.totalXpRequired).toBe(RANK_DEFINITIONS[3]!.totalXpRequired);
	expect(overview.features.shipyard).toBe("unlocked");
	expect(overview.features.contracts).toBe("unlocked");
	expect(overview.shipAccess.interceptor).toBe("unlocked");
	expect(overview.missionAccess.contracts).toBe("unlocked");

	const rankFive = getRankForXpTotal(1_000);
	expect(rankFive.rank).toBeGreaterThanOrEqual(5);
	expect(rankFive.colonyCap).toBe(2);
	expect(rankFive.missionAccess.colonize).toBe("unlocked");
	expect(rankFive.missionAccess.transport).toBe("unlocked");
});

test("bound-colony quest objectives only read the bound colony state", () => {
	const quest = QUEST_DEFINITIONS.find((definition) => definition.id === "main_scaling_production");
	if (!quest) {
		throw new Error("Missing scaling production quest definition");
	}

	const evaluation = evaluateQuestDefinition({
		quest,
		bindings: { colonyId: "starter" },
		context: {
			colonyCount: 2,
			colonizationSuccessCount: 0,
			contractRewardResourcesByColony: {},
			contractSuccessCountByColony: {},
			raidDefenseSuccessCountByColony: {},
			transportDeliveredResourcesByColony: {},
			transportDeliveryCountByColony: {},
			colonies: [
				{
					colonyId: "starter",
					buildings: { alloyMineLevel: 4, crystalMineLevel: 3, fuelRefineryLevel: 4 },
					defenses: {},
					facilities: { robotics_hub: 0, shipyard: 0, defense_grid: 0 },
					ships: {},
				},
				{
					colonyId: "other",
					buildings: { alloyMineLevel: 8, crystalMineLevel: 8, fuelRefineryLevel: 8 },
					defenses: {},
					facilities: { robotics_hub: 0, shipyard: 0, defense_grid: 0 },
					ships: {},
				},
			],
		},
	});

	expect(evaluation.complete).toBe(false);
	expect(evaluation.objectives[0]?.current).toBe(4);
	expect(evaluation.objectives[1]?.current).toBe(3);
	expect(evaluation.objectives[2]?.current).toBe(4);
});

test("newest-player-colony quests evaluate against the bound colony context", () => {
	const quest = QUEST_DEFINITIONS.find((definition) => definition.id === "main_open_supply_line");
	if (!quest) {
		throw new Error("Missing supply line quest definition");
	}

	const evaluation = evaluateQuestDefinition({
		quest,
		bindings: { colonyId: "newest" },
		context: {
			colonyCount: 2,
			colonizationSuccessCount: 1,
			contractRewardResourcesByColony: {},
			contractSuccessCountByColony: {},
			raidDefenseSuccessCountByColony: {},
			transportDeliveredResourcesByColony: {
				starter: 7_500,
				newest: 2_600,
			},
			transportDeliveryCountByColony: {
				starter: 3,
				newest: 1,
			},
			colonies: [
				{
					colonyId: "starter",
					buildings: {},
					defenses: {},
					facilities: {},
					ships: {},
				},
				{
					colonyId: "newest",
					buildings: {},
					defenses: {},
					facilities: {},
					ships: {},
				},
			],
		},
	});

	expect(evaluation.complete).toBe(true);
	expect(evaluation.objectives[0]).toEqual({
		complete: true,
		current: 1,
		required: 1,
	});
	expect(evaluation.objectives[1]).toEqual({
		complete: true,
		current: 2_600,
		required: 2_500,
	});
});

test("event-based objectives resolve from derived progression metrics", () => {
	const quest = QUEST_DEFINITIONS.find((definition) => definition.id === "main_hold_the_line");
	if (!quest) {
		throw new Error("Missing raid defense quest definition");
	}

	const evaluation = evaluateQuestDefinition({
		quest,
		bindings: { colonyId: "starter" },
		context: {
			colonyCount: 1,
			colonizationSuccessCount: 0,
			contractRewardResourcesByColony: { starter: 1_100 },
			contractSuccessCountByColony: { starter: 1 },
			raidDefenseSuccessCountByColony: { starter: 1 },
			transportDeliveredResourcesByColony: {},
			transportDeliveryCountByColony: {},
			colonies: [
				{
					colonyId: "starter",
					buildings: {},
					defenses: { missileBattery: 5 },
					facilities: { defense_grid: 1 },
					ships: { interceptor: 5 },
				},
			],
		},
	});

	expect(evaluation.complete).toBe(true);
	expect(evaluation.objectives[0]).toEqual({
		complete: true,
		current: 1,
		required: 1,
	});
});
