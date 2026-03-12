import { generateSciFiName } from "@nullvector/game-logic";
import { ConvexError } from "convex/values";

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

import {
	DEFAULT_UNIVERSE_SLUG,
	GENERATION_STATE_SCHEMA_VERSION,
	buildDefaultUniverseConfig,
	normalizeGenerationConfig,
	resolveGenerationTargets,
	type EffectiveGenerationTargets,
	type GenerationOverrides,
	type NormalizedGenerationConfig,
} from "./config";
import { buildSectorBounds, computeGalaxyOffset, generateSystemPositions } from "./layout";
import { generatePlanetsForSystem, generateStarKind } from "./planet";

type UniverseDoc = Doc<"universes"> & {
	coordinateConfig: Doc<"universeGeneration">["coordinateConfig"];
	generationConfig: Doc<"universeGeneration">["generationConfig"];
	generationState: Doc<"universeGeneration">["generationState"];
	seed?: string;
};
type GenerationState = NonNullable<UniverseDoc["generationState"]>;

type CreationCounters = {
	galaxies: number;
	sectors: number;
	systems: number;
	planets: number;
};

type CapacitySnapshot = {
	coreSectors: number;
	unclaimedColonizable: number;
};

export type EnsureCoreCapacityParams = {
	universeSlug?: string;
	dryRun: boolean;
	overrides: GenerationOverrides;
};

export type EnsureCoreCapacityResult = {
	universeId: Id<"universes">;
	universeSlug: string;
	created: CreationCounters;
	capacityBefore: CapacitySnapshot;
	capacityAfter: CapacitySnapshot;
	targetsApplied: EffectiveGenerationTargets;
	needsMore: boolean;
	dryRun: boolean;
};

type GalaxyRef = {
	galaxyIndex: number;
	galaxyId: Id<"galaxies"> | null;
};

function galaxyAddress(galaxyIndex: number) {
	return `G${galaxyIndex}`;
}

function sectorAddress(galaxyIndex: number, sectorIndex: number) {
	return `G${galaxyIndex}:S${sectorIndex}`;
}

function systemAddress(galaxyIndex: number, sectorIndex: number, systemIndex: number) {
	return `G${galaxyIndex}:S${sectorIndex}:SYS${systemIndex}`;
}

function planetAddress(
	galaxyIndex: number,
	sectorIndex: number,
	systemIndex: number,
	planetIndex: number,
) {
	return `G${galaxyIndex}:S${sectorIndex}:SYS${systemIndex}:P${planetIndex}`;
}

function assertNonNegativeInteger(name: string, value: number) {
	if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
		throw new ConvexError(`${name} must be an integer >= 0`);
	}
}

async function getUniverseBySlug(ctx: MutationCtx, slug: string) {
	return await ctx.db
		.query("universes")
		.withIndex("by_slug", (q) => q.eq("slug", slug))
		.unique();
}

async function getActiveUniverse(ctx: MutationCtx) {
	return await ctx.db
		.query("universes")
		.withIndex("by_is_active", (q) => q.eq("isActive", true))
		.unique();
}

async function countByQuery<T>(
	queryFactory: (cursor: string | null) => Promise<{
		page: T[];
		continueCursor: string;
		isDone: boolean;
	}>,
) {
	let cursor: string | null = null;
	let count = 0;

	while (true) {
		const page = await queryFactory(cursor);
		count += page.page.length;
		if (page.isDone) {
			break;
		}
		cursor = page.continueCursor;
	}

	return count;
}

async function countColoniesByUniverse(ctx: MutationCtx, universeId: Id<"universes">) {
	return await countByQuery((cursor) =>
		ctx.db
			.query("colonies")
			.withIndex("by_universe_id", (q) => q.eq("universeId", universeId))
			.paginate({ numItems: 256, cursor }),
	);
}

