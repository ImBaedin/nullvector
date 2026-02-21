import type {
  ColonyOption,
  ContextNavItem,
  ResourceDatum,
} from "@/features/game-ui/contracts/navigation";
import { createElement } from "react";

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

const PLACEHOLDER_RESOURCES: ResourceDatum[] = [
  {
    key: "alloy",
    value: "143.2k",
    deltaPerMinute: "+394/m",
    storagePercent: 71,
    storageCurrentLabel: "143.2k",
    storageCapLabel: "200k",
  },
  {
    key: "crystal",
    value: "96.5k",
    deltaPerMinute: "+276/m",
    storagePercent: 62,
    storageCurrentLabel: "96.5k",
    storageCapLabel: "155k",
  },
  {
    key: "fuel",
    value: "53.7k",
    deltaPerMinute: "+118/m",
    storagePercent: 41,
    storageCurrentLabel: "53.7k",
    storageCapLabel: "130k",
  },
  {
    key: "energy",
    value: "89%",
    energyDeficit: 48,
  },
];

const PLACEHOLDER_TAB_IDS: Array<ContextNavItem["id"]> = [
  "overview",
  "resources",
  "facilities",
  "shipyard",
  "defenses",
  "fleet",
];

const PLACEHOLDER_TAB_ICON_SRC: Record<ContextNavItem["id"], string> = {
  overview: "/game-icons/nav/overview.png",
  resources: "/game-icons/nav/resources.png",
  facilities: "/game-icons/nav/facilities.png",
  shipyard: "/game-icons/nav/shipyard.png",
  defenses: "/game-icons/nav/defenses.png",
  fleet: "/game-icons/nav/fleet.png",
};

function buildPlaceholderTabs(basePath: string): ContextNavItem[] {
  return PLACEHOLDER_TAB_IDS.map((id) => ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    to: basePath,
    icon: createElement("img", {
      alt: `${id} nav icon`,
      className: "h-10 w-10 shrink-0 object-contain",
      src: PLACEHOLDER_TAB_ICON_SRC[id],
    }),
    badgeCount: id === "defenses" ? 1 : undefined,
  }));
}

function parseColonyId(pathname: string) {
  const match = pathname.match(/^\/game\/colony\/([^/]+)/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function getHeaderConfigPlaceholder(pathname: string): HeaderConfig {
  const colonyId = parseColonyId(pathname);
  if (!colonyId) {
    return DEFAULT_HEADER_CONFIG;
  }

  const encodedColonyId = encodeURIComponent(colonyId);
  const resourcesPath = `/game/colony/${encodedColonyId}/resources`;
  const isResourcesRoute = pathname === resourcesPath;

  return {
    mode: "game",
    title: isResourcesRoute
      ? `Colony ${colonyId} Resources`
      : `Colony ${colonyId}`,
    activeTabId: isResourcesRoute ? "resources" : "overview",
    contextTabs: buildPlaceholderTabs(resourcesPath),
    resources: PLACEHOLDER_RESOURCES,
    notificationsCount: 3,
  };
}
