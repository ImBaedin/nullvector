import type { ThreeEvent } from "@react-three/fiber";

import type { ExplorerEntityType, ExplorerResolvedQuality } from "../../types";

export type EntityVisualHandlers = {
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

export type EntityVisualProps = EntityVisualHandlers & {
  radius: number;
  entityType: ExplorerEntityType;
  seedKey: string;
  quality: ExplorerResolvedQuality;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel: "full" | "compact";
};

export type EntitySphereProps = {
  x: number;
  y: number;
  radius: number;
  entityType: ExplorerEntityType;
  seedKey: string;
  quality?: ExplorerResolvedQuality;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel?: "full" | "compact";
  onSelect: () => void;
  onHover: (screenX: number, screenY: number) => void;
  onHoverMove: (screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

