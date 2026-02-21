import { createFileRoute } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { UpgradeButton } from "@/features/ui-mockups/components/upgrade-button";
import { Gauge, Info, LayersPlus, Settings, X } from "lucide-react";

export const Route = createFileRoute("/game/colony/$colonyId/resources")({
  component: UiMockupSixRoute,
});

type GeneratorStatus = "Running" | "Shortage" | "Overflow" | "Paused";

type GeneratorGroup = "Production" | "Power";
type UpgradeResourceKey = "alloy" | "crystal" | "fuel";

type GeneratorDatum = {
  accent: string;
  baseEnergy: number;
  baseRate: number;
  details: {
    efficiency: string;
    inputs: string;
    output: string;
    overflow: string;
  };
  id: string;
  imageUrl: string;
  name: string;
  status: GeneratorStatus;
  unit: string;
  group: GeneratorGroup;
  upgradeCost: Partial<Record<UpgradeResourceKey, number>>;
};

const AVAILABLE_UPGRADE_RESOURCES: Record<UpgradeResourceKey, number> = {
  alloy: 143_200,
  crystal: 96_500,
  fuel: 53_700,
};

const RESOURCE_ICON_BY_KEY: Record<UpgradeResourceKey, string> = {
  alloy: "/game-icons/alloy.png",
  crystal: "/game-icons/crystal.png",
  fuel: "/game-icons/deuterium.png",
};

const generatorData: GeneratorDatum[] = [
  {
    accent: "rgba(74, 233, 255, 0.65)",
    baseEnergy: 34,
    baseRate: 220,
    details: {
      efficiency: "92%",
      inputs: "Consumes 34 MW",
      output: "Alloy ore",
      overflow: "No overflow",
    },
    id: "alloy-rig",
    imageUrl: "/game-icons/alloy.png",
    name: "Alloy Extraction Rig",
    status: "Running",
    unit: "Alloy / min",
    group: "Production",
    upgradeCost: { alloy: 22_000, crystal: 8_000 },
  },
  {
    accent: "rgba(122, 181, 255, 0.62)",
    baseEnergy: 29,
    baseRate: 172,
    details: {
      efficiency: "84%",
      inputs: "Consumes 29 MW",
      output: "Crystal",
      overflow: "Transport lag 5m",
    },
    id: "crystal-bore",
    imageUrl: "/game-icons/crystal.png",
    name: "Crystal Boreline",
    status: "Overflow",
    unit: "Crystal / min",
    group: "Production",
    upgradeCost: { alloy: 20_000, crystal: 11_000, fuel: 7_000 },
  },
  {
    accent: "rgba(255, 170, 106, 0.7)",
    baseEnergy: 25,
    baseRate: 140,
    details: {
      efficiency: "77%",
      inputs: "Consumes 25 MW",
      output: "Fuel",
      overflow: "No overflow",
    },
    id: "fuel-well",
    imageUrl: "/game-icons/deuterium.png",
    name: "Deuterium Well",
    status: "Shortage",
    unit: "Fuel / min",
    group: "Production",
    upgradeCost: { alloy: 17_000, crystal: 6_500 },
  },
  {
    accent: "rgba(255, 125, 167, 0.66)",
    baseEnergy: 52,
    baseRate: 360,
    details: {
      efficiency: "95%",
      inputs: "Consumes deuterium",
      output: "Grid energy",
      overflow: "No overflow",
    },
    id: "fusion-stack",
    imageUrl: "/game-icons/energy.png",
    name: "Fusion Stack",
    status: "Running",
    unit: "MW",
    group: "Power",
    upgradeCost: { alloy: 35_000, crystal: 18_000, fuel: 14_000 },
  },
  {
    accent: "rgba(255, 101, 101, 0.68)",
    baseEnergy: 45,
    baseRate: 220,
    details: {
      efficiency: "0%",
      inputs: "Needs crystal rods",
      output: "Emergency energy",
      overflow: "Production paused",
    },
    id: "aux-reactor",
    imageUrl: "/game-icons/energy.png",
    name: "Auxiliary Reactor",
    status: "Paused",
    unit: "MW",
    group: "Power",
    upgradeCost: { alloy: 65_000, crystal: 43_000, fuel: 72_000 },
  },
];

const STATUS_STYLES: Record<
  GeneratorStatus,
  { badge: string; card: string; panel: string }
