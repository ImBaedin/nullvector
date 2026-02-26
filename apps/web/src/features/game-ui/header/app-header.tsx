import { Bell, Menu, Settings } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@nullvector/backend/convex/_generated/api";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import { toast } from "sonner";
import type { ResourceDatum } from "@/features/game-ui/contracts/navigation";

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

function formatResourceValue(units: number) {
  if (units >= 1_000_000) {
    return `${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 1_000) {
    return `${(units / 1_000).toFixed(1)}k`;
  }
  return units.toString();
}

function useSimulatedHudResources(resources: ResourceDatum[] | undefined) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const baselineRef = useRef<{
    atMs: number;
    resources: ResourceDatum[];
  } | null>(null);

  const signature = useMemo(() => JSON.stringify(resources ?? []), [resources]);

  useEffect(() => {
    if (!resources) {
      baselineRef.current = null;
      return;
    }

    baselineRef.current = {
      atMs: Date.now(),
      resources,
    };
    setNowMs(Date.now());
  }, [signature]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(tick);
    };
  }, []);

  const baseline = baselineRef.current;
  if (!baseline) {
    return resources;
  }

  const elapsedMinutes = Math.max(0, (nowMs - baseline.atMs) / 60_000);

  return baseline.resources.map((resource) => {
    if (resource.key === "energy") {
      return resource;
    }

    const current = resource.storageCurrentAmount;
    const cap = resource.storageCapAmount;
    const delta = resource.deltaPerMinuteAmount;
    if (current === undefined || cap === undefined || delta === undefined) {
      return resource;
    }

    const nextAmount = Math.min(cap, Math.max(0, Math.floor(current + delta * elapsedMinutes)));
    const nextPercent = cap <= 0 ? 0 : Math.min(100, (nextAmount / cap) * 100);

    return {
      ...resource,
      value: formatResourceValue(nextAmount),
      valueAmount: nextAmount,
      storageCurrentAmount: nextAmount,
      storageCurrentLabel: formatResourceValue(nextAmount),
      storageCapLabel: formatResourceValue(cap),
      storagePercent: nextPercent,
      deltaPerMinute: `+${Math.max(0, Math.floor(delta)).toLocaleString()}/m`,
    };
  });
}

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
  type HeaderHudData = NonNullable<Parameters<typeof getHeaderConfig>[1]>;
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const colonyId = parseColonyId(pathname);
  const colonyIdAsId = colonyId ? (colonyId as Id<"colonies">) : null;
  const renameColony = useMutation(api.gameplay.renameColony);
  const colonyNav = useQuery(
    api.gameplay.getColonyNav,
    colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip"
  );
  const colonyResourceStrip = useQuery(
    api.gameplay.getColonyResourceStrip,
    colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip"
  );
  const colonyQueueSummary = useQuery(
    api.gameplay.getColonyQueueSummary,
    colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip"
  );
  const hud = useMemo<HeaderHudData | undefined>(() => {
    if (!colonyNav || !colonyResourceStrip) {
      return undefined;
    }

    const statusByColonyId = new Map<
      Id<"colonies">,
      "Upgrading" | "Queued" | "Stable"
    >(
      (colonyQueueSummary?.statuses ?? []).map((entry) => [
        entry.colonyId,
        entry.status,
      ])
    );

    return {
      activeColonyId: colonyNav.activeColonyId,
      title: colonyNav.title,
      colonies: colonyNav.colonies.map((colony) => ({
        ...colony,
        status: statusByColonyId.get(colony.id),
      })),
      resources: colonyResourceStrip.resources as ResourceDatum[],
    };
  }, [colonyNav, colonyQueueSummary?.statuses, colonyResourceStrip]);
  const simulatedResources = useSimulatedHudResources(
    hud?.resources ?? colonyResourceStrip?.resources
  );
  const [isRenamingColony, setIsRenamingColony] = useState(false);
  const [isSavingColonyName, setIsSavingColonyName] = useState(false);
  const [draftColonyName, setDraftColonyName] = useState("");
  const config = useMemo(
    () =>
      getHeaderConfig(pathname, hud
        ? {
            activeColonyId: hud.activeColonyId,
            colonies: hud.colonies,
            resources: simulatedResources ?? hud.resources,
            title: hud.title,
          }
        : undefined),
    [hud, pathname, simulatedResources]
  );
  const isCompact = useCompactHeaderMode();
  const activeColony = useMemo(
    () =>
      config.activeColonyId && config.colonies
        ? config.colonies.find((candidate) => candidate.id === config.activeColonyId) ?? null
        : null,
    [config.activeColonyId, config.colonies]
  );
  const headerTitle = useMemo(() => {
    if (activeColony?.name) {
      return activeColony.name;
    }
    return (config.title ?? "Colony Operations").replace(/ Resources$/, "");
  }, [activeColony?.name, config.title]);
  const handleStarMapToggle = onToggleStarMap ?? config.onOpenStarMap;
  const handleColonyChange = (nextColonyId: string) => {
    navigate({
      to: "/game/colony/$colonyId/resources",
      params: { colonyId: nextColonyId },
    });
  };
  const commitColonyRename = async () => {
    if (!activeColony || isSavingColonyName) {
      return;
    }

    const normalizedName = draftColonyName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 3) {
      toast.error("Colony name must be at least 3 characters");
      return;
    }
    if (normalizedName.length > 40) {
      toast.error("Colony name must be 40 characters or fewer");
      return;
    }

    if (normalizedName === activeColony.name) {
      setIsRenamingColony(false);
      return;
    }

    setIsSavingColonyName(true);
    try {
      await renameColony({
        colonyId: activeColony.id as Id<"colonies">,
        name: normalizedName,
      });
      setIsRenamingColony(false);
      toast.success("Colony renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename colony");
    } finally {
      setIsSavingColonyName(false);
    }
  };

  useEffect(() => {
    if (!activeColony) {
      setIsRenamingColony(false);
      setDraftColonyName("");
      return;
    }
    if (!isRenamingColony) {
      setDraftColonyName(activeColony.name);
    }
  }, [activeColony, isRenamingColony]);

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
                  {isRenamingColony && activeColony ? (
                    <input
                      autoFocus
                      className="w-[min(52vw,420px)] rounded-[var(--nv-r-xs)] border border-[color:var(--nv-glass-highlight)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-inherit focus:outline-none"
                      disabled={isSavingColonyName}
                      maxLength={40}
                      onBlur={() => {
                        void commitColonyRename();
                      }}
                      onChange={(event) => {
                        setDraftColonyName(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void commitColonyRename();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setDraftColonyName(activeColony.name);
                          setIsRenamingColony(false);
                        }
                      }}
                      value={draftColonyName}
                    />
                  ) : (
                    <button
                      className="cursor-pointer text-left hover:text-white"
                      disabled={!activeColony}
                      onClick={() => {
                        if (!activeColony) {
                          return;
                        }
                        setDraftColonyName(activeColony.name);
                        setIsRenamingColony(true);
                      }}
                      type="button"
                    >
                      {headerTitle}
                    </button>
                  )}
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
