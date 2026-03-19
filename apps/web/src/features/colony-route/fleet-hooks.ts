import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ResourceBucket, ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	normalizeShipCounts,
	selectShipCatalog,
} from "@nullvector/game-logic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { useSelfHealingFleetOperations } from "./fleet-operations-query";
import { type OperationTimelineRow, useColonyDevConsole } from "./route-shared";
import { type FleetMissionKind, type StarMapFleetTargetSelection } from "./star-map-picker-context";

export type PlannerCoords = {
	g: string;
	p: string;
	s: string;
	ss: string;
};

export const EMPTY_COORDS: PlannerCoords = {
	g: "",
	p: "",
	s: "",
	ss: "",
};

export const EMPTY_CARGO: ResourceBucket = {
	alloy: 0,
	crystal: 0,
	fuel: 0,
};

export const EMPTY_SHIP_COUNTS: Record<ShipKey, number> = {
	colonyShip: 0,
	cruiser: 0,
	bomber: 0,
	interceptor: 0,
	frigate: 0,
	largeCargo: 0,
	smallCargo: 0,
};

export type FleetDisplayShip = {
	available: number;
	cargoCapacity: number;
	cost: ResourceBucket;
	deployed: number;
	fuelDistanceRate: number;
	fuelLaunchCost: number;
	key: ShipKey;
	name: string;
	owned: number;
	requiredShipyardLevel: number;
	speed: number;
};

type FleetColonyTargetResolution = {
	ok: true;
	distance?: number;
	target: {
		colonyId: Id<"colonies">;
		kind: "colony";
	};
	targetPreview: {
		isOwnedByPlayer?: boolean;
		kind: "colony";
		label: string;
	};
};

type FleetPlanetTargetResolution = {
	ok: true;
	distance?: number;
	target: {
		kind: "planet";
		planetId: Id<"planets">;
	};
	targetPreview: {
		kind: "planet";
		label: string;
	};
};

type FleetInvalidTargetResolution = {
	ok: false;
	reason: string;
};

export type FleetTargetResolution =
	| FleetColonyTargetResolution
	| FleetPlanetTargetResolution
	| FleetInvalidTargetResolution
	| undefined;

export function parseAddressLabel(addressLabel: string): PlannerCoords | null {
	const match = addressLabel.match(/^G(\d+):S(\d+):SYS(\d+):P(\d+)$/);
	if (!match) {
		return null;
	}

	return {
		g: match[1] ?? "",
		s: match[2] ?? "",
		ss: match[3] ?? "",
		p: match[4] ?? "",
	};
}

function isIntegerText(value: string) {
	return /^\d+$/.test(value);
}

function cloneEmptyCoords(): PlannerCoords {
	return { ...EMPTY_COORDS };
}

function cloneEmptyCargo(): ResourceBucket {
	return { ...EMPTY_CARGO };
}

function cloneEmptyShipCounts(): Record<ShipKey, number> {
	return { ...EMPTY_SHIP_COUNTS };
}

