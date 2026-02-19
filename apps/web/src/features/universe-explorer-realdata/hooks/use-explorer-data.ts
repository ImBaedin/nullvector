import { useEffect, useMemo, useRef } from "react";

import { api } from "@nullvector/backend/convex/_generated/api";
import { useConvex, useQuery } from "convex/react";

import { useExplorerContext } from "../context/explorer-context";
import { computeOrbitWorldPosition } from "../lib/orbits";
import type { RenderableEntity } from "../types";

const GALAXY_RADIUS = 140;
const SECTOR_RADIUS = 46;
const SYSTEM_RADIUS = 16;
const PLANET_RADIUS = 6;
const NEXT_LEVEL_PREFETCH_LIMIT = 6;

export function useExplorerData() {
  const explorer = useExplorerContext();
  const convex = useConvex();
  const prefetchedIdsRef = useRef({
    galaxy: new Set<string>(),
    sector: new Set<string>(),
    system: new Set<string>(),
  });

  const overview = useQuery(api.universeExplorer.getUniverseExplorerOverview, {});

  const galaxyData = useQuery(
    api.universeExplorer.getGalaxySectors,
    explorer.path.galaxyId ? { galaxyId: explorer.path.galaxyId } : "skip"
  );

  const sectorData = useQuery(
    api.universeExplorer.getSectorSystems,
    explorer.path.sectorId ? { sectorId: explorer.path.sectorId } : "skip"
  );

  const systemData = useQuery(
    api.universeExplorer.getSystemPlanets,
    explorer.path.systemId ? { systemId: explorer.path.systemId } : "skip"
  );

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
      x: galaxy.gx,
      y: galaxy.gy,
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
      entityType: "sector",
      name: sector.displayName,
      addressLabel: sector.addressLabel,
      x: sector.centerX,
      y: sector.centerY,
      sphereRadius: SECTOR_RADIUS,
      bounds: {
        minX: sector.minX,
        maxX: sector.maxX,
        minY: sector.minY,
        maxY: sector.maxY,
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
      x: system.x,
      y: system.y,
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
        centerX: systemData.system.x,
        centerY: systemData.system.y,
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

    return (
      overview?.galaxies.find((entry) => entry.id === explorer.path.galaxyId) ??
      null
    );
  }, [explorer.path.galaxyId, galaxyData, overview]);

  const selectedSector = useMemo(() => {
    if (!explorer.path.sectorId) {
      return null;
    }

    if (sectorData) {
      return sectorData.sector;
    }

    return (
      galaxyData?.sectors.find((entry) => entry.id === explorer.path.sectorId) ??
      null
    );
  }, [explorer.path.sectorId, sectorData, galaxyData]);

  const selectedSystem = useMemo(() => {
    if (!explorer.path.systemId) {
      return null;
    }

    if (systemData) {
      return systemData.system;
    }

    return (
      sectorData?.systems.find((entry) => entry.id === explorer.path.systemId) ??
      null
    );
  }, [explorer.path.systemId, systemData, sectorData]);

  const selectedPlanet = useMemo(() => {
    if (!explorer.path.planetId) {
      return null;
    }

    return (
      systemData?.planets.find((entry) => entry.id === explorer.path.planetId) ??
      null
    );
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

  useEffect(() => {
    if (explorer.level === "universe") {
      const prefetchedGalaxyIds = prefetchedIdsRef.current.galaxy;
      const galaxyIdsToPrefetch = (overview?.galaxies ?? [])
        .map((galaxy) => galaxy.id)
        .filter((id) => !prefetchedGalaxyIds.has(id))
        .slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

      if (galaxyIdsToPrefetch.length === 0) {
        return;
      }

      void Promise.allSettled(
        galaxyIdsToPrefetch.map(async (galaxyId) => {
          await convex.query(api.universeExplorer.getGalaxySectors, { galaxyId });
          prefetchedGalaxyIds.add(galaxyId);
        })
      );
      return;
    }

    if (explorer.level === "galaxy") {
      const prefetchedSectorIds = prefetchedIdsRef.current.sector;
      const sectorIdsToPrefetch = (galaxyData?.sectors ?? [])
        .map((sector) => sector.id)
        .filter((id) => !prefetchedSectorIds.has(id))
        .slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

      if (sectorIdsToPrefetch.length === 0) {
        return;
      }

      void Promise.allSettled(
        sectorIdsToPrefetch.map(async (sectorId) => {
          await convex.query(api.universeExplorer.getSectorSystems, { sectorId });
          prefetchedSectorIds.add(sectorId);
        })
      );
      return;
    }

    if (explorer.level !== "sector") {
      return;
    }

    const prefetchedSystemIds = prefetchedIdsRef.current.system;
    const systemIdsToPrefetch = (sectorData?.systems ?? [])
      .map((system) => system.id)
      .filter((id) => !prefetchedSystemIds.has(id))
      .slice(0, NEXT_LEVEL_PREFETCH_LIMIT);

    if (systemIdsToPrefetch.length === 0) {
      return;
    }

    void Promise.allSettled(
      systemIdsToPrefetch.map(async (systemId) => {
        await convex.query(api.universeExplorer.getSystemPlanets, { systemId });
        prefetchedSystemIds.add(systemId);
      })
    );
  }, [convex, explorer.level, galaxyData?.sectors, overview?.galaxies, sectorData?.systems]);

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
