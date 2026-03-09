import { expect, test } from "bun:test";

import {
	DEFAULT_FACILITY_REGISTRY,
	DEFAULT_GENERATOR_REGISTRY,
	getCostAtLevel,
	getFacilityBuffs,
	getGeneratorConsumptionPerMinute,
	getGeneratorProductionPerMinute,
	getUpgradeDurationSeconds,
	getUpgradeCost,
	isStructureUnlocked,
	isFacilityUnlocked,
	isGeneratorUnlocked,
	isUnlockSatisfied,
	type CalculationContext,
	type UnlockRule,
} from "../index";

function requireGenerator(id: string) {
	const generator = DEFAULT_GENERATOR_REGISTRY.get(id);
	if (!generator) {
		throw new Error(`Missing generator: ${id}`);
	}
	return generator;
}

function requireFacility(id: string) {
	const facility = DEFAULT_FACILITY_REGISTRY.get(id);
	if (!facility) {
		throw new Error(`Missing facility: ${id}`);
	}
	return facility;
}

test("upgrade cost is cost-at-next-level for any structure", () => {
	const generator = requireGenerator("alloy_mine");
	const facility = requireFacility("robotics_hub");

	expect(getUpgradeCost(generator, 0)).toEqual(getCostAtLevel(generator, 1));
	expect(getUpgradeCost(facility, 5)).toEqual(getCostAtLevel(facility, 6));
});

test("cost formulas receive current level and base amount", () => {
	const structure = {
		id: "test_structure",
		name: "Test Structure",
		maxLevel: 10,
		costCurve: {
			baseCost: { alloy: 100 },
			formula: (currentLevel: number, baseAmount: number) => baseAmount + currentLevel * 25,
		},
		upgradeTimeCurve: {
			baseSeconds: 10,
			formula: () => 10,
		},
	};

	expect(getCostAtLevel(structure, 1)).toEqual({ alloy: 100 });
	expect(getCostAtLevel(structure, 6)).toEqual({ alloy: 225 });
	expect(getUpgradeCost(structure, 5)).toEqual({ alloy: 225 });
});

test("generator production and optional consumption scale with level", () => {
	const crystalMine = requireGenerator("crystal_mine");
	const deuteriumExtractor = requireGenerator("deuterium_extractor");

	expect(getGeneratorProductionPerMinute(crystalMine, 0)).toBe(0);
	expect(getGeneratorProductionPerMinute(crystalMine, 6)).toBeGreaterThan(
		getGeneratorProductionPerMinute(crystalMine, 1),
	);

	expect(getGeneratorConsumptionPerMinute(crystalMine, 6)).toBe(0);
	expect(getGeneratorConsumptionPerMinute(deuteriumExtractor, 6)).toBe(0);
});

test("generator rate formulas receive level and base amount", () => {
	const generator = {
		id: "linear_generator",
		kind: "generator" as const,
		name: "Linear Generator",
		category: "resource" as const,
		maxLevel: 10,
		costCurve: {
			baseCost: { alloy: 1 },
			formula: (currentLevel: number, baseAmount: number) => baseAmount + currentLevel,
		},
		upgradeTimeCurve: {
			baseSeconds: 10,
			formula: () => 10,
		},
		produces: {
			resource: "alloy" as const,
			rateCurve: {
				basePerMinute: 5,
				formula: (currentLevel: number, baseAmount: number) => baseAmount * currentLevel,
			},
		},
		consumes: {
			resource: "energy" as const,
			rateCurve: {
				basePerMinute: 2,
				formula: (currentLevel: number, baseAmount: number) => baseAmount + currentLevel * 2,
			},
		},
	};

	expect(getGeneratorProductionPerMinute(generator, 0)).toBe(0);
	expect(getGeneratorProductionPerMinute(generator, 4)).toBe(20);
	expect(getGeneratorConsumptionPerMinute(generator, 4)).toBe(10);
});

test("upgrade duration increases with level and supports context modifiers", () => {
	const alloyMine = requireGenerator("alloy_mine");

	const level1Duration = getUpgradeDurationSeconds(alloyMine, 0);
	const level6Duration = getUpgradeDurationSeconds(alloyMine, 5);

	expect(level6Duration).toBeGreaterThan(level1Duration);

	const contextAwareStructure = {
		id: "context_duration_test",
		name: "Context Duration Test",
		maxLevel: 10,
		costCurve: {
			baseCost: { alloy: 100 },
			formula: (currentLevel: number, baseAmount: number) => baseAmount + currentLevel,
		},
		upgradeTimeCurve: {
			baseSeconds: 100,
			formula: (currentLevel: number, baseAmount: number, context: CalculationContext) => {
				const roboticsLevel = context.facilityLevels.robotics_hub ?? 0;
				const reduction = Math.min(0.5, roboticsLevel * 0.05);
				return baseAmount * (1 + currentLevel * 0.1) * (1 - reduction);
			},
		},
	};

	const baseline = getUpgradeDurationSeconds(contextAwareStructure, 4, {
		facilityLevels: {},
		researchLevels: {},
	});
	const boosted = getUpgradeDurationSeconds(contextAwareStructure, 4, {
		facilityLevels: { robotics_hub: 4 },
		researchLevels: {},
	});

	expect(boosted).toBeLessThan(baseline);
});

test("default generators have no unlock requirements", () => {
	for (const generator of DEFAULT_GENERATOR_REGISTRY.values()) {
		expect(
			isGeneratorUnlocked(generator, {
				facilityLevels: {},
				researchLevels: {},
			}),
		).toBe(true);
	}
});

test("facilities are unlock/buff structures", () => {
	const shipyard = requireFacility("shipyard");

	expect(
		isFacilityUnlocked(shipyard, {
			facilityLevels: {},
			researchLevels: {},
		}),
	).toBe(true);

	expect(getFacilityBuffs(shipyard).some((buff) => buff.type === "ship_unlock")).toBe(true);
});

test("nested unlock rules support any/all composition", () => {
	const rule: UnlockRule = {
		type: "all",
		rules: [
			{
				type: "any",
				rules: [
					{ type: "research_level", researchId: "ion_drive", minLevel: 2 },
					{ type: "facility_level", facilityId: "shipyard", minLevel: 6 },
				],
			},
		],
	};

	expect(
		isUnlockSatisfied(rule, {
			facilityLevels: { shipyard: 5 },
			researchLevels: { ion_drive: 2 },
		}),
	).toBe(true);

	expect(
		isUnlockSatisfied(rule, {
			facilityLevels: { shipyard: 5 },
			researchLevels: { ion_drive: 1 },
		}),
	).toBe(false);
});

test("max level is enforced for structure costs and generator rates", () => {
	const facility = requireFacility("shipyard");
	const generator = requireGenerator("solar_plant");

	expect(() => getCostAtLevel(facility, facility.maxLevel + 1)).toThrow();
	expect(() => getUpgradeCost(facility, facility.maxLevel)).toThrow();
	expect(() => getGeneratorProductionPerMinute(generator, generator.maxLevel + 1)).toThrow();
	expect(
		isStructureUnlocked(facility, {
			facilityLevels: {},
			researchLevels: {},
		}),
	).toBe(true);
});
