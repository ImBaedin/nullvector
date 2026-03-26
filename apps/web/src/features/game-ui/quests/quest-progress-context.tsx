import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { HighlightTarget, QuestTimelineItem, QuestTrackerItem } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import {
	QUEST_DEFINITIONS,
	deriveQuestTimelineItems,
	deriveQuestTrackerItems,
} from "@nullvector/game-logic";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

type QuestProgressContextValue = {
	trackerItems: QuestTrackerItem[];
	timelineItems: QuestTimelineItem[];
	activeQuestCount: number;
	claimableQuestCount: number;
	claimedQuestIds: Set<string>;
	activeHighlights: Map<HighlightTarget, { questId: string; hint?: string }>;
	ensureActivations: () => Promise<void>;
	claimQuest: (questId: string) => Promise<void>;
	loading: boolean;
};

const QuestProgressContext = createContext<QuestProgressContextValue | null>(null);

type QuestProgressProviderProps = {
	activeColonyId: Id<"colonies"> | null;
	children: React.ReactNode;
};

const questHighlightsById = new Map(
	QUEST_DEFINITIONS.map((definition) => [definition.id, definition.highlights ?? []] as const),
);

export function QuestProgressProvider({ activeColonyId, children }: QuestProgressProviderProps) {
	const { isAuthenticated } = useConvexAuth();
	const clientState = useQuery(api.quests.getClientState, isAuthenticated ? {} : "skip");
	const progressionOverview = useQuery(api.progression.getOverview, isAuthenticated ? {} : "skip");
	const ensureActivationsMutation = useMutation(api.quests.ensureActivations);
	const claimMutation = useMutation(api.quests.claim);
	const ensuredKeysRef = useRef(new Set<string>());
	const inFlightKeysRef = useRef(new Map<string, Promise<void>>());
	const progressionVersion =
		progressionOverview === undefined
			? "unknown"
			: `${progressionOverview.rank}:${progressionOverview.rankXpTotal}`;

	const ensureForCurrentContext = useCallback(
		async (force = false) => {
			if (!isAuthenticated) {
				return;
			}
			const key = `${activeColonyId ?? "none"}:${progressionVersion}`;
			if (!force && ensuredKeysRef.current.has(key)) {
				return;
			}
			const existing = inFlightKeysRef.current.get(key);
			if (existing) {
				return existing;
			}
			const next = ensureActivationsMutation(activeColonyId ? { activeColonyId } : {})
				.then(() => {
					ensuredKeysRef.current.add(key);
				})
				.finally(() => {
					inFlightKeysRef.current.delete(key);
				});
			inFlightKeysRef.current.set(key, next);
			return next;
		},
		[activeColonyId, ensureActivationsMutation, isAuthenticated, progressionVersion],
	);

	useEffect(() => {
		if (!isAuthenticated) {
			ensuredKeysRef.current.clear();
			inFlightKeysRef.current.clear();
			return;
		}
		void ensureForCurrentContext().catch((error) => {
			console.error("Quest activation ensure failed", {
				activeColonyId,
				error,
				progressionVersion,
			});
		});
	}, [activeColonyId, ensureForCurrentContext, isAuthenticated, progressionVersion]);

	const trackerItems = useMemo(() => {
		if (!clientState) {
			return [];
		}
		return deriveQuestTrackerItems({
			questDefinitions: QUEST_DEFINITIONS,
			questRows: clientState.questRows,
			facts: clientState.facts,
		});
	}, [clientState]);

	const timelineItems = useMemo(() => {
		if (!clientState || !progressionOverview) {
			return [];
		}
		return deriveQuestTimelineItems({
			questDefinitions: QUEST_DEFINITIONS,
			playerRank: progressionOverview.rank,
			questRows: clientState.questRows,
			facts: clientState.facts,
		});
	}, [clientState, progressionOverview]);

	const claimableQuestCount = useMemo(
		() => trackerItems.filter((item) => item.claimable).length,
		[trackerItems],
	);
	const claimedQuestIds = useMemo(
		() =>
			new Set(
				(clientState?.questRows ?? [])
					.filter((row) => row.status === "claimed")
					.map((row) => row.questId),
			),
		[clientState?.questRows],
	);
	const activeHighlights = useMemo(() => {
		const result = new Map<HighlightTarget, { questId: string; hint?: string }>();
		for (const item of trackerItems) {
			const highlights = questHighlightsById.get(item.id) ?? [];
			for (const highlight of highlights) {
				if (!result.has(highlight.target)) {
					result.set(highlight.target, { questId: item.id, hint: highlight.hint });
				}
			}
		}
		return result;
	}, [trackerItems]);

	const claimQuest = useCallback(
		async (questId: string) => {
			await claimMutation(activeColonyId ? { questId, activeColonyId } : { questId });
			await ensureForCurrentContext(true);
		},
		[activeColonyId, claimMutation, ensureForCurrentContext],
	);

	const value = useMemo<QuestProgressContextValue>(
		() => ({
			trackerItems,
			timelineItems,
			activeQuestCount: trackerItems.length,
			claimableQuestCount,
			claimedQuestIds,
			activeHighlights,
			ensureActivations: () => ensureForCurrentContext(),
			claimQuest,
			loading: isAuthenticated && (clientState === undefined || progressionOverview === undefined),
		}),
		[
			activeHighlights,
			claimQuest,
			claimableQuestCount,
			clientState,
			claimedQuestIds,
			ensureForCurrentContext,
			isAuthenticated,
			progressionOverview,
			timelineItems,
			trackerItems,
		],
	);

	return <QuestProgressContext.Provider value={value}>{children}</QuestProgressContext.Provider>;
}

export function useQuestProgressContext() {
	const value = useContext(QuestProgressContext);
	if (!value) {
		throw new Error("useQuestProgressContext must be used within QuestProgressProvider");
	}
	return value;
}
