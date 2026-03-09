import { cn } from "@/lib/utils";

type NvProgressProps = {
	className?: string;
	tone?: "danger" | "neutral" | "success" | "warning";
	value: number;
};

const TONE_CLASS = {
	neutral: "bg-[linear-gradient(90deg,#3dd9ff,#5be7ff)]",
	success: "bg-[linear-gradient(90deg,#64f8bb,#9effd1)]",
	warning: "bg-[linear-gradient(90deg,#ffd166,#ffe087)]",
	danger: "bg-[linear-gradient(90deg,#ff6f88,#ff8da2)]",
} as const;

export function NvProgress({ className, value, tone = "neutral" }: NvProgressProps) {
	const bounded = Math.max(0, Math.min(100, value));

	return (
		<div
			className={cn(
				`
      relative h-2.5 w-full overflow-hidden rounded-full
      bg-[rgba(255,255,255,0.08)]
    `,
				className,
			)}
		>
			<div
				className={cn(
					"nv-transition relative h-full overflow-hidden rounded-full",
					TONE_CLASS[tone],
				)}
				style={{ width: `${bounded}%` }}
			>
				<div className="
      nv-progress-stripes absolute inset-0 rounded-[inherit] opacity-65
    " />
				<div className="nv-progress-scan absolute inset-y-0 w-1/3 rounded-[inherit]" />
			</div>
		</div>
	);
}
