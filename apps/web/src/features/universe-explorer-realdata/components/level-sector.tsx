import { EntitySphere } from "./entity-sphere";
import type { ExplorerResolvedQuality, RenderableEntity } from "../types";

type LevelSectorProps = {
  entities: RenderableEntity[];
  hoveredId: string | null;
  quality: ExplorerResolvedQuality;
  onSelect: (entity: RenderableEntity) => void;
  onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

export function LevelSector({
  entities,
  hoveredId,
  quality,
  onSelect,
  onHover,
  onHoverEnd,
}: LevelSectorProps) {
  return (
    <>
      {entities.map((entity) => (
        <EntitySphere
          key={entity.id}
          x={entity.x}
          y={entity.y}
          radius={entity.sphereRadius}
          entityType={entity.entityType}
          seedKey={entity.sourceId}
          quality={quality}
          isSelected={false}
          isHovered={hoveredId === entity.id}
          onSelect={() => onSelect(entity)}
          onHover={(x, y) => onHover(entity, x, y)}
          onHoverMove={(x, y) => onHover(entity, x, y)}
          onHoverEnd={onHoverEnd}
        />
      ))}
    </>
  );
}