> = {
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

function UiMockupSixRoute() {
  const [scales, setScales] = useState<Record<string, number>>({
    "alloy-rig": 6,
    "aux-reactor": 0,
    "crystal-bore": 7,
    "fuel-well": 5,
    "fusion-stack": 8,
  });
  const [draftScales, setDraftScales] = useState<Record<string, number>>({
    "alloy-rig": 6,
    "aux-reactor": 0,
    "crystal-bore": 7,
    "fuel-well": 5,
    "fusion-stack": 8,
  });
  const [openSettingsCardId, setOpenSettingsCardId] = useState<string | null>(
    null
  );
  const [openLevelsCardId, setOpenLevelsCardId] = useState<string | null>(null);
  const [savedSettingsCardId, setSavedSettingsCardId] = useState<string | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const groupedGenerators = useMemo(() => {
    return {
      Production: generatorData.filter((item) => item.group === "Production"),
      Power: generatorData.filter((item) => item.group === "Power"),
    };
  }, []);

  const updateScale = (id: string, nextValue: number) => {
    const clamped = Math.max(0, Math.min(10, nextValue));
    setScales((prev) => ({ ...prev, [id]: clamped }));
  };

  const updateDraftScale = (id: string, nextValue: number) => {
    const clamped = Math.max(0, Math.min(10, nextValue));
    setDraftScales((prev) => ({ ...prev, [id]: clamped }));
  };

  const getProductionAtScale = (
    generator: GeneratorDatum,
    scaleLevel: number
  ) => {
    return Math.round((generator.baseRate * scaleLevel) / 5);
  };

  const getEnergyAtScale = (generator: GeneratorDatum, scaleLevel: number) => {
    return Math.max(
      0,
      Math.round(generator.baseEnergy * (0.45 + scaleLevel * 0.115))
    );
  };

  const renderCard = (generator: GeneratorDatum, index: number) => {
    const scale = scales[generator.id] ?? 0;
    const draftScale = draftScales[generator.id] ?? scale;
    const scalePercent = scale * 10;
    const draftScalePercent = draftScale * 10;
    const output = getProductionAtScale(generator, scale);
    const draftOutput = getProductionAtScale(generator, draftScale);
    const currentEnergy = getEnergyAtScale(generator, scale);
    const draftEnergy = getEnergyAtScale(generator, draftScale);
    const productionDelta = draftOutput - output;
    const energyDelta = draftEnergy - currentEnergy;
    const isSettingsOpen = openSettingsCardId === generator.id;
    const isLevelsOpen = openLevelsCardId === generator.id;
    const isSavedFlash = savedSettingsCardId === generator.id;
    const statusStyle = STATUS_STYLES[generator.status];
    const upgradeCostEntries = Object.entries(generator.upgradeCost) as [
      UpgradeResourceKey,
      number
    ][];
    const canUpgrade = upgradeCostEntries.every(
      ([resourceKey, requiredAmount]) =>
        AVAILABLE_UPGRADE_RESOURCES[resourceKey] >= requiredAmount
    );

    return (
      <article
        className={`group relative overflow-hidden rounded-2xl border ${statusStyle.card} bg-[#060f1a] shadow-[0_16px_34px_rgba(0,0,0,0.4)]`}
        key={generator.id}
        style={{
          opacity: isReady ? 1 : 0,
          transform: isReady ? "translateY(0px)" : "translateY(20px)",
          transition: `opacity 460ms ease, transform 520ms ease ${
            index * 60
          }ms`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 78% 24%, ${generator.accent}, transparent 38%), linear-gradient(164deg, rgba(9,17,29,0.74), rgba(1,5,12,0.94) 62%), url(${generator.imageUrl})`,
            backgroundPosition: "center, center, calc(100% + 35px) 52%",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            backgroundSize: "cover, cover, 56%",
          }}
        />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(125deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_11px)] opacity-20" />
        <div className="relative z-10 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-slate-200/70">
                {generator.group}
              </p>
              <h3 className="mt-1 max-w-[23ch] text-lg font-semibold leading-tight text-slate-50">
                {generator.name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${statusStyle.badge}`}
              >
                {generator.status}
              </span>
              <GeneratorInfoPopover
                details={generator.details}
                panelClassName={statusStyle.panel}
              />
              <button
                className="rounded-full border border-white/30 bg-black/35 p-1.5 text-white transition hover:bg-black/55"
                onClick={() => {
                  setOpenLevelsCardId(null);
                  setOpenSettingsCardId((current) =>
                    current === generator.id ? null : generator.id
                  );
                  setDraftScales((prev) => ({
                    ...prev,
                    [generator.id]: scale,
                  }));
                }}
                type="button"
              >
                <Settings className="size-3.5" strokeWidth={2.4} />
              </button>
              <button
                className="relative rounded-full border border-white/30 bg-black/35 p-1.5 text-white transition hover:bg-black/55"
                onClick={() => {
                  setOpenSettingsCardId(null);
                  setOpenLevelsCardId((current) =>
                    current === generator.id ? null : generator.id
                  );
                }}
                type="button"
              >
                <LayersPlus className="size-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/20 bg-black/34 p-3 backdrop-blur-sm">
            <div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-300/80">
                  Current Output
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {output.toLocaleString()}{" "}
                  <span className="text-sm font-medium text-slate-300">
                    {generator.unit}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/18 bg-black/28 p-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/80">
              Upgrade Cost
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {upgradeCostEntries.map(([resourceKey, requiredAmount]) => {
                  const availableAmount =
                    AVAILABLE_UPGRADE_RESOURCES[resourceKey];
                  const isMissing = availableAmount < requiredAmount;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        isMissing
                          ? "border-rose-300/60 bg-rose-500/25 text-rose-100"
                          : "border-white/20 bg-black/35 text-slate-100"
                      }`}
                      key={resourceKey}
                    >
                      <img
                        alt={`${resourceKey} resource`}
                        className="h-3.5 w-3.5 rounded-[2px] border border-white/25 object-cover"
                        src={RESOURCE_ICON_BY_KEY[resourceKey]}
                      />
                      <span>{requiredAmount.toLocaleString()}</span>
                    </span>
                  );
                })}
              </div>
              <UpgradeButton disabled={!canUpgrade} label="Upgrade" />
            </div>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {isSettingsOpen ? (
            <motion.section
              animate={{ clipPath: "inset(0 0% 0 0 round 15px)", opacity: 1 }}
              className="absolute inset-0 z-30 overflow-hidden rounded-2xl border border-cyan-200/28 bg-[rgba(4,10,19,0.94)] shadow-[0_16px_42px_rgba(0,0,0,0.5)] backdrop-blur-md"
              exit={{
                clipPath: "inset(0 0% 0 100% round 15px)",
                opacity: 0.95,
              }}
              initial={{
                clipPath: "inset(0 0% 0 100% round 15px)",
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
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-200/90">
                    <Gauge className="size-3.5" strokeWidth={2.5} />
                    Production Scaling
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-300">
                      Saved {scalePercent}%
                    </span>
                    <button
                      className="rounded-full border border-white/30 bg-black/35 p-1 text-white transition hover:bg-black/55"
                      onClick={() => setOpenSettingsCardId(null)}
                      type="button"
                    >
                      <X className="size-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 rounded-md border border-white/12 bg-black/30 p-2 text-xs sm:grid-cols-2">
                  <p className="text-slate-200">
                    Production:{" "}
                    <span className="font-semibold text-white">
                      {draftOutput.toLocaleString()} {generator.unit}
                    </span>{" "}
                    <span
                      className={
                        productionDelta >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      ({productionDelta >= 0 ? "+" : ""}
                      {productionDelta.toLocaleString()})
                    </span>
                  </p>
                  <p className="text-slate-200">
                    Energy:{" "}
                    <span className="font-semibold text-white">
                      {draftEnergy} MW
                    </span>{" "}
                    <span
                      className={
                        energyDelta <= 0 ? "text-emerald-300" : "text-amber-300"
                      }
                    >
                      ({energyDelta >= 0 ? "+" : ""}
                      {energyDelta} MW)
                    </span>
                  </p>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                    <span>Scale</span>
                    <span>{draftScalePercent}%</span>
                  </div>
                  <input
                    aria-label={`${generator.name} scale`}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-cyan-200"
                    max={10}
                    min={0}
                    onChange={(event) =>
                      updateDraftScale(generator.id, Number(event.target.value))
                    }
                    step={1}
                    type="range"
                    value={draftScale}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[11px] text-slate-300">
                      Apply new operating scale to balance output and draw.
                    </p>
                    <button
                      className="rounded-md border border-cyan-200/45 bg-cyan-300/16 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-300/24"
                      onClick={() => {
                        updateScale(generator.id, draftScale);
                        setSavedSettingsCardId(generator.id);
                        window.setTimeout(() => {
                          setSavedSettingsCardId((current) =>
                            current === generator.id ? null : current
                          );
                        }, 1400);
                      }}
                      type="button"
                    >
                      Save Setting
                    </button>
                  </div>
                  {isSavedFlash ? (
                    <p className="mt-1 text-[11px] text-emerald-300">
                      Scale saved.
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {isLevelsOpen ? (
            <motion.section
              animate={{ clipPath: "inset(0 0% 0 0 round 15px)", opacity: 1 }}
              className="absolute inset-0 z-30 overflow-hidden rounded-2xl border border-cyan-200/28 bg-[rgba(4,10,19,0.94)] shadow-[0_16px_42px_rgba(0,0,0,0.5)] backdrop-blur-md"
              exit={{
                clipPath: "inset(0 0% 0 100% round 15px)",
                opacity: 0.95,
              }}
              initial={{
                clipPath: "inset(0 0% 0 100% round 15px)",
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
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-200/90">
                    <LayersPlus className="size-3.5" strokeWidth={2.5} />
                    Level Planner
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-300">
                      Current {scalePercent}%
                    </span>
                    <button
                      className="rounded-full border border-white/30 bg-black/35 p-1 text-white transition hover:bg-black/55"
                      onClick={() => setOpenLevelsCardId(null)}
                      type="button"
                    >
                      <X className="size-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-md border border-white/12 bg-black/25">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/6 text-slate-300">
                      <tr>
                        <th className="px-2 py-1.5">Lvl</th>
                        <th className="px-2 py-1.5">Prod.</th>
                        <th className="px-2 py-1.5">Energy</th>
                        <th className="px-2 py-1.5">dProd</th>
                        <th className="px-2 py-1.5">dEnergy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }, (_, levelIndex) => {
                        const level = levelIndex + 1;
                        const levelProd = getProductionAtScale(
                          generator,
                          level
                        );
                        const levelEnergy = getEnergyAtScale(generator, level);
                        const deltaProd = levelProd - output;
                        const deltaEnergy = levelEnergy - currentEnergy;
                        const isCurrent = level === scale;
                        return (
                          <tr
                            className={
                              isCurrent
                                ? "bg-cyan-300/10 text-cyan-50"
                                : "text-slate-200/90"
                            }
                            key={level}
                          >
                            <td className="px-2 py-1.5">{level}</td>
                            <td className="px-2 py-1.5">
                              {levelProd.toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5">{levelEnergy} MW</td>
                            <td
                              className={
                                deltaProd >= 0
                                  ? "px-2 py-1.5 text-emerald-300"
                                  : "px-2 py-1.5 text-rose-300"
                              }
                            >
                              {deltaProd >= 0 ? "+" : ""}
                              {deltaProd.toLocaleString()}
                            </td>
                            <td
                              className={
                                deltaEnergy <= 0
                                  ? "px-2 py-1.5 text-emerald-300"
                                  : "px-2 py-1.5 text-amber-300"
                              }
                            >
                              {deltaEnergy >= 0 ? "+" : ""}
                              {deltaEnergy}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </article>
    );
  };

  return (
    <div
      className="text-white"
      style={{ fontFamily: '"Rajdhani","Sora","Avenir Next",sans-serif' }}
    >
      <div className="mx-auto w-full max-w-[1380px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <section className="mt-6 space-y-7">
          <GeneratorSection
            title="Production"
            description="All extraction and harvesting generators."
            cards={groupedGenerators.Production}
            renderCard={renderCard}
          />
          <GeneratorSection
            title="Power"
            description="Grid-facing energy generation and reserve systems."
            cards={groupedGenerators.Power}
            renderCard={renderCard}
          />
        </section>
      </div>
    </div>
  );
}

type GeneratorSectionProps = {
  cards: GeneratorDatum[];
  description: string;
  renderCard: (generator: GeneratorDatum, index: number) => ReactNode;
  title: string;
};

function GeneratorInfoPopover({
  details,
  panelClassName,
}: {
  details: GeneratorDatum["details"];
  panelClassName: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="rounded-full border border-white/30 bg-black/35 px-1.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white transition hover:bg-black/55"
        closeDelay={80}
        delay={60}
        openOnHover
      >
        <Info className="size-3.5" strokeWidth={2.8} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8}>
          <Popover.Popup
            className={`z-40 w-[244px] rounded-xl border border-white/25 p-3 text-xs text-white/90 shadow-[0_20px_45px_rgba(0,0,0,0.5)] outline-none ${panelClassName}`}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
              Flow Detail
            </p>
            <div className="mt-2 grid gap-1.5">
              <p>Input: {details.inputs}</p>
              <p>Output: {details.output}</p>
              <p>Efficiency: {details.efficiency}</p>
              <p>Overflow: {details.overflow}</p>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function GeneratorSection({
  cards,
  description,
  renderCard,
  title,
}: GeneratorSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">{title}</h2>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">
            {description}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
        {cards.map((card, index) => renderCard(card, index))}
      </div>
    </section>
  );
}
