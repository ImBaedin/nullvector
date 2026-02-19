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

export const Route = createFileRoute("/ui-mockups/3")({
  component: UiMockupThreeRoute,
});

function UiMockupThreeRoute() {
  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] bg-[#050505] text-white"
      style={{ fontFamily: '"IBM Plex Mono","Menlo","Consolas",monospace' }}
    >
      <header className="border-b border-red-500/55 bg-[#120706] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-red-100">Threat Matrix</h1>
          <MockupRouteNav />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-2 border-b border-red-500/35 bg-[#110606] px-3 py-2 md:grid-cols-4">
        {resources.map((resource) => (
          <div className="rounded-md border border-red-400/40 bg-red-500/10 p-2" key={resource.name}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em]">{resource.name}</p>
              <IconSlot label={resource.name} />
            </div>
            <p className="mt-1 text-xl font-semibold text-red-100">{resource.value}</p>
            <p className="text-[11px] text-red-100/70">{resource.rate}</p>
          </div>
        ))}
      </section>

      <div className="grid min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="relative min-h-[380px] border-b border-red-500/30 xl:min-h-0 xl:border-b-0 xl:border-r">
          <GameplayExplorerScene
            overlay={(snapshot) => (
              <div className="absolute left-3 top-3 z-30 rounded-md border border-red-400/50 bg-black/50 px-3 py-2 text-xs">
                <p className="uppercase tracking-[0.14em] text-red-200">Defense Scope</p>
                <p className="mt-1">{snapshot.selectedPathLabel}</p>
                <p>Entities: {snapshot.visibleEntityCount}</p>
                <p>Transit pressure: {snapshot.transportLoadEstimate}</p>
              </div>
            )}
          />
          <div className="pointer-events-none absolute bottom-3 right-3 z-30 rounded border border-red-400/45 bg-black/60 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-red-100">
            Incoming vectors flagged
          </div>
        </main>

        <aside className="min-h-0 bg-[#090303] p-3 xl:overflow-y-auto">
          <section>
            <h2 className="text-xs uppercase tracking-[0.16em] text-red-100/90">Active Warnings</h2>
            <div className="mt-2 space-y-2">
              {attacks.map((attack) => (
                <div className="rounded border border-red-500/45 bg-red-900/30 p-2" key={attack.source}>
                  <p className="text-sm font-semibold">{attack.source}</p>
                  <p className="text-xs">ETA {attack.eta}</p>
                  <p className="text-xs">Threat {attack.threat} via {attack.vector}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-xs uppercase tracking-[0.16em] text-red-100/90">Colony Shield Status</h2>
            <div className="mt-2 space-y-2">
              {colonies.map((colony) => (
                <div className="rounded border border-white/20 bg-white/5 p-2 text-xs" key={colony.name}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{colony.name}</p>
                    <IconSlot label="shield" />
                  </div>
                  <p>{colony.status}</p>
                  <p>Queue: {colony.queue}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-xs uppercase tracking-[0.16em] text-red-100/90">Convoy Monitor</h2>
            <div className="mt-2 space-y-2">
              {transports.map((transport) => (
                <div className="rounded border border-white/20 bg-white/5 p-2 text-xs" key={transport.route}>
                  <p className="font-semibold">{transport.status}</p>
                  <p>{transport.from}
                  {" -> "}
                  {transport.to}</p>
                  <p>{transport.cargo}</p>
                  <p className="text-white/70">ETA {transport.eta}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-xs uppercase tracking-[0.16em] text-red-100/90">Ops History</h2>
            <div className="mt-2 space-y-1">
              {notifications.map((note) => (
                <div className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs" key={note.message}>
                  <p>{note.message}</p>
                  <p className="text-white/60">{note.time}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
