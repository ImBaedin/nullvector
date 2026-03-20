import { expect, test } from "bun:test";

import {
	QUEST_DEFINITIONS,
	evaluateQuestDefinition,
	getProgressionOverview,
	getRankForXpTotal,
	RANK_DEFINITIONS,
} from "../progression";

test("progression overview derives rank and colony cap from total xp", () => {
	const rankZero = getProgressionOverview({
		rankXpTotal: 0,
	});
	expect(rankZero.rank).toBe(0);
	expect(rankZero.colonyCap).toBe(1);
	expect(rankZero.raidRules.enabled).toBe(false);

	const rankFive = getRankForXpTotal(1_000);
	const overview = getProgressionOverview({
		rankXpTotal: rankFive.totalXpRequired,
	});
	expect(overview.rank).toBe(rankFive.rank);
	expect(rankFive.totalXpRequired).toBe(RANK_DEFINITIONS[rankFive.rank]?.totalXpRequired);
	expect(overview.colonyCap).toBe(2);
	expect(overview.features.colonization).toBe("unlocked");
	expect(overview.raidRules.enabled).toBe(true);
});

test("bound-colony quest objectives only read the bound colony state", () => {
	const quest = QUEST_DEFINITIONS.find((definition) => definition.id === "main_raise_alloy_output");
	if (!quest) {
		throw new Error("Missing seed quest definition");
	}

	const evaluation = evaluateQuestDefinition({
		quest,
		bindings: { colonyId: "starter" },
		context: {
			colonyCount: 2,
			colonies: [
				{
					colonyId: "starter",
					buildings: { alloyMineLevel: 1 },
					facilities: { robotics_hub: 0, shipyard: 0, defense_grid: 0 },
					ships: {},
				},
				{
					colonyId: "other",
					buildings: { alloyMineLevel: 5 },
					facilities: { robotics_hub: 0, shipyard: 0, defense_grid: 0 },
					ships: {},
				},
			],
		},
	});

	expect(evaluation.complete).toBe(false);
	expect(evaluation.objectives[0]?.current).toBe(1);
	expect(evaluation.objectives[0]?.required).toBe(2);
});

test("player-scoped colony count objectives resolve retroactively from current state", () => {
	const quest = QUEST_DEFINITIONS.find(
		(definition) => definition.id === "main_expand_to_second_colony",
	);
	if (!quest) {
		throw new Error("Missing colony quest definition");
	}

	const evaluation = evaluateQuestDefinition({
		quest,
		context: {
			colonyCount: 2,
			colonies: [
				{
					colonyId: "starter",
					buildings: {},
					facilities: {},
					ships: {},
				},
				{
					colonyId: "second",
					buildings: {},
					facilities: {},
					ships: {},
				},
			],
		},
	});

	expect(evaluation.complete).toBe(true);
	expect(evaluation.objectives[0]).toEqual({
		complete: true,
		current: 2,
		required: 2,
	});
});
