import type { QuestObjectiveDefinition } from "@nullvector/game-logic";

const BUILDING_NAMES: Record<string, string> = {
	alloyMineLevel: "Alloy Mine",
	crystalMineLevel: "Crystal Mine",
	fuelRefineryLevel: "Fuel Refinery",
	powerPlantLevel: "Power Plant",
	alloyStorageLevel: "Alloy Storage",
	crystalStorageLevel: "Crystal Storage",
	fuelStorageLevel: "Fuel Storage",
};

const FACILITY_NAMES: Record<string, string> = {
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
	defense_grid: "Defense Grid",
};

const SHIP_NAMES: Record<string, string> = {
	interceptor: "Interceptor",
	scout: "Scout",
	smallCargo: "Small Cargo Ship",
	largeCargo: "Large Cargo Ship",
	colonyShip: "Colony Ship",
	frigate: "Frigate",
	cruiser: "Cruiser",
	bomber: "Bomber",
};

const DEFENSE_NAMES: Record<string, string> = {
	missileBattery: "Missile Battery",
	laserTurret: "Laser Turret",
	gaussCannon: "Gauss Cannon",
	shieldDome: "Shield Dome",
};

export function formatObjectiveDescription(objective: QuestObjectiveDefinition): string {
	switch (objective.kind) {
		case "buildingLevelAtLeast": {
			const name = BUILDING_NAMES[objective.buildingKey] ?? objective.buildingKey;
			return `Upgrade ${name} to Lv. ${objective.minLevel}`;
		}
		case "facilityLevelAtLeast": {
			const name = FACILITY_NAMES[objective.facilityKey] ?? objective.facilityKey;
			return `Upgrade ${name} to Lv. ${objective.minLevel}`;
		}
		case "shipCountAtLeast": {
			const name = SHIP_NAMES[objective.shipKey] ?? objective.shipKey;
			return `Build ${objective.minCount} ${name}${objective.minCount !== 1 ? "s" : ""}`;
		}
		case "defenseCountAtLeast": {
			const name = DEFENSE_NAMES[objective.defenseKey] ?? objective.defenseKey;
			return `Build ${objective.minCount} ${name}${objective.minCount !== 1 ? " Batteries" : ""}`.replace(
				"Missile Battery Batteries",
				"Missile Batteries",
			);
		}
		case "colonyCountAtLeast":
			return `Found ${objective.minCount} ${objective.minCount === 1 ? "Colony" : "Colonies"}`;
		case "contractSuccessCountAtLeast":
			return `Complete ${objective.minCount} ${objective.minCount === 1 ? "Contract" : "Contracts"}`;
		case "contractRewardResourcesAtLeast":
			return `Earn ${objective.minAmount.toLocaleString()} Resource Units from Contracts`;
		case "raidDefenseSuccessCountAtLeast":
			return `Survive ${objective.minCount} ${objective.minCount === 1 ? "Raid" : "Raids"}`;
		case "colonizationSuccessCountAtLeast":
			return `Colonize ${objective.minCount} ${objective.minCount === 1 ? "Planet" : "Planets"}`;
		case "transportDeliveryCountAtLeast":
			return `Complete ${objective.minCount} Transport ${objective.minCount === 1 ? "Delivery" : "Deliveries"}`;
		case "transportDeliveredResourcesAtLeast":
			return `Deliver ${objective.minAmount.toLocaleString()} Resource Units`;
		default:
			return "Unknown objective";
	}
}
