import { describe, expect, it } from "vitest";
import type { Doc } from "../../../_generated/dataModel";

import {
  applyAccrualSegment,
  scaledUnits,
  storedToWholeUnits,
} from "../../../../runtime/gameplay/shared";

describe("resource helpers", () => {
  it("scales and unscales units consistently", () => {
    const stored = scaledUnits(1234);
    expect(stored).toBeGreaterThan(0);
    expect(storedToWholeUnits(stored)).toBe(1234);
  });

  it("accrual is segmented across upgraded rates", () => {
    const baseColony = {
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
      storageCaps: {
        alloy: scaledUnits(1_000_000),
        crystal: scaledUnits(1_000_000),
        fuel: scaledUnits(1_000_000),
      },
    } as unknown as Doc<"colonies">;

    const planet = {
      alloyMultiplier: 1,
      crystalMultiplier: 1,
      fuelMultiplier: 1,
    } as unknown as Doc<"planets">;

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
    const overflowColony = {
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
      storageCaps: {
        alloy: scaledUnits(1_000_000),
        crystal: scaledUnits(1_000_000),
        fuel: scaledUnits(1_000_000),
      },
    } as unknown as Doc<"colonies">;

    const planet = {
      alloyMultiplier: 1,
      crystalMultiplier: 1,
      fuelMultiplier: 1,
    } as unknown as Doc<"planets">;

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
