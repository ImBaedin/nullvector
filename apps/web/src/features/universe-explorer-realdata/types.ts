import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

export type ExplorerLevel =
  | "universe"
  | "galaxy"
  | "sector"
  | "system"
  | "planet";

export type ExplorerEntityType = "galaxy" | "sector" | "system" | "planet";

export type ExplorerPathState = {
  galaxyId?: Id<"galaxies">;
  sectorId?: Id<"sectors">;
  systemId?: Id<"systems">;
  planetId?: Id<"planets">;
};

export type RenderableEntity = {
  id: string;
  sourceId: string;
  entityType: ExplorerEntityType;
  name: string;
  addressLabel: string;
  x: number;
  y: number;
  sphereRadius: number;
  orbit?: {
    centerX: number;
    centerY: number;
    orbitRadius: number;
    orbitPhaseRad: number;
    orbitAngularVelocityRadPerSec: number;
    orbitEpochMs: number;
  };
};

export type HoverCardData = {
  entityType: ExplorerEntityType;
  name: string;
  addressLabel: string;
};

export type HoverPanelState = HoverCardData & {
  screenX: number;
  screenY: number;
};

export type CameraFocusTarget = {
  x: number;
  y: number;
  zoom: number;
  key: number;
};
