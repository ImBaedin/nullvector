import { MapControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type { Vector3 } from "three";

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

const GRID_SIZE = 120_000;
const GRID_DIVISIONS = 1_200;
const GRID_Z = -150;
const ISOMETRIC_CAMERA_OFFSET = {
  x: 3_000,
  y: -3_000,
  z: 3_000,
} as const;

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
      <gridHelper
        args={[GRID_SIZE, GRID_DIVISIONS, "#27374d", "#121c2d"]}
        position={[0, 0, GRID_Z]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => {}}
      />

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
