import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group } from "three";

import { computeOrbitWorldPosition } from "../lib/orbits";
import { EntitySphere, EntitySphereVisual } from "./entity-sphere";
import type { RenderableEntity } from "../types";

type LevelSystemProps = {
  entities: RenderableEntity[];
  hoveredId: string | null;
  selectedPlanetId: string | undefined;
  starCenter?: {
    x: number;
    y: number;
  };
  onSelect: (
    entity: RenderableEntity,
    position?: {
      x: number;
      y: number;
    }
  ) => void;
  onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

const ORBIT_SEGMENTS = 96;

function OrbitPath({
  centerX,
  centerY,
  radius,
}: {
  centerX: number;
  centerY: number;
  radius: number;
}) {
  const positions = useMemo(() => {
    const values: number[] = [];
    for (let index = 0; index < ORBIT_SEGMENTS; index += 1) {
      const angle = (index / ORBIT_SEGMENTS) * Math.PI * 2;
      values.push(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        -1
      );
    }
    return values;
  }, [centerX, centerY, radius]);

  const geometry = useMemo(() => {
    const nextGeometry = new BufferGeometry();
    nextGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3)
    );
    return nextGeometry;
  }, [positions]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineLoop geometry={geometry} raycast={() => {}}>
      <lineBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </lineLoop>
  );
}

function OrbitingPlanetSphere({
  entity,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onHoverEnd,
}: {
  entity: RenderableEntity;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (
    entity: RenderableEntity,
    position?: {
      x: number;
      y: number;
    }
  ) => void;
  onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
}) {
  const orbit = entity.orbit;
  const groupRef = useRef<Group | null>(null);
  const currentPositionRef = useRef({
    x: entity.x,
    y: entity.y,
  });

  useFrame(() => {
    if (!orbit || !groupRef.current) {
      return;
    }

    const nextPosition = computeOrbitWorldPosition(orbit, Date.now());
    currentPositionRef.current = nextPosition;
    groupRef.current.position.set(nextPosition.x, nextPosition.y, 0);
  });

  if (!orbit) {
    return (
      <EntitySphere
        x={entity.x}
        y={entity.y}
        radius={entity.sphereRadius}
        entityType={entity.entityType}
        seedKey={entity.sourceId}
        isSelected={isSelected}
        isHovered={isHovered}
        onSelect={() => onSelect(entity)}
        onHover={(x, y) => onHover(entity, x, y)}
        onHoverMove={(x, y) => onHover(entity, x, y)}
        onHoverEnd={onHoverEnd}
      />
    );
  }

  const scale = isSelected ? 1.35 : isHovered ? 1.2 : 1;

  return (
    <group ref={groupRef} position={[entity.x, entity.y, 0]} scale={scale}>
      <EntitySphereVisual
        radius={entity.sphereRadius}
        entityType={entity.entityType}
        seedKey={entity.sourceId}
        isSelected={isSelected}
        isHovered={isHovered}
        detailLevel="compact"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(entity, currentPositionRef.current);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHover(entity, event.nativeEvent.clientX, event.nativeEvent.clientY);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          onHoverEnd();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(entity, event.nativeEvent.clientX, event.nativeEvent.clientY);
        }}
      />
    </group>
  );
}

export function LevelSystem({
  entities,
  hoveredId,
  selectedPlanetId,
  starCenter,
  onSelect,
  onHover,
  onHoverEnd,
}: LevelSystemProps) {
  return (
    <>
      {starCenter ? (
        <mesh position={[starCenter.x, starCenter.y, 0]} raycast={() => {}}>
          <sphereGeometry args={[10, 18, 18]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.9}
            roughness={0.25}
            metalness={0.08}
          />
        </mesh>
      ) : null}
      {entities.map((entity) =>
        entity.orbit ? (
          <OrbitPath
            key={`orbit:${entity.id}`}
            centerX={entity.orbit.centerX}
            centerY={entity.orbit.centerY}
            radius={entity.orbit.orbitRadius}
          />
        ) : null
      )}
      {entities.map((entity) => (
        <OrbitingPlanetSphere
          key={entity.id}
          entity={entity}
          isSelected={selectedPlanetId === entity.sourceId}
          isHovered={hoveredId === entity.id}
          onSelect={onSelect}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
        />
      ))}
    </>
  );
}
