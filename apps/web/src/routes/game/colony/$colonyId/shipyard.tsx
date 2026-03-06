import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ShipKey } from "@nullvector/game-logic";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";
import {
  CostPill,
  formatDuration,
  LockWarningPopover,
  QueuePanel,
  type QueueItem,
} from "./shipyard-mock-shared";

const SHIP_PRESENTATION: Record<
  ShipKey,
  {
    description: string;
    image: string;
  }
> = {
  smallCargo: {
    description:
      "Short-haul freighter for balancing alloy and crystal across nearby colonies.",
    image: "/game-icons/ships/small-cargo.png",
  },
  largeCargo: {
    description:
      "Bulk logistics hull with expanded cargo pods and reinforced engines.",
    image: "/game-icons/ships/large-cargo.png",
  },
  colonyShip: {
    description:
      "Ark-class expansion vessel carrying habitat modules and colony command systems.",
    image: "/game-icons/ships/colony-ship.png",
  },
};

type ShipBuildQueueRow = {
  completesAt: number;
  id: Id<"colonyQueueItems">;
  kind: "shipBuild";
  payload: {
    completedQuantity: number;
    perUnitDurationSeconds: number;
    quantity: number;
    shipKey: ShipKey;
  };
  status: "active" | "queued" | "completed" | "cancelled" | "failed";
};

function isShipBuildQueueRow(item: {
  kind: string;
  payload: unknown;
}): item is ShipBuildQueueRow {
  return (
    item.kind === "shipBuild" &&
    typeof item.payload === "object" &&
    item.payload !== null &&
    "shipKey" in item.payload
  );
}

export const Route = createFileRoute("/game/colony/$colonyId/shipyard")({
  component: ShipyardRoute,
});

