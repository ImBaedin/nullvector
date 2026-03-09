import { access, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type {
	GalaxyLibraryManifest,
	GalaxyLibraryOptions,
	GalaxyModelManifestEntry,
} from "./types";

import { exportGalaxyAsGlb } from "./export-glb";
import { generateGalaxyModel } from "./generate-galaxy";
import { DEFAULT_PROFILE_ID } from "./palette";

const libraryOptionsSchema = z.object({
	outDir: z.string().min(1),
	count: z.number().int().positive().max(1024).default(16),
	seed: z.string().min(1).default("nullvector-galaxy-library-v1"),
	overwrite: z.boolean().default(false),
	profile: z.string().min(1).default(DEFAULT_PROFILE_ID),
});

function modelId(index: number) {
	return `galaxy-${index.toString().padStart(3, "0")}`;
}

export async function generateGalaxyLibrary(
	options: GalaxyLibraryOptions,
): Promise<GalaxyLibraryManifest> {
	const resolved = libraryOptionsSchema.parse(options);

	const outDir = path.resolve(resolved.outDir);
	const modelsDir = path.join(outDir, "models");

	if (resolved.overwrite) {
		await rm(outDir, { recursive: true, force: true });
	} else {
		try {
			await access(outDir);
			throw new Error(
				`Output directory already exists: ${outDir}. Re-run with --overwrite true to replace it.`,
			);
		} catch (error: unknown) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError?.code === "ENOENT") {
				// Directory does not exist; safe to continue.
			} else if (error instanceof Error) {
				throw error;
			}
		}
	}

	await mkdir(modelsDir, { recursive: true });

	const entries: GalaxyModelManifestEntry[] = [];

	for (let i = 0; i < resolved.count; i += 1) {
		const id = modelId(i);
		const seed = `${resolved.seed}:${i}`;
		const fileName = `${id}.glb`;

		const model = generateGalaxyModel({
			id,
			seed,
			profile: resolved.profile,
		});

		await exportGalaxyAsGlb({
			model,
			outDir: modelsDir,
			fileName,
		});

		entries.push({
			id,
			seed,
			file: path.posix.join("models", fileName),
			bounds: model.bounds,
			stats: model.stats,
			style: model.style,
			animationHints: model.animationHints,
		});
	}

	const manifest: GalaxyLibraryManifest = {
		version: "2.0.0",
		profile: resolved.profile,
		librarySeed: resolved.seed,
		createdAt: new Date().toISOString(),
		count: resolved.count,
		models: entries,
	};

	const manifestPath = path.join(outDir, "manifest.json");
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

	return manifest;
}
