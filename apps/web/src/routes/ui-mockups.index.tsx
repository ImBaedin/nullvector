import { createFileRoute } from "@tanstack/react-router";

import { MockupRouteNav } from "@/features/ui-mockups/components/mockup-route-nav";

export const Route = createFileRoute("/ui-mockups/")({
  component: UiMockupsIndexRoute,
});

function UiMockupsIndexRoute() {
  return (
    <div
      className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#163047_0%,#08111a_45%,#03070b_100%)] px-6"
      style={{ fontFamily: '"Rajdhani","Eurostile","Bank Gothic",sans-serif' }}
    >
      <div className="max-w-2xl rounded-2xl border border-cyan-200/30 bg-slate-950/70 p-8 text-slate-100 shadow-[0_30px_120px_rgba(0,0,0,0.5)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/80">Game UI Mockups</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[0.04em]">Universe Operations Variants</h1>
        <p className="mt-3 text-sm text-slate-300/85">
          Six different dashboard concepts using the same explorer canvas and MVP gameplay HUD:
          colonies, resources, transport state, attack indicators, and history.
        </p>
        <MockupRouteNav className="mt-6" />
      </div>
    </div>
  );
}
