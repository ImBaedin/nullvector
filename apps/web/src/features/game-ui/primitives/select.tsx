import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type NvSelectOption = {
  label: string;
  value: string;
};

type NvSelectProps = {
  className?: string;
  onValueChange?: (value: string) => void;
  options: NvSelectOption[];
  value: string;
};

export function NvSelect({ className, value, options, onValueChange }: NvSelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-[var(--nv-r-sm)] border border-[color:var(--nv-glass-stroke)] bg-[rgba(5,11,21,0.75)] px-3 pr-8 text-sm text-[color:var(--nv-text-primary)] nv-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nv-focus-ring)]"
        onChange={(event) => onValueChange?.(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option className="bg-[color:var(--nv-bg-1)]" key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-[color:var(--nv-text-muted)]" />
    </div>
  );
}
