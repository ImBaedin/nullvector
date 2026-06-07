import type { JSX } from "react";

declare module "@/components/Dither" {
	export type DitherProps = {
		colorNum?: number;
		disableAnimation?: boolean;
		enableMouseInteraction?: boolean;
		mouseRadius?: number;
		pixelSize?: number;
		useViewportTransform?: boolean;
		viewportOffset?: [number, number];
		viewportZoom?: number;
		waveAmplitude?: number;
		waveColor?: [number, number, number];
		waveFrequency?: number;
		waveSpeed?: number;
	};

	export default function Dither(props: DitherProps): JSX.Element;
}
