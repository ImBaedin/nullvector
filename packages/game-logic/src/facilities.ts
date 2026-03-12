import type { FacilityDefinition, FacilityRegistry, UnlockContext } from "./types";

import { makeExponentialUpgradeFormula } from "./curves";
import { createRegistry, isStructureUnlocked } from "./structures";

export function isFacilityUnlocked(facility: FacilityDefinition, context: UnlockContext): boolean {
	return isStructureUnlocked(facility, context);
}

export function createFacilityRegistry(definitions: FacilityDefinition[]): FacilityRegistry {
	return createRegistry(definitions);
}

export function getFacilityBuffs(facility: FacilityDefinition): FacilityDefinition["buffs"] {
	return facility.buffs;
}

/**
 * Baseline facility balance configuration.
 *
 * Facilities focus on buffs/unlocks and colony capabilities rather than direct resource generation.
 */
export const DEFAULT_FACILITIES: FacilityDefinition[] = [
	{
		id: "robotics_hub",
		kind: "facility",
		name: "Robotics Hub",
		category: "infrastructure",
		maxLevel: 20,
		costCurve: {
			baseCost: { alloy: 400, crystal: 120 },
			formula: makeExponentialUpgradeFormula(1.9),
		},
		upgradeTimeCurve: {
			baseSeconds: 120,
			formula: makeExponentialUpgradeFormula(1.25),
		},
		buffs: [
			{
				type: "queue_capacity",
				additionalSlots: 1,
			},
			{
				type: "resource_production_multiplier",
				resource: "alloy",
				multiplier: 1.03,
			},
		],
	},
	{
		id: "logistics_nexus",
		kind: "facility",
		name: "Logistics Nexus",
		category: "infrastructure",
		maxLevel: 20,
		costCurve: {
			baseCost: { alloy: 550, crystal: 240 },
			formula: makeExponentialUpgradeFormula(2),
		},
		upgradeTimeCurve: {
			baseSeconds: 150,
			formula: makeExponentialUpgradeFormula(1.26),
		},
		unlock: {
			type: "facility_level",
			facilityId: "robotics_hub",
			minLevel: 2,
		},
		buffs: [
			{
				type: "resource_production_multiplier",
				resource: "fuel",
				multiplier: 1.05,
			},
			{
				type: "facility_unlock",
				facilityId: "shipyard",
			},
		],
	},
	{
		id: "shipyard",
		kind: "facility",
		name: "Shipyard",
		category: "military",
		maxLevel: 15,
		costCurve: {
			baseCost: { alloy: 1000, crystal: 600 },
			formula: makeExponentialUpgradeFormula(2.1),
		},
		upgradeTimeCurve: {
			baseSeconds: 180,
			formula: makeExponentialUpgradeFormula(1.28),
		},
		buffs: [
			{
				type: "ship_unlock",
				shipId: "light_fighter",
			},
			{
				type: "ship_unlock",
				shipId: "transport_freighter",
			},
		],
	},
	{
		id: "defense_grid",
		kind: "facility",
		name: "Defense Grid",
		category: "military",
		maxLevel: 15,
		costCurve: {
			baseCost: { alloy: 1_400, crystal: 900 },
			formula: makeExponentialUpgradeFormula(2.12),
		},
		upgradeTimeCurve: {
			baseSeconds: 240,
			formula: makeExponentialUpgradeFormula(1.29),
		},
		unlock: {
			type: "facility_level",
			facilityId: "shipyard",
			minLevel: 2,
		},
		buffs: [],
	},
];

export const DEFAULT_FACILITY_REGISTRY = createFacilityRegistry(DEFAULT_FACILITIES);
