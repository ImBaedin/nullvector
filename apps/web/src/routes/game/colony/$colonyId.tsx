import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/features/game-ui/header";
import { ExplorerCanvas } from "@/features/universe-explorer-realdata/components/explorer-canvas";

export const Route = createFileRoute("/game/colony/$colonyId")({
  component: ColonyLayoutRoute,
});

function ColonyLayoutRoute() {
  return (
    <div
      className="relative h-full overflow-y-auto"
      style={{
        background:
          "linear-gradient(180deg, #15263f 0%, #101c31 18%, #0b1524 40%, #070f1c 60%, #060c15 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(72,180,255,0.18),transparent_36%),radial-gradient(circle_at_84%_22%,rgba(74,233,255,0.14),transparent_38%)]" />

      <AppHeader />
      <div className="relative z-0 min-h-full">
        <Outlet />
      </div>
    </div>
  );
}