function ShipyardRoute() {
  const { colonyId } = Route.useParams();
  const colonyIdAsId = colonyId as Id<"colonies">;
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const shipCatalogQuery = useQuery(
    api.shipyard.getShipCatalog,
    isAuthenticated ? {} : "skip",
  );
  const shipyardState = useQuery(
    api.shipyard.getShipyardState,
    isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
  );
  const syncColony = useMutation(api.colonyQueue.syncColony);
  const enqueueShipBuild = useMutation(api.shipyard.enqueueShipBuild);
  const cancelShipBuildQueueItem = useMutation(api.shipyard.cancelShipBuildQueueItem);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [quantities, setQuantities] = useState<Partial<Record<ShipKey, number>>>(
    {},
  );
  const [quantityInputs, setQuantityInputs] = useState<
    Partial<Record<ShipKey, string>>
  >({});
  const [queueingShipKey, setQueueingShipKey] = useState<ShipKey | null>(null);
  const [cancelingQueueItemId, setCancelingQueueItemId] = useState<
    Id<"colonyQueueItems"> | null
  >(null);
  const isSyncingRef = useRef(false);
  const view = useMemo(() => {
    if (!shipCatalogQuery || !shipyardState) {
      return undefined;
    }
    const stateByShipKey = new Map(
      shipyardState.shipStates.map((state) => [state.key, state]),
    );
    const ships = shipCatalogQuery.ships.map((ship) => {
      const state = stateByShipKey.get(ship.key);
      return {
        ...ship,
        owned: state?.owned ?? 0,
        queued: state?.queued ?? 0,
        perUnitDurationSeconds: state?.perUnitDurationSeconds ?? 0,
        canBuild: state?.canBuild ?? false,
      };
    });
    return {
      ...shipyardState,
      ships,
    };
  }, [shipCatalogQuery, shipyardState]);

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
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sync();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, sync]);

  const shipsByKey = useMemo(
    () => new Map((view?.ships ?? []).map((ship) => [ship.key, ship])),
    [view?.ships],
  );

  const queueItems: QueueItem[] = useMemo(() => {
    const laneItems = [
      ...(view?.lane.activeItem ? [view.lane.activeItem] : []),
      ...(view?.lane.pendingItems ?? []),
    ];
    const items: QueueItem[] = [];
    for (const item of laneItems) {
      if (!isShipBuildQueueRow(item)) {
        continue;
      }

      const ship = shipsByKey.get(item.payload.shipKey);
      const remaining = Math.max(
        0,
        item.payload.quantity - item.payload.completedQuantity,
      );
      items.push({
        id: item.id,
        isActive: item.status === "active",
        remaining,
        shipName: ship?.name ?? item.payload.shipKey,
        timeLeftSeconds: Math.max(0, Math.ceil((item.completesAt - nowMs) / 1_000)),
        total: item.payload.quantity,
      });
    }
    return items;
  }, [nowMs, shipsByKey, view?.lane.activeItem, view?.lane.pendingItems]);

  if (isAuthLoading || (isAuthenticated && !view)) {
    return (
      <div className="mx-auto w-full max-w-[1260px] px-4 py-8 text-white/80">
        Loading shipyard...
      </div>
    );
  }

  if (!view) {
    return (
      <div className="mx-auto w-full max-w-[1260px] px-4 py-8 text-white/80">
        Unable to load shipyard. Please sign in again.
      </div>
    );
  }

  const shipCatalog = view.ships.map((ship) => ({
    cost: ship.cost,
    image: SHIP_PRESENTATION[ship.key].image,
    name: ship.name,
  }));
  const fleetTotal = view.ships.reduce((sum, ship) => sum + ship.owned, 0);

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4 pb-12 pt-6 text-white">
      <QueuePanel
        className="mt-1"
        fleetTotal={fleetTotal}
        items={queueItems}
        onCancel={(id) => {
          const queueItemId = id as Id<"colonyQueueItems">;
          setCancelingQueueItemId(queueItemId);
          cancelShipBuildQueueItem({
            colonyId: colonyIdAsId,
            queueItemId,
          })
            .then((result) => {
              const resourceLabel = `${result.refunded.alloy.toLocaleString()} alloy, ${result.refunded.crystal.toLocaleString()} crystal, ${result.refunded.fuel.toLocaleString()} fuel`;
              toast.success(
                `Cancelled ${result.cancelledRemainingQuantity.toLocaleString()} ship(s); refunded ${resourceLabel}.`,
              );
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to cancel ship build",
              );
            })
            .finally(() => {
              setCancelingQueueItemId(null);
            });
        }}
        shipCatalog={shipCatalog}
        title="Command Queue"
      />
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {view.ships.map((ship) => {
          const qty = quantities[ship.key] ?? 1;
          const qtyInput = quantityInputs[ship.key] ?? String(qty);
          const lockedByLevel = view.shipyardLevel < ship.requiredShipyardLevel;
          const warning = lockedByLevel
            ? `Requires Shipyard Level ${ship.requiredShipyardLevel} (current: ${view.shipyardLevel}).`
            : undefined;
          const isQueueing = queueingShipKey === ship.key;
          const image = SHIP_PRESENTATION[ship.key].image;
          const description = SHIP_PRESENTATION[ship.key].description;
          const canAffordSelectedQuantity =
            view.availableResources.alloy >= ship.cost.alloy * qty &&
            view.availableResources.crystal >= ship.cost.crystal * qty &&
            view.availableResources.fuel >= ship.cost.fuel * qty;

          return (
            <article
              className={`relative overflow-hidden rounded-2xl border ${
                ship.canBuild
                  ? "border-white/15 bg-[linear-gradient(160deg,rgba(10,16,29,0.95),rgba(4,8,14,0.99))]"
                  : "border-white/10 bg-[linear-gradient(160deg,rgba(43,47,56,0.55),rgba(20,22,27,0.72))] grayscale"
              } flex h-full flex-col p-3`}
              key={ship.key}
            >
              <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(76,185,255,0.15),transparent)]" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{ship.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-cyan-200/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                      Fleet {ship.owned.toLocaleString()}
                    </span>
                    {warning ? <LockWarningPopover message={warning} /> : null}
                  </div>
                </div>

                <div className="mt-2 flex h-44 items-center justify-center">
                  <img
                    alt={`${ship.name} render`}
                    className="h-40 w-40 object-contain"
                    src={image}
                  />
                </div>

                <div className="min-h-[108px]">
                  <p className="text-xs leading-relaxed text-white/75">{description}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/70">
                    <Clock3 className="size-3.5" />
                    Build {formatDuration(ship.perUnitDurationSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-white/70">
                    Cargo {ship.cargoCapacity.toLocaleString()} • Speed{" "}
                    {ship.speed.toLocaleString()}
                  </p>
                  {ship.queued > 0 ? (
                    <p className="mt-1 text-xs text-cyan-100/85">
                      Queued {ship.queued.toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto pt-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    Queue Quantity
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-white/20 bg-black/25">
                      <button
                        className="px-2 py-1 disabled:opacity-35"
                        disabled={!ship.canBuild || qty <= 1}
                        onClick={() => {
                          const nextValue = Math.max(1, qty - 1);
                          setQuantities((current) => ({
                            ...current,
                            [ship.key]: nextValue,
                          }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.key]: String(nextValue),
                          }));
                        }}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        className="w-14 bg-transparent px-1 text-center text-sm font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        max={10_000}
                        min={1}
                        onBlur={() => {
                          const raw = quantityInputs[ship.key];
                          const parsed = Number(raw);
                          const normalized =
                            raw && Number.isFinite(parsed)
                              ? Math.max(1, Math.min(10_000, parsed))
                              : qty;
                          setQuantities((current) => ({
                            ...current,
                            [ship.key]: normalized,
                          }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.key]: String(normalized),
                          }));
                        }}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (!/^\d*$/.test(raw)) {
                            return;
                          }
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.key]: raw,
                          }));
                          if (raw === "") {
                            return;
                          }
                          const parsed = Number(raw);
                          if (!Number.isFinite(parsed)) {
                            return;
                          }
                          const nextValue = Math.max(1, Math.min(10_000, parsed));
                          setQuantities((current) => ({
                            ...current,
                            [ship.key]: nextValue,
                          }));
                        }}
                        type="number"
                        value={qtyInput}
                      />
                      <button
                        className="px-2 py-1 disabled:opacity-35"
                        disabled={!ship.canBuild}
                        onClick={() => {
                          const nextValue = Math.min(10_000, qty + 1);
                          setQuantities((current) => ({
                            ...current,
                            [ship.key]: nextValue,
                          }));
                          setQuantityInputs((current) => ({
                            ...current,
                            [ship.key]: String(nextValue),
                          }));
                        }}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    className="mt-2 w-full rounded-xl border border-cyan-200/55 bg-cyan-300/20 px-3 py-3 text-cyan-100 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-100/80 hover:bg-cyan-300/30 hover:shadow-[0_0_28px_rgba(90,220,255,0.35)] disabled:transform-none disabled:border-white/15 disabled:bg-white/5 disabled:text-white/45 disabled:shadow-none"
                    disabled={!ship.canBuild || !canAffordSelectedQuantity || isQueueing}
                    onClick={() => {
                      setQueueingShipKey(ship.key);
                      enqueueShipBuild({
                        colonyId: colonyIdAsId,
                        quantity: qty,
                        shipKey: ship.key,
                      })
                        .then((result) => {
                          if (result.status === "active") {
                            toast.success(`${ship.name} build started`);
                          } else {
                            toast.success(`${ship.name} build queued`);
                          }
                        })
                        .catch((error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Failed to queue ship build",
                          );
                        })
                        .finally(() => {
                          setQueueingShipKey(null);
                        });
                    }}
                  >
                    <span className="block text-center text-[12px] font-semibold uppercase tracking-[0.12em]">
                      {isQueueing ? "Queueing..." : `Queue ${qty}`}
                    </span>
                    <span className="mt-1 flex flex-wrap justify-center gap-1.5">
                      <CostPill amount={ship.cost.alloy * qty} kind="alloy" label="Alloy" />
                      <CostPill
                        amount={ship.cost.crystal * qty}
                        kind="crystal"
                        label="Crystal"
                      />
                      <CostPill amount={ship.cost.fuel * qty} kind="fuel" label="Fuel" />
                    </span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
      {cancelingQueueItemId ? (
        <p className="mt-3 text-xs text-white/65">
          Updating queue item {cancelingQueueItemId}...
        </p>
      ) : null}
    </div>
  );
}
