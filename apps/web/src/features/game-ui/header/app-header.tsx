import { Bell, Compass, FlaskConical, Menu, Settings, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { QUEST_MODAL_OPEN_EVENT } from "@/features/game-ui/quests/quest-modal-events";
import { useHighlightTarget } from "@/features/game-ui/quests/use-highlight-target";
import { ColonySwitcher } from "@/features/game-ui/shell/colony-switcher";
import { ContextNav } from "@/features/game-ui/shell/context-nav";
import { NotificationsModal } from "@/features/game-ui/shell/notifications-modal";
import { ResourceStrip } from "@/features/game-ui/shell/resource-strip";
import { SettingsModal } from "@/features/game-ui/shell/settings-modal";
import { cn } from "@/lib/utils";

import { AppHeaderMobileDrawer } from "./app-header-mobile-drawer";
import { QuestsModal } from "./quests-modal";
import { ResearchDitherBg } from "./research-dither-bg";
import { useHeaderData } from "./use-header-data";

type AppHeaderProps = {
	collapseContextNav?: boolean;
	collapseResources?: boolean;
	isResearchOpen?: boolean;
	isStarMapOpen?: boolean;
	onToggleResearch?: () => void;
	onToggleStarMap?: () => void;
};

export function AppHeader({
	collapseContextNav = false,
	collapseResources = false,
	isResearchOpen = false,
	isStarMapOpen = false,
	onToggleResearch,
	onToggleStarMap,
}: AppHeaderProps = {}) {
	const header = useHeaderData();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [questsOpen, setQuestsOpen] = useState(false);
	const [focusedQuestId, setFocusedQuestId] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const {
		activeColony,
		activeQuestCount,
		beginColonyRename,
		colonyIdAsId,
		colonySession,
		config,
		commitColonyRename,
		contextTabs,
		drawerConfig: headerDrawerConfig,
		headerTitle,
		isCompact,
		isRenamingColony,
		isSavingColonyName,
		liveNotificationsCount,
		progressionOverview,
		handleColonyChange,
		setIsRenamingColony,
	} = header;
	const handleStarMapToggle = onToggleStarMap ?? config.onOpenStarMap ?? (() => {});
	const handleResearchToggle = onToggleResearch ?? (() => {});
	const starMapHighlight = useHighlightTarget("star-map-button");
	const questButtonHighlight = useHighlightTarget("quest-button");
	const drawerConfig = useMemo(
		() => ({
			...headerDrawerConfig,
			contextTabs,
			notificationsCount: liveNotificationsCount,
			onOpenNotifications: () => setNotificationsOpen(true),
			onOpenResearch: handleResearchToggle,
			onOpenSettings: () => setSettingsOpen(true),
			onOpenStarMap: handleStarMapToggle,
		}),
		[
			contextTabs,
			handleResearchToggle,
			handleStarMapToggle,
			headerDrawerConfig,
			liveNotificationsCount,
		],
	);

	useEffect(() => {
		const handleQuestModalOpen = (event: Event) => {
			const detail = (event as CustomEvent<{ questId?: string }>).detail;
			setFocusedQuestId(detail?.questId ?? null);
			setQuestsOpen(true);
		};

		window.addEventListener(QUEST_MODAL_OPEN_EVENT, handleQuestModalOpen);
		return () => {
			window.removeEventListener(QUEST_MODAL_OPEN_EVENT, handleQuestModalOpen);
		};
	}, []);
	const openQuests = useCallback((questId?: string) => {
		setFocusedQuestId(questId ?? null);
		setQuestsOpen(true);
	}, []);

	if (config.mode !== "game") {
		return null;
	}

	return (
		<>
			<header className={cn(`
     sticky top-0 z-(--nv-z-popover) px-2 pt-2 transition-all duration-200
     lg:px-3
   `, isCompact ? "pb-0.5" : "pb-2")}>
				<div
					className="
       overflow-hidden rounded-xl border border-white/8
       bg-[linear-gradient(170deg,rgba(10,16,28,0.94),rgba(6,10,18,0.98))]
       shadow-[0_4px_20px_rgba(0,0,0,0.4)]
     "
				>
					{/* ═══ Command Bar ═══ */}
					<div className={cn(`
       grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 transition-all
       duration-200
     `, isCompact ? "py-2" : "py-2.5")}>
						{/* Left: logo + colony identity */}
						<div className="flex min-w-0 items-center gap-2 justify-self-start">
							<img alt="Nullvector" className={cn(`
         shrink-0 rounded-md border border-white/10 bg-black/30 object-contain
         p-0.5 transition-all
       `, isCompact ? "size-7" : "size-8")} src="/game-icons/logo.png" />
							{isRenamingColony && activeColony ? (
								<div className="min-w-0">
									<p
										className="
            text-[8px] font-semibold tracking-[0.14em] text-white/25 uppercase
          "
									>
										NullVector
									</p>
									<ColonyRenameInput
										key={`${activeColony.id}:${activeColony.name}`}
										currentName={activeColony.name}
										isSaving={isSavingColonyName}
										onCancel={() => {
											setIsRenamingColony(false);
										}}
										onCommit={commitColonyRename}
									/>
								</div>
							) : config.colonies &&
							  config.activeColonyId &&
							  (config.onColonyChange || handleColonyChange) ? (
								<ColonySwitcher
									activeColonyId={config.activeColonyId}
									colonies={config.colonies}
									isCompact={isCompact}
									onBeginRename={beginColonyRename}
									onColonyChange={config.onColonyChange ?? handleColonyChange}
									variant="identity"
								/>
							) : (
								<div className="min-w-0">
									<p
										className="
            text-[8px] font-semibold tracking-[0.14em] text-white/25 uppercase
          "
									>
										NullVector
									</p>
									<p className={cn(`
           truncate font-(family-name:--nv-font-display) font-bold text-white
           transition-all
         `, isCompact ? "text-sm" : "text-[15px]")}>{headerTitle}</p>
								</div>
							)}
						</div>

						{/* Center: star map + research hero buttons */}
						<div className="flex items-center gap-2 justify-self-center">
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
       `, isCompact ? "h-8" : "h-9", starMapHighlight.highlightProps.className)} onClick={handleStarMapToggle} title={starMapHighlight.highlightProps.title} type="button">
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

							<button className={cn(`
         nv-research-hero relative flex items-center justify-center gap-2
         rounded-lg border px-3.5 font-(family-name:--nv-font-display) text-xs
         font-semibold transition-all
       `, isResearchOpen ? `
         border-emerald-300/40 text-emerald-50
         shadow-[0_0_16px_rgba(52,211,153,0.18)]
       ` : `
         border-white/12 bg-white/4 text-white/60
         hover:border-emerald-300/30 hover:text-emerald-100
       `, isCompact ? "h-8" : "h-9")} onClick={handleResearchToggle} type="button">
								<ResearchDitherBg />
								<FlaskConical
									className="relative z-10 size-3.5"
									style={{
										filter: isResearchOpen
											? "drop-shadow(0 0 6px rgba(52,211,153,0.6))"
											: "drop-shadow(0 1px 6px rgba(0,0,0,0.9))",
									}}
								/>
								<span
									className="relative z-10"
									style={{ textShadow: "0 1px 8px rgba(0,0,0,0.95)" }}
								>
									Research
								</span>
							</button>
						</div>

						{/* Right: colony switcher + utilities (desktop) */}
						<div
							className="
         hidden items-center gap-1.5 justify-self-end
         lg:flex
       "
						>
							{progressionOverview ? (
								<div className="mr-1 flex items-center gap-2 border-r border-white/8 pr-3">
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
												{progressionOverview.displayName}
											</p>
											<p
												className="
              font-(family-name:--nv-font-mono) text-[9px] text-amber-200/50
            "
											>
												Rank {progressionOverview.rank}
											</p>
										</div>
									</div>
									{progressionOverview.nextRankXpRequired ? (
										<div
											className="
             hidden min-w-28
             lg:block
           "
										>
											{(() => {
												const rankXpSpan =
													progressionOverview.xpIntoCurrentRank +
													(progressionOverview.xpToNextRank ?? 0);
												return (
													<>
														<p
															className="
                text-[8px] tracking-[0.12em] text-white/25 uppercase
              "
														>
															XP
														</p>
														<div
															className="
                mt-1 h-1.5 overflow-hidden rounded-full bg-white/8
              "
														>
															<div
																className="
                  h-full rounded-full
                  bg-[linear-gradient(90deg,#fbbf24,#fde68a)]
                "
																style={{
																	width: `${Math.max(
																		0,
																		Math.min(
																			100,
																			progressivePercent({
																				rankXpSpan,
																				xpIntoCurrentRank: progressionOverview.xpIntoCurrentRank,
																			}) ?? 0,
																		),
																	)}%`,
																}}
															/>
														</div>
														<p className="mt-1 text-[8px] text-white/35">
															{progressionOverview.xpIntoCurrentRank.toLocaleString()} /{" "}
															{rankXpSpan.toLocaleString()}
														</p>
													</>
												);
											})()}
										</div>
									) : null}
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
											{progressionOverview.credits.toLocaleString()}
										</span>
										<span className="text-[8px] text-white/25 uppercase">CR</span>
									</div>
								</div>
							) : null}
							<button aria-label="Quests" className={cn(`
         relative flex size-8 items-center justify-center rounded-lg
         text-cyan-300/50 transition-all duration-200
         hover:bg-cyan-400/10 hover:text-cyan-200/90
         hover:shadow-[0_0_8px_rgba(34,211,238,0.15)]
       `, questButtonHighlight.highlightProps.className)} onClick={() => openQuests()} title={questButtonHighlight.highlightProps.title} type="button">
								<Compass className="size-4" />
								{activeQuestCount > 0 ? (
									<span
										className="
            absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center
            justify-center rounded-full bg-cyan-400/25 px-1 text-[8px] font-bold
            text-cyan-100 shadow-[0_0_6px_rgba(34,211,238,0.3)]
          "
									>
										{activeQuestCount}
									</span>
								) : null}
							</button>
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
				onOpenQuests={() => openQuests()}
				onClose={() => setDrawerOpen(false)}
				questCount={activeQuestCount}
				open={drawerOpen}
			/>

			<QuestsModal
				activeColonyId={colonyIdAsId}
				focusQuestId={focusedQuestId}
				onOpenChange={(open) => {
					setQuestsOpen(open);
					if (!open) {
						setFocusedQuestId(null);
					}
				}}
				open={questsOpen}
			/>

			<NotificationsModal
				activeColonyId={colonyIdAsId}
				colonies={(colonySession?.colonies ?? []).map((colony) => ({
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

function progressivePercent(args: { rankXpSpan: number; xpIntoCurrentRank: number }) {
	if (args.rankXpSpan <= 0) {
		return null;
	}

	return (args.xpIntoCurrentRank / args.rankXpSpan) * 100;
}

function ColonyRenameInput(props: {
	currentName: string;
	isSaving: boolean;
	onCancel: () => void;
	onCommit: (nextName: string) => Promise<void> | void;
}) {
	const [draftName, setDraftName] = useState(props.currentName);
	const cancelBlurRef = useRef(false);

	return (
		<input
			autoFocus
			className="
     w-[min(48vw,360px)] rounded-md border border-cyan-300/30 bg-black/40 px-2
     py-0.5 text-inherit outline-none
   "
			disabled={props.isSaving}
			maxLength={40}
			onBlur={() => {
				if (cancelBlurRef.current) {
					cancelBlurRef.current = false;
					return;
				}
				void props.onCommit(draftName);
			}}
			onChange={(event) => {
				setDraftName(event.target.value);
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					void props.onCommit(draftName);
				}
				if (event.key === "Escape") {
					event.preventDefault();
					cancelBlurRef.current = true;
					props.onCancel();
				}
			}}
			value={draftName}
		/>
	);
}
