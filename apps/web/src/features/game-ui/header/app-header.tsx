import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { Tooltip } from "@base-ui/react/tooltip";
import { api } from "@nullvector/backend/convex/_generated/api";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Earth, Menu, Settings, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ContextNavItem, ResourceDatum } from "@/features/game-ui/contracts/navigation";
import type { ExplorerQualityPreset } from "@/features/universe-explorer-realdata/types";

import { ColonySwitcher } from "@/features/game-ui/shell/colony-switcher";
import { ContextNav } from "@/features/game-ui/shell/context-nav";
import { NotificationsModal } from "@/features/game-ui/shell/notifications-modal";
import { ResourceStrip } from "@/features/game-ui/shell/resource-strip";
import { SettingsModal } from "@/features/game-ui/shell/settings-modal";
import { useColonyResources } from "@/hooks/use-colony-resources";
import { useConvexAuth, useMutation, useQuery } from "@/lib/convex-hooks";
import { cn } from "@/lib/utils";

import { AppHeaderMobileDrawer } from "./app-header-mobile-drawer";
import { getHeaderConfig, parseColonyId } from "./header-config";

type AppHeaderProps = {
	collapseContextNav?: boolean;
	collapseResources?: boolean;
	isStarMapOpen?: boolean;
	onToggleStarMap?: () => void;
	starMapNavigation?: StarMapHeaderNavigation | null;
};

export type StarMapHeaderNavigation = {
	pathItems: Array<{
		id: string;
		label: string;
		onSelect: () => void;
	}>;
	entityItems: Array<{
		id: string;
		label: string;
		subtitle: string;
	}>;
	levelLabel: string;
	onExit: () => void;
	onSelectEntity: (itemId: string) => void;
	qualityPreset: ExplorerQualityPreset;
	onQualityPresetChange: (preset: ExplorerQualityPreset) => void;
};

