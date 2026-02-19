import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { DoubleSide } from "three";

import {
  getEntityVisualPreset,
  hashStringToUnit,
} from "./entity-visuals";
import type { ExplorerEntityType } from "../types";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

type EntitySphereVisualProps = {
  radius: number;
  entityType: ExplorerEntityType;
  seedKey: string;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel: "full" | "compact";
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

type EntitySphereProps = {
  x: number;
  y: number;
  radius: number;
  entityType: ExplorerEntityType;
  seedKey: string;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel?: "full" | "compact";
  onSelect: () => void;
  onHover: (screenX: number, screenY: number) => void;
  onHoverMove: (screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

export function EntitySphereVisual({
  radius,
  entityType,
  seedKey,
  isSelected,
  isHovered,
  detailLevel,
  onClick,
  onPointerOver,
  onPointerMove,
  onPointerOut,
}: EntitySphereVisualProps) {
  const preset = useMemo(
    () => getEntityVisualPreset(entityType, hashStringToUnit(seedKey)),
    [entityType, seedKey]
  );

  const emissiveIntensity = clamp01(
    preset.baseEmissiveIntensity +
      (isHovered ? preset.hoverEmissiveBoost : 0) +
      (isSelected ? preset.selectedEmissiveBoost : 0)
  );
  const haloOpacity = clamp01(
    preset.haloOpacity +
      (isHovered ? preset.hoverHaloBoost : 0) +
      (isSelected ? preset.selectedHaloBoost : 0)
  );
  const ringOpacity = clamp01(
    preset.ringOpacity + (isHovered ? 0.08 : 0) + (isSelected ? 0.14 : 0)
  );
  const shellOpacity = clamp01(
    preset.shellOpacity + (isHovered ? 0.05 : 0) + (isSelected ? 0.1 : 0)
  );
  const segmentCount = detailLevel === "compact" ? 18 : 22;

  return (
    <>
      <mesh
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onPointerOver={onPointerOver}
        renderOrder={25}
      >
        <sphereGeometry args={[radius, segmentCount, segmentCount]} />
        <meshStandardMaterial
          color={preset.coreColor}
          emissive={preset.emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={preset.coreRoughness}
          metalness={preset.coreMetalness}
        />
      </mesh>

      <mesh scale={preset.haloScale} renderOrder={12} raycast={() => {}}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={preset.haloColor}
          transparent
          opacity={haloOpacity}
          depthWrite={false}
        />
      </mesh>

      {detailLevel === "full" && preset.hasShell ? (
        <mesh scale={preset.shellScale} renderOrder={18} raycast={() => {}}>
          <sphereGeometry args={[radius, 14, 14]} />
          <meshBasicMaterial
            color={preset.shellColor}
            transparent
            opacity={shellOpacity}
            wireframe
            depthWrite={false}
          />
        </mesh>
      ) : null}

      {detailLevel === "full" && preset.hasRing ? (
        <mesh
          rotation={[preset.ringTiltRad, 0, preset.ringRotationRad]}
          renderOrder={19}
          raycast={() => {}}
        >
          <ringGeometry
            args={[
              radius * preset.ringInnerScale,
              radius * preset.ringOuterScale,
              48,
            ]}
          />
          <meshBasicMaterial
            color={preset.ringColor}
            transparent
            opacity={ringOpacity}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  );
}

export function EntitySphere({
  x,
  y,
  radius,
  entityType,
  seedKey,
  isSelected,
  isHovered,
  detailLevel = "full",
  onSelect,
  onHover,
  onHoverMove,
  onHoverEnd,
}: EntitySphereProps) {
  const scale = isSelected ? 1.35 : isHovered ? 1.2 : 1;

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(event.nativeEvent.clientX, event.nativeEvent.clientY);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverMove(event.nativeEvent.clientX, event.nativeEvent.clientY);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHoverEnd();
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <group position={[x, y, 0]} scale={scale}>
      <EntitySphereVisual
        radius={radius}
        entityType={entityType}
        seedKey={seedKey}
        isSelected={isSelected}
        isHovered={isHovered}
        detailLevel={detailLevel}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerOver={handlePointerOver}
      />
    </group>
  );
}
