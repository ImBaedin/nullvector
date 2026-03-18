export type ColonyActionTone = "success" | "warning" | "danger" | "neutral" | "info";

export type ColonyActionState =
	| "available"
	| "queued"
	| "active"
	| "locked"
	| "queueFull"
	| "insufficient"
	| "busy"
	| "maxLevel";

export type ColonyActionPresentation = {
	badgeLabel: string;
	badgeTone: ColonyActionTone;
	buttonLabel: string;
	isActionEnabled: boolean;
	lockMessage?: string;
	state: ColonyActionState;
};

type ResourceCost = {
	alloy: number;
	crystal: number;
	fuel: number;
};

type ResourceBucket = {
	alloy: number;
	crystal: number;
	fuel: number;
};

type QueueableBuildActionArgs = {
	actionQuantity: number;
	availableResources: ResourceBucket | null;
	cost: ResourceCost;
	isBusy: boolean;
	isLocked: boolean;
	isQueueFull: boolean;
	lockMessage?: string;
	queuedCount?: number;
};

type UpgradeActionArgs = {
	actionLabel: "Build" | "Upgrade";
	availableResources: ResourceBucket | null;
	cost: ResourceCost;
	hasQueuedItem: boolean;
	isActive: boolean;
	isBusy: boolean;
	isLocked: boolean;
	isMaxLevel: boolean;
	isQueueFull: boolean;
	lockMessage?: string;
};

function canAfford(
	cost: ResourceCost,
	availableResources: ResourceBucket | null,
	quantity = 1,
): boolean {
	if (!availableResources) {
		return false;
	}

	return (
		availableResources.alloy >= cost.alloy * quantity &&
		availableResources.crystal >= cost.crystal * quantity &&
		availableResources.fuel >= cost.fuel * quantity
	);
}

export function getQueueableBuildActionPresentation(
	args: QueueableBuildActionArgs,
): ColonyActionPresentation {
	const normalizedQuantity = Math.max(1, Math.floor(args.actionQuantity));

	if (args.isBusy) {
		return {
			badgeLabel:
				args.queuedCount && args.queuedCount > 0 ? `${args.queuedCount} Queued` : "Queued",
			badgeTone: "info",
			buttonLabel: "Queueing...",
			isActionEnabled: false,
			state: "busy",
		};
	}

	if (args.isLocked) {
		return {
			badgeLabel: "Locked",
			badgeTone: "warning",
			buttonLabel: "Locked",
			isActionEnabled: false,
			lockMessage: args.lockMessage,
			state: "locked",
		};
	}

	if (args.isQueueFull) {
		return {
			badgeLabel: "Queue Full",
			badgeTone: "danger",
			buttonLabel: "Queue Full",
			isActionEnabled: false,
			state: "queueFull",
		};
	}

	const hasRequiredResources = canAfford(args.cost, args.availableResources, normalizedQuantity);
	if (!hasRequiredResources) {
		return {
			badgeLabel: "Need Resources",
			badgeTone: "warning",
			buttonLabel: "Need Resources",
			isActionEnabled: false,
			state: "insufficient",
		};
	}

	if (args.queuedCount && args.queuedCount > 0) {
		return {
			badgeLabel: `${args.queuedCount.toLocaleString()} Queued`,
			badgeTone: "info",
			buttonLabel: `Queue ${normalizedQuantity}`,
			isActionEnabled: true,
			state: "queued",
		};
	}

	return {
		badgeLabel: "Available",
		badgeTone: "success",
		buttonLabel: `Queue ${normalizedQuantity}`,
		isActionEnabled: true,
		state: "available",
	};
}

export function getUpgradeActionPresentation(args: UpgradeActionArgs): ColonyActionPresentation {
	if (args.isBusy) {
		return {
			badgeLabel: args.isActive ? "Upgrading" : args.hasQueuedItem ? "Queued" : "Available",
			badgeTone: args.isActive ? "success" : args.hasQueuedItem ? "info" : "success",
			buttonLabel: "Queueing...",
			isActionEnabled: false,
			state: "busy",
		};
	}

	if (args.isLocked) {
		return {
			badgeLabel: "Locked",
			badgeTone: "warning",
			buttonLabel: "Locked",
			isActionEnabled: false,
			lockMessage: args.lockMessage,
			state: "locked",
		};
	}

	if (args.isMaxLevel) {
		return {
			badgeLabel: "Max Level",
			badgeTone: "neutral",
			buttonLabel: "Max Level",
			isActionEnabled: false,
			state: "maxLevel",
		};
	}

	if (args.isQueueFull) {
		return {
			badgeLabel: "Queue Full",
			badgeTone: "danger",
			buttonLabel: "Queue Full",
			isActionEnabled: false,
			state: "queueFull",
		};
	}

	if (args.isActive) {
		return {
			badgeLabel: "Upgrading",
			badgeTone: "success",
			buttonLabel: args.actionLabel,
			isActionEnabled: true,
			state: "active",
		};
	}

	if (args.hasQueuedItem) {
		return {
			badgeLabel: "Queued",
			badgeTone: "info",
			buttonLabel: args.actionLabel,
			isActionEnabled: true,
			state: "queued",
		};
	}

	const hasRequiredResources = canAfford(args.cost, args.availableResources);
	if (!hasRequiredResources) {
		return {
			badgeLabel: "Need Resources",
			badgeTone: "warning",
			buttonLabel: "Need Resources",
			isActionEnabled: false,
			state: "insufficient",
		};
	}

	return {
		badgeLabel: "Available",
		badgeTone: "success",
		buttonLabel: args.actionLabel,
		isActionEnabled: true,
		state: "available",
	};
}
