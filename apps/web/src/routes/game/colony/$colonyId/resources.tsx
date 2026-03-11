import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, FacilityKey, LaneQueueItem } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { BatteryCharging, Clock3, Factory, Layers3, Pickaxe, Radar } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useColonyResources } from "@/hooks/use-colony-resources";
import { formatResourceValue } from "@/lib/colony-resource-simulation";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { ResourcesRouteSkeleton } from "./loading-skeletons";
import { isStorageBuildingKey, ResourceBuildingCard } from "./resource-building-card";

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
	resource: {
		accentBorder: "border-l-cyan-400/50",
		accentDot: "bg-cyan-400",
		description: "Raw material extraction and refining network.",
		icon: <Pickaxe className="size-4" strokeWidth={2.2} />,
		label: "Material Yards",
	},
	power: {
		accentBorder: "border-l-amber-400/50",
		accentDot: "bg-amber-400",
		description: "Planetary grid generation and voltage control.",
		icon: <BatteryCharging className="size-4" strokeWidth={2.2} />,
		label: "Power Grid",
	},
	storage: {
		accentBorder: "border-l-sky-400/50",
		accentDot: "bg-sky-400",
		description: "Bulk containment arrays expanding resource reserves.",
		icon: <Layers3 className="size-4" strokeWidth={2.2} />,
		label: "Storage Ring",
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

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
	const hours = Math.floor(totalSeconds / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

function resolveGroupIdForBuilding(building: {
	group: string;
	key: BuildingKey;
}): GeneratorGroupId {
	const normalizedGroup = building.group.toLowerCase();

	if (building.key === "powerPlantLevel" || normalizedGroup.includes("power")) {
		return "power";
	}

	if (isStorageBuildingKey(building.key) || normalizedGroup.includes("storage")) {
		return "storage";
	}

	if (
		normalizedGroup.includes("resource") ||
		normalizedGroup.includes("mine") ||
		normalizedGroup.includes("extract")
	) {
		return "resource";
	}

	return "special";
}

function storageKeyForProduction(key: BuildingKey): BuildingKey | null {
	if (key === "alloyMineLevel") {
		return "alloyStorageLevel";
	}
	if (key === "crystalMineLevel") {
		return "crystalStorageLevel";
	}
	if (key === "fuelRefineryLevel") {
		return "fuelStorageLevel";
	}
	return null;
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
	| {
			kind: "facilityUpgrade";
			payload: {
				facilityKey: FacilityKey;
				fromLevel: number;
				toLevel: number;
			};
			startsAt: number;
			completesAt: number;
	  };

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
};

function ResourcesRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const buildingCards = useQuery(
		api.resources.getColonyBuildingCards,
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
	const view = useMemo(() => {
		if (!colonyResources.snapshot || !buildingCards || !queueLanes) {
			return undefined;
		}
		return {
			...colonyResources.snapshot,
			queues: queueLanes,
			buildings: buildingCards.buildings,
		};
	}, [buildingCards, colonyResources.snapshot, queueLanes]);
	const enqueueBuildingUpgrade = useMutation(api.resources.enqueueBuildingUpgrade);
	const setColonyResources = useMutation(api.devConsole.setColonyResources);
	const setBuildingLevels = useMutation(api.devConsole.setBuildingLevels);
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);

	const [activeTableBuildingKey, setActiveTableBuildingKey] = useState<BuildingKey | null>(null);
	const [upgradingKey, setUpgradingKey] = useState<BuildingKey | null>(null);
	const [editingResourceKey, setEditingResourceKey] = useState<ResourceKey | null>(null);
	const [resourceDraftValue, setResourceDraftValue] = useState("");
	const [savingResourceKey, setSavingResourceKey] = useState<ResourceKey | null>(null);
	const [savingBuildingLevelKey, setSavingBuildingLevelKey] = useState<BuildingKey | null>(null);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;
	const nowMs = colonyResources.nowMs;
	const projectedResources = colonyResources.projected;

	const buildingQueue = view?.queues.lanes.building;
	const activeQueueItem = buildingQueue?.activeItem;
	const pendingQueueItems = buildingQueue?.pendingItems ?? [];
	const activeLaneQueueItem: BuildingLaneQueueItem | null =
		activeQueueItem && isBuildingLaneQueueItem(activeQueueItem)
			? (activeQueueItem as BuildingLaneQueueItem)
			: null;
	const pendingLaneQueueItems: BuildingLaneQueueItem[] = pendingQueueItems.filter(
		isBuildingLaneQueueItem,
	) as BuildingLaneQueueItem[];
	const activeBuildingQueueItem: LaneQueueItem | null =
		activeQueueItem && isBuildingQueueItemPayload(activeQueueItem)
			? (activeQueueItem as LaneQueueItem)
			: null;
	const pendingBuildingQueueItems: LaneQueueItem[] = pendingQueueItems.filter(
		isBuildingQueueItemPayload,
	) as LaneQueueItem[];
	const remainingTimeLabel = activeQueueItem
		? formatDuration(Math.max(0, activeQueueItem.completesAt - nowMs))
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
	const buildingsByKey = useMemo(() => {
		return new Map((view?.buildings ?? []).map((building) => [building.key, building]));
	}, [view?.buildings]);
	const pairedStorageKeys = useMemo(() => {
		const keys = new Set<BuildingKey>();

		for (const building of view?.buildings ?? []) {
			const storageKey = storageKeyForProduction(building.key);
			if (!storageKey) {
				continue;
			}
			if (buildingsByKey.has(storageKey)) {
				keys.add(storageKey);
			}
		}

		return keys;
	}, [buildingsByKey, view?.buildings]);
	const buildingLevels = useMemo(() => {
		const levels = { ...EMPTY_BUILDING_LEVELS };
		for (const building of view?.buildings ?? []) {
			levels[building.key] = building.currentLevel;
		}
		return levels;
	}, [view?.buildings]);

	const totalBuildings = view?.buildings.length ?? 0;
	const activeItemStartsAt = (activeLaneQueueItem as Record<string, unknown> | null)?.startsAt as
		| number
		| undefined;
	const activeItemDurationMs =
		activeLaneQueueItem && activeItemStartsAt
			? activeLaneQueueItem.completesAt - activeItemStartsAt
			: 0;
	const activeUpgradeProgress =
		activeLaneQueueItem && activeItemDurationMs > 0
			? Math.min(
					100,
					Math.max(
						0,
						((nowMs - (activeLaneQueueItem.completesAt - activeItemDurationMs)) /
							activeItemDurationMs) *
							100,
					),
				)
			: 0;
	const commitResourceEdit = useCallback(async () => {
		if (!canShowDevUi || !editingResourceKey || !devConsoleState?.canUseDevConsole) {
			return;
		}

		const parsed = Math.max(0, Math.floor(Number(resourceDraftValue) || 0));
		setSavingResourceKey(editingResourceKey);
		try {
			const resourcePatch: Partial<Record<ResourceKey, number>> = {
				[editingResourceKey]: parsed,
			};
			await setColonyResources({
				colonyId: colonyIdAsId,
				resources: resourcePatch,
			});
			setEditingResourceKey(null);
			toast.success("Resource updated");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update resource");
		} finally {
			setSavingResourceKey(null);
		}
	}, [
		canShowDevUi,
		colonyIdAsId,
		devConsoleState?.canUseDevConsole,
		editingResourceKey,
		resourceDraftValue,
		setColonyResources,
	]);

	const commitBuildingLevel = useCallback(
		async (buildingKey: BuildingKey, nextLevel: number) => {
			if (!canShowDevUi || !devConsoleState?.canUseDevConsole) {
				return;
			}
			setSavingBuildingLevelKey(buildingKey);
			try {
				const patch: Partial<Record<BuildingKey, number>> = {
					[buildingKey]: nextLevel,
				};
				await setBuildingLevels({
					colonyId: colonyIdAsId,
					buildingLevels: patch,
				});
				toast.success("Building level updated");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to update building level");
			} finally {
				setSavingBuildingLevelKey(null);
			}
		},
		[canShowDevUi, colonyIdAsId, devConsoleState?.canUseDevConsole, setBuildingLevels],
	);

	const completeActiveQueue = useCallback(async () => {
		if (!canShowDevUi || !devConsoleState?.canUseDevConsole || isCompletingQueueItem) {
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
		colonyIdAsId,
		completeActiveQueueItem,
		devConsoleState?.canUseDevConsole,
		isCompletingQueueItem,
	]);

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
												{canShowDevUi && editingResourceKey === res.key ? (
													<input
														autoFocus
														className="
                h-6 w-24 rounded-md border border-cyan-300/35 bg-black/40 px-1.5
                text-right font-(family-name:--nv-font-mono) text-[11px]
                font-semibold text-cyan-100 outline-none
                focus:border-cyan-200/60
              "
														inputMode="numeric"
														onBlur={() => {
															setEditingResourceKey(null);
														}}
														onChange={(event) => {
															setResourceDraftValue(event.target.value.replace(/[^\d]/g, ""));
														}}
														onKeyDown={(event) => {
															if (event.key === "Escape") {
																setEditingResourceKey(null);
																return;
															}
															if (event.key === "Enter") {
																event.preventDefault();
																void commitResourceEdit();
															}
														}}
														value={resourceDraftValue}
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
														disabled={!canShowDevUi || savingResourceKey === res.key}
														onClick={() => {
															if (!canShowDevUi) {
																return;
															}
															setEditingResourceKey(res.key);
															setResourceDraftValue(String(Math.floor(stored)));
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
						const baseGroupBuildings =
							group.groupId === "storage"
								? group.buildings.filter((building) => !pairedStorageKeys.has(building.key))
								: group.buildings;
						const pairedStorageInGroup =
							group.groupId !== "storage"
								? baseGroupBuildings
										.map((building) => storageKeyForProduction(building.key))
										.filter((key): key is BuildingKey => Boolean(key))
										.filter((key) => buildingsByKey.has(key))
								: [];
						const visibleStructureCount =
							group.groupId === "storage"
								? baseGroupBuildings.length
								: new Set([
										...baseGroupBuildings.map((building) => building.key),
										...pairedStorageInGroup,
									]).size;
						const visibleStructureKeys = new Set<BuildingKey>([
							...baseGroupBuildings.map((building) => building.key),
							...pairedStorageInGroup,
						]);

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
											<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
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
            lg:grid-cols-3
          "
									>
										{baseGroupBuildings.map((building) => {
											const storageKey = storageKeyForProduction(building.key);
											const storageBuilding = storageKey
												? (buildingsByKey.get(storageKey) ?? null)
												: null;
											const renderCard = (targetBuilding: typeof building) => {
												const targetTableOpen = activeTableBuildingKey === targetBuilding.key;
												const targetBusy = upgradingKey === targetBuilding.key;
												const targetQueued = pendingBuildingQueueItems.find(
													(item) => item.payload.buildingKey === targetBuilding.key,
												);
												const ci = cardIndex++;

												return (
													<div
														key={targetBuilding.key}
														style={{
															animation: `nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both`,
															animationDelay: `${120 + ci * 60}ms`,
														}}
													>
														<ResourceBuildingCard
															activeQueueItem={activeBuildingQueueItem}
															building={targetBuilding}
															buildingLevels={buildingLevels}
															buildingQueueIsFull={buildingQueue?.isFull ?? false}
															energyRatio={
																projectedResources?.energyRatio ?? view.resources.energyRatio
															}
															isBusy={targetBusy}
															isTableOpen={targetTableOpen}
															overflow={projectedResources?.overflow ?? view.resources.overflow}
															resourcesStored={projectedResources?.stored ?? view.resources.stored}
															storageCaps={
																projectedResources?.storageCaps ?? view.resources.storageCaps
															}
															planetMultipliers={
																colonyResources.planetMultipliers ?? view.planetMultipliers
															}
															queuedForBuilding={targetQueued ?? null}
															remainingTimeLabel={remainingTimeLabel}
															devInlineLevelEditor={{
																enabled: canShowDevUi,
																isSaving: savingBuildingLevelKey === targetBuilding.key,
																onCommit: async (nextLevel) =>
																	commitBuildingLevel(targetBuilding.key, nextLevel),
															}}
															onTableOpenChange={(open) =>
																setActiveTableBuildingKey(open ? targetBuilding.key : null)
															}
															onUpgrade={() => {
																setUpgradingKey(targetBuilding.key);
																enqueueBuildingUpgrade({
																	colonyId: colonyIdAsId,
																	buildingKey: targetBuilding.key,
																})
																	.then((result) => {
																		if (result.status === "active") {
																			toast.success(`${targetBuilding.name} upgrade started`);
																		} else {
																			toast.success(`${targetBuilding.name} upgrade queued`);
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
											};

											if (
												group.groupId !== "storage" &&
												isStorageBuildingKey(building.key) &&
												pairedStorageKeys.has(building.key)
											) {
												return null;
											}

											if (
												group.groupId !== "storage" &&
												storageBuilding &&
												!isStorageBuildingKey(building.key)
											) {
												return (
													<div className="flex flex-col gap-3" key={building.key}>
														{renderCard(building)}
														{storageBuilding ? renderCard(storageBuilding) : null}
													</div>
												);
											}

											return renderCard(building);
										})}
									</div>
								</div>
							</section>
						);
					})}
				</div>

				{/* ══ Right Column: Building Queue Panel ══ */}
				<div className="lg:sticky lg:top-4 lg:self-start">
					<div
						className="
        rounded-2xl border border-white/12
        bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
      "
					>
						{/* Queue header */}
						<div className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5">
							<Clock3 className="size-5 text-cyan-300" />
							<h2 className="font-(family-name:--nv-font-display) text-sm font-bold">
								Building Queue
							</h2>
							{activeLaneQueueItem || pendingLaneQueueItems.length > 0 ? (
								<span
									className="
           ml-auto font-(family-name:--nv-font-mono) text-[9px] text-white/30
         "
								>
									{(activeLaneQueueItem ? 1 : 0) + pendingLaneQueueItems.length} item
									{(activeLaneQueueItem ? 1 : 0) + pendingLaneQueueItems.length !== 1 ? "s" : ""}
								</span>
							) : null}
						</div>

						<div className="p-5">
							{/* Active Upgrade */}
							{activeLaneQueueItem ? (
								<div className="space-y-3">
									<p
										className="
            text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
          "
									>
										Active
									</p>
									<div
										className="
            rounded-xl border border-emerald-300/20 bg-emerald-400/4 p-3
          "
									>
										<div className="flex items-center justify-between">
											<div>
												<p className="text-xs font-semibold">
													{activeLaneQueueItem.kind === "buildingUpgrade"
														? (BUILDING_KEY_LABELS[activeLaneQueueItem.payload.buildingKey] ??
															activeLaneQueueItem.payload.buildingKey)
														: (FACILITY_KEY_LABELS[activeLaneQueueItem.payload.facilityKey] ??
															activeLaneQueueItem.payload.facilityKey)}
												</p>
												<p
													className="
               mt-0.5 font-(family-name:--nv-font-mono) text-[10px]
               text-white/40
             "
												>
													Lv {activeLaneQueueItem.payload.fromLevel} →{" "}
													{activeLaneQueueItem.payload.toLevel}
												</p>
											</div>
											<div className="text-right">
												<p
													className="
               font-(family-name:--nv-font-mono) text-xs font-bold
               text-emerald-200
             "
												>
													{remainingTimeLabel ?? "—"}
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
												style={{ width: `${activeUpgradeProgress}%` }}
											/>
										</div>
										<div className="mt-1 flex items-center justify-between">
											<span
												className="
              font-(family-name:--nv-font-mono) text-[9px] text-white/25
            "
											>
												{Math.round(activeUpgradeProgress)}%
											</span>
											<span
												className="
              inline-flex items-center gap-1 text-[9px] text-emerald-300/60
            "
											>
												<span
													className="inline-block size-1.5 rounded-full bg-emerald-400"
													style={{ animation: "nv-queue-pulse 2s ease-in-out infinite" }}
												/>
												In progress
											</span>
										</div>
										{canShowDevUi ? (
											<button
												className="
              mt-2 inline-flex items-center gap-1 rounded-md border
              border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-[10px]
              font-medium text-cyan-100 transition
              hover:border-cyan-200/55 hover:bg-cyan-400/16
              disabled:cursor-not-allowed disabled:opacity-50
            "
												disabled={isCompletingQueueItem || !devConsoleState?.canUseDevConsole}
												onClick={() => {
													void completeActiveQueue();
												}}
												type="button"
											>
												{isCompletingQueueItem ? "Completing..." : "Complete"}
											</button>
										) : null}
									</div>
								</div>
							) : null}

							{/* Pending Queue Items */}
							{pendingLaneQueueItems.length > 0 ? (
								<div className={activeLaneQueueItem ? "mt-4" : ""}>
									<p
										className="
            text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
          "
									>
										Pending ({pendingLaneQueueItems.length})
									</p>
									<div className="mt-2 space-y-1">
										{pendingLaneQueueItems.map((item, i) => (
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
															{item.kind === "buildingUpgrade"
																? (BUILDING_KEY_LABELS[item.payload.buildingKey] ??
																	item.payload.buildingKey)
																: (FACILITY_KEY_LABELS[item.payload.facilityKey] ??
																	item.payload.facilityKey)}
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
														{formatDuration(
															item.completesAt -
																(((item as Record<string, unknown>).startsAt as number) ??
																	item.completesAt),
														)}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							) : null}

							{/* Empty state */}
							{!activeLaneQueueItem && pendingLaneQueueItems.length === 0 ? (
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
									<p className="mt-1 text-[10px] text-white/18">
										Select a building to begin upgrading
									</p>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
