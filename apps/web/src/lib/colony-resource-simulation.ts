import type { ResourceDatum } from "@/features/game-ui/contracts/navigation";

type ResourceKey = "alloy" | "crystal" | "fuel";

export type ResourceBucket = Record<ResourceKey, number>;
export type SimulatedColonyResources = {
	overflow: ResourceBucket;
	stored: ResourceBucket;
};

export function formatResourceValue(units: number) {
	if (units >= 1_000_000) {
		return `${(units / 1_000_000).toFixed(1)}M`;
	}
	if (units >= 1_000) {
		return `${(units / 1_000).toFixed(1)}k`;
	}
	return units.toString();
}

export function resourceBucketsFromHudResources(resources: ResourceDatum[]): {
	overflow: ResourceBucket;
	ratesPerMinute: ResourceBucket;
	storageCaps: ResourceBucket;
	stored: ResourceBucket;
} {
	const getResource = (key: ResourceKey) => resources.find((resource) => resource.key === key);

	return {
		overflow: {
			alloy: getResource("alloy")?.overflowAmount ?? 0,
			crystal: getResource("crystal")?.overflowAmount ?? 0,
			fuel: getResource("fuel")?.overflowAmount ?? 0,
		},
		ratesPerMinute: {
			alloy: getResource("alloy")?.deltaPerMinuteAmount ?? 0,
			crystal: getResource("crystal")?.deltaPerMinuteAmount ?? 0,
			fuel: getResource("fuel")?.deltaPerMinuteAmount ?? 0,
		},
		storageCaps: {
			alloy: getResource("alloy")?.storageCapAmount ?? 0,
			crystal: getResource("crystal")?.storageCapAmount ?? 0,
			fuel: getResource("fuel")?.storageCapAmount ?? 0,
		},
		stored: {
			alloy: getResource("alloy")?.storageCurrentAmount ?? getResource("alloy")?.valueAmount ?? 0,
			crystal:
				getResource("crystal")?.storageCurrentAmount ?? getResource("crystal")?.valueAmount ?? 0,
			fuel: getResource("fuel")?.storageCurrentAmount ?? getResource("fuel")?.valueAmount ?? 0,
		},
	};
}

export function applySimulatedResourcesToHud(args: {
	resources: ResourceDatum[];
	simulated: SimulatedColonyResources;
}) {
	return args.resources.map((resource) => {
		if (resource.key === "energy") {
			return resource;
		}

		const cap = resource.storageCapAmount;
		if (cap === undefined) {
			return resource;
		}

		const nextAmount = args.simulated.stored[resource.key];
		const nextOverflow = args.simulated.overflow[resource.key];
		const nextPercent = cap <= 0 ? 0 : Math.min(100, (nextAmount / cap) * 100);

		return {
			...resource,
			value: formatResourceValue(nextAmount),
			valueAmount: nextAmount,
			storageCurrentAmount: nextAmount,
			storageCurrentLabel: formatResourceValue(nextAmount),
			storageCapLabel: formatResourceValue(cap),
			storagePercent: nextPercent,
			overflowAmount: nextOverflow,
			overflowLabel: formatResourceValue(nextOverflow),
			deltaPerMinute: resource.pausedByOverflow ? "Paused by overflow" : resource.deltaPerMinute,
		};
	});
}

export function simulateColonyResources(args: {
	lastAccruedAt: number;
	nowMs: number;
	overflow: ResourceBucket;
	ratesPerMinute: ResourceBucket;
	stored: ResourceBucket;
	storageCaps: ResourceBucket;
}): SimulatedColonyResources {
	const elapsedMinutes = Math.max(0, (args.nowMs - args.lastAccruedAt) / 60_000);
	const stored = { ...args.stored };
	const overflow = { ...args.overflow };

	for (const resourceKey of ["alloy", "crystal", "fuel"] as const) {
		const headroom = Math.max(0, args.storageCaps[resourceKey] - stored[resourceKey]);
		if (headroom > 0 && overflow[resourceKey] > 0) {
			const transfer = Math.min(headroom, overflow[resourceKey]);
			stored[resourceKey] += transfer;
			overflow[resourceKey] -= transfer;
		}

		const gained = args.ratesPerMinute[resourceKey] * elapsedMinutes;
		stored[resourceKey] = Math.floor(
			Math.min(args.storageCaps[resourceKey], stored[resourceKey] + gained),
		);
	}

	return {
		overflow,
		stored,
	};
}
