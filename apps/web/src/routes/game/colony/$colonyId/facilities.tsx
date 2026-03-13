import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, FacilityKey, ResourceBucket } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Wrench, Zap } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { FacilitiesRouteSkeleton } from "./loading-skeletons";
import { CostPill, formatDuration } from "./shipyard-mock-shared";

export const Route = createFileRoute("/game/colony/$colonyId/facilities")({
	component: FacilitiesRoute,
});

const FACILITY_VISUALS: Record<
	FacilityKey,
	{
		description: string;
		image: string;
	}
> = {
	robotics_hub: {
		description: "Expands building queue capacity, letting you stage more upgrades in advance.",
		image: "/game-icons/facilities/robotics-hub.png",
	},
	shipyard: {
		description: "Enables ship construction and improves build throughput as the level rises.",
		image: "/game-icons/facilities/shipyard.png",
	},
	defense_grid: {
		description: "Unlocks planetary defenses and accelerates their production as the grid expands.",
		image: "/game-icons/nav/defenses.png",
	},
};

type FacilityQueueItem = {
	kind: "facilityUpgrade";
	payload: {
		facilityKey: FacilityKey;
		fromLevel: number;
		toLevel: number;
	};
	status: "active" | "queued" | "completed" | "cancelled" | "failed";
	startsAt: number;
	completesAt: number;
};

function isFacilityQueueItemPayload(item: { kind: string; payload: unknown }): item is {
	kind: "facilityUpgrade";
	payload: {
		facilityKey: FacilityKey;
		fromLevel: number;
		toLevel: number;
	};
} {
	return (
		item.kind === "facilityUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"facilityKey" in item.payload
	);
}

function isBuildingQueueItemPayload(item: { kind: string; payload: unknown }): item is {
	kind: "buildingUpgrade";
	payload: {
		buildingKey: BuildingKey;
		fromLevel: number;
		toLevel: number;
	};
} {
	return (
		item.kind === "buildingUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"buildingKey" in item.payload
	);
}

type BuildingLaneQueueItem =
	| {
			kind: "buildingUpgrade";
			payload: {
				buildingKey: BuildingKey;
				fromLevel: number;
				toLevel: number;
			};
			startsAt: number;
			completesAt: number;
	  }
	| FacilityQueueItem;

function isBuildingLaneQueueItem(item: {
	kind: string;
	payload: unknown;
}): item is BuildingLaneQueueItem {
	return isBuildingQueueItemPayload(item) || isFacilityQueueItemPayload(item);
}

const BUILDING_KEY_LABELS: Record<BuildingKey, string> = {
	alloyMineLevel: "Alloy Mine",
	crystalMineLevel: "Crystal Mine",
	fuelRefineryLevel: "Fuel Refinery",
	powerPlantLevel: "Power Plant",
	alloyStorageLevel: "Alloy Storage",
	crystalStorageLevel: "Crystal Storage",
	fuelStorageLevel: "Fuel Storage",
};

const FACILITY_KEY_LABELS: Record<FacilityKey, string> = {
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
	defense_grid: "Defense Grid",
};

function formatDurationMs(ms: number): string {
	return formatDuration(Math.max(0, Math.ceil(ms / 1_000)));
}

function getFacilityAvailabilityLabel(
	isLocked: boolean,
	isActive: boolean,
	hasQueuedItem: boolean,
): "Locked" | "Upgrading" | "Queued" | "Available" {
	if (isLocked) {
		return "Locked";
	}
	if (isActive) {
		return "Upgrading";
	}
	if (hasQueuedItem) {
		return "Queued";
	}
	return "Available";
}

function getFacilityAvailabilityClasses(
	isLocked: boolean,
	isActive: boolean,
	hasQueuedItem: boolean,
): string {
	if (isLocked) {
		return "border-amber-300/35 bg-amber-400/10 text-amber-200/80";
	}
	if (isActive) {
		return "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80";
	}
	if (hasQueuedItem) {
		return "border-cyan-300/30 bg-cyan-400/8 text-cyan-200/80";
	}
	return "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80";
}

