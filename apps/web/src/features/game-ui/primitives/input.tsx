import { cn } from "@/lib/utils";

type NvInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function NvInput({ className, ...props }: NvInputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[var(--nv-r-sm)] border border-[color:var(--nv-glass-stroke)] bg-[rgba(5,11,21,0.75)] px-3 text-sm text-[color:var(--nv-text-primary)] placeholder:text-[color:var(--nv-text-muted)] nv-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nv-focus-ring)]",
        className
      )}
      {...props}
    />
  );
}
