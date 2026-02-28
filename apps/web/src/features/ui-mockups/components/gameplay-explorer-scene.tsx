import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { ExplorerCanvas } from "@/features/universe-explorer-realdata/components/explorer-canvas";
import { HoverPanel } from "@/features/universe-explorer-realdata/components/hover-panel";
import { LevelGalaxy } from "@/features/universe-explorer-realdata/components/level-galaxy";
import { LevelSector } from "@/features/universe-explorer-realdata/components/level-sector";
import { LevelSystem } from "@/features/universe-explorer-realdata/components/level-system";
import { LevelUniverse } from "@/features/universe-explorer-realdata/components/level-universe";
import {
  ExplorerProvider,
  useExplorerContext,
} from "@/features/universe-explorer-realdata/context/explorer-context";
import { useExplorerData } from "@/features/universe-explorer-realdata/hooks/use-explorer-data";
import { useExplorerQuality } from "@/features/universe-explorer-realdata/hooks/use-explorer-quality";
import { computeOrbitWorldPosition } from "@/features/universe-explorer-realdata/lib/orbits";
import type {
  HoverPanelState,
  RenderableEntity,
} from "@/features/universe-explorer-realdata/types";

type GameplayExplorerSnapshot = {
  colonyCountEstimate: number;
  currentLevel: "galaxy" | "planet" | "sector" | "system" | "universe";
  selectedPathLabel: string;
  transportLoadEstimate: number;
  universeName: string;
  visibleEntityCount: number;
};

type GameplayExplorerSceneProps = {
  overlay?: (snapshot: GameplayExplorerSnapshot) => React.ReactNode;
};

const ZOOM = {
  universe: 0.08,
  galaxy: 0.22,
  sector: 0.55,
  system: 1.9,
  planet: 2.8,
} as const;

export function GameplayExplorerScene({ overlay }: GameplayExplorerSceneProps) {
  return (
    <ExplorerProvider>
      <GameplayExplorerSceneInner overlay={overlay} />
    </ExplorerProvider>
  );
}