function getUpgradeButtonLabel(
	isBusy: boolean,
	isBuildingLaneFull: boolean,
	actionLabel: "Build" | "Upgrade",
): string {
	if (isBusy) {
		return "Queueing...";
	}
	if (isBuildingLaneFull) {
		return "Queue Full";
	}
	return actionLabel;
}

function FacilitiesRoute(): ReactElement {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const facilitiesCards = useQuery(
		api.facilities.getFacilitiesCards,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const queueLanes = useQuery(
		api.colonyQueue.getColonyQueueLanes,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(isAuthenticated ? colonyIdAsId : null);
	const enqueueFacilityUpgrade = useMutation(api.facilities.enqueueFacilityUpgrade);
	const setFacilityLevels = useMutation(api.devConsole.setFacilityLevels);
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);

	const [upgradingKey, setUpgradingKey] = useState<FacilityKey | null>(null);
	const [editingFacilityKey, setEditingFacilityKey] = useState<FacilityKey | null>(null);
	const [facilityDraftValue, setFacilityDraftValue] = useState("");
	const [savingFacilityKey, setSavingFacilityKey] = useState<FacilityKey | null>(null);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;
	const canUseDevConsole = devConsoleState?.canUseDevConsole === true;

	const view = useMemo(() => {
		if (!facilitiesCards || !queueLanes) {
			return undefined;
		}
		return {
			facilities: facilitiesCards.facilities,
			queues: queueLanes,
		};
	}, [facilitiesCards, queueLanes]);

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

	const buildingLane = view?.queues.lanes.building;
	const allActiveItem = buildingLane?.activeItem ?? null;
	const allPendingItems = buildingLane?.pendingItems ?? [];

	const activeFacilityItem =
		allActiveItem && isFacilityQueueItemPayload(allActiveItem) ? allActiveItem : null;
	const pendingFacilityItems: FacilityQueueItem[] = allPendingItems.filter(
		isFacilityQueueItemPayload,
	) as FacilityQueueItem[];

	const activeLaneItem: BuildingLaneQueueItem | null =
		allActiveItem && isBuildingLaneQueueItem(allActiveItem)
			? (allActiveItem as BuildingLaneQueueItem)
			: null;
	const pendingLaneItems: BuildingLaneQueueItem[] = allPendingItems.filter(
		isBuildingLaneQueueItem,
	) as BuildingLaneQueueItem[];

	const activeItemStartsAt = (activeLaneItem as Record<string, unknown> | null)?.startsAt as
		| number
		| undefined;
	const activeItemDurationMs =
		activeLaneItem && activeItemStartsAt ? activeLaneItem.completesAt - activeItemStartsAt : 0;
	const activeUpgradeProgress =
		activeLaneItem && activeItemDurationMs > 0
			? Math.min(
					100,
					Math.max(
						0,
						((nowMs - (activeLaneItem.completesAt - activeItemDurationMs)) / activeItemDurationMs) *
							100,
					),
				)
			: 0;

	const remainingTimeLabel = activeLaneItem
		? formatDurationMs(Math.max(0, activeLaneItem.completesAt - nowMs))
		: null;

	const commitFacilityLevel = useCallback(
		async (facilityKey: FacilityKey) => {
			if (!canShowDevUi || !canUseDevConsole) {
				return;
			}
			const parsed = Math.max(0, Math.floor(Number(facilityDraftValue) || 0));
			setSavingFacilityKey(facilityKey);
			try {
				const patch: Partial<Record<FacilityKey, number>> = {
					[facilityKey]: parsed,
				};
				await setFacilityLevels({
					colonyId: colonyIdAsId,
					facilityLevels: patch,
				});
				toast.success("Facility level updated");
				setEditingFacilityKey(null);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to update facility level");
			} finally {
				setSavingFacilityKey(null);
			}
		},
		[canShowDevUi, canUseDevConsole, colonyIdAsId, facilityDraftValue, setFacilityLevels],
	);

	const completeActiveQueue = useCallback(async () => {
		if (!canShowDevUi || !canUseDevConsole || isCompletingQueueItem) {
			return;
		}
		setIsCompletingQueueItem(true);
		try {
			await completeActiveQueueItem({
				colonyId: colonyIdAsId,
				lane: "building",
			});
			toast.success("Active queue item completed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete queue item");
		} finally {
			setIsCompletingQueueItem(false);
		}
	}, [
		canShowDevUi,
		canUseDevConsole,
		colonyIdAsId,
		completeActiveQueueItem,
		isCompletingQueueItem,
	]);

	if (
		isAuthLoading ||
		(isAuthenticated && (!view || colonyResources.isLoading || !colonyResources.projected))
	) {
		return <FacilitiesRouteSkeleton />;
	}

	if (!view) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load facilities. Please sign in again.
			</div>
		);
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
					<FacilityCatalogSection
						buildingLaneIsFull={buildingLane?.isFull ?? false}
						canShowDevUi={canShowDevUi}
						canUseDevConsole={canUseDevConsole}
						availableResources={colonyResources.projected?.stored ?? null}
						facilities={view.facilities}
						activeFacilityItem={activeFacilityItem}
						editingFacilityKey={editingFacilityKey}
						facilityDraftValue={facilityDraftValue}
						pendingFacilityItems={pendingFacilityItems}
						savingFacilityKey={savingFacilityKey}
						upgradingKey={upgradingKey}
						onEditFacility={(facilityKey, currentLevel) => {
							setEditingFacilityKey(facilityKey);
							setFacilityDraftValue(String(currentLevel));
						}}
						onFacilityDraftChange={setFacilityDraftValue}
						onFacilityDraftCancel={() => {
							setEditingFacilityKey(null);
						}}
						onFacilityDraftCommit={(facilityKey) => {
							void commitFacilityLevel(facilityKey);
						}}
						onUpgrade={(facilityKey, facilityName) => {
							setUpgradingKey(facilityKey);
							enqueueFacilityUpgrade({
								colonyId: colonyIdAsId,
								facilityKey,
							})
								.then((result) => {
									if (result.status === "active") {
										toast.success(`${facilityName} upgrade started`);
									} else {
										toast.success(`${facilityName} upgrade queued`);
									}
								})
								.catch((error) => {
									toast.error(error instanceof Error ? error.message : "Failed to queue upgrade");
								})
								.finally(() => {
									setUpgradingKey(null);
								});
						}}
					/>
				</div>

				<FacilityQueuePanel
					activeLaneItem={activeLaneItem}
					activeUpgradeProgress={activeUpgradeProgress}
					canShowDevUi={canShowDevUi}
					canUseDevConsole={canUseDevConsole}
					facilities={view.facilities}
					isCompletingQueueItem={isCompletingQueueItem}
					nowMs={nowMs}
					onCompleteActiveQueue={() => {
						void completeActiveQueue();
					}}
					pendingLaneItems={pendingLaneItems}
					remainingTimeLabel={remainingTimeLabel}
				/>
			</div>
		</div>
	);
}

