import type { NodeShape, RadialNode, ResearchBranchKey } from "./canonical-tree-data";

import { RESEARCH_TABS, getRadialTree } from "./canonical-tree-data";

export type PolarTier = 0 | 1 | 2 | 3 | 4;
export type PolarLane =
	| "outerLeft"
	| "innerLeft"
	| "bridgeLeft"
	| "bridgeRight"
	| "innerRight"
	| "outerRight"
	| "axis"
	| "hub";

export type PolarPoint = { x: number; y: number };

export type PolarPlacedNode = {
	angleDeg: number;
	branchKey: ResearchBranchKey | "hub";
	center: PolarPoint;
	id: string;
	lane: PolarLane;
	radius: number;
	row: number;
	shape: NodeShape | "hub";
	size: number;
	tier: PolarTier;
};

export type PolarPlacedEdge = {
	arc: boolean;
	id: string;
	path: string;
	source: string;
	target: string;
};

export type PolarSector = {
	branchKey: ResearchBranchKey;
	centerDeg: number;
	endDeg: number;
	startDeg: number;
};

export type PolarDensityWarning = {
	actualGap: number;
	branchKey: ResearchBranchKey;
	minGap: number;
	nodeIds: [string, string];
	tier: Exclude<PolarTier, 0>;
};

export type PolarResearchLayout = {
	branchCenters: Record<ResearchBranchKey, number>;
	edges: PolarPlacedEdge[];
	maxRadius: number;
	nodes: Map<string, PolarPlacedNode>;
	rings: number[];
	sectors: PolarSector[];
	warnings: PolarDensityWarning[];
};

export type PolarResearchLayoutConfig = {
	arcNodeInset: number;
	branchStartAngle: number;
	minNodeGap: number;
	minTierRadii: Record<Exclude<PolarTier, 0>, number>;
	sectorPaddingDeg: number;
	shapeSizes: Record<NodeShape | "hub", number>;
	tierGap: number;
	tierSlotCapacities: Record<Exclude<PolarTier, 0>, number>;
};

type BranchTierNode = {
	branchKey: ResearchBranchKey;
	localAngleDeg: number;
	node: RadialNode;
	size: number;
};

type TierBand = {
	center: number;
	inner: number;
	outer: number;
	rowCount: number;
};

const LEGACY_SPOKE_ANGLES: Array<[number, PolarLane]> = [
	[-150, "outerLeft"],
	[-140, "outerLeft"],
	[-95, "bridgeLeft"],
	[-60, "innerLeft"],
	[-50, "innerLeft"],
	[40, "innerRight"],
	[50, "innerRight"],
	[85, "bridgeRight"],
	[130, "outerRight"],
	[140, "outerRight"],
	[180, "axis"],
	[-180, "axis"],
];

const ORDERED_TIERS: Array<Exclude<PolarTier, 0>> = [1, 2, 3, 4];

export const POLAR_RESEARCH_LAYOUT_CONFIG: PolarResearchLayoutConfig = {
	branchStartAngle: -126,
	sectorPaddingDeg: 8,
	minNodeGap: 40,
	minTierRadii: {
		1: 380,
		2: 620,
		3: 890,
		4: 1160,
	},
	tierGap: 210,
	arcNodeInset: 0.56,
	shapeSizes: {
		circle: 54,
		hex: 54,
		square: 54,
		capstone: 80,
		hub: 120,
	},
	tierSlotCapacities: {
		1: 1,
		2: 3,
		3: 5,
		4: 7,
	},
};

function normalizeAngle(angleDeg: number) {
	let angle = angleDeg;
	while (angle > 180) angle -= 360;
	while (angle <= -180) angle += 360;
	return angle;
}

function degToRad(angleDeg: number) {
	return (angleDeg * Math.PI) / 180;
}

function radToDeg(angleRad: number) {
	return (angleRad * 180) / Math.PI;
}

