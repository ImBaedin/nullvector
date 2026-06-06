import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import "@/features/game-ui/theme";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { Activity } from "react";

import {
	ColonyStarMapPickerProvider,
	useColonyStarMapPicker,
} from "@/features/colony-route/star-map-picker-context";
import { AppHeader } from "@/features/game-ui/header";
import { NvScrollArea } from "@/features/game-ui/primitives/scroll-area";
import {
	HighlightProvider,
	QuestProgressProvider,
	useQuestProgressWatcher,
} from "@/features/game-ui/quests";
import { useColonyLayoutController } from "@/features/game-ui/shell/use-colony-layout-controller";
import { ResearchImmersiveView } from "@/features/research/research-immersive-view";
import { ColonyStarMapLayer } from "@/features/universe-explorer-realdata/components/colony-star-map-layer";
import { ExplorerProvider } from "@/features/universe-explorer-realdata/context/explorer-context";
import { ExplorerQualityProvider } from "@/features/universe-explorer-realdata/context/explorer-quality-context";
import { useConvexAuth } from "@/lib/convex-hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/colony/$colonyId")({
	component: ColonyLayoutRoute,
});

function ColonyLayoutRoute() {
	return (
		<ColonyStarMapPickerProvider>
			<ExplorerQualityProvider>
				<ExplorerProvider>
					<ColonyLayoutContent />
				</ExplorerProvider>
			</ExplorerQualityProvider>
		</ColonyStarMapPickerProvider>
	);
}

function ColonyLayoutContent() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const { pickerRequest } = useColonyStarMapPicker();
	const layout = useColonyLayoutController({
		pickerRequested: Boolean(pickerRequest),
	});
	const isResearchVisible = layout.researchPhase === "open";
	const outletTransitionClass = layout.shouldCollapseContent
		? "pointer-events-none -translate-y-3 opacity-0"
		: "translate-y-0 opacity-100";

	if (isAuthLoading) {
		return null;
	}

	if (!isAuthenticated) {
		return <Navigate to="/" replace />;
	}

	return (
		<QuestProgressProvider activeColonyId={colonyIdAsId}>
			<QuestProgressEffects key={colonyIdAsId} />
			<HighlightProvider>
				<div
					className="relative flex h-dvh flex-col overflow-hidden"
					style={{
						background:
							"linear-gradient(180deg, #15263f 0%, #101c31 18%, #0b1524 40%, #070f1c 60%, #060c15 100%)",
					}}
				>
					<div
						className="
        pointer-events-none absolute inset-0
        bg-[radial-gradient(circle_at_16%_18%,rgba(72,180,255,0.18),transparent_36%),radial-gradient(circle_at_84%_22%,rgba(74,233,255,0.14),transparent_38%)]
      "
					/>

					{layout.activeBackgroundScene === "starMap" ? (
						<ColonyStarMapLayer
							colonyId={colonyIdAsId}
							isAuthenticated={isAuthenticated}
							isOpen={layout.isStarMapOpen}
							onClose={layout.handleCloseStarMap}
						/>
					) : null}

					{layout.isResearchMounted ? (
						<>
							<div
								className={cn(`
          pointer-events-none absolute inset-0 z-15 transition-opacity
          duration-300 ease-out
        `, isResearchVisible ? "opacity-100" : "opacity-0")}
								style={{
									background:
										"linear-gradient(180deg, rgba(5,10,18,0.14) 0%, rgba(5,10,18,0.26) 30%, rgba(3,6,12,0.4) 100%)",
									backdropFilter: isResearchVisible ? "blur(10px) saturate(0.9)" : "blur(0px)",
								}}
							/>
							<div
								className={cn(`
          absolute inset-0 z-20 transition-[opacity,transform] duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]
        `, isResearchVisible ? "translate-y-0 opacity-100" : `
          translate-y-5 opacity-0
        `)}
								style={{
									pointerEvents: layout.isResearchInteractive ? "auto" : "none",
								}}
							>
								<ResearchImmersiveView colonyId={colonyIdAsId} hudInsetTop={92} />
							</div>
						</>
					) : null}

					<AppHeader
						collapseContextNav={layout.shouldCollapseHeaderChrome}
						collapseResources={layout.shouldCollapseHeaderChrome}
						isResearchOpen={layout.isResearchOpen}
						isStarMapOpen={layout.isStarMapOpen}
						onToggleResearch={layout.handleToggleResearch}
						onToggleStarMap={layout.handleToggleStarMap}
					/>

					<div
						className="relative z-10 min-h-0 flex-1 overflow-hidden"
						style={{
							pointerEvents:
								layout.isStarMapOpen || layout.contentPhase !== "visible" ? "none" : "auto",
						}}
					>
						<div
							className={cn(`
         relative h-full transition-[clip-path,opacity,transform] duration-500
         ease-out
       `, outletTransitionClass)}
							style={{
								clipPath: layout.shouldCollapseContent
									? "inset(0 0 100% 0 round 0.5rem)"
									: "inset(0 0 0 0 round 0.5rem)",
							}}
						>
							<NvScrollArea className="h-full overscroll-contain">
								<Activity mode={layout.outletActivityMode}>
									<Outlet />
								</Activity>
							</NvScrollArea>
						</div>
					</div>
				</div>
			</HighlightProvider>
		</QuestProgressProvider>
	);
}

function QuestProgressEffects() {
	useQuestProgressWatcher();
	return null;
}