type FacilityCardData = {
	currentLevel: number;
	isQueued: boolean;
	isUnlocked: boolean;
	isUpgrading: boolean;
	key: FacilityKey;
	maxLevel: number;
	name: string;
	nextUpgradeCost: { alloy: number; crystal: number; fuel: number };
	nextUpgradeDurationSeconds: number | undefined;
	status: string;
};

type FacilityCatalogSectionProps = {
	activeFacilityItem: FacilityQueueItem | null;
	availableResources: ResourceBucket | null;
	buildingLaneIsFull: boolean;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	editingFacilityKey: FacilityKey | null;
	facilityDraftValue: string;
	facilities: FacilityCardData[];
	pendingFacilityItems: FacilityQueueItem[];
	savingFacilityKey: FacilityKey | null;
	upgradingKey: FacilityKey | null;
	onEditFacility: (facilityKey: FacilityKey, currentLevel: number) => void;
	onFacilityDraftCancel: () => void;
	onFacilityDraftChange: (value: string) => void;
	onFacilityDraftCommit: (facilityKey: FacilityKey) => void;
	onUpgrade: (facilityKey: FacilityKey, facilityName: string) => void;
};

function FacilityCatalogSection(props: FacilityCatalogSectionProps): ReactElement {
	return (
		<section
			className="
     overflow-hidden rounded-2xl border border-l-4 border-white/10
     border-l-violet-400/50
     bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))]
   "
			style={{
				animation: "nv-resource-card-in 400ms cubic-bezier(0.21,1,0.34,1) both",
			}}
		>
			<div
				className="
      flex flex-wrap items-center justify-between gap-2 px-4 py-3
      sm:px-5
    "
			>
				<div className="flex items-center gap-2.5">
					<span className="text-white/50">
						<Wrench className="size-4" strokeWidth={2.2} />
					</span>
					<div>
						<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">Facility Bay</h2>
						<p className="mt-0.5 text-[10px] text-white/35">
							Core infrastructure modules powering colony operations.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<span
						className="
        rounded-md border border-white/10 bg-white/3 px-2 py-0.5
        font-(family-name:--nv-font-mono) text-[9px] font-semibold text-white/50
      "
					>
						{props.facilities.length} facilities
					</span>
				</div>
			</div>
			<div
				className="
      border-t border-white/6 p-3
      sm:p-4
    "
			>
				<div
					className="
       grid gap-4
       md:grid-cols-2
     "
				>
					{props.facilities.map((facility, cardIndex) => {
						const visual = FACILITY_VISUALS[facility.key];
						const isActive = props.activeFacilityItem?.payload.facilityKey === facility.key;
						const queuedItem = props.pendingFacilityItems.find(
							(item) => item.payload.facilityKey === facility.key,
						);
						const isBusy = props.upgradingKey === facility.key;
						const actionLabel: "Build" | "Upgrade" =
							facility.currentLevel <= 0 ? "Build" : "Upgrade";
						const durationLabel = facility.nextUpgradeDurationSeconds
							? formatDuration(facility.nextUpgradeDurationSeconds)
							: null;
						const isLocked = facility.status === "Locked";
						const isMaxLevel = facility.nextUpgradeDurationSeconds === undefined;
						const hasRequiredResources =
							props.availableResources !== null &&
							props.availableResources.alloy >= facility.nextUpgradeCost.alloy &&
							props.availableResources.crystal >= facility.nextUpgradeCost.crystal &&
							props.availableResources.fuel >= facility.nextUpgradeCost.fuel;
						const isActionDisabled =
							isLocked || isMaxLevel || props.buildingLaneIsFull || isBusy || !hasRequiredResources;
						const availabilityLabel = getFacilityAvailabilityLabel(
							isLocked,
							isActive,
							Boolean(queuedItem),
						);
						const availabilityClasses = getFacilityAvailabilityClasses(
							isLocked,
							isActive,
							Boolean(queuedItem),
						);
						const buttonLabel = getUpgradeButtonLabel(
							isBusy,
							props.buildingLaneIsFull,
							actionLabel,
						);

						return (
							<article
								className={`
          group relative overflow-hidden rounded-xl border
          ${isLocked ? "border-white/8 opacity-60 grayscale" : `border-white/10`}
          bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
          text-[13px]
        `}
								key={facility.key}
								style={{
									animation: "nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both",
									animationDelay: `${120 + cardIndex * 60}ms`,
								}}
							>
								<div
									className="pointer-events-none absolute inset-x-0 top-0 h-px"
									style={{
										background:
											"linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)",
									}}
								/>
								<div
									className="
           pointer-events-none absolute -top-8 -right-8 size-32 rounded-full
           blur-3xl
         "
									style={{ background: "rgba(167,139,250,0.08)" }}
								/>
								<div className="relative z-10 p-4">
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-center gap-2.5">
											<img
												alt={facility.name}
												className="
              size-8 rounded-lg border border-white/8 bg-black/30 object-contain
              p-1
            "
												src={visual.image}
											/>
											<h3 className="
             font-(family-name:--nv-font-display) text-sm font-bold
           ">
												{facility.name}
											</h3>
										</div>
										<div className="flex items-center gap-1.5">
											{props.canShowDevUi && props.editingFacilityKey === facility.key ? (
												<input
													autoFocus
													className="
               inline-flex h-6 w-14 items-center justify-center rounded-md
               border border-violet-300/35 bg-black/45 px-1 text-center
               font-(family-name:--nv-font-mono) text-[10px] font-bold
               text-violet-100 outline-none
               focus:border-violet-200/60
             "
													inputMode="numeric"
													onBlur={props.onFacilityDraftCancel}
													onChange={(event) => {
														props.onFacilityDraftChange(event.target.value.replace(/[^\d]/g, ""));
													}}
													onKeyDown={(event) => {
														if (event.key === "Escape") {
															props.onFacilityDraftCancel();
															return;
														}
														if (event.key === "Enter") {
															event.preventDefault();
															props.onFacilityDraftCommit(facility.key);
														}
													}}
													value={props.facilityDraftValue}
												/>
											) : props.canShowDevUi ? (
												<button
													className="
               inline-flex size-6 items-center justify-center rounded-md border
               border-violet-300/20 bg-violet-400/8
               font-(family-name:--nv-font-mono) text-[10px] font-bold
               text-violet-100 transition
               hover:border-violet-200/45 hover:bg-violet-400/14
               disabled:cursor-not-allowed disabled:opacity-50
             "
													disabled={
														!props.canShowDevUi ||
														!props.canUseDevConsole ||
														props.savingFacilityKey === facility.key
													}
													onClick={() => props.onEditFacility(facility.key, facility.currentLevel)}
													type="button"
													title={`Level ${facility.currentLevel}`}
												>
													{facility.currentLevel}
												</button>
											) : (
												<span
													className="
               inline-flex size-6 items-center justify-center rounded-md border
               border-white/15 bg-black/25 font-(family-name:--nv-font-mono)
               text-[10px] font-bold text-white/80
             "
													title={`Level ${facility.currentLevel}`}
												>
													{facility.currentLevel}
												</span>
											)}
										</div>
									</div>

									<p className={`
           mt-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5
           text-[9px] font-semibold whitespace-nowrap uppercase
           ${availabilityClasses}
         `}>{availabilityLabel}</p>

									<div className="mt-3 flex items-center justify-center">
										<div
											className="
             relative size-28 rounded-full border border-white/6 bg-black/20 p-2
           "
										>
											<img
												alt={`${facility.name} render`}
												className="size-full object-contain"
												src={visual.image}
											/>
										</div>
									</div>

									<p className="mt-3 text-[11px] leading-relaxed text-white/50">
										{visual.description}
									</p>

									<div className="mt-2.5 grid grid-cols-2 gap-1.5">
										<div
											className="
             rounded-lg border border-white/6 bg-black/20 px-2 py-1.5
             text-center
           "
										>
											<p className="text-[7px] tracking-widest text-white/30 uppercase">Level</p>
											<p
												className="
              mt-0.5 font-(family-name:--nv-font-mono) text-[10px] font-bold
              text-white/80
            "
											>
												{facility.currentLevel}
											</p>
										</div>
										<div
											className="
             rounded-lg border border-white/6 bg-black/20 px-2 py-1.5
             text-center
           "
										>
											<p className="text-[7px] tracking-widest text-white/30 uppercase">
												Build Time
											</p>
											<p
												className="
              mt-0.5 font-(family-name:--nv-font-mono) text-[10px] font-bold
              text-white/80
            "
											>
												{durationLabel ?? "—"}
											</p>
										</div>
									</div>

									<div className="mt-3 border-t border-white/6 pt-3">
										<button
											className="
             flex w-full items-center justify-center gap-2 rounded-xl border
             border-violet-200/50 bg-linear-to-b from-violet-400/25
             to-violet-400/10 px-4 py-2.5 font-(family-name:--nv-font-display)
             text-xs font-bold tracking-[0.08em] text-violet-50 uppercase
             shadow-[0_0_20px_rgba(167,139,250,0.12)] transition-all
             hover:-translate-y-0.5 hover:border-violet-100/70
             hover:shadow-[0_0_30px_rgba(167,139,250,0.25)]
             disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/5
             disabled:text-white/30 disabled:shadow-none
           "
											disabled={isActionDisabled}
											onClick={() => props.onUpgrade(facility.key, facility.name)}
											type="button"
										>
											<Zap className="size-3.5" />
											{buttonLabel}
										</button>

										<div className="mt-2 flex flex-wrap justify-center gap-1.5">
											<CostPill
												amount={facility.nextUpgradeCost.alloy}
												kind="alloy"
												label="Alloy"
											/>
											<CostPill
												amount={facility.nextUpgradeCost.crystal}
												kind="crystal"
												label="Crystal"
											/>
											<CostPill amount={facility.nextUpgradeCost.fuel} kind="fuel" label="Fuel" />
										</div>
									</div>
								</div>
							</article>
						);
					})}
				</div>
			</div>
		</section>
	);
}

