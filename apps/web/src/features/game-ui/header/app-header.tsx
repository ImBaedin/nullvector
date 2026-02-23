import { Bell, Menu, Settings } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { ContextNav } from "@/features/game-ui/shell/context-nav";
import { ColonySwitcher } from "@/features/game-ui/shell/colony-switcher";
import { ResourceStrip } from "@/features/game-ui/shell/resource-strip";
import { NvBadge, NvIconButton, NvPanel } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

import { AppHeaderMobileDrawer } from "./app-header-mobile-drawer";
import { getHeaderConfig, parseColonyId } from "./header-config";

type AppHeaderProps = {
  collapseContextNav?: boolean;
  collapseResources?: boolean;
  isStarMapOpen?: boolean;
  onToggleStarMap?: () => void;
};

function useCompactHeaderMode() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsCompact(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return isCompact;
}

export function AppHeader({
  collapseContextNav = false,
  collapseResources = false,
  isStarMapOpen = false,
  onToggleStarMap,
}: AppHeaderProps = {}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const colonyId = parseColonyId(pathname);
  const hud = useQuery(
    api.gameplay.getColonyHud,
    colonyId && isAuthenticated
      ? { colonyId: colonyId as Id<"colonies"> }
      : "skip"
  );
  const config = useMemo(
    () =>
      getHeaderConfig(pathname, hud
        ? {
            activeColonyId: hud.activeColonyId,
            colonies: hud.colonies,
            resources: hud.resources,
            title: hud.title,
          }
        : undefined),
    [hud, pathname]
  );
  const isCompact = useCompactHeaderMode();
  const handleStarMapToggle = onToggleStarMap ?? config.onOpenStarMap;
  const handleColonyChange = (nextColonyId: string) => {
    navigate({
      to: "/game/colony/$colonyId/resources",
      params: { colonyId: nextColonyId },
    });
  };

  const notificationsBadge = useMemo(() => {
    if (!config.notificationsCount || config.notificationsCount <= 0) {
      return null;
    }

    return <NvBadge tone="info">{config.notificationsCount}</NvBadge>;
  }, [config.notificationsCount]);

  if (config.mode !== "game") {
    return null;
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-[var(--nv-z-popover)] px-2 pt-2 transition-all duration-200 lg:px-3",
          isCompact ? "pb-1" : "pb-2"
        )}
      >
        <NvPanel
          className="overflow-hidden rounded-b-[var(--nv-r-xl)] border-x-0 border-t-0 p-0"
          density="compact"
        >
          <div
            className={cn(
              "grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-[rgba(255,255,255,0.02)] px-3 transition-all duration-200 lg:px-4",
              isCompact ? "py-2" : "py-3"
            )}
          >
            <div className="flex items-center gap-2 justify-self-start lg:gap-3">
              <img
                alt="Nullvector logo"
                className={cn(
                  "rounded-md border border-[color:var(--nv-glass-highlight)] bg-[rgba(255,255,255,0.05)] object-contain p-1 transition-all",
                  isCompact ? "h-9 w-9" : "h-11 w-11"
                )}
                src="/game-icons/logo.png"
              />
              <div>
                <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
                  NullVector
                </p>
                <h1
                  className={cn(
                    "nv-display font-semibold text-[color:var(--nv-text-primary)] transition-all",
                    isCompact ? "text-base" : "text-xl"
                  )}
                >
                  {config.title ?? "Colony Operations"}
                </h1>
              </div>
            </div>

            <div className="justify-self-center">
              <button
                className={cn(
                  "nv-starmap-hero nv-transition relative flex min-w-[170px] items-center justify-center gap-2 rounded-[var(--nv-r-sm)] border border-[color:rgba(61,217,255,0.42)] bg-[linear-gradient(165deg,rgba(61,217,255,0.18),rgba(61,217,255,0.06))] px-4 font-semibold text-[color:#e9fbff] shadow-[0_0_0_1px_rgba(61,217,255,0.12),0_8px_22px_rgba(4,8,20,0.46)] hover:border-[color:rgba(61,217,255,0.6)]",
                  isStarMapOpen
                    ? "border-[color:rgba(61,217,255,0.74)] shadow-[0_0_0_1px_rgba(61,217,255,0.28),0_10px_24px_rgba(4,8,20,0.56)]"
                    : null,
                  isCompact ? "h-10 text-xs" : "h-12 text-sm"
                )}
                onClick={handleStarMapToggle}
                type="button"
              >
                <span className="nv-starmap-stars" />
                <span className="nv-starmap-stars is-slower" />
                <img
                  alt="Star map icon"
                  className={cn(
                    "relative z-10 object-contain drop-shadow-[0_0_8px_rgba(61,217,255,0.55)]",
                    isCompact ? "h-5 w-5" : "h-6 w-6"
                  )}
                  src="/game-icons/nav/starmap.png"
                />
                <span className="relative z-10">Star Map</span>
              </button>
            </div>

            <div className="hidden items-center gap-2 justify-self-end lg:flex">
              {config.colonies &&
              config.activeColonyId &&
              (config.onColonyChange || handleColonyChange) ? (
                <ColonySwitcher
                  activeColonyId={config.activeColonyId}
                  colonies={config.colonies}
                  onColonyChange={config.onColonyChange ?? handleColonyChange}
                />
              ) : null}
              <NvIconButton
                label="Notifications"
                onClick={config.onOpenNotifications}
                variant="ghost"
              >
                <Bell className="size-4" />
              </NvIconButton>
              {notificationsBadge}
              <NvIconButton
                label="Settings"
                onClick={config.onOpenSettings}
                variant="ghost"
              >
                <Settings className="size-4" />
              </NvIconButton>
            </div>

            <div className="flex justify-self-end lg:hidden">
              <NvIconButton
                label="Open Menu"
                onClick={() => setDrawerOpen(true)}
                variant="ghost"
              >
                <Menu className="size-4" />
              </NvIconButton>
            </div>
          </div>

          {config.resources?.length ? (
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
                collapseResources
                  ? "pointer-events-none grid-rows-[0fr] opacity-0"
                  : "grid-rows-[1fr] opacity-100"
              )}
            >
              <div className="min-h-0">
                <div
                  className={cn(
                    "border-t border-[color:var(--nv-glass-stroke)] bg-[rgba(255,255,255,0.015)] px-3 lg:px-4",
                    isCompact ? "py-1.5" : "py-2"
                  )}
                >
                  <ResourceStrip resources={config.resources} />
                </div>
              </div>
            </div>
          ) : null}

          {config.contextTabs?.length && config.activeTabId ? (
            <div
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out",
                collapseContextNav
                  ? "pointer-events-none grid-rows-[0fr] opacity-0"
                  : "grid-rows-[1fr] opacity-100"
              )}
            >
              <div className="min-h-0">
                <div
                  className={cn(
                    "bg-[rgba(255,255,255,0.01)] px-3 lg:px-4",
                    isCompact ? "py-0" : "py-0.5"
                  )}
                >
                  <ContextNav
                    activeId={config.activeTabId}
                    items={config.contextTabs}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </NvPanel>
      </header>

      <AppHeaderMobileDrawer
        config={config}
        onOpenStarMap={handleStarMapToggle}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      />
    </>
  );
}
