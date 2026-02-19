import { useMemo, useState } from "react";

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
import type { RenderableEntity } from "@/features/universe-explorer-realdata/types";

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHover = (
    entity: RenderableEntity,
    screenX: number,
    screenY: number
  ) => {
    setHoveredId(entity.id);
    explorer.setHover(
      {
        entityType: entity.entityType,
        name: entity.name,
        addressLabel: entity.addressLabel,
      },
      screenX,
      screenY
    );
  };

  const clearHover = () => {
    setHoveredId(null);
    explorer.clearHover();
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

    explorer.setPlanetLevel(
      {
        galaxyId: explorer.path.galaxyId,
        sectorId: explorer.path.sectorId,
        systemId: explorer.path.systemId,
        planetId: entity.sourceId as Id<"planets">,
      },
      {
        x: position?.x ?? entity.x,
        y: position?.y ?? entity.y,
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
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleUniverseEntitySelect}
        />
      ) : null}

      {explorer.level === "galaxy" ? (
        <LevelGalaxy
          entities={data.sectorEntities}
          hoveredId={hoveredId}
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleGalaxyEntitySelect}
        />
      ) : null}

      {explorer.level === "sector" ? (
        <LevelSector
          entities={data.systemEntities}
          hoveredId={hoveredId}
          onHover={handleHover}
          onHoverEnd={clearHover}
          onSelect={handleSectorEntitySelect}
        />
      ) : null}

      {explorer.level === "system" || explorer.level === "planet" ? (
        <LevelSystem
          entities={data.planetEntities}
          hoveredId={hoveredId}
          selectedPlanetId={explorer.path.planetId}
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

  const extraOverlay = overlay?.(snapshot);

  return (
    <div className="relative h-full min-h-0">
      <ExplorerCanvas
        focusTarget={explorer.focusTarget}
        onPointerMissed={clearHover}
        sceneKey={explorer.level}
      >
        {sceneContent}
      </ExplorerCanvas>
      {extraOverlay}
      <HoverPanel />
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
