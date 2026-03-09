import type { CalculationContext, LevelFormula, ResourceMap } from "./types";

function assertIntegerLevel(level: number): void {
	if (!Number.isInteger(level) || level < 0) {
		throw new Error(`Level must be a non-negative integer. Received: ${level}`);
	}
}

export function exponentialAtLevel(base: number, growth: number, level: number): number {
	assertIntegerLevel(level);

	if (level === 0) {
		return 0;
	}

	return base * Math.pow(growth, level - 1);
}

export function makeExponentialUpgradeFormula(growth: number): LevelFormula {
	return (currentLevel, baseAmount) => {
		assertIntegerLevel(currentLevel);
		return baseAmount * Math.pow(growth, currentLevel);
	};
}

export function makeExponentialOperationalFormula(growth: number): LevelFormula {
	return (currentLevel, baseAmount) => {
		assertIntegerLevel(currentLevel);
		if (currentLevel === 0) {
			return 0;
		}
		return baseAmount * Math.pow(growth, currentLevel - 1);
	};
}

export function evaluateLevelFormula(
	formula: LevelFormula,
	currentLevel: number,
	baseAmount: number,
	context: CalculationContext,
): number {
	assertIntegerLevel(currentLevel);
	return formula(currentLevel, baseAmount, context);
}

export function roundResourceMap(resources: ResourceMap): ResourceMap {
	const next: ResourceMap = {};

	for (const [key, value] of Object.entries(resources)) {
		if (value === undefined) {
			continue;
		}
		next[key as keyof ResourceMap] = Math.max(0, Math.round(value));
	}

	return next;
}
