# @nullvector/game-logic

Shared deterministic game formulas for frontend and backend.

## Domain model

- `generators`: produce a resource per minute and may consume another resource per minute.
- `facilities`: unlock gameplay capabilities and provide colony buffs.
- `structures`: shared cost and unlock logic used by both generators and facilities.
- every structure must declare `maxLevel`.
- cost, rate, and upgrade-time curves are function-based:
  `(currentLevel, baseAmount, context) => amount`.
- every structure declares `upgradeTimeCurve` for level-up duration calculations.

This package is intentionally pure logic and data. No I/O, no Convex, and no UI dependencies.

## Unlock rules

- Missing `unlock` means the structure is unlocked by default.
- `facility_level` checks `context.facilityLevels[facilityId] >= minLevel`.
- `research_level` checks `context.researchLevels[researchId] >= minLevel`.
- `all` requires every nested rule to pass.
- `any` requires at least one nested rule to pass.

Example rule tree:

```ts
const unlock = {
	type: "all",
	rules: [
		{ type: "facility_level", facilityId: "robotics_hub", minLevel: 2 },
		{
			type: "any",
			rules: [
				{ type: "research_level", researchId: "ion_drive", minLevel: 1 },
				{ type: "facility_level", facilityId: "shipyard", minLevel: 4 },
			],
		},
	],
} as const;
```

## Example

```ts
import {
	DEFAULT_FACILITY_REGISTRY,
	DEFAULT_GENERATOR_REGISTRY,
	getFacilityBuffs,
	getGeneratorProductionPerMinute,
	getUpgradeDurationSeconds,
	getUpgradeCost,
	isGeneratorUnlocked,
} from "@nullvector/game-logic";

const generator = DEFAULT_GENERATOR_REGISTRY.get("alloy_mine");
if (!generator) throw new Error("Missing generator definition");

const nextCost = getUpgradeCost(generator, 7);
const output = getGeneratorProductionPerMinute(generator, 7);
const seconds = getUpgradeDurationSeconds(generator, 7, {
	facilityLevels: { robotics_hub: 3 },
	researchLevels: {},
});

const unlocked = isGeneratorUnlocked(generator, {
	facilityLevels: { robotics_hub: 2 },
	researchLevels: {},
});

const shipyard = DEFAULT_FACILITY_REGISTRY.get("shipyard");
if (!shipyard) throw new Error("Missing facility definition");
const buffs = getFacilityBuffs(shipyard);
```
