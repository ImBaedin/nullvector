import { useEffect, useMemo, useState } from "react";

import type { ResourceDatum } from "@/features/game-ui/contracts/navigation";
import type { ResourceBucket, SimulatedColonyResources } from "@/lib/colony-resource-simulation";

import {
	applySimulatedResourcesToHud,
	resourceBucketsFromHudResources,
	simulateColonyResources,
} from "@/lib/colony-resource-simulation";

type SimulationArgs = {
	lastAccruedAt: number | undefined;
	overflow: ResourceBucket | undefined;
	ratesPerMinute: ResourceBucket | undefined;
	storageCaps: ResourceBucket | undefined;
	stored: ResourceBucket | undefined;
};

export function useSimulatedColonyResources(args: SimulationArgs): {
	nowMs: number;
	simulated: SimulatedColonyResources | null;
} {
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		const tick = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);

		return () => {
			window.clearInterval(tick);
		};
	}, []);

	const simulated = useMemo(() => {
		if (
			args.lastAccruedAt === undefined ||
			!args.stored ||
			!args.overflow ||
			!args.ratesPerMinute ||
			!args.storageCaps
		) {
			return null;
		}

		return simulateColonyResources({
			lastAccruedAt: args.lastAccruedAt,
			nowMs,
			overflow: args.overflow,
			ratesPerMinute: args.ratesPerMinute,
			storageCaps: args.storageCaps,
			stored: args.stored,
		});
	}, [
		args.lastAccruedAt,
		args.overflow,
		args.ratesPerMinute,
		args.storageCaps,
		args.stored,
		nowMs,
	]);

	return { nowMs, simulated };
}

export function useSimulatedHudResources(args: {
	lastAccruedAt: number | undefined;
	resources: ResourceDatum[] | undefined;
}) {
	const buckets = useMemo(
		() => (args.resources ? resourceBucketsFromHudResources(args.resources) : null),
		[args.resources],
	);
	const { simulated } = useSimulatedColonyResources({
		lastAccruedAt: args.lastAccruedAt,
		overflow: buckets?.overflow,
		ratesPerMinute: buckets?.ratesPerMinute,
		storageCaps: buckets?.storageCaps,
		stored: buckets?.stored,
	});

	return useMemo(() => {
		if (!args.resources || !simulated) {
			return args.resources;
		}
		return applySimulatedResourcesToHud({
			resources: args.resources,
			simulated,
		});
	}, [args.resources, simulated]);
}