export function projectPolar(angleDeg: number, radius: number): PolarPoint {
	const radians = degToRad(angleDeg);
	return {
		x: Math.round(Math.cos(radians) * radius),
		y: Math.round(Math.sin(radians) * radius),
	};
}

function getLegacyLocalAngle(position: PolarPoint) {
	return normalizeAngle(radToDeg(Math.atan2(position.y, position.x)));
}

function classifyLegacyLane(position: PolarPoint): PolarLane {
	if (position.x * position.x + position.y * position.y < 25) return "hub";
	const angleDeg = getLegacyLocalAngle(position);

	let bestLane: PolarLane = "innerLeft";
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const [legacyAngle, lane] of LEGACY_SPOKE_ANGLES) {
		const rawDistance = Math.abs(angleDeg - legacyAngle);
		const wrappedDistance = Math.min(rawDistance, 360 - rawDistance);

		if (wrappedDistance < bestDistance) {
			bestDistance = wrappedDistance;
			bestLane = lane;
		}
	}

	return bestLane;
}

function slotAngles(centerDeg: number, usableSpanDeg: number, count: number) {
	if (count <= 0) return [];
	if (count === 1) return [centerDeg];

	const startDeg = centerDeg - usableSpanDeg / 2;
	const stepDeg = usableSpanDeg / (count - 1);

	return Array.from({ length: count }, (_, index) => startDeg + stepDeg * index);
}

function getBranchCenters(config: PolarResearchLayoutConfig) {
	const sectorAngle = 360 / RESEARCH_TABS.length;

	return Object.fromEntries(
		RESEARCH_TABS.map((tab, index) => [
			tab.key,
			normalizeAngle(config.branchStartAngle + sectorAngle * index),
		]),
	) as Record<ResearchBranchKey, number>;
}

function usableSectorAngle(config: PolarResearchLayoutConfig) {
	return 360 / RESEARCH_TABS.length - config.sectorPaddingDeg * 2;
}

function nodeFootprint(size: number, gap: number) {
	return size + gap;
}

function requiredRadiusForRow(
	rowOccupancy: number,
	maxNodeSize: number,
	config: PolarResearchLayoutConfig,
	usableAngleDeg: number,
) {
	if (rowOccupancy <= 1) return 0;

	const stepDeg = usableAngleDeg / Math.max(rowOccupancy - 1, 1);
	return nodeFootprint(maxNodeSize, config.minNodeGap) / degToRad(stepDeg);
}

function chunkNodes<T>(items: T[], chunkSize: number) {
	if (chunkSize <= 0) return [items];

	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}

	return chunks;
}

function rowRadius(band: TierBand, rowIndex: number, rowCount: number) {
	if (rowCount <= 1) return band.center;

	const rowGap = (band.outer - band.inner) / rowCount;
	return band.inner + rowGap * (rowIndex + 0.5);
}

function getBranchTierRows(branchNodes: BranchTierNode[], config: PolarResearchLayoutConfig) {
	const rowsByTier = new Map<Exclude<PolarTier, 0>, BranchTierNode[][]>();

	for (const tier of ORDERED_TIERS) {
		rowsByTier.set(tier, []);
	}

	const orderedNodes = [...branchNodes].sort((left, right) => {
		if (left.node.tier !== right.node.tier) return left.node.tier - right.node.tier;
		return left.localAngleDeg - right.localAngleDeg;
	});

	let cursor = 0;

	for (const tier of [1, 2, 3] as const) {
		const capacity = config.tierSlotCapacities[tier];
		const slice = orderedNodes.slice(cursor, cursor + capacity);
		cursor += slice.length;

		if (slice.length > 0) {
			rowsByTier.get(tier)?.push(slice);
		}
	}

	for (const row of chunkNodes(orderedNodes.slice(cursor), config.tierSlotCapacities[4])) {
		if (row.length > 0) rowsByTier.get(4)?.push(row);
	}

	return rowsByTier;
}

