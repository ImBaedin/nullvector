import "@/features/game-ui/theme";
import { createFileRoute } from "@tanstack/react-router";

import { ResearchImmersiveView } from "@/features/research/research-immersive-view";

export const Route = createFileRoute("/game/colony/$colonyId/research8")({
	component: Research8,
});

function Research8() {
	return <ResearchImmersiveView />;
}
