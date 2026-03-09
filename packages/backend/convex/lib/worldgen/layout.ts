import { createPrng } from "./prng";

export type CoordinateConfig = {
	sectorWidth: number;
	sectorHeight: number;
	systemMinDistance: number;
};

export type SectorBounds = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
};

export type SystemPosition = {
	systemIndex: number;
	x: number;
	y: number;
	seed: string;
};

function clamp(value: number, min: number, max: number) {
	if (value < min) {
		return min;
	}
	if (value > max) {
		return max;
	}
	return value;
}

// Maps a 0-based index to a deterministic spiral grid coordinate.
export function spiralIndexToGrid(index: number) {
	if (index === 0) {
		return { x: 0, y: 0 };
	}

	const layer = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
	const legLength = layer * 2;
	const maxValueOnLayer = (2 * layer + 1) ** 2 - 1;

	const offset = maxValueOnLayer - index;
	const side = Math.floor(offset / legLength);
	const position = offset % legLength;

	if (side === 0) {
		return { x: layer - position, y: -layer };
	}
	if (side === 1) {
		return { x: -layer, y: -layer + position };
	}
	if (side === 2) {
		return { x: -layer + position, y: layer };
	}
	return { x: layer, y: layer - position };
}

export function buildSectorBounds(
	galaxyIndex: number,
	sectorIndex: number,
	coordinateConfig: CoordinateConfig,
): SectorBounds {
	const sectorGrid = spiralIndexToGrid(sectorIndex);
	const galaxyOffset = computeGalaxyOffset(galaxyIndex, coordinateConfig);
	const centerX = galaxyOffset.gx + sectorGrid.x * coordinateConfig.sectorWidth;
	const centerY = galaxyOffset.gy + sectorGrid.y * coordinateConfig.sectorHeight;
	const minX = centerX - coordinateConfig.sectorWidth / 2;
	const minY = centerY - coordinateConfig.sectorHeight / 2;

	return {
		minX,
		maxX: minX + coordinateConfig.sectorWidth,
		minY,
		maxY: minY + coordinateConfig.sectorHeight,
	};
}

export function computeGalaxyOffset(galaxyIndex: number, coordinateConfig: CoordinateConfig) {
	const baseSpan = Math.max(coordinateConfig.sectorWidth, coordinateConfig.sectorHeight);
	const galaxySpacing = baseSpan * 12;
	if (galaxyIndex === 0) {
		return {
			gx: 0,
			gy: 0,
		};
	}

	// Smooth deterministic spiral using the golden angle.
	const goldenAngleRad = Math.PI * (3 - Math.sqrt(5));
	const radius = galaxySpacing * Math.sqrt(galaxyIndex);
	const angle = galaxyIndex * goldenAngleRad;

	return {
		gx: Math.cos(angle) * radius,
		gy: Math.sin(angle) * radius,
	};
}

// Places systems on a deterministic jittered lattice inside a sector.
export function generateSystemPositions(args: {
	sectorSeed: string;
	bounds: SectorBounds;
	systemsPerSector: number;
	systemMinDistance: number;
}): SystemPosition[] {
	const { sectorSeed, bounds, systemsPerSector, systemMinDistance } = args;
	const prng = createPrng(`${sectorSeed}:systems`);

	const gridSize = Math.ceil(Math.sqrt(systemsPerSector));
	const width = bounds.maxX - bounds.minX;
	const height = bounds.maxY - bounds.minY;
	const cellWidth = width / gridSize;
	const cellHeight = height / gridSize;

	const padX = Math.max(0, Math.min(systemMinDistance / 2, cellWidth / 2 - 0.01));
	const padY = Math.max(0, Math.min(systemMinDistance / 2, cellHeight / 2 - 0.01));
	const jitterX = Math.max(0, cellWidth / 2 - systemMinDistance / 2);
	const jitterY = Math.max(0, cellHeight / 2 - systemMinDistance / 2);

	const systems: SystemPosition[] = [];

	for (let systemIndex = 0; systemIndex < systemsPerSector; systemIndex += 1) {
		const row = Math.floor(systemIndex / gridSize);
		const col = systemIndex % gridSize;

		const baseX = bounds.minX + (col + 0.5) * cellWidth;
		const baseY = bounds.minY + (row + 0.5) * cellHeight;

		const jitteredX = baseX + prng.nextInRange(-jitterX, jitterX);
		const jitteredY = baseY + prng.nextInRange(-jitterY, jitterY);

		systems.push({
			systemIndex,
			x: clamp(jitteredX, bounds.minX + padX, bounds.maxX - padX),
			y: clamp(jitteredY, bounds.minY + padY, bounds.maxY - padY),
			seed: `${sectorSeed}:sys:${systemIndex}`,
		});
	}

	return systems;
}
