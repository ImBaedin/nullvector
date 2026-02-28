import { DefaultEntityVisual } from "./default-entity-visual";
import { GalaxyEntityVisual } from "./galaxy-entity-visual";
import { PlanetEntityVisual } from "./planet-entity-visual";
import type { EntityVisualProps } from "./types";

export function EntitySphereVisual(props: EntityVisualProps) {
  if (props.entityType === "planet") {
    return <PlanetEntityVisual {...props} />;
  }

  if (props.entityType === "galaxy") {
    return <GalaxyEntityVisual {...props} />;
  }

  return <DefaultEntityVisual {...props} />;
}

