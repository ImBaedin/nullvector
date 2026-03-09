import { shaderMaterial } from "@react-three/drei";
import { Color, type ShaderMaterial, Vector2 } from "three";

export type NebulaAppearance = {
	backgroundColor: string;
	blueA: string;
	blueB: string;
	purpleA: string;
	purpleB: string;
	tealA: string;
	tealB: string;
	roseA: string;
	goldA: string;
	emeraldA: string;
	veinBlue: string;
	veinPurple: string;
	opacity: number;
	detail: number;
	timeScale: number;
	bluePurpleMix: number;
	densityGain: number;
	densityBias: number;
	warpStrength: number;
	largeScale: number;
	midScale: number;
	fineScale: number;
	filamentScale: number;
	filamentStrength: number;
	sparkleStrength: number;
	regionContrast: number;
	accentStrength: number;
};

// Primary art-direction knobs. Start here for color, density, and noise look changes.
export const DEFAULT_NEBULA_APPEARANCE: NebulaAppearance = {
	backgroundColor: "#030812", // Base space color behind nebula clouds.
	blueA: "#0a2d73", // Deep blue shadow tone in blue-biased regions.
	blueB: "#2a8dff", // Bright blue highlight tone in blue-biased regions.
	purpleA: "#43229f", // Deep purple shadow tone in purple-biased regions.
	purpleB: "#c052ff", // Bright purple highlight tone in purple-biased regions.
	tealA: "#0f4861", // Deep teal shadow tone in teal-biased regions.
	tealB: "#42d8d2", // Bright teal highlight tone in teal-biased regions.
	roseA: "#ff82c9", // Warm pink accent color for dense pockets.
	goldA: "#ffd17e", // Warm gold accent color mixed with rose.
	emeraldA: "#60ffc0", // Cool accent color that balances warm accents.
	veinBlue: "#84b8ff", // Filament color contribution in blue/teal zones.
	veinPurple: "#d78bff", // Filament color contribution in purple zones.
	opacity: 0.86, // Overall nebula visibility vs. background.
	detail: 1.5, // Fine-noise detail multiplier (lower = smoother, cheaper look).
	timeScale: 0.3, // Global animation speed multiplier.
	bluePurpleMix: 0.58, // Global bias between blue and purple families.
	densityGain: 1, // Increases overall cloud coverage/contrast.
	densityBias: 0.2, // Shifts baseline cloud density before masking.
	warpStrength: 1, // Strength of gaseous flow distortion.
	largeScale: 1.25, // Frequency of broad cloud shapes.
	midScale: 3.25, // Frequency of medium cloud shapes.
	fineScale: 5.4, // Frequency of fine cloud breakup details.
	filamentScale: 10.6, // Frequency of filament/web structures.
	filamentStrength: 0.58, // Intensity of filament contribution.
	sparkleStrength: 0.2, // Intensity of sparse bright sparkles.
	regionContrast: 0.7, // Region separation between blue/purple/teal zones.
	accentStrength: 0.6, // Strength of rose/gold/emerald accent override.
};

const nebulaVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const nebulaFragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uParallaxOffset;
uniform float uViewScale;
uniform float uOpacity;
uniform float uDetail;
uniform float uTimeScale;
uniform float uBluePurpleMix;
uniform float uDensityGain;
uniform float uDensityBias;
uniform float uWarpStrength;
uniform float uLargeScale;
uniform float uMidScale;
uniform float uFineScale;
uniform float uFilamentScale;
uniform float uFilamentStrength;
uniform float uSparkleStrength;
uniform vec3 uBackgroundColor;
uniform vec3 uBlueA;
uniform vec3 uBlueB;
uniform vec3 uPurpleA;
uniform vec3 uPurpleB;
uniform vec3 uTealA;
uniform vec3 uTealB;
uniform vec3 uRoseA;
uniform vec3 uGoldA;
uniform vec3 uEmeraldA;
uniform vec3 uVeinBlue;
uniform vec3 uVeinPurple;
uniform float uRegionContrast;
uniform float uAccentStrength;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(18.73, -11.10);
    amplitude *= 0.5;
  }

  return value;
}

