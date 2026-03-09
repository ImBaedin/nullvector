import type {
	CalculationContext,
	GeneratorDefinition,
	GeneratorRegistry,
	UnlockContext,
} from "./types";

import {
	evaluateLevelFormula,
	makeExponentialOperationalFormula,
	makeExponentialUpgradeFormula,
} from "./curves";
import { createRegistry, isStructureUnlocked } from "./structures";

function assertGeneratorLevel(generator: GeneratorDefinition, level: number): void {
	if (!Number.isInteger(level) || level < 0) {
		throw new Error(`Level must be a non-negative integer. Received: ${level}`);
	}
	if (level > generator.maxLevel) {
		throw new Error(`Level ${level} exceeds max level ${generator.maxLevel} for ${generator.id}`);
	}
}

function resolveCalculationContext(
	context: Partial<CalculationContext> | undefined,
): CalculationContext {
	return {
		facilityLevels: context?.facilityLevels ?? {},
		researchLevels: context?.researchLevels ?? {},
		modifiers: context?.modifiers,
	};
}

export function getGeneratorProductionPerMinute(
	generator: GeneratorDefinition,
	level: number,
	context?: Partial<CalculationContext>,
): number {
	assertGeneratorLevel(generator, level);
	const calculationContext = resolveCalculationContext(context);

	return Math.round(
		evaluateLevelFormula(
			generator.produces.rateCurve.formula,
			level,
			generator.produces.rateCurve.basePerMinute,
			calculationContext,
		),
	);
}

export function getGeneratorConsumptionPerMinute(
	generator: GeneratorDefinition,
	level: number,
	context?: Partial<CalculationContext>,
): number {
	assertGeneratorLevel(generator, level);
	const calculationContext = resolveCalculationContext(context);

	if (!generator.consumes) {
		return 0;
	}

	return Math.round(
		evaluateLevelFormula(
			generator.consumes.rateCurve.formula,
			level,
			generator.consumes.rateCurve.basePerMinute,
			calculationContext,
		),
	);
}

export function isGeneratorUnlocked(
	generator: GeneratorDefinition,
	context: UnlockContext,
): boolean {
	return isStructureUnlocked(generator, context);
}

export function createGeneratorRegistry(definitions: GeneratorDefinition[]): GeneratorRegistry {
	return createRegistry(definitions);
}

/**
 * Baseline generator balance configuration.
 *
 * Notes:
 * - `maxLevel` is required and enforced by helper functions.
 * - cost formulas use current level before upgrade.
 * - rate formulas use active level.
 */
export const DEFAULT_GENERATORS: GeneratorDefinition[] = [
	{
		id: "alloy_mine",
		kind: "generator",
		name: "Alloy Mine",
		category: "resource",
		maxLevel: 30,
		costCurve: {
			baseCost: { alloy: 60, crystal: 15 },
			formula: makeExponentialUpgradeFormula(1.5),
		},
		upgradeTimeCurve: {
			baseSeconds: 60,
			formula: makeExponentialUpgradeFormula(1.2),
		},
		produces: {
			resource: "alloy",
			rateCurve: {
				basePerMinute: 30,
				formula: makeExponentialOperationalFormula(1.1),
			},
		},
	},
	{
		id: "crystal_mine",
		kind: "generator",
		name: "Crystal Mine",
		category: "resource",
		maxLevel: 30,
		costCurve: {
			baseCost: { alloy: 48, crystal: 24 },
			formula: makeExponentialUpgradeFormula(1.6),
		},
		upgradeTimeCurve: {
			baseSeconds: 75,
			formula: makeExponentialUpgradeFormula(1.2),
		},
		produces: {
			resource: "crystal",
			rateCurve: {
				basePerMinute: 20,
				formula: makeExponentialOperationalFormula(1.1),
			},
		},
	},
	{
		id: "deuterium_extractor",
		kind: "generator",
		name: "Deuterium Extractor",
		category: "resource",
		maxLevel: 30,
		costCurve: {
			baseCost: { alloy: 225, crystal: 75 },
			formula: makeExponentialUpgradeFormula(1.5),
		},
		upgradeTimeCurve: {
			baseSeconds: 90,
			formula: makeExponentialUpgradeFormula(1.22),
		},
		produces: {
			resource: "fuel",
			rateCurve: {
				basePerMinute: 10,
				formula: makeExponentialOperationalFormula(1.1),
			},
		},
	},
	{
		id: "solar_plant",
		kind: "generator",
		name: "Solar Plant",
		category: "power",
		maxLevel: 30,
		costCurve: {
			baseCost: { alloy: 75, crystal: 30 },
			formula: makeExponentialUpgradeFormula(1.5),
		},
		upgradeTimeCurve: {
			baseSeconds: 50,
			formula: makeExponentialUpgradeFormula(1.18),
		},
		produces: {
			resource: "energy",
			rateCurve: {
				basePerMinute: 25,
				formula: makeExponentialOperationalFormula(1.08),
			},
		},
	},
];

export const DEFAULT_GENERATOR_REGISTRY = createGeneratorRegistry(DEFAULT_GENERATORS);
