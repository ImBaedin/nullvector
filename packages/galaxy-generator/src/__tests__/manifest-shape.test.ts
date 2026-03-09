import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { generateGalaxyLibrary } from "../generate-library";

const manifestSchema = z.object({
	version: z.literal("2.0.0"),
	profile: z.string(),
	librarySeed: z.string(),
	createdAt: z.string(),
	count: z.number().int().positive(),
	models: z.array(
		z.object({
			id: z.string(),
			seed: z.string(),
			file: z.string(),
			bounds: z.object({
				radius: z.number().positive(),
				thickness: z.number().positive(),
			}),
			stats: z.object({
				vertexCount: z.number().int().positive(),
				triangleCount: z.number().int().positive(),
				materialCount: z.number().int().positive(),
				componentCount: z.number().int().positive(),
				openEdgeCount: z.number().int().nonnegative(),
				degenerateTriangleCount: z.number().int().nonnegative(),
				thicknessRatio: z.number().nonnegative(),
				watertight: z.boolean(),
			}),
			style: z.object({
				armCount: z.number().int().positive(),
				turns: z.number().positive(),
				twist: z.number().positive(),
				coreScale: z.number().positive(),
				paletteId: z.string(),
				profileVersion: z.string(),
				armWidthStart: z.number().positive(),
				armWidthEnd: z.number().positive(),
				thicknessScale: z.number().positive(),
			}),
			animationHints: z.object({
				coreRps: z.number().positive(),
				armsRps: z.number().positive(),
				dustRps: z.number().positive(),
			}),
		}),
	),
});

test("library generation writes valid v2 manifest and glb entries", async () => {
	const tempRoot = await mkdtemp(path.join(os.tmpdir(), "galaxy-gen-test-"));
	const outDir = path.join(tempRoot, "lib");

	const manifest = await generateGalaxyLibrary({
		outDir,
		count: 3,
		seed: "test-seed",
		overwrite: true,
		profile: "spiral-volumetric-v2",
	});

	expect(manifest.count).toBe(3);
	expect(manifest.models).toHaveLength(3);

	const manifestPath = path.join(outDir, "manifest.json");
	const diskManifestRaw = await readFile(manifestPath, "utf8");
	const diskManifest = JSON.parse(diskManifestRaw);

	const parsed = manifestSchema.parse(diskManifest);
	expect(parsed.models.every((entry) => entry.file.endsWith(".glb"))).toBe(true);
	expect(parsed.models.every((entry) => entry.stats.watertight)).toBe(true);
});