float ridged(vec2 p) {
  float value = 0.0;
  float amplitude = 0.56;

  for (int i = 0; i < 3; i++) {
    float n = noise(p);
    n = 1.0 - abs(n * 2.0 - 1.0);
    value += n * amplitude;
    p = p * 2.38 + vec2(-7.10, 4.80);
    amplitude *= 0.52;
  }

  return value;
}

void main() {
  float t = uTime * uTimeScale;
  vec2 uv = vUv - 0.5;
  uv.x *= uResolution.x / max(uResolution.y, 1.0);

  vec2 baseUv = uv * (1.32 * uViewScale) + uParallaxOffset;

  vec2 flow = vec2(
    fbm(baseUv * 1.12 + vec2(0.0, t * 0.048)),
    fbm(baseUv * 1.08 + vec2(17.0, -t * 0.041))
  );
  vec2 warped = baseUv + (flow - 0.5) * uWarpStrength;

  float cloudLarge = fbm(warped * uLargeScale + vec2(t * 0.018, -t * 0.015));
  float cloudMid = fbm(warped * uMidScale - vec2(t * 0.032, t * 0.027));
  float cloudSmall = fbm(
    warped * (uFineScale * mix(0.86, 1.16, uDetail)) + vec2(-t * 0.061, t * 0.054)
  );

  float density = cloudLarge * 0.56 + cloudMid * 0.32 + cloudSmall * (0.12 * uDetail);
  density = density * uDensityGain + uDensityBias;
  density = smoothstep(0.28, 0.9, density);

  float voidMask = smoothstep(0.18, 0.74, fbm(warped * 0.86 - 4.0));
  density *= voidMask;

  float filaments = ridged(
    warped * uFilamentScale + vec2(t * 0.087, -t * 0.072)
  );
  filaments = pow(clamp(filaments, 0.0, 1.0), mix(2.6, 2.1, uDetail));
  filaments *= uFilamentStrength;

  float sparkles = smoothstep(0.84, 0.97, fbm(warped * 9.8 + vec2(20.0, -13.0) + t * 0.08));
  sparkles *= uSparkleStrength * (0.8 + 0.2 * uDetail);

  float regionA = fbm(baseUv * 0.45 + vec2(4.0, -6.0) + vec2(t * 0.012, -t * 0.010));
  float regionB = fbm(baseUv * 0.43 + vec2(-9.0, 3.0) + vec2(-t * 0.009, t * 0.013));
  float regionC = fbm(baseUv * 0.40 + vec2(12.0, 8.0) + vec2(t * 0.007, t * 0.005));
  float contrastPower = mix(1.6, 0.65, clamp(uRegionContrast, 0.0, 1.0));
  regionA = pow(clamp(regionA, 0.0, 1.0), contrastPower);
  regionB = pow(clamp(regionB, 0.0, 1.0), contrastPower);
  regionC = pow(clamp(regionC, 0.0, 1.0), contrastPower);

  float purpleBias = clamp(uBluePurpleMix, 0.0, 1.0);
  float wBlue = clamp(regionA * (1.08 - purpleBias * 0.55) + (1.0 - density) * 0.16, 0.0, 1.0);
  float wPurple = clamp(regionB * (0.65 + purpleBias * 0.95) + density * 0.24, 0.0, 1.0);
  float wTeal = clamp(regionC * 0.94 + (1.0 - density) * 0.28, 0.0, 1.0);
  float wSum = max(wBlue + wPurple + wTeal, 0.0001);
  wBlue /= wSum;
  wPurple /= wSum;
  wTeal /= wSum;

  vec3 blueNebula = mix(uBlueA, uBlueB, smoothstep(0.10, 0.74, density));
  vec3 purpleNebula = mix(uPurpleA, uPurpleB, smoothstep(0.08, 0.88, density));
  vec3 tealNebula = mix(uTealA, uTealB, smoothstep(0.06, 0.84, density));
  vec3 cloudColor = blueNebula * wBlue + purpleNebula * wPurple + tealNebula * wTeal;

  float accentNoise = fbm(warped * 2.9 + vec2(23.0, -17.0) + vec2(t * 0.011, -t * 0.008));
  float accentMask = smoothstep(
    0.55,
    0.94,
    density + filaments * 0.36 + accentNoise * 0.22
  );
  vec3 warmAccent = mix(uRoseA, uGoldA, smoothstep(0.24, 0.86, regionB + density * 0.2));
  vec3 coolAccent = uEmeraldA;
  vec3 accentColor = mix(coolAccent, warmAccent, smoothstep(0.32, 0.82, regionA + regionB * 0.6));

  vec3 nebula = mix(cloudColor, accentColor, accentMask * uAccentStrength);
  vec3 veinColor = uVeinBlue * wBlue + uVeinPurple * wPurple + mix(uVeinBlue, uVeinPurple, 0.35) * wTeal;
  nebula += veinColor * filaments;
  nebula += vec3(0.95, 0.82, 1.00) * sparkles;

  float vignette = smoothstep(1.42, 0.24, length(uv));
  nebula *= vignette;

  float nebulaMask = clamp(density * uOpacity + filaments * 0.25, 0.0, 1.0);
  vec3 finalColor = mix(uBackgroundColor, nebula, nebulaMask);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

const NebulaShaderMaterial = shaderMaterial(
	{
		uTime: 0,
		uResolution: new Vector2(1, 1),
		uParallaxOffset: new Vector2(0, 0),
		uViewScale: 1,
		uOpacity: DEFAULT_NEBULA_APPEARANCE.opacity,
		uDetail: DEFAULT_NEBULA_APPEARANCE.detail,
		uTimeScale: DEFAULT_NEBULA_APPEARANCE.timeScale,
		uBluePurpleMix: DEFAULT_NEBULA_APPEARANCE.bluePurpleMix,
		uDensityGain: DEFAULT_NEBULA_APPEARANCE.densityGain,
		uDensityBias: DEFAULT_NEBULA_APPEARANCE.densityBias,
		uWarpStrength: DEFAULT_NEBULA_APPEARANCE.warpStrength,
		uLargeScale: DEFAULT_NEBULA_APPEARANCE.largeScale,
		uMidScale: DEFAULT_NEBULA_APPEARANCE.midScale,
		uFineScale: DEFAULT_NEBULA_APPEARANCE.fineScale,
		uFilamentScale: DEFAULT_NEBULA_APPEARANCE.filamentScale,
		uFilamentStrength: DEFAULT_NEBULA_APPEARANCE.filamentStrength,
		uSparkleStrength: DEFAULT_NEBULA_APPEARANCE.sparkleStrength,
		uBackgroundColor: new Color(DEFAULT_NEBULA_APPEARANCE.backgroundColor),
		uBlueA: new Color(DEFAULT_NEBULA_APPEARANCE.blueA),
		uBlueB: new Color(DEFAULT_NEBULA_APPEARANCE.blueB),
		uPurpleA: new Color(DEFAULT_NEBULA_APPEARANCE.purpleA),
		uPurpleB: new Color(DEFAULT_NEBULA_APPEARANCE.purpleB),
		uTealA: new Color(DEFAULT_NEBULA_APPEARANCE.tealA),
		uTealB: new Color(DEFAULT_NEBULA_APPEARANCE.tealB),
		uRoseA: new Color(DEFAULT_NEBULA_APPEARANCE.roseA),
		uGoldA: new Color(DEFAULT_NEBULA_APPEARANCE.goldA),
		uEmeraldA: new Color(DEFAULT_NEBULA_APPEARANCE.emeraldA),
		uVeinBlue: new Color(DEFAULT_NEBULA_APPEARANCE.veinBlue),
		uVeinPurple: new Color(DEFAULT_NEBULA_APPEARANCE.veinPurple),
		uRegionContrast: DEFAULT_NEBULA_APPEARANCE.regionContrast,
		uAccentStrength: DEFAULT_NEBULA_APPEARANCE.accentStrength,
	},
	nebulaVertexShader,
	nebulaFragmentShader,
);

export type NebulaMaterialInstance = ShaderMaterial & {
	uniforms: {
		uTime: { value: number };
		uResolution: { value: Vector2 };
		uParallaxOffset: { value: Vector2 };
		uViewScale: { value: number };
		uOpacity: { value: number };
		uDetail: { value: number };
		uTimeScale: { value: number };
		uBluePurpleMix: { value: number };
		uDensityGain: { value: number };
		uDensityBias: { value: number };
		uWarpStrength: { value: number };
		uLargeScale: { value: number };
		uMidScale: { value: number };
		uFineScale: { value: number };
		uFilamentScale: { value: number };
		uFilamentStrength: { value: number };
		uSparkleStrength: { value: number };
		uBackgroundColor: { value: Color };
		uBlueA: { value: Color };
		uBlueB: { value: Color };
		uPurpleA: { value: Color };
		uPurpleB: { value: Color };
		uTealA: { value: Color };
		uTealB: { value: Color };
		uRoseA: { value: Color };
		uGoldA: { value: Color };
		uEmeraldA: { value: Color };
		uVeinBlue: { value: Color };
		uVeinPurple: { value: Color };
		uRegionContrast: { value: number };
		uAccentStrength: { value: number };
	};
};

export function createNebulaMaterial(appearance = DEFAULT_NEBULA_APPEARANCE) {
	const material = new NebulaShaderMaterial() as unknown as NebulaMaterialInstance;
	applyNebulaAppearance(material, appearance);
	return material;
}

export function applyNebulaAppearance(
	material: NebulaMaterialInstance,
	appearance: NebulaAppearance,
) {
	material.uniforms.uOpacity.value = appearance.opacity;
	material.uniforms.uDetail.value = appearance.detail;
	material.uniforms.uTimeScale.value = appearance.timeScale;
	material.uniforms.uBluePurpleMix.value = appearance.bluePurpleMix;
	material.uniforms.uDensityGain.value = appearance.densityGain;
	material.uniforms.uDensityBias.value = appearance.densityBias;
	material.uniforms.uWarpStrength.value = appearance.warpStrength;
	material.uniforms.uLargeScale.value = appearance.largeScale;
	material.uniforms.uMidScale.value = appearance.midScale;
	material.uniforms.uFineScale.value = appearance.fineScale;
	material.uniforms.uFilamentScale.value = appearance.filamentScale;
	material.uniforms.uFilamentStrength.value = appearance.filamentStrength;
	material.uniforms.uSparkleStrength.value = appearance.sparkleStrength;
	material.uniforms.uRegionContrast.value = appearance.regionContrast;
	material.uniforms.uAccentStrength.value = appearance.accentStrength;
	material.uniforms.uBackgroundColor.value.set(appearance.backgroundColor);
	material.uniforms.uBlueA.value.set(appearance.blueA);
	material.uniforms.uBlueB.value.set(appearance.blueB);
	material.uniforms.uPurpleA.value.set(appearance.purpleA);
	material.uniforms.uPurpleB.value.set(appearance.purpleB);
	material.uniforms.uTealA.value.set(appearance.tealA);
	material.uniforms.uTealB.value.set(appearance.tealB);
	material.uniforms.uRoseA.value.set(appearance.roseA);
	material.uniforms.uGoldA.value.set(appearance.goldA);
	material.uniforms.uEmeraldA.value.set(appearance.emeraldA);
	material.uniforms.uVeinBlue.value.set(appearance.veinBlue);
	material.uniforms.uVeinPurple.value.set(appearance.veinPurple);
}
