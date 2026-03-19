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
			const prefetchedGalaxyIds = prefetchedIdsRef.current.galaxy;
			const galaxyIdsToPrefetch = (args.overview?.galaxies ?? [])
				.map((galaxy) => galaxy.id)
				.filter((id) => !prefetchedGalaxyIds.has(id))
				.slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

			if (galaxyIdsToPrefetch.length === 0) {
				return;
			}

			void Promise.allSettled(
				galaxyIdsToPrefetch.map(async (galaxyId) => {
					rememberPrefetchedId(prefetchedGalaxyIds, galaxyId);
					try {
						await Promise.all([
							convex.query(api.universeExplorer.getGalaxyHeader, { galaxyId }),
							convex.query(api.universeExplorer.getGalaxySectorList, { galaxyId }),
						]);
					} catch (error) {
						prefetchedGalaxyIds.delete(galaxyId);
						throw error;
					}
				}),
			);
			return;
		}

		if (args.level === "galaxy") {
			const prefetchedSectorIds = prefetchedIdsRef.current.sector;
			const sectorIdsToPrefetch = (args.galaxyData?.sectors ?? [])
				.map((sector) => sector.id)
				.filter((id) => !prefetchedSectorIds.has(id))
				.slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

			if (sectorIdsToPrefetch.length === 0) {
				return;
			}

			void Promise.allSettled(
				sectorIdsToPrefetch.map(async (sectorId) => {
					rememberPrefetchedId(prefetchedSectorIds, sectorId);
					try {
						await Promise.all([
							convex.query(api.universeExplorer.getSectorHeader, { sectorId }),
							convex.query(api.universeExplorer.getSectorSystemList, { sectorId }),
						]);
					} catch (error) {
						prefetchedSectorIds.delete(sectorId);
						throw error;
					}
				}),
			);
			return;
		}

		if (args.level !== "sector") {
			return;
		}

		const prefetchedSystemIds = prefetchedIdsRef.current.system;
		const systemIdsToPrefetch = (args.sectorData?.systems ?? [])
			.map((system) => system.id)
			.filter((id) => !prefetchedSystemIds.has(id))
			.slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

		if (systemIdsToPrefetch.length === 0) {
			return;
		}

		void Promise.allSettled(
			systemIdsToPrefetch.map(async (systemId) => {
				rememberPrefetchedId(prefetchedSystemIds, systemId);
				try {
					await Promise.all([
						convex.query(api.universeExplorer.getSystemPlanetsStatic, { systemId }),
						convex.query(api.universeExplorer.getSystemPlanetsOwnership, { systemId }),
						convex.query(api.universeExplorer.getSystemPlanetsActiveOps, { systemId }),
					]);
				} catch (error) {
					prefetchedSystemIds.delete(systemId);
					throw error;
				}
			}),
		);
	}, [
		args.level,
		convex,
		galaxyIdsKey,
		sectorIdsKey,
		systemIdsKey,
	]);
}
