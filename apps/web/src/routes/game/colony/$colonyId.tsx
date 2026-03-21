import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import "@/features/game-ui/theme";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Activity } from "react";

import {
	ColonyStarMapPickerProvider,
	useColonyStarMapPicker,
} from "@/features/colony-route/star-map-picker-context";
import { AppHeader } from "@/features/game-ui/header";
import { HighlightProvider, useQuestProgressWatcher } from "@/features/game-ui/quests";
import { useColonyLayoutController } from "@/features/game-ui/shell/use-colony-layout-controller";
import { ColonyStarMapLayer } from "@/features/universe-explorer-realdata/components/colony-star-map-layer";
import { ExplorerProvider } from "@/features/universe-explorer-realdata/context/explorer-context";
import { useConvexAuth } from "@/lib/convex-hooks";

export const Route = createFileRoute("/game/colony/$colonyId")({
	component: ColonyLayoutRoute,
});

function ColonyLayoutRoute() {
	return (
		<ColonyStarMapPickerProvider>
			<ExplorerProvider>
				<ColonyLayoutContent />
			</ExplorerProvider>
		</ColonyStarMapPickerProvider>
	);
}

function ColonyLayoutContent() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated } = useConvexAuth();
	const { pickerRequest } = useColonyStarMapPicker();
	const layout = useColonyLayoutController({
		pickerRequested: Boolean(pickerRequest),
	});

	useQuestProgressWatcher({ activeColonyId: colonyIdAsId });

	return (
		<HighlightProvider>
			<div
				className="relative h-full overflow-y-auto"
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

				<ColonyStarMapLayer
					colonyId={colonyIdAsId}
					isAuthenticated={isAuthenticated}
					isOpen={layout.isStarMapOpen}
					onClose={layout.handleCloseStarMap}
					onHeaderNavigationChange={layout.handleHeaderNavigationChange}
				/>

				<AppHeader
					collapseContextNav={layout.isStarMapOpen}
					collapseResources={layout.isStarMapOpen}
					isStarMapOpen={layout.isStarMapOpen}
					onToggleStarMap={layout.handleToggleStarMap}
					starMapNavigation={layout.isStarMapOpen ? layout.headerStarMapNavigation : null}
				/>

				<div
					className="relative z-10 min-h-full overflow-hidden"
					style={{
						pointerEvents:
							layout.isStarMapOpen || layout.contentPhase !== "visible" ? "none" : "auto",
					}}
				>
					<div
						className={`
        relative min-h-full transition-[clip-path,opacity,transform]
        duration-500 ease-out
        ${layout.shouldCollapseContent ? `
          pointer-events-none -translate-y-3 opacity-0
        ` : `translate-y-0 opacity-100`}
      `}
						style={{
							clipPath: layout.shouldCollapseContent
								? "inset(0 0 100% 0 round 0.5rem)"
								: "inset(0 0 0 0 round 0.5rem)",
						}}
					>
						<Activity mode={layout.outletActivityMode}>
							<Outlet />
						</Activity>
					</div>
				</div>
			</div>
		</HighlightProvider>
	);
}