async function countCoreSectorsByUniverse(ctx: MutationCtx, universeId: Id<"universes">) {
	return await countByQuery((cursor) =>
		ctx.db
			.query("sectors")
			.withIndex("by_universe_id_and_sector_type", (q) =>
				q.eq("universeId", universeId).eq("sectorType", "core"),
			)
			.paginate({ numItems: 256, cursor }),
	);
}

async function countColonizablePlanetsByUniverse(ctx: MutationCtx, universeId: Id<"universes">) {
	return await countByQuery((cursor) =>
		ctx.db
			.query("planetEconomy")
			.withIndex("by_uni_colon", (q) => q.eq("universeId", universeId).eq("isColonizable", true))
			.paginate({ numItems: 256, cursor }),
	);
}

async function getNextSectorIndexForGalaxy(
	ctx: MutationCtx,
	universeId: Id<"universes">,
	galaxyIndex: number,
) {
	const latest = await ctx.db
		.query("sectors")
		.withIndex("by_universe_id_and_galaxy_index_and_sector_index", (q) =>
			q.eq("universeId", universeId).eq("galaxyIndex", galaxyIndex),
		)
		.order("desc")
		.first();

	if (!latest) {
		return 0;
	}

	return latest.sectorIndex + 1;
}

async function buildGenerationStateFromDatabase(
	ctx: MutationCtx,
	universeId: Id<"universes">,
	galaxyCount: number,
	now: number,
): Promise<GenerationState> {
	const [coreSectorsGenerated, colonizablePlanetsGenerated] = await Promise.all([
		countCoreSectorsByUniverse(ctx, universeId),
		countColonizablePlanetsByUniverse(ctx, universeId),
	]);

	const nextCoreSectorIndexByGalaxy: number[] = [];
	for (let galaxyIndex = 0; galaxyIndex < galaxyCount; galaxyIndex += 1) {
		nextCoreSectorIndexByGalaxy.push(
			await getNextSectorIndexForGalaxy(ctx, universeId, galaxyIndex),
		);
	}

	return {
		schemaVersion: GENERATION_STATE_SCHEMA_VERSION,
		nextCoreSectorIndexByGalaxy,
		nextGalaxyCursor: 0,
		coreSectorsGenerated,
		colonizablePlanetsGenerated,
		lastRunAt: now,
	};
}

