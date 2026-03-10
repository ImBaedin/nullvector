import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	getFleetCargoCapacity,
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	normalizeShipCounts,
	type ResourceBucket,
	type ShipKey,
} from "@nullvector/game-logic";
import { createFileRoute } from "@tanstack/react-router";
import {
	Check,
	ChevronDown,
	Clock3,
	Crosshair,
	Globe2,
	Layers3,
	MapPin,
	Minus,
	Package,
	Plus,
	Rocket,
	RotateCcw,
	Ship,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { FleetRouteSkeleton } from "./loading-skeletons";
import { formatDuration } from "./shipyard-mock-shared";
import { useColonyStarMapPicker, type FleetMissionKind } from "./star-map-picker-context";

export const Route = createFileRoute("/game/colony/$colonyId/fleet")({
	component: FleetRoute,
});

type FleetOperationRow = {
	id: Id<"fleetOperations">;
	kind: "transport" | "colonize" | "contract" | "combat";
	status: "planned" | "inTransit" | "atTarget" | "returning" | "completed" | "cancelled" | "failed";
	relation: "incoming" | "outgoing";
	originName: string;
	originAddressLabel: string;
	targetPreview: {
		kind: "colony" | "planet";
		label: string;
	};
	shipCounts: Record<ShipKey, number>;
	cargoRequested: ResourceBucket;
	postDeliveryAction?: "returnToOrigin" | "stationAtDestination";
	departAt: number;
	arriveAt: number;
	canCancel: boolean;
};

type PlannerCoords = {
	g: string;
	p: string;
	s: string;
	ss: string;
};

const EMPTY_COORDS: PlannerCoords = {
	g: "",
	p: "",
	s: "",
	ss: "",
};

const EMPTY_CARGO: ResourceBucket = {
	alloy: 0,
	crystal: 0,
	fuel: 0,
};

const EMPTY_SHIP_COUNTS: Record<ShipKey, number> = {
	colonyShip: 0,
	largeCargo: 0,
	smallCargo: 0,
};

function parseAddressLabel(addressLabel: string): PlannerCoords | null {
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

function FleetRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const { consumedSelection, openPicker, selectedTarget } = useColonyStarMapPicker();

	const shipCatalog = useQuery(api.shipyard.getShipCatalog, isAuthenticated ? {} : "skip");
	const garrison = useQuery(
		api.fleetV2.getFleetGarrison,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const operations = useQuery(
		api.fleetV2.getFleetOperationsForColony,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyNav = useQuery(
		api.colonyNav.getColonyNav,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(isAuthenticated ? colonyIdAsId : null);

	const createOperation = useMutation(api.fleetV2.createOperation);
	const cancelOperation = useMutation(api.fleetV2.cancelOperation);
	const completeActiveMission = useMutation(api.devConsole.completeActiveMission);

	const [expandedOp, setExpandedOp] = useState<string | null>(null);
	const [missionType, setMissionType] = useState<FleetMissionKind>("transport");
	const [roundTrip, setRoundTrip] = useState(true);
	const [coords, setCoords] = useState<PlannerCoords>(EMPTY_COORDS);
	const [selectedColonyId, setSelectedColonyId] = useState<string | null>(null);
	const [colonyPickerOpen, setColonyPickerOpen] = useState(false);
	const [cargo, setCargo] = useState<ResourceBucket>(EMPTY_CARGO);
	const [selectedShips, setSelectedShips] = useState<Record<ShipKey, number>>(EMPTY_SHIP_COUNTS);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [isLaunching, setIsLaunching] = useState(false);
	const [cancelingOperationId, setCancelingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);
	const [completingOperationId, setCompletingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);

		return () => {
			window.clearInterval(tick);
		};
	}, [isAuthenticated]);

	useEffect(() => {
		if (!selectedTarget) {
			return;
		}

		if (selectedTarget.missionKind !== missionType) {
			consumedSelection();
			return;
		}

		setCoords({
			g: String(selectedTarget.galaxyIndex),
			s: String(selectedTarget.sectorIndex),
			ss: String(selectedTarget.systemIndex),
			p: String(selectedTarget.planetIndex),
		});

		if (selectedTarget.colonyId) {
			setSelectedColonyId(selectedTarget.colonyId);
			setColonyPickerOpen(false);
		} else {
			setSelectedColonyId(null);
		}

		consumedSelection();
	}, [consumedSelection, missionType, selectedTarget]);

	const ready =
		!isAuthLoading &&
		isAuthenticated &&
		Boolean(shipCatalog && garrison && operations && colonyNav && colonyResources.projected);
	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;

	const parsedCoords = useMemo(() => {
		if (
			!isIntegerText(coords.g) ||
			!isIntegerText(coords.s) ||
			!isIntegerText(coords.ss) ||
			!isIntegerText(coords.p)
		) {
			return null;
		}

		return {
			galaxyIndex: Number(coords.g),
			sectorIndex: Number(coords.s),
			systemIndex: Number(coords.ss),
			planetIndex: Number(coords.p),
		};
	}, [coords.g, coords.p, coords.s, coords.ss]);

	const targetResolution = useQuery(
		api.fleetV2.resolveFleetTarget,
		isAuthenticated && parsedCoords
			? {
					originColonyId: colonyIdAsId,
					missionKind: missionType,
					...parsedCoords,
				}
			: "skip",
	);

	if (isAuthLoading || (isAuthenticated && !ready)) {
		return <FleetRouteSkeleton />;
	}

	if (!ready || !shipCatalog || !garrison || !operations || !colonyNav || !colonyResources.projected) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load fleet. Please sign in again.
			</div>
		);
	}

	const deployedByShip: Record<ShipKey, number> = {
		colonyShip: 0,
		largeCargo: 0,
		smallCargo: 0,
	};

	for (const operation of operations.active) {
		if (operation.relation !== "outgoing") {
			continue;
		}
		deployedByShip.smallCargo += operation.shipCounts.smallCargo;
		deployedByShip.largeCargo += operation.shipCounts.largeCargo;
		deployedByShip.colonyShip += operation.shipCounts.colonyShip;
	}

	const ships = shipCatalog.ships.map((ship) => {
		const available = garrison.garrisonShips[ship.key] ?? 0;
		const deployed = deployedByShip[ship.key] ?? 0;
		return {
			...ship,
			available,
			deployed,
			owned: available + deployed,
		};
	});

	const shipsByKey = new Map(ships.map((ship) => [ship.key, ship]));
	const fleetTotal = ships.reduce((sum, ship) => sum + ship.owned, 0);
	const fleetDeployed = ships.reduce((sum, ship) => sum + ship.deployed, 0);

	const selectedShipCounts = normalizeShipCounts(selectedShips);
	const hasShips = Object.values(selectedShipCounts).some((value) => value > 0);
	const cargoCapacity = getFleetCargoCapacity(selectedShipCounts);
	const cargoUsed = cargo.alloy + cargo.crystal + cargo.fuel;
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
		missionType === "transport" && roundTrip ? oneWayFuelCost * 2 : oneWayFuelCost;

	const requiredResources = {
		alloy: cargo.alloy,
		crystal: cargo.crystal,
		fuel: cargo.fuel + travelFuelCost,
	};

	const availableResources = colonyResources.projected.stored;
	const hasResources =
		availableResources.alloy >= requiredResources.alloy &&
		availableResources.crystal >= requiredResources.crystal &&
		availableResources.fuel >= requiredResources.fuel;

	const supportsStationing = Boolean(
		missionType === "transport" &&
		targetResolution?.ok &&
		targetResolution.targetPreview?.kind === "colony" &&
		targetResolution.targetPreview.isOwnedByPlayer === true,
	);

	const missionShipConstraint =
		missionType === "transport"
			? selectedShipCounts.colonyShip === 0
			: selectedShipCounts.colonyShip === 1;

	const canLaunch = Boolean(
		hasShips &&
		cargoUsed <= cargoCapacity &&
		missionShipConstraint &&
		hasResources &&
		Boolean(targetResolution?.ok && targetResolution.target) &&
		(missionType !== "transport" || roundTrip || supportsStationing) &&
		!isLaunching,
	);
	const launchCtaLabel = (() => {
		if (isLaunching) {
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
			return missionType === "transport" ? "Remove Colony Ship" : "Need 1 Colony Ship";
		}
		if (cargoUsed > cargoCapacity) {
			return "Reduce Cargo";
		}
		if (!hasResources) {
			return "Insufficient Resources";
		}
		if (missionType === "transport" && !roundTrip && !supportsStationing) {
			return "Choose Own Colony";
		}
		return "Launch Expedition";
	})();

	const nonCurrentColonies = colonyNav.colonies.filter((colony) => colony.id !== colonyId);

	const launch = async () => {
		if (!targetResolution?.ok || !targetResolution.target) {
			toast.error(targetResolution?.reason ?? "Select a valid destination");
			return;
		}

		if (!canLaunch) {
			toast.error("Expedition requirements are not met");
			return;
		}

		setIsLaunching(true);
		try {
			await createOperation({
				originColonyId: colonyIdAsId,
				kind: missionType,
				target: targetResolution.target,
				shipCounts: selectedShipCounts,
				cargoRequested: cargo,
				postDeliveryAction:
					missionType === "transport"
						? roundTrip
							? "returnToOrigin"
							: "stationAtDestination"
						: undefined,
			});
			toast.success("Expedition launched");
			setSelectedShips(EMPTY_SHIP_COUNTS);
			setCargo(EMPTY_CARGO);
			if (missionType === "transport") {
				setRoundTrip(true);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to launch expedition");
		} finally {
			setIsLaunching(false);
		}
	};

	const handleCancel = async (operationId: Id<"fleetOperations">) => {
		setCancelingOperationId(operationId);
		try {
			await cancelOperation({ operationId });
			toast.success("Operation cancelled; fleet is returning");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel operation");
		} finally {
			setCancelingOperationId(null);
		}
	};

	const handleComplete = async (operationId: Id<"fleetOperations">) => {
		setCompletingOperationId(operationId);
		try {
			await completeActiveMission({
				colonyId: colonyIdAsId,
				operationId,
			});
			toast.success("Operation completed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete operation");
		} finally {
			setCompletingOperationId(null);
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_450px]
    "
			>
				<div className="space-y-5">
					<ActiveOperationsPanel
						cancelingOperationId={cancelingOperationId}
						canShowDevUi={canShowDevUi}
						canUseDevConsole={devConsoleState?.canUseDevConsole === true}
						completingOperationId={completingOperationId}
						expandedOp={expandedOp}
						nowMs={nowMs}
						onCancel={handleCancel}
						onComplete={handleComplete}
						onToggle={(operationId) =>
							setExpandedOp((current) => (current === operationId ? null : operationId))
						}
						operations={operations.active}
						shipsByKey={shipsByKey}
					/>

					<FleetSummaryStrip fleetDeployed={fleetDeployed} fleetTotal={fleetTotal} ships={ships} />
				</div>

				<MissionPlannerPanel
					availableResources={availableResources}
					canLaunch={canLaunch}
					cargo={cargo}
					cargoCapacity={cargoCapacity}
					cargoUsed={cargoUsed}
					colonyPickerOpen={colonyPickerOpen}
					coords={coords}
					distance={distance}
					hasShips={hasShips}
					missionType={missionType}
					nonCurrentColonies={nonCurrentColonies}
					oneWaySeconds={oneWaySeconds}
					roundTrip={roundTrip}
					selectedColonyId={selectedColonyId}
					selectedShips={selectedShipCounts}
					ships={ships}
					slowestSpeed={slowestSpeed}
					supportsStationing={supportsStationing}
					targetResolution={targetResolution}
					travelFuelCost={travelFuelCost}
					launchCtaLabel={launchCtaLabel}
					onCargoChange={setCargo}
					onCoordsChange={setCoords}
					onLaunch={launch}
					onMissionTypeChange={(nextMissionType) => {
						setMissionType(nextMissionType);
						setSelectedColonyId(null);
						if (nextMissionType === "colonize") {
							setRoundTrip(false);
							setColonyPickerOpen(false);
						} else {
							setRoundTrip(true);
						}
					}}
					onOpenMapPicker={() =>
						openPicker({
							missionKind: missionType,
							originColonyId: colonyIdAsId,
						})
					}
					onRoundTripChange={setRoundTrip}
					onSelectColony={(nextColonyId) => {
						const colony = nonCurrentColonies.find((entry) => entry.id === nextColonyId);
						if (!colony) {
							return;
						}
						const parsed = parseAddressLabel(colony.addressLabel);
						if (!parsed) {
							toast.error("Unable to parse colony coordinates");
							return;
						}
						setCoords(parsed);
						setSelectedColonyId(colony.id);
						setColonyPickerOpen(false);
					}}
					onSetColonyPickerOpen={setColonyPickerOpen}
					onSetSelectedColonyId={setSelectedColonyId}
					onShipCountChange={(shipKey, nextCount) => {
						const ship = shipsByKey.get(shipKey);
						if (!ship) {
							return;
						}
						const clamped = Math.max(0, Math.min(ship.available, Math.floor(nextCount)));
						setSelectedShips((current) => ({
							...current,
							[shipKey]: clamped,
						}));
					}}
				/>
			</div>
		</div>
	);
}

function ActiveOperationsPanel(props: {
	cancelingOperationId: Id<"fleetOperations"> | null;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	completingOperationId: Id<"fleetOperations"> | null;
	expandedOp: string | null;
	nowMs: number;
	onCancel: (operationId: Id<"fleetOperations">) => void;
	onComplete: (operationId: Id<"fleetOperations">) => void;
	onToggle: (operationId: string) => void;
	operations: FleetOperationRow[];
	shipsByKey: Map<
		ShipKey,
		{
			name: string;
		}
	>;
}) {
	if (props.operations.length === 0) {
		return (
			<div>
				<h2
					className="
       flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
       font-bold
     "
				>
					<Layers3 className="size-4 text-cyan-300/60" />
					Active Expeditions
				</h2>
				<div
					className="
       mt-3 rounded-xl border border-white/10 bg-white/2 px-4 py-6 text-center
       text-xs text-white/45
     "
				>
					No active expeditions.
				</div>
			</div>
		);
	}

	return (
		<div>
			<h2
				className="
      flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
      font-bold
    "
			>
				<Layers3 className="size-4 text-cyan-300/60" />
				Active Expeditions
			</h2>

			<div className="mt-3 space-y-2">
				{props.operations.map((operation) => {
					const totalDuration = Math.max(1, operation.arriveAt - operation.departAt);
					const elapsed = Math.max(0, props.nowMs - operation.departAt);
					const progress = Math.min(100, (elapsed / totalDuration) * 100);
					const etaSeconds = Math.max(0, Math.ceil((operation.arriveAt - props.nowMs) / 1_000));
					const totalCargo =
						operation.cargoRequested.alloy +
						operation.cargoRequested.crystal +
						operation.cargoRequested.fuel;
					const isExpanded = props.expandedOp === operation.id;
					const isReturning = operation.status === "returning";

					return (
						<div
							className="
         overflow-hidden rounded-xl border border-white/10
         bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
       "
							key={operation.id}
						>
							<button
								className="
          flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors
          hover:bg-white/2
        "
								onClick={() => props.onToggle(operation.id)}
								type="button"
							>
								<span className={`
          inline-block size-2 shrink-0 rounded-full
          ${isReturning ? "bg-amber-400" : "bg-cyan-400"}
        `} />
								<span className="min-w-0 shrink-0 text-xs font-semibold">
									{operation.targetPreview.label}
								</span>
								<span className={`
          shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase
          ${isReturning ? "bg-amber-400/12 text-amber-200/80" : `
             bg-cyan-400/12 text-cyan-200/80
           `}
        `}>{isReturning ? "Returning" : operation.kind}</span>
								<span className={`
          shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase
          ${operation.relation === "incoming" ? `
             border border-amber-300/20 bg-amber-300/10 text-amber-100/80
           ` : `
             border border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80
           `}
        `}>{operation.relation}</span>

								<div
									className="
           mx-1 hidden h-1 min-w-[60px] flex-1 overflow-hidden rounded-full
           bg-white/8
           sm:block
         "
								>
									<div className={`
           h-full rounded-full
           ${isReturning ? "bg-amber-400/50" : "bg-cyan-400/50"}
         `} style={{ width: `${progress}%` }} />
								</div>

								<span
									className="
           shrink-0 font-(family-name:--nv-font-mono) text-[10px] text-white/35
         "
								>
									{Math.round(progress)}%
								</span>

								<div
									className="flex shrink-0 items-center gap-1 text-[10px] text-white/45"
								>
									<Clock3 className="size-3" />
									<span
										className="
            font-(family-name:--nv-font-mono) font-semibold text-cyan-100
          "
									>
										{formatDuration(etaSeconds)}
									</span>
								</div>

								<ChevronDown className={`
          ml-auto size-3.5 shrink-0 text-white/25 transition-transform
          ${isExpanded ? "rotate-180" : ""}
        `} />
							</button>

							<div
								className="
          grid transition-[grid-template-rows] duration-300
          ease-[cubic-bezier(0.25,0.8,0.25,1)]
        "
								style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
							>
								<div className="overflow-hidden">
									<div className="border-t border-white/6">
										<div className="flex items-start px-5 pt-5 pb-8">
											<div
												className="z-10 w-[100px] shrink-0 text-center"
												style={
													isExpanded
														? {
																animation:
																	"nv-fleet-node-in 360ms cubic-bezier(0.21,1,0.34,1) both",
																animationDelay: "60ms",
															}
														: { opacity: 0 }
												}
											>
												<div
													className="
               mx-auto flex size-10 items-center justify-center rounded-full
               border border-cyan-300/25 bg-cyan-400/10
             "
												>
													<MapPin className="size-4 text-cyan-300" />
												</div>
												<p className="mt-1.5 truncate text-[11px] font-semibold">
													{operation.originName}
												</p>
												<p
													className="
               truncate font-(family-name:--nv-font-mono) text-[9px]
               text-white/30
             "
												>
													{operation.originAddressLabel}
												</p>
											</div>

											<div className="relative z-0 -mx-2 mt-5 min-w-[40px] flex-1">
												<div className="h-px bg-white/10" />
												<div
													className={`
               absolute top-0 h-px
               ${
									isReturning
										? "bg-linear-to-r from-amber-400/60 to-amber-400/20"
										: "bg-linear-to-r from-cyan-400/60 to-cyan-400/20"
								}
             `}
													style={
														isExpanded
															? {
																	width: `${progress}%`,
																	animation:
																		"nv-fleet-line-draw 500ms cubic-bezier(0.21,1,0.34,1) both",
																	animationDelay: "140ms",
																}
															: { width: 0, opacity: 0 }
													}
												/>
												<div
													className="absolute -top-3 flex flex-col items-center"
													style={
														isExpanded
															? {
																	left: `calc(${progress}% - 12px)`,
																	animation:
																		"nv-fleet-ship-in 400ms cubic-bezier(0.21,1,0.34,1) both",
																	animationDelay: "280ms",
																}
															: {
																	left: `calc(${progress}% - 12px)`,
																	opacity: 0,
																}
													}
												>
													<div className={`
               flex size-6 items-center justify-center rounded-full border-2
               shadow-lg
               ${isReturning ? `
                  border-amber-300 bg-amber-400/20 shadow-amber-400/30
                ` : `
                  border-cyan-300 bg-cyan-400/20 shadow-cyan-400/30
                `}
             `}>
														<Ship className={`
                size-3
                ${isReturning ? "rotate-180 text-amber-300" : "text-cyan-300"}
              `} />
													</div>
													<span
														className="
                mt-0.5 font-(family-name:--nv-font-mono) text-[8px]
                text-white/30
              "
													>
														{Math.round(progress)}%
													</span>
												</div>
											</div>

											<div
												className="z-10 w-[100px] shrink-0 text-center"
												style={
													isExpanded
														? {
																animation:
																	"nv-fleet-node-in 360ms cubic-bezier(0.21,1,0.34,1) both",
																animationDelay: "180ms",
															}
														: { opacity: 0 }
												}
											>
												<div className={`
              mx-auto flex size-10 items-center justify-center rounded-full
              border
              ${operation.kind === "colonize" ? `
                 border-amber-300/25 bg-amber-400/10
               ` : `
                 border-cyan-300/25 bg-cyan-400/10
               `}
            `}>{operation.kind === "colonize" ? <Globe2 className="
               size-4 text-amber-300
             " /> : <MapPin className="
               size-4 text-cyan-300
             " />}</div>
												{(() => {
													const m = operation.targetPreview.label.match(/^(.+?)\s*\(([^)]+)\)$/);
													if (m) {
														return (
															<>
																<p className="mt-1.5 truncate text-[11px] font-semibold">{m[1]}</p>
																<p
																	className="
                   truncate font-(family-name:--nv-font-mono) text-[9px]
                   text-white/30
                 "
																>
																	{m[2]}
																</p>
															</>
														);
													}
													return (
														<p className="mt-1.5 truncate text-[11px] font-semibold">
															{operation.targetPreview.label}
														</p>
													);
												})()}
											</div>
										</div>

										<div
											className="
             flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/6
             px-5 py-3 text-[10px] text-white/45
           "
											style={
												isExpanded
													? {
															animation: "nv-fleet-chips-in 350ms cubic-bezier(0.21,1,0.34,1) both",
															animationDelay: "320ms",
														}
													: { opacity: 0 }
											}
										>
											<div
												className="
              rounded-sm border border-white/10 bg-white/3 px-1.5 py-0.5
              text-[9px] font-semibold uppercase
            "
											>
												{operation.relation}
											</div>
											<div className="flex items-center gap-1">
												<Ship className="size-3" />
												{Object.entries(operation.shipCounts)
													.filter(([, count]) => count > 0)
													.map(
														([shipKey, count]) =>
															`${count}x ${props.shipsByKey.get(shipKey as ShipKey)?.name ?? shipKey}`,
													)
													.join(", ")}
											</div>
											{totalCargo > 0 ? (
												<div className="flex items-center gap-1">
													<Package className="size-3" />
													{totalCargo.toLocaleString()} cargo
												</div>
											) : null}
											{operation.postDeliveryAction === "returnToOrigin" ? (
												<div className="flex items-center gap-1">
													<RotateCcw className="size-3" />
													Round trip
												</div>
											) : null}
											<span
												className="
              font-(family-name:--nv-font-mono) text-[10px] text-white/30
            "
											>
												{operation.status}
											</span>

											{operation.canCancel ? (
												<button
													className="
               ml-auto inline-flex items-center gap-1 rounded-md border
               border-rose-300/20 bg-rose-400/8 px-2.5 py-1 text-[10px]
               font-medium text-rose-200/80 transition-colors
               hover:border-rose-200/35 hover:bg-rose-400/12
             "
													disabled={props.cancelingOperationId === operation.id}
													onClick={(event) => {
														event.stopPropagation();
														props.onCancel(operation.id);
													}}
													type="button"
												>
													<X className="size-3" />
													Cancel
												</button>
											) : null}
											{props.canShowDevUi ? (
												<button
													className="
               inline-flex items-center gap-1 rounded-md border
               border-cyan-300/20 bg-cyan-400/8 px-2.5 py-1 text-[10px]
               font-medium text-cyan-100 transition-colors
               hover:border-cyan-200/35 hover:bg-cyan-400/12
               disabled:cursor-not-allowed disabled:opacity-50
             "
													disabled={
														props.completingOperationId === operation.id || !props.canUseDevConsole
													}
													onClick={(event) => {
														event.stopPropagation();
														props.onComplete(operation.id);
													}}
													type="button"
												>
													{props.completingOperationId === operation.id
														? "Completing..."
														: "Complete"}
												</button>
											) : null}
										</div>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function FleetSummaryStrip(props: {
	fleetDeployed: number;
	fleetTotal: number;
	ships: Array<{
		available: number;
		deployed: number;
		key: ShipKey;
		name: string;
		owned: number;
	}>;
}) {
	return (
		<div
			className="
     rounded-2xl border border-white/10
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))] p-4
   "
		>
			<div className="flex items-center gap-3">
				<div
					className="
       flex size-8 items-center justify-center rounded-lg border
       border-cyan-300/25 bg-cyan-400/8
     "
				>
					<Ship className="size-4 text-cyan-300" />
				</div>
				<div>
					<h1 className="font-(family-name:--nv-font-display) text-lg font-bold">Fleet</h1>
					<p className="text-[10px] text-white/40">
						{props.fleetTotal} ships • {props.fleetDeployed} deployed •{" "}
						{props.fleetTotal - props.fleetDeployed} available
					</p>
				</div>
			</div>

			<div className="mt-4 flex gap-3 overflow-x-auto pb-1">
				{props.ships.map((ship) => (
					<div
						className="
        flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border
        border-white/8 bg-white/2.5 p-3
      "
						key={ship.key}
					>
						<img
							alt={ship.name}
							className="
         size-12 rounded-lg border border-white/8 bg-black/30 object-contain p-1
       "
							src={`/game-icons/ships/${
								ship.key === "smallCargo"
									? "small-cargo"
									: ship.key === "largeCargo"
										? "large-cargo"
										: "colony-ship"
							}.png`}
						/>
						<div className="min-w-0">
							<p className="text-sm font-semibold">{ship.name}</p>
							<div className="mt-0.5 flex gap-2 text-[10px]">
								<span className="text-emerald-300/70">{ship.available} avail</span>
								<span className="text-white/30">|</span>
								<span className="text-cyan-200/50">{ship.deployed} out</span>
							</div>
							<div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8">
								<div
									className="h-full rounded-full bg-cyan-400/40"
									style={{
										width: `${ship.owned > 0 ? (ship.deployed / ship.owned) * 100 : 0}%`,
									}}
								/>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function MissionPlannerPanel(props: {
	availableResources: ResourceBucket;
	canLaunch: boolean;
	cargo: ResourceBucket;
	cargoCapacity: number;
	cargoUsed: number;
	colonyPickerOpen: boolean;
	coords: PlannerCoords;
	distance: number;
	hasShips: boolean;
	missionType: FleetMissionKind;
	nonCurrentColonies: Array<{ addressLabel: string; id: string; name: string }>;
	oneWaySeconds: number;
	roundTrip: boolean;
	selectedColonyId: string | null;
	selectedShips: Record<ShipKey, number>;
	ships: Array<{
		available: number;
		cargoCapacity: number;
		fuelPerDistance: number;
		key: ShipKey;
		name: string;
		speed: number;
	}>;
	slowestSpeed: number;
	supportsStationing: boolean;
	targetResolution:
		| {
				ok: boolean;
				reason?: string;
				targetPreview?: {
					kind: "colony" | "planet";
					label: string;
				};
		  }
		| undefined;
	travelFuelCost: number;
	launchCtaLabel: string;
	onCargoChange: (cargo: ResourceBucket) => void;
	onCoordsChange: (coords: PlannerCoords) => void;
	onLaunch: () => void;
	onMissionTypeChange: (missionType: FleetMissionKind) => void;
	onOpenMapPicker: () => void;
	onRoundTripChange: (value: boolean) => void;
	onSelectColony: (colonyId: string) => void;
	onSetColonyPickerOpen: (open: boolean) => void;
	onSetSelectedColonyId: (colonyId: string | null) => void;
	onShipCountChange: (shipKey: ShipKey, nextCount: number) => void;
}) {
	return (
		<div className="lg:sticky lg:top-4 lg:self-start">
			<div
				className="
      rounded-2xl border border-white/12
      bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
    "
			>
				<div
					className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5"
				>
					<Rocket className="size-5 text-cyan-300" />
					<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
						Plan Expedition
					</h2>
				</div>

				<div className="space-y-4 p-5">
					<div>
						<SectionLabel>Mission Type</SectionLabel>
						<div className="mt-1.5 flex gap-2">
							{(["transport", "colonize"] as const).map((type) => (
								<button className={`
          flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2
          text-xs font-semibold transition-all
          ${props.missionType === type ? `
             border-cyan-300/40 bg-cyan-400/12 text-cyan-100
           ` : `
             border-white/10 bg-white/3 text-white/40
             hover:text-white/60
           `}
        `} key={type} onClick={() => props.onMissionTypeChange(type)} type="button">
									{type === "transport" ? (
										<Package className="size-3.5" />
									) : (
										<Globe2 className="size-3.5" />
									)}
									<span className="capitalize">{type}</span>
								</button>
							))}
						</div>
					</div>

					<div>
						<SectionLabel>Destination</SectionLabel>
						{props.targetResolution?.ok && props.targetResolution.targetPreview ? (
							<p
								className="
          mt-1.5 rounded-lg border border-cyan-300/20 bg-cyan-400/6 px-3 py-2
          text-[11px] text-cyan-100
        "
							>
								{props.targetResolution.targetPreview.label}
							</p>
						) : null}

						<div className={`
        mt-1.5 grid grid-cols-4 gap-1.5 transition-opacity
        ${props.selectedColonyId ? "pointer-events-none opacity-35" : ""}
      `}>
							{(["g", "s", "ss", "p"] as const).map((field, index) => (
								<div key={field}>
									<span className="block text-center text-[7px] text-white/25 uppercase">
										{["Gal", "Sec", "Sys", "Pla"][index]}
									</span>
									<input
										className="
            w-full rounded-md border border-white/12 bg-black/35 px-1 py-1.5
            text-center font-(family-name:--nv-font-mono) text-sm text-white
            outline-none
            focus:border-cyan-300/40
          "
										maxLength={4}
										onChange={(event) => {
											props.onSetSelectedColonyId(null);
											props.onCoordsChange({
												...props.coords,
												[field]: event.target.value.replace(/[^\d]/g, ""),
											});
										}}
										value={props.coords[field]}
									/>
								</div>
							))}
						</div>

						{props.missionType === "transport" ? (
							<div className="mt-2">
								<button className={`
          flex w-full items-center justify-between gap-1.5 rounded-lg border
          px-3 py-2 text-[10px] transition-all
          ${props.colonyPickerOpen ? `
             border-cyan-300/30 bg-cyan-400/6 text-cyan-100
           ` : `
             border-dashed border-white/10 text-white/30
             hover:border-cyan-300/20 hover:text-cyan-200/50
           `}
        `} onClick={() => props.onSetColonyPickerOpen(!props.colonyPickerOpen)} type="button">
									<span className="flex items-center gap-1.5">
										<Globe2 className="size-3" />
										My Colonies
									</span>
									<ChevronDown className={`
           size-3 transition-transform duration-200
           ${props.colonyPickerOpen ? "rotate-180" : ""}
         `} />
								</button>

								{props.colonyPickerOpen ? (
									<div className="pt-1 pb-0.5">
										{props.nonCurrentColonies.map((colony) => (
											<button className={`
             group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2
             text-left transition-colors
             hover:bg-white/[0.035]
             ${props.selectedColonyId === colony.id ? "bg-cyan-400/6" : ""}
           `} key={colony.id} onClick={() => props.onSelectColony(colony.id)} type="button">
												<div
													className="
               flex size-7 shrink-0 items-center justify-center rounded-md
               border border-white/10
               bg-[linear-gradient(150deg,rgba(61,217,255,0.08),rgba(255,145,79,0.08))]
               text-[8px] font-bold text-white/60 transition-colors
               group-hover:border-cyan-300/20 group-hover:text-white/80
             "
												>
													{colony.name.slice(0, 2).toUpperCase()}
												</div>
												<div className="min-w-0 flex-1">
													<p
														className="
                truncate text-[11px] font-semibold text-white/80
                transition-colors
                group-hover:text-white
              "
													>
														{colony.name}
													</p>
													<p
														className="
                font-(family-name:--nv-font-mono) text-[9px] text-white/25
              "
													>
														{colony.addressLabel}
													</p>
												</div>
												{props.selectedColonyId === colony.id ? (
													<Check className="size-3 shrink-0 text-cyan-300" />
												) : null}
											</button>
										))}
									</div>
								) : null}
							</div>
						) : null}

						<button
							className="
         mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border
         border-dashed border-white/10 py-2 text-[10px] text-white/30
         hover:border-cyan-300/20 hover:text-cyan-200/50
       "
							onClick={props.onOpenMapPicker}
							type="button"
						>
							<Crosshair className="size-3" />
							Select from Star Map
						</button>

						{!props.targetResolution?.ok && props.targetResolution?.reason ? (
							<p className="mt-2 text-[10px] text-amber-200/70">{props.targetResolution.reason}</p>
						) : null}
					</div>

					<div
						className="
        flex items-center justify-between rounded-lg border border-white/8
        bg-black/15 p-2.5
      "
					>
						<div className="flex items-center gap-2">
							<RotateCcw className={`
         size-3.5
         ${props.roundTrip ? "text-cyan-300" : `text-white/25`}
       `} />
							<span className="text-xs text-white/55">Round Trip</span>
						</div>
						<button className={`
        relative h-6 w-10 rounded-full border transition-all
        ${props.roundTrip ? "border-cyan-300/40 bg-cyan-400/20" : `
           border-white/15 bg-white/8
         `}
      `} disabled={props.missionType === "colonize"} onClick={() => props.onRoundTripChange(!props.roundTrip)} type="button">
							<span className={`
         absolute top-1/2 left-[3px] size-4 -translate-y-1/2 rounded-full
         bg-white shadow-sm transition-transform
         ${props.roundTrip ? "translate-x-4" : "translate-x-0"}
       `} />
						</button>
					</div>

					{props.missionType === "transport" && !props.roundTrip && !props.supportsStationing ? (
						<p className="text-[10px] text-amber-200/70">
							One-way stationing is available only for your own colony destinations.
						</p>
					) : null}

					<div>
						<SectionLabel>Fleet</SectionLabel>
						<div className="mt-1.5">
							{props.ships.map((ship, index) => {
								const count = props.selectedShips[ship.key] ?? 0;
								return (
									<div className={`
           flex items-center gap-2 py-1.5
           ${index < props.ships.length - 1 ? "border-b border-white/6" : ""}
         `} key={ship.key}>
										<img
											alt={ship.name}
											className="size-5 shrink-0 object-contain"
											src={`/game-icons/ships/${
												ship.key === "smallCargo"
													? "small-cargo"
													: ship.key === "largeCargo"
														? "large-cargo"
														: "colony-ship"
											}.png`}
										/>
										<span className={`
            min-w-0 flex-1 truncate text-xs
            ${count > 0 ? "font-semibold text-white" : "text-white/70"}
          `}>{ship.name}</span>
										<span
											className="
             shrink-0 font-(family-name:--nv-font-mono) text-[9px] text-white/30
           "
										>
											({ship.available})
										</span>
										<div className="flex shrink-0 items-center gap-0.5">
											<button
												className="
              flex size-5 items-center justify-center rounded-sm border
              border-white/10 bg-black/25 text-white/60
              disabled:opacity-25
            "
												disabled={count <= 0}
												onClick={() => props.onShipCountChange(ship.key, count - 1)}
												type="button"
											>
												<Minus className="size-2.5" />
											</button>
											<span className={`
             w-6 text-center font-(family-name:--nv-font-mono) text-xs font-bold
             ${count > 0 ? "text-cyan-100" : "text-white/30"}
           `}>{count}</span>
											<button
												className="
              flex size-5 items-center justify-center rounded-sm border
              border-white/10 bg-black/25 text-white/60
              disabled:opacity-25
            "
												disabled={count >= ship.available}
												onClick={() => props.onShipCountChange(ship.key, count + 1)}
												type="button"
											>
												<Plus className="size-2.5" />
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div>
						<div className="flex items-center justify-between">
							<SectionLabel>Cargo</SectionLabel>
							<span
								className="font-(family-name:--nv-font-mono) text-[9px] text-white/25"
							>
								{props.cargoUsed.toLocaleString()} / {props.cargoCapacity.toLocaleString()}
							</span>
						</div>
						{props.cargoCapacity > 0 ? (
							<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
								<div
									className="
           h-full rounded-full bg-linear-to-r from-cyan-400/60 to-cyan-300/40
         "
									style={{
										width: `${Math.min(100, (props.cargoUsed / props.cargoCapacity) * 100)}%`,
									}}
								/>
							</div>
						) : null}

						<div className="mt-2 space-y-2">
							{(["alloy", "crystal", "fuel"] as const).map((resourceKey) => (
								<div className="flex items-center gap-2" key={resourceKey}>
									<img
										alt={resourceKey}
										className="size-4 object-contain"
										src={`/game-icons/${resourceKey === "fuel" ? "deuterium" : resourceKey}.png`}
									/>
									<span className="w-12 text-[10px] text-white/45 capitalize">{resourceKey}</span>
									<input
										className="
            flex-1 [appearance:textfield] rounded-md border border-white/10
            bg-black/25 px-2 py-1 text-right font-(family-name:--nv-font-mono)
            text-xs text-white outline-none
            focus:border-cyan-300/30
            [&::-webkit-inner-spin-button]:appearance-none
            [&::-webkit-outer-spin-button]:appearance-none
          "
										min={0}
										onChange={(event) => {
											const nextValue = Math.max(0, Math.floor(Number(event.target.value) || 0));
											props.onCargoChange({
												...props.cargo,
												[resourceKey]: nextValue,
											});
										}}
										type="number"
										value={props.cargo[resourceKey]}
									/>
								</div>
							))}
						</div>
					</div>

					{props.hasShips ? (
						<div
							className="rounded-xl border border-cyan-300/15 bg-cyan-400/4 p-3"
						>
							<div className="grid grid-cols-2 gap-2">
								<MetricCard
									label="Distance"
									value={props.distance > 0 ? props.distance.toFixed(1) : "—"}
								/>
								<MetricCard label="One Way" value={formatDuration(props.oneWaySeconds)} />
								<MetricCard
									label={props.roundTrip ? "Travel Fuel" : "One Way Fuel"}
									value={props.travelFuelCost.toLocaleString()}
								/>
								<MetricCard
									label="Speed"
									value={props.slowestSpeed > 0 ? props.slowestSpeed.toLocaleString() : "—"}
								/>
							</div>
						</div>
					) : null}

					<div
						className="
        rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[10px]
        text-white/55
      "
					>
						<p>
							Resources after launch: Alloy {props.availableResources.alloy.toLocaleString()} /
							Crystal {props.availableResources.crystal.toLocaleString()} / Fuel{" "}
							{props.availableResources.fuel.toLocaleString()}
						</p>
						<p className="mt-1 text-white/35">
							Required now: Alloy {props.cargo.alloy.toLocaleString()} / Crystal{" "}
							{props.cargo.crystal.toLocaleString()} / Fuel{" "}
							{(props.cargo.fuel + props.travelFuelCost).toLocaleString()}
						</p>
					</div>

					<button
						className="
        flex w-full items-center justify-center gap-2 rounded-xl border
        border-cyan-200/50 bg-linear-to-b from-cyan-400/25 to-cyan-400/10 px-4
        py-3 font-(family-name:--nv-font-display) text-sm font-bold
        tracking-[0.08em] text-cyan-50 uppercase
        shadow-[0_0_20px_rgba(61,217,255,0.12)] transition-all
        hover:-translate-y-0.5 hover:border-cyan-100/70
        hover:shadow-[0_0_30px_rgba(61,217,255,0.25)]
        disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/5
        disabled:text-white/30 disabled:shadow-none
      "
						disabled={!props.canLaunch}
						onClick={props.onLaunch}
						type="button"
					>
						<Sparkles className="size-4" />
						{props.launchCtaLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

function SectionLabel(props: { children: React.ReactNode }) {
	return (
		<p
			className="
     text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
   "
		>
			{props.children}
		</p>
	);
}

function MetricCard(props: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-cyan-300/10 bg-cyan-400/3 p-2">
			<p className="text-[8px] tracking-widest text-cyan-200/45 uppercase">{props.label}</p>
			<p
				className="
      mt-0.5 font-(family-name:--nv-font-mono) text-xs font-bold text-cyan-100
    "
			>
				{props.value}
			</p>
		</div>
	);
}
