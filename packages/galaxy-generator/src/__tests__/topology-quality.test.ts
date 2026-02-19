import { expect, test } from "bun:test";

import { generateGalaxyModel } from "../generate-galaxy";

test("volumetric profile stays watertight with stable thickness across seeds", () => {
  for (let index = 0; index < 16; index += 1) {
    const model = generateGalaxyModel({
      id: `galaxy-${index.toString().padStart(3, "0")}`,
      seed: `topology-seed:${index}`,
      profile: "spiral-volumetric-v2",
    });

    expect(model.stats.watertight).toBe(true);
    expect(model.stats.openEdgeCount).toBe(0);
    expect(model.stats.degenerateTriangleCount).toBe(0);
    expect(model.stats.thicknessRatio).toBeGreaterThanOrEqual(0.12);
    expect(model.mesh.primitives.length).toBeGreaterThanOrEqual(2);
  }
});
