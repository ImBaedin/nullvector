import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useConvex } from "convex/react";
import { useEffect, useMemo, useRef } from "react";

type ExplorerLevel = "universe" | "galaxy" | "sector" | "system" | "planet";

const NEXT_LEVEL_PREFETCH_LIMIT = 6;
const MAX_PREFETCHED_PER_TYPE = 64;

function rememberPrefetchedId(cache: Map<string, number>, id: string) {
	cache.set(id, Date.now());
	if (cache.size <= MAX_PREFETCHED_PER_TYPE) {
		return;
	}

	const oldestKey = cache.keys().next().value;
	if (oldestKey) {
		cache.delete(oldestKey);
	}
}

function prefetchBatch<TId extends string>(args: {
	ids: TId[];
	limit: number;
	prefetchedMap: Map<string, number>;
	queriesProvider: (id: TId) => Promise<unknown>[];
}) {
	const idsToPrefetch = args.ids
		.filter((id) => !args.prefetchedMap.has(id))
		.slice(0, args.limit);

	if (idsToPrefetch.length === 0) {
		return;
	}

	void Promise.allSettled(
		idsToPrefetch.map(async (id) => {
			rememberPrefetchedId(args.prefetchedMap, id);
			try {
				await Promise.all(args.queriesProvider(id));
			} catch (error) {
				args.prefetchedMap.delete(id);
				throw error;
			}
		}),
	);
}

export function useExplorerPrefetch(args: {
	level: ExplorerLevel;
	overview?: {
		galaxies: Array<{ id: Id<"galaxies"> }>;
	};
	galaxyData?: {
		sectors: Array<{ id: Id<"sectors"> }>;
	};
	sectorData?: {
		systems: Array<{ id: Id<"systems"> }>;
	};
}) {
	const convex = useConvex();
	const prefetchedIdsRef = useRef({
		galaxy: new Map<string, number>(),
		sector: new Map<string, number>(),
		system: new Map<string, number>(),
	});
	const galaxyIdsKey = useMemo(
		() => (args.overview?.galaxies ?? []).map((galaxy) => galaxy.id).join(","),
		[args.overview?.galaxies],
	);
	const sectorIdsKey = useMemo(
		() => (args.galaxyData?.sectors ?? []).map((sector) => sector.id).join(","),
		[args.galaxyData?.sectors],
	);
	const systemIdsKey = useMemo(
		() => (args.sectorData?.systems ?? []).map((system) => system.id).join(","),
		[args.sectorData?.systems],
	);

	useEffect(() => {
		// Depend on stable id signatures so we don't re-prefetch when callers hand us fresh array instances.
		if (args.level === "universe") {
			prefetchBatch({
				ids: (args.overview?.galaxies ?? []).map((galaxy) => galaxy.id),
				limit: NEXT_LEVEL_PREFETCH_LIMIT,
				prefetchedMap: prefetchedIdsRef.current.galaxy,
				queriesProvider: (galaxyId) => [
					convex.query(api.universeExplorer.getGalaxyHeader, { galaxyId }),
					convex.query(api.universeExplorer.getGalaxySectorList, { galaxyId }),
				],
			});
			return;
		}

		if (args.level === "galaxy") {
			prefetchBatch({
				ids: (args.galaxyData?.sectors ?? []).map((sector) => sector.id),
				limit: NEXT_LEVEL_PREFETCH_LIMIT,
				prefetchedMap: prefetchedIdsRef.current.sector,
				queriesProvider: (sectorId) => [
					convex.query(api.universeExplorer.getSectorHeader, { sectorId }),
					convex.query(api.universeExplorer.getSectorSystemList, { sectorId }),
				],
			});
			return;
		}

		if (args.level !== "sector") {
			return;
		}

		prefetchBatch({
			ids: (args.sectorData?.systems ?? []).map((system) => system.id),
			limit: NEXT_LEVEL_PREFETCH_LIMIT,
			prefetchedMap: prefetchedIdsRef.current.system,
			queriesProvider: (systemId) => [
				convex.query(api.universeExplorer.getSystemPlanetsStatic, { systemId }),
				convex.query(api.universeExplorer.getSystemPlanetsOwnership, { systemId }),
				convex.query(api.universeExplorer.getSystemPlanetsActiveOps, { systemId }),
			],
		});
	}, [
		args.level,
		convex,
		galaxyIdsKey,
		sectorIdsKey,
		systemIdsKey,
	]);
}