const QUALITY_OPTIONS: Array<{
	label: string;
	value: ExplorerQualityPreset;
}> = [
	{ label: "Auto", value: "auto" },
	{ label: "Low", value: "low" },
	{ label: "Medium", value: "medium" },
	{ label: "High", value: "high" },
];

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
	starMapNavigation = null,
}: AppHeaderProps = {}) {
	type HeaderHudData = NonNullable<Parameters<typeof getHeaderConfig>[1]>;
	const navigate = useNavigate();
	const { isAuthenticated } = useConvexAuth();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [starMapEntitiesOpen, setStarMapEntitiesOpen] = useState(false);
	const [starMapQualityOpen, setStarMapQualityOpen] = useState(false);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const colonyId = parseColonyId(pathname);
	const colonyIdAsId = colonyId ? (colonyId as Id<"colonies">) : null;
	const renameColony = useMutation(api.colonyNav.renameColony);
	const colonyNav = useQuery(
		api.colonyNav.getColonyNav,
		colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const allColonyQueueStatuses = useQuery(
		api.colonyNav.getAllColonyQueueStatuses,
		colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const raidStatus = useQuery(
		api.raids.getRaidStatusForColony,
		colonyIdAsId && isAuthenticated ? { colonyId: colonyIdAsId } : "skip",
	);
	const colonyResources = useColonyResources(colonyIdAsId && isAuthenticated ? colonyIdAsId : null);
	const playerProfile = useQuery(
		api.playerProgression.getPlayerProfile,
		isAuthenticated ? {} : "skip",
	);
	const notificationSummary = useQuery(
		api.notifications.getNotificationUnreadSummary,
		isAuthenticated ? {} : "skip",
	);
	const hud = useMemo<HeaderHudData | undefined>(() => {
		if (!colonyNav || !colonyResources.hudResources) {
			return undefined;
		}

		const statusByColonyId = new Map<Id<"colonies">, "Upgrading" | "Queued" | "Stable">(
			(allColonyQueueStatuses?.statuses ?? []).map((entry) => [entry.colonyId, entry.status]),
		);

		return {
			activeColonyId: colonyNav.activeColonyId,
			title: colonyNav.title,
			colonies: colonyNav.colonies.map((colony) => ({
				...colony,
				status: statusByColonyId.get(colony.id),
			})),
			resources: colonyResources.hudResources as ResourceDatum[],
		};
	}, [allColonyQueueStatuses?.statuses, colonyNav, colonyResources.hudResources]);
	const [isRenamingColony, setIsRenamingColony] = useState(false);
	const [isSavingColonyName, setIsSavingColonyName] = useState(false);
	const [draftColonyName, setDraftColonyName] = useState("");
	const config = useMemo(
		() =>
			getHeaderConfig(
				pathname,
				hud
					? {
							activeColonyId: hud.activeColonyId,
							colonies: hud.colonies,
							resources: hud.resources,
							title: hud.title,
						}
					: undefined,
			),
		[hud, pathname],
	);
	const liveNotificationsCount = notificationSummary?.total ?? config.notificationsCount ?? 0;
	const contextTabs = useMemo<ContextNavItem[] | undefined>(() => {
		if (!config.contextTabs) {
			return undefined;
		}
		if (!raidStatus?.activeRaid) {
			return config.contextTabs;
		}

		return config.contextTabs.map((tab) => {
			if (tab.id !== "defenses") {
				return tab;
			}

			return {
				...tab,
				icon: (
					<span className="relative inline-flex shrink-0">
						{tab.icon}
						<span className="
        absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center
      ">
							<span className="
         absolute inline-flex size-2.5 animate-ping rounded-full bg-rose-400/35
       " />
							<span className="
         relative inline-flex size-1.5 rounded-full bg-rose-300
         shadow-[0_0_8px_rgba(253,164,175,0.8)]
       " />
						</span>
					</span>
				),
			};
		});
	}, [config.contextTabs, raidStatus?.activeRaid]);
	const drawerConfig = useMemo(
		() => ({
			...config,
			contextTabs,
			notificationsCount: liveNotificationsCount,
			onOpenNotifications: () => setNotificationsOpen(true),
			onOpenSettings: () => setSettingsOpen(true),
		}),
		[config, contextTabs, liveNotificationsCount],
	);
	const isCompact = useCompactHeaderMode();
	const activeColony = useMemo(
		() =>
			config.activeColonyId && config.colonies
				? (config.colonies.find((candidate) => candidate.id === config.activeColonyId) ?? null)
				: null,
		[config.activeColonyId, config.colonies],
	);
	const headerTitle = useMemo(() => {
		if (activeColony?.name) {
			return activeColony.name;
		}
		return (config.title ?? "Colony Operations").replace(/ Resources$/, "");
	}, [activeColony?.name, config.title]);
	const handleStarMapToggle = onToggleStarMap ?? config.onOpenStarMap;
	const handleColonyChange = (nextColonyId: string) => {
		const targetPath =
			config.activeTabId === "shipyard"
				? "/game/colony/$colonyId/shipyard"
				: config.activeTabId === "defenses"
					? "/game/colony/$colonyId/defenses"
					: config.activeTabId === "fleet"
						? "/game/colony/$colonyId/fleet"
						: config.activeTabId === "contracts"
							? "/game/colony/$colonyId/contracts"
							: config.activeTabId === "facilities"
								? "/game/colony/$colonyId/facilities"
								: "/game/colony/$colonyId/resources";
		navigate({
			to: targetPath,
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
		const error = await renameColony({
				colonyId: activeColony.id as Id<"colonies">,
				name: normalizedName,
			})
				.then(() => null)
				.catch((caughtError) => caughtError);
		setIsSavingColonyName(false);
		if (error) {
			toast.error(error instanceof Error ? error.message : "Failed to rename colony");
		} else {
			setIsRenamingColony(false);
			toast.success("Colony renamed");
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

	useEffect(() => {
		if (!isStarMapOpen || !starMapNavigation) {
			setStarMapEntitiesOpen(false);
			setStarMapQualityOpen(false);
		}
	}, [isStarMapOpen, starMapNavigation]);

	if (config.mode !== "game") {
		return null;
	}

	return (
		<>
			<header className={cn(`
     sticky top-0 z-(--nv-z-popover) px-2 pt-2 transition-all duration-200
     lg:px-3
   `, isCompact ? "pb-0.5" : "pb-2")}>
				<div className={cn(`
      rounded-xl border border-white/8
      bg-[linear-gradient(170deg,rgba(10,16,28,0.94),rgba(6,10,18,0.98))]
      shadow-[0_4px_20px_rgba(0,0,0,0.4)]
    `, isStarMapOpen && starMapNavigation ? "overflow-visible" : `
      overflow-hidden
    `)}>
					{/* ═══ Command Bar ═══ */}
					<div className={cn(`
       grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 transition-all
       duration-200
     `, isCompact ? "py-2" : "py-2.5")}>
						{/* Left: logo + colony name */}
						<div className="flex items-center gap-2.5 justify-self-start">
							<img alt="Nullvector" className={cn(`
         shrink-0 rounded-md border border-white/10 bg-black/30 object-contain
         p-0.5 transition-all
       `, isCompact ? "size-7" : "size-8")} src="/game-icons/logo.png" />
							<div className="min-w-0">
								<p
									className="
           text-[8px] font-semibold tracking-[0.14em] text-white/25 uppercase
         "
								>
									NullVector
								</p>
								<h1 className={cn(`
          font-(family-name:--nv-font-display) font-bold text-white
          transition-all
        `, isCompact ? "text-sm" : "text-[15px]")}>
									{isRenamingColony && activeColony ? (
										<input
											autoFocus
											className="
             w-[min(48vw,360px)] rounded-md border border-cyan-300/30
             bg-black/40 px-2 py-0.5 text-inherit outline-none
           "
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
											className="
             cursor-pointer truncate text-left transition-colors
             hover:text-cyan-100
           "
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

						{/* Center: star map button / navigation */}
						<div
							className={cn(
								"justify-self-center",
								isStarMapOpen && starMapNavigation ? "w-full max-w-[min(62vw,780px)]" : null,
							)}
						>
							{isStarMapOpen && starMapNavigation ? (
								<div className="relative flex items-center gap-2 text-left">
									<Tooltip.Root>
										<Tooltip.Trigger
											className="
             inline-flex size-7 shrink-0 items-center justify-center rounded-md
             border border-white/12 bg-white/4 text-white/50 transition-colors
             hover:bg-white/8 hover:text-white/80
           "
											delay={160}
											onClick={starMapNavigation.onExit}
										>
											<Earth className="size-3.5" />
										</Tooltip.Trigger>
										<Tooltip.Portal>
											<Tooltip.Positioner
												className="z-(--nv-z-tooltip)"
												side="bottom"
												sideOffset={6}
											>
												<Tooltip.Popup
													className="
               rounded-md border border-white/12 bg-[rgba(7,14,28,0.96)] px-2
               py-1 text-[10px] font-medium text-white/80
               shadow-[0_8px_20px_rgba(0,0,0,0.4)]
             "
												>
													Return to colony
												</Tooltip.Popup>
											</Tooltip.Positioner>
										</Tooltip.Portal>
									</Tooltip.Root>

									<span
										className="
            hidden text-[9px] font-semibold tracking-[0.14em] text-cyan-200/50
            uppercase
            lg:inline
          "
									>
										{starMapNavigation.levelLabel}
									</span>

									<div
										className="
            flex min-w-0 items-center gap-0.5 overflow-x-auto text-[11px]
            whitespace-nowrap text-white/70
          "
									>
										{starMapNavigation.pathItems.map((item, index) => (
											<span className="inline-flex items-center gap-0.5" key={item.id}>
												{index > 0 ? <span className="text-white/20">/</span> : null}
												<button
													className="
               rounded-sm px-1 py-0.5 transition-colors
               hover:bg-white/6 hover:text-white
             "
													onClick={item.onSelect}
													type="button"
												>
													{item.label}
												</button>
											</span>
										))}
									</div>

									{/* Entities dropdown */}
									<div className="relative shrink-0">
										<button
											className={cn(`
             inline-flex h-7 items-center gap-1 rounded-md border px-2
             text-[10px] font-semibold transition-all
           `, starMapEntitiesOpen ? `
             border-cyan-300/30 bg-cyan-400/10 text-cyan-100
           ` : `
             border-white/12 bg-white/4 text-white/60
             hover:bg-white/8
           `)}
											onClick={() => {
												setStarMapQualityOpen(false);
												setStarMapEntitiesOpen((current) => !current);
											}}
											type="button"
										>
											Entities ({starMapNavigation.entityItems.length})
											<ChevronDown
												className={cn(
													"size-3 transition-transform",
													starMapEntitiesOpen ? "rotate-180" : null,
												)}
											/>
										</button>

										{starMapEntitiesOpen ? (
											<div
												className="
              absolute top-[calc(100%+6px)] right-0 z-20 w-[min(86vw,400px)]
              rounded-xl border border-white/12 bg-[rgba(8,14,26,0.97)] p-1
              shadow-[0_10px_28px_rgba(0,0,0,0.5)]
            "
											>
												<div className="max-h-56 space-y-0.5 overflow-y-auto">
													{starMapNavigation.entityItems.map((item) => (
														<button
															className="
                 flex w-full items-center justify-between rounded-lg px-2.5
                 py-1.5 text-left text-[11px] text-white/70 transition-colors
                 hover:bg-white/4 hover:text-white
               "
															key={item.id}
															onClick={() => {
																starMapNavigation.onSelectEntity(item.id);
																setStarMapEntitiesOpen(false);
															}}
															type="button"
														>
															<span className="truncate font-semibold">{item.label}</span>
															<span
																className="
                  ml-2 font-(family-name:--nv-font-mono) text-[10px]
                  text-white/25
                "
															>
																{item.subtitle}
															</span>
														</button>
													))}
												</div>
											</div>
										) : null}
									</div>

									{/* Quality dropdown */}
									<div className="relative shrink-0">
										<button
											className={cn(`
             inline-flex h-7 items-center gap-1 rounded-md border px-2
             text-[10px] font-semibold transition-all
           `, starMapQualityOpen ? `
             border-cyan-300/30 bg-cyan-400/10 text-cyan-100
           ` : `
             border-white/12 bg-white/4 text-white/60
             hover:bg-white/8
           `)}
											onClick={() => {
												setStarMapEntitiesOpen(false);
												setStarMapQualityOpen((current) => !current);
											}}
											type="button"
										>
											Quality:{" "}
											{
												QUALITY_OPTIONS.find(
													(entry) => entry.value === starMapNavigation.qualityPreset,
												)?.label
											}
											<ChevronDown
												className={cn(
													"size-3 transition-transform",
													starMapQualityOpen ? "rotate-180" : null,
												)}
											/>
										</button>

										{starMapQualityOpen ? (
											<div
												className="
              absolute top-[calc(100%+6px)] right-0 z-20 w-36 rounded-xl border
              border-white/12 bg-[rgba(8,14,26,0.97)] p-1
              shadow-[0_10px_28px_rgba(0,0,0,0.5)]
            "
											>
												<div className="space-y-0.5">
													{QUALITY_OPTIONS.map((entry) => (
														<button
															className={cn(`
                 flex w-full items-center rounded-lg px-2.5 py-1.5 text-left
                 text-[11px] font-medium transition-colors
               `, entry.value === starMapNavigation.qualityPreset ? `
                 bg-cyan-400/10 text-cyan-100
               ` : `
                 text-white/50
                 hover:bg-white/4 hover:text-white/80
               `)}
															key={entry.value}
															onClick={() => {
																starMapNavigation.onQualityPresetChange(entry.value);
																setStarMapQualityOpen(false);
															}}
															type="button"
														>
															{entry.label}
														</button>
													))}
												</div>
											</div>
										) : null}
									</div>
								</div>
							) : (
								<button className={cn(`
          nv-starmap-hero relative flex items-center justify-center gap-2
          rounded-lg border px-4 font-(family-name:--nv-font-display) text-xs
          font-semibold transition-all
        `, isStarMapOpen ? `
          border-cyan-300/40 bg-cyan-400/12 text-cyan-50
          shadow-[0_0_16px_rgba(61,217,255,0.12)]
        ` : `
          border-white/12 bg-white/4 text-white/60
          hover:border-cyan-300/25 hover:bg-cyan-400/6 hover:text-cyan-100
        `, isCompact ? "h-8" : "h-9")} onClick={handleStarMapToggle} type="button">
									<span className="nv-starmap-stars" />
									<span className="nv-starmap-stars is-slower" />
									<img
										alt="Star map"
										className="
            relative z-10 size-4 object-contain
            drop-shadow-[0_0_6px_rgba(61,217,255,0.4)]
          "
										src="/game-icons/nav/starmap.png"
									/>
									<span className="relative z-10">Star Map</span>
								</button>
							)}
						</div>

						{/* Right: colony switcher + utilities (desktop) */}
						<div
							className="
         hidden items-center gap-1.5 justify-self-end
         lg:flex
       "
						>
							{playerProfile ? (
								<div className="
          mr-1 flex items-center gap-2 border-r border-white/8 pr-3
        ">
									<div className="flex items-center gap-2">
										<div
											className="
             flex size-6 shrink-0 items-center justify-center rounded-md border
             border-amber-300/20 bg-amber-400/8
           "
										>
											<Trophy className="size-3 text-amber-300/70" />
										</div>
										<div className="leading-tight">
											<p className="text-[11px] font-semibold text-white/80">
												{playerProfile.displayName}
											</p>
											<p
												className="
              font-(family-name:--nv-font-mono) text-[9px] text-amber-200/50
            "
											>
												Rank {playerProfile.rank}
											</p>
										</div>
									</div>
									<div
										className="
            flex items-center gap-1 rounded-md border border-white/8 bg-white/3
            px-2 py-1
          "
									>
										<span
											className="
             font-(family-name:--nv-font-mono) text-[10px] font-bold
             text-amber-200/80
           "
										>
											{playerProfile.credits.toLocaleString()}
										</span>
										<span className="text-[8px] text-white/25 uppercase">CR</span>
									</div>
								</div>
							) : null}
							{config.colonies &&
							config.activeColonyId &&
							(config.onColonyChange || handleColonyChange) ? (
								<ColonySwitcher
									activeColonyId={config.activeColonyId}
									colonies={config.colonies}
									onColonyChange={config.onColonyChange ?? handleColonyChange}
								/>
							) : null}
							<button
								aria-label="Notifications"
								className="
          relative flex size-8 items-center justify-center rounded-lg
          text-white/30 transition-colors
          hover:bg-white/4 hover:text-white/60
        "
								onClick={() => setNotificationsOpen(true)}
								type="button"
							>
								<Bell className="size-3.5" />
								{liveNotificationsCount > 0 ? (
									<span
										className="
            absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center
            justify-center rounded-full bg-cyan-400/20 px-1 text-[8px] font-bold
            text-cyan-200
          "
									>
										{liveNotificationsCount}
									</span>
								) : null}
							</button>
							<button
								aria-label="Settings"
								className="
          flex size-8 items-center justify-center rounded-lg text-white/30
          transition-colors
          hover:bg-white/4 hover:text-white/60
        "
								onClick={() => setSettingsOpen(true)}
								type="button"
							>
								<Settings className="size-3.5" />
							</button>
						</div>

						{/* Mobile hamburger */}
						<div
							className="
         flex justify-self-end
         lg:hidden
       "
						>
							<button
								aria-label="Open Menu"
								className="
          flex size-8 items-center justify-center rounded-lg text-white/30
          transition-colors
          hover:bg-white/4 hover:text-white/60
        "
								onClick={() => setDrawerOpen(true)}
								type="button"
							>
								<Menu className="size-4" />
							</button>
						</div>
					</div>

					{/* ═══ Resources ═══ */}
					{config.resources?.length ? (
						<div className={cn(`
        grid overflow-hidden transition-[grid-template-rows,opacity]
        duration-300 ease-out
      `, collapseResources ? "pointer-events-none grid-rows-[0fr] opacity-0" : `
        grid-rows-[1fr] opacity-100
      `)}>
							<div className="min-h-0">
								<div className={cn("border-t border-white/6 px-4", isCompact ? "py-1.5" : `
          py-2
        `)}>
									<ResourceStrip resources={config.resources} />
								</div>
							</div>
						</div>
					) : null}

					{/* ═══ Context Navigation ═══ */}
					{contextTabs?.length && config.activeTabId ? (
						<div className={cn(`
        grid overflow-hidden transition-[grid-template-rows,opacity]
        duration-300 ease-out
      `, collapseContextNav ? "pointer-events-none grid-rows-[0fr] opacity-0" : `
        grid-rows-[1fr] opacity-100
      `)}>
							<div className="min-h-0">
								<div className={cn("border-t border-white/6 px-4", isCompact ? "py-0" : `
          py-0.5
        `)}>
									<ContextNav activeId={config.activeTabId} items={contextTabs} />
								</div>
							</div>
						</div>
					) : null}
				</div>
			</header>

			<AppHeaderMobileDrawer
				config={drawerConfig}
				onOpenStarMap={handleStarMapToggle}
				onClose={() => setDrawerOpen(false)}
				open={drawerOpen}
			/>

			<NotificationsModal
				activeColonyId={colonyIdAsId}
				colonies={(hud?.colonies ?? []).map((colony) => ({
					id: colony.id,
					name: colony.name,
				}))}
				onOpenChange={setNotificationsOpen}
				open={notificationsOpen}
			/>

			<SettingsModal
				activeColonyId={colonyIdAsId}
				onOpenChange={setSettingsOpen}
				open={settingsOpen}
			/>
		</>
	);
}
