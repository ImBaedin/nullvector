import { createPrng } from "./prng";

const PLANET_COMPOSITIONS = [
  "metallic",
  "silicate",
  "icy",
  "volatileRich",
] as const;

const STAR_KINDS = [
  "yellow_dwarf",
  "red_dwarf",
  "orange_dwarf",
  "blue_white",
] as const;

type PlanetComposition = (typeof PLANET_COMPOSITIONS)[number];

export type GeneratedPlanet = {
  planetIndex: number;
  orbitRadius: number;
  orbitPhaseRad: number;
  orbitAngularVelocityRadPerSec: number;
  orbitalDistance: number;
  planetSize: number;
  compositionType: PlanetComposition;
  maxBuildingSlots: number;
  alloyMultiplier: number;
  crystalMultiplier: number;
  fuelMultiplier: number;
  isColonizable: true;
  seed: string;
};

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function compositionBias(composition: PlanetComposition) {
  if (composition === "metallic") {
    return { alloy: 0.05, crystal: 0.0, fuel: -0.03 };
  }
  if (composition === "silicate") {
    return { alloy: 0.0, crystal: 0.04, fuel: -0.01 };
  }
  if (composition === "icy") {
    return { alloy: -0.03, crystal: 0.02, fuel: 0.03 };
  }
  return { alloy: -0.04, crystal: -0.01, fuel: 0.06 };
}

function boundedMultiplier(base: number, bias: number) {
  return roundTo(clamp(base + bias, 0.85, 1.25), 3);
}

export function generateStarKind(systemSeed: string): string {
  const prng = createPrng(`${systemSeed}:star`);
  return prng.pick(STAR_KINDS);
}

export function generatePlanetsForSystem(args: {
  systemSeed: string;
  minPlanetsPerSystem: number;
  maxPlanetsPerSystem: number;
}): GeneratedPlanet[] {
  const { systemSeed, minPlanetsPerSystem, maxPlanetsPerSystem } = args;
  const prng = createPrng(`${systemSeed}:planets`);
  const planetCount = prng.nextInt(minPlanetsPerSystem, maxPlanetsPerSystem);

  const planets: GeneratedPlanet[] = [];
  let previousOrbitRadius = 18;

  for (let planetIndex = 0; planetIndex < planetCount; planetIndex += 1) {
    const compositionType = prng.pick(PLANET_COMPOSITIONS);
    const bias = compositionBias(compositionType);

    const orbitStep = prng.nextInRange(12, 20);
    const orbitRadius = roundTo(previousOrbitRadius + orbitStep, 3);
    previousOrbitRadius = orbitRadius;

    const orbitalDistance = roundTo(
      0.55 + planetIndex * 0.45 + prng.nextInRange(0.0, 0.25),
      4
    );

    const baseMultiplier = 1 + prng.nextInRange(-0.12, 0.12);
    const planetSize = prng.nextInt(45, 130);
    const maxBuildingSlots = clamp(Math.floor(planetSize / 8), 8, 22);

    const orbitPhaseRad = roundTo(prng.nextInRange(0, 2 * Math.PI), 6);
    const orbitAngularVelocityRadPerSec = roundTo(
      prng.nextInRange(0.001, 0.006) / Math.sqrt(orbitalDistance + 0.35),
      8
    );

    planets.push({
      planetIndex,
      orbitRadius,
      orbitPhaseRad,
      orbitAngularVelocityRadPerSec,
      orbitalDistance,
      planetSize,
      compositionType,
      maxBuildingSlots,
      alloyMultiplier: boundedMultiplier(baseMultiplier, bias.alloy),
      crystalMultiplier: boundedMultiplier(baseMultiplier, bias.crystal),
      fuelMultiplier: boundedMultiplier(baseMultiplier, bias.fuel),
      isColonizable: true,
      seed: `${systemSeed}:planet:${planetIndex}`,
    });
  }

  return planets;
}
