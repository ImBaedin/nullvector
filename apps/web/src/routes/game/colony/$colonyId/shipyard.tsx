import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { selectShipCatalog, type ShipKey } from "@nullvector/game-logic";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ShipyardRouteSkeleton } from "@/features/colony-route/loading-skeletons";
import {
	ShipyardScreen,
	type QueueItem,
	type ShipyardDisplayShip,
} from "@/features/colony-route/shipyard-screen";
import { useColonyView, useOptimisticColonyMutation } from "@/features/colony-state/hooks";
import { useBoundedQuantityInput } from "@/features/colony-ui/hooks/use-bounded-quantity-input";
import { useColonyDevConsole } from "@/features/colony-ui/hooks/use-colony-dev-console";
import { useInlineNumberEditor } from "@/features/colony-ui/hooks/use-inline-number-editor";
import {
	getQueueBuildResourceLabel,
	isShipBuildQueueRow,
	type ShipBuildQueueRow,
} from "@/features/colony-ui/queue-items";
import { getQueueProgress } from "@/features/colony-ui/queue-state";
import { useConvexAuth } from "@/lib/convex-hooks";

export const Route = createFileRoute("/game/colony/$colonyId/shipyard")({
	component: ShipyardRoute,
});

function ShipyardRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const shipCatalog = useMemo(() => selectShipCatalog(), []);
	const colonyView = useColonyView(isAuthenticated ? colonyIdAsId : null);
	const devConsole = useColonyDevConsole(isAuthenticated ? colonyIdAsId : null);
	const enqueueShipBuild = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; quantity: number; shipKey: ShipKey }) => ({
			quantity: args.quantity,
			shipKey: args.shipKey,
			type: "enqueueShipBuild",
		}),
		mutation: api.shipyard.enqueueShipBuild,
	});
	const cancelShipBuildQueueItem = useOptimisticColonyMutation({
		intentFromArgs: (args: { colonyId: Id<"colonies">; queueItemId: Id<"colonyQueueItems"> }) => ({
			queueItemId: args.queueItemId,
			type: "cancelShipBuild",
		}),
		mutation: api.shipyard.cancelShipBuildQueueItem,
	});

	const [queueingShipKey, setQueueingShipKey] = useState<ShipKey | null>(null);
	const [cancelingQueueItemId, setCancelingQueueItemId] = useState<Id<"colonyQueueItems"> | null>(
		null,
	);
	const [isCompletingQueueItem, setIsCompletingQueueItem] = useState(false);
	const quantityInput = useBoundedQuantityInput<ShipKey>();
	const shipEditor = useInlineNumberEditor<ShipKey>();

	const canShowDevUi = devConsole.canShowDevUi;
	const canUseDevConsole = devConsole.canUseDevConsole;
	const view = useMemo(() => {
		if (!colonyView) {
			return undefined;
		}

		const stateByShipKey = new Map(
			colonyView.shipyardState.shipStates.map((state) => [state.key, state]),
		);
		const ships = shipCatalog.map((ship) => {
			const state = stateByShipKey.get(ship.key);
			return {
				...ship,
				owned: state?.owned ?? 0,
				perUnitDurationSeconds: state?.perUnitDurationSeconds ?? 0,
				queued: state?.queued ?? 0,
			};
		});

		return {
			...colonyView.shipyardState,
			ships,
		};
	}, [colonyView, shipCatalog]);

	const nowMs = colonyView?.nowMs ?? Date.now();

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
				shipKey: item.payload.shipKey,
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
	const activeUpgradeProgress = activeRawItem
		? getQueueProgress(nowMs, activeRawItem.startsAt, activeRawItem.completesAt).percent
		: 0;

	function handleDecrementQuantity(shipKey: ShipKey, currentQuantity: number) {
		quantityInput.decrement(shipKey, currentQuantity);
	}

	function handleIncrementQuantity(shipKey: ShipKey, currentQuantity: number) {
		quantityInput.increment(shipKey, currentQuantity);
	}

	function handleQuantityInputChange(shipKey: ShipKey, raw: string) {
		quantityInput.updateInput(shipKey, raw);
	}

	function handleQuantityBlur(shipKey: ShipKey, currentQuantity: number) {
		quantityInput.commitInput(shipKey, currentQuantity);
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
				const resourceLabel = getQueueBuildResourceLabel(result.refunded);
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

	const commitShipCount = useCallback(
		async (shipKey: ShipKey) => {
			if (!canShowDevUi || !canUseDevConsole) {
				return;
			}

			await devConsole.actions
				.setShipCounts({
					[shipKey]: Math.max(0, Math.floor(Number(shipEditor.draftValue) || 0)),
				})
				.then(() => {
					toast.success("Ship count updated");
					shipEditor.cancelEditing();
				})
				.catch((error) => {
					toast.error(error instanceof Error ? error.message : "Failed to update ship count");
				});
		},
		[canShowDevUi, canUseDevConsole, devConsole.actions, shipEditor],
	);

	async function handleCompleteActiveQueue() {
		if (!canShowDevUi || !canUseDevConsole || isCompletingQueueItem) {
			return;
		}

		setIsCompletingQueueItem(true);
		await devConsole.actions
			.completeQueue("shipyard")
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

	if (isAuthLoading || (isAuthenticated && !view)) {
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
			availableResources={colonyView!.projected.resources}
			canShowDevUi={canShowDevUi}
			canUseDevConsole={canUseDevConsole}
			cancelingQueueItemId={cancelingQueueItemId}
			editingShipKey={shipEditor.editingKey}
			isCompletingQueueItem={isCompletingQueueItem}
			onCancelQueueItem={handleCancel}
			onCompleteActiveQueueItem={() => {
				void handleCompleteActiveQueue();
			}}
			onDecrementQuantity={handleDecrementQuantity}
			onIncrementQuantity={handleIncrementQuantity}
			onQuantityBlur={handleQuantityBlur}
			onQuantityInputChange={handleQuantityInputChange}
			onEditShip={(shipKey, currentCount) => {
				shipEditor.startEditing(shipKey, currentCount);
			}}
			onQueueShip={handleQueueShip}
			onShipDraftCancel={shipEditor.cancelEditing}
			onShipDraftChange={shipEditor.setDraftValue}
			onShipDraftCommit={(shipKey) => {
				void commitShipCount(shipKey);
			}}
			pendingQueueItems={pendingQueueItems}
			quantities={quantityInput.values}
			quantityInputs={quantityInput.inputs}
			queueingShipKey={queueingShipKey}
			savingShipKey={shipEditor.savingKey}
			shipDraftValue={shipEditor.draftValue}
			view={view}
		/>
	);
}
