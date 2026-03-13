import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	applyColonyIntent,
	selectBuildingCards,
	selectDefenseView,
	selectFacilityCards,
	selectHudResources,
	selectQueueLanes,
	selectShipyardView,
	type ColonyIntent,
} from "@nullvector/game-logic";
import { useEffect, useMemo, useState } from "react";

import { useMutation, useQuery } from "@/lib/convex-hooks";

export function useColonySnapshot(colonyId: Id<"colonies"> | null) {
	return useQuery(api.colony.getColonySnapshot, colonyId ? { colonyId } : "skip");
}

export function useColonySessionSnapshot(colonyId: Id<"colonies"> | null) {
	return useQuery(api.colony.getColonySessionSnapshot, colonyId ? { colonyId } : "skip");
}

export function useColonySelectors(colonyId: Id<"colonies"> | null) {
	const snapshot = useColonySnapshot(colonyId);
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		if (!colonyId) {
			return;
		}
		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);
		return () => {
			window.clearInterval(tick);
		};
	}, [colonyId]);

	return useMemo(() => {
		if (!snapshot) {
			return undefined;
		}
		return {
			buildingCards: selectBuildingCards(snapshot, nowMs),
			defenseState: selectDefenseView(snapshot, nowMs),
			facilities: selectFacilityCards(snapshot, nowMs),
			hudResources: selectHudResources(snapshot, nowMs),
			nowMs,
			queueLanes: selectQueueLanes(snapshot, nowMs),
			shipyardState: selectShipyardView(snapshot, nowMs),
			snapshot,
		};
	}, [nowMs, snapshot]);
}

export function useOptimisticColonyMutation<TArgs extends { colonyId: Id<"colonies"> }>(args: {
	intentFromArgs: (args: TArgs, snapshotServerNowMs: number) => ColonyIntent;
	mutation: FunctionReference<"mutation">;
}) {
	return useMutation(args.mutation).withOptimisticUpdate((localStore, mutationArgs) => {
		const localArgs = mutationArgs as TArgs;
		const snapshot = localStore.getQuery(api.colony.getColonySnapshot, {
			colonyId: localArgs.colonyId,
		});
		if (!snapshot) {
			return;
		}
		const nextSnapshot = applyColonyIntent(
			snapshot as never,
			args.intentFromArgs(localArgs, snapshot.serverNowMs),
			snapshot.serverNowMs,
		);
		localStore.setQuery(
			api.colony.getColonySnapshot,
			{ colonyId: localArgs.colonyId },
			nextSnapshot as typeof snapshot,
		);
	});
}
