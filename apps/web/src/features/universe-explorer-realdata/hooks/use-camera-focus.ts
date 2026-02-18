import { useEffect, useRef } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import type { OrthographicCamera, Vector3 } from "three";

import type { CameraFocusTarget } from "../types";

type BasicMapControls = {
  target: Vector3;
  update: () => void;
};

type CameraFocusControllerProps = {
  controlsRef: React.RefObject<BasicMapControls | null>;
  focusTarget: CameraFocusTarget | null;
  cameraOffset: {
    x: number;
    y: number;
    z: number;
  };
};

const POSITION_DAMPING = 8;
const EPSILON = 0.005;

function smoothStep(from: number, to: number, delta: number) {
  const alpha = 1 - Math.exp(-POSITION_DAMPING * delta);
  return from + (to - from) * alpha;
}

export function CameraFocusController({
  controlsRef,
  focusTarget,
  cameraOffset,
}: CameraFocusControllerProps) {
  const camera = useThree((state) => state.camera as OrthographicCamera);
  const goal = useRef<CameraFocusTarget | null>(focusTarget);

  useEffect(() => {
    goal.current = focusTarget;
  }, [focusTarget]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const nextGoal = goal.current;

    if (!controls || !nextGoal) {
      return;
    }

    const nextTargetX = smoothStep(controls.target.x, nextGoal.x, delta);
    const nextTargetY = smoothStep(controls.target.y, nextGoal.y, delta);
    const desiredCameraX = nextGoal.x + cameraOffset.x;
    const desiredCameraY = nextGoal.y + cameraOffset.y;
    const desiredCameraZ = cameraOffset.z;
    const nextCameraX = smoothStep(camera.position.x, desiredCameraX, delta);
    const nextCameraY = smoothStep(camera.position.y, desiredCameraY, delta);
    const nextCameraZ = smoothStep(camera.position.z, desiredCameraZ, delta);
    const nextZoom = smoothStep(camera.zoom, nextGoal.zoom, delta);

    controls.target.set(nextTargetX, nextTargetY, 0);
    camera.position.set(nextCameraX, nextCameraY, nextCameraZ);
    camera.zoom = nextZoom;
    camera.updateProjectionMatrix();
    controls.update();

    const closeEnough =
      Math.abs(nextTargetX - nextGoal.x) < EPSILON &&
      Math.abs(nextTargetY - nextGoal.y) < EPSILON &&
      Math.abs(nextCameraX - desiredCameraX) < EPSILON &&
      Math.abs(nextCameraY - desiredCameraY) < EPSILON &&
      Math.abs(nextCameraZ - desiredCameraZ) < EPSILON &&
      Math.abs(nextZoom - nextGoal.zoom) < EPSILON;

    if (closeEnough) {
      goal.current = null;
    }
  });

  return null;
}
