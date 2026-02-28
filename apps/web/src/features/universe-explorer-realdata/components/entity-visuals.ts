import type { ExplorerEntityType } from "../types";

export type EntityVisualPreset = {
  coreColor: string;
  emissiveColor: string;
  coreRoughness: number;
  coreMetalness: number;
  baseEmissiveIntensity: number;
  hoverEmissiveBoost: number;
  selectedEmissiveBoost: number;
  haloColor: string;
  haloScale: number;
  haloOpacity: number;
  hoverHaloBoost: number;
  selectedHaloBoost: number;
  ringColor: string;
  ringOpacity: number;
  ringInnerScale: number;
  ringOuterScale: number;
  ringTiltRad: number;
  ringRotationRad: number;
  hasRing: boolean;
  shellColor: string;
  shellScale: number;
  shellOpacity: number;
  hasShell: boolean;
};

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(
    lightness * 100
  )}%)`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function hashStringToUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

type WeightedPlanetPaletteEntry = {
  hue: number;
  saturation: number;
  lightness: number;
  weight: number;
};

const WEIGHTED_PLANET_PALETTE: WeightedPlanetPaletteEntry[] = [
  { hue: 210, saturation: 0.32, lightness: 0.62, weight: 26 },
  { hue: 192, saturation: 0.3, lightness: 0.6, weight: 19 },
  { hue: 160, saturation: 0.26, lightness: 0.58, weight: 14 },
  { hue: 46, saturation: 0.28, lightness: 0.64, weight: 11 },
  { hue: 268, saturation: 0.3, lightness: 0.63, weight: 8 },
  { hue: 338, saturation: 0.32, lightness: 0.62, weight: 6 },
  { hue: 12, saturation: 0.34, lightness: 0.6, weight: 5 },
  { hue: 28, saturation: 0.34, lightness: 0.61, weight: 4 },
  { hue: 305, saturation: 0.33, lightness: 0.61, weight: 4 },
  { hue: 96, saturation: 0.29, lightness: 0.58, weight: 3 },
];

const PLANET_PALETTE_TOTAL_WEIGHT = WEIGHTED_PLANET_PALETTE.reduce(
  (total, entry) => total + entry.weight,
  0
);

export function getWeightedPlanetColor(seedKey: string) {
  const selectionRoll = hashStringToUnit(`${seedKey}:palette`) * PLANET_PALETTE_TOTAL_WEIGHT;
  let selectedEntry = WEIGHTED_PLANET_PALETTE[0];
  let cumulativeWeight = 0;

  for (const entry of WEIGHTED_PLANET_PALETTE) {
    cumulativeWeight += entry.weight;
    if (selectionRoll <= cumulativeWeight) {
      selectedEntry = entry;
      break;
    }
  }

  const hueJitter = (hashStringToUnit(`${seedKey}:h`) - 0.5) * 6;
  const saturationJitter = (hashStringToUnit(`${seedKey}:s`) - 0.5) * 0.05;
  const lightnessJitter = (hashStringToUnit(`${seedKey}:l`) - 0.5) * 0.06;

  const hue = selectedEntry.hue + hueJitter;
  const saturation = clamp(selectedEntry.saturation + saturationJitter, 0.22, 0.42);
  const lightness = clamp(selectedEntry.lightness + lightnessJitter, 0.54, 0.72);

  return hsl(hue, saturation, lightness);
}

export function getEntityVisualPreset(
  entityType: ExplorerEntityType,
  seed: number
): EntityVisualPreset {
  const variant = clamp01(seed);
  const tilt = (variant - 0.5) * 0.6;
  const rotation = variant * Math.PI * 2;

  switch (entityType) {
    case "galaxy":
      return {
        coreColor: hsl(208 + variant * 22, 0.62, 0.58),
        emissiveColor: hsl(200 + variant * 18, 0.88, 0.64),
        coreRoughness: 0.34,
        coreMetalness: 0.1,
        baseEmissiveIntensity: 0.26,
        hoverEmissiveBoost: 0.2,
        selectedEmissiveBoost: 0.38,
        haloColor: hsl(198 + variant * 24, 0.88, 0.66),
        haloScale: 1.62 + variant * 0.18,
        haloOpacity: 0.16,
        hoverHaloBoost: 0.1,
        selectedHaloBoost: 0.2,
        ringColor: hsl(190 + variant * 28, 0.74, 0.66),
        ringOpacity: 0.2,
        ringInnerScale: 1.22,
        ringOuterScale: 1.55,
        ringTiltRad: tilt * 0.9,
        ringRotationRad: rotation,
        hasRing: true,
        shellColor: hsl(196 + variant * 24, 0.78, 0.68),
        shellScale: 1.18,
        shellOpacity: 0,
        hasShell: false,
      };
    case "sector":
      return {
        coreColor: hsl(202 + variant * 10, 0.36, 0.54),
        emissiveColor: hsl(190 + variant * 8, 0.5, 0.58),
        coreRoughness: 0.4,
        coreMetalness: 0.22,
        baseEmissiveIntensity: 0.16,
        hoverEmissiveBoost: 0.14,
        selectedEmissiveBoost: 0.28,
        haloColor: hsl(186 + variant * 12, 0.66, 0.58),
        haloScale: 1.34 + variant * 0.1,
        haloOpacity: 0.08,
        hoverHaloBoost: 0.08,
        selectedHaloBoost: 0.12,
        ringColor: hsl(172 + variant * 20, 0.54, 0.62),
        ringOpacity: 0.28,
        ringInnerScale: 1.08,
        ringOuterScale: 1.24,
        ringTiltRad: tilt,
        ringRotationRad: rotation,
        hasRing: true,
        shellColor: hsl(180 + variant * 20, 0.48, 0.62),
        shellScale: 1.27 + variant * 0.06,
        shellOpacity: 0.2,
        hasShell: true,
      };
    case "system":
      return {
        coreColor: hsl(46 + variant * 10, 0.72, 0.64),
        emissiveColor: hsl(42 + variant * 10, 0.94, 0.62),
        coreRoughness: 0.28,
        coreMetalness: 0.06,
        baseEmissiveIntensity: 0.32,
        hoverEmissiveBoost: 0.24,
        selectedEmissiveBoost: 0.42,
        haloColor: hsl(42 + variant * 8, 0.88, 0.62),
        haloScale: 1.48 + variant * 0.08,
        haloOpacity: 0.15,
        hoverHaloBoost: 0.12,
        selectedHaloBoost: 0.2,
        ringColor: hsl(40 + variant * 8, 0.7, 0.62),
        ringOpacity: 0.16,
        ringInnerScale: 1.15,
        ringOuterScale: 1.3,
        ringTiltRad: tilt * 0.35,
        ringRotationRad: rotation,
        hasRing: true,
        shellColor: hsl(44 + variant * 8, 0.76, 0.66),
        shellScale: 1.16,
        shellOpacity: 0,
        hasShell: false,
      };
    case "planet":
    default:
      return {
        coreColor: hsl(206 + variant * 40, 0.28, 0.64),
        emissiveColor: hsl(198 + variant * 34, 0.52, 0.64),
        coreRoughness: 0.36,
        coreMetalness: 0.08,
        baseEmissiveIntensity: 0.12,
        hoverEmissiveBoost: 0.12,
        selectedEmissiveBoost: 0.2,
        haloColor: hsl(192 + variant * 30, 0.58, 0.66),
        haloScale: 1.24 + variant * 0.1,
        haloOpacity: 0.07,
        hoverHaloBoost: 0.08,
        selectedHaloBoost: 0.12,
        ringColor: hsl(190 + variant * 30, 0.5, 0.62),
        ringOpacity: 0,
        ringInnerScale: 1.1,
        ringOuterScale: 1.24,
        ringTiltRad: 0,
        ringRotationRad: 0,
        hasRing: false,
        shellColor: hsl(190 + variant * 20, 0.48, 0.66),
        shellScale: 1.12,
        shellOpacity: 0,
        hasShell: false,
      };
  }
}