function computeTierBands(
	branchRows: Map<ResearchBranchKey, Map<Exclude<PolarTier, 0>, BranchTierNode[][]>>,
	config: PolarResearchLayoutConfig,
) {
	const usableAngleDeg = usableSectorAngle(config);
	const tierBands = {} as Record<Exclude<PolarTier, 0>, TierBand>;
	let previousOuter = 0;

	for (const tier of ORDERED_TIERS) {
		const tierRows = Array.from(branchRows.values()).flatMap(
			(rowsByTier) => rowsByTier.get(tier) ?? [],
		);
		const rowCount = Math.max(
			1,
			...Array.from(branchRows.values(), (rowsByTier) => (rowsByTier.get(tier) ?? []).length),
		);
		const maxRowOccupancy = Math.max(1, ...tierRows.map((row) => row.length));
		const fallbackSize = tier === 4 ? config.shapeSizes.capstone : config.shapeSizes.square;
		const maxNodeSize = Math.max(
			fallbackSize,
			...tierRows.flatMap((row) => row.map((branchNode) => branchNode.size)),
		);
		const bandThickness = maxNodeSize * rowCount + config.minNodeGap * Math.max(0, rowCount - 1);
		const halfThickness = bandThickness / 2;
		const requiredRadius = requiredRadiusForRow(
			maxRowOccupancy,
			maxNodeSize,
			config,
			usableAngleDeg,
		);
		const minimumCenter = Math.max(config.minTierRadii[tier], requiredRadius + halfThickness);
		const center =
			tier === 1
				? minimumCenter
				: Math.max(minimumCenter, previousOuter + config.tierGap + halfThickness);

		tierBands[tier] = {
			center,
			inner: center - halfThickness,
			outer: center + halfThickness,
			rowCount,
		};
		previousOuter = tierBands[tier].outer;
	}

	return tierBands;
}

function normalizeVector(dx: number, dy: number) {
	const length = Math.hypot(dx, dy) || 1;
	return { x: dx / length, y: dy / length };
}

function pointOnRect(
	center: PolarPoint,
	halfWidth: number,
	halfHeight: number,
	dx: number,
	dy: number,
) {
	const direction = normalizeVector(dx, dy);
	const scaleX = halfWidth / Math.max(Math.abs(direction.x), 0.0001);
	const scaleY = halfHeight / Math.max(Math.abs(direction.y), 0.0001);
	const distance = Math.min(scaleX, scaleY);

	return {
		x: center.x + direction.x * distance,
		y: center.y + direction.y * distance,
	};
}

function pointOnNodePerimeter(node: PolarPlacedNode, toward: PolarPoint) {
	const dx = toward.x - node.center.x;
	const dy = toward.y - node.center.y;

	if (node.shape === "circle" || node.shape === "hex") {
		const direction = normalizeVector(dx, dy);
		const radius = node.size * 0.52;
		return {
			x: node.center.x + direction.x * radius,
			y: node.center.y + direction.y * radius,
		};
	}

	const half = node.shape === "capstone" ? node.size * 0.46 : node.size * 0.44;
	return pointOnRect(node.center, half, half, dx, dy);
}

function arcEndpointAngle(
	node: PolarPlacedNode,
	direction: 1 | -1,
	config: PolarResearchLayoutConfig,
) {
	if (node.radius <= 1) return node.angleDeg;

	const inset = Math.min(node.size * config.arcNodeInset, node.radius * 0.8);
	const angularInsetDeg = radToDeg(Math.asin(Math.min(inset / node.radius, 0.98)));
	return node.angleDeg + angularInsetDeg * direction;
}

