import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, type RefObject } from "react";
import type { OrthographicCamera, Vector3 } from "three";

import { CameraFocusController } from "../hooks/use-camera-focus";
import type { CameraFocusTarget } from "../types";

type BasicMapControls = {
  target: Vector3;
  update: () => void;
};

type ExplorerCanvasProps = {
  focusTarget: CameraFocusTarget | null;
  onPointerMissed: () => void;
  children: React.ReactNode;
};

const GRID_Z = -150;
const TARGET_MINOR_CELL_PIXELS = 56;
const MAJOR_GRID_MULTIPLIER = 5;
const MAJOR_DIVISIONS = 28;
const ISOMETRIC_CAMERA_OFFSET = {
  x: 3_000,
  y: -3_000,
  z: 3_000,
} as const;

type AdaptiveGridConfig = {
  centerX: number;
  centerY: number;
  size: number;
  majorDivisions: number;
  minorDivisions: number;
};

function getNiceStep(step: number) {
  const safeStep = Math.max(step, Number.EPSILON);
  const exponent = Math.floor(Math.log10(safeStep));
  const base = 10 ** exponent;
  const normalized = safeStep / base;

  if (normalized <= 1) return base;
  if (normalized <= 2) return 2 * base;
  if (normalized <= 5) return 5 * base;
  return 10 * base;
}

function snapToStep(value: number, step: number) {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return Math.round(value / step) * step;
}

function getGridConfig({
  zoom,
  centerX,
  centerY,
}: {
  zoom: number;
  centerX: number;
  centerY: number;
}): AdaptiveGridConfig {
  const safeZoom = Math.max(zoom, Number.EPSILON);
  const minorStep = getNiceStep(TARGET_MINOR_CELL_PIXELS / safeZoom);
  const majorStep = minorStep * MAJOR_GRID_MULTIPLIER;
  const majorDivisions = MAJOR_DIVISIONS;
  const size = majorDivisions * majorStep;

  return {
    centerX: snapToStep(centerX, majorStep),
    centerY: snapToStep(centerY, majorStep),
    size,
    majorDivisions,
    minorDivisions: majorDivisions * MAJOR_GRID_MULTIPLIER,
  };
}

function getGridConfigKey(config: AdaptiveGridConfig) {
  return [
    config.centerX,
    config.centerY,
    config.size,
    config.majorDivisions,
    config.minorDivisions,
  ].join("|");
}

function AdaptiveGrid({ controlsRef }: { controlsRef: RefObject<BasicMapControls | null> }) {
  const camera = useThree((state) => state.camera);
  const [gridConfig, setGridConfig] = useState<AdaptiveGridConfig>(() =>
    getGridConfig({
      zoom: 0.08,
      centerX: 0,
      centerY: 0,
    }),
  );
  const gridKeyRef = useRef(getGridConfigKey(gridConfig));

  useFrame(() => {
    if (camera.type !== "OrthographicCamera") return;

    const orthographicCamera = camera as OrthographicCamera;
    const target = controlsRef.current?.target;
    const nextGridConfig = getGridConfig({
      zoom: orthographicCamera.zoom,
      centerX: target?.x ?? 0,
      centerY: target?.y ?? 0,
    });
    const nextGridKey = getGridConfigKey(nextGridConfig);
    if (nextGridKey === gridKeyRef.current) return;

    gridKeyRef.current = nextGridKey;
    setGridConfig(nextGridConfig);
  });

  return (
    <>
      <gridHelper
        key={`minor-${gridConfig.size}-${gridConfig.minorDivisions}`}
        args={[gridConfig.size, gridConfig.minorDivisions, "#27374d", "#121c2d"]}
        position={[gridConfig.centerX, gridConfig.centerY, GRID_Z]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={1}
        material-depthWrite={false}
        raycast={() => {}}
      />
      <gridHelper
        key={`major-${gridConfig.size}-${gridConfig.majorDivisions}`}
        args={[gridConfig.size, gridConfig.majorDivisions, "#3e5a78", "#1f3048"]}
        position={[gridConfig.centerX, gridConfig.centerY, GRID_Z + 0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={2}
        material-depthWrite={false}
        raycast={() => {}}
      />
    </>
  );
}

export function ExplorerCanvas({
  focusTarget,
  onPointerMissed,
  children,
}: ExplorerCanvasProps) {
  const controlsRef = useRef<BasicMapControls | null>(null);

  return (
    <Canvas
      orthographic
      camera={{
        position: [
          ISOMETRIC_CAMERA_OFFSET.x,
          ISOMETRIC_CAMERA_OFFSET.y,
          ISOMETRIC_CAMERA_OFFSET.z,
        ],
        up: [0, 0, 1],
        zoom: 0.08,
        near: -100_000,
        far: 100_000,
      }}
      onPointerMissed={onPointerMissed}
    >
      <color attach="background" args={["#030812"]} />
      <ambientLight intensity={0.85} />
      <directionalLight intensity={0.5} position={[0, 0, 500]} />
      <AdaptiveGrid controlsRef={controlsRef} />

      <CameraFocusController
        controlsRef={controlsRef}
        focusTarget={focusTarget}
        cameraOffset={ISOMETRIC_CAMERA_OFFSET}
      />

      {children}

      <MapControls
        ref={(instance) => {
          controlsRef.current = instance as BasicMapControls | null;
        }}
        makeDefault
        enableRotate={false}
        screenSpacePanning
        minZoom={0.015}
        maxZoom={24}
        zoomSpeed={0.8}
        panSpeed={1.2}
      />
    </Canvas>
  );
}
