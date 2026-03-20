import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import {
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	normalizeShipCounts,
} from "@nullvector/game-logic";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Layers3 } from "lucide-react";
import { useState } from "react";

import type { ContractView } from "@/features/colony-route/contracts-screen-shared";

import {
	useContractDiscoveryRebuild,
	useContractMissionActions,
	useContractSelection,
	useContractsRouteData,
} from "@/features/colony-route/contracts-hooks";
import {
	ContractDetailPanel,
	ContractHistory,
	ContractsSkeleton,
	RecommendedSection,
} from "@/features/colony-route/contracts-screen-view";
import { OperationTimelinePanel } from "@/features/colony-route/route-shared";

export const Route = createFileRoute("/game/colony/$colonyId/contracts")({
	component: ContractsRoute,
});

function ContractsRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const [historyExpanded, setHistoryExpanded] = useState(false);
	const [expandedOp, setExpandedOp] = useState<string | null>(null);

	const {
		activeContractOperations,
		canShowDevUi,
		canUseDevConsole,
		devConsole,
		garrison,
		history,
		historySummary,
		isAuthLoading,
		isAuthenticated,
		nowMs,
		progression,
		ready,
		recommendedContracts,
		recommendedResult,
		ships,
		shipsByKey,
	} = useContractsRouteData({
		colonyId: colonyIdAsId,
		historyExpanded,
	});
	const { isRebuildingDiscovery } = useContractDiscoveryRebuild({
		colonyId: colonyIdAsId,
		isAuthenticated,
		recommendedResult,
	});
	const {
		cancelMissionOperation,
		cancelingOperationId,
		completeMission,
		completingOperationId,
		isLaunching,
		launchContractMission,
	} = useContractMissionActions({
		colonyId: colonyIdAsId,
		completeActiveMission: devConsole.completeActiveMission,
	});
	const {
		resetSelection,
		selectRecommended,
		selectedContext,
		selectedContract,
		selectedShipCounts,
		setSelectedShips,
	} = useContractSelection();

	if (isAuthLoading || (isAuthenticated && (!ready || isRebuildingDiscovery))) {
		return <ContractsSkeleton />;
	}

	if (!ready || !progression || !historySummary || !garrison || !recommendedResult) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load contracts. Please sign in again.
			</div>
		);
	}

	const activeContractCount = historySummary.activeContractCount;
	const activeContractLimit = historySummary.activeContractLimit;
	const contractLimitReached = activeContractCount >= activeContractLimit;
	const rankTooLow = selectedContract ? progression.rank < selectedContract.requiredRank : false;
	const selectedShipValues = normalizeShipCounts(selectedShipCounts);
	const hasShips = Object.values(selectedShipValues).some((count) => count > 0);
	const distance = selectedContext?.distance ?? 0;
	const fuelCost = hasShips
		? getFleetFuelCostForDistance({ distance, shipCounts: selectedShipValues })
		: 0;
	const slowestSpeed = getFleetSlowestSpeed(selectedShipValues);
	const travelSeconds =
		hasShips && slowestSpeed > 0 && distance > 0
			? Math.max(30, Math.ceil((distance / slowestSpeed) * 3_600))
			: 0;
	const canLaunch = Boolean(
		selectedContract &&
		selectedContract.status === "available" &&
		!rankTooLow &&
		!contractLimitReached &&
		hasShips &&
		!isLaunching,
	);

	function getLaunchCtaLabel() {
		if (isLaunching) {
			return "Launching...";
		}
		if (!selectedContract) {
			return "Select Contract";
		}
		if (rankTooLow) {
			return `Rank ${selectedContract.requiredRank} Required`;
		}
		if (contractLimitReached) {
			return `Active Limit ${activeContractCount}/${activeContractLimit}`;
		}
		if (selectedContract.status === "inProgress") {
			return "In Progress";
		}
		if (!hasShips) {
			return "Assign Ships";
		}
		return "Launch Mission";
	}

	function handleLaunch() {
		if (!selectedContract || !canLaunch) {
			return;
		}
		if (selectedContract.offerSequence === undefined) {
			return;
		}

		void launchContractMission({
			onSuccess: resetSelection,
			offerSequence: selectedContract.offerSequence,
			planetId: selectedContract.planetId,
			shipCounts: selectedShipValues,
			slot: selectedContract.slot,
		});
	}

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
						canShowDevUi={canShowDevUi}
						canUseDevConsole={canUseDevConsole}
						cancelingOperationId={cancelingOperationId}
						completingOperationId={completingOperationId}
						emptyMessage="No active contract missions."
						expandedId={expandedOp}
						header={
							<h2
								className="
          flex items-center gap-2 font-(family-name:--nv-font-display) text-sm
          font-bold
        "
							>
								<Layers3 className="size-4 text-rose-300/60" />
								<span>
									Active Contracts{" "}
									<span
										className="
            font-(family-name:--nv-font-mono) text-xs font-medium text-white/35
          "
									>
										({activeContractCount}/{activeContractLimit})
									</span>
								</span>
							</h2>
						}
						nowMs={nowMs}
						operations={activeContractOperations}
						shipsByKey={shipsByKey}
						onCancel={(operationId) => {
							void cancelMissionOperation(operationId);
						}}
						onComplete={(operationId) => {
							void completeMission(operationId);
						}}
						onToggle={(operationId) => {
							setExpandedOp((current) => (current === operationId ? null : operationId));
						}}
					/>

					<RecommendedSection
						contracts={recommendedContracts}
						loading={false}
						nowMs={nowMs}
						playerRank={progression.rank}
						selectedContractId={selectedContext?.contract.id ?? null}
						onSelect={selectRecommended}
					/>

					<section className="rounded-[24px] border border-white/8 bg-black/18 p-4">
						<button
							type="button"
							className="
         flex w-full items-center gap-3 text-left transition-colors
         hover:text-white/90
       "
							onClick={() => setHistoryExpanded((current) => !current)}
						>
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<ChevronDown className={`
          size-4 shrink-0 text-white/40 transition-transform
          ${historyExpanded ? "rotate-180" : ""}
        `} />
								<div>
									<div className="font-(family-name:--nv-font-display) text-sm font-bold">
										Recent Missions
									</div>
									<div className="text-[10px] text-white/45">
										Load resolved mission history on demand.
									</div>
								</div>
							</div>
						</button>

						<div
							className="
         grid transition-[grid-template-rows] duration-300
         ease-[cubic-bezier(0.25,0.8,0.25,1)]
       "
							style={{ gridTemplateRows: historyExpanded ? "1fr" : "0fr" }}
						>
							<div className="overflow-hidden">
								<div className="pt-4">
									{historyExpanded && history === undefined ? (
										<div className="text-xs text-white/45">Loading mission history...</div>
									) : null}
									{historyExpanded && history && history.contracts.length > 0 ? (
										<ContractHistory contracts={history.contracts as ContractView[]} />
									) : null}
									{historyExpanded && history && history.contracts.length === 0 ? (
										<div className="text-xs text-white/45">No resolved missions yet.</div>
									) : null}
								</div>
							</div>
						</div>
					</section>
				</div>

				<ContractDetailPanel
					activeContractCount={activeContractCount}
					activeContractLimit={activeContractLimit}
					canLaunch={canLaunch}
					contract={selectedContract}
					contractLimitReached={contractLimitReached}
					distance={distance}
					fuelCost={fuelCost}
					launchCtaLabel={getLaunchCtaLabel()}
					planet={selectedContext?.planet ?? null}
					playerRank={progression.rank}
					rankTooLow={rankTooLow}
					selectedShips={selectedShipValues}
					ships={ships}
					travelSeconds={travelSeconds}
					onLaunch={handleLaunch}
					onShipCountChange={(shipKey, nextCount) => {
						const ship = ships.find((candidate) => candidate.key === shipKey);
						if (!ship) {
							return;
						}
						const clamped = Math.max(0, Math.min(ship.available, Math.floor(nextCount)));
						setSelectedShips((current) => ({ ...current, [shipKey]: clamped }));
					}}
				/>
			</div>
		</div>
	);
}
