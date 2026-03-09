import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type FleetMissionKind = "transport" | "colonize";

export type StarMapFleetTargetSelection = {
	addressLabel: string;
	colonyId?: Id<"colonies">;
	colonyName?: string;
	galaxyIndex: number;
	missionKind: FleetMissionKind;
	planetId: Id<"planets">;
	planetIndex: number;
	planetName: string;
	sectorIndex: number;
	systemIndex: number;
};

type StarMapPickerRequest = {
	missionKind: FleetMissionKind;
	originColonyId: Id<"colonies">;
};

type ColonyStarMapPickerContextValue = {
	completeSelection: (selection: StarMapFleetTargetSelection) => void;
	consumedSelection: () => void;
	openPicker: (request: StarMapPickerRequest) => void;
	pickerRequest: StarMapPickerRequest | null;
	selectedTarget: StarMapFleetTargetSelection | null;
};

const ColonyStarMapPickerContext = createContext<ColonyStarMapPickerContextValue | null>(null);

export function ColonyStarMapPickerProvider(props: { children: React.ReactNode }) {
	const [pickerRequest, setPickerRequest] = useState<StarMapPickerRequest | null>(null);
	const [selectedTarget, setSelectedTarget] = useState<StarMapFleetTargetSelection | null>(null);

	const openPicker = useCallback((request: StarMapPickerRequest) => {
		setPickerRequest(request);
	}, []);

	const completeSelection = useCallback((selection: StarMapFleetTargetSelection) => {
		setSelectedTarget(selection);
		setPickerRequest(null);
	}, []);

	const consumedSelection = useCallback(() => {
		setSelectedTarget(null);
	}, []);

	const value = useMemo(
		() => ({
			completeSelection,
			consumedSelection,
			openPicker,
			pickerRequest,
			selectedTarget,
		}),
		[completeSelection, consumedSelection, openPicker, pickerRequest, selectedTarget],
	);

	return (
		<ColonyStarMapPickerContext.Provider value={value}>
			{props.children}
		</ColonyStarMapPickerContext.Provider>
	);
}

export function useColonyStarMapPicker() {
	const context = useContext(ColonyStarMapPickerContext);
	if (!context) {
		throw new Error("useColonyStarMapPicker must be used within ColonyStarMapPickerProvider");
	}
	return context;
}
