import { createFileRoute } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { Clock3, Layers3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { FacilityKey } from "@nullvector/game-logic";

import { UpgradeButton } from "@/features/ui-mockups/components/upgrade-button";
import { useGameTimedSync } from "@/hooks/use-game-timed-sync";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

export const Route = createFileRoute("/game/colony/$colonyId/facilties")({
  component: FacilitiesRoute,
});

const FACILITY_VISUALS: Record<
  FacilityKey,
  {
    image: string;
    summary: string;
  }
> = {
  shipyard: {
    image: "/game-icons/facilities/shipyard.png",
    summary:
      "Enables ship construction and improves build throughput as the level rises.",
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

function isFacilityQueueItemPayload(item: {
  kind: string;
  payload: unknown;
}): item is FacilityQueueItem {
  return (
    item.kind === "facilityUpgrade" &&
    typeof item.payload === "object" &&
    item.payload !== null &&
    "facilityKey" in item.payload
  );
}

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

function statusClasses(status: string) {
  if (status === "Constructing") {
    return "border-amber-200/55 bg-amber-300/15 text-amber-50";
  }
  if (status === "Queued") {
    return "border-cyan-200/55 bg-cyan-300/15 text-cyan-50";
  }
  if (status === "Locked") {
    return "border-rose-200/55 bg-rose-300/15 text-rose-50";
  }
  if (status === "Maxed") {
    return "border-violet-200/55 bg-violet-300/15 text-violet-50";
  }
  return "border-emerald-200/55 bg-emerald-300/15 text-emerald-50";
}

function CostPill(props: {
  amount: number;
  icon: string;
  label: string;
}) {
  const { amount, icon, label } = props;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[11px] font-semibold text-slate-100">
      <img alt={`${label} icon`} className="size-3.5 object-contain" src={icon} />
      {amount.toLocaleString()}
    </span>
  );
}

function FacilitiesRoute() {
  const { colonyId } = Route.useParams();
  const colonyIdAsId = colonyId as Id<"colonies">;
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const view = useQuery(
    api.facilities.getFacilitiesView,
    isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
  );
  const syncColony = useMutation(api.colonyQueue.syncColony);
  const enqueueFacilityUpgrade = useMutation(api.facilities.enqueueFacilityUpgrade);
  const [upgradingKey, setUpgradingKey] = useState<FacilityKey | null>(null);
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

  useGameTimedSync({
    enabled: isAuthenticated,
    events: [{ atMs: view?.queues.nextEventAt, id: "colony-facility-queue-event" }],
    onDue: () => sync(),
    scopeId: `facilities-colony-${colonyIdAsId}`,
  });

  if (isAuthLoading || (isAuthenticated && !view)) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 text-white/80">
        Loading facilities...
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 text-white/80">
        Unable to load facilities. Please sign in again.
      </div>
    );
  }

  const buildingLane = view.queues.lanes.building;
  const activeQueueItem = buildingLane.activeItem;
  const pendingQueueItems = buildingLane.pendingItems;
  const activeFacilityQueueItem =
    activeQueueItem && isFacilityQueueItemPayload(activeQueueItem)
      ? activeQueueItem
      : null;
  const remainingTimeLabel = activeQueueItem
    ? formatDuration(Math.max(0, activeQueueItem.completesAt - nowMs))
    : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 text-white">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {view.facilities.map((facility) => {
          const visual = FACILITY_VISUALS[facility.key];
          const activeForFacility =
            activeFacilityQueueItem?.payload.facilityKey === facility.key
              ? activeFacilityQueueItem
              : null;
          const queuedForFacility =
            pendingQueueItems.find(
              (item) =>
                isFacilityQueueItemPayload(item) &&
                item.payload.facilityKey === facility.key,
            ) ?? null;
          const etaLabel = activeForFacility
            ? (remainingTimeLabel ?? "0s")
            : queuedForFacility
              ? formatDuration(Math.max(0, queuedForFacility.completesAt - nowMs))
              : facility.nextUpgradeDurationSeconds
                ? formatDuration(facility.nextUpgradeDurationSeconds * 1_000)
                : "N/A";
          const isBusy = upgradingKey === facility.key;
          const actionDurationText = facility.nextUpgradeDurationSeconds
            ? formatDuration(facility.nextUpgradeDurationSeconds * 1_000)
            : "N/A";
          const actionLabel = facility.currentLevel <= 0 ? "Build" : "Upgrade";

          return (
            <article
              className="relative overflow-hidden rounded-2xl border border-white/13 bg-[linear-gradient(165deg,rgba(9,14,24,0.95),rgba(3,7,13,0.98))] p-4"
              key={facility.key}
            >
              <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/15 blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white/95">{facility.name}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${statusClasses(
                      facility.status,
                    )}`}
                  >
                    {facility.status}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-white/12 bg-black/25 p-2">
                  <img
                    alt={`${facility.name} illustration`}
                    className="mx-auto h-32 w-32 object-contain"
                    draggable={false}
                    src={visual.image}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-white/78">
                  <span className="inline-flex items-center gap-1">
                    <Layers3 className="size-3.5" />
                    Lv {facility.currentLevel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-white/68">
                    <Clock3 className="size-3.5" />
                    {etaLabel}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-white/70">{visual.summary}</p>

                <div className="mt-4">
                  <Popover.Root>
                    <Popover.Trigger
                      closeDelay={90}
                      delay={60}
                      openOnHover
                      render={
                        <UpgradeButton
                          actionDurationText={actionDurationText}
                          className="min-w-0 w-full"
                          disabled={!facility.canUpgrade || isBusy}
                          icon="arrow"
                          label={
                            isBusy
                              ? "Queueing..."
                              : buildingLane.isFull
                                ? "Queue Full"
                                : actionLabel
                          }
                          onClick={() => {
                            if (!facility.canUpgrade || isBusy) {
                              return;
                            }

                            setUpgradingKey(facility.key);
                            enqueueFacilityUpgrade({
                              colonyId: colonyIdAsId,
                              facilityKey: facility.key,
                            })
                              .then((result) => {
                                if (result.status === "active") {
                                  toast.success(`${facility.name} upgrade started`);
                                } else {
                                  toast.success(`${facility.name} upgrade queued`);
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
                      }
                    />
                    <Popover.Portal>
                      <Popover.Positioner align="end" className="z-[90]" sideOffset={8}>
                        <Popover.Popup className="origin-[var(--transform-origin)] w-[240px] rounded-xl border border-white/30 bg-[rgba(5,10,18,0.82)] p-3 text-xs text-white/90 shadow-[0_20px_45px_rgba(0,0,0,0.5)] outline-none backdrop-blur-md transition-[transform,scale,opacity] duration-200 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                            Next Upgrade Cost
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <CostPill
                              amount={facility.nextUpgradeCost.alloy}
                              icon="/game-icons/alloy.png"
                              label="Alloy"
                            />
                            <CostPill
                              amount={facility.nextUpgradeCost.crystal}
                              icon="/game-icons/crystal.png"
                              label="Crystal"
                            />
                            <CostPill
                              amount={facility.nextUpgradeCost.fuel}
                              icon="/game-icons/deuterium.png"
                              label="Fuel"
                            />
                          </div>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
