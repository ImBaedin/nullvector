import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium nv-transition",
  {
    variants: {
      tone: {
        neutral: "border-[color:var(--nv-glass-stroke)] bg-[rgba(255,255,255,0.05)] text-[color:var(--nv-text-secondary)]",
        info: "border-[color:rgba(126,201,255,0.6)] bg-[rgba(126,201,255,0.16)] text-[color:#d8edff]",
        success: "border-[color:rgba(100,248,187,0.58)] bg-[rgba(100,248,187,0.14)] text-[color:#cdfce8]",
        warning: "border-[color:rgba(255,209,102,0.62)] bg-[rgba(255,209,102,0.16)] text-[color:#fff0be]",
        danger: "border-[color:rgba(255,111,136,0.62)] bg-[rgba(255,111,136,0.18)] text-[color:#ffd8e0]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

type NvBadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function NvBadge({ className, tone, ...props }: NvBadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
