import { describe, expect, it } from "vitest";
import type { Id } from "../../../_generated/dataModel";

import {
  applyAccrualSegment,
  scaledUnits,
  storedToWholeUnits,
} from "../../../../runtime/gameplay/shared";

type AccrualColony = Parameters<typeof applyAccrualSegment>[0]["colony"];
type AccrualPlanet = Parameters<typeof applyAccrualSegment>[0]["planet"];

describe("resource helpers", () => {
  it("scales and unscales units consistently", () => {
    const stored = scaledUnits(1234);
    expect(stored).toBeGreaterThan(0);
    expect(storedToWholeUnits(stored)).toBe(1234);
  });

  it("accrual is segmented across upgraded rates", () => {
    const baseColony: AccrualColony = {
      _id: "colony_1" as unknown as Id<"colonies">,
      _creationTime: 0,
      universeId: "universe_1" as unknown as Id<"universes">,
      playerId: "player_1" as unknown as Id<"players">,
      planetId: "planet_1" as unknown as Id<"planets">,
      name: "Test Colony",
      createdAt: 0,
      updatedAt: 0,
      lastAccruedAt: 0,
      buildings: {
        alloyMineLevel: 1,
        crystalMineLevel: 1,
        fuelRefineryLevel: 1,
        powerPlantLevel: 1,
        alloyStorageLevel: 1,
        crystalStorageLevel: 1,
        fuelStorageLevel: 1,
        shipyardLevel: 0,
      },
      overflow: {
        alloy: 0,
        crystal: 0,
        fuel: 0,
      },
      resources: {
        alloy: 0,
        crystal: 0,
        fuel: 0,
      },
      storageCaps: {
        alloy: scaledUnits(1_000_000),
        crystal: scaledUnits(1_000_000),
        fuel: scaledUnits(1_000_000),
      },
      usedSlots: 7,
    };

    const planet: AccrualPlanet = {
      _id: "planet_1" as unknown as Id<"planets">,
      _creationTime: 0,
      universeId: "universe_1" as unknown as Id<"universes">,
      systemId: "system_1" as unknown as Id<"systems">,
      seed: "seed",
      galaxyIndex: 0,
      sectorIndex: 0,
      systemIndex: 0,
      planetIndex: 0,
      orbitRadius: 100,
      orbitPhaseRad: 0,
      orbitAngularVelocityRadPerSec: 0.01,
      orbitalDistance: 100,
      planetSize: 1,
      createdAt: 0,
      compositionType: "metallic",
      maxBuildingSlots: 12,
      alloyMultiplier: 1,
      crystalMultiplier: 1,
      fuelMultiplier: 1,
      isColonizable: true,
    };

    const start = {
      alloy: 0,
      crystal: 0,
      fuel: 0,
    };

    const firstHalf = applyAccrualSegment({
      colony: {
        ...baseColony,
        lastAccruedAt: 0,
      },
      planet,
      segmentEndMs: 30 * 60_000,
      resources: start,
    });

    const secondHalf = applyAccrualSegment({
      colony: {
        ...baseColony,
        buildings: {
          ...baseColony.buildings,
          alloyMineLevel: 2,
        },
        lastAccruedAt: firstHalf.lastAccruedAt,
      },
      planet,
      segmentEndMs: 60 * 60_000,
      resources: firstHalf.resources,
    });

    const onePassBaseRate = applyAccrualSegment({
      colony: {
        ...baseColony,
        lastAccruedAt: 0,
      },
      planet,
      segmentEndMs: 60 * 60_000,
      resources: start,
    });

    expect(secondHalf.resources.alloy).toBeGreaterThan(
      onePassBaseRate.resources.alloy,
    );
  });

  it("pauses local production when overflow exists", () => {
    const overflowColony: AccrualColony = {
      _id: "colony_2" as unknown as Id<"colonies">,
      _creationTime: 0,
      universeId: "universe_1" as unknown as Id<"universes">,
      playerId: "player_1" as unknown as Id<"players">,
      planetId: "planet_1" as unknown as Id<"planets">,
      name: "Overflow Colony",
      createdAt: 0,
      updatedAt: 0,
      lastAccruedAt: 0,
      buildings: {
        alloyMineLevel: 5,
        crystalMineLevel: 1,
        fuelRefineryLevel: 1,
        powerPlantLevel: 5,
        alloyStorageLevel: 1,
        crystalStorageLevel: 1,
        fuelStorageLevel: 1,
        shipyardLevel: 0,
      },
      overflow: {
        alloy: scaledUnits(10),
        crystal: 0,
        fuel: 0,
      },
      resources: {
        alloy: 0,
        crystal: 0,
        fuel: 0,
      },
      storageCaps: {
        alloy: scaledUnits(1_000_000),
        crystal: scaledUnits(1_000_000),
        fuel: scaledUnits(1_000_000),
      },
      usedSlots: 7,
    };

    const planet: AccrualPlanet = {
      _id: "planet_1" as unknown as Id<"planets">,
      _creationTime: 0,
      universeId: "universe_1" as unknown as Id<"universes">,
      systemId: "system_1" as unknown as Id<"systems">,
      seed: "seed",
      galaxyIndex: 0,
      sectorIndex: 0,
      systemIndex: 0,
      planetIndex: 0,
      orbitRadius: 100,
      orbitPhaseRad: 0,
      orbitAngularVelocityRadPerSec: 0.01,
      orbitalDistance: 100,
      planetSize: 1,
      createdAt: 0,
      compositionType: "metallic",
      maxBuildingSlots: 12,
      alloyMultiplier: 1,
      crystalMultiplier: 1,
      fuelMultiplier: 1,
      isColonizable: true,
    };

    const result = applyAccrualSegment({
      colony: overflowColony,
      planet,
      segmentEndMs: 30 * 60_000,
      resources: {
        alloy: 0,
        crystal: 0,
        fuel: 0,
      },
    });

    expect(result.resources.alloy).toBe(0);
  });
});
