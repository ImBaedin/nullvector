import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { type OrthographicCamera, Vector2, type Vector3 } from "three";

import { createNebulaMaterial } from "./nebula-shader";

type BasicMapControls = {
  target: Vector3;
};

type NebulaBackgroundProps = {
  controlsRef: RefObject<BasicMapControls | null>;
};

const SCREEN_QUAD_SIZE = 2; // Full-screen clip-space quad size.
const PARALLAX_EPSILON = 0.000_1; // Safety floor to avoid divide/log instability.
const MAX_WORLD_DELTA_PER_FRAME = 9_000; // Clamp for large camera jumps per frame.
const PARALLAX_WORLD_TO_UV = 0.0006; // Converts world pan delta into shader UV shift.
const PARALLAX_ZOOM_SCALE = 1; // Multiplier for zoom influence on pan parallax.
const ZOOM_TO_NEBULA_STRENGTH = 0.09; // How much camera zoom scales nebula UVs.
const ZOOM_TO_NEBULA_MIN_SCALE = 0.74; // Lower clamp for nebula zoom scaling.
const ZOOM_TO_NEBULA_MAX_SCALE = 1.26; // Upper clamp for nebula zoom scaling.
const ZOOM_TO_NEBULA_SMOOTHING = 9; // Interpolation speed for zoom response.
const EPOCH_TIME_WRAP_SECONDS = 100_000; // Wrap epoch time for shader float stability.

// Direction mapping matrix (camera right/up deltas -> shader UV deltas)
// Tune only these values to adjust feel and direction.
const PARALLAX_MAP_XX = 1; // Camera right delta contribution to UV.x.
const PARALLAX_MAP_XY = 0; // Camera up delta contribution to UV.x.
const PARALLAX_MAP_YX = 0; // Camera right delta contribution to UV.y.
const PARALLAX_MAP_YY = 1; // Camera up delta contribution to UV.y.

const SCREEN_DETAIL_WIDTH_THRESHOLD = 920; // Lower detail under this viewport width.
const SCREEN_DETAIL_DPR_THRESHOLD = 1.8; // Lower detail above this device pixel ratio.

function getDetailSetting(width: number) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (
    width < SCREEN_DETAIL_WIDTH_THRESHOLD ||
    dpr > SCREEN_DETAIL_DPR_THRESHOLD
  ) {
    return 0.72;
  }
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function NebulaBackground({ controlsRef }: NebulaBackgroundProps) {
  const camera = useThree((state) => state.camera as OrthographicCamera);
  const size = useThree((state) => state.size);
  const previousCameraRef = useRef<{ x: number; y: number; z: number } | null>(
    null
  );
  const baseZoomRef = useRef<number | null>(null);
  const previousTargetRef = useRef<Vector2 | null>(null);
  const appearanceDetailRef = useRef(1);
  const parallaxOffsetRef = useRef(new Vector2(0, 0));
  const viewScaleRef = useRef(1);
  const material = useMemo(() => createNebulaMaterial(), []);

  useEffect(() => {
    material.depthWrite = false;
    material.depthTest = false;
    material.transparent = false;
    appearanceDetailRef.current = material.uniforms.uDetail.value;
    material.uniforms.uResolution.value.set(size.width, size.height);
    material.uniforms.uDetail.value =
      appearanceDetailRef.current * getDetailSetting(size.width);
  }, [material, size.height, size.width]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((_, delta) => {
    const matrix = camera.matrixWorld.elements;
    const rightX = matrix[0];
    const rightY = matrix[1];
    const rightZ = matrix[2];
    const upX = matrix[4];
    const upY = matrix[5];
    const upZ = matrix[6];

    if (!previousCameraRef.current) {
      previousCameraRef.current = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
    }

    const previousCamera = previousCameraRef.current;
    const deltaX = camera.position.x - previousCamera.x;
    const deltaY = camera.position.y - previousCamera.y;
    const deltaZ = camera.position.z - previousCamera.z;
    previousCamera.x = camera.position.x;
    previousCamera.y = camera.position.y;
    previousCamera.z = camera.position.z;

    const cameraDeltaRight = clamp(
      deltaX * rightX + deltaY * rightY + deltaZ * rightZ,
      -MAX_WORLD_DELTA_PER_FRAME,
      MAX_WORLD_DELTA_PER_FRAME
    );
    const cameraDeltaUp = clamp(
      deltaX * upX + deltaY * upY + deltaZ * upZ,
      -MAX_WORLD_DELTA_PER_FRAME,
      MAX_WORLD_DELTA_PER_FRAME
    );

    const zoomFactor =
      Math.max(camera.zoom, PARALLAX_EPSILON) * PARALLAX_ZOOM_SCALE;
    const mappedU =
      (cameraDeltaRight * PARALLAX_MAP_XX + cameraDeltaUp * PARALLAX_MAP_XY) *
      PARALLAX_WORLD_TO_UV *
      zoomFactor;
    const mappedV =
      (cameraDeltaRight * PARALLAX_MAP_YX + cameraDeltaUp * PARALLAX_MAP_YY) *
      PARALLAX_WORLD_TO_UV *
      zoomFactor;

    parallaxOffsetRef.current.x += mappedU;
    parallaxOffsetRef.current.y += mappedV;

    if (baseZoomRef.current === null) {
      baseZoomRef.current = Math.max(camera.zoom, PARALLAX_EPSILON);
    }
    const zoomLogDelta = Math.log2(
      Math.max(camera.zoom, PARALLAX_EPSILON) /
        Math.max(baseZoomRef.current, PARALLAX_EPSILON)
    );
    const targetViewScale = clamp(
      1 - zoomLogDelta * ZOOM_TO_NEBULA_STRENGTH,
      ZOOM_TO_NEBULA_MIN_SCALE,
      ZOOM_TO_NEBULA_MAX_SCALE
    );
    const zoomAlpha = 1 - Math.exp(-ZOOM_TO_NEBULA_SMOOTHING * delta);
    viewScaleRef.current += (targetViewScale - viewScaleRef.current) * zoomAlpha;

    const target = controlsRef.current?.target;
    if (target) {
      if (!previousTargetRef.current) {
        previousTargetRef.current = new Vector2(target.x, target.y);
      }

      const targetDeltaX = target.x - previousTargetRef.current.x;
      const targetDeltaY = target.y - previousTargetRef.current.y;
      previousTargetRef.current.set(target.x, target.y);

      const targetJumpMagnitude = Math.hypot(targetDeltaX, targetDeltaY);
      if (targetJumpMagnitude > 20_000) {
        parallaxOffsetRef.current.multiplyScalar(0.6);
      }
    }

    material.uniforms.uTime.value =
      (Date.now() * 0.001) % EPOCH_TIME_WRAP_SECONDS;
    material.uniforms.uParallaxOffset.value.copy(parallaxOffsetRef.current);
    material.uniforms.uViewScale.value = viewScaleRef.current;
  });

  return (
    <mesh
      frustumCulled={false}
      position={[0, 0, 0]}
      raycast={() => {}}
      renderOrder={-100}
    >
      <planeGeometry args={[SCREEN_QUAD_SIZE, SCREEN_QUAD_SIZE]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}
