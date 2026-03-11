import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const panelVariants = cva("nv-transition rounded-(--nv-r-lg) border p-4", {
	variants: {
		tone: {
			neutral: `nv-panel-glass border-(--nv-glass-stroke) text-(--nv-text-primary)`,
			info: `
     nv-panel-glass border-[rgba(126,201,255,0.55)] text-(--nv-text-primary)
   `,
			warning: `
     nv-panel-glass border-[rgba(255,209,102,0.5)] text-(--nv-text-primary)
   `,
			danger: `
     border-[rgba(255,111,136,0.62)] bg-[rgba(42,11,22,0.72)]
     text-(--nv-text-primary) shadow-(--nv-glow-orange)
   `,
		},
		density: {
			compact: "p-3",
			comfy: "p-4",
			spacious: "p-5",
		},
	},
	defaultVariants: {
		tone: "neutral",
		density: "comfy",
	},
});

type NvPanelProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof panelVariants>;

export function NvPanel({ className, tone, density, ...props }: NvPanelProps) {
	return <div className={cn(panelVariants({ tone, density }), className)} {...props} />;
}
