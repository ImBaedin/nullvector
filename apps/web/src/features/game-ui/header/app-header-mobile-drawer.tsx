import { X } from "lucide-react";

import type { HeaderConfig } from "./header-config";

import { NvBadge, NvButton, NvPanel } from "@/features/game-ui/primitives";

export function AppHeaderMobileDrawer({
  config,
  onClose,
  onOpenStarMap,
  open,
}: {
  config: HeaderConfig;
  onClose: () => void;
  onOpenStarMap?: () => void;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        className="fixed inset-0 z-[var(--nv-z-overlay)] bg-[rgba(2,6,14,0.66)] backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <NvPanel className="fixed inset-y-0 right-0 z-[var(--nv-z-tooltip)] w-[min(88vw,360px)] rounded-none border-y-0 border-r-0 p-3" density="compact">
        <div className="flex items-center justify-between">
          <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">Menu</p>
          <NvButton onClick={onClose} size="icon" variant="ghost">
            <X className="size-4" />
          </NvButton>
        </div>

        <div className="mt-3 space-y-2">
          <NvButton
            className="w-full justify-start"
            onClick={() => {
              onOpenStarMap?.();
              onClose();
            }}
            variant="ghost"
          >
            Star Map
          </NvButton>
          <NvButton className="w-full justify-start" onClick={config.onOpenNotifications} variant="ghost">
            Notifications
            {config.notificationsCount ? (
              <NvBadge className="ml-auto" tone="info">
                {config.notificationsCount}
              </NvBadge>
            ) : null}
          </NvButton>
          <NvButton className="w-full justify-start" onClick={config.onOpenSettings} variant="ghost">
            Settings
          </NvButton>
        </div>

        {config.contextTabs?.length ? (
          <div className="mt-4">
            <p className="nv-caps text-[10px] text-[color:var(--nv-text-muted)]">Colony Views</p>
            <div className="mt-2 grid gap-1">
              {config.contextTabs.map((tab) => (
                <NvButton className="w-full justify-start" key={tab.id} variant="ghost">
                  {tab.label}
                </NvButton>
              ))}
            </div>
          </div>
        ) : null}
      </NvPanel>
    </>
  );
}
