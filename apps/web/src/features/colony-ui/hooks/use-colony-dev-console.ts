import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type {
	BuildingKey,
	DefenseKey,
	FacilityKey,
	ResourceBucket,
	ShipKey,
} from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";

import { useMutation, useQuery } from "@/lib/convex-hooks";

export function useColonyDevConsole(colonyId: Id<"colonies"> | null) {
	const state = useQuery(api.devConsole.getDevConsoleState, colonyId ? { colonyId } : "skip");
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
	const requireColonyId = () => {
		if (!colonyId) {
			throw new Error("Colony is required for this dev console action");
		}

		return colonyId;
	};

	return {
		canShowDevUi: state?.showDevConsoleUi === true,
		canUseDevConsole: state?.canUseDevConsole === true,
		state,
		actions: {
			completeMission: (operationId: Id<"fleetOperations">) => {
				return completeActiveMission({ colonyId: requireColonyId(), operationId });
			},
			completeQueue: (lane: "building" | "defense" | "shipyard") => {
				return completeActiveQueueItem({ colonyId: requireColonyId(), lane });
			},
			completeRaid: () => {
				return completeActiveRaidAtCurrentColony({ colonyId: requireColonyId() });
			},
			setBuildingLevels: (buildingLevels: Partial<Record<BuildingKey, number>>) => {
				return setBuildingLevels({ buildingLevels, colonyId: requireColonyId() });
			},
			setDefenseCounts: (defenseCounts: Partial<Record<DefenseKey, number>>) => {
				return setDefenseCounts({ colonyId: requireColonyId(), defenseCounts });
			},
			setFacilityLevels: (facilityLevels: Partial<Record<FacilityKey, number>>) => {
				return setFacilityLevels({ colonyId: requireColonyId(), facilityLevels });
			},
			setResources: (resources: Partial<ResourceBucket>) => {
				return setColonyResources({ colonyId: requireColonyId(), resources });
			},
			setShipCounts: (shipCounts: Partial<Record<ShipKey, number>>) => {
				return setShipCounts({ colonyId: requireColonyId(), shipCounts });
			},
			setUiEnabled: (enabled: boolean) => setDevConsoleUiEnabled({ enabled }),
			triggerRaid: () => {
				return triggerNpcRaidAtCurrentColony({ colonyId: requireColonyId() });
			},
		},
	};
}
