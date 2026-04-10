import { createContext, useContext } from "react";

import { useExplorerQuality } from "../hooks/use-explorer-quality";

type ExplorerQualityContextValue = ReturnType<typeof useExplorerQuality>;

const ExplorerQualityContext = createContext<ExplorerQualityContextValue | null>(null);

export function ExplorerQualityProvider({ children }: { children: React.ReactNode }) {
	const quality = useExplorerQuality();
	return (
		<ExplorerQualityContext.Provider value={quality}>{children}</ExplorerQualityContext.Provider>
	);
}

export function useExplorerQualityContext(): ExplorerQualityContextValue {
	const ctx = useContext(ExplorerQualityContext);
	if (!ctx) {
		throw new Error("useExplorerQualityContext must be used within ExplorerQualityProvider");
	}
	return ctx;
}
