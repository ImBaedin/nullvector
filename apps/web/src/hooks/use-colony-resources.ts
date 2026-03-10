import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useEffect, useMemo, useState } from "react";

import {
	applySimulatedResourcesToHud,
	simulateColonyResources,
} from "@/lib/colony-resource-simulation";
import { useQuery } from "@/lib/convex-hooks";

export function useColonyResources(colonyId: Id<"colonies"> | null) {
	const snapshot = useQuery(
		api.resources.getColonyResourceSnapshot,
		colonyId ? { colonyId } : "skip",
	);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [clientReceivedAtMs, setClientReceivedAtMs] = useState<number | null>(null);

	useEffect(() => {
		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);

		return () => {
			window.clearInterval(tick);
		};
	}, []);

	useEffect(() => {
		if (!snapshot) {
			setClientReceivedAtMs(null);
			return;
		}

		setClientReceivedAtMs(Date.now());
	}, [snapshot]);

	const projected = useMemo(() => {
		if (!snapshot) {
			return null;
		}

		const simulatedNowMs =
			clientReceivedAtMs === null
				? snapshot.serverNowMs
				: snapshot.serverNowMs + Math.max(0, nowMs - clientReceivedAtMs);
		const simulated = simulateColonyResources({
			lastAccruedAt: snapshot.colony.lastAccruedAt,
			nowMs: simulatedNowMs,
			overflow: snapshot.resources.overflow,
			ratesPerMinute: snapshot.resources.ratesPerMinute,
			storageCaps: snapshot.resources.storageCaps,
			stored: snapshot.resources.stored,
		});

		return {
			energyConsumed: snapshot.resources.energyConsumed,
			energyProduced: snapshot.resources.energyProduced,
			energyRatio: snapshot.resources.energyRatio,
			overflow: simulated.overflow,
			ratesPerMinute: snapshot.resources.ratesPerMinute,
			storageCaps: snapshot.resources.storageCaps,
			stored: simulated.stored,
		};
	}, [clientReceivedAtMs, nowMs, snapshot]);

	const hudResources = useMemo(() => {
		if (!snapshot || !projected) {
			return snapshot?.hudResources;
		}

		return applySimulatedResourcesToHud({
			resources: snapshot.hudResources,
			simulated: {
				overflow: projected.overflow,
				stored: projected.stored,
			},
		});
	}, [projected, snapshot]);

	return {
		hudResources,
		isLoading: colonyId !== null && snapshot === undefined,
		lastAccruedAt: snapshot?.colony.lastAccruedAt,
		nowMs,
		planetMultipliers: snapshot?.planetMultipliers,
		projected,
		snapshot,
	};
}
