import type { HighlightTarget } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { QUEST_DEFINITIONS } from "@nullvector/game-logic";
import React, { createContext, useContext, useMemo } from "react";

import { useConvexAuth, useQuery } from "@/lib/convex-hooks";

type HighlightContextValue = {
	activeHighlights: Map<HighlightTarget, { questId: string; hint?: string }>;
};

const HighlightContext = createContext<HighlightContextValue>({
	activeHighlights: new Map(),
});

const questHighlightsByIdCache = new Map<
	string,
	Array<{ target: HighlightTarget; hint?: string }>
>();
for (const def of QUEST_DEFINITIONS) {
	if (def.highlights) {
		questHighlightsByIdCache.set(def.id, def.highlights);
	}
}

export function HighlightProvider({ children }: { children: React.ReactNode }) {
	const { isAuthenticated } = useConvexAuth();
	const tracker = useQuery(api.quests.getTracker, isAuthenticated ? {} : "skip");

	const activeHighlights = useMemo<Map<HighlightTarget, { questId: string; hint?: string }>>(() => {
		const result = new Map<HighlightTarget, { questId: string; hint?: string }>();
		if (!tracker) return result;

		for (const item of tracker.items) {
			// Only highlight for active (non-claimed) quests
			if (item.status === "claimed") continue;
			const highlights = questHighlightsByIdCache.get(item.id);
			if (!highlights) continue;
			for (const highlight of highlights) {
				// Don't override a highlight already set by a higher-priority quest
				if (!result.has(highlight.target)) {
					result.set(highlight.target, { questId: item.id, hint: highlight.hint });
				}
			}
		}

		return result;
	}, [tracker]);

	return (
		<HighlightContext.Provider value={{ activeHighlights }}>{children}</HighlightContext.Provider>
	);
}

export function useHighlightContext(): HighlightContextValue {
	return useContext(HighlightContext);
}
