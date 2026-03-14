import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	getFleetFuelCostForDistance,
	getFleetSlowestSpeed,
	normalizeShipCounts,
	selectShipCatalog,
	type HostileFactionKey,
	type ResourceBucket,
	type ShipKey,
} from "@nullvector/game-logic";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Layers3, MapPin, Package, RotateCcw, Ship, Swords, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { ActivityTimelinePanel, splitActivityLabel } from "./active-activity-panel";
import {
	DEFAULT_SELECTED_SHIPS,
	type BrowseLevel,
	type ContractView,
	type HostilePlanetView,
	type HostileSectorWithDistance,
	type RecommendedContractView,
	type SelectedContractContext,
	type ShipAssignment,
	type SystemGroup,
	groupPlanetsBySystems,
} from "./contracts-screen-shared";
import {
	ContractDetailPanel,
	ContractHistory,
	ContractsSkeleton,
	RecommendedSection,
	SectorBrowser,
} from "./contracts-screen-view";
import { formatColonyDuration } from "@/features/colony-ui/time";

export const Route = createFileRoute("/game/colony/$colonyId/contracts")({
	component: ContractsRoute,
});

type ContractOperationRow = {
	id: Id<"fleetOperations">;
	fleetId: Id<"fleets">;
	kind: "transport" | "colonize" | "contract" | "combat";
	status: "planned" | "inTransit" | "atTarget" | "returning" | "completed" | "cancelled" | "failed";
	relation: "incoming" | "outgoing";
	originColonyId: Id<"colonies">;
	originName: string;
	originAddressLabel: string;
	target: {
		kind: "colony" | "planet" | "contractNode" | "fleet";
		colonyId?: Id<"colonies">;
		planetId?: Id<"planets">;
		fleetId?: Id<"fleets">;
		contractId?: Id<"contracts">;
	};
	targetPreview: {
		kind: "colony" | "planet";
		label: string;
	};
	shipCounts: Record<ShipKey, number>;
	cargoRequested: ResourceBucket;
	postDeliveryAction: "returnToOrigin" | "stationAtDestination" | undefined;
	departAt: number;
	arriveAt: number;
	nextEventAt: number;
	distance: number;
	canCancel: boolean;
};

function getOperationAccent(args: {
	kind: ContractOperationRow["kind"];
	status: ContractOperationRow["status"];
}): {
	badge: string;
	dot: string;
	iconBorder: string;
	iconFill: string;
	iconText: string;
	kindLabel: string;
	line: string;
	progress: string;
	targetBorder: string;
	targetFill: string;
} {
	const isReturning = args.status === "returning";

	if (isReturning) {
		return {
			badge: "bg-amber-400/12 text-amber-200/80",
			dot: "bg-amber-400",
			iconBorder: "border-amber-300",
			iconFill: "bg-amber-400/20 shadow-amber-400/30",
			iconText: "text-amber-300",
			kindLabel: "Returning",
			line: "bg-linear-to-r from-amber-400/60 to-amber-400/20",
			progress: "bg-amber-400/50",
			targetBorder: "border-rose-300/25",
			targetFill: "bg-rose-400/10",
		};
	}

	return {
		badge: "bg-rose-400/12 text-rose-200/80",
		dot: "bg-rose-400",
		iconBorder: "border-rose-300",
		iconFill: "bg-rose-400/20 shadow-rose-400/30",
		iconText: "text-rose-300",
		kindLabel: "Contract",
		line: "bg-linear-to-r from-rose-400/60 to-rose-400/20",
		progress: "bg-rose-400/50",
		targetBorder: "border-rose-300/25",
		targetFill: "bg-rose-400/10",
	};
}

function ContractsRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const hostileSectorsResponse = useQuery(
		api.hostility.getHostileSectorsForUniverse,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const progression = useQuery(
		api.playerProgression.getPlayerProgression,
		isAuthenticated ? {} : "skip",
	);
	const shipCatalog = useMemo(() => selectShipCatalog(), []);
	const garrison = useQuery(
		api.fleetV2.getFleetGarrison,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const operations = useQuery(
		api.fleetV2.getFleetOperationsForColony,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const historySummary = useQuery(
		api.contracts.getContractHistorySummary,
		isAuthenticated ? {} : "skip",
	);
	const [historyExpanded, setHistoryExpanded] = useState(false);
	const history = useQuery(
		api.contracts.getContractHistory,
		isAuthenticated && historyExpanded ? { limit: 10 } : "skip",
	);

	const getRecommendedContracts = useMutation(api.contracts.getRecommendedContracts);
	const getPlanetContracts = useMutation(api.contracts.getPlanetContracts);
	const launchContract = useMutation(api.contracts.launchContract);
	const cancelOperation = useMutation(api.fleetV2.cancelOperation);
	const completeActiveMission = useMutation(api.devConsole.completeActiveMission);

	const [recommended, setRecommended] = useState<RecommendedContractView[] | null>(null);
	const [recommendedLoading, setRecommendedLoading] = useState(false);
	const [browseLevel, setBrowseLevel] = useState<BrowseLevel>({ level: "sectors" });
	const [planetContracts, setPlanetContracts] = useState<ContractView[] | null>(null);
	const [contractsLoading, setContractsLoading] = useState(false);
	const [selectedContext, setSelectedContext] = useState<SelectedContractContext | null>(null);
	const [selectedShips, setSelectedShips] =
		useState<Record<ShipKey, number>>(DEFAULT_SELECTED_SHIPS);
	const [isLaunching, setIsLaunching] = useState(false);
	const [expandedOp, setExpandedOp] = useState<string | null>(null);
	const [cancelingOperationId, setCancelingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);
	const [completingOperationId, setCompletingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const selectedSectorDetail = useQuery(
		api.hostility.getHostileSectorDetail,
		isAuthenticated && browseLevel.level !== "sectors"
			? {
					colonyId: colonyIdAsId,
					sectorId: browseLevel.sector.sectorId,
				}
			: "skip",
	);

	const hostileSectors = useMemo(() => {
		if (!hostileSectorsResponse) {
			return null;
		}

		const { originX, originY, sectors } = hostileSectorsResponse;
		return sectors
			.map((sector) => ({
				...sector,
				distance: Math.sqrt((sector.centerX - originX) ** 2 + (sector.centerY - originY) ** 2),
			}))
			.sort((left, right) => {
				if (left.status !== right.status) {
					return left.status === "hostile" ? -1 : 1;
				}
				return left.distance - right.distance;
			});
	}, [hostileSectorsResponse]);
	const selectedSectorSystems = useMemo(
		() => groupPlanetsBySystems(selectedSectorDetail?.planets ?? []),
		[selectedSectorDetail],
	);
	const selectedSectorLoading =
		browseLevel.level !== "sectors" && selectedSectorDetail === undefined;

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}
		const tick = window.setInterval(() => setNowMs(Date.now()), 1_000);
		return () => window.clearInterval(tick);
	}, [isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		let cancelled = false;
		setRecommendedLoading(true);
		getRecommendedContracts({ colonyId: colonyIdAsId })
			.then((result) => {
				if (cancelled) {
					return;
				}
				setRecommended(result.contracts as RecommendedContractView[]);
				setRecommendedLoading(false);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setRecommended([]);
				setRecommendedLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [colonyIdAsId, getRecommendedContracts, isAuthenticated]);

	function resetSelection(): void {
		setSelectedContext(null);
		setSelectedShips(DEFAULT_SELECTED_SHIPS);
	}

	function loadPlanetContractsForSelection(
		planetId: Id<"planets">,
		_planetContext: {
			displayName: string;
			addressLabel: string;
			hostileFactionKey: HostileFactionKey;
			sectorDisplayName: string;
		},
	): void {
		setContractsLoading(true);
		setPlanetContracts(null);
		getPlanetContracts({ originColonyId: colonyIdAsId, planetId })
			.then((result) => {
				setPlanetContracts(result.contracts as ContractView[]);
				setContractsLoading(false);
			})
			.catch(() => {
				setPlanetContracts(null);
				setContractsLoading(false);
			});
	}

	const ready =
		!isAuthLoading &&
		isAuthenticated &&
		Boolean(
			hostileSectorsResponse &&
			hostileSectors &&
			progression &&
			historySummary &&
			garrison &&
			operations,
		);

	if (isAuthLoading || (isAuthenticated && !ready)) {
		return <ContractsSkeleton />;
	}

	if (!ready || !hostileSectors || !progression || !historySummary || !garrison || !operations) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load contracts. Please sign in again.
			</div>
		);
	}

	const ships: ShipAssignment[] = shipCatalog.map((ship) => ({
		...ship,
		available: garrison.garrisonShips[ship.key] ?? 0,
	}));
	const shipsByKey = new Map(shipCatalog.map((ship) => [ship.key, { name: ship.name }]));
	const activeContractOperations = operations.active.filter(
		(operation): operation is ContractOperationRow => operation.kind === "contract",
	);
	const selectedContract = selectedContext?.contract ?? null;
	const selectedShipCounts = normalizeShipCounts(selectedShips);
	const hasShips = Object.values(selectedShipCounts).some((count) => count > 0);
	const rankTooLow = selectedContract ? progression.rank < selectedContract.requiredRank : false;
	const activeContractCount = historySummary.activeContractCount;
	const activeContractLimit = historySummary.activeContractLimit;
	const contractLimitReached = activeContractCount >= activeContractLimit;
	const distance = selectedContext?.distance ?? 0;
	const fuelCost = hasShips
		? getFleetFuelCostForDistance({ distance, shipCounts: selectedShipCounts })
		: 0;
	const slowestSpeed = getFleetSlowestSpeed(selectedShipCounts);
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

	function getLaunchCtaLabel(): string {
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

	async function refreshRecommendedContracts(): Promise<void> {
		try {
			const result = await getRecommendedContracts({ colonyId: colonyIdAsId });
			setRecommended(result.contracts as RecommendedContractView[]);
		} catch {
			// Keep the current list if refresh fails.
		}
	}

	async function handleLaunch(): Promise<void> {
		if (!selectedContract || !canLaunch) {
			return;
		}

		setIsLaunching(true);
		try {
			await launchContract({
				originColonyId: colonyIdAsId,
				contractId: selectedContract.id,
				shipCounts: selectedShipCounts,
			});
			toast.success("Contract mission launched");
			resetSelection();
			await refreshRecommendedContracts();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to launch mission");
		} finally {
			setIsLaunching(false);
		}
	}

	async function handleCancel(operationId: Id<"fleetOperations">): Promise<void> {
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

	async function handleComplete(operationId: Id<"fleetOperations">): Promise<void> {
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
	}

	function handleSelectRecommended(contract: RecommendedContractView): void {
		setSelectedContext({
			contract,
			planet: {
				displayName: contract.planetDisplayName,
				addressLabel: contract.planetAddressLabel,
				hostileFactionKey: contract.hostileFactionKey,
				sectorDisplayName: contract.sectorDisplayName,
			},
			distance: contract.distance,
		});
		setSelectedShips(DEFAULT_SELECTED_SHIPS);
	}

	function handleSelectBrowseContract(
		contract: ContractView,
		planetContext: {
			displayName: string;
			addressLabel: string;
			hostileFactionKey: HostileFactionKey;
			sectorDisplayName: string;
		},
		contractDistance: number,
	): void {
		setSelectedContext({
			contract,
			planet: planetContext,
			distance: contractDistance,
		});
		setSelectedShips(DEFAULT_SELECTED_SHIPS);
	}

	function handleBrowseSector(sector: HostileSectorWithDistance): void {
		setBrowseLevel({ level: "systems", sector });
		setPlanetContracts(null);
	}

	function handleBrowseSystem(sector: HostileSectorWithDistance, system: SystemGroup): void {
		setBrowseLevel({ level: "planets", sector, system });
		setPlanetContracts(null);
	}

	function handleBrowsePlanet(
		sector: HostileSectorWithDistance,
		system: SystemGroup,
		planet: HostilePlanetView,
	): void {
		setBrowseLevel({ level: "contracts", sector, system, planet });
		loadPlanetContractsForSelection(planet.planetId, {
			displayName: planet.displayName,
			addressLabel: planet.addressLabel,
			hostileFactionKey: sector.hostileFactionKey,
			sectorDisplayName: sector.displayName,
		});
	}

	function handleBrowseBack(): void {
		if (browseLevel.level === "contracts") {
			setBrowseLevel({
				level: "planets",
				sector: browseLevel.sector,
				system: browseLevel.system,
			});
			setPlanetContracts(null);
			return;
		}
		if (browseLevel.level === "planets") {
			setBrowseLevel({ level: "systems", sector: browseLevel.sector });
			return;
		}
		if (browseLevel.level === "systems") {
			setBrowseLevel({ level: "sectors" });
		}
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
					<ActiveContractOperationsPanel
						cancelingOperationId={cancelingOperationId}
						canShowDevUi={devConsoleState?.showDevConsoleUi === true}
						canUseDevConsole={devConsoleState?.canUseDevConsole === true}
						completingOperationId={completingOperationId}
						expandedOp={expandedOp}
						nowMs={nowMs}
						activeContractCount={activeContractCount}
						activeContractLimit={activeContractLimit}
						onCancel={handleCancel}
						onComplete={handleComplete}
						onToggle={(operationId) =>
							setExpandedOp((current) => (current === operationId ? null : operationId))
						}
						operations={activeContractOperations}
						shipsByKey={shipsByKey}
					/>

					<RecommendedSection
						contracts={recommended}
						loading={recommendedLoading}
						nowMs={nowMs}
						playerRank={progression.rank}
						selectedContractId={selectedContext?.contract.id ?? null}
						onSelect={handleSelectRecommended}
					/>

					<SectorBrowser
						browseLevel={browseLevel}
						contractsLoading={contractsLoading}
						nowMs={nowMs}
						originX={hostileSectorsResponse?.originX ?? 0}
						originY={hostileSectorsResponse?.originY ?? 0}
						planetContracts={planetContracts}
						playerRank={progression.rank}
						selectedSectorLoading={selectedSectorLoading}
						selectedSectorSystems={selectedSectorSystems}
						sectors={hostileSectors}
						selectedContractId={selectedContext?.contract.id ?? null}
						onBack={handleBrowseBack}
						onSelectContract={handleSelectBrowseContract}
						onSelectPlanet={handleBrowsePlanet}
						onSelectSector={handleBrowseSector}
						onSelectSystem={handleBrowseSystem}
					/>

					<section className="rounded-[24px] border border-white/8 bg-black/18 p-4">
						<button
							type="button"
							className="
								flex w-full items-center gap-3 text-left transition-colors hover:text-white/90
							"
							onClick={() => setHistoryExpanded((current) => !current)}
						>
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<Layers3 className="size-4 text-white/40" />
								<div>
									<div className="font-(family-name:--nv-font-display) text-sm font-bold">
										Recent Missions
									</div>
									<div className="text-[10px] text-white/45">
										Load resolved mission history on demand.
									</div>
								</div>
							</div>
							<ChevronDown
								className={`
									size-4 shrink-0 text-white/35 transition-transform
									${historyExpanded ? "rotate-180" : ""}
								`}
							/>
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
										<div className="text-xs text-white/45">
											No resolved missions yet.
										</div>
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
					selectedShips={selectedShipCounts}
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

function ActiveContractOperationsPanel(props: {
	activeContractCount: number;
	activeContractLimit: number;
	cancelingOperationId: Id<"fleetOperations"> | null;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	completingOperationId: Id<"fleetOperations"> | null;
	expandedOp: string | null;
	nowMs: number;
	onCancel: (operationId: Id<"fleetOperations">) => void;
	onComplete: (operationId: Id<"fleetOperations">) => void;
	onToggle: (operationId: string) => void;
	operations: ContractOperationRow[];
	shipsByKey: Map<
		ShipKey,
		{
			name: string;
		}
	>;
}) {
	const items = props.operations.map((operation) => {
		const totalDuration = Math.max(1, operation.arriveAt - operation.departAt);
		const elapsed = Math.max(0, props.nowMs - operation.departAt);
		const progress = Math.min(100, (elapsed / totalDuration) * 100);
		const etaSeconds = Math.max(0, Math.ceil((operation.arriveAt - props.nowMs) / 1_000));
		const totalCargo =
			operation.cargoRequested.alloy +
			operation.cargoRequested.crystal +
			operation.cargoRequested.fuel;
		const accent = getOperationAccent({
			kind: operation.kind,
			status: operation.status,
		});
		const targetPreview = splitActivityLabel(operation.targetPreview.label);

		return {
			actions: [
				operation.canCancel ? (
					<button
						key="cancel"
						className="
        ml-auto inline-flex items-center gap-1 rounded-md border
        border-rose-300/20 bg-rose-400/8 px-2.5 py-1 text-[10px] font-medium
        text-rose-200/80 transition-colors
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
				) : null,
				props.canShowDevUi ? (
					<button
						key="complete"
						className="
        inline-flex items-center gap-1 rounded-md border border-cyan-300/20
        bg-cyan-400/8 px-2.5 py-1 text-[10px] font-medium text-cyan-100
        transition-colors
        hover:border-cyan-200/35 hover:bg-cyan-400/12
        disabled:cursor-not-allowed disabled:opacity-50
      "
						disabled={props.completingOperationId === operation.id || !props.canUseDevConsole}
						onClick={(event) => {
							event.stopPropagation();
							props.onComplete(operation.id);
						}}
						type="button"
					>
						Complete
					</button>
				) : null,
			].filter(Boolean),
			detailChips: [
				<div
					className="
       rounded-sm border border-white/10 bg-white/3 px-1.5 py-0.5 text-[9px]
       font-semibold uppercase
     "
					key="relation"
				>
					{operation.relation}
				</div>,
				<div className="flex items-center gap-1" key="ships">
					<Ship className="size-3" />
					{Object.entries(operation.shipCounts)
						.filter(([, count]) => count > 0)
						.map(
							([shipKey, count]) =>
								`${count}x ${props.shipsByKey.get(shipKey as ShipKey)?.name ?? shipKey}`,
						)
						.join(", ")}
				</div>,
				totalCargo > 0 ? (
					<div className="flex items-center gap-1" key="cargo">
						<Package className="size-3" />
						{totalCargo.toLocaleString()} cargo
					</div>
				) : null,
				operation.postDeliveryAction === "returnToOrigin" ? (
					<div className="flex items-center gap-1" key="roundTrip">
						<RotateCcw className="size-3" />
						Round trip
					</div>
				) : null,
			].filter(Boolean),
			dotClassName: accent.dot,
			etaLabel: formatColonyDuration(etaSeconds, "seconds"),
			id: operation.id,
			kindBadgeClassName: accent.badge,
			kindLabel: accent.kindLabel,
			origin: {
				icon: <MapPin className="size-4 text-cyan-300" />,
				iconContainerClassName: "border-cyan-300/25 bg-cyan-400/10",
				subtitle: operation.originAddressLabel,
				title: operation.originName,
			},
			progress,
			progressBarClassName: accent.progress,
			relationBadgeClassName:
				operation.relation === "incoming"
					? "border border-amber-300/20 bg-amber-300/10 text-amber-100/80"
					: "border border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80",
			relationLabel: operation.relation,
			statusLabel: operation.status,
			summaryLabel: operation.targetPreview.label,
			target: {
				icon: <Swords className="size-4 text-rose-300" />,
				iconContainerClassName: `${accent.targetBorder} ${accent.targetFill}`,
				subtitle: targetPreview?.address,
				title: targetPreview?.name ?? operation.targetPreview.label,
			},
			transitIcon: <Swords className={`
     size-3
     ${accent.iconText}
   `} />,
			transitIconBorderClassName: accent.iconBorder,
			transitIconFillClassName: accent.iconFill,
			transitLineClassName: accent.line,
		};
	});

	return (
		<ActivityTimelinePanel
			emptyMessage="No active contract missions."
			expandedId={props.expandedOp}
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
							({props.activeContractCount}/{props.activeContractLimit})
						</span>
					</span>
				</h2>
			}
			items={items}
			onToggle={props.onToggle}
		/>
	);
}
