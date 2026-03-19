import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, DefenseKey, FacilityKey, ResourceBucket, ShipKey } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";

import { useMutation, useQuery } from "@/lib/convex-hooks";

export function useColonyDevConsole(colonyId: Id<"colonies"> | null) {
	const state = useQuery(
		api.devConsole.getDevConsoleState,
		colonyId ? { colonyId } : "skip",
	);
	const completeActiveQueueItem = useMutation(api.devConsole.completeActiveQueueItem);
	const completeActiveMission = useMutation(api.devConsole.completeActiveMission);
	const completeActiveRaidAtCurrentColony = useMutation(
		api.devConsole.completeActiveRaidAtCurrentColony,
	);
	const setBuildingLevels = useMutation(api.devConsole.setBuildingLevels);
	const setColonyResources = useMutation(api.devConsole.setColonyResources);
	const setDefenseCounts = useMutation(api.devConsole.setDefenseCounts);
	const setDevConsoleUiEnabled = useMutation(api.devConsole.setDevConsoleUiEnabled);
	const setFacilityLevels = useMutation(api.devConsole.setFacilityLevels);
	const setShipCounts = useMutation(api.devConsole.setShipCounts);
	const triggerNpcRaidAtCurrentColony = useMutation(api.devConsole.triggerNpcRaidAtCurrentColony);

	return {
		canShowDevUi: state?.showDevConsoleUi === true,
		canUseDevConsole: state?.canUseDevConsole === true,
		state,
		actions: {
			completeMission: (operationId: Id<"fleetOperations">) => {
				if (!colonyId) {
					throw new Error("Colony is required to complete a mission");
				}
				return completeActiveMission({ colonyId, operationId });
			},
			completeQueue: (lane: "building" | "defense" | "shipyard") => {
				if (!colonyId) {
					throw new Error("Colony is required to complete a queue item");
				}
				return completeActiveQueueItem({ colonyId, lane });
			},
			completeRaid: () => {
				if (!colonyId) {
					throw new Error("Colony is required to complete a raid");
				}
				return completeActiveRaidAtCurrentColony({ colonyId });
			},
			setBuildingLevels: (buildingLevels: Partial<Record<BuildingKey, number>>) => {
				if (!colonyId) {
					throw new Error("Colony is required to edit building levels");
				}
				return setBuildingLevels({ buildingLevels, colonyId });
			},
			setDefenseCounts: (defenseCounts: Partial<Record<DefenseKey, number>>) => {
				if (!colonyId) {
					throw new Error("Colony is required to edit defense counts");
				}
				return setDefenseCounts({ colonyId, defenseCounts });
			},
			setFacilityLevels: (facilityLevels: Partial<Record<FacilityKey, number>>) => {
				if (!colonyId) {
					throw new Error("Colony is required to edit facility levels");
				}
				return setFacilityLevels({ colonyId, facilityLevels });
			},
			setResources: (resources: Partial<ResourceBucket>) => {
				if (!colonyId) {
					throw new Error("Colony is required to edit resources");
				}
				return setColonyResources({ colonyId, resources });
			},
			setShipCounts: (shipCounts: Partial<Record<ShipKey, number>>) => {
				if (!colonyId) {
					throw new Error("Colony is required to edit ship counts");
				}
				return setShipCounts({ colonyId, shipCounts });
			},
			setUiEnabled: (enabled: boolean) => setDevConsoleUiEnabled({ enabled }),
			triggerRaid: () => {
				if (!colonyId) {
					throw new Error("Colony is required to trigger a raid");
				}
				return triggerNpcRaidAtCurrentColony({ colonyId });
			},
		},
	};
}
