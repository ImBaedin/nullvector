import type { HighlightTarget } from "@nullvector/game-logic";

import React, { createContext, useContext } from "react";

import { useQuestProgress } from "./use-quest-progress";

type HighlightContextValue = {
	activeHighlights: Map<HighlightTarget, { questId: string; hint?: string }>;
};

const HighlightContext = createContext<HighlightContextValue>({
	activeHighlights: new Map(),
});

export function HighlightProvider({ children }: { children: React.ReactNode }) {
	const { activeHighlights } = useQuestProgress();

	return (
		<HighlightContext.Provider value={{ activeHighlights }}>{children}</HighlightContext.Provider>
	);
}

export function useHighlightContext(): HighlightContextValue {
	return useContext(HighlightContext);
}
