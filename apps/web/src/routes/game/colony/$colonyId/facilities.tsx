import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, FacilityKey, ResourceBucket } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3, Wrench, Zap } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FacilitiesRouteSkeleton } from "@/features/colony-route/loading-skeletons";
import { useColonyView, useOptimisticColonyMutation } from "@/features/colony-state/hooks";
import { getUpgradeActionPresentation } from "@/features/colony-ui/action-state";
import { ActionButton } from "@/features/colony-ui/components/action-button";
import { CostPill } from "@/features/colony-ui/components/cost-pill";
import { DevNumberInput } from "@/features/colony-ui/components/dev-number-input";
import { QueuePanel } from "@/features/colony-ui/components/queue-panel";
import { StatusBadge } from "@/features/colony-ui/components/status-badge";
import { useColonyDevConsole } from "@/features/colony-ui/hooks/use-colony-dev-console";
import { useInlineNumberEditor } from "@/features/colony-ui/hooks/use-inline-number-editor";
import {
	BUILDING_KEY_LABELS,
	isBuildingLaneQueueRow,
	isFacilityQueueRow,
	type BuildingLaneQueueRow,
	type FacilityQueueRow,
} from "@/features/colony-ui/queue-items";
import { formatQueueRemainingLabel, getQueueProgress } from "@/features/colony-ui/queue-state";
import { formatColonyDuration } from "@/features/colony-ui/time";
import { useConvexAuth, useQuery } from "@/lib/convex-hooks";

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

const FACILITY_KEY_LABELS: Record<FacilityKey, string> = {
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
	defense_grid: "Defense Grid",
};

function FacilitiesRoute(): ReactElement {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const navigate = useNavigate();

	const colonyView = useColonyView(isAuthenticated ? colonyIdAsId : null);
	const progressionOverview = useQuery(api.progression.getOverview, isAuthenticated ? {} : "skip");
	const devConsole = useColonyDevConsole(isAuthenticated ? colonyIdAsId : null);
	const enqueueFacilityUpgrade = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; facilityKey: FacilityKey }) => ({
			facilityKey: args.facilityKey,
			type: "enqueueFacilityUpgrade",
		}),
		mutation: api.facilities.enqueueFacilityUpgrade,
	});

	const [upgradingKey, setUpgradingKey] = useState<FacilityKey | null>(null);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const facilityEditor = useInlineNumberEditor<FacilityKey>();
	const canShowDevUi = devConsole.canShowDevUi;
	const canUseDevConsole = devConsole.canUseDevConsole;

	const view = useMemo(() => {
		if (!colonyView) {
			return undefined;
		}
		const visibleFacilities = progressionOverview?.facilityAccess
			? colonyView.facilities.filter(
					(facility) => progressionOverview.facilityAccess[facility.key] === "unlocked",
				)
			: colonyView.facilities;
		return {
			facilities: visibleFacilities,
			queues: colonyView.queueLanes,
		};
	}, [colonyView, progressionOverview?.facilityAccess]);

	useEffect(() => {
		if (
			!isAuthenticated ||
			!progressionOverview ||
			progressionOverview.features.facilities === "unlocked"
		) {
			return;
		}
		void navigate({
			params: { colonyId },
			replace: true,
			to: "/game/colony/$colonyId/resources",
		});
	}, [colonyId, isAuthenticated, navigate, progressionOverview]);

	const nowMs = colonyView?.nowMs ?? Date.now();

	const buildingLane = view?.queues.lanes.building;
	const allActiveItem = buildingLane?.activeItem ?? null;
	const allPendingItems = buildingLane?.pendingItems ?? [];

	const activeFacilityItem =
		allActiveItem && isFacilityQueueRow(allActiveItem) ? allActiveItem : null;
	const pendingFacilityItems: FacilityQueueRow[] = allPendingItems.filter(isFacilityQueueRow);

	const activeLaneItem: BuildingLaneQueueRow | null =
		allActiveItem && isBuildingLaneQueueRow(allActiveItem) ? allActiveItem : null;
	const pendingLaneItems: BuildingLaneQueueRow[] = allPendingItems.filter(isBuildingLaneQueueRow);

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
			try {
				const patch: Partial<Record<FacilityKey, number>> = {
					[facilityKey]: Math.max(0, Math.floor(Number(facilityEditor.draftValue) || 0)),
				};
				await devConsole.actions.setFacilityLevels(patch);
				toast.success("Facility level updated");
				facilityEditor.cancelEditing();
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to update facility level");
			}
		},
		[canShowDevUi, canUseDevConsole, devConsole.actions, facilityEditor],
	);

	const completeActiveQueue = useCallback(async () => {
		if (!canShowDevUi || !canUseDevConsole || isCompletingQueueItem) {
			return;
		}
		setIsCompletingQueueItem(true);
		try {
			await devConsole.actions.completeQueue("building");
			toast.success("Active queue item completed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete queue item");
		} finally {
			setIsCompletingQueueItem(false);
		}
	}, [canShowDevUi, canUseDevConsole, devConsole.actions, isCompletingQueueItem]);

	if (isAuthLoading || (isAuthenticated && !view)) {
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
						availableResources={colonyView?.projected.resources ?? null}
						facilities={view.facilities}
						activeFacilityItem={activeFacilityItem}
						editingFacilityKey={facilityEditor.editingKey}
						facilityDraftValue={facilityEditor.draftValue}
						pendingFacilityItems={pendingFacilityItems}
						savingFacilityKey={facilityEditor.savingKey}
						upgradingKey={upgradingKey}
						onEditFacility={(facilityKey, currentLevel) => {
							facilityEditor.startEditing(facilityKey, currentLevel);
						}}
						onFacilityDraftChange={facilityEditor.setDraftValue}
						onFacilityDraftCancel={facilityEditor.cancelEditing}
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
	activeFacilityItem: FacilityQueueRow | null;
	availableResources: ResourceBucket | null;
	buildingLaneIsFull: boolean;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	editingFacilityKey: FacilityKey | null;
	facilityDraftValue: string;
	facilities: FacilityCardData[];
	pendingFacilityItems: FacilityQueueRow[];
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
												<DevNumberInput
													autoFocus
													onBlur={props.onFacilityDraftCancel}
													onCancel={props.onFacilityDraftCancel}
													onChange={props.onFacilityDraftChange}
													onCommit={() => props.onFacilityDraftCommit(facility.key)}
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
	activeLaneItem: BuildingLaneQueueRow | null;
	activeUpgradeProgress: number;
	canShowDevUi: boolean;
	canUseDevConsole: boolean;
	facilities: FacilityCardData[];
	isCompletingQueueItem: boolean;
	nowMs: number;
	onCompleteActiveQueue: () => void;
	pendingLaneItems: BuildingLaneQueueRow[];
	remainingTimeLabel: string | null;
};

function laneItemLabel(item: BuildingLaneQueueRow): string {
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
		remainingLabel: formatQueueRemainingLabel(props.nowMs, item.completesAt),
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
							disabled={
								!props.activeLaneItem || props.isCompletingQueueItem || !props.canUseDevConsole
							}
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
