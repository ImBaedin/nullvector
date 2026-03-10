import { cn } from "@/lib/utils";

type NvChipProps = React.HTMLAttributes<HTMLDivElement> & {
	accent?: "cyan" | "orange" | "neutral";
};

const ACCENTS = {
	cyan: "border-[color:rgba(61,217,255,0.5)] bg-[rgba(61,217,255,0.12)]",
	orange: "border-[color:rgba(255,145,79,0.5)] bg-[rgba(255,145,79,0.12)]",
	neutral: "border-[color:var(--nv-glass-stroke)] bg-[rgba(255,255,255,0.03)]",
} as const;

export function NvChip({ className, accent = "neutral", ...props }: NvChipProps) {
	return <div className={cn(`
   inline-flex items-center gap-2 rounded-(--nv-r-sm) border px-2.5 py-1 text-xs
   text-(--nv-text-secondary)
 `, ACCENTS[accent], className)} {...props} />;
}
