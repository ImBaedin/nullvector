import { createFileRoute } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { Clock3, Gauge, Info, Layers3, X } from "lucide-react";
import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useGameTimedSync } from "@/hooks/use-game-timed-sync";
import { UpgradeButton } from "@/features/ui-mockups/components/upgrade-button";

export const Route = createFileRoute("/game/colony/$colonyId/resources")({
  component: ResourcesRoute,
});

type BuildingKey =
  | "alloyMineLevel"
  | "crystalMineLevel"
  | "fuelRefineryLevel"
  | "powerPlantLevel";

type DeltaResourceKey = "alloy" | "crystal" | "fuel" | "energy";

type CardStatus = "Running" | "Shortage" | "Overflow" | "Paused";

const BUILDING_VISUALS: Record<
  BuildingKey,
  {
    accent: string;
    imageUrl: string;
  }
> = {
  alloyMineLevel: {
    accent: "rgba(74, 233, 255, 0.65)",
    imageUrl: "/game-icons/alloy.png",
  },
  crystalMineLevel: {
    accent: "rgba(122, 181, 255, 0.62)",
    imageUrl: "/game-icons/crystal.png",
  },
  fuelRefineryLevel: {
    accent: "rgba(255, 170, 106, 0.7)",
    imageUrl: "/game-icons/deuterium.png",
  },
  powerPlantLevel: {
    accent: "rgba(255, 125, 167, 0.66)",
    imageUrl: "/game-icons/energy.png",
  },
};

const STATUS_STYLES: Record<CardStatus, { badge: string; card: string; panel: string }> = {
  Running: {
    badge: "border-emerald-300/70 bg-emerald-300/20 text-emerald-100",
    card: "border-emerald-300/35",
    panel: "bg-emerald-400/12",
  },
  Shortage: {
    badge: "border-amber-300/80 bg-amber-200/20 text-amber-50",
    card: "border-amber-200/50",
    panel: "bg-amber-300/15",
  },
  Overflow: {
    badge: "border-sky-200/85 bg-sky-200/20 text-sky-50",
    card: "border-sky-200/55",
    panel: "bg-sky-200/14",
  },
  Paused: {
    badge: "border-rose-300/75 bg-rose-300/20 text-rose-50",
    card: "border-rose-300/45",
    panel: "bg-rose-300/14",
  },
};

const DELTA_RESOURCE_META: Record<DeltaResourceKey, { icon: string; label: string; suffix: string }> =
  {
    alloy: { icon: "/game-icons/alloy.png", label: "Alloy", suffix: "/m" },
    crystal: { icon: "/game-icons/crystal.png", label: "Crystal", suffix: "/m" },
    fuel: { icon: "/game-icons/deuterium.png", label: "Fuel", suffix: "/m" },
    energy: { icon: "/game-icons/energy.png", label: "Energy", suffix: " MW" },
  };

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

