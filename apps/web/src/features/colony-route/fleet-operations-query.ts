import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useEffect, useMemo, useRef } from "react";

import { useMutation, useQuery } from "@/lib/convex-hooks";

const SELF_HEAL_RETRY_MS = 15_000;

function minDefined(values: Array<number | undefined>) {
	const defined = values.filter((value): value is number => typeof value === "number");
	return defined.length > 0 ? Math.min(...defined) : undefined;
}

export function useSelfHealingFleetOperations(args: {
	colonyId: Id<"colonies">;
	isAuthenticated: boolean;
}) {
	const originOperations = useQuery(
		api.fleetV2.getFleetOperationsForOriginColony,
		args.isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const targetOperations = useQuery(
		api.fleetV2.getFleetOperationsForTargetColony,
		args.isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const health = useQuery(
		api.fleetV2.getFleetOwnedOperationsHealth,
		args.isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const syncFleetState = useMutation(api.fleetV2.syncFleetState);
	const lastAttemptKeyRef = useRef<string | null>(null);
	const lastAttemptAtRef = useRef(0);
	const inFlightRef = useRef(false);

	const operations = useMemo(() => {
		if (!originOperations || !targetOperations || !health) {
			return undefined;
		}

		const unique = [
			...[
				...originOperations.active.map((operation) => ({
					...operation,
					relation: "outgoing" as const,
				})),
				...targetOperations.active,
			].reduce((operationsById, operation) => {
				const existing = operationsById.get(operation.id);
				if (!existing) {
					operationsById.set(operation.id, operation);
					return operationsById;
				}
				operationsById.set(operation.id, {
					...existing,
					...operation,
					relation:
						existing.relation === "outgoing" || operation.relation === "outgoing"
							? "outgoing"
							: "incoming",
				});
				return operationsById;
			}, new Map()),
		]
			.map(([, operation]) => operation)
			.sort((left, right) => left.nextEventAt - right.nextEventAt);

		return {
			active: unique,
			hasStaleOwnedOperations: health.hasStaleOwnedOperations,
			nextEventAt:
				unique[0]?.nextEventAt ??
				minDefined([originOperations.nextEventAt, targetOperations.nextEventAt]),
			serverNowMs: health.serverNowMs,
		};
	}, [health, originOperations, targetOperations]);

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
