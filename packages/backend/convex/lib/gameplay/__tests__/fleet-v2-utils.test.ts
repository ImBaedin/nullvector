import { describe, expect, it } from "vitest";

import {
  durationMsForFleet,
  euclideanDistance,
  normalizeMissionCargo,
} from "../../../../runtime/gameplay/fleetV2";

describe("fleet V2 utility helpers", () => {
  it("normalizes cargo to non-negative whole units", () => {
    expect(
      normalizeMissionCargo({
        alloy: 12.7,
        crystal: -5,
        fuel: Number.NaN,
      }),
    ).toEqual({
      alloy: 12,
      crystal: 0,
      fuel: 0,
    });
  });

  it("enforces minimum euclidean distance of 1", () => {
    expect(
      euclideanDistance({
        x1: 5,
        y1: 5,
        x2: 5,
        y2: 5,
      }),
    ).toBe(1);
  });

  it("applies a minimum travel duration floor", () => {
    const duration = durationMsForFleet({
      distance: 1,
      shipCounts: {
        smallCargo: 1,
        largeCargo: 0,
        colonyShip: 0,
      },
    });

    expect(duration).toBeGreaterThanOrEqual(30_000);
  });
});
