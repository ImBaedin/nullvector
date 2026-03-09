export type RGB = [number, number, number];

export type ArmWeight = {
	count: number;
	weight: number;
};

export type GalaxyProfile = {
	id: string;
	armWeights: ArmWeight[];
	minTurns: number;
	maxTurns: number;
	minRadius: number;
	maxRadius: number;
	minTriangles: number;
	maxTriangles: number;
	minSections: number;
	maxSections: number;
	minCoreRadiusScale: number;
	maxCoreRadiusScale: number;
	minCoreHeightScale: number;
	maxCoreHeightScale: number;
	minArmWidthStartScale: number;
	maxArmWidthStartScale: number;
	minArmWidthEndScale: number;
	maxArmWidthEndScale: number;
	minArmHeightStartScale: number;
	maxArmHeightStartScale: number;
	minArmHeightEndScale: number;
	maxArmHeightEndScale: number;
	dustEnabled: boolean;
	dustVolumeMin: number;
	dustVolumeMax: number;
	coreInnerColor: RGB;
	coreOuterColor: RGB;
	armInnerColor: RGB;
	armOuterColor: RGB;
	dustColor: RGB;
};

export const DEFAULT_PROFILE_ID = "spiral-volumetric-v2";

const profiles = new Map<string, GalaxyProfile>([
	[
		DEFAULT_PROFILE_ID,
		{
			id: DEFAULT_PROFILE_ID,
			armWeights: [
				{ count: 1, weight: 0.15 },
				{ count: 2, weight: 0.7 },
				{ count: 3, weight: 0.15 },
			],
			minTurns: 1.05,
			maxTurns: 1.75,
			minRadius: 56,
			maxRadius: 92,
			minTriangles: 500,
			maxTriangles: 5000,
			minSections: 32,
			maxSections: 46,
			minCoreRadiusScale: 0.14,
			maxCoreRadiusScale: 0.22,
			minCoreHeightScale: 0.18,
			maxCoreHeightScale: 0.3,
			minArmWidthStartScale: 0.22,
			maxArmWidthStartScale: 0.34,
			minArmWidthEndScale: 0.03,
			maxArmWidthEndScale: 0.08,
			minArmHeightStartScale: 0.1,
			maxArmHeightStartScale: 0.16,
			minArmHeightEndScale: 0.012,
			maxArmHeightEndScale: 0.04,
			dustEnabled: false,
			dustVolumeMin: 0,
			dustVolumeMax: 0,
			coreInnerColor: [1.0, 0.96, 0.78],
			coreOuterColor: [1.0, 0.66, 0.34],
			armInnerColor: [0.98, 0.33, 0.44],
			armOuterColor: [0.28, 0.34, 0.84],
			dustColor: [0.74, 0.64, 0.92],
		},
	],
	[
		"spiral-lowpoly-v1",
		{
			id: "spiral-lowpoly-v1",
			armWeights: [
				{ count: 1, weight: 0.2 },
				{ count: 2, weight: 0.6 },
				{ count: 3, weight: 0.2 },
			],
			minTurns: 1.1,
			maxTurns: 1.9,
			minRadius: 56,
			maxRadius: 92,
			minTriangles: 500,
			maxTriangles: 6000,
			minSections: 26,
			maxSections: 40,
			minCoreRadiusScale: 0.12,
			maxCoreRadiusScale: 0.2,
			minCoreHeightScale: 0.14,
			maxCoreHeightScale: 0.24,
			minArmWidthStartScale: 0.2,
			maxArmWidthStartScale: 0.32,
			minArmWidthEndScale: 0.06,
			maxArmWidthEndScale: 0.12,
			minArmHeightStartScale: 0.08,
			maxArmHeightStartScale: 0.14,
			minArmHeightEndScale: 0.03,
			maxArmHeightEndScale: 0.06,
			dustEnabled: true,
			dustVolumeMin: 4,
			dustVolumeMax: 10,
			coreInnerColor: [1.0, 0.95, 0.76],
			coreOuterColor: [0.98, 0.62, 0.38],
			armInnerColor: [0.95, 0.36, 0.46],
			armOuterColor: [0.34, 0.38, 0.78],
			dustColor: [0.72, 0.62, 0.9],
		},
	],
]);

export function getProfile(profileId: string) {
	const profile = profiles.get(profileId);
	if (!profile) {
		throw new Error(`Unknown profile: ${profileId}`);
	}
	return profile;
}

export function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
	return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
