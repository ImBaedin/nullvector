import { EntitySphere } from "./entity-sphere";
import type { RenderableEntity } from "../types";

type LevelSectorProps = {
  entities: RenderableEntity[];
  hoveredId: string | null;
  onSelect: (entity: RenderableEntity) => void;
  onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

export function LevelSector({
  entities,
  hoveredId,
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
