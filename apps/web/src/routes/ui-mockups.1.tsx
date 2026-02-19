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

export const Route = createFileRoute("/ui-mockups/1")({
  component: UiMockupOneRoute,
});

function UiMockupOneRoute() {
  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_340px]"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, rgba(0,178,255,0.22), transparent 30%), radial-gradient(circle at 90% 0%, rgba(147,51,234,0.18), transparent 38%), #030913",
        fontFamily: '"Rajdhani","Eurostile","Bank Gothic",sans-serif',
      }}
    >
      <aside className="min-h-0 border-b border-cyan-200/20 bg-slate-950/75 p-4 text-slate-100 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-100/90">Command Deck</p>
        <h1 className="mt-2 text-3xl font-semibold">Colony Operations</h1>
        <MockupRouteNav className="mt-4" />

        <section className="mt-5 space-y-2">
          <h2 className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Colonies</h2>
          {colonies.map((colony) => (
            <div
              className="rounded-lg border border-white/15 bg-white/6 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              key={colony.name}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-white">{colony.name}</p>
                <IconSlot label="colony" />
              </div>
              <p className="text-xs text-cyan-100/85">{colony.status}</p>
              <p className="mt-2 text-xs text-slate-300/90">Queue: {colony.queue}</p>
              <p className="text-xs text-slate-300/90">Threat: {colony.risk}</p>
            </div>
          ))}
        </section>
      </aside>

      <main className="relative min-h-[360px] xl:min-h-0">
        <GameplayExplorerScene
          overlay={(snapshot) => (
            <div className="pointer-events-none absolute left-4 top-3 z-30 rounded-lg border border-cyan-100/25 bg-black/35 px-3 py-2 text-xs text-cyan-50 backdrop-blur">
              <p className="uppercase tracking-[0.2em]">Live Sector Feed</p>
              <p className="mt-1 text-cyan-100/90">Visible Nodes: {snapshot.visibleEntityCount}</p>
              <p>Estimated Colonies: {snapshot.colonyCountEstimate}</p>
            </div>
          )}
        />
      </main>

      <aside className="min-h-0 border-t border-cyan-200/20 bg-slate-950/75 p-4 text-slate-100 xl:overflow-y-auto xl:border-l xl:border-t-0">
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Resources</h2>
          <div className="mt-2 space-y-2">
            {resources.map((resource) => (
              <div
                className="flex items-center justify-between rounded-md border border-white/15 bg-white/6 px-3 py-2"
                key={resource.name}
              >
                <div className="flex items-center gap-2">
                  <IconSlot label={resource.name} />
                  <div>
                    <p className="text-sm font-semibold">{resource.name}</p>
                    <p className="text-xs text-slate-300/80">{resource.rate}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-cyan-100">{resource.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Transports</h2>
          <div className="mt-2 space-y-2">
            {transports.map((transport, index) => (
              <div className="rounded-md border border-white/15 bg-white/6 p-3" key={transport.route}>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-cyan-100/85">NV-{113 + index}</p>
                  <p className="text-xs">{transport.eta}</p>
                </div>
                <p className="mt-1 text-sm font-semibold">{transport.status}</p>
                <p className="text-xs text-slate-300">
                  {transport.from}
                  {" -> "}
                  {transport.to}
                </p>
                <p className="text-xs text-slate-400">{transport.cargo}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-rose-200/85">Incoming Attacks</h2>
          <div className="mt-2 space-y-2">
            {attacks.map((attack) => (
              <div className="rounded-md border border-rose-300/35 bg-rose-500/12 px-3 py-2" key={attack.source}>
                <p className="text-sm font-semibold text-rose-100">{attack.source}</p>
                <p className="text-xs text-rose-50/90">ETA {attack.eta} via {attack.vector}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Notification History</h2>
          <div className="mt-2 space-y-1">
            {notifications.map((note) => (
              <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs" key={note.message}>
                <p className="text-slate-100/90">{note.message}</p>
                <p className="mt-1 text-slate-400">{note.time}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
