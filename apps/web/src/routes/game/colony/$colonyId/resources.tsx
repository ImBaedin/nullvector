import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { BatteryCharging, Layers3, Pickaxe, Radar } from "lucide-react";
import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, LaneQueueItem } from "@nullvector/game-logic";

import { useGameTimedSync } from "@/hooks/use-game-timed-sync";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";
import {
  isStorageBuildingKey,
  ResourceBuildingCard,
} from "./resource-building-card";

export const Route = createFileRoute("/game/colony/$colonyId/resources")({
  component: ResourcesRoute,
});

type GroupVisual = {
  description: string;
  glow: string;
  icon: ReactNode;
  label: string;
  stripe: string;
};

const GROUP_VISUALS = {
  resource: {
    description: "Raw material extraction and refining network.",
    glow: "rgba(67, 228, 255, 0.3)",
    icon: <Pickaxe className="size-3.5" strokeWidth={2.4} />,
    label: "Material Yards",
    stripe:
      "linear-gradient(90deg, rgba(64,211,255,0.45), rgba(107,166,255,0.25), rgba(64,211,255,0))",
  },
  power: {
    description: "Planetary grid generation and voltage control.",
    glow: "rgba(255, 167, 98, 0.3)",
    icon: <BatteryCharging className="size-3.5" strokeWidth={2.4} />,
    label: "Power Grid",
    stripe:
      "linear-gradient(90deg, rgba(255,184,102,0.48), rgba(255,136,85,0.28), rgba(255,184,102,0))",
  },
  storage: {
    description: "Bulk containment arrays expanding resource reserves.",
    glow: "rgba(112, 206, 255, 0.28)",
    icon: <Layers3 className="size-3.5" strokeWidth={2.4} />,
    label: "Storage Ring",
    stripe:
      "linear-gradient(90deg, rgba(112,206,255,0.45), rgba(170,224,255,0.24), rgba(112,206,255,0))",
  },
  special: {
    description: "Specialized industrial lines and support systems.",
    glow: "rgba(208, 191, 255, 0.3)",
    icon: <Radar className="size-3.5" strokeWidth={2.4} />,
    label: "Special Ops",
    stripe:
      "linear-gradient(90deg, rgba(203,190,255,0.45), rgba(127,174,255,0.24), rgba(203,190,255,0))",
  },
} satisfies Record<string, GroupVisual>;

type GeneratorGroupId = keyof typeof GROUP_VISUALS;

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

  if (
    isStorageBuildingKey(building.key) ||
    normalizedGroup.includes("storage")
  ) {
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

function isBuildingQueueItemPayload(item: {
  kind: string;
  payload: unknown;
}): item is {
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

function ResourcesRoute() {
  const { colonyId } = Route.useParams();
  const colonyIdAsId = colonyId as Id<"colonies">;
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const view = useQuery(
    api.resources.getResourceManagementView,
    isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
  );
  const syncColony = useMutation(api.colonyQueue.syncColony);
  const enqueueBuildingUpgrade = useMutation(
    api.resources.enqueueBuildingUpgrade,
  );

  const [activeTableBuildingKey, setActiveTableBuildingKey] =
    useState<BuildingKey | null>(null);
  const [upgradingKey, setUpgradingKey] = useState<BuildingKey | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!isAuthenticated || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    try {
      await syncColony({ colonyId: colonyIdAsId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sync colony",
      );
    } finally {
      isSyncingRef.current = false;
    }
  }, [colonyIdAsId, isAuthenticated, syncColony]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void sync();

    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    const syncInterval = window.setInterval(() => {
      void sync();
    }, 20_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sync();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(syncInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, sync]);

  const buildingQueue = view?.queues.lanes.building;
  const activeQueueItem = buildingQueue?.activeItem;
  const pendingQueueItems = buildingQueue?.pendingItems ?? [];
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

  useGameTimedSync({
    enabled: isAuthenticated,
    events: [{ atMs: view?.queues.nextEventAt, id: "colony-queue-event" }],
    onDue: () => sync(),
    scopeId: `resources-colony-${colonyIdAsId}`,
  });

  if (isAuthLoading || (isAuthenticated && !view)) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 text-white/80">
        Loading colony resources...
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 text-white/80">
        Unable to load colony resources. Please sign in again.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 text-white">
      <section className="space-y-5">
        {groupedBuildings.map((group) => {
          const baseGroupBuildings =
            group.groupId === "storage"
              ? group.buildings.filter(
                  (building) => !pairedStorageKeys.has(building.key),
                )
              : group.buildings;
          const pairedStorageInGroup = group.groupId !== "storage"
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
              className="relative overflow-hidden rounded-2xl border border-white/14 bg-[linear-gradient(180deg,rgba(10,18,30,0.9),rgba(2,7,14,0.94))] p-3 shadow-[0_16px_32px_rgba(0,0,0,0.38)] sm:p-4"
              key={group.groupId}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-80"
                style={{
                  backgroundImage: groupVisual.stripe,
                }}
              />
              <div
                className="pointer-events-none absolute -left-24 top-0 h-36 w-56 rounded-full blur-3xl"
                style={{
                  background: groupVisual.glow,
                }}
              />
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
                    {groupVisual.icon}
                    {groupVisual.label}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-white/95 sm:text-base">
                    {group.groupLabel}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-white/62">
                    {groupVisual.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-white/70">
                  <span className="rounded-full border border-white/20 bg-black/25 px-2.5 py-1">
                    {visibleStructureCount} structures
                  </span>
                  {activeUpgradeInGroup ? (
                    <span className="rounded-full border border-emerald-200/45 bg-emerald-300/15 px-2.5 py-1 text-emerald-50">
                      1 active upgrade
                    </span>
                  ) : null}
                  {queueCount > 0 ? (
                    <span className="rounded-full border border-cyan-200/40 bg-cyan-300/15 px-2.5 py-1 text-cyan-50">
                      {queueCount} queued
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="relative z-10 mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {baseGroupBuildings.map((building) => {
                    const storageKey = storageKeyForProduction(building.key);
                    const storageBuilding = storageKey
                      ? buildingsByKey.get(storageKey) ?? null
                      : null;
                    const renderCard = (targetBuilding: typeof building) => {
                      const targetTableOpen =
                        activeTableBuildingKey === targetBuilding.key;
                      const targetBusy = upgradingKey === targetBuilding.key;
                      const targetQueued = pendingBuildingQueueItems.find(
                        (item) => item.payload.buildingKey === targetBuilding.key,
                      );

                      return (
                        <ResourceBuildingCard
                          activeQueueItem={activeBuildingQueueItem}
                          building={targetBuilding}
                          buildingQueueIsFull={buildingQueue?.isFull ?? false}
                          energyRatio={view.resources.energyRatio}
                          isBusy={targetBusy}
                          isTableOpen={targetTableOpen}
                          overflow={view.resources.overflow}
                          queuedForBuilding={targetQueued ?? null}
                          remainingTimeLabel={remainingTimeLabel}
                          key={targetBuilding.key}
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
                                  toast.success(
                                    `${targetBuilding.name} upgrade started`,
                                  );
                                } else {
                                  toast.success(
                                    `${targetBuilding.name} upgrade queued`,
                                  );
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
            </section>
          );
        })}
      </section>
    </div>
  );
}