export function useFleetRouteData(colonyId: Id<"colonies">) {
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const shipCatalog = useMemo(() => selectShipCatalog(), []);
	const garrison = useQuery(api.fleetV2.getFleetGarrison, isAuthenticated ? { colonyId } : "skip");
	const operations = useSelfHealingFleetOperations({ colonyId, isAuthenticated });
	const colonyNav = useQuery(api.colonyNav.getColonyNav, isAuthenticated ? { colonyId } : "skip");
	const devConsole = useColonyDevConsole(colonyId);
	const colonyResources = useColonyResources(isAuthenticated ? colonyId : null);
	const nowMs = colonyResources.nowMs;

	const activeOperations = useMemo(
		() => (operations?.active ?? []) as OperationTimelineRow[],
		[operations],
	);

	const ships = useMemo<FleetDisplayShip[]>(() => {
		if (!garrison) {
			return [];
		}

		const deployedByShip: Record<ShipKey, number> = {
			colonyShip: 0,
			cruiser: 0,
			bomber: 0,
			interceptor: 0,
			frigate: 0,
			largeCargo: 0,
			smallCargo: 0,
		};

		for (const operation of activeOperations) {
			if (operation.relation !== "outgoing") {
				continue;
			}
			deployedByShip.smallCargo += operation.shipCounts.smallCargo;
			deployedByShip.largeCargo += operation.shipCounts.largeCargo;
			deployedByShip.colonyShip += operation.shipCounts.colonyShip;
			deployedByShip.cruiser += operation.shipCounts.cruiser;
			deployedByShip.bomber += operation.shipCounts.bomber;
			deployedByShip.frigate += operation.shipCounts.frigate;
			deployedByShip.interceptor += operation.shipCounts.interceptor;
		}

		return shipCatalog.map((ship) => {
			const available = garrison.garrisonShips[ship.key] ?? 0;
			const deployed = deployedByShip[ship.key] ?? 0;

			return {
				...ship,
				available,
				deployed,
				owned: available + deployed,
			};
		});
	}, [activeOperations, garrison, shipCatalog]);

	const shipsByKey = useMemo(() => new Map(ships.map((ship) => [ship.key, ship])), [ships]);

	const fleetTotal = useMemo(() => ships.reduce((sum, ship) => sum + ship.owned, 0), [ships]);
	const fleetDeployed = useMemo(() => ships.reduce((sum, ship) => sum + ship.deployed, 0), [ships]);

	const availableResources = colonyResources.projected?.stored ?? null;
	const nonCurrentColonies = useMemo(
		() => colonyNav?.colonies.filter((colony) => colony.id !== colonyId) ?? [],
		[colonyId, colonyNav],
	);

	const ready =
		!isAuthLoading &&
		isAuthenticated &&
		Boolean(garrison && operations && colonyNav && colonyResources.projected);

	return {
		activeOperations,
		availableResources,
		canShowDevUi: devConsole.canShowDevUi,
		canUseDevConsole: devConsole.canUseDevConsole,
		colonyNav,
		colonyResources,
		devConsole,
		fleetDeployed,
		fleetTotal,
		garrison,
		isAuthLoading,
		isAuthenticated,
		nowMs,
		nonCurrentColonies,
		operations,
		ready,
		shipCatalog,
		ships,
		shipsByKey,
	};
}

export function useFleetPlannerState(args: {
	selectedTarget: StarMapFleetTargetSelection | null;
	consumedSelection: () => void;
}) {
	const [missionType, setMissionType] = useState<FleetMissionKind>("transport");
	const [roundTrip, setRoundTrip] = useState(true);
	const [coords, setCoords] = useState<PlannerCoords>(() => cloneEmptyCoords());
	const [selectedColonyId, setSelectedColonyId] = useState<string | null>(null);
	const [colonyPickerOpen, setColonyPickerOpen] = useState(false);
	const [cargo, setCargo] = useState<ResourceBucket>(() => cloneEmptyCargo());
	const [selectedShips, setSelectedShips] = useState<Record<ShipKey, number>>(() =>
		cloneEmptyShipCounts(),
	);
	const consumedSelectionRef = useRef(args.consumedSelection);

	useEffect(() => {
		consumedSelectionRef.current = args.consumedSelection;
	}, [args.consumedSelection]);

	useEffect(() => {
		if (!args.selectedTarget) {
			return;
		}

		if (args.selectedTarget.missionKind !== missionType) {
			consumedSelectionRef.current();
			return;
		}

		setCoords({
			g: String(args.selectedTarget.galaxyIndex),
			s: String(args.selectedTarget.sectorIndex),
			ss: String(args.selectedTarget.systemIndex),
			p: String(args.selectedTarget.planetIndex),
		});

		if (args.selectedTarget.colonyId) {
			setSelectedColonyId(args.selectedTarget.colonyId);
			setColonyPickerOpen(false);
		} else {
			setSelectedColonyId(null);
		}

		consumedSelectionRef.current();
	}, [args.selectedTarget, missionType]);

	function updateCoords(next: PlannerCoords) {
		setCoords(next);
	}

	function updateSelectedShips(shipKey: ShipKey, nextCount: number) {
		setSelectedShips((current) => ({
			...current,
			[shipKey]: nextCount,
		}));
	}

	function updateMissionType(nextMissionType: FleetMissionKind) {
		setMissionType(nextMissionType);
		setSelectedColonyId(null);
		if (nextMissionType === "colonize") {
			setRoundTrip(false);
			setColonyPickerOpen(false);
		} else {
			setRoundTrip(true);
		}
	}

	function resetPlannerState() {
		setCargo(cloneEmptyCargo());
		setSelectedShips(cloneEmptyShipCounts());
		setCoords(cloneEmptyCoords());
		setSelectedColonyId(null);
		setColonyPickerOpen(false);
		setRoundTrip(missionType !== "colonize");
	}

	return {
		cargo,
		colonyPickerOpen,
		coords,
		missionType,
		roundTrip,
		selectedColonyId,
		selectedShips,
		setCargo,
		setColonyPickerOpen,
		setCoords: updateCoords,
		setMissionType: updateMissionType,
		setRoundTrip,
		setSelectedColonyId,
		setSelectedShips,
		resetPlannerState,
		updateSelectedShips,
	};
}

