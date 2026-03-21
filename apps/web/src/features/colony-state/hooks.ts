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

function buildColonySnapshot(args: {
	defenses:
		| {
				defenses: ColonySnapshot["defenses"];
		  }
		| undefined;
	economy:
		| {
				lastAccruedAt: number;
				overflow: ColonySnapshot["overflow"];
				planetMultipliers: ColonySnapshot["planetMultipliers"];
				resources: ColonySnapshot["resources"];
				serverNowMs: number;
				storageCaps: ColonySnapshot["storageCaps"];
		  }
		| undefined;
	identity:
		| {
				addressLabel: string;
				name: string;
		  }
		| undefined;
	infrastructure:
		| {
				buildings: ColonySnapshot["buildings"];
		  }
		| undefined;
	policy:
		| {
				policies: ColonySnapshot["policies"];
		  }
		| undefined;
	queueState:
		| {
				openQueues: ColonySnapshot["openQueues"];
				schedule: ColonySnapshot["schedule"];
				serverNowMs: number;
		  }
		| undefined;
	ships:
		| {
				ships: ColonySnapshot["ships"];
		  }
		| undefined;
	colonyId: Id<"colonies">;
}): ColonySnapshot | undefined {
	if (
		!args.identity ||
		!args.economy ||
		!args.infrastructure ||
		!args.policy ||
		!args.queueState ||
		!args.ships ||
		!args.defenses
	) {
		return undefined;
	}

	return {
		addressLabel: args.identity.addressLabel,
		buildings: args.infrastructure.buildings,
		colonyId: args.colonyId,
		defenses: args.defenses.defenses,
		lastAccruedAt: args.economy.lastAccruedAt,
		name: args.identity.name,
		openQueues: args.queueState.openQueues,
		overflow: args.economy.overflow,
		planetMultipliers: args.economy.planetMultipliers,
		policies: args.policy.policies,
		resources: args.economy.resources,
		schedule: args.queueState.schedule,
		serverNowMs: Math.max(args.economy.serverNowMs, args.queueState.serverNowMs),
		ships: args.ships.ships,
		storageCaps: args.economy.storageCaps,
	};
}

function buildColonySessionSnapshot(args: {
	colonyNav:
		| {
				activeColonyId: Id<"colonies">;
				colonies: Array<{
					addressLabel: string;
					id: Id<"colonies">;
					name: string;
				}>;
				title: string;
		  }
		| undefined;
	queueStatuses:
		| {
				statuses: Array<{
					colonyId: Id<"colonies">;
					status: "Queued" | "Stable" | "Upgrading";
				}>;
		  }
		| undefined;
}) {
	if (!args.colonyNav || !args.queueStatuses) {
		return undefined;
	}

	const statusByColonyId = new Map(
		args.queueStatuses.statuses.map((entry) => [entry.colonyId, entry.status]),
	);

	return {
		activeColonyId: args.colonyNav.activeColonyId,
		colonies: args.colonyNav.colonies.map((colony) => ({
			...colony,
			status: statusByColonyId.get(colony.id) ?? "Stable",
		})),
		title: args.colonyNav.title,
	};
}

function readSnapshotFromLocalStore(args: {
	colonyId: Id<"colonies">;
	localStore: {
		getQuery: (...queryArgs: any[]) => any;
	};
}) {
	return buildColonySnapshot({
		colonyId: args.colonyId,
		defenses: args.localStore.getQuery(api.colony.getColonyDefenses, {
			colonyId: args.colonyId,
		}),
		economy: args.localStore.getQuery(api.colony.getColonyEconomy, {
			colonyId: args.colonyId,
		}),
		identity: args.localStore.getQuery(api.colony.getColonyIdentity, {
			colonyId: args.colonyId,
		}),
		infrastructure: args.localStore.getQuery(api.colony.getColonyInfrastructure, {
			colonyId: args.colonyId,
		}),
		policy: args.localStore.getQuery(api.colony.getColonyPolicy, {
			colonyId: args.colonyId,
		}),
		queueState: args.localStore.getQuery(api.colony.getColonyQueueState, {
			colonyId: args.colonyId,
		}),
		ships: args.localStore.getQuery(api.colony.getColonyShips, {
			colonyId: args.colonyId,
		}),
	});
}

