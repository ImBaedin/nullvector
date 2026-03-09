import { Link } from "@tanstack/react-router";

import type { ContextNavItem } from "@/features/game-ui/contracts/navigation";

import { cn } from "@/lib/utils";

type NvTabsProps = {
	activeId: string;
	className?: string;
	items: ContextNavItem[];
};

export function NvTabs({ className, activeId, items }: NvTabsProps) {
	return (
		<div className={cn(`
    flex h-full items-end justify-center gap-0.5 overflow-x-auto
  `, className)}>
			{items.map((item) => (
				<Link
					className={cn(
						`
        group inline-flex items-center gap-1.5 border-b-2 px-3 pt-1.5 pb-2
        text-[11px] font-semibold transition-all
      `,
						item.isDisabled
							? `
         pointer-events-none border-transparent text-white/20
         [&_img]:opacity-30
       `
							: item.id === activeId
								? `
          border-cyan-400/80 text-cyan-50
          [&_img]:opacity-90
        `
								: `
          border-transparent text-white/35
          hover:border-white/15 hover:text-white/60
          [&_img]:opacity-40
          [&_img]:hover:opacity-60
        `,
					)}
					key={item.id}
					to={item.to}
				>
					{item.icon}
					<span>{item.label}</span>
					{item.badgeCount ? (
						<span className="
        flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400/15
        px-1 text-[9px] font-bold text-cyan-200/80
      ">
							{item.badgeCount}
						</span>
					) : null}
				</Link>
			))}
		</div>
	);
}