export function useFleetPlannerDerived(args: {
	availableResources: ResourceBucket | null;
	colonyId: Id<"colonies">;
	cargo: ResourceBucket;
	coords: PlannerCoords;
	isAuthenticated: boolean;
	isLaunching: boolean;
	missionType: FleetMissionKind;
	roundTrip: boolean;
	selectedShips: Record<ShipKey, number>;
}) {
	const parsedCoords = useMemo(() => {
		if (
			!isIntegerText(args.coords.g) ||
			!isIntegerText(args.coords.s) ||
			!isIntegerText(args.coords.ss) ||
			!isIntegerText(args.coords.p)
		) {
			return null;
		}

		return {
			galaxyIndex: Number(args.coords.g),
			sectorIndex: Number(args.coords.s),
			systemIndex: Number(args.coords.ss),
			planetIndex: Number(args.coords.p),
		};
	}, [args.coords]);

	const targetResolution = useQuery(
		api.fleetV2.resolveFleetTarget,
		args.isAuthenticated && parsedCoords
			? {
					originColonyId: args.colonyId,
					missionKind: args.missionType,
					...parsedCoords,
				}
			: "skip",
	) as FleetTargetResolution;

	const selectedShipCounts = useMemo(
		() => normalizeShipCounts(args.selectedShips),
		[args.selectedShips],
	);
	const hasShips = useMemo(
		() => Object.values(selectedShipCounts).some((value) => value > 0),
		[selectedShipCounts],
	);
	const cargoCapacity = useMemo(
		() => getFleetCargoCapacity(selectedShipCounts),
		[selectedShipCounts],
	);
	const cargoUsed = args.cargo.alloy + args.cargo.crystal + args.cargo.fuel;
	const distance = targetResolution?.ok ? (targetResolution.distance ?? 0) : 0;
	const slowestSpeed = getFleetSlowestSpeed(selectedShipCounts);
	const oneWaySeconds =
		hasShips && slowestSpeed > 0 && distance > 0
			? Math.max(30, Math.ceil((distance / slowestSpeed) * 3_600))
			: 0;
	const oneWayFuelCost = hasShips
		? getFleetFuelCostForDistance({ distance, shipCounts: selectedShipCounts })
		: 0;
	const travelFuelCost =
		args.missionType === "transport" && args.roundTrip ? oneWayFuelCost * 2 : oneWayFuelCost;

	const requiredResources = {
		alloy: args.cargo.alloy,
		crystal: args.cargo.crystal,
		fuel: args.cargo.fuel + travelFuelCost,
	};

	const hasResources =
		Boolean(args.availableResources) &&
		(args.availableResources?.alloy ?? 0) >= requiredResources.alloy &&
		(args.availableResources?.crystal ?? 0) >= requiredResources.crystal &&
		(args.availableResources?.fuel ?? 0) >= requiredResources.fuel;

	const supportsStationing = Boolean(
		args.missionType === "transport" &&
		targetResolution?.ok &&
		targetResolution.targetPreview?.kind === "colony" &&
		targetResolution.targetPreview.isOwnedByPlayer === true,
	);

	// Transport missions must keep `selectedShipCounts.colonyShip` at 0, while colonize
	// missions require exactly 1 colony ship, so `missionShipConstraint` tracks both rules.
	const missionShipConstraint =
		args.missionType === "transport"
			? selectedShipCounts.colonyShip === 0
			: selectedShipCounts.colonyShip === 1;

	const canLaunch = Boolean(
		hasShips &&
		cargoUsed <= cargoCapacity &&
		missionShipConstraint &&
		hasResources &&
		Boolean(targetResolution?.ok && targetResolution.target) &&
		(args.missionType !== "transport" || args.roundTrip || supportsStationing) &&
		!args.isLaunching,
	);

	const launchCtaLabel = (() => {
		if (args.isLaunching) {
			return "Launching...";
		}
		if (!hasShips) {
			return "Assign Ships";
		}
		if (!parsedCoords) {
			return "Set Destination";
		}
		if (!targetResolution?.ok) {
			return "Invalid Destination";
		}
		if (!missionShipConstraint) {
			return args.missionType === "transport" ? "Remove Colony Ship" : "Need 1 Colony Ship";
		}
		if (cargoUsed > cargoCapacity) {
			return "Reduce Cargo";
		}
		if (!hasResources) {
			return "Insufficient Resources";
		}
		if (args.missionType === "transport" && !args.roundTrip && !supportsStationing) {
			return "Choose Own Colony";
		}
		return "Launch Expedition";
	})();

	return {
		canLaunch,
		cargoCapacity,
		cargoUsed,
		distance,
		hasResources,
		hasShips,
		launchCtaLabel,
		missionShipConstraint,
		oneWaySeconds,
		oneWayFuelCost,
		parsedCoords,
		requiredResources,
		selectedShipCounts,
		slowestSpeed,
		supportsStationing,
		targetResolution,
		travelFuelCost,
	};
}

