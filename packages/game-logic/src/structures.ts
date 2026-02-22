import { roundResourceMap } from "./curves";
import { evaluateLevelFormula } from "./curves";
import type {
  CalculationContext,
  ResourceMap,
  StructureDefinition,
  UnlockContext,
} from "./types";
import { isUnlockSatisfied } from "./unlocks";

function assertTargetLevel(level: number): void {
  if (!Number.isInteger(level) || level <= 0) {
    throw new Error(`Target level must be a positive integer. Received: ${level}`);
  }
}

function assertCurrentLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0) {
    throw new Error(`Current level must be a non-negative integer. Received: ${level}`);
  }
}

function assertMaxLevel(maxLevel: number): void {
  if (!Number.isInteger(maxLevel) || maxLevel < 1) {
    throw new Error(`Max level must be a positive integer. Received: ${maxLevel}`);
  }
}

function resolveCalculationContext(
  context: Partial<CalculationContext> | undefined
): CalculationContext {
  return {
    facilityLevels: context?.facilityLevels ?? {},
    researchLevels: context?.researchLevels ?? {},
    modifiers: context?.modifiers,
  };
}

export function getCostAtLevel(
  structure: StructureDefinition,
  targetLevel: number,
  context?: Partial<CalculationContext>
): ResourceMap {
  assertTargetLevel(targetLevel);
  assertMaxLevel(structure.maxLevel);
  if (targetLevel > structure.maxLevel) {
    throw new Error(
      `Target level ${targetLevel} exceeds max level ${structure.maxLevel} for ${structure.id}`
    );
  }

  const unrounded: ResourceMap = {};
  const calculationContext = resolveCalculationContext(context);

  for (const [resource, base] of Object.entries(structure.costCurve.baseCost)) {
    if (base === undefined) {
      continue;
    }

    unrounded[resource as keyof ResourceMap] = evaluateLevelFormula(
      // Cost formulas receive "current level before upgrade", hence target - 1.
      structure.costCurve.formula,
      targetLevel - 1,
      base,
      calculationContext
    );
  }

  return roundResourceMap(unrounded);
}

export function getUpgradeCost(
  structure: StructureDefinition,
  currentLevel: number,
  context?: Partial<CalculationContext>
): ResourceMap {
  assertCurrentLevel(currentLevel);
  assertMaxLevel(structure.maxLevel);
  if (currentLevel >= structure.maxLevel) {
    throw new Error(`Structure ${structure.id} is already at max level ${structure.maxLevel}`);
  }
  return getCostAtLevel(structure, currentLevel + 1, context);
}

export function getUpgradeDurationSeconds(
  structure: StructureDefinition,
  currentLevel: number,
  context?: Partial<CalculationContext>
): number {
  assertCurrentLevel(currentLevel);
  assertMaxLevel(structure.maxLevel);
  if (currentLevel >= structure.maxLevel) {
    throw new Error(`Structure ${structure.id} is already at max level ${structure.maxLevel}`);
  }

  const calculationContext = resolveCalculationContext(context);
  return Math.max(
    0,
    Math.round(
      evaluateLevelFormula(
        structure.upgradeTimeCurve.formula,
        currentLevel,
        structure.upgradeTimeCurve.baseSeconds,
        calculationContext
      )
    )
  );
}

export function isStructureUnlocked(
  structure: StructureDefinition,
  context: UnlockContext
): boolean {
  return isUnlockSatisfied(structure.unlock, context);
}

export function createRegistry<T extends StructureDefinition>(definitions: T[]): ReadonlyMap<string, T> {
  const registry = new Map<string, T>();

  for (const definition of definitions) {
    if (registry.has(definition.id)) {
      throw new Error(`Duplicate structure id: ${definition.id}`);
    }
    assertMaxLevel(definition.maxLevel);
    registry.set(definition.id, definition);
  }

  return registry;
}
