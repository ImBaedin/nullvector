import { useCallback, useEffect, useRef, useState } from "react";

import type { StarMapHeaderNavigation } from "@/features/game-ui/header/app-header";

const STAR_MAP_CONTENT_TRANSITION_MS = 500;
const RESEARCH_LAYER_TRANSITION_MS = 260;

type OverlayContentPhase = "visible" | "hiding" | "hidden" | "revealing";
type ResearchLayerPhase = "closed" | "opening" | "open" | "closing";
type ImmersiveMode = "research" | "starMap" | null;

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
	if (
		current.onExit !== next.onExit ||
		current.onSelectEntity !== next.onSelectEntity ||
		current.onQualityPresetChange !== next.onQualityPresetChange
	) {
		return false;
	}
	if (current.pathItems.length !== next.pathItems.length) {
		return false;
	}
	for (let i = 0; i < current.pathItems.length; i += 1) {
		const currentItem = current.pathItems[i];
		const nextItem = next.pathItems[i];
		if (
			currentItem.id !== nextItem.id ||
			currentItem.label !== nextItem.label ||
			currentItem.onSelect !== nextItem.onSelect
		) {
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
	const [researchPhase, setResearchPhase] = useState<ResearchLayerPhase>("closed");
	const [headerStarMapNavigation, setHeaderStarMapNavigation] =
		useState<StarMapHeaderNavigation | null>(null);
	const [contentPhase, setContentPhase] = useState<OverlayContentPhase>("visible");
	const revealRafRef = useRef<number | null>(null);
	const researchOpenRafRef = useRef<number | null>(null);
	const researchCloseTimerRef = useRef<number | null>(null);

	const clearResearchTimers = useCallback(() => {
		if (researchOpenRafRef.current !== null) {
			cancelAnimationFrame(researchOpenRafRef.current);
			researchOpenRafRef.current = null;
		}
		if (researchCloseTimerRef.current !== null) {
			window.clearTimeout(researchCloseTimerRef.current);
			researchCloseTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			if (revealRafRef.current !== null) {
				cancelAnimationFrame(revealRafRef.current);
			}
			clearResearchTimers();
		};
	}, [clearResearchTimers]);

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

		clearResearchTimers();
		setResearchPhase("closed");
		setIsStarMapOpen(true);
	}, [args.pickerRequested, clearResearchTimers]);

	const handleHeaderNavigationChange = useCallback((navigation: StarMapHeaderNavigation | null) => {
		setHeaderStarMapNavigation((current) =>
			isSameHeaderNavigation(current, navigation) ? current : navigation,
		);
	}, []);

	const handleCloseStarMap = useCallback(() => {
		setIsStarMapOpen(false);
	}, []);

	const handleToggleStarMap = useCallback(() => {
		setIsStarMapOpen((current) => {
			const next = !current;
			if (next) {
				clearResearchTimers();
				setResearchPhase("closed");
			}
			return next;
		});
	}, [clearResearchTimers]);

	const handleCloseResearch = useCallback(() => {
		clearResearchTimers();
		setResearchPhase((current) => {
			if (current === "closed" || current === "closing") {
				return current;
			}
			return "closing";
		});
		researchCloseTimerRef.current = window.setTimeout(() => {
			researchCloseTimerRef.current = null;
			setResearchPhase("closed");
		}, RESEARCH_LAYER_TRANSITION_MS);
	}, [clearResearchTimers]);

	const handleToggleResearch = useCallback(() => {
		if (researchPhase === "open" || researchPhase === "opening") {
			handleCloseResearch();
			return;
		}

		clearResearchTimers();
		setIsStarMapOpen(false);
		setResearchPhase("opening");
		researchOpenRafRef.current = requestAnimationFrame(() => {
			researchOpenRafRef.current = null;
			setResearchPhase("open");
		});
	}, [clearResearchTimers, handleCloseResearch, researchPhase]);

	const isResearchMounted = researchPhase !== "closed";
	const isResearchInteractive = researchPhase === "open";
	const isResearchOpen = isResearchMounted;
	const activeImmersiveMode: ImmersiveMode = isStarMapOpen
		? "starMap"
		: isResearchMounted
			? "research"
			: null;
	const activeBackgroundScene = "starMap";
	const shouldCollapseForStarMap =
		activeImmersiveMode === "starMap" &&
		(contentPhase === "hiding" || contentPhase === "hidden" || contentPhase === "revealing");
	const shouldCollapseForResearch = isResearchMounted;

	return {
		activeBackgroundScene: activeBackgroundScene as "starMap",
		activeImmersiveMode,
		contentPhase,
		handleCloseResearch,
		handleCloseStarMap,
		handleHeaderNavigationChange,
		handleToggleResearch,
		handleToggleStarMap,
		headerStarMapNavigation,
		isResearchInteractive,
		isResearchMounted,
		isResearchOpen,
		isStarMapOpen,
		outletActivityMode: (contentPhase === "hidden" || isResearchMounted ? "hidden" : "visible") as
			| "hidden"
			| "visible",
		researchPhase,
		shouldCollapseContent: shouldCollapseForStarMap || shouldCollapseForResearch,
		shouldCollapseHeaderChrome: activeImmersiveMode !== null,
	};
}
