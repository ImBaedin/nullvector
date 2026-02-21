import { Clone, useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import { AdditiveBlending, Box3, Color, DoubleSide, Sphere } from "three";
import type { Group, ShaderMaterial } from "three";

import { getEntityVisualPreset, hashStringToUnit } from "./entity-visuals";
import type { ExplorerEntityType, ExplorerResolvedQuality } from "../types";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

const GALAXY_MODEL_COUNT = 16;
const GALAXY_MODEL_BASE_PATH = "/models/galaxy";
const GALAXY_MODEL_VISUAL_SCALE = 2;
const galaxyBaseRadiusCache = new Map<string, number>();
const GALAXY_VFX_TUNING = {
  glow: {
    ringScale: [1.1, 1.1, 0.2] as [number, number, number],
    ringInnerRadiusMul: 0.75,
    ringOuterRadiusMul: 1.18,
    ringOpacityMul: 0.42,
    sphereScale: [1.18, 1.18, 0.34] as [number, number, number],
    sphereRadiusMul: 0.95,
    sphereOpacityMul: 0.2,
  },
  fog: {
    occlusion: {
      meshScale: [2, 2, 2] as [number, number, number],
      sphereRadiusMul: 1.12,
      opacityBase: 0.1,
      opacityGlowMul: 1.25,
      opacityHoverBoost: 0.18,
      opacitySelectedBoost: 0.25,
      centerStart: 0.0,
      centerEnd: 0.85,
      edgeStart: 0.55,
      edgeEnd: 1.12,
      verticalStart: 0.05,
      verticalEnd: 1.0,
      edgeFadeStart: 0.95,
      edgeFadeEnd: 1.18,
      alphaCenterMul: 1.05,
      alphaEdgeMul: 0.42,
      alphaNoiseBase: 0.7,
      alphaNoiseMul: 0.6,
    },
    haze: {
      meshScale: [1.44, 1.44, 1] as [number, number, number],
      circleRadiusMul: 1.38,
      opacityBase: 0.1,
      opacityGlowMul: 0.95,
      opacityHoverBoost: 0.12,
      opacitySelectedBoost: 0.18,
      bodyStart: 0.22,
      bodyEnd: 1.08,
      edgeFadeStart: 0.82,
      edgeFadeEnd: 1.14,
      alphaNoiseBase: 0.6,
      alphaNoiseMul: 0.85,
    },
  },
};

function getGalaxyModelPath(seedKey: string) {
  const modelIndex =
    Math.floor(hashStringToUnit(seedKey) * GALAXY_MODEL_COUNT) %
    GALAXY_MODEL_COUNT;
  return `${GALAXY_MODEL_BASE_PATH}/galaxy-${modelIndex
    .toString()
    .padStart(3, "0")}.glb`;
}

for (let index = 0; index < GALAXY_MODEL_COUNT; index += 1) {
  const path = `${GALAXY_MODEL_BASE_PATH}/galaxy-${index
    .toString()
    .padStart(3, "0")}.glb`;
  useGLTF.preload(path);
}

type EntitySphereVisualProps = {
  radius: number;
  entityType: ExplorerEntityType;
  seedKey: string;
  quality: ExplorerResolvedQuality;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel: "full" | "compact";
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

type GalaxyDiscVisualProps = {
  radius: number;
  detailLevel: "full" | "compact";
  quality: ExplorerResolvedQuality;
  coreColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
  ringColor: string;
  ringOpacity: number;
  ringRotationRad: number;
  haloColor: string;
  haloOpacity: number;
  shellColor: string;
  shellOpacity: number;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void;
};

type GalaxyModelVisualProps = {
  radius: number;
  modelPath: string;
  quality: ExplorerResolvedQuality;
  spinSpeedRadPerSec: number;
  glowColor: string;
  glowOpacity: number;
  isSelected: boolean;
  isHovered: boolean;
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
  quality?: ExplorerResolvedQuality;
  isSelected: boolean;
  isHovered: boolean;
  detailLevel?: "full" | "compact";
  onSelect: () => void;
  onHover: (screenX: number, screenY: number) => void;
  onHoverMove: (screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

function GalaxyDiscVisual({
  radius,
  detailLevel,
  quality,
  coreColor,
  emissiveColor,
  emissiveIntensity,
  ringColor,
  ringOpacity,
  ringRotationRad,
  haloColor,
  haloOpacity,
  shellColor,
  shellOpacity,
  onClick,
  onPointerOver,
  onPointerMove,
  onPointerOut,
}: GalaxyDiscVisualProps) {
  const polyDetail = detailLevel === "compact" ? 0 : 1;
  const ringSegments =
    quality === "high" ? (detailLevel === "compact" ? 24 : 36) : 20;

  return (
    <>
      <mesh
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onPointerOver={onPointerOver}
        renderOrder={25}
        scale={[1.95, 1.95, 0.44]}
      >
        <icosahedronGeometry args={[radius * 0.42, polyDetail]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.5}
          metalness={0.06}
          flatShading
        />
      </mesh>

      <mesh renderOrder={24} scale={[1.2, 1.2, 0.22]} raycast={() => {}}>
        <dodecahedronGeometry args={[radius * 0.33, 0]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={emissiveColor}
          emissiveIntensity={Math.min(1, emissiveIntensity + 0.18)}
          roughness={0.35}
          metalness={0.08}
          flatShading
        />
      </mesh>

      <mesh
        rotation={[0, 0, ringRotationRad]}
        renderOrder={19}
        raycast={() => {}}
      >
        <ringGeometry args={[radius * 1.05, radius * 2.25, ringSegments]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={ringOpacity * 0.95}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        rotation={[0, 0, ringRotationRad + 0.75]}
        scale={[1, 0.72, 1]}
        renderOrder={18}
        raycast={() => {}}
      >
        <ringGeometry args={[radius * 1.25, radius * 2.05, ringSegments]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={haloOpacity * 0.85}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh renderOrder={12} scale={[2.1, 2.1, 0.2]} raycast={() => {}}>
        <icosahedronGeometry args={[radius * 0.52, 0]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={haloOpacity * 0.9}
          depthWrite={false}
        />
      </mesh>

      {detailLevel === "full" ? (
        <mesh scale={[1.7, 1.7, 0.34]} renderOrder={18} raycast={() => {}}>
          <icosahedronGeometry args={[radius * 0.4, 0]} />
          <meshBasicMaterial
            color={shellColor}
            transparent
            opacity={shellOpacity * 0.6}
            wireframe
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </>
  );
}

function GalaxyModelVisual({
  radius,
  modelPath,
  quality,
  spinSpeedRadPerSec,
  glowColor,
  glowOpacity,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerMove,
  onPointerOut,
}: GalaxyModelVisualProps) {
  const rootRef = useRef<Group | null>(null);
  const occlusionFogMaterialRef = useRef<ShaderMaterial | null>(null);
  const hazeFogMaterialRef = useRef<ShaderMaterial | null>(null);
  const gltf = useGLTF(modelPath);
  const baseRadius = useMemo(() => {
    const cachedRadius = galaxyBaseRadiusCache.get(modelPath);
    if (cachedRadius !== undefined) {
      return cachedRadius;
    }

    const bounds = new Box3().setFromObject(gltf.scene);
    const sphere = new Sphere();
    bounds.getBoundingSphere(sphere);
    const computedRadius = Math.max(sphere.radius, Number.EPSILON);
    galaxyBaseRadiusCache.set(modelPath, computedRadius);
    return computedRadius;
  }, [gltf.scene, modelPath]);
  const modelScale = (radius / baseRadius) * GALAXY_MODEL_VISUAL_SCALE;
  const tuning = GALAXY_VFX_TUNING;
  const activeGlowOpacity = clamp01(
    0.12 + glowOpacity + (isHovered ? 0.14 : 0) + (isSelected ? 0.2 : 0)
  );
  const occlusionOpacity = clamp01(
    tuning.fog.occlusion.opacityBase +
      glowOpacity * tuning.fog.occlusion.opacityGlowMul +
      (isHovered ? tuning.fog.occlusion.opacityHoverBoost : 0) +
      (isSelected ? tuning.fog.occlusion.opacitySelectedBoost : 0)
  );
  const hazeOpacity = clamp01(
    tuning.fog.haze.opacityBase +
      glowOpacity * tuning.fog.haze.opacityGlowMul +
      (isHovered ? tuning.fog.haze.opacityHoverBoost : 0) +
      (isSelected ? tuning.fog.haze.opacitySelectedBoost : 0)
  );
  const occlusionFogUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRadius: { value: radius * 1.04 },
      uOpacity: { value: occlusionOpacity },
      uInnerColor: { value: new Color("#141127") },
      uOuterColor: { value: new Color("#2b3566") },
    }),
    [occlusionOpacity, radius]
  );
  const hazeFogUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRadius: { value: radius * 1.28 },
      uOpacity: { value: hazeOpacity },
      uColorA: { value: new Color(glowColor).multiplyScalar(1.15) },
      uColorB: { value: new Color("#8ea2ff") },
    }),
    [glowColor, hazeOpacity, radius]
  );

  useFrame((_, delta) => {
    if (!rootRef.current) {
      return;
    }
    rootRef.current.rotation.z += delta * spinSpeedRadPerSec;
    if (occlusionFogMaterialRef.current) {
      occlusionFogMaterialRef.current.uniforms.uTime.value += delta;
      occlusionFogMaterialRef.current.uniforms.uOpacity.value =
        occlusionOpacity;
    }
    if (hazeFogMaterialRef.current) {
      hazeFogMaterialRef.current.uniforms.uTime.value += delta;
      hazeFogMaterialRef.current.uniforms.uOpacity.value = hazeOpacity;
    }
  });

  return (
    <group
      ref={rootRef}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onPointerOver={onPointerOver}
      rotation={[0, 0, 0]}
    >
      <group scale={[modelScale, modelScale, modelScale]}>
        <Clone object={gltf.scene} />
      </group>
      <mesh
        scale={tuning.glow.ringScale}
        renderOrder={8}
        raycast={() => {}}
        rotation={[0, 0, 0.2]}
      >
        <ringGeometry
          args={[
            radius * tuning.glow.ringInnerRadiusMul,
            radius * tuning.glow.ringOuterRadiusMul,
            quality === "high" ? 36 : 24,
          ]}
        />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={activeGlowOpacity * tuning.glow.ringOpacityMul}
          side={DoubleSide}
          blending={AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={tuning.glow.sphereScale} renderOrder={7} raycast={() => {}}>
        <sphereGeometry
          args={[
            radius * tuning.glow.sphereRadiusMul,
            quality === "high" ? 16 : 12,
            quality === "high" ? 12 : 8,
          ]}
        />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={activeGlowOpacity * tuning.glow.sphereOpacityMul}
          blending={AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh
        scale={tuning.fog.occlusion.meshScale}
        renderOrder={13}
        raycast={() => {}}
      >
        <sphereGeometry
          args={[
            radius * tuning.fog.occlusion.sphereRadiusMul,
            quality === "high" ? 28 : 18,
            quality === "high" ? 18 : 12,
          ]}
        />
        <shaderMaterial
          ref={occlusionFogMaterialRef}
          transparent
          side={DoubleSide}
          depthTest={false}
          depthWrite={false}
          uniforms={occlusionFogUniforms}
          vertexShader={`
            varying vec3 vLocalPos;
            void main() {
              vLocalPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uRadius;
            uniform float uOpacity;
            uniform vec3 uInnerColor;
            uniform vec3 uOuterColor;
            varying vec3 vLocalPos;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(a, b, u.x) +
                     (c - a) * u.y * (1.0 - u.x) +
                     (d - b) * u.x * u.y;
            }

            void main() {
              float radial = length(vLocalPos.xy) / max(uRadius, 0.0001);
              float vertical = abs(vLocalPos.z) / max(uRadius * 0.62, 0.0001);
              float centerMask = 1.0 - smoothstep(${tuning.fog.occlusion.centerStart.toFixed(
                3
              )}, ${tuning.fog.occlusion.centerEnd.toFixed(3)}, radial);
              float edgeMask = 1.0 - smoothstep(${tuning.fog.occlusion.edgeStart.toFixed(
                3
              )}, ${tuning.fog.occlusion.edgeEnd.toFixed(3)}, radial);
              float verticalMask = 1.0 - smoothstep(${tuning.fog.occlusion.verticalStart.toFixed(
                3
              )}, ${tuning.fog.occlusion.verticalEnd.toFixed(3)}, vertical);
              float edgeFade = 1.0 - smoothstep(${tuning.fog.occlusion.edgeFadeStart.toFixed(
                3
              )}, ${tuning.fog.occlusion.edgeFadeEnd.toFixed(3)}, radial);

              float layerA = noise(vLocalPos.xy * 0.09 + vec2(uTime * 0.08, -uTime * 0.05));
              float layerB = noise(vLocalPos.xy * 0.16 + vec2(-uTime * 0.06, uTime * 0.07));
              float noiseField = mix(layerA, layerB, 0.45);

              float alpha = (centerMask * ${tuning.fog.occlusion.alphaCenterMul.toFixed(
                3
              )} + edgeMask * ${tuning.fog.occlusion.alphaEdgeMul.toFixed(
            3
          )}) * verticalMask;
              alpha *= (${tuning.fog.occlusion.alphaNoiseBase.toFixed(
                3
              )} + noiseField * ${tuning.fog.occlusion.alphaNoiseMul.toFixed(
            3
          )});
              alpha *= edgeFade * uOpacity;

              if (alpha < 0.01) {
                discard;
              }

              vec3 fogColor = mix(uOuterColor, uInnerColor, centerMask);
              gl_FragColor = vec4(fogColor, alpha);
            }
          `}
        />
      </mesh>
      <mesh
        scale={tuning.fog.haze.meshScale}
        renderOrder={12}
        raycast={() => {}}
      >
        <circleGeometry
          args={[radius * tuning.fog.haze.circleRadiusMul, quality === "high" ? 52 : 30]}
        />
        <shaderMaterial
          ref={hazeFogMaterialRef}
          transparent
          side={DoubleSide}
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={hazeFogUniforms}
          vertexShader={`
            varying vec3 vLocalPos;
            void main() {
              vLocalPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uRadius;
            uniform float uOpacity;
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            varying vec3 vLocalPos;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(a, b, u.x) +
                     (c - a) * u.y * (1.0 - u.x) +
                     (d - b) * u.x * u.y;
            }

            void main() {
              float radial = length(vLocalPos.xy) / max(uRadius, 0.0001);
              float bodyMask = 1.0 - smoothstep(${tuning.fog.haze.bodyStart.toFixed(
                3
              )}, ${tuning.fog.haze.bodyEnd.toFixed(3)}, radial);
              float edgeFade = 1.0 - smoothstep(${tuning.fog.haze.edgeFadeStart.toFixed(
                3
              )}, ${tuning.fog.haze.edgeFadeEnd.toFixed(3)}, radial);

              float nA = noise(vLocalPos.xy * 0.18 + vec2(uTime * 0.09, -uTime * 0.07));
              float nB = noise(vLocalPos.xy * 0.34 + vec2(-uTime * 0.06, uTime * 0.08));
              float noiseField = mix(nA, nB, 0.45);

              float alpha = bodyMask * edgeFade * (${tuning.fog.haze.alphaNoiseBase.toFixed(
                3
              )} + noiseField * ${tuning.fog.haze.alphaNoiseMul.toFixed(
            3
          )}) * uOpacity;

              if (alpha < 0.01) {
                discard;
              }

              vec3 hazeColor = mix(uColorA, uColorB, noiseField);
              gl_FragColor = vec4(hazeColor, alpha);
            }
          `}
        />
      </mesh>
    </group>
  );
}

export function EntitySphereVisual({
  radius,
  entityType,
  seedKey,
  quality,
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
  const segmentCount =
    quality === "high" ? (detailLevel === "compact" ? 18 : 22) : 14;

  if (entityType === "galaxy") {
    const modelPath = getGalaxyModelPath(seedKey);
    const spinSpeedRadPerSec = 0.04 + hashStringToUnit(seedKey) * 0.08;
    const shouldUseModel = quality === "high";

    if (!shouldUseModel) {
      return (
        <GalaxyDiscVisual
          radius={radius}
          detailLevel={detailLevel}
          quality={quality}
          coreColor={preset.coreColor}
          emissiveColor={preset.emissiveColor}
          emissiveIntensity={emissiveIntensity}
          ringColor={preset.ringColor}
          ringOpacity={ringOpacity}
          ringRotationRad={preset.ringRotationRad}
          haloColor={preset.haloColor}
          haloOpacity={haloOpacity}
          shellColor={preset.shellColor}
          shellOpacity={shellOpacity}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerMove={onPointerMove}
          onPointerOut={onPointerOut}
        />
      );
    }

    return (
      <Suspense
        fallback={
          <GalaxyDiscVisual
            radius={radius}
            detailLevel={detailLevel}
            quality={quality}
            coreColor={preset.coreColor}
            emissiveColor={preset.emissiveColor}
            emissiveIntensity={emissiveIntensity}
            ringColor={preset.ringColor}
            ringOpacity={ringOpacity}
            ringRotationRad={preset.ringRotationRad}
            haloColor={preset.haloColor}
            haloOpacity={haloOpacity}
            shellColor={preset.shellColor}
            shellOpacity={shellOpacity}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerMove={onPointerMove}
            onPointerOut={onPointerOut}
          />
        }
      >
        <GalaxyModelVisual
          radius={radius}
          modelPath={modelPath}
          quality={quality}
          spinSpeedRadPerSec={spinSpeedRadPerSec}
          glowColor={preset.haloColor}
          glowOpacity={haloOpacity}
          isSelected={isSelected}
          isHovered={isHovered}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerMove={onPointerMove}
          onPointerOut={onPointerOut}
        />
      </Suspense>
    );
  }

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
        <sphereGeometry args={[radius, quality === "high" ? 16 : 12, quality === "high" ? 16 : 12]} />
        <meshBasicMaterial
          color={preset.haloColor}
          transparent
          opacity={haloOpacity}
          depthWrite={false}
        />
      </mesh>

      {detailLevel === "full" && preset.hasShell ? (
        <mesh scale={preset.shellScale} renderOrder={18} raycast={() => {}}>
          <sphereGeometry args={[radius, quality === "high" ? 14 : 10, quality === "high" ? 14 : 10]} />
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
              quality === "high" ? 48 : 24,
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
  quality = "high",
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
        quality={quality}
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
