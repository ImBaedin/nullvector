import type { Doc } from "../../_generated/dataModel";

export const DEFAULT_UNIVERSE_SLUG = "main";
export const GENERATION_STATE_SCHEMA_VERSION = 1;

export const DEFAULT_COORDINATE_CONFIG = {
  sectorWidth: 1_000,
  sectorHeight: 1_000,
  systemMinDistance: 40,
} as const;

export const DEFAULT_GENERATION_CONFIG = {
  galaxyCount: 5,
  systemsPerSector: 8,
  minPlanetsPerSystem: 4,
  maxPlanetsPerSystem: 8,
  minCoreSectors: 20,
  minUnclaimedColonizablePlanets: 80,
  maxSectorsPerRun: 30,
} as const;

export type GenerationOverrides = {
  minCoreSectors?: number;
  minUnclaimedColonizablePlanets?: number;
  maxSectorsPerRun?: number;
};

export type EffectiveGenerationTargets = {
  minCoreSectors: number;
  minUnclaimedColonizablePlanets: number;
  maxSectorsPerRun: number;
};

export type NormalizedGenerationConfig = {
  galaxyCount: number;
  systemsPerSector: number;
  minPlanetsPerSystem: number;
  maxPlanetsPerSystem: number;
  minCoreSectors: number;
  minUnclaimedColonizablePlanets: number;
  maxSectorsPerRun: number;
};

function assertInteger(name: string, value: number, minimum: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
}

export function normalizeGenerationConfig(
  config: Doc<"universes">["generationConfig"]
): NormalizedGenerationConfig {
  const normalized = {
    galaxyCount: config.galaxyCount,
    systemsPerSector: config.systemsPerSector,
    minPlanetsPerSystem: config.minPlanetsPerSystem,
    maxPlanetsPerSystem: config.maxPlanetsPerSystem,
    minCoreSectors:
      config.minCoreSectors ?? DEFAULT_GENERATION_CONFIG.minCoreSectors,
    minUnclaimedColonizablePlanets:
      config.minUnclaimedColonizablePlanets ??
      DEFAULT_GENERATION_CONFIG.minUnclaimedColonizablePlanets,
    maxSectorsPerRun:
      config.maxSectorsPerRun ?? DEFAULT_GENERATION_CONFIG.maxSectorsPerRun,
  } satisfies NormalizedGenerationConfig;

  assertInteger("generationConfig.galaxyCount", normalized.galaxyCount, 1);
  assertInteger(
    "generationConfig.systemsPerSector",
    normalized.systemsPerSector,
    1
  );
  assertInteger(
    "generationConfig.minPlanetsPerSystem",
    normalized.minPlanetsPerSystem,
    1
  );
  assertInteger(
    "generationConfig.maxPlanetsPerSystem",
    normalized.maxPlanetsPerSystem,
    normalized.minPlanetsPerSystem
  );
  assertInteger("generationConfig.minCoreSectors", normalized.minCoreSectors, 0);
  assertInteger(
    "generationConfig.minUnclaimedColonizablePlanets",
    normalized.minUnclaimedColonizablePlanets,
    0
  );
  assertInteger("generationConfig.maxSectorsPerRun", normalized.maxSectorsPerRun, 1);

  return normalized;
}

export function resolveGenerationTargets(
  baseConfig: NormalizedGenerationConfig,
  overrides: GenerationOverrides
): EffectiveGenerationTargets {
  const targets = {
    minCoreSectors: overrides.minCoreSectors ?? baseConfig.minCoreSectors,
    minUnclaimedColonizablePlanets:
      overrides.minUnclaimedColonizablePlanets ??
      baseConfig.minUnclaimedColonizablePlanets,
    maxSectorsPerRun: overrides.maxSectorsPerRun ?? baseConfig.maxSectorsPerRun,
  } satisfies EffectiveGenerationTargets;

  assertInteger("minCoreSectors", targets.minCoreSectors, 0);
  assertInteger(
    "minUnclaimedColonizablePlanets",
    targets.minUnclaimedColonizablePlanets,
    0
  );
  assertInteger("maxSectorsPerRun", targets.maxSectorsPerRun, 1);

  return targets;
}

export function buildDefaultUniverseConfig() {
  return {
    coordinateConfig: { ...DEFAULT_COORDINATE_CONFIG },
    generationConfig: { ...DEFAULT_GENERATION_CONFIG },
  };
}