type FacilityQueuePanelProps = {
	activeLaneItem: BuildingLaneQueueItem | null;
	activeUpgradeProgress: number;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	facilities: FacilityCardData[];
	isCompletingQueueItem: boolean;
	nowMs: number;
	onCompleteActiveQueue: () => void;
	pendingLaneItems: BuildingLaneQueueItem[];
	remainingTimeLabel: string | null;
};

function laneItemLabel(item: BuildingLaneQueueItem): string {
	if (item.kind === "buildingUpgrade") {
		return BUILDING_KEY_LABELS[item.payload.buildingKey] ?? item.payload.buildingKey;
	}
	return FACILITY_KEY_LABELS[item.payload.facilityKey] ?? item.payload.facilityKey;
}

function FacilityQueuePanel(props: FacilityQueuePanelProps): ReactElement {
	const totalQueueItems = (props.activeLaneItem ? 1 : 0) + props.pendingLaneItems.length;

	return (
		<div className="lg:sticky lg:top-4 lg:self-start">
			<div
				className="
      rounded-2xl border border-white/12
      bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
    "
			>
				<div className="
      flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
    ">
					<Clock3 className="size-5 text-violet-300" />
					<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">Building Queue</h2>
					{totalQueueItems > 0 ? (
						<span
							className="
         ml-auto font-(family-name:--nv-font-mono) text-[9px] text-white/30
       "
						>
							{totalQueueItems} item{totalQueueItems !== 1 ? "s" : ""}
						</span>
					) : null}
				</div>

				<div className="p-5">
					{props.activeLaneItem ? (
						<div className="space-y-3">
							<p
								className="
          text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
        "
							>
								Active
							</p>
							<div className="
         rounded-xl border border-emerald-300/20 bg-emerald-400/4 p-3
       ">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-xs font-semibold">{laneItemLabel(props.activeLaneItem)}</p>
										<p
											className="
             mt-0.5 font-(family-name:--nv-font-mono) text-[10px] text-white/40
           "
										>
											Lv {props.activeLaneItem.payload.fromLevel} →{" "}
											{props.activeLaneItem.payload.toLevel}
										</p>
									</div>
									<div className="text-right">
										<p
											className="
             font-(family-name:--nv-font-mono) text-xs font-bold
             text-emerald-200
           "
										>
											{props.remainingTimeLabel ?? "—"}
										</p>
										<p
											className="
             font-(family-name:--nv-font-mono) text-[8px] tracking-widest
             text-emerald-200/45 uppercase
           "
										>
											remaining
										</p>
									</div>
								</div>

								<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/8">
									<div
										className="
            h-full rounded-full bg-linear-to-r from-emerald-400/60
            to-emerald-300/40 transition-all
          "
										style={{
											width: `${props.activeUpgradeProgress}%`,
										}}
									/>
								</div>
								<div className="mt-1 flex items-center justify-between">
									<span className="
           font-(family-name:--nv-font-mono) text-[9px] text-white/25
         ">
										{Math.round(props.activeUpgradeProgress)}%
									</span>
									<span
										className="
            inline-flex items-center gap-1 text-[9px] text-emerald-300/60
          "
									>
										<span
											className="inline-block size-1.5 rounded-full bg-emerald-400"
											style={{
												animation: "nv-queue-pulse 2s ease-in-out infinite",
											}}
										/>
										In progress
									</span>
								</div>
								{props.canShowDevUi ? (
									<button
										className="
            mt-2 inline-flex items-center gap-1 rounded-md border
            border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium
            text-cyan-100 transition
            hover:border-cyan-200/55 hover:bg-cyan-400/16
            disabled:cursor-not-allowed disabled:opacity-50
          "
										disabled={props.isCompletingQueueItem || !props.canUseDevConsole}
										onClick={props.onCompleteActiveQueue}
										type="button"
									>
										{props.isCompletingQueueItem ? "Completing..." : "Complete"}
									</button>
								) : null}
							</div>
						</div>
					) : null}

					{props.pendingLaneItems.length > 0 ? (
						<div className={props.activeLaneItem ? "mt-4" : ""}>
							<p
								className="
          text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
        "
							>
								Pending ({props.pendingLaneItems.length})
							</p>
							<div className="mt-2 space-y-1">
								{props.pendingLaneItems.map((item, i) => {
									const itemStartsAt = (item as Record<string, unknown>).startsAt as
										| number
										| undefined;
									const itemDurationMs =
										itemStartsAt && itemStartsAt > 0 ? item.completesAt - itemStartsAt : 0;

									return (
										<div
											className="
             flex items-center justify-between rounded-lg border border-white/6
             bg-white/2 px-3 py-2
           "
											key={`pending-${item.kind}-${item.completesAt}-${item.payload.toLevel}`}
										>
											<div className="flex items-center gap-2">
												<span
													className="
               flex size-5 items-center justify-center rounded-sm
               font-(family-name:--nv-font-mono) text-[9px] font-bold
               text-white/25
             "
												>
													{i + 1}
												</span>
												<div>
													<p className="text-[11px] font-semibold text-white/80">
														{laneItemLabel(item)}
													</p>
													<p
														className="
                font-(family-name:--nv-font-mono) text-[9px] text-white/30
              "
													>
														Lv {item.payload.fromLevel} → {item.payload.toLevel}
													</p>
												</div>
											</div>
											<div className="text-right">
												<p
													className="
               font-(family-name:--nv-font-mono) text-[10px] text-white/35
             "
												>
													{itemDurationMs > 0
														? formatDurationMs(itemDurationMs)
														: formatDurationMs(item.completesAt - props.nowMs)}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : null}

					{!props.activeLaneItem && props.pendingLaneItems.length === 0 ? (
						<div className="flex flex-col items-center py-8 text-center">
							<div
								className="
          flex size-12 items-center justify-center rounded-full border
          border-white/8 bg-white/3
        "
							>
								<Clock3 className="size-5 text-white/20" />
							</div>
							<p className="mt-3 text-xs font-medium text-white/30">No upgrades in progress</p>
							<p className="mt-1 text-[10px] text-white/18">Select a facility to begin upgrading</p>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
