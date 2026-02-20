import { cn } from "@/lib/utils";

type NvTooltipProps = {
  children: React.ReactNode;
  className?: string;
  content: string;
};

export function NvTooltip({ children, content, className }: NvTooltipProps) {
  return (
    <span className={cn("inline-flex", className)} title={content}>
      {children}
    </span>
  );
}
