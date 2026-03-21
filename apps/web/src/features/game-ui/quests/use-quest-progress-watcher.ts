import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { QuestTrackerItem } from "@nullvector/game-logic";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useEffect, useRef } from "react";

import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";

import { requestQuestModalOpen } from "./quest-modal-events";
import {
	showQuestActivatedToast,
	showQuestClaimableToast,
	showQuestProgressToast,
} from "./quest-toast";

type TrackerSnapshot = Map<string, QuestTrackerItem>;

function buildSnapshot(items: QuestTrackerItem[]): TrackerSnapshot {
	return new Map(items.map((item) => [item.id, item]));
}

export function useQuestProgressWatcher(args: { activeColonyId: Id<"colonies"> | null }) {
	const { isAuthenticated } = useConvexAuth();
	const tracker = useQuery(api.quests.getTracker, isAuthenticated ? {} : "skip");
	const claimQuest = useMutation(api.quests.claim);

	const previousSnapshotRef = useRef<TrackerSnapshot | null>(null);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstLoadRef = useRef(true);

	useEffect(() => {
		if (!tracker) {
			return;
		}

		if (debounceTimerRef.current !== null) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(() => {
			const currentItems = tracker.items;
			const prev = previousSnapshotRef.current;

			if (prev === null) {
				// First load — just store snapshot, no toasts on initial load
				previousSnapshotRef.current = buildSnapshot(currentItems);
				isFirstLoadRef.current = false;
				return;
			}

			for (const item of currentItems) {
				const prevItem = prev.get(item.id);

				if (!prevItem) {
					// New quest appeared
					showQuestActivatedToast({
						questId: item.id,
						title: item.title,
						onView: () => {
							requestQuestModalOpen(item.id);
						},
					});
					continue;
				}

				// Check if newly claimable
				if (!prevItem.claimable && item.claimable) {
					showQuestClaimableToast({
						questId: item.id,
						title: item.title,
						onClaim: async () => {
							await claimQuest({ questId: item.id });
						},
					});
					continue;
				}

				// Check if objective progress increased (only if not claimable yet)
				if (!item.claimable && item.objectives.length > 0 && prevItem.objectives.length > 0) {
					// Find the most advanced changed objective
					let bestChangedObjective: QuestTrackerItem["objectives"][number] | null = null;
					let bestRatio = -1;

					for (let i = 0; i < item.objectives.length; i++) {
						const current = item.objectives[i];
						const previous = prevItem.objectives[i];
						if (!current || !previous) continue;

						if (current.current > previous.current) {
							const ratio = current.required > 0 ? current.current / current.required : 0;
							if (ratio > bestRatio) {
								bestRatio = ratio;
								bestChangedObjective = current;
							}
						}
					}

					if (bestChangedObjective !== null) {
						showQuestProgressToast({
							questId: item.id,
							title: item.title,
							description: item.description,
							objectives: item.objectives,
						});
					}
				}
			}

			previousSnapshotRef.current = buildSnapshot(currentItems);
		}, 150);

		return () => {
			if (debounceTimerRef.current !== null) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [tracker, claimQuest]);
}
