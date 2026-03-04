import { createFileRoute } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { Clock3, Layers3 } from "lucide-react";
import { UpgradeButton } from "@/features/ui-mockups/components/upgrade-button";

export const Route = createFileRoute("/game/colony/$colonyId/facilties")({
  component: FaciltiesRoute,
});

type FacilityCard = {
  cost: {
    alloy: number;
    crystal: number;
    fuel: number;
  };
  key: string;
  name: string;
  image: string;
  level: number;
  status: "Online" | "Queued" | "Constructing";
  eta: string;
  summary: string;
};

const FACILITIES: FacilityCard[] = [
  {
    key: "shipyard",
    name: "Shipyard",
    image: "/game-icons/facilities/shipyard.png",
    cost: { alloy: 1600, crystal: 850, fuel: 200 },
    level: 1,
    status: "Constructing",
    eta: "13m 40s",
    summary: "Enables ship construction and unlocks fleet deployment pipelines.",
  },
  {
    key: "roboticsHub",
    name: "Robotics Hub",
    image: "/game-icons/facilities/robotics-hub.png",
    cost: { alloy: 980, crystal: 720, fuel: 120 },
    level: 4,
    status: "Online",
    eta: "9m 20s",
    summary: "Automates colony fabrication and improves infrastructure throughput.",
  },
  {
    key: "logisticsNexus",
    name: "Logistics Nexus",
    image: "/game-icons/facilities/logistics-nexus.png",
    cost: { alloy: 1240, crystal: 690, fuel: 260 },
    level: 2,
    status: "Queued",
    eta: "17m 05s",
    summary: "Routes supply chains and stabilizes construction queue timing.",
  },
  {
    key: "defenseMatrix",
    name: "Defense Matrix",
    image: "/game-icons/facilities/defense-matrix.png",
    cost: { alloy: 1380, crystal: 840, fuel: 300 },
    level: 3,
    status: "Online",
    eta: "12m 55s",
    summary: "Hardens perimeter coverage with shield and turret coordination.",
  },
  {
    key: "sensorArray",
    name: "Sensor Array",
    image: "/game-icons/facilities/sensor-array.png",
    cost: { alloy: 1120, crystal: 760, fuel: 180 },
    level: 2,
    status: "Queued",
    eta: "8m 10s",
    summary: "Expands regional scans and improves early-contact detection.",
  },
  {
    key: "commandNexus",
    name: "Command Nexus",
    image: "/game-icons/facilities/command-nexus.png",
    cost: { alloy: 1480, crystal: 920, fuel: 350 },
    level: 5,
    status: "Online",
    eta: "21m 30s",
    summary: "Central control center for doctrine, tasking, and fleet directives.",
  },
];

function statusClasses(status: FacilityCard["status"]) {
  if (status === "Constructing") {
    return "border-amber-200/55 bg-amber-300/15 text-amber-50";
  }
  if (status === "Queued") {
    return "border-cyan-200/55 bg-cyan-300/15 text-cyan-50";
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

function FaciltiesRoute() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 text-white">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FACILITIES.map((facility) => (
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
                  src={facility.image}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-white/78">
                <span className="inline-flex items-center gap-1">
                  <Layers3 className="size-3.5" />
                  Lv {facility.level}
                </span>
                <span className="inline-flex items-center gap-1 text-white/68">
                  <Clock3 className="size-3.5" />
                  {facility.eta}
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-white/70">{facility.summary}</p>

              <div className="mt-4">
                <Popover.Root>
                  <Popover.Trigger
                    closeDelay={90}
                    delay={60}
                    openOnHover
                    render={
                      <UpgradeButton
                        actionDurationText={facility.eta}
                        className="min-w-0 w-full"
                        icon="arrow"
                        label="Build / Upgrade"
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
                            amount={facility.cost.alloy}
                            icon="/game-icons/alloy.png"
                            label="Alloy"
                          />
                          <CostPill
                            amount={facility.cost.crystal}
                            icon="/game-icons/crystal.png"
                            label="Crystal"
                          />
                          <CostPill
                            amount={facility.cost.fuel}
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
        ))}
      </section>
    </div>
  );
}
