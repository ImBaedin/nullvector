import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import { X } from "lucide-react";

import { AppHeader } from "@/features/game-ui/header";
import { ExplorerBreadcrumbs } from "@/features/universe-explorer-realdata/components/explorer-breadcrumbs";
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
import { computeOrbitWorldPosition } from "@/features/universe-explorer-realdata/lib/orbits";
import type { RenderableEntity } from "@/features/universe-explorer-realdata/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/colony/$colonyId")({
  component: ColonyLayoutRoute,
});

const ZOOM = {
  galaxy: 0.22,
  planet: 2.8,
  sector: 0.55,
  system: 1.9,
} as const;

function ColonyLayoutRoute() {
  const [isStarMapOpen, setIsStarMapOpen] = useState(false);

  return (
    <div
      className="relative h-full overflow-y-auto"
      style={{
        background:
          "linear-gradient(180deg, #15263f 0%, #101c31 18%, #0b1524 40%, #070f1c 60%, #060c15 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(72,180,255,0.18),transparent_36%),radial-gradient(circle_at_84%_22%,rgba(74,233,255,0.14),transparent_38%)]" />

      <ExplorerProvider>
        <ColonyStarMapLayer
          isOpen={isStarMapOpen}
          onClose={() => setIsStarMapOpen(false)}
        />
      </ExplorerProvider>

      <AppHeader
        collapseContextNav={isStarMapOpen}
        collapseResources={isStarMapOpen}
        isStarMapOpen={isStarMapOpen}
        onToggleStarMap={() => setIsStarMapOpen((current) => !current)}
      />

      <div
        className={cn(
          "relative z-10 min-h-full overflow-hidden",
          isStarMapOpen ? "pointer-events-none" : null
        )}
      >
        <div
          className={cn(
            "relative min-h-full transition-[clip-path,opacity,transform] duration-500 ease-out",
            isStarMapOpen
              ? "pointer-events-none opacity-0 -translate-y-3"
              : "opacity-100 translate-y-0"
          )}
          style={{
            clipPath: isStarMapOpen
              ? "inset(0 0 100% 0 round 0.5rem)"
              : "inset(0 0 0 0 round 0.5rem)",
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function ColonyStarMapLayer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const explorer = useExplorerContext();
  const data = useExplorerData();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const clearHover = () => {
    setHoveredId(null);
    explorer.clearHover();
  };

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

  const handleUniverseEntitySelect = (entity: RenderableEntity) => {
    explorer.setGalaxyLevel(entity.sourceId as Id<"galaxies">, {
      x: entity.x,
      y: entity.y,
      zoom: ZOOM.galaxy,
    });
  };

  const handleGalaxyEntitySelect = (entity: RenderableEntity) => {
    if (!explorer.path.galaxyId) {
      return;
    }

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
    if (!explorer.path.galaxyId || !explorer.path.sectorId) {
      return;
    }

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
    if (
      !explorer.path.galaxyId ||
      !explorer.path.sectorId ||
      !explorer.path.systemId
    ) {
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

  const breadcrumbProps = useMemo(() => {
    const galaxy = data.selectedGalaxy
      ? {
          id: data.selectedGalaxy.id,
          name: data.selectedGalaxy.displayName,
          x: data.selectedGalaxy.gx,
          y: data.selectedGalaxy.gy,
        }
      : undefined;

    const sector = data.selectedSector
      ? {
          id: data.selectedSector.id,
          name: data.selectedSector.displayName,
          x: data.selectedSector.centerX,
          y: data.selectedSector.centerY,
        }
      : undefined;

    const system = data.selectedSystem
      ? {
          id: data.selectedSystem.id,
          name: data.selectedSystem.displayName,
          x: data.selectedSystem.x,
          y: data.selectedSystem.y,
        }
      : undefined;

    const planet = data.selectedPlanet
      ? (() => {
          if (data.selectedSystem) {
            const position = computeOrbitWorldPosition(
              {
                centerX: data.selectedSystem.x,
                centerY: data.selectedSystem.y,
                orbitRadius: data.selectedPlanet.orbitRadius,
                orbitPhaseRad: data.selectedPlanet.orbitPhaseRad,
                orbitAngularVelocityRadPerSec:
                  data.selectedPlanet.orbitAngularVelocityRadPerSec,
                orbitEpochMs: data.systemData?.universe.orbitEpochMs ?? Date.now(),
              },
              Date.now()
            );

            return {
              id: data.selectedPlanet.id,
              name: data.selectedPlanet.displayName,
              x: position.x,
              y: position.y,
            };
          }

          return {
            id: data.selectedPlanet.id,
            name: data.selectedPlanet.displayName,
            x: data.selectedPlanet.orbitX,
            y: data.selectedPlanet.orbitY,
          };
        })()
      : undefined;

    return { galaxy, sector, system, planet };
  }, [
    data.selectedGalaxy,
    data.selectedPlanet,
    data.selectedSector,
    data.selectedSystem,
    data.systemData?.universe.orbitEpochMs,
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

  return (
    <>
      <div className="fixed inset-0 z-0">
        <ExplorerCanvas
          focusTarget={explorer.focusTarget}
          maxFps={isOpen ? 60 : 10}
          onPointerMissed={clearHover}
          sceneKey={explorer.level}
        >
          {sceneContent}
        </ExplorerCanvas>
      </div>

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[1] transition-all duration-500",
          isOpen
            ? "bg-[rgba(4,8,18,0.2)]"
            : "bg-[rgba(4,10,20,0.48)] backdrop-blur-[10px]"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[2] w-[min(90vw,360px)] border-r border-white/20 bg-[rgba(7,14,28,0.78)] p-4 backdrop-blur-md transition-transform duration-500 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-[108%]"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/85">
            Star Map
          </p>
          <button
            className="inline-flex size-8 items-center justify-center rounded-md border border-white/20 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
          Universe Explorer
        </h2>

        <div className="mt-4">
          <ExplorerBreadcrumbs {...breadcrumbProps} />
        </div>

        <div className="mt-4 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
          <p>
            <span className="text-slate-400">Universe:</span>{" "}
            {data.overview?.universe.name ?? "Loading..."}
          </p>
          <p>
            <span className="text-slate-400">Level:</span> {explorer.level}
          </p>
          <p>
            <span className="text-slate-400">Visible entities:</span>{" "}
            {currentEntities.length}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
            Entities
          </p>
          <div className="mt-2 max-h-[48vh] space-y-1 overflow-y-auto pr-1">
            {currentEntities.map((entity) => (
              <button
                className="flex w-full items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1 text-left text-xs text-slate-100 hover:bg-white/10"
                key={entity.id}
                onClick={() => {
                  if (explorer.level === "universe") {
                    handleUniverseEntitySelect(entity);
                    return;
                  }
                  if (explorer.level === "galaxy") {
                    handleGalaxyEntitySelect(entity);
                    return;
                  }
                  if (explorer.level === "sector") {
                    handleSectorEntitySelect(entity);
                    return;
                  }
                  handlePlanetEntitySelect(entity);
                }}
                onMouseEnter={(event) =>
                  handleHover(entity, event.clientX, event.clientY)
                }
                onMouseLeave={clearHover}
                onMouseMove={(event) =>
                  handleHover(entity, event.clientX, event.clientY)
                }
                type="button"
              >
                <span>{entity.name}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {entity.addressLabel}
                </span>
              </button>
            ))}

            {!currentEntities.length ? (
              <p className="rounded border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-300">
                {data.isCurrentLevelLoading
                  ? "Loading entities..."
                  : "No entities for this level yet."}
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <HoverPanel />
    </>
  );
}
