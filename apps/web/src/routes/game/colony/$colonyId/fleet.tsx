import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Layers3, MapPin, Ship } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	parseAddressLabel,
	useFleetOperationsActions,
	useFleetPlannerDerived,
	useFleetPlannerState,
	useFleetRouteData,
} from "@/features/colony-route/fleet-hooks";
import { MissionPlannerPanel } from "@/features/colony-route/fleet-mission-planner";
import { FleetRouteSkeleton } from "@/features/colony-route/loading-skeletons";
import { OperationTimelinePanel } from "@/features/colony-route/route-shared";
import { getShipImagePath, SHIP_GROUPS } from "@/features/colony-route/shipyard-shared";
import { useColonyStarMapPicker } from "@/features/colony-route/star-map-picker-context";
import { useConvexAuth, useQuery } from "@/lib/convex-hooks";

export const Route = createFileRoute("/game/colony/$colonyId/fleet")({
	component: FleetRoute,
});

function FleetRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const navigate = useNavigate();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const progressionOverview = useQuery(
		api.progression.getOverview,
		isConvexAuthenticated ? {} : "skip",
	);
	const { consumedSelection, openPicker, selectedTarget } = useColonyStarMapPicker();
	const [expandedOp, setExpandedOp] = useState<string | null>(null);

	const {
		activeOperations,
		availableResources,
		canShowDevUi,
		canUseDevConsole,
		devConsole,
		fleetDeployed,
		fleetTotal,
		isAuthLoading,
		isAuthenticated,
		nowMs,
		nonCurrentColonies,
		ready,
		ships,
		shipsByKey,
	} = useFleetRouteData(colonyIdAsId);
	useEffect(() => {
		if (
			!isConvexAuthenticated ||
			!progressionOverview ||
			progressionOverview.features.fleet === "unlocked"
		) {
			return;
		}
		void navigate({
			params: { colonyId },
			replace: true,
			to: "/game/colony/$colonyId/resources",
		});
	}, [colonyId, isConvexAuthenticated, navigate, progressionOverview]);
	const {
		cargo,
		colonyPickerOpen,
		coords,
		missionType,
		roundTrip,
		selectedColonyId,
		selectedShips,
		setCargo,
		setColonyPickerOpen,
		setCoords,
		setMissionType,
		setRoundTrip,
		setSelectedColonyId,
		setSelectedShips,
		resetPlannerState,
	} = useFleetPlannerState({
		consumedSelection,
		selectedTarget,
	});
	const {
		cancelMissionOperation,
		cancelingOperationId,
		completeMission,
		completingOperationId,
		isLaunching,
		launchOperation,
	} = useFleetOperationsActions({
		colonyId: colonyIdAsId,
		completeActiveMission: devConsole.completeActiveMission,
	});
	const {
		canLaunch,
		cargoCapacity,
		cargoUsed,
		distance,
		hasShips,
		launchCtaLabel,
		oneWaySeconds,
		selectedShipCounts,
		slowestSpeed,
		supportsStationing,
		targetResolution,
		travelFuelCost,
	} = useFleetPlannerDerived({
		availableResources,
		cargo,
		colonyId: colonyIdAsId,
		coords,
		isAuthenticated,
		isLaunching,
		missionType,
		roundTrip,
		selectedShips,
	});

	if (isAuthLoading || (isAuthenticated && !ready)) {
		return <FleetRouteSkeleton />;
	}

	if (!ready || !availableResources) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load fleet. Please sign in again.
			</div>
		);
	}

	const launch = async () => {
		if (!targetResolution || !targetResolution.ok || !targetResolution.target) {
			toast.error(
				targetResolution && !targetResolution.ok
					? targetResolution.reason
					: "Select a valid destination",
			);
			return;
		}

		if (!canLaunch) {
			toast.error("Expedition requirements are not met");
			return;
		}

		await launchOperation({
			cargoRequested: cargo,
			kind: missionType,
			originColonyId: colonyIdAsId,
			postDeliveryAction:
				missionType === "transport"
					? roundTrip
						? "returnToOrigin"
						: "stationAtDestination"
					: undefined,
			resetPlanner: resetPlannerState,
			shipCounts: selectedShipCounts,
			target: targetResolution.target,
		});
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
					<OperationTimelinePanel
						cancelingOperationId={cancelingOperationId}
						canShowDevUi={canShowDevUi}
						canUseDevConsole={canUseDevConsole}
						completingOperationId={completingOperationId}
						emptyMessage="No active expeditions."
						expandedId={expandedOp}
						header={
							<h2
								className="
          flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
          font-bold
        "
							>
								<Layers3 className="size-4 text-cyan-300/60" />
								Active Expeditions
							</h2>
						}
						nowMs={nowMs}
						operations={activeOperations}
						shipsByKey={shipsByKey}
						onCancel={cancelMissionOperation}
						onComplete={completeMission}
						onToggle={(operationId) =>
							setExpandedOp((current) => (current === operationId ? null : operationId))
						}
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
						if (nextMissionType === missionType) {
							return;
						}

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

			<div className="mt-4 space-y-3">
				{SHIP_GROUPS.map((group) => {
					const groupShips = group.keys
						.map((key) => props.ships.find((s) => s.key === key))
						.filter((s): s is NonNullable<typeof s> => s != null);
					if (groupShips.length === 0) return null;
					return (
						<div key={group.label}>
							<p
								className="
          mb-1.5 text-[9px] font-semibold tracking-[0.12em] text-white/30
          uppercase
        "
							>
								{group.label}
							</p>
							<div
								className="
          grid grid-cols-2 gap-2
          sm:grid-cols-3
          md:grid-cols-4
        "
							>
								{groupShips.map((ship) => {
									const hasAny = ship.owned > 0;
									return (
										<div className={`
            relative overflow-hidden rounded-xl border p-2.5 transition-colors
            ${hasAny ? "border-white/10 bg-white/[0.035]" : `
              border-white/6 bg-white/1.5 opacity-50
            `}
          `} key={ship.key}>
											<div className="flex items-center gap-2">
												<img
													alt={ship.name}
													className="
               size-8 shrink-0 rounded-md border border-white/8 bg-black/30
               object-contain p-0.5
             "
													src={getShipImagePath(ship.key)}
												/>
												<div className="min-w-0">
													<p className="truncate text-xs font-semibold">{ship.name}</p>
													<p
														className="
                font-(family-name:--nv-font-mono) text-[10px] text-white/50
              "
													>
														{ship.owned}
													</p>
												</div>
											</div>
											<div className="mt-2 flex justify-between text-[9px]">
												<span className="text-emerald-300/70">{ship.available} avail</span>
												<span className="text-cyan-200/50">{ship.deployed} out</span>
											</div>
											<div
												className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8"
											>
												<div
													className="h-full rounded-full bg-cyan-400/40"
													style={{
														width: `${ship.owned > 0 ? (ship.deployed / ship.owned) * 100 : 0}%`,
													}}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
