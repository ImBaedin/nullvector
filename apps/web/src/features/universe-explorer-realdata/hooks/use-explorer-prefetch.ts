import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useConvex } from "convex/react";
import { useEffect, useRef } from "react";

type ExplorerLevel = "universe" | "galaxy" | "sector" | "system" | "planet";

const NEXT_LEVEL_PREFETCH_LIMIT = 6;

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
		galaxy: new Set<string>(),
		sector: new Set<string>(),
		system: new Set<string>(),
	});

	useEffect(() => {
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
					await Promise.all([
						convex.query(api.universeExplorer.getGalaxyHeader, { galaxyId }),
						convex.query(api.universeExplorer.getGalaxySectorList, { galaxyId }),
					]);
					prefetchedGalaxyIds.add(galaxyId);
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
					await Promise.all([
						convex.query(api.universeExplorer.getSectorHeader, { sectorId }),
						convex.query(api.universeExplorer.getSectorSystemList, { sectorId }),
					]);
					prefetchedSectorIds.add(sectorId);
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
				await Promise.all([
					convex.query(api.universeExplorer.getSystemPlanetsStatic, { systemId }),
					convex.query(api.universeExplorer.getSystemPlanetsOwnership, { systemId }),
					convex.query(api.universeExplorer.getSystemPlanetsActiveOps, { systemId }),
				]);
				prefetchedSystemIds.add(systemId);
			}),
		);
	}, [
		args.galaxyData?.sectors,
		args.level,
		args.overview?.galaxies,
		args.sectorData?.systems,
		convex,
	]);
}
