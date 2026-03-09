export type OrbitInput = {
	centerX: number;
	centerY: number;
	orbitRadius: number;
	orbitPhaseRad: number;
	orbitAngularVelocityRadPerSec: number;
	orbitEpochMs: number;
};

export type OrbitPosition = {
	x: number;
	y: number;
};

export function computeOrbitWorldPosition(orbit: OrbitInput, nowMs: number): OrbitPosition {
	const elapsedSeconds = (nowMs - orbit.orbitEpochMs) / 1000;
	const angleRad = orbit.orbitPhaseRad + orbit.orbitAngularVelocityRadPerSec * elapsedSeconds;

	return {
		x: orbit.centerX + Math.cos(angleRad) * orbit.orbitRadius,
		y: orbit.centerY + Math.sin(angleRad) * orbit.orbitRadius,
	};
}
