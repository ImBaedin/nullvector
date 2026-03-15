import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type ActionButtonTone = "resource" | "facility" | "shipyard" | "defense";

const TONE_CLASSNAMES: Record<ActionButtonTone, string> = {
	defense:
		"border-rose-200/50 from-rose-400/25 to-rose-400/10 text-rose-50 shadow-[0_0_16px_rgba(251,113,133,0.10)] hover:border-rose-100/70 hover:shadow-[0_0_24px_rgba(251,113,133,0.2)]",
	facility:
		"border-violet-200/50 from-violet-400/25 to-violet-400/10 text-violet-50 shadow-[0_0_20px_rgba(167,139,250,0.12)] hover:-translate-y-0.5 hover:border-violet-100/70 hover:shadow-[0_0_30px_rgba(167,139,250,0.25)]",
	resource:
		"border-amber-200/55 from-amber-200/30 to-amber-400/14 text-amber-50 shadow-[0_0_16px_rgba(255,183,77,0.12)] hover:border-amber-100/80 hover:shadow-[0_0_24px_rgba(255,183,77,0.2)]",
	shipyard:
		"border-cyan-200/50 from-cyan-400/25 to-cyan-400/10 text-cyan-50 shadow-[0_0_16px_rgba(61,217,255,0.10)] hover:border-cyan-100/70 hover:shadow-[0_0_24px_rgba(61,217,255,0.2)]",
};

type ActionButtonProps = ComponentPropsWithoutRef<"button"> & {
	className?: string;
	disabled: boolean;
	durationLabel?: string;
	label: string;
	leadingIcon?: ReactNode;
	loading?: boolean;
	tone: ActionButtonTone;
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
	{
		className,
		disabled,
		durationLabel,
		label,
		leadingIcon,
		loading = false,
		tone,
		type = "button",
		...props
	},
	ref,
) {
	return (
		<button
			{...props}
			className={cn(
				`
      flex items-center justify-center gap-2 rounded-xl border bg-linear-to-b
      px-4 py-2.5 font-(family-name:--nv-font-display) text-xs font-bold
      tracking-[0.08em] uppercase transition-all
      disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/5
      disabled:text-white/30 disabled:shadow-none
    `,
				TONE_CLASSNAMES[tone],
				className,
			)}
			disabled={disabled}
			ref={ref}
			type={type}
		>
			{leadingIcon}
			<span>{loading ? "Queueing..." : label}</span>
			{durationLabel ? (
				<span className="
      font-(family-name:--nv-font-mono) text-[10px] tracking-normal normal-case
      opacity-80
    ">
					{durationLabel}
				</span>
			) : null}
		</button>
	);
});
