import { cn } from "@/lib/utils";

type NvDividerProps = React.HTMLAttributes<HTMLHRElement>;

export function NvDivider({ className, ...props }: NvDividerProps) {
  return (
    <hr
      className={cn("border-none bg-[linear-gradient(90deg,transparent,rgba(126,201,255,0.34),transparent)] h-px w-full", className)}
      {...props}
    />
  );
}
