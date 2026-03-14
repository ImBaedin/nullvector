import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { projectColonyEconomy, selectHudResources } from "@nullvector/game-logic";
import { useEffect, useMemo, useState } from "react";

import { useColonySnapshot } from "@/features/colony-state/hooks";

export function useColonyResources(colonyId: Id<"colonies"> | null) {
	const snapshot = useColonySnapshot(colonyId);
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);

		return () => {
			window.clearInterval(tick);
		};
	}, []);

	const projected = useMemo(() => {
		if (!snapshot) {
			return null;
		}
		const projectedState = projectColonyEconomy(snapshot, nowMs);
		return {
			energyConsumed: projectedState.energyConsumed,
			energyProduced: projectedState.energyProduced,
			energyRatio: projectedState.energyRatio,
			overflow: projectedState.overflow,
			ratesPerMinute: projectedState.ratesPerMinute,
			storageCaps: projectedState.storageCaps,
			stored: projectedState.resources,
		};
	}, [nowMs, snapshot]);

	const hudResources = useMemo(() => {
		if (!snapshot || !projected) {
			return snapshot ? selectHudResources(snapshot, nowMs) : undefined;
		}
		return selectHudResources(snapshot, nowMs);
	}, [nowMs, projected, snapshot]);

	return {
		hudResources,
		isLoading: colonyId !== null && snapshot === undefined,
		lastAccruedAt: snapshot?.lastAccruedAt,
		nowMs,
		planetMultipliers: snapshot?.planetMultipliers,
		projected,
		snapshot,
	};
}