function formatUpgradeTime(seconds?: number) {
  if (!seconds || seconds <= 0) {
    return "N/A";
  }

  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatSignedDelta(value: number, suffix: string) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}${suffix}`;
}

function statusFromBuilding(args: {
  canUpgrade: boolean;
  overflow: number;
  energyRatio: number;
  outputPerMinute: number;
}): CardStatus {
  if (args.energyRatio < 0.55) {
    return "Shortage";
  }
  if (args.overflow > 0) {
    return "Overflow";
  }
  if (!args.canUpgrade && args.outputPerMinute <= 0) {
    return "Paused";
  }
  return "Running";
}

function resourceNameForBuilding(key: BuildingKey) {
  if (key === "alloyMineLevel") {
    return "Alloy";
  }
  if (key === "crystalMineLevel") {
    return "Crystal";
  }
  if (key === "fuelRefineryLevel") {
    return "Fuel";
  }
  return "Energy";
}

function efficiencyLabel(status: CardStatus, energyRatio: number) {
  if (status === "Paused") {
    return "0%";
  }
  const value = Math.max(0, Math.min(100, Math.round(energyRatio * 100)));
  return `${value}%`;
}

function outputResourceKeyForBuilding(key: BuildingKey): DeltaResourceKey {
  if (key === "alloyMineLevel") {
    return "alloy";
  }
  if (key === "crystalMineLevel") {
    return "crystal";
  }
  if (key === "fuelRefineryLevel") {
    return "fuel";
  }
  return "energy";
}

function ResourcesRoute() {
  const { colonyId } = Route.useParams();
  const colonyIdAsId = colonyId as Id<"colonies">;
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const view = useQuery(
    api.gameplay.getResourceManagementView,
    isAuthenticated ? { colonyId: colonyIdAsId } : "skip"
  );
  const syncColony = useMutation(api.gameplay.syncColony);
  const queueUpgrade = useMutation(api.gameplay.queueUpgrade);

  const [activeTableBuildingKey, setActiveTableBuildingKey] = useState<BuildingKey | null>(null);
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
      toast.error(error instanceof Error ? error.message : "Failed to sync colony");
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

  const activeUpgrade = view?.colony.activeUpgrade;
  const remainingTimeLabel = activeUpgrade
    ? formatDuration(Math.max(0, activeUpgrade.completesAt - nowMs))
    : null;

  useGameTimedSync({
    enabled: isAuthenticated,
    events: [{ atMs: activeUpgrade?.completesAt, id: "upgrade-complete" }],
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
      <section className="grid gap-4 md:grid-cols-2">
        {view.buildings.map((building) => {
          const isTableOpen = activeTableBuildingKey === building.key;
          const isBusy = upgradingKey === building.key;
          const isActiveUpgradeTarget = activeUpgrade?.buildingKey === building.key;
          const nextLevelRow =
            building.levelTable.find((row) => row.level === building.currentLevel + 1) ??
            building.levelTable[0];
          const resourceOverflow =
            building.key === "alloyMineLevel"
              ? view.resources.overflow.alloy
              : building.key === "crystalMineLevel"
                ? view.resources.overflow.crystal
                : building.key === "fuelRefineryLevel"
                  ? view.resources.overflow.fuel
                  : 0;
          const cardStatus = statusFromBuilding({
            canUpgrade: building.canUpgrade,
            energyRatio: view.resources.energyRatio,
            overflow: resourceOverflow,
            outputPerMinute: building.outputPerMinute,
          });
          const statusStyle = STATUS_STYLES[cardStatus];
          const visual = BUILDING_VISUALS[building.key];
          const cardAccent = visual.accent;
          const outputDeltaPerMinute = nextLevelRow?.deltaOutputPerMinute ?? 0;
          const energyDeltaPerMinute = nextLevelRow?.deltaEnergyPerMinute ?? 0;
          const energyImpactDeltaPerMinute = -energyDeltaPerMinute;
          const outputResourceKey = outputResourceKeyForBuilding(building.key);
          const nextLevelDeltas: Array<{ key: DeltaResourceKey; value: number }> = [];

          if (outputDeltaPerMinute !== 0) {
            nextLevelDeltas.push({
              key: outputResourceKey,
              value: outputDeltaPerMinute,
            });
          }

          if (outputResourceKey !== "energy" && energyImpactDeltaPerMinute !== 0) {
            nextLevelDeltas.push({
              key: "energy",
              value: energyImpactDeltaPerMinute,
            });
          }

          return (
            <article
              className={`group relative overflow-hidden rounded-2xl border ${statusStyle.card} bg-[#060f1a] shadow-[0_16px_34px_rgba(0,0,0,0.4)]`}
              key={building.key}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 78% 24%, ${cardAccent}, transparent 38%), linear-gradient(164deg, rgba(9,17,29,0.74), rgba(1,5,12,0.94) 62%), url(${visual.imageUrl})`,
                  backgroundPosition: "center, center, calc(100% + 35px) 52%",
                  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
                  backgroundSize: "cover, cover, 56%",
                }}
              />
              <div className="absolute inset-0 bg-[repeating-linear-gradient(125deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_11px)] opacity-20" />

              <div className="relative z-10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {building.group}
                    </p>
                    <h3 className="text-xl font-semibold">{building.name}</h3>
                    <p
                      className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${statusStyle.badge}`}
                    >
                      {isActiveUpgradeTarget ? (
                        <>
                          <Clock3 className="size-3" />
                          Upgrading to Lv {activeUpgrade.toLevel}
                          {remainingTimeLabel ? ` (${remainingTimeLabel})` : ""}
                        </>
                      ) : (
                        cardStatus
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <GeneratorInfoPopover
                      details={
                        <div className="grid gap-1.5 text-[11px]">
                          <p>
                            Efficiency:{" "}
                            <span className="font-semibold text-white">
                              {efficiencyLabel(cardStatus, view.resources.energyRatio)}
                            </span>
                          </p>
                          <p>
                            Output:{" "}
                            <span className="font-semibold text-white">
                              {building.outputPerMinute.toLocaleString()} {building.outputLabel}/m
                            </span>
                          </p>
                          <p>
                            Energy Draw:{" "}
                            <span className="font-semibold text-white">
                              {building.energyUsePerMinute.toLocaleString()} MW
                            </span>
                          </p>
                          {resourceOverflow > 0 ? (
                            <p>
                              Overflow:{" "}
                              <span className="font-semibold text-amber-200">
                                {resourceOverflow.toLocaleString()} {resourceNameForBuilding(building.key)}
                              </span>
                            </p>
                          ) : (
                            <p>
                              Overflow: <span className="font-semibold text-white">None</span>
                            </p>
                          )}
                        </div>
                      }
                    />
                    <button
                      className="rounded-md border border-white/25 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10"
                      onClick={() =>
                        setActiveTableBuildingKey((current) =>
                          current === building.key ? null : building.key
                        )
                      }
                      type="button"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Layers3 className="size-3.5" />
                        Levels
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className={`rounded-lg border border-white/15 ${statusStyle.panel} p-3`}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                      Current Level
                    </p>
                    <p className="mt-1 text-xl font-semibold">Lv {building.currentLevel}</p>
                  </div>
                  <div className={`rounded-lg border border-white/15 ${statusStyle.panel} p-3`}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Output</p>
                    <p className="mt-1 text-xl font-semibold">
                      {building.outputPerMinute.toLocaleString()} {building.outputLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/75">
                  <p className="inline-flex items-center gap-1.5">
                    <Gauge className="size-3.5 text-cyan-200/80" />
                    Energy use: {building.energyUsePerMinute.toLocaleString()} MW
                  </p>
                </div>

                <div className="mt-3 flex justify-center">
                  <Popover.Root>
                    <Popover.Trigger
                      closeDelay={90}
                      delay={60}
                      openOnHover
                      render={
                        <UpgradeButton
                          actionDurationText={formatUpgradeTime(building.nextUpgradeDurationSeconds)}
                          disabled={!building.canUpgrade || isBusy}
                          icon="arrow"
                          label={isBusy ? "Queueing..." : "Upgrade"}
                          onClick={() => {
                            if (!building.canUpgrade || isBusy) {
                              return;
                            }

                            setUpgradingKey(building.key);
                            queueUpgrade({
                              colonyId: colonyIdAsId,
                              buildingKey: building.key,
                            })
                              .then(() => {
                                toast.success(`${building.name} upgrade queued`);
                              })
                              .catch((error) => {
                                toast.error(
                                  error instanceof Error ? error.message : "Failed to queue upgrade"
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
                              amount={building.nextUpgradeCost.alloy}
                              icon="/game-icons/alloy.png"
                              label="Alloy"
                            />
                            <CostPill
                              amount={building.nextUpgradeCost.crystal}
                              icon="/game-icons/crystal.png"
                              label="Crystal"
                            />
                            <CostPill
                              amount={building.nextUpgradeCost.fuel}
                              icon="/game-icons/deuterium.png"
                              label="Fuel"
                            />
                          </div>
                          {nextLevelDeltas.length > 0 ? (
                            <div className="mt-3 border-t border-white/15 pt-3">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                                Next Level Delta
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {nextLevelDeltas.map((delta) => (
                                  <DeltaPill
                                    icon={DELTA_RESOURCE_META[delta.key].icon}
                                    key={`${building.key}-${delta.key}`}
                                    label={DELTA_RESOURCE_META[delta.key].label}
                                    tone={delta.value > 0 ? "positive" : "negative"}
                                    value={formatSignedDelta(
                                      delta.value,
                                      DELTA_RESOURCE_META[delta.key].suffix
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </div>

                <AnimatePresence initial={false}>
                  {isTableOpen ? (
                    <motion.section
                      animate={{ clipPath: "inset(0 0% 0 0 round 14px)", opacity: 1 }}
                      className="absolute inset-0 z-30 overflow-hidden rounded-2xl border border-cyan-200/28 bg-[rgba(4,10,19,0.94)] shadow-[0_16px_42px_rgba(0,0,0,0.5)] backdrop-blur-md"
                      exit={{
                        clipPath: "inset(0 0% 0 100% round 14px)",
                        opacity: 0.95,
                      }}
                      initial={{
                        clipPath: "inset(0 0% 0 100% round 14px)",
                        opacity: 0.95,
                      }}
                      transition={{ duration: 0.34, ease: [0.24, 0.84, 0.32, 1] }}
                    >
                      <motion.div
                        animate={{ x: ["0%", "-100%"], opacity: [0.85, 0] }}
                        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-[linear-gradient(90deg,rgba(113,233,255,0),rgba(113,233,255,0.45),rgba(113,233,255,0))]"
                        initial={{ x: "0%", opacity: 0.85 }}
                        transition={{ duration: 0.34, ease: "easeOut" }}
                      />
                      <div className="h-full overflow-y-auto p-3.5 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-200/90">
                            <Layers3 className="size-3.5" strokeWidth={2.5} />
                            Level Planner
                          </p>
                          <button
                            className="rounded-full border border-white/30 bg-black/35 p-1 text-white transition hover:bg-black/55"
                            onClick={() => setActiveTableBuildingKey(null)}
                            type="button"
                          >
                            <X className="size-3.5" strokeWidth={2.4} />
                          </button>
                        </div>
                        <div className="overflow-hidden rounded-md border border-white/12 bg-black/25">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-white/6 text-slate-300">
                              <tr>
                                <th className="px-2 py-1.5">Lv</th>
                                <th className="px-2 py-1.5">Output</th>
                                <th className="px-2 py-1.5">Energy</th>
                                <th className="px-2 py-1.5">Cost</th>
                                <th className="px-2 py-1.5">Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {building.levelTable.map((row) => (
                                <tr
                                  className={
                                    row.level === building.currentLevel
                                      ? "bg-cyan-300/10 text-cyan-50"
                                      : "text-white/85"
                                  }
                                  key={`${building.key}-${row.level}`}
                                >
                                  <td className="px-2 py-1.5">{row.level}</td>
                                  <td className="px-2 py-1.5">
                                    {row.outputPerMinute.toLocaleString()} (
                                    {row.deltaOutputPerMinute >= 0 ? "+" : ""}
                                    {row.deltaOutputPerMinute.toLocaleString()})
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {row.energyUsePerMinute.toLocaleString()} (
                                    {row.deltaEnergyPerMinute >= 0 ? "+" : ""}
                                    {row.deltaEnergyPerMinute.toLocaleString()})
                                  </td>
                                  <td className="px-2 py-1.5">
                                    A {row.cost.alloy.toLocaleString()} / C{" "}
                                    {row.cost.crystal.toLocaleString()} / F {row.cost.fuel.toLocaleString()}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {formatUpgradeTime(row.durationSeconds)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function CostPill(props: { amount: number; icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[11px] font-semibold text-slate-100">
      <img
        alt={`${props.label} resource`}
        className="h-3.5 w-3.5 rounded-[2px] border border-white/25 object-cover"
        src={props.icon}
      />
      <span>{props.amount.toLocaleString()}</span>
    </span>
  );
}

function DeltaPill(props: {
  icon: string;
  label: string;
  tone: "negative" | "positive";
  value: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
        props.tone === "positive"
          ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-100"
          : "border-rose-300/35 bg-rose-400/14 text-rose-100"
      }`}
    >
      <img
        alt={`${props.label} resource`}
        className="h-3.5 w-3.5 rounded-[2px] border border-white/25 object-cover"
        src={props.icon}
      />
      <span>{props.value}</span>
    </span>
  );
}

function GeneratorInfoPopover({ details }: { details: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        closeDelay={120}
        delay={70}
        openOnHover
        render={
          <button
            className="rounded-full border border-white/30 bg-black/35 p-1.5 text-white transition hover:bg-black/55"
            type="button"
          >
            <Info className="size-3.5" strokeWidth={2.8} />
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner align="end" className="z-[90]" sideOffset={8}>
          <Popover.Popup className="origin-[var(--transform-origin)] w-[260px] rounded-xl border border-white/30 bg-[rgba(5,10,18,0.82)] p-3 text-xs text-white/90 shadow-[0_20px_45px_rgba(0,0,0,0.5)] outline-none backdrop-blur-md transition-[transform,scale,opacity] duration-200 data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Details</p>
            <div className="mt-2">{details}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