async function resolveUniverse(
	ctx: MutationCtx,
	universeSlug: string | undefined,
	dryRun: boolean,
	now: number,
) {
	const requestedSlug = universeSlug ?? DEFAULT_UNIVERSE_SLUG;
	let universe = await getUniverseBySlug(ctx, requestedSlug);

	if (!universe && universeSlug === undefined) {
		universe = await getActiveUniverse(ctx);
	}

	if (!universe) {
		if (dryRun) {
			throw new ConvexError(
				"Cannot dry run generation before a universe exists. Run once without dryRun.",
			);
		}

		if (requestedSlug !== DEFAULT_UNIVERSE_SLUG) {
			throw new ConvexError(`Universe '${requestedSlug}' not found`);
		}

		const defaults = buildDefaultUniverseConfig();
		const universeId = await ctx.db.insert("universes", {
			slug: DEFAULT_UNIVERSE_SLUG,
			name: "Main Universe",
			isActive: true,
			orbitEpochMs: now,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.insert("universeGeneration", {
			universeId,
			seed: `universe:${DEFAULT_UNIVERSE_SLUG}`,
			coordinateConfig: defaults.coordinateConfig,
			generationConfig: defaults.generationConfig,
			generationState: {
				schemaVersion: GENERATION_STATE_SCHEMA_VERSION,
				nextCoreSectorIndexByGalaxy: Array.from(
					{ length: defaults.generationConfig.galaxyCount },
					() => 0,
				),
				nextGalaxyCursor: 0,
				coreSectorsGenerated: 0,
				colonizablePlanetsGenerated: 0,
				lastRunAt: now,
			},
			createdAt: now,
			updatedAt: now,
		});
		universe = await ctx.db.get(universeId);
		if (!universe) {
			throw new ConvexError("Failed to bootstrap default universe");
		}
	}

	const generation = await ctx.db
		.query("universeGeneration")
		.withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
		.unique();
	if (!generation) {
		if (dryRun) {
			throw new ConvexError("Universe generation data missing");
		}
		const defaults = buildDefaultUniverseConfig();
		const created = {
			universeId: universe._id,
			seed: `universe:${universe.slug}`,
			coordinateConfig: defaults.coordinateConfig,
			generationConfig: defaults.generationConfig,
			generationState: {
				schemaVersion: GENERATION_STATE_SCHEMA_VERSION,
				nextCoreSectorIndexByGalaxy: Array.from(
					{ length: defaults.generationConfig.galaxyCount },
					() => 0,
				),
				nextGalaxyCursor: 0,
				coreSectorsGenerated: 0,
				colonizablePlanetsGenerated: 0,
				lastRunAt: now,
			},
			createdAt: now,
			updatedAt: now,
		};
		await ctx.db.insert("universeGeneration", created);
		return {
			...universe,
			seed: created.seed,
			coordinateConfig: created.coordinateConfig,
			generationConfig: created.generationConfig,
			generationState: created.generationState,
		};
	}

	return {
		...universe,
		seed: generation.seed,
		coordinateConfig: generation.coordinateConfig,
		generationConfig: generation.generationConfig,
		generationState: generation.generationState,
	};
}

async function ensureGalaxies(args: {
	ctx: MutationCtx;
	universe: UniverseDoc;
	normalizedConfig: NormalizedGenerationConfig;
	universeSeed: string;
	dryRun: boolean;
	now: number;
}) {
	const { ctx, universe, normalizedConfig, universeSeed, dryRun, now } = args;

	const existingGalaxies = await ctx.db
		.query("galaxies")
		.withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
		.collect();

	const galaxyByIndex = new Map<number, Doc<"galaxies">>();
	for (const galaxy of existingGalaxies) {
		if (galaxyByIndex.has(galaxy.galaxyIndex)) {
			throw new ConvexError(
				`Duplicate galaxyIndex ${galaxy.galaxyIndex} in universe ${universe.slug}`,
			);
		}
		galaxyByIndex.set(galaxy.galaxyIndex, galaxy);
	}

	const created = { galaxies: 0 };
	const refs: GalaxyRef[] = [];

	for (let galaxyIndex = 0; galaxyIndex < normalizedConfig.galaxyCount; galaxyIndex += 1) {
		const existing = galaxyByIndex.get(galaxyIndex);
		if (existing) {
			refs.push({ galaxyIndex, galaxyId: existing._id });
			continue;
		}

		created.galaxies += 1;

		if (dryRun) {
			refs.push({ galaxyIndex, galaxyId: null });
			continue;
		}

		const offset = computeGalaxyOffset(galaxyIndex, universe.coordinateConfig);
		const galaxyId = await ctx.db.insert("galaxies", {
			universeId: universe._id,
			galaxyIndex,
			name: generateSciFiName(galaxyAddress(galaxyIndex)),
			gx: offset.gx,
			gy: offset.gy,
			seed: `${universeSeed}:galaxy:${galaxyIndex}`,
			createdAt: now,
		});

		refs.push({ galaxyIndex, galaxyId });
	}

	return {
		created,
		refs,
	};
}

async function findFirstAvailableCoreSectorIndex(args: {
	ctx: MutationCtx;
	universeId: Id<"universes">;
	galaxyIndex: number;
	startingIndex: number;
}) {
	const { ctx, universeId, galaxyIndex, startingIndex } = args;

	let candidate = startingIndex;
	while (true) {
		const existing = await ctx.db
			.query("sectors")
			.withIndex("by_universe_id_and_galaxy_index_and_sector_index", (q) =>
				q.eq("universeId", universeId).eq("galaxyIndex", galaxyIndex).eq("sectorIndex", candidate),
			)
			.unique();

		if (!existing) {
			return candidate;
		}

		candidate += 1;
	}
}

function countColonizable(planets: { isColonizable: boolean }[]) {
	let count = 0;
	for (const planet of planets) {
		if (planet.isColonizable) {
			count += 1;
		}
	}
	return count;
}

async function generateOneCoreSector(args: {
	ctx: MutationCtx;
	universe: UniverseDoc;
	universeSeed: string;
	normalizedConfig: NormalizedGenerationConfig;
	galaxyRef: GalaxyRef;
	sectorIndex: number;
	dryRun: boolean;
	now: number;
}) {
	const { ctx, universe, universeSeed, normalizedConfig, galaxyRef, sectorIndex, dryRun, now } =
		args;

	const sectorSeed = `${universeSeed}:galaxy:${galaxyRef.galaxyIndex}:sector:${sectorIndex}`;
	const bounds = buildSectorBounds(galaxyRef.galaxyIndex, sectorIndex, universe.coordinateConfig);
	const systemPositions = generateSystemPositions({
		sectorSeed,
		bounds,
		systemsPerSector: normalizedConfig.systemsPerSector,
		systemMinDistance: universe.coordinateConfig.systemMinDistance,
	});

	let createdSystems = 0;
	let createdPlanets = 0;
	let colonizablePlanets = 0;

	if (dryRun) {
		for (const position of systemPositions) {
			const planets = generatePlanetsForSystem({
				systemSeed: position.seed,
				minPlanetsPerSystem: normalizedConfig.minPlanetsPerSystem,
				maxPlanetsPerSystem: normalizedConfig.maxPlanetsPerSystem,
			});
			createdSystems += 1;
			createdPlanets += planets.length;
			colonizablePlanets += countColonizable(planets);
		}

		return {
			createdSystems,
			createdPlanets,
			colonizablePlanets,
		};
	}

	if (!galaxyRef.galaxyId) {
		throw new ConvexError("Missing galaxyId for non-dry-run sector generation");
	}

	const sectorId = await ctx.db.insert("sectors", {
		universeId: universe._id,
		galaxyId: galaxyRef.galaxyId,
		galaxyIndex: galaxyRef.galaxyIndex,
		sectorIndex,
		name: generateSciFiName(sectorAddress(galaxyRef.galaxyIndex, sectorIndex)),
		sectorType: "core",
		seed: sectorSeed,
		minX: bounds.minX,
		maxX: bounds.maxX,
		minY: bounds.minY,
		maxY: bounds.maxY,
		createdAt: now,
	});

	for (const position of systemPositions) {
		const starKind = generateStarKind(position.seed);
		const systemId = await ctx.db.insert("systems", {
			universeId: universe._id,
			galaxyId: galaxyRef.galaxyId,
			sectorId,
			galaxyIndex: galaxyRef.galaxyIndex,
			sectorIndex,
			systemIndex: position.systemIndex,
			name: generateSciFiName(
				systemAddress(galaxyRef.galaxyIndex, sectorIndex, position.systemIndex),
			),
			x: position.x,
			y: position.y,
			starKind,
			seed: position.seed,
			createdAt: now,
		});

		createdSystems += 1;

		const planets = generatePlanetsForSystem({
			systemSeed: position.seed,
			minPlanetsPerSystem: normalizedConfig.minPlanetsPerSystem,
			maxPlanetsPerSystem: normalizedConfig.maxPlanetsPerSystem,
		});

		for (const planet of planets) {
			const planetId = await ctx.db.insert("planets", {
				universeId: universe._id,
				systemId,
				galaxyIndex: galaxyRef.galaxyIndex,
				sectorIndex,
				systemIndex: position.systemIndex,
				planetIndex: planet.planetIndex,
				name: generateSciFiName(
					planetAddress(
						galaxyRef.galaxyIndex,
						sectorIndex,
						position.systemIndex,
						planet.planetIndex,
					),
				),
				orbitRadius: planet.orbitRadius,
				orbitPhaseRad: planet.orbitPhaseRad,
				orbitAngularVelocityRadPerSec: planet.orbitAngularVelocityRadPerSec,
				orbitalDistance: planet.orbitalDistance,
				planetSize: planet.planetSize,
				seed: planet.seed,
				createdAt: now,
			});
			await ctx.db.insert("planetEconomy", {
				planetId,
				universeId: universe._id,
				compositionType: planet.compositionType,
				maxBuildingSlots: planet.maxBuildingSlots,
				alloyMultiplier: planet.alloyMultiplier,
				crystalMultiplier: planet.crystalMultiplier,
				fuelMultiplier: planet.fuelMultiplier,
				isColonizable: planet.isColonizable,
				createdAt: now,
				updatedAt: now,
			});

			createdPlanets += 1;
			if (planet.isColonizable) {
				colonizablePlanets += 1;
			}
		}
	}

	return {
		createdSystems,
		createdPlanets,
		colonizablePlanets,
	};
}

function hydrateGenerationState(args: { baseState: GenerationState; galaxyCount: number }) {
	const { baseState, galaxyCount } = args;

	const nextCoreSectorIndexByGalaxy = [
		...baseState.nextCoreSectorIndexByGalaxy.slice(0, galaxyCount),
	];

	while (nextCoreSectorIndexByGalaxy.length < galaxyCount) {
		nextCoreSectorIndexByGalaxy.push(0);
	}

	return {
		...baseState,
		schemaVersion: GENERATION_STATE_SCHEMA_VERSION,
		nextCoreSectorIndexByGalaxy,
		nextGalaxyCursor: galaxyCount > 0 ? baseState.nextGalaxyCursor % galaxyCount : 0,
	} satisfies GenerationState;
}

export async function ensureCoreCapacityPipeline(
	ctx: MutationCtx,
	params: EnsureCoreCapacityParams,
): Promise<EnsureCoreCapacityResult> {
	const now = Date.now();
	const created: CreationCounters = {
		galaxies: 0,
		sectors: 0,
		systems: 0,
		planets: 0,
	};

	const universe = await resolveUniverse(ctx, params.universeSlug, params.dryRun, now);

	const normalizedConfig = normalizeGenerationConfig(universe.generationConfig);
	const targets = resolveGenerationTargets(normalizedConfig, params.overrides);
	const universeSeed = universe.seed ?? `universe:${universe.slug}`;

	const ensuredGalaxies = await ensureGalaxies({
		ctx,
		universe,
		normalizedConfig,
		universeSeed,
		dryRun: params.dryRun,
		now,
	});
	created.galaxies += ensuredGalaxies.created.galaxies;

	let generationState = universe.generationState;
	if (!generationState) {
		generationState = await buildGenerationStateFromDatabase(
			ctx,
			universe._id,
			normalizedConfig.galaxyCount,
			now,
		);
	} else {
		generationState = hydrateGenerationState({
			baseState: generationState,
			galaxyCount: normalizedConfig.galaxyCount,
		});
	}

	for (let galaxyIndex = 0; galaxyIndex < normalizedConfig.galaxyCount; galaxyIndex += 1) {
		const nextValue = generationState.nextCoreSectorIndexByGalaxy[galaxyIndex];
		if (nextValue !== undefined && nextValue > 0) {
			continue;
		}

		generationState.nextCoreSectorIndexByGalaxy[galaxyIndex] = await getNextSectorIndexForGalaxy(
			ctx,
			universe._id,
			galaxyIndex,
		);
	}

	assertNonNegativeInteger(
		"generationState.coreSectorsGenerated",
		generationState.coreSectorsGenerated,
	);
	assertNonNegativeInteger(
		"generationState.colonizablePlanetsGenerated",
		generationState.colonizablePlanetsGenerated,
	);

	const claimedColonies = await countColoniesByUniverse(ctx, universe._id);
	const capacityBefore: CapacitySnapshot = {
		coreSectors: generationState.coreSectorsGenerated,
		unclaimedColonizable: Math.max(
			0,
			generationState.colonizablePlanetsGenerated - claimedColonies,
		),
	};

	let sectorsCreatedThisRun = 0;
	while (
		sectorsCreatedThisRun < targets.maxSectorsPerRun &&
		(generationState.coreSectorsGenerated < targets.minCoreSectors ||
			generationState.colonizablePlanetsGenerated - claimedColonies <
				targets.minUnclaimedColonizablePlanets)
	) {
		const galaxyIndex =
			normalizedConfig.galaxyCount === 0
				? 0
				: generationState.nextGalaxyCursor % normalizedConfig.galaxyCount;

		generationState.nextGalaxyCursor =
			normalizedConfig.galaxyCount === 0
				? 0
				: (generationState.nextGalaxyCursor + 1) % normalizedConfig.galaxyCount;

		const galaxyRef = ensuredGalaxies.refs.find((entry) => entry.galaxyIndex === galaxyIndex);
		if (!galaxyRef) {
			throw new ConvexError(`Missing galaxy reference for index ${galaxyIndex}`);
		}

		const startingSectorIndex = generationState.nextCoreSectorIndexByGalaxy[galaxyIndex] ?? 0;

		const sectorIndex = await findFirstAvailableCoreSectorIndex({
			ctx,
			universeId: universe._id,
			galaxyIndex,
			startingIndex: startingSectorIndex,
		});

		generationState.nextCoreSectorIndexByGalaxy[galaxyIndex] = sectorIndex + 1;

		const sectorResult = await generateOneCoreSector({
			ctx,
			universe,
			universeSeed,
			normalizedConfig,
			galaxyRef,
			sectorIndex,
			dryRun: params.dryRun,
			now,
		});

		sectorsCreatedThisRun += 1;
		created.sectors += 1;
		created.systems += sectorResult.createdSystems;
		created.planets += sectorResult.createdPlanets;

		generationState.coreSectorsGenerated += 1;
		generationState.colonizablePlanetsGenerated += sectorResult.colonizablePlanets;
	}

	generationState.lastRunAt = now;

	const capacityAfter: CapacitySnapshot = {
		coreSectors: generationState.coreSectorsGenerated,
		unclaimedColonizable: Math.max(
			0,
			generationState.colonizablePlanetsGenerated - claimedColonies,
		),
	};

	const needsMore =
		capacityAfter.coreSectors < targets.minCoreSectors ||
		capacityAfter.unclaimedColonizable < targets.minUnclaimedColonizablePlanets;

	if (!params.dryRun) {
		await ctx.db.patch(universe._id, {
			updatedAt: now,
		});
		const generationRow = await ctx.db
			.query("universeGeneration")
			.withIndex("by_universe_id", (q) => q.eq("universeId", universe._id))
			.unique();
		const generationPayload = {
			universeId: universe._id,
			seed: universeSeed,
			coordinateConfig: universe.coordinateConfig,
			generationConfig: {
				...universe.generationConfig,
				minCoreSectors: universe.generationConfig.minCoreSectors ?? normalizedConfig.minCoreSectors,
				minUnclaimedColonizablePlanets:
					universe.generationConfig.minUnclaimedColonizablePlanets ??
					normalizedConfig.minUnclaimedColonizablePlanets,
				maxSectorsPerRun:
					universe.generationConfig.maxSectorsPerRun ?? normalizedConfig.maxSectorsPerRun,
			},
			generationState,
			updatedAt: now,
		};
		if (generationRow) {
			await ctx.db.patch(generationRow._id, generationPayload);
		} else {
			await ctx.db.insert("universeGeneration", {
				...generationPayload,
				createdAt: now,
			});
		}
	}

	return {
		universeId: universe._id,
		universeSlug: universe.slug,
		created,
		capacityBefore,
		capacityAfter,
		targetsApplied: targets,
		needsMore,
		dryRun: params.dryRun,
	};
}
