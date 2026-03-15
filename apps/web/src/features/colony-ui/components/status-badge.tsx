import type { ColonyActionTone } from "@/features/colony-ui/action-state";

import { cn } from "@/lib/utils";

const TONE_CLASSNAMES: Record<ColonyActionTone, string> = {
	danger: "border-rose-300/35 bg-rose-400/10 text-rose-200/80",
	info: "border-cyan-300/30 bg-cyan-400/8 text-cyan-200/80",
	neutral: "border-white/20 bg-white/6 text-white/70",
	success: "border-emerald-300/30 bg-emerald-400/8 text-emerald-200/80",
	warning: "border-amber-300/35 bg-amber-400/10 text-amber-200/80",
};

export function StatusBadge(props: {
	className?: string;
	compact?: boolean;
	label: string;
	tone: ColonyActionTone;
}) {
	return (
		<span
			className={cn(
				`
      inline-flex items-center rounded-md border font-semibold whitespace-nowrap
      uppercase
    `,
				props.compact ? "px-1.5 py-0.5 text-[8px]" : `
      gap-1 px-1.5 py-0.5 text-[9px]
    `,
				TONE_CLASSNAMES[props.tone],
				props.className,
			)}
		>
			{props.label}
		</span>
	);
}
