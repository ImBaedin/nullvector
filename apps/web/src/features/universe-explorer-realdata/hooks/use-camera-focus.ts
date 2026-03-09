import type { OrthographicCamera, Vector3 } from "three";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import type { CameraFocusTarget } from "../types";

import { computeOrbitWorldPosition } from "../lib/orbits";

type BasicMapControls = {
	target: Vector3;
	update: () => void;
};

type CameraFocusControllerProps = {
	controlsRef: React.RefObject<BasicMapControls | null>;
	focusTarget: CameraFocusTarget | null;
	mode: "free" | "followPlanet";
	trackingOrbit?: {
		centerX: number;
		centerY: number;
		orbitRadius: number;
		orbitPhaseRad: number;
		orbitAngularVelocityRadPerSec: number;
		orbitEpochMs: number;
	} | null;
	cameraOffset: {
		x: number;
		y: number;
		z: number;
	};
};

const POSITION_DAMPING = 8;
const EPSILON = 0.005;
type CameraControllerState = "free" | "transition" | "follow";

function smoothStep(from: number, to: number, delta: number) {
	const alpha = 1 - Math.exp(-POSITION_DAMPING * delta);
	return from + (to - from) * alpha;
}

export function CameraFocusController({
	controlsRef,
	focusTarget,
	mode,
	trackingOrbit = null,
	cameraOffset,
}: CameraFocusControllerProps) {
	const camera = useThree((state) => state.camera as OrthographicCamera);
	const goal = useRef<CameraFocusTarget | null>(focusTarget);
	const state = useRef<CameraControllerState>("free");

	useEffect(() => {
		goal.current = focusTarget;
		if (focusTarget) {
			state.current = "transition";
		}
	}, [focusTarget]);

	useFrame((_, delta) => {
		const controls = controlsRef.current;
		const nextGoal = goal.current;
		const followOrbit = mode === "followPlanet" ? trackingOrbit : null;

		if (!controls) {
			return;
		}

		if (nextGoal) {
			state.current = "transition";
			const liveTrackingTarget = followOrbit
				? computeOrbitWorldPosition(followOrbit, Date.now())
				: null;
			const targetX = liveTrackingTarget?.x ?? nextGoal.x;
			const targetY = liveTrackingTarget?.y ?? nextGoal.y;
			const nextTargetX = smoothStep(controls.target.x, targetX, delta);
			const nextTargetY = smoothStep(controls.target.y, targetY, delta);
			const desiredCameraX = targetX + cameraOffset.x;
			const desiredCameraY = targetY + cameraOffset.y;
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
				Math.abs(nextCameraZ - desiredCameraZ) < EPSILON &&
				Math.abs(nextZoom - nextGoal.zoom) < EPSILON &&
				(mode === "followPlanet" ||
					(Math.abs(nextTargetX - nextGoal.x) < EPSILON &&
						Math.abs(nextTargetY - nextGoal.y) < EPSILON &&
						Math.abs(nextCameraX - desiredCameraX) < EPSILON &&
						Math.abs(nextCameraY - desiredCameraY) < EPSILON));

			if (closeEnough) {
				goal.current = null;
			}

			if (goal.current) {
				return;
			}
		}

		if (followOrbit) {
			state.current = "follow";
		} else {
			state.current = "free";
		}

		if (state.current !== "follow" || !followOrbit) {
			return;
		}

		const liveTrackingTarget = computeOrbitWorldPosition(followOrbit, Date.now());
		const lockedTargetX = smoothStep(controls.target.x, liveTrackingTarget.x, delta);
		const lockedTargetY = smoothStep(controls.target.y, liveTrackingTarget.y, delta);
		const lockedCameraX = smoothStep(
			camera.position.x,
			liveTrackingTarget.x + cameraOffset.x,
			delta,
		);
		const lockedCameraY = smoothStep(
			camera.position.y,
			liveTrackingTarget.y + cameraOffset.y,
			delta,
		);

		controls.target.set(lockedTargetX, lockedTargetY, 0);
		camera.position.set(lockedCameraX, lockedCameraY, camera.position.z);
		controls.update();
	});

	return null;
}
