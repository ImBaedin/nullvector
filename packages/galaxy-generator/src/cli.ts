#!/usr/bin/env bun
import path from "node:path";

import { generateGalaxyLibrary } from "./generate-library";
import { DEFAULT_PROFILE_ID } from "./palette";

type Flags = {
	outDir: string;
	count: number;
	seed: string;
	overwrite: boolean;
	profile: string;
};

function parseBoolean(value: string) {
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`Invalid boolean value: ${value}`);
}

function parseArgs(argv: string[]): { command: string; flags: Flags } {
	const command = argv[2] ?? "generate";

	const flags: Flags = {
		outDir: path.resolve(process.cwd(), "generated/default"),
		count: 16,
		seed: "nullvector-galaxy-library-v1",
		overwrite: false,
		profile: DEFAULT_PROFILE_ID,
	};

	for (let i = 3; i < argv.length; i += 1) {
		const current = argv[i];
		const next = argv[i + 1];

		if (!current) {
			continue;
		}

		if (!current.startsWith("--")) {
			throw new Error(`Unexpected argument: ${current}`);
		}
		if (!next) {
			throw new Error(`Missing value for ${current}`);
		}

		switch (current) {
			case "--out":
				flags.outDir = path.resolve(process.cwd(), next);
				i += 1;
				break;
			case "--count":
				flags.count = Number.parseInt(next, 10);
				i += 1;
				break;
			case "--seed":
				flags.seed = next;
				i += 1;
				break;
			case "--overwrite":
				flags.overwrite = parseBoolean(next);
				i += 1;
				break;
			case "--profile":
				flags.profile = next;
				i += 1;
				break;
			default:
				throw new Error(`Unknown option: ${current}`);
		}
	}

	return { command, flags };
}

async function main() {
	const { command, flags } = parseArgs(process.argv);
	if (command !== "generate") {
		throw new Error(`Unsupported command: ${command}`);
	}

	const manifest = await generateGalaxyLibrary({
		outDir: flags.outDir,
		count: flags.count,
		seed: flags.seed,
		overwrite: flags.overwrite,
		profile: flags.profile,
	});

	console.log(`Generated ${manifest.count} galaxy models in ${flags.outDir}`);
	console.log(`Manifest: ${path.join(flags.outDir, "manifest.json")}`);
}

main().catch((error: unknown) => {
	if (error instanceof Error) {
		console.error(error.message);
	} else {
		console.error("Unexpected failure", error);
	}
	process.exit(1);
});
