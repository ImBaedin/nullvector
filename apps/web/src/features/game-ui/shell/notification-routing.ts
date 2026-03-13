import type { NotificationDestination } from "@nullvector/backend/runtime/gameplay/notificationsModel";

export function resolveNotificationDestinationPath(destination?: NotificationDestination) {
	if (!destination || destination.kind !== "colonyTab") {
		return null;
	}

	const encodedColonyId = encodeURIComponent(destination.colonyId);
	switch (destination.tab) {
		case "resources":
			return `/game/colony/${encodedColonyId}/resources`;
		case "facilities":
			return `/game/colony/${encodedColonyId}/facilities`;
		case "shipyard":
			return `/game/colony/${encodedColonyId}/shipyard`;
		case "defenses":
			return `/game/colony/${encodedColonyId}/defenses`;
		case "fleet":
			return `/game/colony/${encodedColonyId}/fleet`;
		case "contracts":
			return `/game/colony/${encodedColonyId}/contracts`;
		default:
			return null;
	}
}
