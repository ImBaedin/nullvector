import type { ContextNavItem } from "@/features/game-ui/contracts/navigation";

import { NvTabs } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

type ContextNavProps = {
	activeId: string;
	className?: string;
	items: ContextNavItem[];
};

export function ContextNav({ activeId, className, items }: ContextNavProps) {
	return (
		<div className={cn("h-10", className)}>
			<NvTabs activeId={activeId} items={items} />
		</div>
	);
}
