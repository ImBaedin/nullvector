import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	`
   nv-transition inline-flex items-center justify-center gap-2
   rounded-(--nv-r-sm) border text-sm font-medium
   focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
   focus-visible:outline-none
   disabled:pointer-events-none disabled:opacity-45
 `,
	{
		variants: {
			variant: {
				solid: `
      border-[rgba(61,217,255,0.42)]
      bg-[linear-gradient(170deg,rgba(61,217,255,0.34),rgba(61,217,255,0.12))]
      text-white
      hover:bg-[linear-gradient(170deg,rgba(61,217,255,0.44),rgba(61,217,255,0.16))]
    `,
				ghost: `
      border-(--nv-glass-stroke) bg-[rgba(255,255,255,0.03)]
      text-(--nv-text-secondary)
      hover:bg-[rgba(61,217,255,0.12)] hover:text-white
    `,
				danger: `
      border-[rgba(255,111,136,0.5)] bg-[rgba(255,111,136,0.14)] text-[#ffd4dd]
      hover:bg-[rgba(255,111,136,0.2)]
    `,
				warning: `
      border-[rgba(255,209,102,0.5)] bg-[rgba(255,209,102,0.12)] text-[#ffe9b7]
      hover:bg-[rgba(255,209,102,0.2)]
    `,
			},
			size: {
				xs: "h-7 px-2.5 text-xs",
				sm: "h-8 px-3 text-xs",
				md: "h-9 px-4",
				lg: "h-10 px-4.5",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "ghost",
			size: "md",
		},
	},
);

export type NvButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants>;

export function NvButton({ className, variant, size, ...props }: NvButtonProps) {
	return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
