import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	applyColonyIntent,
	projectColonyEconomy,
	selectBuildingCards,
	selectDefenseView,
	selectFacilityCards,
	selectHudResources,
	selectQueueLanes,
	selectShipyardView,
	type ColonySnapshot,
	type ColonyIntent,
} from "@nullvector/game-logic";
import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery } from "@/lib/convex-hooks";

function getMonotonicNow() {
	return typeof performance === "undefined" ? Date.now() : performance.now();
}

function deriveColonySessionStatus(snapshot: {
	openQueues: Array<{ status: "active" | "cancelled" | "completed" | "failed" | "queued" }>;
}): "Queued" | "Stable" | "Upgrading" {
	const hasActive = snapshot.openQueues.some((row) => row.status === "active");
	const hasQueued = snapshot.openQueues.some((row) => row.status === "queued");
	return hasActive ? "Upgrading" : hasQueued ? "Queued" : "Stable";
}

export function useColonySnapshot(colonyId: Id<"colonies"> | null) {
	return useQuery(api.colony.getColonySnapshot, colonyId ? { colonyId } : "skip");
}

export function useColonySessionSnapshot(colonyId: Id<"colonies"> | null) {
	return useQuery(api.colony.getColonySessionSnapshot, colonyId ? { colonyId } : "skip");
}

export function useColonyView(colonyId: Id<"colonies"> | null) {
	const snapshot = useColonySnapshot(colonyId);
	const [nowMs, setNowMs] = useState(() => snapshot?.serverNowMs ?? Date.now());

	useEffect(() => {
		if (!snapshot) {
			return;
		}
		const anchorServerNowMs = snapshot.serverNowMs;
		const anchorMonotonicNow = getMonotonicNow();
		setNowMs(anchorServerNowMs);
		const tick = window.setInterval(() => {
			setNowMs(anchorServerNowMs + Math.max(0, getMonotonicNow() - anchorMonotonicNow));
		}, 1_000);
		return () => {
			window.clearInterval(tick);
		};
	}, [snapshot]);

	return useMemo(() => {
		if (!snapshot) {
			return undefined;
		}
		const projected = projectColonyEconomy(snapshot, nowMs);
		return {
			buildingCards: selectBuildingCards(snapshot, nowMs),
			defenseState: selectDefenseView(snapshot, nowMs),
			facilities: selectFacilityCards(snapshot, nowMs),
			hudResources: selectHudResources(snapshot, nowMs),
			nowMs,
			projected,
			queueLanes: selectQueueLanes(snapshot, nowMs),
			shipyardState: selectShipyardView(snapshot, nowMs),
			snapshot,
		};
	}, [nowMs, snapshot]);
}

export function useColonySelectors(colonyId: Id<"colonies"> | null) {
	const view = useColonyView(colonyId);
	if (!view) {
		return undefined;
	}

	return {
		buildingCards: view.buildingCards,
		defenseState: view.defenseState,
		facilities: view.facilities,
		hudResources: view.hudResources,
		nowMs: view.nowMs,
		queueLanes: view.queueLanes,
		shipyardState: view.shipyardState,
		snapshot: view.snapshot,
	};
}

export function useOptimisticColonyMutation<TArgs extends { colonyId: Id<"colonies"> }>(args: {
	intentFromArgs: (args: TArgs, snapshotServerNowMs: number) => ColonyIntent;
	mutation: FunctionReference<"mutation", "public", TArgs>;
}) {
	return useMutation(args.mutation).withOptimisticUpdate((localStore, mutationArgs) => {
		const snapshot = localStore.getQuery(api.colony.getColonySnapshot, {
			colonyId: mutationArgs.colonyId,
		});
		if (!snapshot) {
			return;
		}
		const optimisticNowMs = Date.now();
		const optimisticSnapshot: ColonySnapshot = {
			...snapshot,
			serverNowMs: optimisticNowMs,
		};
		const nextSnapshot = applyColonyIntent(
			optimisticSnapshot,
			args.intentFromArgs(mutationArgs, optimisticNowMs),
			optimisticNowMs,
		);
		localStore.setQuery(
			api.colony.getColonySnapshot,
			{ colonyId: mutationArgs.colonyId },
			nextSnapshot as typeof snapshot,
		);
		const sessionSnapshot = localStore.getQuery(api.colony.getColonySessionSnapshot, {
			colonyId: mutationArgs.colonyId,
		});
		if (!sessionSnapshot) {
			return;
		}
		localStore.setQuery(
			api.colony.getColonySessionSnapshot,
			{ colonyId: mutationArgs.colonyId },
			{
				...sessionSnapshot,
				colonies: sessionSnapshot.colonies.map((colony) =>
					colony.id === mutationArgs.colonyId
						? {
								...colony,
								name: nextSnapshot.name,
								status: deriveColonySessionStatus(nextSnapshot),
							}
						: colony,
				),
				title:
					sessionSnapshot.activeColonyId === mutationArgs.colonyId
						? `${nextSnapshot.name} Resources`
						: sessionSnapshot.title,
			},
		);
	});
}
