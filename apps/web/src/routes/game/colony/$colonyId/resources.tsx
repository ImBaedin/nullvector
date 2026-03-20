import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, FacilityKey, LaneQueueItem } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { BatteryCharging, Clock3, Droplets, Factory, Gem, Pickaxe, Radar } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ResourcesRouteSkeleton } from "@/features/colony-route/loading-skeletons";
import { ResourceBuildingCard } from "@/features/colony-route/resource-building-card";
import { useColonyView, useOptimisticColonyMutation } from "@/features/colony-state/hooks";
import { DevNumberInput } from "@/features/colony-ui/components/dev-number-input";
import { QueuePanel } from "@/features/colony-ui/components/queue-panel";
import { useColonyDevConsole } from "@/features/colony-ui/hooks/use-colony-dev-console";
import { useInlineNumberEditor } from "@/features/colony-ui/hooks/use-inline-number-editor";
import {
	BUILDING_KEY_LABELS,
	FACILITY_KEY_LABELS,
	isBuildingLaneQueueRow,
	isBuildingQueueRow,
	type BuildingLaneQueueRow,
} from "@/features/colony-ui/queue-items";
import { getQueueProgress } from "@/features/colony-ui/queue-state";
import { formatColonyDuration } from "@/features/colony-ui/time";
import { formatResourceValue } from "@/lib/colony-resource-simulation";
import { useConvexAuth } from "@/lib/convex-hooks";

export const Route = createFileRoute("/game/colony/$colonyId/resources")({
	component: ResourcesRoute,
});

type GroupVisual = {
	accentBorder: string;
	accentDot: string;
	description: string;
	icon: ReactNode;
	label: string;
};

const GROUP_VISUALS = {
	alloy: {
		accentBorder: "border-l-cyan-400/50",
		accentDot: "bg-cyan-400",
		description: "Alloy extraction, refining, and storage.",
		icon: <Pickaxe className="size-4" strokeWidth={2.2} />,
		label: "Alloy Operations",
	},
	crystal: {
		accentBorder: "border-l-indigo-400/50",
		accentDot: "bg-indigo-400",
		description: "Crystal mining, processing, and storage.",
		icon: <Gem className="size-4" strokeWidth={2.2} />,
		label: "Crystal Operations",
	},
	fuel: {
		accentBorder: "border-l-orange-400/50",
		accentDot: "bg-orange-400",
		description: "Fuel refinement, synthesis, and storage.",
		icon: <Droplets className="size-4" strokeWidth={2.2} />,
		label: "Fuel Operations",
	},
	power: {
		accentBorder: "border-l-amber-400/50",
		accentDot: "bg-amber-400",
		description: "Planetary grid generation and voltage control.",
		icon: <BatteryCharging className="size-4" strokeWidth={2.2} />,
		label: "Power Grid",
	},
	special: {
		accentBorder: "border-l-violet-400/50",
		accentDot: "bg-violet-400",
		description: "Specialized industrial lines and support systems.",
		icon: <Radar className="size-4" strokeWidth={2.2} />,
		label: "Special Ops",
	},
} satisfies Record<string, GroupVisual>;

const EMPTY_BUILDING_LEVELS: Record<BuildingKey, number> = {
	alloyMineLevel: 0,
	crystalMineLevel: 0,
	fuelRefineryLevel: 0,
	powerPlantLevel: 0,
	alloyStorageLevel: 0,
	crystalStorageLevel: 0,
	fuelStorageLevel: 0,
};

type GeneratorGroupId = keyof typeof GROUP_VISUALS;
type ResourceKey = "alloy" | "crystal" | "fuel";
const DEV_RESOURCE_KEYS = ["alloy", "crystal", "fuel"] as const satisfies ResourceKey[];

function resolveGroupIdForBuilding(building: {
	group: string;
	key: BuildingKey;
}): GeneratorGroupId {
	if (building.key === "alloyMineLevel" || building.key === "alloyStorageLevel") {
		return "alloy";
	}
	if (building.key === "crystalMineLevel" || building.key === "crystalStorageLevel") {
		return "crystal";
	}
	if (building.key === "fuelRefineryLevel" || building.key === "fuelStorageLevel") {
		return "fuel";
	}
	if (building.key === "powerPlantLevel") {
		return "power";
	}
	return "special";
}

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

function ResourcesRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const colonyView = useColonyView(isAuthenticated ? colonyIdAsId : null);
	const devConsole = useColonyDevConsole(isAuthenticated ? colonyIdAsId : null);
	const view = useMemo(() => {
		if (!colonyView) {
			return undefined;
		}
		return {
			queues: colonyView.queueLanes,
			buildings: colonyView.buildingCards,
			colony: {
				addressLabel: colonyView.snapshot.addressLabel,
				id: colonyView.snapshot.colonyId,
				lastAccruedAt: colonyView.snapshot.lastAccruedAt,
				name: colonyView.snapshot.name,
			},
			planetMultipliers: colonyView.snapshot.planetMultipliers,
			resources: {
				energyConsumed: colonyView.projected.energyConsumed,
				energyProduced: colonyView.projected.energyProduced,
				energyRatio: colonyView.projected.energyRatio,
				overflow: colonyView.snapshot.overflow,
				ratesPerMinute: colonyView.projected.ratesPerMinute,
				storageCaps: colonyView.snapshot.storageCaps,
				stored: colonyView.snapshot.resources,
			},
		};
	}, [colonyView]);
	const enqueueBuildingUpgrade = useOptimisticColonyMutation({
		intentFromArgs: (args: { buildingKey: BuildingKey; colonyId: Id<"colonies"> }) => ({
			buildingKey: args.buildingKey,
			type: "enqueueBuildingUpgrade",
		}),
		mutation: api.resources.enqueueBuildingUpgrade,
	});

	const [activeTableBuildingKey, setActiveTableBuildingKey] = useState<BuildingKey | null>(null);
	const [upgradingKey, setUpgradingKey] = useState<BuildingKey | null>(null);
	const [savingBuildingLevelKey, setSavingBuildingLevelKey] = useState<BuildingKey | null>(null);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const resourceEditor = useInlineNumberEditor<ResourceKey>();
	const canShowDevUi = devConsole.canShowDevUi;
	const canUseDevConsole = devConsole.canUseDevConsole;
	const nowMs = colonyView?.nowMs ?? Date.now();
	const projectedResources = colonyView
		? {
				energyRatio: colonyView.projected.energyRatio,
				overflow: colonyView.projected.overflow,
				ratesPerMinute: colonyView.projected.ratesPerMinute,
				storageCaps: colonyView.projected.storageCaps,
				stored: colonyView.projected.resources,
			}
		: null;

	const buildingQueue = view?.queues.lanes.building;
	const activeQueueItem = buildingQueue?.activeItem;
	const pendingQueueItems = buildingQueue?.pendingItems ?? [];
	const activeLaneQueueItem: BuildingLaneQueueRow | null =
		activeQueueItem && isBuildingLaneQueueRow(activeQueueItem) ? activeQueueItem : null;
	const pendingLaneQueueItems: BuildingLaneQueueRow[] =
		pendingQueueItems.filter(isBuildingLaneQueueRow);
	const activeBuildingQueueItem: LaneQueueItem | null =
		activeQueueItem && isBuildingQueueRow(activeQueueItem) ? activeQueueItem : null;
	const pendingBuildingQueueItems: LaneQueueItem[] = pendingQueueItems.filter(isBuildingQueueRow);
	const remainingTimeLabel = activeQueueItem
		? formatColonyDuration(Math.max(0, activeQueueItem.completesAt - nowMs), "milliseconds")
		: null;
	const groupedBuildings = useMemo(() => {
		const groups = new Map<
			GeneratorGroupId,
			{
				groupId: GeneratorGroupId;
				groupLabel: string;
				buildings: NonNullable<typeof view>["buildings"];
			}
		>();

		for (const building of view?.buildings ?? []) {
			const groupId = resolveGroupIdForBuilding(building);
			const existingGroup = groups.get(groupId);

			if (existingGroup) {
				existingGroup.buildings.push(building);
				continue;
			}

			groups.set(groupId, {
				buildings: [building],
				groupId,
				groupLabel: building.group,
			});
		}

		return [...groups.values()];
	}, [view?.buildings]);
	const buildingLevels = useMemo(() => {
		const levels = { ...EMPTY_BUILDING_LEVELS };
		for (const building of view?.buildings ?? []) {
			levels[building.key] = building.currentLevel;
		}
		return levels;
	}, [view?.buildings]);

	const totalBuildings = view?.buildings.length ?? 0;
	const activeUpgradeProgress = activeLaneQueueItem
		? getQueueProgress(nowMs, activeLaneQueueItem.startsAt, activeLaneQueueItem.completesAt).percent
		: 0;
	const commitResourceEdit = useCallback(async () => {
		if (!canShowDevUi || !resourceEditor.editingKey || !canUseDevConsole) {
			return;
		}

		try {
			const resourcePatch: Partial<Record<ResourceKey, number>> = {
				[resourceEditor.editingKey]: Math.max(
					0,
					Math.floor(Number(resourceEditor.draftValue) || 0),
				),
			};
			await devConsole.actions.setResources(resourcePatch);
			resourceEditor.cancelEditing();
			toast.success("Resource updated");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update resource");
		}
	}, [canShowDevUi, canUseDevConsole, devConsole.actions, resourceEditor]);

	const commitBuildingLevel = useCallback(
		async (buildingKey: BuildingKey, nextLevel: number) => {
			if (!canShowDevUi || !canUseDevConsole) {
				return;
			}
			setSavingBuildingLevelKey(buildingKey);
			try {
				const patch: Partial<Record<BuildingKey, number>> = {
					[buildingKey]: nextLevel,
				};
				await devConsole.actions.setBuildingLevels(patch);
				toast.success("Building level updated");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to update building level");
			} finally {
				setSavingBuildingLevelKey(null);
			}
		},
		[canShowDevUi, canUseDevConsole, devConsole.actions],
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
		return <ResourcesRouteSkeleton />;
	}

	if (!view) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load colony resources. Please sign in again.
			</div>
		);
	}

	let cardIndex = 0;

	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
      grid gap-5
      lg:grid-cols-[minmax(0,1fr)_450px]
    "
			>
				{/* ══ Left Column: Summary + Building Groups ══ */}
				<div className="space-y-5">
					{/* Production Summary Strip */}
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
								<Factory className="size-4 text-cyan-300" />
							</div>
							<div>
								<h1 className="font-(family-name:--nv-font-display) text-lg font-bold">
									Infrastructure
								</h1>
								<p className="text-[10px] text-white/40">
									{totalBuildings} structures
									{activeLaneQueueItem ? " \u2022 1 upgrading" : ""}
									{pendingLaneQueueItems.length > 0
										? ` \u2022 ${pendingLaneQueueItems.length} queued`
										: ""}
								</p>
							</div>
						</div>

						<div className="mt-4 flex gap-3 overflow-x-auto pb-1">
							{DEV_RESOURCE_KEYS.map((resourceKey) => {
								const res = {
									key: resourceKey,
									label:
										resourceKey === "fuel" ? "Fuel" : resourceKey === "alloy" ? "Alloy" : "Crystal",
									icon:
										resourceKey === "fuel"
											? "/game-icons/deuterium.png"
											: resourceKey === "alloy"
												? "/game-icons/alloy.png"
												: "/game-icons/crystal.png",
								} as const;
								const stored =
									projectedResources?.stored[res.key] ?? view.resources.stored[res.key];
								const overflow =
									projectedResources?.overflow[res.key] ?? view.resources.overflow[res.key];
								const cap =
									projectedResources?.storageCaps[res.key] ?? view.resources.storageCaps[res.key];
								const pct = cap > 0 ? Math.min(100, (stored / cap) * 100) : 0;

								return (
									<div
										className="
            flex min-w-[170px] flex-1 items-center gap-3 rounded-xl border
            border-white/8 bg-white/2.5 p-3
          "
										key={res.key}
									>
										<img
											alt={res.label}
											className="
             size-10 rounded-lg border border-white/8 bg-black/30 object-contain
             p-1.5
           "
											src={res.icon}
										/>
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold">{res.label}</p>
											<div className="mt-0.5 flex items-baseline gap-1.5">
												{canShowDevUi && resourceEditor.isEditing(res.key) ? (
													<DevNumberInput
														autoFocus
														onBlur={resourceEditor.cancelEditing}
														onCancel={resourceEditor.cancelEditing}
														onChange={resourceEditor.setDraftValue}
														onCommit={() => {
															void commitResourceEdit();
														}}
														value={resourceEditor.draftValue}
													/>
												) : (
													<button
														className="
                font-(family-name:--nv-font-mono) text-[11px] font-semibold
                text-cyan-100 transition
                hover:text-cyan-50
                disabled:cursor-default
                disabled:hover:text-cyan-100
              "
														disabled={!canShowDevUi || resourceEditor.isSaving(res.key)}
														onClick={() => {
															if (!canShowDevUi) {
																return;
															}
															resourceEditor.startEditing(res.key, Math.floor(stored));
														}}
														type="button"
													>
														{stored.toLocaleString()}
													</button>
												)}
												<span
													className="
               font-(family-name:--nv-font-mono) text-[9px] text-white/25
             "
												>
													/ {cap.toLocaleString()}
												</span>
											</div>
											<p className={overflow > 0 ? `
             mt-1 font-(family-name:--nv-font-mono) text-[9px] text-amber-200/75
           ` : `mt-1 font-(family-name:--nv-font-mono) text-[9px] text-white/28`}>{overflow > 0 ? `+${formatResourceValue(overflow)} overflow` : "No overflow"}</p>
											<div
												className="
              mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/8
            "
											>
												<div
													className="h-full rounded-full bg-cyan-400/40 transition-all"
													style={{ width: `${pct}%` }}
												/>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Building Group Sections */}
					{groupedBuildings.map((group, groupIdx) => {
						const visibleStructureCount = group.buildings.length;
						const visibleStructureKeys = new Set<BuildingKey>(
							group.buildings.map((building) => building.key),
						);

						if (visibleStructureCount === 0) {
							return null;
						}

						const groupVisual = GROUP_VISUALS[group.groupId];
						const queueCount = pendingBuildingQueueItems.filter((item) =>
							visibleStructureKeys.has(item.payload.buildingKey),
						).length;
						const activeUpgradeInGroup = activeBuildingQueueItem
							? visibleStructureKeys.has(activeBuildingQueueItem.payload.buildingKey)
							: false;

						return (
							<section
								className={`
          overflow-hidden rounded-2xl border border-l-4 border-white/10
          bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))]
          ${groupVisual.accentBorder}
        `}
								key={group.groupId}
								style={{
									animation: `nv-resource-card-in 400ms cubic-bezier(0.21,1,0.34,1) both`,
									animationDelay: `${groupIdx * 80}ms`,
								}}
							>
								{/* Group Header */}
								<div
									className="
           flex flex-wrap items-center justify-between gap-2 px-4 py-3
           sm:px-5
         "
								>
									<div className="flex items-center gap-2.5">
										<span className="text-white/50">{groupVisual.icon}</span>
										<div>
											<h2
												className="
             font-(family-name:--nv-font-display) text-sm font-bold
           "
											>
												{groupVisual.label}
											</h2>
											<p className="mt-0.5 text-[10px] text-white/35">{groupVisual.description}</p>
										</div>
									</div>
									<div className="flex items-center gap-1.5">
										<span
											className="
             rounded-md border border-white/10 bg-white/3 px-2 py-0.5
             font-(family-name:--nv-font-mono) text-[9px] font-semibold
             text-white/50
           "
										>
											{visibleStructureCount} structures
										</span>
										{activeUpgradeInGroup ? (
											<span
												className="
              rounded-md border border-emerald-300/30 bg-emerald-400/8 px-2
              py-0.5 text-[9px] font-semibold text-emerald-200/80 uppercase
            "
											>
												Upgrading
											</span>
										) : null}
										{queueCount > 0 ? (
											<span
												className="
              rounded-md border border-cyan-300/30 bg-cyan-400/8 px-2 py-0.5
              text-[9px] font-semibold text-cyan-200/80 uppercase
            "
											>
												{queueCount} queued
											</span>
										) : null}
									</div>
								</div>

								{/* Building Cards Grid */}
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
										{group.buildings.map((building) => {
											const isTableOpen = activeTableBuildingKey === building.key;
											const isBusy = upgradingKey === building.key;
											const queuedItem = pendingBuildingQueueItems.find(
												(item) => item.payload.buildingKey === building.key,
											);
											const ci = cardIndex++;

											return (
												<div
													key={building.key}
													style={{
														animation: `nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both`,
														animationDelay: `${120 + ci * 60}ms`,
													}}
												>
													<ResourceBuildingCard
														activeQueueItem={activeBuildingQueueItem}
														building={building}
														buildingLevels={buildingLevels}
														buildingQueueIsFull={buildingQueue?.isFull ?? false}
														energyRatio={
															projectedResources?.energyRatio ?? view.resources.energyRatio
														}
														isBusy={isBusy}
														isTableOpen={isTableOpen}
														overflow={projectedResources?.overflow ?? view.resources.overflow}
														resourcesStored={projectedResources?.stored ?? view.resources.stored}
														storageCaps={
															projectedResources?.storageCaps ?? view.resources.storageCaps
														}
														planetMultipliers={
															colonyView?.snapshot.planetMultipliers ?? view.planetMultipliers
														}
														queuedForBuilding={queuedItem ?? null}
														remainingTimeLabel={remainingTimeLabel}
														devInlineLevelEditor={{
															enabled: canShowDevUi,
															isSaving: savingBuildingLevelKey === building.key,
															onCommit: async (nextLevel) =>
																commitBuildingLevel(building.key, nextLevel),
														}}
														onTableOpenChange={(open) =>
															setActiveTableBuildingKey(open ? building.key : null)
														}
														onUpgrade={() => {
															setUpgradingKey(building.key);
															enqueueBuildingUpgrade({
																colonyId: colonyIdAsId,
																buildingKey: building.key,
															})
																.then((result) => {
																	if (result.status === "active") {
																		toast.success(`${building.name} upgrade started`);
																	} else {
																		toast.success(`${building.name} upgrade queued`);
																	}
																})
																.catch((error) => {
																	toast.error(
																		error instanceof Error
																			? error.message
																			: "Failed to queue upgrade",
																	);
																})
																.finally(() => {
																	setUpgradingKey(null);
																});
														}}
													/>
												</div>
											);
										})}
									</div>
								</div>
							</section>
						);
					})}
				</div>

				{/* ══ Right Column: Building Queue Panel ══ */}
				<div className="lg:sticky lg:top-4 lg:self-start">
					<QueuePanel
						activeItem={
							activeLaneQueueItem
								? {
										id: `${activeLaneQueueItem.kind}-${activeLaneQueueItem.completesAt}`,
										isActive: true,
										remainingLabel: remainingTimeLabel ?? undefined,
										subtitle: `Lv ${activeLaneQueueItem.payload.fromLevel} → ${activeLaneQueueItem.payload.toLevel}`,
										title:
											activeLaneQueueItem.kind === "buildingUpgrade"
												? (BUILDING_KEY_LABELS[activeLaneQueueItem.payload.buildingKey] ??
													activeLaneQueueItem.payload.buildingKey)
												: (FACILITY_KEY_LABELS[activeLaneQueueItem.payload.facilityKey] ??
													activeLaneQueueItem.payload.facilityKey),
									}
								: null
						}
						activeProgressPercent={activeUpgradeProgress}
						completeAction={
							canShowDevUi ? (
								<button
									className="
           inline-flex items-center gap-1 rounded-md border border-cyan-300/30
           bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-100
           transition
           hover:border-cyan-200/55 hover:bg-cyan-400/16
           disabled:cursor-not-allowed disabled:opacity-50
         "
									disabled={isCompletingQueueItem || !canUseDevConsole}
									onClick={() => {
										void completeActiveQueue();
									}}
									type="button"
								>
									{isCompletingQueueItem ? "Completing..." : "Complete"}
								</button>
							) : null
						}
						emptyDescription="Select a building to begin upgrading"
						emptyTitle="No upgrades in progress"
						headerIcon={<Clock3 className="size-5 text-cyan-300" />}
						pendingItems={pendingLaneQueueItems.map((item) => ({
							id: `${item.kind}-${item.completesAt}-${item.payload.toLevel}`,
							isActive: false,
							remainingLabel: formatColonyDuration(
								Math.max(0, item.completesAt - nowMs),
								"milliseconds",
							),
							subtitle: `Lv ${item.payload.fromLevel} → ${item.payload.toLevel}`,
							title:
								item.kind === "buildingUpgrade"
									? (BUILDING_KEY_LABELS[item.payload.buildingKey] ?? item.payload.buildingKey)
									: (FACILITY_KEY_LABELS[item.payload.facilityKey] ?? item.payload.facilityKey),
						}))}
						theme="resource"
						title="Building Queue"
					/>
				</div>
			</div>
		</div>
	);
}