function buildArcPath(
	sourceNode: PolarPlacedNode,
	targetNode: PolarPlacedNode,
	config: PolarResearchLayoutConfig,
) {
	const radius = Math.max((sourceNode.radius + targetNode.radius) / 2, 1);
	const deltaDeg = normalizeAngle(targetNode.angleDeg - sourceNode.angleDeg);

	if (Math.abs(sourceNode.radius - targetNode.radius) > 1) {
		const sourceAnchor = pointOnNodePerimeter(sourceNode, targetNode.center);
		const targetAnchor = pointOnNodePerimeter(targetNode, sourceNode.center);
		const midpoint = {
			x: (sourceAnchor.x + targetAnchor.x) / 2,
			y: (sourceAnchor.y + targetAnchor.y) / 2,
		};
		const midpointDistance = Math.hypot(midpoint.x, midpoint.y) || 1;
		const control = {
			x: midpoint.x + (midpoint.x / midpointDistance) * midpointDistance * 0.18,
			y: midpoint.y + (midpoint.y / midpointDistance) * midpointDistance * 0.18,
		};

		return `M ${sourceAnchor.x},${sourceAnchor.y} Q ${control.x},${control.y} ${targetAnchor.x},${targetAnchor.y}`;
	}

	const direction: 1 | -1 = deltaDeg >= 0 ? 1 : -1;
	const oppositeDirection: 1 | -1 = direction === 1 ? -1 : 1;
	const startAngleDeg = arcEndpointAngle(sourceNode, direction, config);
	const endAngleDeg = arcEndpointAngle(targetNode, oppositeDirection, config);
	const startPoint = projectPolar(startAngleDeg, radius);
	const endPoint = projectPolar(endAngleDeg, radius);
	const angularDistance = Math.abs(normalizeAngle(endAngleDeg - startAngleDeg));
	const largeArcFlag = angularDistance > 180 ? 1 : 0;
	const sweepFlag = direction > 0 ? 1 : 0;

	return `M ${startPoint.x},${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endPoint.x} ${endPoint.y}`;
}

function buildEdgePath(
	sourceNode: PolarPlacedNode,
	targetNode: PolarPlacedNode,
	arc: boolean,
	config: PolarResearchLayoutConfig,
) {
	if (arc) {
		return buildArcPath(sourceNode, targetNode, config);
	}

	const sourceAnchor = pointOnNodePerimeter(sourceNode, targetNode.center);
	const targetAnchor = pointOnNodePerimeter(targetNode, sourceNode.center);
	return `M ${sourceAnchor.x},${sourceAnchor.y} L ${targetAnchor.x},${targetAnchor.y}`;
}

function collectDensityWarnings(
	placedNodes: Iterable<PolarPlacedNode>,
	config: PolarResearchLayoutConfig,
) {
	const grouped = new Map<string, PolarPlacedNode[]>();

	for (const node of placedNodes) {
		if (node.branchKey === "hub" || node.tier === 0) continue;
		const key = `${node.branchKey}:${node.tier}:${node.row}`;
		const group = grouped.get(key) ?? [];
		group.push(node);
		grouped.set(key, group);
	}

	const warnings: PolarDensityWarning[] = [];

	for (const group of grouped.values()) {
		if (group.length < 2) continue;
		const sorted = [...group].sort((left, right) => left.angleDeg - right.angleDeg);

		for (let index = 0; index < sorted.length - 1; index += 1) {
			const current = sorted[index];
			const next = sorted[index + 1];
			if (!current || !next) continue;

			const deltaDeg = Math.abs(normalizeAngle(next.angleDeg - current.angleDeg));
			const arcGap = current.radius * degToRad(deltaDeg);
			const minGap = current.size / 2 + next.size / 2 + config.minNodeGap;

			if (arcGap < minGap) {
				warnings.push({
					branchKey: current.branchKey as ResearchBranchKey,
					tier: current.tier as Exclude<PolarTier, 0>,
					nodeIds: [current.id, next.id],
					actualGap: arcGap,
					minGap,
				});
			}
		}
	}

	return warnings;
}

