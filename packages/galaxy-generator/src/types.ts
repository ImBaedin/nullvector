export type GalaxyLayerMetadata = {
	coreRps: number;
	armsRps: number;
	dustRps: number;
};

export type GalaxyStyleMetadata = {
	armCount: number;
	turns: number;
	twist: number;
	coreScale: number;
	paletteId: string;
	profileVersion: string;
	armWidthStart: number;
	armWidthEnd: number;
	thicknessScale: number;
};

export type GalaxyBounds = {
	radius: number;
	thickness: number;
};

export type GalaxyStats = {
	vertexCount: number;
	triangleCount: number;
	materialCount: number;
	componentCount: number;
	openEdgeCount: number;
	degenerateTriangleCount: number;
	thicknessRatio: number;
	watertight: boolean;
};

export type GalaxyPrimitiveData = {
	name: string;
	positions: Float32Array;
	normals: Float32Array;
	colors: Float32Array;
	indices: Uint32Array;
};

export type GalaxyMeshData = {
	primitives: GalaxyPrimitiveData[];
};

export type GeneratedGalaxyModel = {
	id: string;
	seed: string;
	mesh: GalaxyMeshData;
	bounds: GalaxyBounds;
	stats: GalaxyStats;
	style: GalaxyStyleMetadata;
	animationHints: GalaxyLayerMetadata;
};

export type GalaxyModelOptions = {
	id: string;
	seed: string;
	profile?: string;
};

export type GalaxyModelManifestEntry = {
	id: string;
	seed: string;
	file: string;
	bounds: GalaxyBounds;
	stats: GalaxyStats;
	style: GalaxyStyleMetadata;
	animationHints: GalaxyLayerMetadata;
};

export type GalaxyLibraryManifest = {
	version: "2.0.0";
	profile: string;
	librarySeed: string;
	createdAt: string;
	count: number;
	models: GalaxyModelManifestEntry[];
};

export type GalaxyLibraryOptions = {
	outDir: string;
	count?: number;
	seed?: string;
	overwrite?: boolean;
	profile?: string;
};
