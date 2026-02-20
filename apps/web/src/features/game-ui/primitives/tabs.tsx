import { Link } from "@tanstack/react-router";

import type { ContextNavItem } from "@/features/game-ui/contracts/navigation";
import { cn } from "@/lib/utils";

import { NvBadge } from "./badge";

type NvTabsProps = {
  activeId: string;
  className?: string;
  items: ContextNavItem[];
};

export function NvTabs({ className, activeId, items }: NvTabsProps) {
  return (
    <div className={cn("flex h-full items-stretch justify-center gap-1 overflow-x-auto", className)}>
      {items.map((item) => (
        <Link
          className={cn(
            "inline-flex h-full min-w-[150px] items-center justify-center gap-2 rounded-t-[var(--nv-r-sm)] border border-b-4 px-3 text-xs font-medium nv-transition",
            item.isDisabled
              ? "pointer-events-none border-[color:rgba(255,255,255,0.1)] border-b-transparent bg-[rgba(255,255,255,0.03)] text-[color:var(--nv-text-muted)]"
              : item.id === activeId
                ? "border-[color:rgba(61,217,255,0.5)] border-b-[color:var(--nv-cyan)] bg-[rgba(61,217,255,0.14)] text-[color:#e7faff]"
                : "border-[color:var(--nv-glass-stroke)] border-b-transparent bg-[rgba(255,255,255,0.03)] text-[color:var(--nv-text-secondary)] hover:border-b-[color:rgba(61,217,255,0.45)] hover:bg-[rgba(61,217,255,0.09)] hover:text-white"
          )}
          key={item.id}
          to={item.to}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badgeCount ? (
            <NvBadge className="h-5 min-w-5 justify-center px-1.5 py-0 text-[10px] leading-none" tone="info">
              {item.badgeCount}
            </NvBadge>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
