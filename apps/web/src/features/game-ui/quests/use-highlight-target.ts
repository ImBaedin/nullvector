import type { HighlightTarget } from "@nullvector/game-logic";

import { useHighlightContext } from "./highlight-context";

export function useHighlightTarget(target: HighlightTarget): {
	isHighlighted: boolean;
	hint?: string;
	highlightProps: { className?: string; title?: string };
} {
	const { activeHighlights } = useHighlightContext();
	const highlight = activeHighlights.get(target);
	const isHighlighted = highlight !== undefined;

	return {
		isHighlighted,
		hint: highlight?.hint,
		highlightProps: {
			className: isHighlighted ? "nv-highlight-active" : undefined,
			title: highlight?.hint,
		},
	};
}
