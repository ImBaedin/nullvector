import { useCallback, useEffect, useRef, useState } from "react";

import type { StarMapHeaderNavigation } from "@/features/game-ui/header/app-header";

const STAR_MAP_CONTENT_TRANSITION_MS = 500;

type OverlayContentPhase = "visible" | "hiding" | "hidden" | "revealing";

function isSameHeaderNavigation(
	current: StarMapHeaderNavigation | null,
	next: StarMapHeaderNavigation | null,
) {
	if (current === next) {
		return true;
	}
	if (!current || !next) {
		return false;
	}
	if (current.levelLabel !== next.levelLabel || current.qualityPreset !== next.qualityPreset) {
		return false;
	}
	if (current.pathItems.length !== next.pathItems.length) {
		return false;
	}
	for (let i = 0; i < current.pathItems.length; i += 1) {
		const currentItem = current.pathItems[i];
		const nextItem = next.pathItems[i];
		if (currentItem.id !== nextItem.id || currentItem.label !== nextItem.label) {
			return false;
		}
	}
	if (current.entityItems.length !== next.entityItems.length) {
		return false;
	}
	for (let i = 0; i < current.entityItems.length; i += 1) {
		const currentItem = current.entityItems[i];
		const nextItem = next.entityItems[i];
		if (
			currentItem.id !== nextItem.id ||
			currentItem.label !== nextItem.label ||
			currentItem.subtitle !== nextItem.subtitle
		) {
			return false;
		}
	}
	return true;
}

export function useColonyLayoutController(args: { pickerRequested: boolean }) {
	const [isStarMapOpen, setIsStarMapOpen] = useState(false);
	const [headerStarMapNavigation, setHeaderStarMapNavigation] =
		useState<StarMapHeaderNavigation | null>(null);
	const [contentPhase, setContentPhase] = useState<OverlayContentPhase>("visible");
	const revealRafRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (revealRafRef.current !== null) {
				cancelAnimationFrame(revealRafRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (revealRafRef.current !== null) {
			cancelAnimationFrame(revealRafRef.current);
			revealRafRef.current = null;
		}

		if (!isStarMapOpen) {
			setContentPhase((current) => {
				if (current === "hidden") {
					revealRafRef.current = requestAnimationFrame(() => {
						revealRafRef.current = null;
						setContentPhase("visible");
					});
					return "revealing";
				}

				if (current === "hiding") {
					return "visible";
				}
				return current;
			});
			return;
		}

		setContentPhase((current) => (current === "hidden" ? current : "hiding"));

		const hideTimerId = window.setTimeout(() => {
			setContentPhase("hidden");
		}, STAR_MAP_CONTENT_TRANSITION_MS);

		return () => {
			window.clearTimeout(hideTimerId);
		};
	}, [isStarMapOpen]);

	useEffect(() => {
		if (!args.pickerRequested) {
			return;
		}
		setIsStarMapOpen(true);
	}, [args.pickerRequested]);

	const handleHeaderNavigationChange = useCallback((navigation: StarMapHeaderNavigation | null) => {
		setHeaderStarMapNavigation((current) =>
			isSameHeaderNavigation(current, navigation) ? current : navigation,
		);
	}, []);

	const handleCloseStarMap = useCallback(() => {
		setIsStarMapOpen(false);
	}, []);

	const handleToggleStarMap = useCallback(() => {
		setIsStarMapOpen((current) => !current);
	}, []);

	return {
		contentPhase,
		handleCloseStarMap,
		handleHeaderNavigationChange,
		handleToggleStarMap,
		headerStarMapNavigation,
		isStarMapOpen,
		outletActivityMode: (contentPhase === "hidden" ? "hidden" : "visible") as "hidden" | "visible",
		shouldCollapseContent:
			contentPhase === "hiding" || contentPhase === "hidden" || contentPhase === "revealing",
	};
}
