import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useEffect, useRef } from "react";

import { useMutation, useQuery } from "@/lib/convex-hooks";

const SELF_HEAL_RETRY_MS = 15_000;

export function useSelfHealingFleetOperations(args: {
	colonyId: Id<"colonies">;
	isAuthenticated: boolean;
}) {
	const operations = useQuery(
		api.fleetV2.getFleetOperationsForColony,
		args.isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const syncFleetState = useMutation(api.fleetV2.syncFleetState);
	const lastAttemptKeyRef = useRef<string | null>(null);
	const lastAttemptAtRef = useRef(0);
	const inFlightRef = useRef(false);

	useEffect(() => {
		if (!args.isAuthenticated || !operations?.hasStaleOwnedOperations) {
			return;
		}

		const signature = `${args.colonyId}:${operations.serverNowMs}:${operations.active.length}`;
		const now = Date.now();
		if (inFlightRef.current) {
			return;
		}
		if (
			lastAttemptKeyRef.current === signature &&
			now - lastAttemptAtRef.current < SELF_HEAL_RETRY_MS
		) {
			return;
		}

		lastAttemptKeyRef.current = signature;
		lastAttemptAtRef.current = now;
		inFlightRef.current = true;
		void syncFleetState({ colonyId: args.colonyId }).finally(() => {
			inFlightRef.current = false;
		});
	}, [args.colonyId, args.isAuthenticated, operations, syncFleetState]);

	return operations;
}
