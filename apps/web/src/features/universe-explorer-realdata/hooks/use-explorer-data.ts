import { api } from "@nullvector/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";

import type { RenderableEntity } from "../types";

import { useExplorerContext } from "../context/explorer-context";
import { useExplorerPrefetch } from "./use-explorer-prefetch";
import { computeOrbitWorldPosition } from "../lib/orbits";

const GALAXY_RADIUS = 500;
const SECTOR_RADIUS = 46;
const SYSTEM_RADIUS = 16;
const PLANET_RADIUS = 6;

export function useExplorerData() {
	const explorer = useExplorerContext();

	const overview = useQuery(api.universeExplorer.getUniverseExplorerOverview, {});

	const galaxyHeader = useQuery(
		api.universeExplorer.getGalaxyHeader,
		explorer.path.galaxyId ? { galaxyId: explorer.path.galaxyId } : "skip",
	);
	const galaxySectorList = useQuery(
		api.universeExplorer.getGalaxySectorList,
		explorer.path.galaxyId ? { galaxyId: explorer.path.galaxyId } : "skip",
	);

	const sectorHeader = useQuery(
		api.universeExplorer.getSectorHeader,
		explorer.path.sectorId ? { sectorId: explorer.path.sectorId } : "skip",
	);
	const sectorSystemList = useQuery(
		api.universeExplorer.getSectorSystemList,
		explorer.path.sectorId ? { sectorId: explorer.path.sectorId } : "skip",
	);

	const systemStatic = useQuery(
		api.universeExplorer.getSystemPlanetsStatic,
		explorer.path.systemId ? { systemId: explorer.path.systemId } : "skip",
	);
	const systemOwnership = useQuery(
		api.universeExplorer.getSystemPlanetsOwnership,
		explorer.path.systemId ? { systemId: explorer.path.systemId } : "skip",
	);
	const systemActiveOps = useQuery(
		api.universeExplorer.getSystemPlanetsActiveOps,
		explorer.path.systemId ? { systemId: explorer.path.systemId } : "skip",
	);

	const galaxyData = useMemo(() => {
		if (!galaxyHeader || !galaxySectorList) {
			return undefined;
		}
		return {
			universe: galaxyHeader.universe,
			galaxy: galaxyHeader.galaxy,
			sectors: galaxySectorList.sectors,
		};
	}, [galaxyHeader, galaxySectorList]);

	const sectorData = useMemo(() => {
		if (!sectorHeader || !sectorSystemList) {
			return undefined;
		}
		return {
			universe: sectorHeader.universe,
			galaxy: sectorHeader.galaxy,
			sector: sectorHeader.sector,
			systems: sectorSystemList.systems,
		};
	}, [sectorHeader, sectorSystemList]);

	const systemData = useMemo(() => {
		if (!systemStatic || !systemOwnership || !systemActiveOps) {
			return undefined;
		}

		const ownershipByPlanetId = new Map(
			systemOwnership.planets.map((entry) => [entry.id, entry.colony]),
		);
		const activeOpsByPlanetId = new Map(
			systemActiveOps.planets.map((entry) => [entry.id, entry.activeOperation]),
		);

		return {
			universe: systemStatic.context.universe,
			galaxy: systemStatic.context.galaxy,
			sector: systemStatic.context.sector,
			system: systemStatic.context.system,
			planets: systemStatic.planets.map((planet) => ({
				...planet,
				colony: ownershipByPlanetId.get(planet.id),
				activeOperation: activeOpsByPlanetId.get(planet.id),
			})),
		};
	}, [systemActiveOps, systemOwnership, systemStatic]);

	const galaxyEntities = useMemo<RenderableEntity[]>(() => {
		if (!overview) {
			return [];
		}

		return overview.galaxies.map((galaxy) => ({
			id: `galaxy:${galaxy.id}`,
			sourceId: galaxy.id,
			entityType: "galaxy",
			name: galaxy.displayName,
			addressLabel: galaxy.addressLabel,
			x: galaxy.worldX,
			y: galaxy.worldY,
			sphereRadius: GALAXY_RADIUS,
		}));
	}, [overview]);

	const sectorEntities = useMemo<RenderableEntity[]>(() => {
		if (!galaxyData) {
			return [];
		}

		return galaxyData.sectors.map((sector) => ({
			id: `sector:${sector.id}`,
			sourceId: sector.id,
			entityType: "sector" as const,
			name: sector.displayName,
			addressLabel: sector.addressLabel,
			hostility: sector.hostility ?? undefined,
			x: sector.worldCenterX,
			y: sector.worldCenterY,
			sphereRadius: SECTOR_RADIUS,
			bounds: {
				minX: sector.worldMinX,
				maxX: sector.worldMaxX,
				minY: sector.worldMinY,
				maxY: sector.worldMaxY,
			},
		}));
	}, [galaxyData]);

	const systemEntities = useMemo<RenderableEntity[]>(() => {
		if (!sectorData) {
			return [];
		}

		return sectorData.systems.map((system) => ({
			id: `system:${system.id}`,
			sourceId: system.id,
			entityType: "system",
			name: system.displayName,
			addressLabel: system.addressLabel,
			x: system.worldX,
			y: system.worldY,
			sphereRadius: SYSTEM_RADIUS,
		}));
	}, [sectorData]);

	const planetEntities = useMemo<RenderableEntity[]>(() => {
		if (!systemData) {
			return [];
		}

		const nowMs = Date.now();

		return systemData.planets.map((planet) => {
			const orbit = {
				centerX: systemData.system.worldX,
				centerY: systemData.system.worldY,
				orbitRadius: planet.orbitRadius,
				orbitPhaseRad: planet.orbitPhaseRad,
				orbitAngularVelocityRadPerSec: planet.orbitAngularVelocityRadPerSec,
				orbitEpochMs: systemData.universe.orbitEpochMs,
			};
			const position = computeOrbitWorldPosition(orbit, nowMs);

			return {
				id: `planet:${planet.id}`,
				sourceId: planet.id,
				entityType: "planet",
				name: planet.displayName,
				addressLabel: planet.addressLabel,
				visualSeed: planet.seed,
				colony: planet.colony
					? {
							name: planet.colony.name,
							playerName: planet.colony.playerName,
						}
					: undefined,
				x: position.x,
				y: position.y,
				sphereRadius: PLANET_RADIUS,
				orbit,
			};
		});
	}, [systemData]);

	const selectedGalaxy = useMemo(() => {
		if (!explorer.path.galaxyId) {
			return null;
		}

		if (galaxyData) {
			return galaxyData.galaxy;
		}

		return overview?.galaxies.find((entry) => entry.id === explorer.path.galaxyId) ?? null;
	}, [explorer.path.galaxyId, galaxyData, overview]);

	const selectedSector = useMemo(() => {
		if (!explorer.path.sectorId) {
			return null;
		}

		if (sectorData) {
			return sectorData.sector;
		}

		return galaxyData?.sectors.find((entry) => entry.id === explorer.path.sectorId) ?? null;
	}, [explorer.path.sectorId, sectorData, galaxyData]);

	const selectedSystem = useMemo(() => {
		if (!explorer.path.systemId) {
			return null;
		}

		if (systemData) {
			return systemData.system;
		}

		return sectorData?.systems.find((entry) => entry.id === explorer.path.systemId) ?? null;
	}, [explorer.path.systemId, systemData, sectorData]);

	const selectedPlanet = useMemo(() => {
		if (!explorer.path.planetId) {
			return null;
		}

		return systemData?.planets.find((entry) => entry.id === explorer.path.planetId) ?? null;
	}, [explorer.path.planetId, systemData]);

	const isCurrentLevelLoading = (() => {
		if (explorer.level === "universe") {
			return overview === undefined;
		}
		if (explorer.level === "galaxy") {
			return galaxyData === undefined;
		}
		if (explorer.level === "sector") {
			return sectorData === undefined;
		}
		return systemData === undefined;
	})();

	useExplorerPrefetch({
		galaxyData,
		level: explorer.level,
		overview,
		sectorData,
	});

	return {
		overview,
		galaxyData,
		sectorData,
		systemData,
		galaxyEntities,
		sectorEntities,
		systemEntities,
		planetEntities,
		selectedGalaxy,
		selectedSector,
		selectedSystem,
		selectedPlanet,
		isCurrentLevelLoading,
	};
}
