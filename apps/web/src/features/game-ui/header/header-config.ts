import { createElement } from "react";

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

const PLACEHOLDER_TAB_IDS: Array<ContextNavItem["id"]> = [
	"overview",
	"resources",
	"facilities",
	"shipyard",
	"defenses",
	"fleet",
	"contracts",
];

const PLACEHOLDER_TAB_ICON_SRC: Record<ContextNavItem["id"], string> = {
	overview: "/game-icons/nav/overview.png",
	resources: "/game-icons/nav/resources.png",
	facilities: "/game-icons/nav/facilities.png",
	shipyard: "/game-icons/nav/shipyard.png",
	defenses: "/game-icons/nav/defenses.png",
	fleet: "/game-icons/nav/fleet.png",
	contracts: "/game-icons/nav/contracts.png",
};

function buildPlaceholderTabs(basePaths: {
	contracts: string;
	defenses: string;
	facilities: string;
	fleet: string;
	resources: string;
	shipyard: string;
}): ContextNavItem[] {
	const routeMap: Record<string, string> = {
		resources: basePaths.resources,
		facilities: basePaths.facilities,
		defenses: basePaths.defenses,
		fleet: basePaths.fleet,
		shipyard: basePaths.shipyard,
		contracts: basePaths.contracts,
	};
	return PLACEHOLDER_TAB_IDS.map((id) => ({
		id,
		label: id[0].toUpperCase() + id.slice(1),
		to: routeMap[id] ?? `/style-lab`,
		icon: createElement("img", {
			alt: `${id} nav icon`,
			className: "size-5 shrink-0 object-contain",
			src: PLACEHOLDER_TAB_ICON_SRC[id],
		}),
		isDisabled: id === "overview",
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
	const facilitiesPath = `/game/colony/${encodedColonyId}/facilities`;
	const defensesPath = `/game/colony/${encodedColonyId}/defenses`;
	const fleetPath = `/game/colony/${encodedColonyId}/fleet`;
	const shipyardPath = `/game/colony/${encodedColonyId}/shipyard`;
	const contractsPath = `/game/colony/${encodedColonyId}/contracts`;
	const isResourcesRoute = pathname === resourcesPath;
	const isFacilitiesRoute = pathname === facilitiesPath;
	const isDefensesRoute = pathname === defensesPath;
	const isFleetRoute = pathname === fleetPath;
	const isShipyardRoute = pathname === shipyardPath;
	const isContractsRoute = pathname === contractsPath;

	const activeTabId = isResourcesRoute
		? "resources"
		: isFacilitiesRoute
			? "facilities"
			: isDefensesRoute
				? "defenses"
				: isFleetRoute
					? "fleet"
					: isShipyardRoute
						? "shipyard"
						: isContractsRoute
							? "contracts"
							: "overview";

	const tabPaths = {
		contracts: contractsPath,
		defenses: defensesPath,
		facilities: facilitiesPath,
		fleet: fleetPath,
		resources: resourcesPath,
		shipyard: shipyardPath,
	};

	if (!hud) {
		return {
			mode: "game",
			title: isResourcesRoute ? `Colony ${colonyId} Resources` : `Colony ${colonyId}`,
			activeTabId,
			contextTabs: buildPlaceholderTabs(tabPaths),
			notificationsCount: 0,
		};
	}

	return {
		mode: "game",
		title: hud.title,
		activeColonyId: hud.activeColonyId,
		activeTabId,
		colonies: hud.colonies.map((colony) => ({
			id: colony.id,
			name: colony.name,
			addressLabel: colony.addressLabel,
			status: colony.status,
		})),
		contextTabs: buildPlaceholderTabs(tabPaths),
		notificationsCount: 0,
		resources: hud.resources,
	};
}
