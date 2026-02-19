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

export const Route = createFileRoute("/ui-mockups/5")({
  component: UiMockupFiveRoute,
});

function UiMockupFiveRoute() {
  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]"
      style={{
        background:
          "radial-gradient(circle at 10% 15%, rgba(255,141,99,0.35), transparent 28%), radial-gradient(circle at 80% 8%, rgba(98,226,255,0.28), transparent 30%), #121523",
        fontFamily: '"Sora","Trebuchet MS","Segoe UI",sans-serif',
      }}
    >
      <header className="border-b border-white/15 bg-black/20 px-4 py-3 text-white">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/85">Pulse Cockpit</p>
        <h1 className="text-3xl font-semibold">Operator View</h1>
        <MockupRouteNav className="mt-2" />
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="relative min-h-[380px] border-b border-white/15 lg:min-h-0 lg:border-b-0 lg:border-r">
          <GameplayExplorerScene
            overlay={(snapshot) => (
              <div className="absolute left-3 top-3 z-30 rounded-xl border border-white/30 bg-black/45 px-3 py-2 text-xs text-white backdrop-blur">
                <p className="uppercase tracking-[0.18em] text-cyan-100/90">Operator Focus</p>
                <p className="mt-1 max-w-[280px] truncate">{snapshot.selectedPathLabel}</p>
                <p>Managed colonies: {snapshot.colonyCountEstimate}</p>
              </div>
            )}
          />
        </main>

        <aside className="min-h-0 overflow-y-auto p-3 text-white">
          <section className="rounded-2xl border border-white/20 bg-white/10 p-3 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <h2 className="text-xs uppercase tracking-[0.16em] text-cyan-100/85">Resource Rack</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {resources.map((resource) => (
                <div className="rounded-xl border border-white/20 bg-black/20 p-2" key={resource.name}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs">{resource.name}</p>
                    <IconSlot label={resource.name} />
                  </div>
                  <p className="mt-1 text-base font-semibold">{resource.value}</p>
                  <p className="text-[11px] text-white/70">{resource.rate}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <h2 className="text-xs uppercase tracking-[0.16em] text-cyan-100/85">Incoming Threats</h2>
            <div className="mt-2 space-y-2">
              {attacks.map((attack) => (
                <div className="rounded-xl border border-rose-300/40 bg-rose-500/15 p-2" key={attack.source}>
                  <p className="text-sm font-semibold text-rose-50">{attack.source}</p>
                  <p className="text-xs text-rose-50/90">ETA {attack.eta} | {attack.vector}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <h2 className="text-xs uppercase tracking-[0.16em] text-cyan-100/85">Colony Cards</h2>
            <div className="mt-2 space-y-2">
              {colonies.map((colony) => (
                <div className="rounded-xl border border-white/20 bg-black/20 p-2 text-xs" key={colony.name}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{colony.name}</p>
                    <IconSlot label="colony" />
                  </div>
                  <p>{colony.status}</p>
                  <p className="text-white/70">Queue: {colony.queue}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <h2 className="text-xs uppercase tracking-[0.16em] text-cyan-100/85">Transport + History</h2>
            <div className="mt-2 space-y-2">
              {transports.map((transport) => (
                <div className="rounded-lg border border-white/20 bg-black/20 p-2 text-xs" key={transport.route}>
                  <p className="font-semibold">{transport.status} ({transport.eta})</p>
                  <p>{transport.from}
                  {" -> "}
                  {transport.to}</p>
                  <p className="text-white/70">{transport.cargo}</p>
                </div>
              ))}
              {notifications.map((note) => (
                <div className="rounded-lg border border-white/20 bg-black/25 p-2 text-xs" key={note.message}>
                  <p>{note.message}</p>
                  <p className="text-white/65">{note.time}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
