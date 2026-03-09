import type {
	GalaxyMeshData,
	GalaxyModelOptions,
	GalaxyPrimitiveData,
	GeneratedGalaxyModel,
} from "./types";

import { DEFAULT_PROFILE_ID, getProfile, lerp, lerpColor, type RGB } from "./palette";
import { createPrng } from "./prng";

type Vec2 = [number, number];
type Vec3 = [number, number, number];

type PrimitiveTopologyStats = {
	componentCount: number;
	openEdgeCount: number;
	degenerateTriangleCount: number;
};

type ArmBuildResult = {
	primitive: GalaxyPrimitiveData;
	widthStart: number;
	widthEnd: number;
	heightStart: number;
	heightEnd: number;
};

const POSITION_EPSILON = 1e-5;
const DEGENERATE_AREA_EPSILON = 1e-9;

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function add2(a: Vec2, b: Vec2): Vec2 {
	return [a[0] + b[0], a[1] + b[1]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function length3(v: Vec3) {
	return Math.hypot(v[0], v[1], v[2]);
}

function normalize2(v: Vec2): Vec2 {
	const length = Math.hypot(v[0], v[1]);
	if (length <= Number.EPSILON) {
		return [1, 0];
	}
	return [v[0] / length, v[1] / length];
}

function normalize3(v: Vec3): Vec3 {
	const length = length3(v);
	if (length <= Number.EPSILON) {
		return [0, 0, 1];
	}
	return [v[0] / length, v[1] / length, v[2] / length];
}

function scaled2(v: Vec2, scale: number): Vec2 {
	return [v[0] * scale, v[1] * scale];
}

function polar(radius: number, angle: number): Vec2 {
	return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function edgeKey(a: number, b: number) {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function quantizedKey(x: number, y: number, z: number) {
	const qx = Math.round(x / POSITION_EPSILON);
	const qy = Math.round(y / POSITION_EPSILON);
	const qz = Math.round(z / POSITION_EPSILON);
	return `${qx},${qy},${qz}`;
}

function chooseWeightedArmCount(
	prng: ReturnType<typeof createPrng>,
	weights: ReadonlyArray<{ count: number; weight: number }>,
) {
	const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);
	const target = prng.nextInRange(0, totalWeight);
	let cursor = 0;

	for (const entry of weights) {
		cursor += entry.weight;
		if (target <= cursor) {
			return entry.count;
		}
	}

	return weights[weights.length - 1]?.count ?? 2;
}

function stylizeFaceColor(color: RGB): RGB {
	const boost = 1.3;
	const levels = 7;

	const mapChannel = (channel: number) => {
		const centered = 0.5 + (channel - 0.5) * boost;
		const clamped = clamp(centered, 0, 1);
		return Math.round(clamped * levels) / levels;
	};

	return [mapChannel(color[0]), mapChannel(color[1]), mapChannel(color[2])];
}

class PrimitiveBuilder {
	private readonly positions: number[] = [];
	private readonly colors: number[] = [];
	private readonly indices: number[] = [];

	addVertex(position: Vec3, color: RGB) {
		this.positions.push(position[0], position[1], position[2]);
		this.colors.push(color[0], color[1], color[2]);
		return this.positions.length / 3 - 1;
	}

	addTriangle(a: number, b: number, c: number) {
		this.indices.push(a, b, c);
	}

	addQuad(a: number, b: number, c: number, d: number) {
		this.addTriangle(a, b, c);
		this.addTriangle(a, c, d);
	}

	build(name: string): GalaxyPrimitiveData {
		const flatPositions: number[] = [];
		const flatNormals: number[] = [];
		const flatColors: number[] = [];
		const flatIndices: number[] = [];

		for (let index = 0; index < this.indices.length; index += 3) {
			const i0 = this.indices[index]!;
			const i1 = this.indices[index + 1]!;
			const i2 = this.indices[index + 2]!;

			const p0: Vec3 = [
				this.positions[i0 * 3]!,
				this.positions[i0 * 3 + 1]!,
				this.positions[i0 * 3 + 2]!,
			];
			const p1: Vec3 = [
				this.positions[i1 * 3]!,
				this.positions[i1 * 3 + 1]!,
				this.positions[i1 * 3 + 2]!,
			];
			const p2: Vec3 = [
				this.positions[i2 * 3]!,
				this.positions[i2 * 3 + 1]!,
				this.positions[i2 * 3 + 2]!,
			];

			const faceNormal = cross3(sub3(p1, p0), sub3(p2, p0));
			if (length3(faceNormal) <= DEGENERATE_AREA_EPSILON) {
				continue;
			}

			const n = normalize3(faceNormal);

			const c0: RGB = [this.colors[i0 * 3]!, this.colors[i0 * 3 + 1]!, this.colors[i0 * 3 + 2]!];
			const c1: RGB = [this.colors[i1 * 3]!, this.colors[i1 * 3 + 1]!, this.colors[i1 * 3 + 2]!];
			const c2: RGB = [this.colors[i2 * 3]!, this.colors[i2 * 3 + 1]!, this.colors[i2 * 3 + 2]!];
			const faceColor = stylizeFaceColor([
				(c0[0] + c1[0] + c2[0]) / 3,
				(c0[1] + c1[1] + c2[1]) / 3,
				(c0[2] + c1[2] + c2[2]) / 3,
			]);

			const base = flatPositions.length / 3;
			flatPositions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
			flatNormals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
			flatColors.push(
				faceColor[0],
				faceColor[1],
				faceColor[2],
				faceColor[0],
				faceColor[1],
				faceColor[2],
				faceColor[0],
				faceColor[1],
				faceColor[2],
			);
			flatIndices.push(base, base + 1, base + 2);
		}

		return {
			name,
			positions: new Float32Array(flatPositions),
			normals: new Float32Array(flatNormals),
			colors: new Float32Array(flatColors),
			indices: new Uint32Array(flatIndices),
		};
	}
}

function analyzePrimitiveTopology(primitive: GalaxyPrimitiveData): PrimitiveTopologyStats {
	const { positions, indices } = primitive;
	const vertexCount = positions.length / 3;
	const weldMap = new Map<string, number>();
	const weldedByVertex = new Array<number>(vertexCount);

	let nextWeldId = 0;
	for (let vertex = 0; vertex < vertexCount; vertex += 1) {
		const x = positions[vertex * 3]!;
		const y = positions[vertex * 3 + 1]!;
		const z = positions[vertex * 3 + 2]!;
		const key = quantizedKey(x, y, z);

		let weldId = weldMap.get(key);
		if (weldId === undefined) {
			weldId = nextWeldId;
			nextWeldId += 1;
			weldMap.set(key, weldId);
		}
		weldedByVertex[vertex] = weldId;
	}

	const edgeUse = new Map<string, number>();
	const triangleWelds: [number, number, number][] = [];

	let degenerateTriangleCount = 0;
	for (let cursor = 0; cursor < indices.length; cursor += 3) {
		const i0 = indices[cursor]!;
		const i1 = indices[cursor + 1]!;
		const i2 = indices[cursor + 2]!;

		const p0: Vec3 = [positions[i0 * 3]!, positions[i0 * 3 + 1]!, positions[i0 * 3 + 2]!];
		const p1: Vec3 = [positions[i1 * 3]!, positions[i1 * 3 + 1]!, positions[i1 * 3 + 2]!];
		const p2: Vec3 = [positions[i2 * 3]!, positions[i2 * 3 + 1]!, positions[i2 * 3 + 2]!];

		const areaVector = cross3(sub3(p1, p0), sub3(p2, p0));
		if (length3(areaVector) <= DEGENERATE_AREA_EPSILON) {
			degenerateTriangleCount += 1;
		}

		const w0 = weldedByVertex[i0]!;
		const w1 = weldedByVertex[i1]!;
		const w2 = weldedByVertex[i2]!;
		triangleWelds.push([w0, w1, w2]);

		const keys = [edgeKey(w0, w1), edgeKey(w1, w2), edgeKey(w2, w0)] as const;
		for (const key of keys) {
			edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
		}
	}

	let openEdgeCount = 0;
	for (const count of edgeUse.values()) {
		if (count === 1) {
			openEdgeCount += 1;
		}
	}

	const vertexToTriangles = new Map<number, number[]>();
	for (let tri = 0; tri < triangleWelds.length; tri += 1) {
		const triangle = triangleWelds[tri]!;
		for (const weldVertex of triangle) {
			const list = vertexToTriangles.get(weldVertex);
			if (list) {
				list.push(tri);
			} else {
				vertexToTriangles.set(weldVertex, [tri]);
			}
		}
	}

	const visited = new Uint8Array(triangleWelds.length);
	let componentCount = 0;

	for (let tri = 0; tri < triangleWelds.length; tri += 1) {
		if (visited[tri]) {
			continue;
		}

		componentCount += 1;
		const stack = [tri];
		visited[tri] = 1;

		while (stack.length > 0) {
			const current = stack.pop()!;
			const currentTriangle = triangleWelds[current]!;

			for (const weldVertex of currentTriangle) {
				const neighbors = vertexToTriangles.get(weldVertex) ?? [];
				for (const neighbor of neighbors) {
					if (visited[neighbor]) {
						continue;
					}
					visited[neighbor] = 1;
					stack.push(neighbor);
				}
			}
		}
	}

	return {
		componentCount,
		openEdgeCount,
		degenerateTriangleCount,
	};
}

function computeBounds(mesh: GalaxyMeshData) {
	let maxRadius = 0;
	let maxAbsZ = 0;

	for (const primitive of mesh.primitives) {
		for (let cursor = 0; cursor < primitive.positions.length; cursor += 3) {
			const x = primitive.positions[cursor]!;
			const y = primitive.positions[cursor + 1]!;
			const z = primitive.positions[cursor + 2]!;
			const radius = Math.hypot(x, y);

			if (radius > maxRadius) {
				maxRadius = radius;
			}
			if (Math.abs(z) > maxAbsZ) {
				maxAbsZ = Math.abs(z);
			}
		}
	}

	return {
		radius: Number(maxRadius.toFixed(3)),
		thickness: Number((maxAbsZ * 2).toFixed(3)),
	};
}

function buildCorePrimitive(args: {
	maxRadius: number;
	coreRadius: number;
	coreHeight: number;
	prng: ReturnType<typeof createPrng>;
	innerColor: RGB;
	outerColor: RGB;
}) {
	const { coreRadius, coreHeight, prng, innerColor, outerColor } = args;

	const stacks = prng.nextInt(6, 8);
	const slices = prng.nextInt(12, 16);
	const halfHeight = coreHeight * 0.5;

	const builder = new PrimitiveBuilder();

	const topPole = builder.addVertex([0, 0, halfHeight], innerColor);
	const rings: number[][] = [];

	for (let stack = 1; stack < stacks; stack += 1) {
		const v = stack / stacks;
		const phi = v * Math.PI;
		const ringRadius = Math.sin(phi) * coreRadius;
		const z = Math.cos(phi) * halfHeight;
		const color = lerpColor(innerColor, outerColor, clamp(ringRadius / coreRadius, 0, 1));

		const ring: number[] = [];
		for (let slice = 0; slice < slices; slice += 1) {
			const theta = (slice / slices) * Math.PI * 2;
			const [x, y] = polar(ringRadius, theta);
			ring.push(builder.addVertex([x, y, z], color));
		}
		rings.push(ring);
	}

	const bottomPole = builder.addVertex([0, 0, -halfHeight], innerColor);

	const firstRing = rings[0] ?? [];
	for (let slice = 0; slice < slices; slice += 1) {
		const current = firstRing[slice]!;
		const next = firstRing[(slice + 1) % slices]!;
		builder.addTriangle(topPole, next, current);
	}

	for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
		const upper = rings[ringIndex]!;
		const lower = rings[ringIndex + 1]!;

		for (let slice = 0; slice < slices; slice += 1) {
			const u0 = upper[slice]!;
			const u1 = upper[(slice + 1) % slices]!;
			const l0 = lower[slice]!;
			const l1 = lower[(slice + 1) % slices]!;
			builder.addQuad(u0, u1, l1, l0);
		}
	}

	const lastRing = rings[rings.length - 1] ?? [];
	for (let slice = 0; slice < slices; slice += 1) {
		const current = lastRing[slice]!;
		const next = lastRing[(slice + 1) % slices]!;
		builder.addTriangle(bottomPole, current, next);
	}

	return builder.build("core");
}

function buildArmPrimitive(args: {
	profileId: string;
	armIndex: number;
	armCount: number;
	turns: number;
	maxRadius: number;
	coreRadius: number;
	prng: ReturnType<typeof createPrng>;
	coreColor: RGB;
	armInnerColor: RGB;
	armOuterColor: RGB;
}) {
	const {
		profileId,
		armIndex,
		armCount,
		turns,
		maxRadius,
		coreRadius,
		prng,
		coreColor,
		armInnerColor,
		armOuterColor,
	} = args;
	const profile = getProfile(profileId);

	const sectionCount = prng.nextInt(profile.minSections, profile.maxSections);
	const widthStart =
		maxRadius * prng.nextInRange(profile.minArmWidthStartScale, profile.maxArmWidthStartScale);
	const widthEnd =
		maxRadius * prng.nextInRange(profile.minArmWidthEndScale, profile.maxArmWidthEndScale);
	const heightStart =
		maxRadius * prng.nextInRange(profile.minArmHeightStartScale, profile.maxArmHeightStartScale);
	const heightEnd =
		maxRadius * prng.nextInRange(profile.minArmHeightEndScale, profile.maxArmHeightEndScale);

	const armOffset = (Math.PI * 2 * armIndex) / armCount + prng.nextInRange(-0.12, 0.12);
	const centers: Vec3[] = [];

	for (let section = 0; section < sectionCount; section += 1) {
		const t = section / (sectionCount - 1);
		const radius = lerp(coreRadius * 0.72, maxRadius * 0.98, t ** 0.9);
		const theta =
			armOffset + turns * Math.PI * 2 * t + Math.sin(t * Math.PI * 4 + armIndex) * 0.08 * (1 - t);
		const [x, y] = polar(radius, theta);

		const zCurve = Math.sin(theta * 1.4 + armIndex) * heightStart * 0.22 * (1 - t);
		const zNoise = prng.nextInRange(-heightStart * 0.08, heightStart * 0.08);

		centers.push([x, y, zCurve + zNoise]);
	}

	const builder = new PrimitiveBuilder();
	const sections: Array<{
		lt: number;
		ct: number;
		rt: number;
		rb: number;
		cb: number;
		lb: number;
		center: Vec3;
		tangent: Vec2;
		color: RGB;
	}> = [];

	for (let section = 0; section < sectionCount; section += 1) {
		const current = centers[section]!;
		const previous = centers[Math.max(0, section - 1)]!;
		const next = centers[Math.min(sectionCount - 1, section + 1)]!;

		const tangent = normalize2([next[0] - previous[0], next[1] - previous[1]]);
		const perpendicular: Vec2 = [-tangent[1], tangent[0]];

		const t = section / (sectionCount - 1);
		const baseWidth = lerp(widthStart, widthEnd, t ** 0.85);
		const baseHeight = lerp(heightStart, heightEnd, t ** 0.75);
		const startTaper = clamp(t / 0.16, 0, 1);
		const endTaper = clamp((1 - t) / 0.2, 0, 1);
		const taper = Math.min(startTaper, endTaper);
		const taperScale = Math.max(0.02, taper);
		const width = baseWidth * taperScale * prng.nextInRange(0.985, 1.015);
		const height = baseHeight * Math.max(0.04, taperScale) * prng.nextInRange(0.985, 1.015);

		const halfWidth = width * 0.5;
		const halfHeight = height * 0.5;

		const left2 = add2([current[0], current[1]], scaled2(perpendicular, halfWidth));
		const right2 = add2([current[0], current[1]], scaled2(perpendicular, -halfWidth));

		const armColor = lerpColor(armInnerColor, armOuterColor, t);
		const color = lerpColor(coreColor, armColor, clamp(t * 1.35, 0, 1));

		sections.push({
			lt: builder.addVertex([left2[0], left2[1], current[2] + halfHeight], color),
			ct: builder.addVertex([current[0], current[1], current[2] + halfHeight], color),
			rt: builder.addVertex([right2[0], right2[1], current[2] + halfHeight], color),
			rb: builder.addVertex([right2[0], right2[1], current[2] - halfHeight], color),
			cb: builder.addVertex([current[0], current[1], current[2] - halfHeight], color),
			lb: builder.addVertex([left2[0], left2[1], current[2] - halfHeight], color),
			center: current,
			tangent,
			color,
		});
	}

	for (let section = 0; section < sections.length - 1; section += 1) {
		const a = sections[section]!;
		const b = sections[section + 1]!;

		// Longitudinal faceting: top and bottom are split into left/right strips
		// that flow down the spiral centerline, rather than a single wide face.
		builder.addQuad(a.lt, b.lt, b.ct, a.ct);
		builder.addQuad(a.ct, b.ct, b.rt, a.rt);
		builder.addQuad(a.lb, a.cb, b.cb, b.lb);
		builder.addQuad(a.cb, a.rb, b.rb, b.cb);
		builder.addQuad(a.lt, a.lb, b.lb, b.lt);
		builder.addQuad(a.rb, a.rt, b.rt, b.rb);
	}

	const start = sections[0]!;
	const end = sections[sections.length - 1]!;
	const preEnd = sections[Math.max(0, sections.length - 2)]!;

	const startTipLength = Math.max(widthStart * 0.45, maxRadius * 0.025);
	const startTip2 = add2(
		[start.center[0], start.center[1]],
		scaled2(start.tangent, -startTipLength),
	);
	const startTip = builder.addVertex([startTip2[0], startTip2[1], start.center[2]], start.color);
	const startBoundary = [start.lt, start.ct, start.rt, start.rb, start.cb, start.lb] as const;
	for (let i = 0; i < startBoundary.length; i += 1) {
		const current = startBoundary[i]!;
		const next = startBoundary[(i + 1) % startBoundary.length]!;
		builder.addTriangle(startTip, next, current);
	}

	const endTipLength = Math.max(widthEnd * 1.8, maxRadius * 0.03);
	const endDir = normalize2([end.center[0] - preEnd.center[0], end.center[1] - preEnd.center[1]]);
	const endTip2 = add2([end.center[0], end.center[1]], scaled2(endDir, endTipLength));
	const endTip = builder.addVertex([endTip2[0], endTip2[1], end.center[2]], end.color);
	const endBoundary = [end.lt, end.ct, end.rt, end.rb, end.cb, end.lb] as const;
	for (let i = 0; i < endBoundary.length; i += 1) {
		const current = endBoundary[i]!;
		const next = endBoundary[(i + 1) % endBoundary.length]!;
		builder.addTriangle(endTip, current, next);
	}

	return {
		primitive: builder.build(`arm-${armIndex}`),
		widthStart,
		widthEnd,
		heightStart,
		heightEnd,
	} satisfies ArmBuildResult;
}

function buildDustPrimitive(args: {
	maxRadius: number;
	prng: ReturnType<typeof createPrng>;
	coreColor: RGB;
	dustColor: RGB;
	count: number;
}) {
	const { maxRadius, prng, coreColor, dustColor, count } = args;
	const builder = new PrimitiveBuilder();

	for (let index = 0; index < count; index += 1) {
		const radius = prng.nextInRange(maxRadius * 0.62, maxRadius * 1.05);
		const angle = prng.nextInRange(0, Math.PI * 2);
		const [x, y] = polar(radius, angle);

		const size = prng.nextInRange(maxRadius * 0.012, maxRadius * 0.028);
		const z = prng.nextInRange(-maxRadius * 0.08, maxRadius * 0.08);

		const color = lerpColor(coreColor, dustColor, clamp(radius / maxRadius, 0, 1));

		const v0 = builder.addVertex([x, y, z + size], color);
		const v1 = builder.addVertex([x + size, y, z - size * 0.3], color);
		const v2 = builder.addVertex([x - size * 0.8, y + size * 0.6, z - size * 0.2], color);
		const v3 = builder.addVertex([x - size * 0.6, y - size * 0.7, z - size * 0.2], color);

		builder.addTriangle(v0, v1, v2);
		builder.addTriangle(v0, v2, v3);
		builder.addTriangle(v0, v3, v1);
		builder.addTriangle(v1, v3, v2);
	}

	return builder.build("dust");
}

function aggregateStats(mesh: GalaxyMeshData, bounds: { radius: number; thickness: number }) {
	let vertexCount = 0;
	let triangleCount = 0;
	let componentCount = 0;
	let openEdgeCount = 0;
	let degenerateTriangleCount = 0;

	for (const primitive of mesh.primitives) {
		vertexCount += primitive.positions.length / 3;
		triangleCount += primitive.indices.length / 3;

		const topology = analyzePrimitiveTopology(primitive);
		componentCount += topology.componentCount;
		openEdgeCount += topology.openEdgeCount;
		degenerateTriangleCount += topology.degenerateTriangleCount;
	}

	const thicknessRatio =
		bounds.radius <= Number.EPSILON ? 0 : Number((bounds.thickness / bounds.radius).toFixed(4));

	return {
		vertexCount,
		triangleCount,
		materialCount: 1,
		componentCount,
		openEdgeCount,
		degenerateTriangleCount,
		thicknessRatio,
		watertight: openEdgeCount === 0 && degenerateTriangleCount === 0,
	};
}

export function generateGalaxyModel(options: GalaxyModelOptions): GeneratedGalaxyModel {
	const profileId = options.profile ?? DEFAULT_PROFILE_ID;
	const profile = getProfile(profileId);
	const prng = createPrng(`${options.seed}:${profileId}`);

	const maxRadius = prng.nextInRange(profile.minRadius, profile.maxRadius);
	const armCount = chooseWeightedArmCount(prng, profile.armWeights);
	const turns = prng.nextInRange(profile.minTurns, profile.maxTurns);

	const coreRadius =
		maxRadius * prng.nextInRange(profile.minCoreRadiusScale, profile.maxCoreRadiusScale);
	const coreHeight =
		maxRadius * prng.nextInRange(profile.minCoreHeightScale, profile.maxCoreHeightScale);

	const primitives: GalaxyPrimitiveData[] = [];

	const corePrimitive = buildCorePrimitive({
		maxRadius,
		coreRadius,
		coreHeight,
		prng,
		innerColor: profile.coreInnerColor,
		outerColor: profile.coreOuterColor,
	});
	primitives.push(corePrimitive);

	const armResults: ArmBuildResult[] = [];
	for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
		const result = buildArmPrimitive({
			profileId,
			armIndex,
			armCount,
			turns,
			maxRadius,
			coreRadius,
			prng,
			coreColor: profile.coreOuterColor,
			armInnerColor: profile.armInnerColor,
			armOuterColor: profile.armOuterColor,
		});

		armResults.push(result);
		primitives.push(result.primitive);
	}

	if (profile.dustEnabled) {
		const dustCount = prng.nextInt(profile.dustVolumeMin, profile.dustVolumeMax);
		if (dustCount > 0) {
			primitives.push(
				buildDustPrimitive({
					maxRadius,
					prng,
					coreColor: profile.armOuterColor,
					dustColor: profile.dustColor,
					count: dustCount,
				}),
			);
		}
	}

	const mesh: GalaxyMeshData = { primitives };
	const bounds = computeBounds(mesh);
	const stats = aggregateStats(mesh, bounds);

	if (stats.triangleCount < profile.minTriangles || stats.triangleCount > profile.maxTriangles) {
		throw new Error(
			`Generated triangle count ${stats.triangleCount} outside profile range ${profile.minTriangles}-${profile.maxTriangles}`,
		);
	}

	const averageWidthStart =
		armResults.length === 0
			? 0
			: armResults.reduce((sum, entry) => sum + entry.widthStart, 0) / armResults.length;
	const averageWidthEnd =
		armResults.length === 0
			? 0
			: armResults.reduce((sum, entry) => sum + entry.widthEnd, 0) / armResults.length;
	const averageHeightStart =
		armResults.length === 0
			? 0
			: armResults.reduce((sum, entry) => sum + entry.heightStart, 0) / armResults.length;

	return {
		id: options.id,
		seed: options.seed,
		mesh,
		bounds,
		stats,
		style: {
			armCount,
			turns: Number(turns.toFixed(3)),
			twist: Number((turns / Math.max(1, armCount)).toFixed(3)),
			coreScale: Number((coreRadius / Math.max(maxRadius, Number.EPSILON)).toFixed(3)),
			paletteId: profile.id,
			profileVersion: profile.id,
			armWidthStart: Number(averageWidthStart.toFixed(3)),
			armWidthEnd: Number(averageWidthEnd.toFixed(3)),
			thicknessScale: Number((averageHeightStart / Math.max(maxRadius, Number.EPSILON)).toFixed(3)),
		},
		animationHints: {
			coreRps: Number(prng.nextInRange(0.0025, 0.006).toFixed(5)),
			armsRps: Number(prng.nextInRange(0.0085, 0.0145).toFixed(5)),
			dustRps: Number(prng.nextInRange(0.005, 0.011).toFixed(5)),
		},
	};
}

export function hashGeometry(mesh: GalaxyMeshData) {
	let hash = 2166136261;

	const pushValue = (value: number) => {
		hash ^= value;
		hash = Math.imul(hash, 16777619);
		hash >>>= 0;
	};

	const pushFloat = (value: number) => {
		pushValue(Math.round(value * 10000));
	};

	for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
		const primitive = mesh.primitives[primitiveIndex]!;
		pushValue(primitiveIndex + 1);

		for (let i = 0; i < primitive.positions.length; i += 1) {
			pushFloat(primitive.positions[i]!);
		}
		for (let i = 0; i < primitive.colors.length; i += 1) {
			pushFloat(primitive.colors[i]!);
		}
		for (let i = 0; i < primitive.indices.length; i += 1) {
			pushValue(primitive.indices[i]!);
		}
	}

	return hash >>> 0;
}

export function colorAtRadius(t: number, profile = DEFAULT_PROFILE_ID) {
	const palette = getProfile(profile);
	return lerpColor(palette.coreInnerColor, palette.armOuterColor, clamp(t, 0, 1));
}
