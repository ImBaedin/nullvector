import { cn } from "@/lib/utils";

type NvInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function NvInput({ className, ...props }: NvInputProps) {
	return (
		<input
			className={cn(
				`
      nv-transition h-9 w-full rounded-(--nv-r-sm) border
      border-(--nv-glass-stroke) bg-[rgba(5,11,21,0.75)] px-3 text-sm
      text-(--nv-text-primary)
      placeholder:text-(--nv-text-muted)
      focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
      focus-visible:outline-none
    `,
				className,
			)}
			{...props}
		/>
	);
}
