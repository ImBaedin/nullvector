import { createContext, useCallback, useMemo, useState } from "react";

import type {
  ColonyOption,
  ContextNavItem,
  ResourceDatum,
} from "@/features/game-ui/contracts/navigation";

export type HeaderMode = "game" | "minimal";

export type HeaderConfig = {
  activeColonyId?: string;
  activeTabId?: string;
  colonies?: ColonyOption[];
  contextTabs?: ContextNavItem[];
  mode: HeaderMode;
  notificationsCount?: number;
  onColonyChange?: (colonyId: string) => void;
  onOpenNotifications?: () => void;
  onOpenSettings?: () => void;
  onOpenStarMap?: () => void;
  resources?: ResourceDatum[];
  title?: string;
};

const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  mode: "minimal",
  title: "Nullvector",
};

type HeaderConfigContextValue = {
  config: HeaderConfig;
  resetHeaderConfig: () => void;
  setHeaderConfig: (next: HeaderConfig | ((current: HeaderConfig) => HeaderConfig)) => void;
};

export const HeaderConfigContext = createContext<HeaderConfigContextValue | null>(null);

export function HeaderConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);

  const setHeaderConfig = useCallback(
    (next: HeaderConfig | ((current: HeaderConfig) => HeaderConfig)) => {
      setConfig((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        return {
          ...DEFAULT_HEADER_CONFIG,
          ...resolved,
        };
      });
    },
    []
  );

  const resetHeaderConfig = useCallback(() => {
    setConfig(DEFAULT_HEADER_CONFIG);
  }, []);

  const value = useMemo(
    () => ({
      config,
      resetHeaderConfig,
      setHeaderConfig,
    }),
    [config, resetHeaderConfig, setHeaderConfig]
  );

  return <HeaderConfigContext.Provider value={value}>{children}</HeaderConfigContext.Provider>;
}
