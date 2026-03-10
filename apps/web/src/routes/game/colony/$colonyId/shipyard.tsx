import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Anchor, Clock3, Layers3, Minus, Package, Plus, Ship, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useGameTimedSync } from "@/hooks/use-game-timed-sync";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import {
	CostPill,
	formatDuration,
	LockWarningPopover,
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
		description: "Short-haul freighter for balancing alloy and crystal across nearby colonies.",
		image: "/game-icons/ships/small-cargo.png",
	},
	largeCargo: {
		description: "Bulk logistics hull with expanded cargo pods and reinforced engines.",
		image: "/game-icons/ships/large-cargo.png",
	},
	colonyShip: {
		description: "Ark-class expansion vessel carrying habitat modules and colony command systems.",
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
	startsAt?: number;
	status: "active" | "queued" | "completed" | "cancelled" | "failed";
};

function isShipBuildQueueRow(item: { kind: string; payload: unknown }): item is ShipBuildQueueRow {
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

	const shipCatalogQuery = useQuery(api.shipyard.getShipCatalog, isAuthenticated ? {} : "skip");
	const shipyardState = useQuery(
		api.shipyard.getShipyardState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const devConsoleState = useQuery(
		api.devConsole.getDevConsoleState,
		isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const syncColony = useMutation(api.colonyQueue.syncColony);
	const enqueueShipBuild = useMutation(api.shipyard.enqueueShipBuild);
	const cancelShipBuildQueueItem = useMutation(api.shipyard.cancelShipBuildQueueItem);
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);

	const [nowMs, setNowMs] = useState(() => Date.now());
	const [quantities, setQuantities] = useState<Partial<Record<ShipKey, number>>>({});
	const [quantityInputs, setQuantityInputs] = useState<Partial<Record<ShipKey, string>>>({});
	const [queueingShipKey, setQueueingShipKey] = useState<ShipKey | null>(null);
	const [cancelingQueueItemId, setCancelingQueueItemId] = useState<Id<"colonyQueueItems"> | null>(
		null,
	);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const isSyncingRef = useRef(false);
	const canShowDevUi = devConsoleState?.showDevConsoleUi === true;
	const view = useMemo(() => {
		if (!shipCatalogQuery || !shipyardState) {
			return undefined;
		}
		const stateByShipKey = new Map(shipyardState.shipStates.map((state) => [state.key, state]));
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

	useGameTimedSync({
		enabled: isAuthenticated,
		events: [
			{
				id: "colony-next-event",
				atMs: view?.nextEventAt ?? null,
			},
		],
		onDue: () => sync(),
		scopeId: `colony:${colonyId}:shipyard`,
	});

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
			const remaining = Math.max(0, item.payload.quantity - item.payload.completedQuantity);
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

	const activeQueueItem = queueItems.find((item) => item.isActive) ?? null;
	const pendingQueueItems = queueItems.filter((item) => !item.isActive);

	const activeRawItem =
		view?.lane.activeItem && isShipBuildQueueRow(view.lane.activeItem)
			? view.lane.activeItem
			: null;
	const activeItemStartsAt = (activeRawItem as Record<string, unknown> | null)?.startsAt as
		| number
		| undefined;
	const activeItemDurationMs =
		activeRawItem && activeItemStartsAt ? activeRawItem.completesAt - activeItemStartsAt : 0;
	const activeUpgradeProgress =
		activeRawItem && activeItemDurationMs > 0
			? Math.min(
					100,
					Math.max(
						0,
						((nowMs - (activeRawItem.completesAt - activeItemDurationMs)) / activeItemDurationMs) *
							100,
					),
				)
			: 0;

	const handleCancel = (id: string) => {
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
				toast.error(error instanceof Error ? error.message : "Failed to cancel ship build");
			})
			.finally(() => {
				setCancelingQueueItemId(null);
			});
	};

	const handleCompleteActiveQueue = async () => {
		if (!canShowDevUi || !devConsoleState?.canUseDevConsole || isCompletingQueueItem) {
			return;
		}
		setIsCompletingQueueItem(true);
		try {
			await completeActiveQueueItem({
				colonyId: colonyIdAsId,
				lane: "shipyard",
			});
			toast.success("Active ship build completed");
			await sync();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete ship build");
		} finally {
			setIsCompletingQueueItem(false);
		}
	};

	if (isAuthLoading || (isAuthenticated && !view)) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Loading shipyard...
			</div>
		);
	}

	if (!view) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load shipyard. Please sign in again.
			</div>
		);
	}

	const fleetTotal = view.ships.reduce((sum, ship) => sum + ship.owned, 0);
	const totalQueued = view.ships.reduce((sum, ship) => sum + ship.queued, 0);

	return (
		<div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-12 text-white">
			<div
				className="
     grid gap-5
     lg:grid-cols-[minmax(0,1fr)_450px]
   "
			>
				{/* ══ Left Column: Shipyard Summary + Ship Catalog ══ */}
				<div className="space-y-5">
					{/* Shipyard Summary Strip */}
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
								<Anchor className="size-4 text-cyan-300" />
							</div>
							<div>
								<h1
									className="
          font-(family-name:--nv-font-display) text-lg font-bold
        "
								>
									Shipyard
								</h1>
								<p className="text-[10px] text-white/40">
									Level {view.shipyardLevel} • {fleetTotal} ships
									{totalQueued > 0 ? ` • ${totalQueued} in queue` : ""}
									{activeQueueItem ? " • 1 building" : ""}
								</p>
							</div>
						</div>

						<div className="mt-4 flex gap-3 overflow-x-auto pb-1">
							{view.ships.map((ship) => {
								const image = SHIP_PRESENTATION[ship.key].image;
								return (
									<div
										className="
            flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border
            border-white/8 bg-white/2.5 p-3
          "
										key={ship.key}
									>
										<img
											alt={ship.name}
											className="
             size-12 rounded-lg border border-white/8 bg-black/30 object-contain
             p-1
           "
											src={image}
										/>
										<div className="min-w-0">
											<p className="text-sm font-semibold">{ship.name}</p>
											<div className="mt-0.5 flex gap-2 text-[10px]">
												<span className="text-emerald-300/70">{ship.owned} owned</span>
												{ship.queued > 0 ? (
													<>
														<span className="text-white/30">|</span>
														<span className="text-cyan-200/50">{ship.queued} queued</span>
													</>
												) : null}
											</div>
											<div
												className="
             mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8
           "
											>
												<div
													className="h-full rounded-full bg-cyan-400/40"
													style={{
														width: `${
															ship.owned + ship.queued > 0
																? Math.min(100, (ship.owned / (ship.owned + ship.queued)) * 100)
																: 100
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

					{/* Ship Catalog */}
					<section
						className="
        overflow-hidden rounded-2xl border border-l-4 border-white/10
        border-l-cyan-400/50
        bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,18,0.96))]
      "
						style={{
							animation: "nv-resource-card-in 400ms cubic-bezier(0.21,1,0.34,1) both",
						}}
					>
						<div
							className="
        flex flex-wrap items-center justify-between gap-2 px-4 py-3
        sm:px-5
      "
						>
							<div className="flex items-center gap-2.5">
								<span className="text-white/50">
									<Ship className="size-4" strokeWidth={2.2} />
								</span>
								<div>
									<h2
										className="
           font-(family-name:--nv-font-display) text-sm font-bold
         "
									>
										Ship Catalog
									</h2>
									<p className="mt-0.5 text-[10px] text-white/35">
										Commission new vessels from the orbital assembly line.
									</p>
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
									{view.ships.length} designs
								</span>
							</div>
						</div>

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
         xl:grid-cols-3
       "
							>
								{view.ships.map((ship, cardIndex) => {
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
											className={`
             group relative overflow-hidden rounded-xl border
             ${ship.canBuild ? "border-white/10" : `
              border-white/8 opacity-60 grayscale
            `}
             bg-[linear-gradient(160deg,rgba(10,16,28,0.9),rgba(6,10,16,0.95))]
             text-[13px]
           `}
											key={ship.key}
											style={{
												animation: "nv-resource-card-in 380ms cubic-bezier(0.21,1,0.34,1) both",
												animationDelay: `${120 + cardIndex * 60}ms`,
											}}
										>
											<div
												className="pointer-events-none absolute inset-x-0 top-0 h-px"
												style={{
													background:
														"linear-gradient(90deg, transparent, rgba(74,233,255,0.5), transparent)",
												}}
											/>
											<div
												className="
              pointer-events-none absolute -top-8 -right-8 size-32 rounded-full
              blur-3xl
            "
												style={{ background: "rgba(74,233,255,0.08)" }}
											/>

											<div className="relative z-10 p-4">
												{/* Header */}
												<div className="flex items-start justify-between gap-2">
													<div className="flex items-center gap-2.5">
														<img
															alt={ship.name}
															className="
                 size-8 rounded-lg border border-white/8 bg-black/30
                 object-contain p-1
               "
															src={image}
														/>
														<h3
															className="
                font-(family-name:--nv-font-display) text-sm font-bold
              "
														>
															{ship.name}
														</h3>
													</div>
													<div className="flex items-center gap-1.5">
														<span
															className="
                 inline-flex size-6 items-center justify-center rounded-md
                 border border-white/15 bg-black/25
                 font-(family-name:--nv-font-mono) text-[10px] font-bold
                 text-white/80
               "
															title={`${ship.owned} owned`}
														>
															{ship.owned}
														</span>
														{warning ? <LockWarningPopover message={warning} /> : null}
													</div>
												</div>

												{/* Status badge */}
												<p className={`
               mt-2 inline-flex items-center gap-1 rounded-md border px-1.5
               py-0.5 text-[9px] font-semibold whitespace-nowrap uppercase
               ${!ship.canBuild ? "border-amber-300/35 bg-amber-400/10 text-amber-200/80" : ship.queued > 0 ? "border-cyan-300/30 bg-cyan-400/8 text-cyan-200/80" : "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80"}
             `}>{!ship.canBuild ? "Locked" : ship.queued > 0 ? `${ship.queued.toLocaleString()} Queued` : "Available"}</p>

												{/* Ship render */}
												<div className="mt-3 flex items-center justify-center">
													<div
														className="
               relative size-28 rounded-full border border-white/6 bg-black/20
               p-2
             "
													>
														<img
															alt={`${ship.name} render`}
															className="size-full object-contain"
															src={image}
														/>
													</div>
												</div>

												{/* Description */}
												<p className="mt-3 text-[11px] leading-relaxed text-white/50">
													{description}
												</p>

												{/* Stats */}
												<div className="mt-2.5 grid grid-cols-3 gap-1.5">
													<div
														className="
               rounded-lg border border-white/6 bg-black/20 px-2 py-1.5
               text-center
             "
													>
														<p className="text-[7px] tracking-widest text-white/30 uppercase">
															Cargo
														</p>
														<p
															className="
                mt-0.5 font-(family-name:--nv-font-mono) text-[10px]
                font-bold text-white/80
              "
														>
															{ship.cargoCapacity.toLocaleString()}
														</p>
													</div>
													<div
														className="
               rounded-lg border border-white/6 bg-black/20 px-2 py-1.5
               text-center
             "
													>
														<p className="text-[7px] tracking-widest text-white/30 uppercase">
															Speed
														</p>
														<p
															className="
                mt-0.5 font-(family-name:--nv-font-mono) text-[10px]
                font-bold text-white/80
              "
														>
															{ship.speed.toLocaleString()}
														</p>
													</div>
													<div
														className="
               rounded-lg border border-white/6 bg-black/20 px-2 py-1.5
               text-center
             "
													>
														<p className="text-[7px] tracking-widest text-white/30 uppercase">
															Build
														</p>
														<p
															className="
                mt-0.5 font-(family-name:--nv-font-mono) text-[10px]
                font-bold text-white/80
              "
														>
															{formatDuration(ship.perUnitDurationSeconds)}
														</p>
													</div>
												</div>

												{/* Quantity selector + queue button */}
												<div className="mt-3 border-t border-white/6 pt-3">
													<p
														className="
               text-[10px] font-semibold tracking-[0.14em] text-white/45
               uppercase
             "
													>
														Queue Quantity
													</p>
													<div className="mt-1.5 flex items-center gap-2">
														<div
															className="
                flex items-center rounded-lg border border-white/12 bg-black/25
              "
														>
															<button
																className="
                  flex size-7 items-center justify-center text-white/60
                  disabled:opacity-25
                "
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
																<Minus className="size-3" />
															</button>
															<input
																className="
                  w-12 [appearance:textfield] bg-transparent px-0.5 text-center
                  font-(family-name:--nv-font-mono) text-xs font-bold
                  text-white outline-none
                  [&::-webkit-inner-spin-button]:appearance-none
                  [&::-webkit-outer-spin-button]:appearance-none
                "
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
																className="
                  flex size-7 items-center justify-center text-white/60
                  disabled:opacity-25
                "
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
																<Plus className="size-3" />
															</button>
														</div>
													</div>

													<button
														className="
                mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl
                border border-cyan-200/50 bg-linear-to-b from-cyan-400/25
                to-cyan-400/10 px-4 py-2.5
                font-(family-name:--nv-font-display) text-xs font-bold
                tracking-[0.08em] text-cyan-50 uppercase
                shadow-[0_0_20px_rgba(61,217,255,0.12)] transition-all
                hover:-translate-y-0.5 hover:border-cyan-100/70
                hover:shadow-[0_0_30px_rgba(61,217,255,0.25)]
                disabled:translate-y-0 disabled:border-white/10
                disabled:bg-white/5 disabled:text-white/30 disabled:shadow-none
              "
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
														<Zap className="size-3.5" />
														{isQueueing ? "Queueing..." : `Queue ${qty}`}
													</button>

													<div className="mt-2 flex flex-wrap justify-center gap-1.5">
														<CostPill amount={ship.cost.alloy * qty} kind="alloy" label="Alloy" />
														<CostPill
															amount={ship.cost.crystal * qty}
															kind="crystal"
															label="Crystal"
														/>
														<CostPill amount={ship.cost.fuel * qty} kind="fuel" label="Fuel" />
													</div>
												</div>
											</div>
										</article>
									);
								})}
							</div>
						</div>
					</section>
				</div>

				{/* ══ Right Column: Command Queue ══ */}
				<div className="lg:sticky lg:top-4 lg:self-start">
					<div
						className="
       rounded-2xl border border-white/12
       bg-[linear-gradient(170deg,rgba(12,20,36,0.95),rgba(6,10,18,0.98))]
     "
					>
						<div
							className="
        flex items-center gap-2.5 border-b border-white/8 px-5 py-3.5
      "
						>
							<Clock3 className="size-5 text-cyan-300" />
							<h2
								className="
         font-(family-name:--nv-font-display) text-sm font-bold
       "
							>
								Command Queue
							</h2>
							{queueItems.length > 0 ? (
								<span
									className="
          ml-auto font-(family-name:--nv-font-mono) text-[9px]
          text-white/30
        "
								>
									{queueItems.length} item{queueItems.length !== 1 ? "s" : ""}
								</span>
							) : null}
						</div>

						<div className="p-5">
							{/* Active Build */}
							{activeQueueItem ? (
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
										<div className="flex items-start justify-between gap-2">
											<div className="flex items-center gap-2.5">
												{(() => {
													const activeShip = view.ships.find(
														(s) => s.name === activeQueueItem.shipName,
													);
													const activeImage = activeShip
														? SHIP_PRESENTATION[activeShip.key]?.image
														: null;
													return activeImage ? (
														<img
															alt={activeQueueItem.shipName}
															className="
                 size-10 rounded-lg border border-white/8 bg-black/30
                 object-contain p-1
               "
															src={activeImage}
														/>
													) : null;
												})()}
												<div>
													<p className="text-xs font-semibold">{activeQueueItem.shipName}</p>
													<p
														className="
               mt-0.5 font-(family-name:--nv-font-mono) text-[10px]
               text-white/40
             "
													>
														{activeQueueItem.remaining.toLocaleString()} of{" "}
														{activeQueueItem.total.toLocaleString()} remaining
													</p>
												</div>
											</div>
											<div className="flex items-center gap-1.5">
												{canShowDevUi ? (
													<button
														className="
               rounded-md border border-cyan-300/20 bg-cyan-400/8 px-2 py-1
               text-[10px] font-medium text-cyan-100 transition-colors
               hover:border-cyan-200/35 hover:bg-cyan-400/12
               disabled:cursor-not-allowed disabled:opacity-50
             "
														disabled={isCompletingQueueItem || !devConsoleState?.canUseDevConsole}
														onClick={() => {
															void handleCompleteActiveQueue();
														}}
														type="button"
													>
														{isCompletingQueueItem ? "..." : "Complete"}
													</button>
												) : null}
												<button
													className="
              rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
              text-[10px] font-medium text-rose-200/80 transition-colors
              hover:border-rose-200/35 hover:bg-rose-400/12
            "
													disabled={cancelingQueueItemId === activeQueueItem.id}
													onClick={() => handleCancel(activeQueueItem.id)}
													type="button"
												>
													{cancelingQueueItemId === activeQueueItem.id ? (
														"..."
													) : (
														<X className="size-3" />
													)}
												</button>
											</div>
										</div>

										<div className="mt-2 flex items-center justify-between text-right">
											<div className="flex items-center gap-1.5">
												<Layers3 className="size-3 text-emerald-300/50" />
												<span
													className="
              font-(family-name:--nv-font-mono) text-[10px] text-white/40
            "
												>
													Batch {activeQueueItem.total.toLocaleString()}
												</span>
											</div>
											<div>
												<p
													className="
              font-(family-name:--nv-font-mono) text-xs font-bold
              text-emerald-200
            "
												>
													{formatDuration(activeQueueItem.timeLeftSeconds)}
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
													style={{
														animation: "nv-queue-pulse 2s ease-in-out infinite",
													}}
												/>
												Building
											</span>
										</div>
									</div>
								</div>
							) : null}

							{/* Pending Queue Items */}
							{pendingQueueItems.length > 0 ? (
								<div className={activeQueueItem ? "mt-4" : ""}>
									<p
										className="
           text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase
         "
									>
										Pending ({pendingQueueItems.length})
									</p>
									<div className="mt-2 space-y-1">
										{pendingQueueItems.map((item, i) => {
											const pendingShip = view.ships.find((s) => s.name === item.shipName);
											const pendingImage = pendingShip
												? SHIP_PRESENTATION[pendingShip.key]?.image
												: null;

											return (
												<div
													className="
               flex items-center justify-between rounded-lg border
               border-white/6 bg-white/2 px-3 py-2
             "
													key={item.id}
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
														{pendingImage ? (
															<img
																alt={item.shipName}
																className="
                  size-6 rounded-sm border border-white/8 bg-black/20
                  object-contain p-0.5
                "
																src={pendingImage}
															/>
														) : null}
														<div>
															<p className="text-[11px] font-semibold text-white/80">
																{item.shipName}
															</p>
															<p
																className="
                 font-(family-name:--nv-font-mono) text-[9px] text-white/30
               "
															>
																{item.total.toLocaleString()} ships •{" "}
																{formatDuration(item.timeLeftSeconds)}
															</p>
														</div>
													</div>
													<button
														className="
                rounded-md border border-rose-300/20 bg-rose-400/8 px-2 py-1
                text-[10px] font-medium text-rose-200/80 transition-colors
                hover:border-rose-200/35 hover:bg-rose-400/12
              "
														disabled={cancelingQueueItemId === item.id}
														onClick={() => handleCancel(item.id)}
													>
														{cancelingQueueItemId === item.id ? "..." : "Cancel"}
													</button>
												</div>
											);
										})}
									</div>
								</div>
							) : null}

							{/* Empty state */}
							{queueItems.length === 0 ? (
								<div className="flex flex-col items-center py-8 text-center">
									<div
										className="
           flex size-12 items-center justify-center rounded-full border
           border-white/8 bg-white/3
         "
									>
										<Package className="size-5 text-white/20" />
									</div>
									<p className="mt-3 text-xs font-medium text-white/30">No active builds</p>
									<p className="mt-1 text-[10px] text-white/18">
										Select a ship to begin construction
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
