import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Minus, Plus } from "lucide-react";
import { useState } from "react";

import {
  addToQueue,
  cancelQueueItem,
  CostPill,
  formatDuration,
  initialQueue,
  LockWarningPopover,
  QueuePanel,
  SHIPS,
} from "./shipyard-mock-shared";

export const Route = createFileRoute("/game/colony/$colonyId/shipyard")({
  component: ShipyardMockupFiveRoute,
});

function ShipyardMockupFiveRoute() {
  const [quantities, setQuantities] = useState<Record<string, number>>({
    "Colony Ship": 1,
    "Large Cargo": 2,
    "Small Cargo": 15,
  });
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState(initialQueue);

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4 pb-12 pt-6 text-white">
      <QueuePanel
        className="mt-1"
        items={queue}
        onCancel={(id) => setQueue((current) => cancelQueueItem(current, id))}
        title="Command Queue"
      />
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SHIPS.map((ship) => {
          const qty = quantities[ship.name] ?? 1;
          const qtyInput = quantityInputs[ship.name] ?? String(qty);
          return (
            <article
              className={`relative overflow-hidden rounded-2xl border ${
                ship.unlocked
                  ? "border-white/15 bg-[linear-gradient(160deg,rgba(10,16,29,0.95),rgba(4,8,14,0.99))]"
                  : "border-white/10 bg-[linear-gradient(160deg,rgba(43,47,56,0.55),rgba(20,22,27,0.72))] grayscale"
              } flex h-full flex-col p-3`}
              key={ship.name}
            >
              <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(76,185,255,0.15),transparent)]" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{ship.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-cyan-200/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                      Fleet {ship.stock.toLocaleString()}
                    </span>
                    {!ship.unlocked && ship.warning ? <LockWarningPopover message={ship.warning} /> : null}
                  </div>
                </div>

                <div className="mt-2 flex h-44 items-center justify-center">
                  <img alt={`${ship.name} render`} className="h-40 w-40 object-contain" src={ship.image} />
                </div>

                <div className="min-h-[108px]">
                  <p className="text-xs leading-relaxed text-white/75">{ship.description}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/70">
                    <Clock3 className="size-3.5" />
                    Build {formatDuration(ship.buildSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-white/70">Cargo {ship.cargo} • {ship.speed}</p>
                </div>

                <div className="mt-auto pt-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Queue Quantity</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-white/20 bg-black/25">
                      <button
                        className="px-2 py-1 disabled:opacity-35"
                        disabled={!ship.unlocked || qty <= 1}
                        onClick={() => {
                          const nextValue = Math.max(1, qty - 1);
                          setQuantities((current) => ({ ...current, [ship.name]: nextValue }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.name]: String(nextValue),
                          }));
                        }}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        className="w-14 bg-transparent px-1 text-center text-sm font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        max={999}
                        min={1}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (!/^\d*$/.test(raw)) {
                            return;
                          }
                          setQuantityInputs((current) => ({ ...current, [ship.name]: raw }));
                          if (raw === "") {
                            return;
                          }
                          const parsed = Number(raw);
                          if (!Number.isFinite(parsed)) {
                            return;
                          }
                          const nextValue = Math.max(1, Math.min(999, parsed));
                          setQuantities((current) => ({ ...current, [ship.name]: nextValue }));
                        }}
                        onBlur={() => {
                          const raw = quantityInputs[ship.name];
                          const parsed = Number(raw);
                          const normalized =
                            raw && Number.isFinite(parsed)
                              ? Math.max(1, Math.min(999, parsed))
                              : qty;
                          setQuantities((current) => ({ ...current, [ship.name]: normalized }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.name]: String(normalized),
                          }));
                        }}
                        type="number"
                        value={qtyInput}
                      />
                      <button
                        className="px-2 py-1 disabled:opacity-35"
                        disabled={!ship.unlocked}
                        onClick={() => {
                          const nextValue = Math.min(999, qty + 1);
                          setQuantities((current) => ({ ...current, [ship.name]: nextValue }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.name]: String(nextValue),
                          }));
                        }}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    className="mt-2 w-full rounded-xl border border-cyan-200/55 bg-cyan-300/20 px-3 py-3 text-cyan-100 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-100/80 hover:bg-cyan-300/30 hover:shadow-[0_0_28px_rgba(90,220,255,0.35)] disabled:transform-none disabled:border-white/15 disabled:bg-white/5 disabled:text-white/45 disabled:shadow-none"
                    disabled={!ship.unlocked}
                    onClick={() => setQueue((current) => addToQueue(current, ship.name, qty))}
                  >
                    <span className="block text-center text-[12px] font-semibold uppercase tracking-[0.12em]">
                      Queue {qty}
                    </span>
                    <span className="mt-1 flex flex-wrap justify-center gap-1.5">
                      <CostPill amount={ship.cost.alloy * qty} kind="alloy" label="Alloy" />
                      <CostPill amount={ship.cost.crystal * qty} kind="crystal" label="Crystal" />
                      <CostPill amount={ship.cost.fuel * qty} kind="fuel" label="Fuel" />
                    </span>
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
