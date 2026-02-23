import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ColonyOption } from "@/features/game-ui/contracts/navigation";
import { NvInput } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

type ColonySwitcherProps = {
  activeColonyId: string;
  colonies: ColonyOption[];
  onColonyChange: (colonyId: string) => void;
};

export function ColonySwitcher({
  activeColonyId,
  colonies,
  onColonyChange,
}: ColonySwitcherProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const activeColony = colonies.find((colony) => colony.id === activeColonyId) ?? colonies[0];

  const filteredColonies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return colonies;

    return colonies.filter((colony) => {
      const haystack = [
        colony.name,
        colony.addressLabel,
        colony.details,
        colony.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [colonies, query]);

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(
        420,
        Math.max(300, window.innerWidth - viewportPadding * 2)
      );
      const left = Math.min(
        Math.max(viewportPadding, rect.right - width),
        window.innerWidth - width - viewportPadding
      );
      const top = rect.bottom + 8;

      setMenuStyle({
        left,
        top,
        width,
      });
    };

    const onWindowClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (
        (rootRef.current && rootRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    updateMenuPosition();
    window.addEventListener("mousedown", onWindowClick);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("mousedown", onWindowClick);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const selectColony = (colonyId: string) => {
    onColonyChange(colonyId);
    setIsOpen(false);
    setQuery("");
  };

  const menu = (
    <div
      className="fixed z-[var(--nv-z-tooltip)] overflow-hidden rounded-[var(--nv-r-md)] border border-[color:var(--nv-glass-stroke)] bg-[color:var(--nv-glass-bg-strong)] shadow-[var(--nv-shadow-2)] backdrop-blur-[var(--nv-blur-md)]"
      ref={menuRef}
      style={
        menuStyle
          ? {
              left: menuStyle.left,
              top: menuStyle.top,
              width: menuStyle.width,
            }
          : undefined
      }
    >
      <div className="border-b border-[color:var(--nv-glass-stroke)] p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[color:var(--nv-text-muted)]" />
          <NvInput
            autoFocus
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search colonies"
            value={query}
          />
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {filteredColonies.length > 0 ? (
          filteredColonies.map((colony) => (
            <button
              className="flex w-full items-center justify-between rounded-[var(--nv-r-sm)] px-2 py-2 text-left nv-transition hover:bg-[rgba(61,217,255,0.14)]"
              key={colony.id}
              onClick={() => selectColony(colony.id)}
              type="button"
            >
              <ColonyRow colony={colony} />
              {colony.id === activeColonyId ? (
                <Check className="size-4 shrink-0 text-[color:var(--nv-cyan)]" />
              ) : null}
            </button>
          ))
        ) : (
          <p className="px-2 py-3 text-sm text-[color:var(--nv-text-muted)]">No colonies found.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative z-[var(--nv-z-popover)] min-w-[300px]" ref={rootRef}>
      <button
        className="flex h-11 w-full items-center justify-between rounded-[var(--nv-r-sm)] border border-[color:var(--nv-glass-stroke)] bg-[rgba(5,11,21,0.75)] px-2.5 text-left nv-transition hover:bg-[rgba(61,217,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nv-focus-ring)]"
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {activeColony ? <ColonyRow colony={activeColony} compact /> : <span className="text-sm">Select colony</span>}
        <ChevronDown className={cn("ml-2 size-4 text-[color:var(--nv-text-muted)] nv-transition", isOpen ? "rotate-180" : null)} />
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}

function ColonyRow({ colony, compact = false }: { colony: ColonyOption; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {colony.imageUrl ? (
        <img
          alt={`${colony.name} thumbnail`}
          className={cn("rounded-[var(--nv-r-xs)] border border-[color:var(--nv-glass-highlight)] object-cover", compact ? "h-7 w-7" : "h-8 w-8")}
          src={colony.imageUrl}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-[var(--nv-r-xs)] border border-[color:var(--nv-glass-highlight)] bg-[linear-gradient(150deg,rgba(61,217,255,0.2),rgba(255,145,79,0.2))] text-[10px] font-semibold text-[color:var(--nv-text-primary)]",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
        >
          {colony.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-[color:var(--nv-text-primary)]">{colony.name}</p>
        {compact ? (
          <p className="truncate text-[11px] text-[color:var(--nv-text-muted)]">{colony.addressLabel}</p>
        ) : (
          <p className="truncate text-xs text-[color:var(--nv-text-secondary)]">
            {colony.addressLabel}
            {colony.status ? ` • ${colony.status}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
