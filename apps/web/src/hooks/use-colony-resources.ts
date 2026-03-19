import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { useMemo } from "react";

import { useColonyView } from "@/features/colony-state/hooks";

export function useColonyResources(colonyId: Id<"colonies"> | null) {
	const view = useColonyView(colonyId);
	const projected = useMemo(() => {
		if (!view?.projected) {
			return null;
		}

		return {
			energyConsumed: view.projected.energyConsumed,
			energyProduced: view.projected.energyProduced,
			energyRatio: view.projected.energyRatio,
			overflow: view.projected.overflow,
			ratesPerMinute: view.projected.ratesPerMinute,
			storageCaps: view.projected.storageCaps,
			stored: view.projected.resources,
		};
	}, [view?.projected]);

	return {
		hudResources: view?.hudResources,
		isLoading: colonyId !== null && view === undefined,
		lastAccruedAt: view?.snapshot.lastAccruedAt,
		nowMs: view?.nowMs ?? Date.now(),
		planetMultipliers: view?.snapshot.planetMultipliers,
		projected,
		snapshot: view?.snapshot,
	};
}