export function useFleetOperationsActions(args: {
	colonyId: Id<"colonies">;
	completeActiveMission: (input: {
		colonyId: Id<"colonies">;
		operationId: Id<"fleetOperations">;
	}) => Promise<unknown>;
}) {
	const createOperation = useMutation(api.fleetV2.createOperation);
	const cancelOperation = useMutation(api.fleetV2.cancelOperation);
	const [isLaunching, setIsLaunching] = useState(false);
	const [cancelingOperationId, setCancelingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);
	const [completingOperationId, setCompletingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);

	async function launchOperation(next: {
		cargoRequested: ResourceBucket;
		kind: FleetMissionKind;
		onSuccess?: () => void;
		originColonyId: Id<"colonies">;
		postDeliveryAction?: "returnToOrigin" | "stationAtDestination";
		resetPlanner?: () => void;
		shipCounts: Record<ShipKey, number>;
		target: NonNullable<Parameters<typeof createOperation>[0]["target"]>;
	}) {
		setIsLaunching(true);
		try {
			await createOperation({
				originColonyId: next.originColonyId,
				kind: next.kind,
				target: next.target,
				shipCounts: next.shipCounts,
				cargoRequested: next.cargoRequested,
				postDeliveryAction: next.postDeliveryAction,
			});
			toast.success("Expedition launched");
			next.resetPlanner?.();
			next.onSuccess?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to launch expedition");
		} finally {
			setIsLaunching(false);
		}
	}

	async function cancelMissionOperation(operationId: Id<"fleetOperations">) {
		setCancelingOperationId(operationId);
		try {
			await cancelOperation({ operationId });
			toast.success("Operation cancelled; fleet is returning");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel operation");
		} finally {
			setCancelingOperationId(null);
		}
	}

	async function completeMission(operationId: Id<"fleetOperations">) {
		setCompletingOperationId(operationId);
		try {
			await args.completeActiveMission({
				colonyId: args.colonyId,
				operationId,
			});
			toast.success("Operation completed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete operation");
		} finally {
			setCompletingOperationId(null);
		}
	}

	return {
		cancelMissionOperation,
		cancelingOperationId,
		completeMission,
		completingOperationId,
		isLaunching,
		launchOperation,
		setIsLaunching,
	};
}