function writeSnapshotToLocalStore(args: {
	colonyId: Id<"colonies">;
	localStore: {
		setQuery: (...queryArgs: any[]) => void;
	};
	snapshot: ColonySnapshot;
}) {
	args.localStore.setQuery(
		api.colony.getColonyIdentity,
		{ colonyId: args.colonyId },
		{
			addressLabel: args.snapshot.addressLabel,
			colonyId: args.colonyId,
			name: args.snapshot.name,
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyEconomy,
		{ colonyId: args.colonyId },
		{
			colonyId: args.colonyId,
			lastAccruedAt: args.snapshot.lastAccruedAt,
			overflow: args.snapshot.overflow,
			planetMultipliers: args.snapshot.planetMultipliers,
			resources: args.snapshot.resources,
			serverNowMs: args.snapshot.serverNowMs,
			storageCaps: args.snapshot.storageCaps,
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyInfrastructure,
		{ colonyId: args.colonyId },
		{
			buildings: args.snapshot.buildings,
			colonyId: args.colonyId,
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyPolicy,
		{ colonyId: args.colonyId },
		{
			colonyId: args.colonyId,
			policies: args.snapshot.policies ?? {},
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyQueueState,
		{ colonyId: args.colonyId },
		{
			colonyId: args.colonyId,
			openQueues: args.snapshot.openQueues,
			schedule: args.snapshot.schedule,
			serverNowMs: args.snapshot.serverNowMs,
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyShips,
		{ colonyId: args.colonyId },
		{
			colonyId: args.colonyId,
			ships: args.snapshot.ships,
		},
	);
	args.localStore.setQuery(
		api.colony.getColonyDefenses,
		{ colonyId: args.colonyId },
		{
			colonyId: args.colonyId,
			defenses: args.snapshot.defenses,
		},
	);
}

export function useColonySnapshot(colonyId: Id<"colonies"> | null) {
	const identity = useQuery(api.colony.getColonyIdentity, colonyId ? { colonyId } : "skip");
	const economy = useQuery(api.colony.getColonyEconomy, colonyId ? { colonyId } : "skip");
	const infrastructure = useQuery(
		api.colony.getColonyInfrastructure,
		colonyId ? { colonyId } : "skip",
	);
	const policy = useQuery(api.colony.getColonyPolicy, colonyId ? { colonyId } : "skip");
	const queueState = useQuery(api.colony.getColonyQueueState, colonyId ? { colonyId } : "skip");
	const ships = useQuery(api.colony.getColonyShips, colonyId ? { colonyId } : "skip");
	const defenses = useQuery(api.colony.getColonyDefenses, colonyId ? { colonyId } : "skip");

	return useMemo(
		() =>
			colonyId
				? buildColonySnapshot({
						colonyId,
						defenses,
						economy,
						identity,
						infrastructure,
						policy,
						queueState,
						ships,
					})
				: undefined,
		[colonyId, defenses, economy, identity, infrastructure, policy, queueState, ships],
	);
}

export function useColonySessionSnapshot(colonyId: Id<"colonies"> | null) {
	const colonyNav = useQuery(api.colonyNav.getColonyNav, colonyId ? { colonyId } : "skip");
	const queueStatuses = useQuery(
		api.colonyNav.getAllColonyQueueStatuses,
		colonyId ? { colonyId } : "skip",
	);

	return useMemo(
		() =>
			buildColonySessionSnapshot({
				colonyNav,
				queueStatuses,
			}),
		[colonyNav, queueStatuses],
	);
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
		const snapshot = readSnapshotFromLocalStore({
			colonyId: mutationArgs.colonyId,
			localStore,
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
		writeSnapshotToLocalStore({
			colonyId: mutationArgs.colonyId,
			localStore,
			snapshot: nextSnapshot,
		});

		const colonyNav = localStore.getQuery(api.colonyNav.getColonyNav, {
			colonyId: mutationArgs.colonyId,
		});
		if (colonyNav) {
			localStore.setQuery(
				api.colonyNav.getColonyNav,
				{ colonyId: mutationArgs.colonyId },
				{
					...colonyNav,
					colonies: colonyNav.colonies.map(
						(colony: { addressLabel: string; id: Id<"colonies">; name: string }) =>
							colony.id === mutationArgs.colonyId ? { ...colony, name: nextSnapshot.name } : colony,
					),
					title:
						colonyNav.activeColonyId === mutationArgs.colonyId
							? `${nextSnapshot.name} Resources`
							: colonyNav.title,
				},
			);
		}

		const queueStatuses = localStore.getQuery(api.colonyNav.getAllColonyQueueStatuses, {
			colonyId: mutationArgs.colonyId,
		});
		if (!queueStatuses) {
			return;
		}

		localStore.setQuery(
			api.colonyNav.getAllColonyQueueStatuses,
			{ colonyId: mutationArgs.colonyId },
			{
				...queueStatuses,
				statuses: queueStatuses.statuses.map(
					(entry: { colonyId: Id<"colonies">; status: "Queued" | "Stable" | "Upgrading" }) =>
						entry.colonyId === mutationArgs.colonyId
							? {
									...entry,
									status: deriveColonySessionStatus(nextSnapshot),
								}
							: entry,
				),
			},
		);
	});
}
