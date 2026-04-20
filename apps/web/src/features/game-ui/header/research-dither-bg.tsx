/**
 * Animated dither background for the Research button.
 * Cycles through the five research branch wave-colors (sourced from
 * game-logic/src/research.ts branchThemes → ditherWaveColor) and feeds
 * them into the same WebGL Dither shader used by the research tree.
 */
import { useEffect, useRef, useState } from "react";

import Dither from "@/components/Dither";

// Authoritative ditherWaveColor values from game-logic/src/research.ts
const BRANCH_COLORS: Array<[number, number, number]> = [
	[1, 0.57, 0.31], //    Applied Industry       — orange
	[0.94, 0.32, 0.32], // Military Systems        — red
	[0.43, 0.91, 0.72], // Scientific Infrastructure — teal
	[0.22, 0.74, 0.97], // Expansion Logistics     — sky
	[0.98, 0.8, 0.08], //  Colony Specialization   — amber
];

const DWELL_MS = 2800; // hold each color
const FADE_MS = 1100; // crossfade to the next
const CYCLE_MS = DWELL_MS + FADE_MS;
const TOTAL_MS = CYCLE_MS * BRANCH_COLORS.length;

function smoothstep(t: number): number {
	const x = Math.max(0, Math.min(1, t));
	return x * x * (3 - 2 * x);
}

function lerpColor(
	from: [number, number, number],
	to: [number, number, number],
	t: number,
): [number, number, number] {
	return [
		from[0] + (to[0] - from[0]) * t,
		from[1] + (to[1] - from[1]) * t,
		from[2] + (to[2] - from[2]) * t,
	];
}

function computeColor(elapsedMs: number): [number, number, number] {
	const pos = elapsedMs % TOTAL_MS;
	const idx = Math.floor(pos / CYCLE_MS) % BRANCH_COLORS.length;
	const nextIdx = (idx + 1) % BRANCH_COLORS.length;
	const elapsed = pos % CYCLE_MS;
	const t = elapsed < DWELL_MS ? 0 : smoothstep((elapsed - DWELL_MS) / FADE_MS);
	return lerpColor(BRANCH_COLORS[idx], BRANCH_COLORS[nextIdx], t);
}

export function ResearchDitherBg() {
	const startRef = useRef<number | null>(null);
	const [waveColor, setWaveColor] = useState<[number, number, number]>(BRANCH_COLORS[0]);

	useEffect(() => {
		// ~25 fps is plenty — the WebGL shader animates the wave independently
		const id = setInterval(() => {
			if (startRef.current === null) startRef.current = Date.now();
			setWaveColor(computeColor(Date.now() - startRef.current));
		}, 40);

		return () => clearInterval(id);
	}, []);

	return (
		<div
			aria-hidden
			style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit" }}
		>
			<Dither
				colorNum={3}
				disableAnimation={false}
				enableMouseInteraction={false}
				mouseRadius={1}
				pixelSize={2}
				useViewportTransform={false}
				viewportOffset={[0, 0]}
				viewportZoom={1}
				waveAmplitude={0.38}
				waveColor={waveColor}
				waveFrequency={2.8}
				waveSpeed={0.045}
			/>
		</div>
	);
}
