import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  Clock3,
  Crosshair,
  Globe2,
  Layers3,
  MapPin,
  Minus,
  Package,
  Plus,
  Rocket,
  RotateCcw,
  Ship,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { formatDuration } from "./shipyard-mock-shared";

export const Route = createFileRoute("/game/colony/$colonyId/fleet")({
  component: Fleet5Route,
});

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const SHIPS = [
  {
    key: "smallCargo" as const,
    name: "Small Cargo",
    image: "/game-icons/ships/small-cargo.png",
    owned: 37,
    deployed: 12,
    cargo: 5_000,
    speed: 10_000,
    fuelPerDist: 1,
  },
  {
    key: "largeCargo" as const,
    name: "Large Cargo",
    image: "/game-icons/ships/large-cargo.png",
    owned: 8,
    deployed: 2,
    cargo: 25_000,
    speed: 7_500,
    fuelPerDist: 2,
  },
  {
    key: "colonyShip" as const,
    name: "Colony Ship",
    image: "/game-icons/ships/colony-ship.png",
    owned: 1,
    deployed: 0,
    cargo: 7_500,
    speed: 2_500,
    fuelPerDist: 8,
  },
];

const ACTIVE_OPS = [
  {
    id: "op-1",
    kind: "transport" as const,
    status: "inTransit" as const,
    origin: "Kepler Prime",
    originCoords: "1:4:2:1",
    destination: "Vega Outpost",
    destCoords: "1:4:7:3",
    ships: { smallCargo: 8, largeCargo: 0, colonyShip: 0 },
    cargo: { alloy: 18_000, crystal: 12_000, fuel: 0 },
    departedAt: Date.now() - 340_000,
    arrivesAt: Date.now() + 480_000,
    totalDuration: 820_000,
    roundTrip: true,
  },
  {
    id: "op-2",
    kind: "transport" as const,
    status: "returning" as const,
    origin: "Kepler Prime",
    originCoords: "1:4:2:1",
    destination: "Arcturus Base",
    destCoords: "1:2:3:1",
    ships: { smallCargo: 4, largeCargo: 2, colonyShip: 0 },
    cargo: { alloy: 0, crystal: 0, fuel: 0 },
    departedAt: Date.now() - 900_000,
    arrivesAt: Date.now() + 120_000,
    totalDuration: 1_020_000,
    roundTrip: true,
  },
  {
    id: "op-3",
    kind: "colonize" as const,
    status: "inTransit" as const,
    origin: "Kepler Prime",
    originCoords: "1:4:2:1",
    destination: "Uncharted World",
    destCoords: "2:1:5:4",
    ships: { smallCargo: 0, largeCargo: 0, colonyShip: 1 },
    cargo: { alloy: 5_000, crystal: 3_000, fuel: 2_000 },
    departedAt: Date.now() - 1_200_000,
    arrivesAt: Date.now() + 2_400_000,
    totalDuration: 3_600_000,
    roundTrip: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function Fleet5Route() {
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [selectedShips, setSelectedShips] = useState<Record<string, number>>({
    smallCargo: 0,
    largeCargo: 0,
    colonyShip: 0,
  });
  const [missionType, setMissionType] = useState<"transport" | "colonize">(
    "transport"
  );
  const [roundTrip, setRoundTrip] = useState(true);
  const [coords, setCoords] = useState({ g: "", s: "", ss: "", p: "" });
  const [cargo, setCargo] = useState({ alloy: 0, crystal: 0, fuel: 0 });

  const totalCargo = SHIPS.reduce(
    (sum, s) => sum + (selectedShips[s.key] ?? 0) * s.cargo,
    0
  );
  const cargoUsed = cargo.alloy + cargo.crystal + cargo.fuel;
  const hasShips = Object.values(selectedShips).some((v) => v > 0);
  const slowest = SHIPS.reduce(
    (min, s) =>
      (selectedShips[s.key] ?? 0) > 0 ? Math.min(min, s.speed) : min,
    Infinity
  );
  const estDist = 42;
  const etaSec = hasShips ? Math.max(30, (estDist / slowest) * 3600) : 0;
  const fuelCost = SHIPS.reduce(
    (sum, s) => sum + (selectedShips[s.key] ?? 0) * s.fuelPerDist * estDist,
    0
  );

  const fleetTotal = SHIPS.reduce((s, sh) => s + sh.owned, 0);
  const fleetDeployed = SHIPS.reduce((s, sh) => s + sh.deployed, 0);
  const activeExpeditionsSection = (
    <div>
      <h2 className="flex items-center gap-2 font-[family-name:var(--nv-font-display)] text-sm font-bold">
        <Layers3 className="size-4 text-cyan-300/60" />
        Active Expeditions
      </h2>

      <div className="mt-3 space-y-2">
        {ACTIVE_OPS.map((op) => {
          const elapsed = Date.now() - op.departedAt;
          const progress = Math.min(100, (elapsed / op.totalDuration) * 100);
          const eta = Math.max(0, (op.arrivesAt - Date.now()) / 1000);
          const totalCargoAmt =
            op.cargo.alloy + op.cargo.crystal + op.cargo.fuel;
          const isExpanded = expandedOp === op.id;
          const isReturning = op.status === "returning";
          const accentColor = isReturning ? "amber" : "cyan";

          return (
            <div
              className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]"
              key={op.id}
            >
              {/* Compact row (always visible) */}
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
                onClick={() => setExpandedOp(isExpanded ? null : op.id)}
                type="button"
              >
                <span
                  className={`inline-block size-2 shrink-0 rounded-full ${
                    isReturning ? "bg-amber-400" : "bg-cyan-400"
                  }`}
                />

                <span className="min-w-0 shrink-0 text-xs font-semibold">
                  {op.destination}
                </span>

                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                    isReturning
                      ? "bg-amber-400/12 text-amber-200/80"
                      : "bg-cyan-400/12 text-cyan-200/80"
                  }`}
                >
                  {isReturning ? "Returning" : op.kind}
                </span>

                {/* Inline progress bar */}
                <div className="mx-1 hidden h-1 min-w-[60px] flex-1 overflow-hidden rounded-full bg-white/8 sm:block">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isReturning ? "bg-amber-400/50" : "bg-cyan-400/50"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <span className="shrink-0 font-[family-name:var(--nv-font-mono)] text-[10px] text-white/35">
                  {Math.round(progress)}%
                </span>

                <div className="flex shrink-0 items-center gap-1 text-[10px] text-white/45">
                  <Clock3 className="size-3" />
                  <span className="font-[family-name:var(--nv-font-mono)] font-semibold text-cyan-100">
                    {formatDuration(eta)}
                  </span>
                </div>

                <ChevronDown
                  className={`ml-auto size-3.5 shrink-0 text-white/25 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded details — height animated via grid-row */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
                style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-white/6">
                    {/* Journey visualization */}
                    <div className="relative px-5 pt-5 pb-8">
                      <div className="flex items-center justify-between">
                        {/* Origin */}
                        <div
                          className="z-10 text-center"
                          style={
                            isExpanded
                              ? {
                                  animation:
                                    "nv-fleet-node-in 360ms cubic-bezier(0.21,1,0.34,1) both",
                                  animationDelay: "60ms",
                                }
                              : { opacity: 0 }
                          }
                        >
                          <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
                            <MapPin className="size-4 text-white/50" />
                          </div>
                          <p className="mt-1.5 text-[11px] font-semibold">
                            {op.origin}
                          </p>
                          <p className="font-[family-name:var(--nv-font-mono)] text-[9px] text-white/30">
                            {op.originCoords}
                          </p>
                        </div>

                        {/* Journey line with ship indicator */}
                        <div className="absolute inset-x-[72px] top-[40px]">
                          <div className="h-px bg-white/10" />
                          <div
                            className={`absolute top-0 h-px ${
                              isReturning
                                ? "bg-gradient-to-r from-amber-400/60 to-amber-400/20"
                                : "bg-gradient-to-r from-cyan-400/60 to-cyan-400/20"
                            }`}
                            style={
                              isExpanded
                                ? {
                                    width: `${progress}%`,
                                    animation:
                                      "nv-fleet-line-draw 500ms cubic-bezier(0.21,1,0.34,1) both",
                                    animationDelay: "140ms",
                                  }
                                : { width: 0, opacity: 0 }
                            }
                          />
                          <div
                            className="absolute -top-3 flex flex-col items-center"
                            style={
                              isExpanded
                                ? {
                                    left: `calc(${progress}% - 12px)`,
                                    animation:
                                      "nv-fleet-ship-in 400ms cubic-bezier(0.21,1,0.34,1) both",
                                    animationDelay: "280ms",
                                  }
                                : {
                                    left: `calc(${progress}% - 12px)`,
                                    opacity: 0,
                                  }
                            }
                          >
                            <div
                              className={`flex size-6 items-center justify-center rounded-full border-2 shadow-lg ${
                                isReturning
                                  ? "border-amber-300 bg-amber-400/20 shadow-amber-400/30"
                                  : "border-cyan-300 bg-cyan-400/20 shadow-cyan-400/30"
                              }`}
                            >
                              <Ship
                                className={`size-3 ${
                                  isReturning
                                    ? "rotate-180 text-amber-300"
                                    : "text-cyan-300"
                                }`}
                              />
                            </div>
                            <span className="mt-0.5 font-[family-name:var(--nv-font-mono)] text-[8px] text-white/30">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </div>

                        {/* Destination */}
                        <div
                          className="z-10 text-center"
                          style={
                            isExpanded
                              ? {
                                  animation:
                                    "nv-fleet-node-in 360ms cubic-bezier(0.21,1,0.34,1) both",
                                  animationDelay: "180ms",
                                }
                              : { opacity: 0 }
                          }
                        >
                          <div
                            className={`mx-auto flex size-10 items-center justify-center rounded-full border ${
                              op.kind === "colonize"
                                ? "border-amber-300/25 bg-amber-400/10"
                                : "border-cyan-300/25 bg-cyan-400/10"
                            }`}
                          >
                            {op.kind === "colonize" ? (
                              <Globe2 className="size-4 text-amber-300" />
                            ) : (
                              <MapPin className="size-4 text-cyan-300" />
                            )}
                          </div>
                          <p className="mt-1.5 text-[11px] font-semibold">
                            {op.destination}
                          </p>
                          <p className="font-[family-name:var(--nv-font-mono)] text-[9px] text-white/30">
                            {op.destCoords}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Detail chips */}
                    <div
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/6 px-5 py-3"
                      style={
                        isExpanded
                          ? {
                              animation:
                                "nv-fleet-chips-in 350ms cubic-bezier(0.21,1,0.34,1) both",
                              animationDelay: "320ms",
                            }
                          : { opacity: 0 }
                      }
                    >
                      <div className="flex items-center gap-1 text-[10px] text-white/45">
                        <Ship className="size-3" />
                        {Object.entries(op.ships)
                          .filter(([, c]) => c > 0)
                          .map(
                            ([k, c]) =>
                              `${c}x ${SHIPS.find((s) => s.key === k)?.name}`
                          )
                          .join(", ")}
                      </div>

                      {totalCargoAmt > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-white/45">
                          <Package className="size-3" />
                          {totalCargoAmt.toLocaleString()} cargo
                        </div>
                      )}

                      {op.roundTrip && (
                        <div className="flex items-center gap-1 text-[10px] text-white/45">
                          <RotateCcw className="size-3" />
                          Round trip
                        </div>
                      )}

                      <span className="font-[family-name:var(--nv-font-mono)] text-[10px] text-white/30">
                        {op.destCoords}
                      </span>

                      <button
                        className="ml-auto rounded-md border border-rose-300/20 bg-rose-400/8 px-2.5 py-1 text-[10px] font-medium text-rose-200/80 transition-colors hover:border-rose-200/35 hover:bg-rose-400/12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-4 text-white">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_450px]">
        {/* ══ Left Column: Garrison + Active Expeditions ══ */}
        <div className="space-y-5">
          {/* Active Expeditions */}
          {activeExpeditionsSection}
          {/* Garrison Strip */}
          <div className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/8">
                <Ship className="size-4 text-cyan-300" />
              </div>
              <div>
                <h1 className="font-[family-name:var(--nv-font-display)] text-lg font-bold">
                  Fleet
                </h1>
                <p className="text-[10px] text-white/40">
                  {fleetTotal} ships • {fleetDeployed} deployed •{" "}
                  {fleetTotal - fleetDeployed} available
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {SHIPS.map((ship) => {
                const avail = ship.owned - ship.deployed;
                return (
                  <div
                    className="flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"
                    key={ship.key}
                  >
                    <img
                      alt={ship.name}
                      className="size-12 rounded-lg border border-white/8 bg-black/30 object-contain p-1"
                      src={ship.image}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{ship.name}</p>
                      <div className="mt-0.5 flex gap-2 text-[10px]">
                        <span className="text-emerald-300/70">
                          {avail} avail
                        </span>
                        <span className="text-white/30">|</span>
                        <span className="text-cyan-200/50">
                          {ship.deployed} out
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-cyan-400/40"
                          style={{
                            width: `${
                              ship.owned > 0
                                ? (ship.deployed / ship.owned) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ Right Column: Expedition Planner (always visible) ══ */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-white/12 bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]">
            {/* Planner header */}
            <div className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5">
              <Rocket className="size-5 text-cyan-300" />
              <h2 className="font-[family-name:var(--nv-font-display)] text-sm font-bold">
                Plan Expedition
              </h2>
            </div>

            <div className="space-y-4 p-5">
              {/* Mission Type */}
              <div>
                <SectionLabel>Mission Type</SectionLabel>
                <div className="mt-1.5 flex gap-2">
                  {(["transport", "colonize"] as const).map((type) => (
                    <button
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all ${
                        missionType === type
                          ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/60"
                      }`}
                      key={type}
                      onClick={() => setMissionType(type)}
                    >
                      {type === "transport" ? (
                        <Package className="size-3.5" />
                      ) : (
                        <Globe2 className="size-3.5" />
                      )}
                      <span className="capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div>
                <SectionLabel>Destination</SectionLabel>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {(["g", "s", "ss", "p"] as const).map((field, i) => (
                    <div key={field}>
                      <span className="block text-center text-[7px] uppercase text-white/25">
                        {["Gal", "Sec", "Sys", "Pla"][i]}
                      </span>
                      <input
                        className="w-full rounded-md border border-white/12 bg-black/35 px-1 py-1.5 text-center font-[family-name:var(--nv-font-mono)] text-sm text-white outline-none focus:border-cyan-300/40"
                        maxLength={3}
                        onChange={(e) =>
                          setCoords((c) => ({ ...c, [field]: e.target.value }))
                        }
                        value={coords[field]}
                      />
                    </div>
                  ))}
                </div>
                <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 py-2 text-[10px] text-white/30 hover:border-cyan-300/20 hover:text-cyan-200/50">
                  <Crosshair className="size-3" />
                  Select from Star Map
                </button>
              </div>

              {/* Round Trip */}
              <div className="flex items-center justify-between rounded-lg border border-white/8 bg-black/15 p-2.5">
                <div className="flex items-center gap-2">
                  <RotateCcw
                    className={`size-3.5 ${
                      roundTrip ? "text-cyan-300" : "text-white/25"
                    }`}
                  />
                  <span className="text-xs text-white/55">Round Trip</span>
                </div>
                <button
                  className={`relative h-6 w-10 rounded-full border transition-all ${
                    roundTrip
                      ? "border-cyan-300/40 bg-cyan-400/20"
                      : "border-white/15 bg-white/8"
                  }`}
                  onClick={() => setRoundTrip(!roundTrip)}
                  type="button"
                >
                  <span
                    className={`absolute left-[3px] top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${
                      roundTrip ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Fleet Selection */}
              <div>
                <SectionLabel>Fleet</SectionLabel>
                <div className="mt-1.5">
                  {SHIPS.map((ship, i) => {
                    const avail = ship.owned - ship.deployed;
                    const count = selectedShips[ship.key] ?? 0;
                    return (
                      <div
                        className={`flex items-center gap-2 py-1.5 ${
                          i < SHIPS.length - 1 ? "border-b border-white/6" : ""
                        }`}
                        key={ship.key}
                      >
                        <img
                          alt={ship.name}
                          className="size-5 shrink-0 object-contain"
                          src={ship.image}
                        />
                        <span className={`min-w-0 flex-1 truncate text-xs ${count > 0 ? "font-semibold text-white" : "text-white/70"}`}>
                          {ship.name}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--nv-font-mono)] text-[9px] text-white/30">
                          ({avail})
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            className="flex size-5 items-center justify-center rounded border border-white/10 bg-black/25 text-white/60 disabled:opacity-25"
                            disabled={count <= 0}
                            onClick={() =>
                              setSelectedShips((s) => ({
                                ...s,
                                [ship.key]: Math.max(0, count - 1),
                              }))
                            }
                          >
                            <Minus className="size-2.5" />
                          </button>
                          <span className={`w-6 text-center font-[family-name:var(--nv-font-mono)] text-xs font-bold ${count > 0 ? "text-cyan-100" : "text-white/30"}`}>
                            {count}
                          </span>
                          <button
                            className="flex size-5 items-center justify-center rounded border border-white/10 bg-black/25 text-white/60 disabled:opacity-25"
                            disabled={count >= avail}
                            onClick={() =>
                              setSelectedShips((s) => ({
                                ...s,
                                [ship.key]: Math.min(avail, count + 1),
                              }))
                            }
                          >
                            <Plus className="size-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cargo */}
              <div>
                <div className="flex items-center justify-between">
                  <SectionLabel>Cargo</SectionLabel>
                  <span className="font-[family-name:var(--nv-font-mono)] text-[9px] text-white/25">
                    {cargoUsed.toLocaleString()} / {totalCargo.toLocaleString()}
                  </span>
                </div>
                {totalCargo > 0 && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400/60 to-cyan-300/40 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (cargoUsed / totalCargo) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  {(["alloy", "crystal", "fuel"] as const).map((res) => (
                    <div className="flex items-center gap-2" key={res}>
                      <img
                        alt={res}
                        className="size-4 object-contain"
                        src={`/game-icons/${
                          res === "fuel" ? "deuterium" : res
                        }.png`}
                      />
                      <span className="w-12 text-[10px] capitalize text-white/45">
                        {res}
                      </span>
                      <input
                        className="flex-1 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-right font-[family-name:var(--nv-font-mono)] text-xs text-white outline-none focus:border-cyan-300/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        max={totalCargo}
                        min={0}
                        onChange={(e) =>
                          setCargo((c) => ({
                            ...c,
                            [res]: Math.max(
                              0,
                              Math.min(totalCargo, Number(e.target.value) || 0)
                            ),
                          }))
                        }
                        type="number"
                        value={cargo[res]}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Trip summary */}
              {hasShips && (
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.04] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard
                      label="One Way"
                      value={formatDuration(etaSec)}
                    />
                    <MetricCard
                      label={roundTrip ? "Round Trip" : "Total"}
                      value={formatDuration(roundTrip ? etaSec * 2 : etaSec)}
                    />
                    <MetricCard
                      label="Fuel Cost"
                      value={fuelCost.toLocaleString()}
                    />
                    <MetricCard
                      label="Speed"
                      value={isFinite(slowest) ? slowest.toLocaleString() : "—"}
                    />
                  </div>
                </div>
              )}

              {/* Launch button */}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/50 bg-gradient-to-b from-cyan-400/25 to-cyan-400/10 px-4 py-3 font-[family-name:var(--nv-font-display)] text-sm font-bold uppercase tracking-[0.08em] text-cyan-50 shadow-[0_0_20px_rgba(61,217,255,0.12)] transition-all hover:-translate-y-0.5 hover:border-cyan-100/70 hover:shadow-[0_0_30px_rgba(61,217,255,0.25)] disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30 disabled:shadow-none"
                disabled={!hasShips}
              >
                <Sparkles className="size-4" />
                {hasShips ? "Launch Expedition" : "Assign Ships"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel(props: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
      {props.children}
    </p>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-cyan-300/10 bg-cyan-400/[0.03] p-2">
      <p className="text-[8px] uppercase tracking-[0.1em] text-cyan-200/45">
        {props.label}
      </p>
      <p className="mt-0.5 font-[family-name:var(--nv-font-mono)] text-xs font-bold text-cyan-100">
        {props.value}
      </p>
    </div>
  );
}
