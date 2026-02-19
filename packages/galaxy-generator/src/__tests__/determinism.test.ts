import { expect, test } from "bun:test";

import { generateGalaxyModel, hashGeometry } from "../generate-galaxy";

test("same seed and profile produce identical geometry and quality metrics", () => {
  const a = generateGalaxyModel({
    id: "galaxy-000",
    seed: "seed:42",
    profile: "spiral-volumetric-v2",
  });
  const b = generateGalaxyModel({
    id: "galaxy-000",
    seed: "seed:42",
    profile: "spiral-volumetric-v2",
  });

  expect(hashGeometry(a.mesh)).toBe(hashGeometry(b.mesh));
  expect(a.bounds).toEqual(b.bounds);
  expect(a.style).toEqual(b.style);
  expect(a.animationHints).toEqual(b.animationHints);
  expect(a.stats).toEqual(b.stats);

  expect(a.stats.triangleCount).toBeGreaterThanOrEqual(500);
  expect(a.stats.triangleCount).toBeLessThanOrEqual(5000);
  expect(a.stats.watertight).toBe(true);
  expect(a.stats.openEdgeCount).toBe(0);
  expect(a.stats.degenerateTriangleCount).toBe(0);
  expect(a.stats.thicknessRatio).toBeGreaterThanOrEqual(0.12);
});

test("different seed produces different geometry", () => {
  const a = generateGalaxyModel({
    id: "galaxy-000",
    seed: "seed:A",
    profile: "spiral-volumetric-v2",
  });
  const b = generateGalaxyModel({
    id: "galaxy-000",
    seed: "seed:B",
    profile: "spiral-volumetric-v2",
  });

  expect(hashGeometry(a.mesh)).not.toBe(hashGeometry(b.mesh));
});
