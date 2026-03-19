import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { normalizeShipCounts, selectShipCatalog } from "@nullvector/game-logic";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { DEFAULT_SELECTED_SHIPS, type RecommendedContractView, type SelectedContractContext, type ShipAssignment } from "./contracts-screen-shared";
import { useColonyDevConsole, useNowMs } from "./route-shared";

export function useContractsRouteData(args: {
	colonyId: Id<"colonies">;
	historyExpanded: boolean;
}) {
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const nowMs = useNowMs(isAuthenticated);
	const shipCatalog = useMemo(() => selectShipCatalog(), []);
	const progression = useQuery(
		api.playerProgression.getPlayerProgression,
		isAuthenticated ? {} : "skip",
	);
	const recommendedResult = useQuery(
		api.contracts.getRecommendedContracts,
		isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const garrison = useQuery(
		api.fleetV2.getFleetGarrison,
		isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const operations = useQuery(
		api.fleetV2.getFleetOperationsForColony,
		isAuthenticated ? { colonyId: args.colonyId } : "skip",
	);
	const historySummary = useQuery(
		api.contracts.getContractHistorySummary,
		isAuthenticated ? {} : "skip",
	);
	const history = useQuery(
		api.contracts.getContractHistory,
		isAuthenticated && args.historyExpanded ? { limit: 10 } : "skip",
	);
	const devConsole = useColonyDevConsole(args.colonyId);

	const ships = useMemo<ShipAssignment[]>(() => {
		if (!garrison) {
			return [];
		}

		return shipCatalog.map((ship) => ({
			...ship,
			available: garrison.garrisonShips[ship.key] ?? 0,
		}));
	}, [garrison, shipCatalog]);

	const shipsByKey = useMemo(
		() => new Map(shipCatalog.map((ship) => [ship.key, { name: ship.name }])),
		[shipCatalog],
	);

	const activeContractOperations = useMemo(
		() =>
			operations?.active.filter(
				(operation): operation is NonNullable<typeof operations>["active"][number] =>
					operation.kind === "contract",
			) ?? [],
		[operations],
	);

	const recommendedContracts = useMemo(() => {
		if (!recommendedResult) {
			return null;
		}

		return recommendedResult.recommendedContracts as RecommendedContractView[];
	}, [recommendedResult]);

	const ready =
		!isAuthLoading &&
		isAuthenticated &&
		Boolean(recommendedResult && progression && historySummary && garrison && operations);

	return {
		activeContractOperations,
		canShowDevUi: devConsole.canShowDevUi,
		canUseDevConsole: devConsole.canUseDevConsole,
		devConsole,
		garrison,
		history,
		historySummary,
		isAuthLoading,
		isAuthenticated,
		nowMs,
		operations,
		progression,
		ready,
		recommendedContracts,
		recommendedResult,
		shipCatalog,
		ships,
		shipsByKey,
	};
}

export function useContractDiscoveryRebuild(args: {
	colonyId: Id<"colonies">;
	isAuthenticated: boolean;
	recommendedResult: { needsRebuild?: boolean } | null | undefined;
}) {
	const rebuildContractDiscovery = useMutation(api.contracts.rebuildContractDiscovery);
	const [isRebuildingDiscovery, setIsRebuildingDiscovery] = useState(false);
	const [rebuildAttemptedForColony, setRebuildAttemptedForColony] = useState<Id<"colonies"> | null>(
		null,
	);
	const isUnmountedRef = useRef(false);
	const currentRebuildTokenRef = useRef<symbol | null>(null);

	useEffect(() => {
		isUnmountedRef.current = false;
		return () => {
			isUnmountedRef.current = true;
		};
	}, []);

	useEffect(() => {
		setRebuildAttemptedForColony(null);
		setIsRebuildingDiscovery(false);
		currentRebuildTokenRef.current = null;
	}, [args.colonyId]);

	useEffect(() => {
		if (
			args.recommendedResult &&
			args.recommendedResult.needsRebuild === false &&
			rebuildAttemptedForColony === args.colonyId
		) {
			setRebuildAttemptedForColony(null);
			return;
		}

		const needsRebuild = args.recommendedResult?.needsRebuild === true;
		if (
			!args.isAuthenticated ||
			!args.recommendedResult ||
			!needsRebuild ||
			isRebuildingDiscovery ||
			rebuildAttemptedForColony === args.colonyId
		) {
			return;
		}

		const token = Symbol("rebuild-contract-discovery");
		currentRebuildTokenRef.current = token;
		setIsRebuildingDiscovery(true);
		setRebuildAttemptedForColony(args.colonyId);
		void rebuildContractDiscovery({ colonyId: args.colonyId })
			.catch((error) => {
				if (isUnmountedRef.current || currentRebuildTokenRef.current !== token) {
					return;
				}

				setRebuildAttemptedForColony(null);
				const message =
					error instanceof Error ? error.message : "Failed to rebuild nearby contracts.";
				toast.error(message);
			})
			.finally(() => {
				if (isUnmountedRef.current || currentRebuildTokenRef.current !== token) {
					return;
				}

				currentRebuildTokenRef.current = null;
				setIsRebuildingDiscovery(false);
			});
	}, [
		args.colonyId,
		args.isAuthenticated,
		args.recommendedResult,
		isRebuildingDiscovery,
		rebuildAttemptedForColony,
		rebuildContractDiscovery,
	]);

	return {
		isRebuildingDiscovery,
	};
}

export function useContractSelection() {
	const [selectedContext, setSelectedContext] = useState<SelectedContractContext | null>(null);
	const [selectedShips, setSelectedShips] =
		useState<Record<ShipKey, number>>({ ...DEFAULT_SELECTED_SHIPS });

	const selectedContract = selectedContext?.contract ?? null;
	const selectedShipCounts = useMemo(() => normalizeShipCounts(selectedShips), [selectedShips]);

	function resetSelection() {
		setSelectedContext(null);
		setSelectedShips({ ...DEFAULT_SELECTED_SHIPS });
	}

	function selectRecommended(contract: RecommendedContractView) {
		setSelectedContext({
			contract,
			planet: {
				displayName: contract.planetDisplayName,
				addressLabel: contract.planetAddressLabel,
				hostileFactionKey: contract.hostileFactionKey,
				sectorDisplayName: contract.sectorDisplayName,
			},
			distance: contract.distance,
		});
		setSelectedShips({ ...DEFAULT_SELECTED_SHIPS });
	}

	return {
		resetSelection,
		selectRecommended,
		selectedContext,
		selectedContract,
		selectedShipCounts,
		selectedShips,
		setSelectedContext,
		setSelectedShips,
	};
}

export function useContractMissionActions(args: {
	colonyId: Id<"colonies">;
	completeActiveMission: (input: {
		colonyId: Id<"colonies">;
		operationId: Id<"fleetOperations">;
	}) => Promise<unknown>;
}) {
	const launchContract = useMutation(api.contracts.launchContract);
	const cancelOperation = useMutation(api.fleetV2.cancelOperation);
	const [isLaunching, setIsLaunching] = useState(false);
	const [cancelingOperationId, setCancelingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);
	const [completingOperationId, setCompletingOperationId] = useState<Id<"fleetOperations"> | null>(
		null,
	);

	async function launchContractMission(next: {
		onSuccess?: () => void;
		originColonyId: Id<"colonies">;
		offerSequence: number;
		planetId: Id<"planets">;
		shipCounts: Record<ShipKey, number>;
		slot: number;
	}) {
		setIsLaunching(true);
		try {
			await launchContract({
				originColonyId: next.originColonyId,
				planetId: next.planetId,
				slot: next.slot,
				offerSequence: next.offerSequence,
				shipCounts: next.shipCounts,
			});
			toast.success("Contract mission launched");
			next.onSuccess?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to launch mission");
		} finally {
			setIsLaunching(false);
		}
	}

	async function cancelMissionOperation(operationId: Id<"fleetOperations">) {
		setCancelingOperationId(operationId);
		try {
			await cancelOperation({ operationId });
			toast.success("Operation cancelled; fleet is returning");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel operation");
		} finally {
			setCancelingOperationId(null);
		}
	}

	async function completeMission(operationId: Id<"fleetOperations">) {
		setCompletingOperationId(operationId);
		try {
			await args.completeActiveMission({
				colonyId: args.colonyId,
				operationId,
			});
			toast.success("Operation completed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to complete operation");
		} finally {
			setCompletingOperationId(null);
		}
	}

	return {
		cancelMissionOperation,
		cancelingOperationId,
		completeMission,
		completingOperationId,
		isLaunching,
		launchContractMission,
	};
}
