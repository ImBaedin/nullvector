/**
 * Renders the Dither component inside a completely separate React root
 * so its R3F Canvas context doesn't collide with React Flow's
 * internal zustand stores.
 */

import { useEffect, useRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";

import Dither from "@/components/Dither";

type DitherProps = ComponentProps<typeof Dither>;

export function IsolatedDither(props: DitherProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rootRef = useRef<Root | null>(null);

	// Mount a separate React root on first render.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const root = createRoot(el);
		rootRef.current = root;

		return () => {
			// Defer unmount to avoid React warnings about sync unmount inside effects.
			setTimeout(() => {
				root.unmount();
			}, 0);
			rootRef.current = null;
		};
	}, []);

	// Re-render the Dither component whenever props change.
	useEffect(() => {
		rootRef.current?.render(<Dither {...props} />);
	}, [props]);

	return (
		<div
			ref={containerRef}
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
		/>
	);
}
