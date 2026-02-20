import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type {
  ColonyOption,
  ContextNavItem,
} from "@/features/game-ui/contracts/navigation";
import { MEDIA_SLOT_SPECS } from "@/features/game-ui/contracts/media-slots";
import {
  useResetHeaderConfig,
  useSetHeaderConfig,
} from "@/features/game-ui/header";
import {
  NvBadge,
  NvButton,
  NvChip,
  NvDivider,
  NvPanel,
  NvProgress,
  NvTable,
} from "@/features/game-ui/primitives";
import { GameShell } from "@/features/game-ui/shell";
import { GameThemeProvider } from "@/features/game-ui/theme";

export const Route = createFileRoute("/style-lab")({
  component: StyleLabRoute,
});

const colonies: ColonyOption[] = [
  {
    id: "aegis-prime",
    name: "Aegis Prime",
    addressLabel: "G2:S5:SYS3",
    status: "Stable Grid",
    details: "Capital industrial world",
    imageUrl: "/game-icons/alloy.png",
  },
  {
    id: "helion-drift",
    name: "Helion Drift",
    addressLabel: "G2:S4:SYS8",
    status: "Fuel Overflow",
    details: "Refinery-heavy colony",
    imageUrl: "/game-icons/deuterium.png",
  },
  {
    id: "cinder-nest",
    name: "Cinder Nest",
    addressLabel: "G1:S9:SYS2",
    status: "Raid Watch",
    details: "Forward defense outpost",
    imageUrl: "/game-icons/energy.png",
  },
];

const contextTabs: ContextNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/overview.png" alt="Overview" />,
  },
  {
    id: "resources",
    label: "Resources",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/resources.png" alt="Resources" />,
  },
  {
    id: "facilities",
    label: "Facilities",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/facilities.png" alt="Facilities" />,
  },
  {
    id: "shipyard",
    label: "Shipyard",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/shipyard.png" alt="Shipyard" />,
  },
  {
    id: "defenses",
    label: "Defenses",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/defenses.png" alt="Defenses" />,
    badgeCount: 2,
  },
  {
    id: "fleet",
    label: "Fleet",
    to: "/style-lab",
    icon: <NavIcon src="/game-icons/nav/fleet.png" alt="Fleet" />,
  },
];

const sampleResources = [
  {
    key: "alloy" as const,
    value: "127.4k",
    deltaPerMinute: "+412/m",
    storagePercent: 72,
    storageCurrentLabel: "127.4k",
    storageCapLabel: "176k",
  },
  {
    key: "crystal" as const,
    value: "82.9k",
    deltaPerMinute: "+259/m",
    storagePercent: 58,
    storageCurrentLabel: "82.9k",
    storageCapLabel: "143k",
  },
  {
    key: "fuel" as const,
    value: "41.2k",
    deltaPerMinute: "+148/m",
    storagePercent: 34,
    storageCurrentLabel: "41.2k",
    storageCapLabel: "121k",
  },
  {
    key: "energy" as const,
    value: "74%",
    energyDeficit: 120,
  },
];

function StyleLabRoute() {
  const [activeColonyId, setActiveColonyId] = useState("aegis-prime");
  const setHeaderConfig = useSetHeaderConfig();
  const resetHeaderConfig = useResetHeaderConfig();

  useEffect(() => {
    setHeaderConfig({
      mode: "game",
      title: "Style Lab",
      activeColonyId,
      colonies,
      onColonyChange: setActiveColonyId,
      activeTabId: "overview",
      contextTabs,
      resources: sampleResources,
      notificationsCount: 2,
    });

    return () => {
      resetHeaderConfig();
    };
  }, [activeColonyId, resetHeaderConfig, setHeaderConfig]);

  return (
    <GameThemeProvider className="h-full min-h-0 overflow-hidden">
      <GameShell
        alerts={[
          {
            id: "a1",
            message: "Incoming attack signature near Cinder Nest",
            severity: "danger",
          },
          {
            id: "a2",
            message: "Fuel overflow paused refinery on Helion Drift",
            severity: "warning",
          },
          {
            id: "a3",
            message: "Transport NV-311 docked successfully",
            severity: "info",
          },
        ]}
      >
        <div className="space-y-3 p-1">
          <section className="grid gap-3 lg:grid-cols-2">
            <NvPanel>
              <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
                Buttons + Badges
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <NvButton variant="solid">Primary Action</NvButton>
                <NvButton variant="ghost">Secondary</NvButton>
                <NvButton variant="warning">Queue Upgrade</NvButton>
                <NvButton variant="danger">Abort Fleet</NvButton>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <NvBadge tone="info">info</NvBadge>
                <NvBadge tone="success">success</NvBadge>
                <NvBadge tone="warning">warning</NvBadge>
                <NvBadge tone="danger">danger</NvBadge>
              </div>
            </NvPanel>

            <NvPanel>
              <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
                Chips + Progress
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <NvChip accent="cyan">Crystal +259/m</NvChip>
                <NvChip accent="orange">Fuel +148/m</NvChip>
                <NvChip accent="neutral">Energy Balanced</NvChip>
              </div>
              <div className="mt-3 space-y-2">
                <NvProgress tone="neutral" value={42} />
                <NvProgress tone="warning" value={76} />
                <NvProgress tone="danger" value={91} />
              </div>
            </NvPanel>
          </section>

          <NvPanel>
            <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
              Data Table
            </p>
            <div className="mt-3">
              <NvTable>
                <thead>
                  <tr>
                    <th>Transport</th>
                    <th>Status</th>
                    <th>Route</th>
                    <th>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>NV-204</td>
                    <td>
                      <NvBadge tone="info">In Transit</NvBadge>
                    </td>
                    <td>G2:S4:SYS8 -&gt; G2:S5:SYS3</td>
                    <td className="nv-mono">03:12</td>
                  </tr>
                  <tr>
                    <td>NV-311</td>
                    <td>
                      <NvBadge tone="warning">Launching</NvBadge>
                    </td>
                    <td>G2:S2:SYS5 -&gt; G2:S5:SYS3</td>
                    <td className="nv-mono">11:44</td>
                  </tr>
                </tbody>
              </NvTable>
            </div>
          </NvPanel>

          <NvPanel>
            <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">
              Media Slot Contracts
            </p>
            <NvDivider className="my-3" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.values(MEDIA_SLOT_SPECS).map((spec) => (
                <NvPanel
                  className="bg-[rgba(255,255,255,0.03)]"
                  density="compact"
                  key={spec.slot}
                >
                  <p className="text-sm font-semibold">{spec.slot}</p>
                  <p className="mt-1 text-xs text-[color:var(--nv-text-muted)]">
                    Ratio {spec.ratio}
                  </p>
                  <p className="text-xs text-[color:var(--nv-text-muted)]">
                    Min {spec.minWidth}x{spec.minHeight}
                  </p>
                  <p className="text-xs text-[color:var(--nv-text-muted)]">
                    Fallback: {spec.fallback}
                  </p>
                  <div className="nv-loading-sweep mt-2 h-16 rounded-[var(--nv-r-sm)] border border-[color:var(--nv-glass-stroke)]" />
                </NvPanel>
              ))}
            </div>
          </NvPanel>
        </div>
      </GameShell>
    </GameThemeProvider>
  );
}

function NavIcon({ alt, src }: { alt: string; src: string }) {
  return (
    <img
      alt={`${alt} nav icon`}
      className="h-10 w-10 shrink-0 object-contain"
      src={src}
    />
  );
}
