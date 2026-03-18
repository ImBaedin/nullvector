import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, FacilityKey, ResourceBucket } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Wrench, Zap } from "lucide-react";
import { type ReactElement, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useColonySelectors, useOptimisticColonyMutation } from "@/features/colony-state/hooks";
import { getUpgradeActionPresentation } from "@/features/colony-ui/action-state";
import { ActionButton } from "@/features/colony-ui/components/action-button";
import { CostPill } from "@/features/colony-ui/components/cost-pill";
import { QueuePanel } from "@/features/colony-ui/components/queue-panel";
import { StatusBadge } from "@/features/colony-ui/components/status-badge";
import { formatQueueRemainingLabel, getQueueProgress } from "@/features/colony-ui/queue-state";
import { formatColonyDuration } from "@/features/colony-ui/time";
import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { FacilitiesRouteSkeleton } from "./loading-skeletons";

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

function FacilitiesRoute(): ReactElement {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const colonySelectors = useColonySelectors(isAuthenticated ? colonyIdAsId : null);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(isAuthenticated ? colonyIdAsId : null);
	const enqueueFacilityUpgrade = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; facilityKey: FacilityKey }) => ({
			facilityKey: args.facilityKey,
			type: "enqueueFacilityUpgrade",
		}),
		mutation: api.facilities.enqueueFacilityUpgrade,
	});
	const setFacilityLevels = useMutation(api.devConsole.setFacilityLevels);
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);

	const [upgradingKey, setUpgradingKey] = useState<FacilityKey | null>(null);
	const [editingFacilityKey, setEditingFacilityKey] = useState<FacilityKey | null>(null);
	const [facilityDraftValue, setFacilityDraftValue] = useState("");
	const [savingFacilityKey, setSavingFacilityKey] = useState<FacilityKey | null>(null);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;
	const canUseDevConsole = devConsoleState?.canUseDevConsole === true;

	const view = useMemo(() => {
		if (!colonySelectors) {
			return undefined;
		}
		return {
			facilities: colonySelectors.facilities,
			queues: colonySelectors.queueLanes,
		};
	}, [colonySelectors]);

	const nowMs = colonyResources.nowMs;

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

	const activeUpgradeProgress = activeLaneItem
		? getQueueProgress(nowMs, activeLaneItem.startsAt, activeLaneItem.completesAt).percent
		: 0;

	const remainingTimeLabel = activeLaneItem
		? formatQueueRemainingLabel(nowMs, activeLaneItem.completesAt)
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
							? formatColonyDuration(facility.nextUpgradeDurationSeconds, "seconds")
							: null;
						const isLocked = facility.status === "Locked";
						const isMaxLevel = facility.nextUpgradeDurationSeconds === undefined;
						const actionPresentation = getUpgradeActionPresentation({
							actionLabel,
							availableResources: props.availableResources,
							cost: facility.nextUpgradeCost,
							hasQueuedItem: Boolean(queuedItem),
							isActive,
							isBusy,
							isLocked,
							isMaxLevel,
							isQueueFull: props.buildingLaneIsFull,
						});

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
											<h3
												className="font-(family-name:--nv-font-display) text-sm font-bold"
											>
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

									<StatusBadge
										className="mt-2"
										label={actionPresentation.badgeLabel}
										tone={actionPresentation.badgeTone}
									/>

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
										<ActionButton
											className="w-full"
											disabled={!actionPresentation.isActionEnabled}
											label={actionPresentation.buttonLabel}
											leadingIcon={<Zap className="size-3.5" />}
											loading={isBusy}
											onClick={() => props.onUpgrade(facility.key, facility.name)}
											tone="facility"
										/>

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
	const activeItem = props.activeLaneItem
		? {
				id: `${props.activeLaneItem.kind}-${props.activeLaneItem.completesAt}`,
				isActive: true,
				remainingLabel: props.remainingTimeLabel ?? undefined,
				subtitle: `Lv ${props.activeLaneItem.payload.fromLevel} → ${props.activeLaneItem.payload.toLevel}`,
				title: laneItemLabel(props.activeLaneItem),
			}
		: null;
	const pendingItems = props.pendingLaneItems.map((item) => ({
		id: `${item.kind}-${item.completesAt}-${item.payload.toLevel}`,
		isActive: false,
		remainingLabel: formatColonyDuration(
			Math.max(0, item.completesAt - props.nowMs),
			"milliseconds",
		),
		subtitle: `Lv ${item.payload.fromLevel} → ${item.payload.toLevel}`,
		title: laneItemLabel(item),
	}));

	return (
		<div className="lg:sticky lg:top-4 lg:self-start">
			<QueuePanel
				activeItem={activeItem}
				activeProgressPercent={props.activeUpgradeProgress}
				completeAction={
					props.canShowDevUi ? (
						<button
							className="
         inline-flex items-center gap-1 rounded-md border border-cyan-300/30
         bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-100
         transition
         hover:border-cyan-200/55 hover:bg-cyan-400/16
         disabled:cursor-not-allowed disabled:opacity-50
       "
							disabled={props.isCompletingQueueItem || !props.canUseDevConsole}
							onClick={props.onCompleteActiveQueue}
							type="button"
						>
							{props.isCompletingQueueItem ? "Completing..." : "Complete"}
						</button>
					) : null
				}
				emptyDescription="Select a facility to begin upgrading"
				emptyTitle="No upgrades in progress"
				headerIcon={<Clock3 className="size-5 text-violet-300" />}
				pendingItems={pendingItems}
				theme="facility"
				title="Building Queue"
				totalCount={totalQueueItems}
			/>
		</div>
	);
}
