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
				className="
      nv-transition h-9 w-full appearance-none rounded-(--nv-r-sm) border
      border-(--nv-glass-stroke) bg-[rgba(5,11,21,0.75)] px-3 pr-8
      text-sm text-(--nv-text-primary)
      focus-visible:ring-2 focus-visible:ring-(--nv-focus-ring)
      focus-visible:outline-none
    "
				onChange={(event) => onValueChange?.(event.target.value)}
				value={value}
			>
				{options.map((option) => (
					<option className="bg-(--nv-bg-1)" key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<ChevronDown className="
     pointer-events-none absolute top-2.5 right-2.5 size-4
     text-(--nv-text-muted)
   " />
		</div>
	);
}
