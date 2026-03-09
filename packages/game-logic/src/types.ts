export const RESOURCE_KEYS = ["alloy", "crystal", "fuel", "energy"] as const;

export type ResourceKey = (typeof RESOURCE_KEYS)[number];
export type ResourceMap = Partial<Record<ResourceKey, number>>;

/**
 * Runtime inputs available to all curve calculations.
 * Add new gameplay knobs here as simulation needs grow.
 */
export type CalculationContext = {
	facilityLevels: Partial<Record<string, number>>;
	researchLevels: Partial<Record<string, number>>;
	modifiers?: Partial<Record<string, number>>;
};

/**
 * Generic level-based formula used by both cost and rate curves.
 *
 * `currentLevel` is 0-indexed:
 * - For upgrade cost, it is the structure's current level before the upgrade.
 * - For production/consumption rate, it is the active structure level.
 *
 * `baseAmount` is the configured base cost/rate for that resource.
 * `context` allows formulas to account for other facility/research levels.
 */
export type LevelFormula = (
	currentLevel: number,
	baseAmount: number,
	context: CalculationContext,
) => number;

export type CostCurve = {
	/** Base resource amounts before formula scaling. */
	baseCost: ResourceMap;
	/** Returns cost at a given current level for each base resource amount. */
	formula: LevelFormula;
};

export type RateCurve = {
	/** Base amount per minute before formula scaling. */
	basePerMinute: number;
	/** Returns rate at a given active level for the base amount. */
	formula: LevelFormula;
};

export type UpgradeTimeCurve = {
	/** Base duration in seconds before formula scaling. */
	baseSeconds: number;
	/** Returns upgrade duration in seconds for the current level. */
	formula: LevelFormula;
};

/**
 * Unlock rule tree for generators/facilities.
 *
 * Semantics:
 * - `facility_level`: requires a facility at or above `minLevel`.
 * - `research_level`: requires a research item at or above `minLevel`.
 * - `all`: every nested rule must pass.
 * - `any`: at least one nested rule must pass.
 */
export type UnlockRule =
	| {
			type: "facility_level";
			facilityId: string;
			minLevel: number;
	  }
	| {
			type: "research_level";
			researchId: string;
			minLevel: number;
	  }
	| {
			type: "all";
			rules: UnlockRule[];
	  }
	| {
			type: "any";
			rules: UnlockRule[];
	  };

/** Runtime levels used when evaluating unlock rules. Missing entries default to level 0. */
export type UnlockContext = Pick<CalculationContext, "facilityLevels" | "researchLevels">;

export type StructureDefinition = {
	id: string;
	name: string;
	/** Hard cap; callers should not request values above this level. */
	maxLevel: number;
	costCurve: CostCurve;
	/** Level-up duration in seconds. */
	upgradeTimeCurve: UpgradeTimeCurve;
	unlock?: UnlockRule;
};

export type GeneratorCategory = "resource" | "power";

export type GeneratorDefinition = StructureDefinition & {
	kind: "generator";
	category: GeneratorCategory;
	/** Primary resource output for this generator. */
	produces: {
		resource: ResourceKey;
		rateCurve: RateCurve;
	};
	/** Optional upkeep/consumption while producing output. */
	consumes?: {
		resource: ResourceKey;
		rateCurve: RateCurve;
	};
};

export type ColonyBuff =
	| {
			type: "resource_production_multiplier";
			resource: ResourceKey;
			multiplier: number;
	  }
	| {
			type: "ship_unlock";
			shipId: string;
	  }
	| {
			type: "facility_unlock";
			facilityId: string;
	  }
	| {
			type: "queue_capacity";
			additionalSlots: number;
	  };

export type FacilityCategory = "infrastructure" | "research" | "military";

export type FacilityDefinition = StructureDefinition & {
	kind: "facility";
	category: FacilityCategory;
	/** Passive unlocks or buffs this facility grants while built. */
	buffs: ColonyBuff[];
};

export type GeneratorRegistry = ReadonlyMap<string, GeneratorDefinition>;
export type FacilityRegistry = ReadonlyMap<string, FacilityDefinition>;