function GameplayExplorerSceneInner({ overlay }: GameplayExplorerSceneProps) {
  const explorer = useExplorerContext();
  const data = useExplorerData();
  const { antialiasEnabled, canvasDpr, resolvedQuality } = useExplorerQuality();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverPanelState | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverPanelState | null>(null);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
    };
  }, []);

  const handleHover = (
    entity: RenderableEntity,
    screenX: number,
    screenY: number
  ) => {
    setHoveredId(entity.id);
    pendingHoverRef.current = {
      entityType: entity.entityType,
      name: entity.name,
      addressLabel: entity.addressLabel,
      colonyName: entity.colony?.name,
      colonyPlayerName: entity.colony?.playerName,
      screenX,
      screenY,
    };
    if (hoverRafRef.current !== null) {
      return;
    }
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      setHover(pendingHoverRef.current);
    });
  };

  const clearHover = () => {
    setHoveredId(null);
    pendingHoverRef.current = null;
    setHover(null);
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
  };

  const handleUniverseEntitySelect = (entity: RenderableEntity) => {
    explorer.setGalaxyLevel(entity.sourceId as Id<"galaxies">, {
      x: entity.x,
      y: entity.y,
      zoom: ZOOM.galaxy,
    });
  };

  const handleGalaxyEntitySelect = (entity: RenderableEntity) => {
    if (!explorer.path.galaxyId) return;
    explorer.setSectorLevel(
      {
        galaxyId: explorer.path.galaxyId,
        sectorId: entity.sourceId as Id<"sectors">,
      },
      {
        x: entity.x,
        y: entity.y,
        zoom: ZOOM.sector,
      }
    );
  };

  const handleSectorEntitySelect = (entity: RenderableEntity) => {
    if (!explorer.path.galaxyId || !explorer.path.sectorId) return;
    explorer.setSystemLevel(
      {
        galaxyId: explorer.path.galaxyId,
        sectorId: explorer.path.sectorId,
        systemId: entity.sourceId as Id<"systems">,
      },
      {
        x: entity.x,
        y: entity.y,
        zoom: ZOOM.system,
      }
    );
  };

  const handlePlanetEntitySelect = (
    entity: RenderableEntity,
    position?: {
      x: number;
      y: number;
    }
  ) => {
    if (!explorer.path.galaxyId || !explorer.path.sectorId || !explorer.path.systemId) {
      return;
    }

    const livePosition =
      position ??
      (entity.orbit
        ? computeOrbitWorldPosition(entity.orbit, Date.now())
        : { x: entity.x, y: entity.y });

    explorer.setPlanetLevel(
      {
        galaxyId: explorer.path.galaxyId,
        sectorId: explorer.path.sectorId,
        systemId: explorer.path.systemId,
        planetId: entity.sourceId as Id<"planets">,
      },
      {
        x: livePosition.x,
        y: livePosition.y,
        zoom: ZOOM.planet,
      }
    );
  };

  const currentEntities =
    explorer.level === "universe"
      ? data.galaxyEntities
      : explorer.level === "galaxy"
        ? data.sectorEntities
        : explorer.level === "sector"
          ? data.systemEntities
          : data.planetEntities;

  const snapshot: GameplayExplorerSnapshot = useMemo(() => {
    const pathSegments = [
      data.selectedGalaxy?.displayName,
      data.selectedSector?.displayName,
      data.selectedSystem?.displayName,
      data.selectedPlanet?.displayName,
    ].filter(Boolean);

    const selectedPathLabel = pathSegments.length > 0 ? pathSegments.join(" / ") : "Universe";
    const colonyCountEstimate = (data.planetEntities.length || 0) + (data.systemEntities.length || 0);
    const transportLoadEstimate = Math.max(
      3,
      Math.floor((data.systemEntities.length + data.sectorEntities.length + 5) * 1.2)
    );

    return {
      colonyCountEstimate,
      currentLevel: explorer.level,
      selectedPathLabel,
      transportLoadEstimate,
      universeName: data.overview?.universe.name ?? "Loading Universe",
      visibleEntityCount: currentEntities.length,
    };
  }, [
    currentEntities.length,
    data.overview?.universe.name,
    data.planetEntities.length,
    data.sectorEntities.length,
    data.selectedGalaxy?.displayName,
    data.selectedPlanet?.displayName,
    data.selectedSector?.displayName,
    data.selectedSystem?.displayName,
    data.systemEntities.length,
    explorer.level,
  ]);

  const sceneContent = (
    <>
      {explorer.level === "universe" ? (
        <LevelUniverse
          entities={data.galaxyEntities}
          hoveredId={hoveredId}
          quality={resolvedQuality}
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleUniverseEntitySelect}
        />
      ) : null}

      {explorer.level === "galaxy" ? (
        <LevelGalaxy
          entities={data.sectorEntities}
          hoveredId={hoveredId}
          quality={resolvedQuality}
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleGalaxyEntitySelect}
        />
      ) : null}

      {explorer.level === "sector" ? (
        <LevelSector
          entities={data.systemEntities}
          hoveredId={hoveredId}
          quality={resolvedQuality}
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleSectorEntitySelect}
        />
      ) : null}

      {explorer.level === "system" || explorer.level === "planet" ? (
        <LevelSystem
          entities={data.planetEntities}
          hoveredId={hoveredId}
          quality={resolvedQuality}
          selectedPlanetId={
            explorer.cameraLock.mode === "planet"
              ? explorer.cameraLock.planetId
              : undefined
          }
          starCenter={
            data.selectedSystem
              ? { x: data.selectedSystem.x, y: data.selectedSystem.y }
              : undefined
          }
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handlePlanetEntitySelect}
        />
      ) : null}
    </>
  );

  const trackingOrbit = useMemo(() => {
    if (explorer.cameraLock.mode !== "planet" || !data.selectedSystem) {
      return null;
    }
    const lockedPlanetId = explorer.cameraLock.planetId;

    const lockedPlanet =
      data.systemData?.planets.find(
        (planet) => planet.id === lockedPlanetId
      ) ?? null;

    if (!lockedPlanet) {
      return null;
    }

    return {
      centerX: data.selectedSystem.x,
      centerY: data.selectedSystem.y,
      orbitRadius: lockedPlanet.orbitRadius,
      orbitPhaseRad: lockedPlanet.orbitPhaseRad,
      orbitAngularVelocityRadPerSec:
        lockedPlanet.orbitAngularVelocityRadPerSec,
      orbitEpochMs: data.systemData?.universe.orbitEpochMs ?? Date.now(),
    };
  }, [
    data.systemData?.planets,
    data.selectedSystem,
    data.systemData?.universe.orbitEpochMs,
    explorer.cameraLock,
  ]);

  const handlePanWhileLocked = useCallback(() => {
    explorer.unlockCameraLock();
  }, [explorer]);

  const extraOverlay = overlay?.(snapshot);

  return (
    <div className="relative h-full min-h-0">
      <ExplorerCanvas
        antialias={antialiasEnabled}
        dpr={canvasDpr}
        focusTarget={explorer.focusTarget}
        cameraMode={explorer.cameraLock.mode === "planet" ? "followPlanet" : "free"}
        trackingOrbit={trackingOrbit}
        onPanWhileLocked={handlePanWhileLocked}
        onPointerMissed={clearHover}
        quality={resolvedQuality}
        sceneKey={explorer.level}
      >
        {sceneContent}
      </ExplorerCanvas>
      {extraOverlay}
      <HoverPanel hover={hover} />
      <MiniSystemReadout
        currentLevel={snapshot.currentLevel}
        selectedPathLabel={snapshot.selectedPathLabel}
        universeName={snapshot.universeName}
      />
    </div>
  );
}

function MiniSystemReadout({
  currentLevel,
  selectedPathLabel,
  universeName,
}: {
  currentLevel: GameplayExplorerSnapshot["currentLevel"];
  selectedPathLabel: string;
  universeName: string;
}) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-[11px] text-slate-200 backdrop-blur-sm">
      <p className="uppercase tracking-[0.2em] text-cyan-100/85">{currentLevel}</p>
      <p className="mt-1 max-w-[360px] truncate text-slate-100/95">{selectedPathLabel}</p>
      <p className="text-slate-300/85">{universeName}</p>
    </div>
  );
}
