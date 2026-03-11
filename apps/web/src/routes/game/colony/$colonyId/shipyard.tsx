import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { ShipyardRouteSkeleton } from "./loading-skeletons";
import { type QueueItem } from "./shipyard-mock-shared";
import { ShipyardScreen, type ShipyardDisplayShip } from "./shipyard-screen";

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
	const colonyResources = useColonyResources(isAuthenticated ? colonyIdAsId : null);
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
				perUnitDurationSeconds: state?.perUnitDurationSeconds ?? 0,
				queued: state?.queued ?? 0,
			};
		});

		return {
			...shipyardState,
			ships,
		};
	}, [shipCatalogQuery, shipyardState]);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);
		return () => {
			window.clearInterval(tick);
		};
	}, [isAuthenticated]);

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
			items.push({
				id: item.id,
				isActive: item.status === "active",
				remaining: Math.max(0, item.payload.quantity - item.payload.completedQuantity),
				shipName: ship?.name ?? item.payload.shipKey,
				timeLeftSeconds: Math.max(0, Math.ceil((item.completesAt - nowMs) / 1_000)),
				total: item.payload.quantity,
			});
		}

		return items;
	}, [nowMs, shipsByKey, view]);

	const activeQueueItem = queueItems.find((item) => item.isActive) ?? null;
	const pendingQueueItems = queueItems.filter((item) => !item.isActive);

	const activeRawItem =
		view?.lane.activeItem && isShipBuildQueueRow(view.lane.activeItem)
			? view.lane.activeItem
			: null;
	const activeItemStartsAt = activeRawItem?.startsAt;
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

	function updateQuantity(shipKey: ShipKey, value: number) {
		setQuantities((current) => ({ ...current, [shipKey]: value }));
		setQuantityInputs((current) => ({ ...current, [shipKey]: String(value) }));
	}

	function handleDecrementQuantity(shipKey: ShipKey, currentQuantity: number) {
		updateQuantity(shipKey, Math.max(1, currentQuantity - 1));
	}

	function handleIncrementQuantity(shipKey: ShipKey, currentQuantity: number) {
		updateQuantity(shipKey, Math.min(10_000, currentQuantity + 1));
	}

	function handleQuantityInputChange(shipKey: ShipKey, raw: string) {
		if (!/^\d*$/.test(raw)) {
			return;
		}

		setQuantityInputs((current) => ({ ...current, [shipKey]: raw }));
		if (raw === "") {
			return;
		}

		const parsed = Number(raw);
		if (!Number.isFinite(parsed)) {
			return;
		}

		setQuantities((current) => ({
			...current,
			[shipKey]: Math.max(1, Math.min(10_000, parsed)),
		}));
	}

	function handleQuantityBlur(shipKey: ShipKey, currentQuantity: number) {
		const raw = quantityInputs[shipKey];
		const parsed = Number(raw);
		const normalized =
			raw && Number.isFinite(parsed) ? Math.max(1, Math.min(10_000, parsed)) : currentQuantity;
		updateQuantity(shipKey, normalized);
	}

	function handleQueueShip(ship: ShipyardDisplayShip, quantity: number) {
		setQueueingShipKey(ship.key);
		enqueueShipBuild({
			colonyId: colonyIdAsId,
			quantity,
			shipKey: ship.key,
		})
			.then((result) => {
				toast.success(
					result.status === "active" ? `${ship.name} build started` : `${ship.name} build queued`,
				);
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to queue ship build");
			})
			.finally(() => {
				setQueueingShipKey(null);
			});
	}

	function handleCancel(id: string) {
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
	}

	async function handleCompleteActiveQueue() {
		if (!canShowDevUi || !devConsoleState?.canUseDevConsole || isCompletingQueueItem) {
			return;
		}

		setIsCompletingQueueItem(true);
		await completeActiveQueueItem({
			colonyId: colonyIdAsId,
			lane: "shipyard",
		})
			.then(() => {
				toast.success("Active ship build completed");
			})
			.catch((error) => {
				toast.error(error instanceof Error ? error.message : "Failed to complete ship build");
			})
			.finally(() => {
				setIsCompletingQueueItem(false);
			});
	}

	if (
		isAuthLoading ||
		(isAuthenticated && (!view || colonyResources.isLoading || !colonyResources.projected))
	) {
		return <ShipyardRouteSkeleton />;
	}

	if (!view) {
		return (
			<div className="mx-auto w-full max-w-[1440px] px-4 py-8 text-white/80">
				Unable to load shipyard. Please sign in again.
			</div>
		);
	}

	return (
		<ShipyardScreen
			activeQueueItem={activeQueueItem}
			activeUpgradeProgress={activeUpgradeProgress}
			availableResources={colonyResources.projected!.stored}
			canShowDevUi={canShowDevUi}
			cancelingQueueItemId={cancelingQueueItemId}
			isCompletingQueueItem={isCompletingQueueItem}
			onCancelQueueItem={handleCancel}
			onCompleteActiveQueueItem={() => {
				void handleCompleteActiveQueue();
			}}
			onDecrementQuantity={handleDecrementQuantity}
			onIncrementQuantity={handleIncrementQuantity}
			onQuantityBlur={handleQuantityBlur}
			onQuantityInputChange={handleQuantityInputChange}
			onQueueShip={handleQueueShip}
			pendingQueueItems={pendingQueueItems}
			quantities={quantities}
			quantityInputs={quantityInputs}
			queueingShipKey={queueingShipKey}
			view={view}
		/>
	);
}
