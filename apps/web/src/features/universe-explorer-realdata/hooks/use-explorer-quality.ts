import { useEffect, useMemo, useState } from "react";

import type { ExplorerQualityPreset, ExplorerResolvedQuality } from "../types";

const QUALITY_STORAGE_KEY = "nullvector:explorer-quality:v1";

const QUALITY_PRESETS: ExplorerQualityPreset[] = ["auto", "low", "medium", "high"];

function isQualityPreset(value: string): value is ExplorerQualityPreset {
	return QUALITY_PRESETS.includes(value as ExplorerQualityPreset);
}

function resolveAutoQuality({
	width,
	height,
	dpr,
}: {
	width: number;
	height: number;
	dpr: number;
}): ExplorerResolvedQuality {
	const pixels = width * height * dpr * dpr;

	if (pixels > 7_800_000 || dpr >= 2.8) {
		return "low";
	}

	if (pixels > 3_800_000 || dpr >= 1.9) {
		return "medium";
	}

	return "high";
}

function resolveQuality({
	gpuQualityHint,
	preset,
}: {
	gpuQualityHint: ExplorerResolvedQuality | null;
	preset: ExplorerQualityPreset;
}): ExplorerResolvedQuality {
	if (preset !== "auto") {
		return preset;
	}

	if (gpuQualityHint) {
		return gpuQualityHint;
	}

	if (typeof window === "undefined") {
		return "medium";
	}

	return resolveAutoQuality({
		width: window.innerWidth,
		height: window.innerHeight,
		dpr: window.devicePixelRatio || 1,
	});
}

export function useExplorerQuality() {
	const [qualityPreset, setQualityPresetState] = useState<ExplorerQualityPreset>(() => {
		if (typeof window === "undefined") {
			return "auto";
		}

		const savedValue = window.localStorage.getItem(QUALITY_STORAGE_KEY);
		return savedValue && isQualityPreset(savedValue) ? savedValue : "auto";
	});
	const [gpuQualityHint, setGpuQualityHint] = useState<ExplorerResolvedQuality | null>(null);
	const [viewportVersion, setViewportVersion] = useState(0);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		if (qualityPreset !== "auto") {
			return;
		}

		const handleResize = () => {
			setViewportVersion((value) => value + 1);
		};

		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [qualityPreset]);

	useEffect(() => {
		if (typeof window === "undefined" || qualityPreset !== "auto") {
			return;
		}

		let isCancelled = false;

		const detectGpuTier = async () => {
			try {
				const { getGPUTier } = await import("detect-gpu");
				const gpuTier = await getGPUTier();

				if (isCancelled) {
					return;
				}

				if (gpuTier.tier >= 3) {
					setGpuQualityHint("high");
					return;
				}

				if (gpuTier.tier === 2) {
					setGpuQualityHint("medium");
					return;
				}

				setGpuQualityHint("low");
			} catch {
				if (!isCancelled) {
					setGpuQualityHint(null);
				}
			}
		};

		void detectGpuTier();

		return () => {
			isCancelled = true;
		};
	}, [qualityPreset]);

	const setQualityPreset = (nextPreset: ExplorerQualityPreset) => {
		setQualityPresetState(nextPreset);

		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(QUALITY_STORAGE_KEY, nextPreset);
	};

	const resolvedQuality = useMemo(
		() =>
			resolveQuality({
				gpuQualityHint,
				preset: qualityPreset,
			}),
		[gpuQualityHint, qualityPreset, viewportVersion],
	);

	const canvasDpr = useMemo<[number, number]>(() => {
		if (resolvedQuality === "low") {
			return [1, 1.1];
		}

		if (resolvedQuality === "medium") {
			return [1, 1.5];
		}

		return [1, 2];
	}, [resolvedQuality]);

	const antialiasEnabled = resolvedQuality !== "low";

	return {
		antialiasEnabled,
		canvasDpr,
		qualityPreset,
		resolvedQuality,
		setQualityPreset,
	};
}
