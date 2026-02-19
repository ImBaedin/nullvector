import { createFileRoute } from "@tanstack/react-router";

import { GameplayExplorerScene } from "@/features/ui-mockups/components/gameplay-explorer-scene";
import { IconSlot } from "@/features/ui-mockups/components/icon-slot";
import { MockupRouteNav } from "@/features/ui-mockups/components/mockup-route-nav";
import {
  colonies,
  notifications,
  resources,
  transports,
} from "@/features/ui-mockups/lib/mock-data";

export const Route = createFileRoute("/ui-mockups/4")({
  component: UiMockupFourRoute,
});

function UiMockupFourRoute() {
  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_220px] bg-[#071116] text-[#dcf7f6]"
      style={{
        background:
          "linear-gradient(135deg, rgba(25,104,95,0.22) 0%, rgba(7,17,22,1) 34%), radial-gradient(circle at 80% 90%, rgba(66,153,225,0.15), transparent 42%), #071116",
        fontFamily: '"Manrope","Avenir Next","Segoe UI",sans-serif',
      }}
    >
      <header className="border-b border-teal-200/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-teal-100/80">Logistics Grid</p>
            <h1 className="text-3xl font-semibold">Freightline Command</h1>
          </div>
          <MockupRouteNav />
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="relative min-h-[380px] border-b border-teal-200/15 lg:min-h-0 lg:border-b-0 lg:border-r">
          <GameplayExplorerScene
            overlay={(snapshot) => (
              <div className="absolute left-4 top-4 z-30 max-w-[320px] rounded-xl border border-teal-100/25 bg-black/35 px-4 py-3 text-xs backdrop-blur">
                <p className="uppercase tracking-[0.2em] text-teal-100/90">Routing Summary</p>
                <p className="mt-1 text-teal-50">{snapshot.selectedPathLabel}</p>
                <p className="text-teal-50/90">Convoys active: {snapshot.transportLoadEstimate}</p>
                <p className="text-teal-50/90">Visible nodes: {snapshot.visibleEntityCount}</p>
              </div>
            )}
          />
        </main>

        <aside className="min-h-0 p-4 lg:overflow-y-auto">
          <section>
            <h2 className="text-sm uppercase tracking-[0.16em] text-teal-100/85">Cargo Reserves</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {resources.map((resource) => (
                <div className="rounded-lg border border-teal-100/20 bg-teal-100/6 p-3" key={resource.name}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.14em]">{resource.name}</p>
                    <IconSlot label={resource.name} />
                  </div>
                  <p className="mt-1 text-lg font-semibold">{resource.value}</p>
                  <p className="text-xs text-teal-50/75">{resource.rate}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="text-sm uppercase tracking-[0.16em] text-teal-100/85">Hub Colonies</h2>
            <div className="mt-2 space-y-2">
              {colonies.map((colony) => (
                <div className="rounded-lg border border-teal-100/20 bg-teal-100/6 p-3" key={colony.name}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{colony.name}</p>
                    <IconSlot label="hub" />
                  </div>
                  <p className="text-xs text-teal-50/75">{colony.status}</p>
                  <p className="text-xs text-teal-50/75">Queue: {colony.queue}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="grid min-h-0 grid-cols-1 gap-2 border-t border-teal-200/20 bg-black/25 p-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-h-0 rounded-lg border border-teal-200/20 bg-black/35 p-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-teal-100/85">Transport Lines</h2>
          <div className="mt-2 space-y-2">
            {transports.map((transport) => (
              <div className="rounded-md border border-white/20 bg-white/5 p-2 text-xs" key={transport.route}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{transport.from}
                  {" -> "}
                  {transport.to}</p>
                  <p>{transport.eta}</p>
                </div>
                <p>{transport.status} | Cargo {transport.cargo}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 bg-teal-300/85" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0 rounded-lg border border-teal-200/20 bg-black/35 p-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-teal-100/85">Event Feed</h2>
          <div className="mt-2 space-y-1">
            {notifications.map((note) => (
              <div className="rounded border border-white/15 bg-white/5 px-2 py-2 text-xs" key={note.message}>
                <p>{note.message}</p>
                <p className="text-white/65">{note.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
