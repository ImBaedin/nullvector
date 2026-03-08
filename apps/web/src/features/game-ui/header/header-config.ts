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

function buildPlaceholderTabs(basePaths: {
  facilities: string;
  fleet: string;
  resources: string;
  shipyard: string;
}): ContextNavItem[] {
  return PLACEHOLDER_TAB_IDS.map((id) => ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    to:
      id === "resources"
        ? basePaths.resources
        : id === "facilities"
          ? basePaths.facilities
          : id === "fleet"
            ? basePaths.fleet
          : id === "shipyard"
            ? basePaths.shipyard
          : `/style-lab`,
    icon: createElement("img", {
      alt: `${id} nav icon`,
      className: "h-10 w-10 shrink-0 object-contain",
      src: PLACEHOLDER_TAB_ICON_SRC[id],
    }),
    badgeCount: id === "defenses" ? 1 : undefined,
  }));
}

export function parseColonyId(pathname: string) {
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

type HudData = {
  title: string;
  activeColonyId: string;
  colonies: Array<{
    id: string;
    name: string;
    addressLabel: string;
    status?: string;
  }>;
  resources: Array<{
    key: "alloy" | "crystal" | "fuel" | "energy";
    value: string;
    valueAmount?: number;
    deltaPerMinute?: string;
    deltaPerMinuteAmount?: number;
    overflowAmount?: number;
    overflowLabel?: string;
    pausedByOverflow?: boolean;
    storageCurrentAmount?: number;
    storageCurrentLabel?: string;
    storageCapAmount?: number;
    storageCapLabel?: string;
    storagePercent?: number;
    energyBalance?: number;
  }>;
};

export function getHeaderConfig(pathname: string, hud?: HudData): HeaderConfig {
  const colonyId = parseColonyId(pathname);
  if (!colonyId) {
    return DEFAULT_HEADER_CONFIG;
  }

  const encodedColonyId = encodeURIComponent(colonyId);
  const resourcesPath = `/game/colony/${encodedColonyId}/resources`;
  const facilitiesPath = `/game/colony/${encodedColonyId}/facilties`;
  const fleetPath = `/game/colony/${encodedColonyId}/fleet`;
  const shipyardPath = `/game/colony/${encodedColonyId}/shipyard`;
  const isResourcesRoute = pathname === resourcesPath;
  const isFacilitiesRoute = pathname === facilitiesPath;
  const isFleetRoute = pathname === fleetPath;
  const isShipyardRoute = pathname === shipyardPath;

  if (!hud) {
    return {
      mode: "game",
      title: isResourcesRoute ? `Colony ${colonyId} Resources` : `Colony ${colonyId}`,
      activeTabId: isResourcesRoute
        ? "resources"
        : isFacilitiesRoute
          ? "facilities"
          : isFleetRoute
            ? "fleet"
          : isShipyardRoute
            ? "shipyard"
            : "overview",
      contextTabs: buildPlaceholderTabs({
        facilities: facilitiesPath,
        fleet: fleetPath,
        resources: resourcesPath,
        shipyard: shipyardPath,
      }),
      notificationsCount: 0,
    };
  }

  return {
    mode: "game",
    title: hud.title,
    activeColonyId: hud.activeColonyId,
    activeTabId: isResourcesRoute
      ? "resources"
      : isFacilitiesRoute
        ? "facilities"
        : isFleetRoute
          ? "fleet"
        : isShipyardRoute
          ? "shipyard"
        : "overview",
    colonies: hud.colonies.map((colony) => ({
      id: colony.id,
      name: colony.name,
      addressLabel: colony.addressLabel,
      status: colony.status,
    })),
    contextTabs: buildPlaceholderTabs({
      facilities: facilitiesPath,
      fleet: fleetPath,
      resources: resourcesPath,
      shipyard: shipyardPath,
    }),
    notificationsCount: 0,
    resources: hud.resources,
  };
}
