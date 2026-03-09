import type { UnlockContext, UnlockRule } from "./types";

/**
 * Evaluates a single unlock rule tree against current facility/research levels.
 * Returns `true` when no rule is provided.
 */
export function isUnlockSatisfied(rule: UnlockRule | undefined, context: UnlockContext): boolean {
	if (!rule) {
		return true;
	}

	switch (rule.type) {
		case "facility_level":
			return (context.facilityLevels[rule.facilityId] ?? 0) >= rule.minLevel;
		case "research_level":
			return (context.researchLevels[rule.researchId] ?? 0) >= rule.minLevel;
		case "all":
			return rule.rules.every((nestedRule) => isUnlockSatisfied(nestedRule, context));
		case "any":
			return rule.rules.some((nestedRule) => isUnlockSatisfied(nestedRule, context));
		default: {
			const exhaustive: never = rule;
			throw new Error(`Unhandled unlock rule type: ${String(exhaustive)}`);
		}
	}
}
