import type {
	BuildingKey,
	BuildingUpgradeQueuePayload,
	DefenseBuildQueuePayload,
	DefenseKey,
	FacilityKey,
	FacilityUpgradeQueuePayload,
	QueueItemStatus,
	ResourceBucket,
	ShipBuildQueuePayload,
	ShipKey,
} from "@nullvector/game-logic";

export type QueueRow<TKind extends string, TPayload> = {
	completesAt: number;
	id?: string;
	kind: TKind;
	payload: TPayload;
	startsAt?: number;
	status?: QueueItemStatus;
};

export type BuildingQueueRow = QueueRow<"buildingUpgrade", BuildingUpgradeQueuePayload>;
export type FacilityQueueRow = QueueRow<"facilityUpgrade", FacilityUpgradeQueuePayload>;
export type ShipBuildQueueRow = QueueRow<"shipBuild", ShipBuildQueuePayload>;
export type DefenseBuildQueueRow = QueueRow<"defenseBuild", DefenseBuildQueuePayload>;
export type BuildingLaneQueueRow = BuildingQueueRow | FacilityQueueRow;

export const BUILDING_KEY_LABELS: Record<BuildingKey, string> = {
	alloyMineLevel: "Alloy Mine",
	alloyStorageLevel: "Alloy Storage",
	crystalMineLevel: "Crystal Mine",
	crystalStorageLevel: "Crystal Storage",
	fuelRefineryLevel: "Fuel Refinery",
	fuelStorageLevel: "Fuel Storage",
	powerPlantLevel: "Power Plant",
};

export const FACILITY_KEY_LABELS: Record<FacilityKey, string> = {
	defense_grid: "Defense Grid",
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
};

export const SHIP_KEY_LABELS: Record<ShipKey, string> = {
	bomber: "Bomber",
	colonyShip: "Colony Ship",
	cruiser: "Cruiser",
	frigate: "Frigate",
	interceptor: "Interceptor",
	largeCargo: "Large Cargo",
	smallCargo: "Small Cargo",
};

export const DEFENSE_KEY_LABELS: Record<DefenseKey, string> = {
	gaussCannon: "Gauss Cannon",
	laserTurret: "Laser Turret",
	missileBattery: "Missile Battery",
	shieldDome: "Shield Dome",
};

export function isBuildingQueueRow(item: { kind: string; payload: unknown }): item is BuildingQueueRow {
	return (
		item.kind === "buildingUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"buildingKey" in item.payload
	);
}

export function isFacilityQueueRow(item: { kind: string; payload: unknown }): item is FacilityQueueRow {
	return (
		item.kind === "facilityUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"facilityKey" in item.payload
	);
}

export function isBuildingLaneQueueRow(
	item: { kind: string; payload: unknown },
): item is BuildingLaneQueueRow {
	return isBuildingQueueRow(item) || isFacilityQueueRow(item);
}

export function isShipBuildQueueRow(item: { kind: string; payload: unknown }): item is ShipBuildQueueRow {
	return (
		item.kind === "shipBuild" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"shipKey" in item.payload
	);
}

export function isDefenseBuildQueueRow(
	item: { kind: string; payload: unknown },
): item is DefenseBuildQueueRow {
	return (
		item.kind === "defenseBuild" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"defenseKey" in item.payload
	);
}

export function getBuildingLaneItemLabel(item: BuildingLaneQueueRow) {
	return item.kind === "buildingUpgrade"
		? (BUILDING_KEY_LABELS[item.payload.buildingKey] ?? item.payload.buildingKey)
		: (FACILITY_KEY_LABELS[item.payload.facilityKey] ?? item.payload.facilityKey);
}

export function getQueueBuildResourceLabel(refunded: ResourceBucket) {
	return `${refunded.alloy.toLocaleString()} alloy, ${refunded.crystal.toLocaleString()} crystal, ${refunded.fuel.toLocaleString()} fuel`;
}
