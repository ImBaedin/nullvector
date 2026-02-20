import { useContext } from "react";

import { HeaderConfigContext } from "./header-config-context";

function useHeaderConfigContext() {
  const context = useContext(HeaderConfigContext);
  if (!context) {
    throw new Error("useHeaderConfig must be used within HeaderConfigProvider");
  }
  return context;
}

export function useHeaderConfig() {
  return useHeaderConfigContext().config;
}

export function useSetHeaderConfig() {
  return useHeaderConfigContext().setHeaderConfig;
}

export function useResetHeaderConfig() {
  return useHeaderConfigContext().resetHeaderConfig;
}
