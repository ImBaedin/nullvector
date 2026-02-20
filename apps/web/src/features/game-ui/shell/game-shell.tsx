import type {
  AlertDatum,
} from "@/features/game-ui/contracts/navigation";
import {
  NvBadge,
  NvPanel,
  NvScrollArea,
} from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

import { ShellRail } from "./shell-rails";

export type GameShellProps = {
  alerts: AlertDatum[];
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

export function GameShell({
  alerts,
  children,
  rightRail,
}: GameShellProps) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 p-2 pt-0 lg:gap-3 lg:p-3 lg:pt-0">
      <div className="relative z-0 grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[270px_minmax(0,1fr)_320px]">
        <ShellRail title="Alert Queue">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <NvPanel className={cn(alert.severity === "danger" ? "nv-alert-emphasis" : null)} density="compact" key={alert.id} tone={alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "warning" : "info"}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[color:var(--nv-text-primary)]">{alert.message}</p>
                  <NvBadge tone={alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "warning" : "info"}>{alert.severity}</NvBadge>
                </div>
              </NvPanel>
            ))}
          </div>
        </ShellRail>

        <NvPanel className="min-h-0" density="compact">
          <NvScrollArea className="h-full min-h-0">{children}</NvScrollArea>
        </NvPanel>

        <ShellRail title="Telemetry Rail">
          {rightRail ?? (
            <div className="space-y-2">
              <NvPanel density="compact">
                <p className="text-xs text-[color:var(--nv-text-muted)]">Mission Density</p>
                <p className="nv-display mt-1 text-2xl">07</p>
              </NvPanel>
              <NvPanel density="compact">
                <p className="text-xs text-[color:var(--nv-text-muted)]">Dock Queue</p>
                <p className="nv-mono mt-1 text-sm">NV-204, NV-305, NV-311</p>
              </NvPanel>
            </div>
          )}
        </ShellRail>
      </div>
    </div>
  );
}