export function getPolarBranchForAngle(angleDeg: number, sectors: PolarSector[]) {
	return (
		sectors.find((sector) => {
			const diff = normalizeAngle(angleDeg - sector.centerDeg);
			return Math.abs(diff) <= normalizeAngle(sector.endDeg - sector.centerDeg);
		})?.branchKey ?? null
	);
}

export function compilePolarResearchLayout(
	config: PolarResearchLayoutConfig = POLAR_RESEARCH_LAYOUT_CONFIG,
): PolarResearchLayout {
	const nodes = new Map<string, PolarPlacedNode>();
	const edges: PolarPlacedEdge[] = [];
	const branchCenters = getBranchCenters(config);
	const usableAngleDeg = usableSectorAngle(config);
	const branchRows = new Map<ResearchBranchKey, Map<Exclude<PolarTier, 0>, BranchTierNode[][]>>();

	for (const tab of RESEARCH_TABS) {
		const tree = getRadialTree(tab.key);
		const branchNodes = tree.nodes.map((node) => ({
			branchKey: tab.key,
			node,
			size: config.shapeSizes[node.shape],
			localAngleDeg: getLegacyLocalAngle(node.position),
		}));
		branchRows.set(tab.key, getBranchTierRows(branchNodes, config));
	}

	const tierBands = computeTierBands(branchRows, config);
	const hubNode: PolarPlacedNode = {
		id: "hub_center",
		branchKey: "hub",
		lane: "hub",
		tier: 0,
		angleDeg: 0,
		radius: 0,
		row: 0,
		center: { x: 0, y: 0 },
		shape: "hub",
		size: config.shapeSizes.hub,
	};

	nodes.set(hubNode.id, hubNode);

	for (const tab of RESEARCH_TABS) {
		const tree = getRadialTree(tab.key);
		const rowsByTier = branchRows.get(tab.key);
		if (!rowsByTier) continue;

		for (const tier of ORDERED_TIERS) {
			const band = tierBands[tier];
			const tierRows = rowsByTier.get(tier) ?? [];

			tierRows.forEach((row, rowIndex) => {
				const angles = slotAngles(branchCenters[tab.key], usableAngleDeg, row.length);
				const radius = rowRadius(band, rowIndex, tierRows.length);

				row.forEach(({ node }, index) => {
					const angleDeg = angles[index] ?? branchCenters[tab.key];
					nodes.set(node.id, {
						id: node.id,
						branchKey: tab.key,
						lane: classifyLegacyLane(node.position),
						tier,
						angleDeg,
						radius,
						row: rowIndex,
						center: projectPolar(angleDeg, radius),
						shape: node.shape,
						size: config.shapeSizes[node.shape],
					});
				});
			});
		}

		for (const edge of tree.edges) {
			const sourceId = edge.source === "hub" ? hubNode.id : edge.source;
			const sourceNode = nodes.get(sourceId);
			const targetNode = nodes.get(edge.target);
			if (!sourceNode || !targetNode) continue;

			edges.push({
				id: `${edge.source}-${edge.target}`,
				source: sourceId,
				target: edge.target,
				arc: edge.arc,
				path: buildEdgePath(sourceNode, targetNode, edge.arc, config),
			});
		}
	}

	const sectors = RESEARCH_TABS.map((tab) => ({
		branchKey: tab.key,
		centerDeg: branchCenters[tab.key],
		startDeg: branchCenters[tab.key] - usableAngleDeg / 2,
		endDeg: branchCenters[tab.key] + usableAngleDeg / 2,
	}));

	return {
		branchCenters,
		nodes,
		edges,
		sectors,
		rings: ORDERED_TIERS.map((tier) => tierBands[tier].center),
		maxRadius: tierBands[4].outer,
		warnings: collectDensityWarnings(nodes.values(), config),
	};
}

export const POLAR_RESEARCH_LAYOUT = compilePolarResearchLayout();
