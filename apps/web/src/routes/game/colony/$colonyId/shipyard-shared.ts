import type { ShipKey } from "@nullvector/game-logic";

const SHIP_KEY_TO_SLUG: Record<ShipKey, string> = {
	bomber: "bomber",
	colonyShip: "colony-ship",
	cruiser: "cruiser",
	frigate: "frigate",
	interceptor: "interceptor",
	largeCargo: "large-cargo",
	smallCargo: "small-cargo",
};

export function getShipImagePath(shipKey: ShipKey): string {
	return `/game-icons/ships/${SHIP_KEY_TO_SLUG[shipKey]}.png`;
}

export type ShipGroup = {
	keys: ShipKey[];
	label: string;
};

export const SHIP_GROUPS: ShipGroup[] = [
	{ label: "Cargo", keys: ["smallCargo", "largeCargo"] },
	{ label: "Combat", keys: ["interceptor", "frigate", "cruiser", "bomber"] },
	{ label: "Utility", keys: ["colonyShip"] },
];
