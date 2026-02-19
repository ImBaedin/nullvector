import { createFileRoute } from "@tanstack/react-router";

import { GameplayExplorerScene } from "@/features/ui-mockups/components/gameplay-explorer-scene";
import { IconSlot } from "@/features/ui-mockups/components/icon-slot";
import { MockupRouteNav } from "@/features/ui-mockups/components/mockup-route-nav";
import {
  attacks,
  colonies,
  notifications,
  resources,
  transports,
} from "@/features/ui-mockups/lib/mock-data";

export const Route = createFileRoute("/ui-mockups/2")({
  component: UiMockupTwoRoute,
});

function UiMockupTwoRoute() {
  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]"
      style={{
        background:
          "linear-gradient(180deg, #f8f0df 0%, #efe0c4 55%, #e6d4b4 100%)",
        color: "#2d2018",
        fontFamily: '"Baskerville","Palatino Linotype","Book Antiqua",serif',
      }}
    >
      <header className="border-b border-black/20 bg-[#f6e8ce]/90 px-4 py-3 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.28em] text-amber-950/75">Star Cartographer</p>
        <h1 className="text-3xl leading-tight font-semibold">Interstellar Ledger Table</h1>
        <MockupRouteNav className="mt-2" />
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="min-h-0 border-b border-black/10 bg-[#f5e6cb]/85 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <h2 className="text-sm uppercase tracking-[0.18em]">Resource Ledger</h2>
          <div className="mt-3 space-y-2">
            {resources.map((resource) => (
              <div className="rounded-md border border-black/20 bg-white/35 p-3" key={resource.name}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconSlot label={resource.name} />
                    <p className="font-semibold">{resource.name}</p>
                  </div>
                  <p className="font-semibold">{resource.value}</p>
                </div>
                <p className="mt-1 text-xs text-black/65">{resource.rate}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-5 text-sm uppercase tracking-[0.18em]">Threat Notices</h2>
          <div className="mt-2 space-y-2">
            {attacks.map((attack) => (
              <div className="rounded-md border border-red-900/30 bg-red-100/40 p-3" key={attack.source}>
                <p className="text-sm font-semibold">{attack.source}</p>
                <p className="text-xs">Vector: {attack.vector}</p>
                <p className="text-xs">ETA: {attack.eta}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="relative min-h-[360px] border-y border-black/15 lg:min-h-0 lg:border-x">
          <GameplayExplorerScene
            overlay={(snapshot) => (
              <div className="absolute right-3 top-3 z-30 rounded-md border border-black/20 bg-[#f9edd6]/90 px-3 py-2 text-xs shadow-lg">
                <p className="uppercase tracking-[0.16em] text-black/70">Map Annotation</p>
                <p className="mt-1">Depth: {snapshot.currentLevel}</p>
                <p>Visible: {snapshot.visibleEntityCount}</p>
                <p className="max-w-[220px] truncate">{snapshot.selectedPathLabel}</p>
              </div>
            )}
          />
        </main>

        <aside className="min-h-0 bg-[#f5e6cb]/85 p-4 lg:overflow-y-auto">
          <h2 className="text-sm uppercase tracking-[0.18em]">Colony Registry</h2>
          <div className="mt-3 space-y-2">
            {colonies.map((colony) => (
              <div className="rounded-md border border-black/20 bg-white/35 p-3" key={colony.name}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{colony.name}</p>
                  <IconSlot label="colony" />
                </div>
                <p className="text-xs text-black/70">{colony.status}</p>
                <p className="text-xs text-black/70">Queue: {colony.queue}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-5 text-sm uppercase tracking-[0.18em]">Transit Manifest</h2>
          <div className="mt-2 space-y-2">
            {transports.map((transport) => (
              <div className="rounded-md border border-black/20 bg-white/35 p-3 text-xs" key={transport.route}>
                <p className="font-semibold">{transport.status}</p>
                <p>{transport.from}
                  {" -> "}
                  {transport.to}</p>
                <p>{transport.cargo}</p>
                <p className="text-black/60">ETA {transport.eta}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-5 text-sm uppercase tracking-[0.18em]">History</h2>
          <div className="mt-2 space-y-1">
            {notifications.map((note) => (
              <div className="rounded-md border border-black/15 bg-white/30 px-2 py-2 text-xs" key={note.message}>
                <p>{note.message}</p>
                <p className="text-black/55">{note.time}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
