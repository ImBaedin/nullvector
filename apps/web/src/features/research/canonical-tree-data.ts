import {
	DEFAULT_RESEARCH_BRANCHES,
	META_MATTER_RARITIES,
	type MetaMatterRarity,
	type ResearchBranchKey,
	type ResearchNodeShape,
	type ResearchRequirementStatus,
} from "@nullvector/game-logic";

export type { MetaMatterRarity, ResearchBranchKey };

export type NodeStatus = "completed" | "available" | "locked" | "researching" | "hidden";
export type NodeShape = ResearchNodeShape;

export type RadialNode = {
	id: string;
	name: string;
	branch: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4;
	shape: NodeShape;
	status: NodeStatus;
	visibility: "hidden" | "silhouette" | "visible";
	canStart: boolean;
	position: { x: number; y: number };
	prerequisites: string[];
	level: number;
	maxLevel: number;
	effects: string[];
	description: string;
	requiredFacilityLevel: number;
	requiredCombinedResearchCapacity?: number;
	requirements: ResearchRequirementStatus[];
	costs: {
		metaMatter: Record<MetaMatterRarity, number>;
		resources: { alloy: number; crystal: number; fuel: number };
		seconds: number;
	} | null;
};

export type RadialEdge = {
	source: string;
	target: string;
	arc: boolean;
};

export type RadialTree = {
	branchKey: ResearchBranchKey;
	nodes: RadialNode[];
	edges: RadialEdge[];
};

export const META_MATTER_COLORS: Record<MetaMatterRarity, string> = {
	common: "#a0b4cc",
	rare: "#6ecbff",
	mythic: "#e48cff",
};

export const META_MATTER_LABELS: Record<MetaMatterRarity, string> = {
	common: "Common",
	rare: "Rare",
	mythic: "Mythic",
};

export const META_MATTER_BALANCES: Record<MetaMatterRarity, number> = {
	common: 0,
	rare: 0,
	mythic: 0,
};

export const RESEARCH_TABS = DEFAULT_RESEARCH_BRANCHES.map((branch) => ({
	key: branch.key,
	label: branch.label,
	shortLabel: branch.shortLabel,
	themeColor: branch.themeColor,
	themeColorSoft: branch.themeColorSoft,
	ditherWaveColor: branch.ditherWaveColor,
	ditherPixelSize: branch.ditherPixelSize,
}));

function emptyMetaMatter(): Record<MetaMatterRarity, number> {
	return Object.fromEntries(META_MATTER_RARITIES.map((rarity) => [rarity, 0])) as Record<
		MetaMatterRarity,
		number
	>;
}

function getStaticNodeStatus(level: number, visibility: RadialNode["visibility"]): NodeStatus {
	if (level > 0) return "completed";
	return visibility === "hidden" ? "hidden" : "locked";
}

function edgesForNodes(nodes: RadialNode[]): RadialEdge[] {
	return nodes.flatMap((node) => {
		if (node.prerequisites.length === 0) {
			return [{ source: "hub", target: node.id, arc: false }];
		}
		return node.prerequisites.map((source, index) => ({
			source,
			target: node.id,
			arc: index > 0,
		}));
	});
}

function buildStaticTree(branchKey: ResearchBranchKey): RadialTree {
	const branch = DEFAULT_RESEARCH_BRANCHES.find((candidate) => candidate.key === branchKey);
	if (!branch) {
		return { branchKey, nodes: [], edges: [] };
	}
	const nodes: RadialNode[] = branch.tiers.flatMap((tier) =>
		tier.nodes.map((node) => {
			const costs = node.costs[0];
			return {
				id: node.id,
				name: node.name,
				branch: node.branch,
				tier: node.tier,
				shape: node.layout.shape,
				status: getStaticNodeStatus(0, "hidden"),
				visibility: "hidden",
				canStart: false,
				position: node.position,
				prerequisites: node.prerequisites,
				level: 0,
				maxLevel: node.maxLevel,
				effects: node.effectLabels,
				description: node.description,
				requiredFacilityLevel: node.requiredResearchFacilityLevel,
				requiredCombinedResearchCapacity: node.requiredCombinedResearchCapacity,
				requirements: [],
				costs: costs
					? {
							metaMatter: { ...emptyMetaMatter(), ...costs.metaMatter },
							resources: {
								alloy: costs.resources?.alloy ?? 0,
								crystal: costs.resources?.crystal ?? 0,
								fuel: costs.resources?.fuel ?? 0,
							},
							seconds: costs.seconds,
						}
					: null,
			};
		}),
	);
	return {
		branchKey,
		nodes,
		edges: edgesForNodes(nodes),
	};
}

const STATIC_TREES = Object.fromEntries(
	RESEARCH_TABS.map((tab) => [tab.key, buildStaticTree(tab.key)]),
) as Record<ResearchBranchKey, RadialTree>;

export function getRadialTree(branch: ResearchBranchKey): RadialTree {
	return STATIC_TREES[branch];
}

export { edgesForNodes };

export function formatDuration(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	if (h > 0 && m > 0) return `${h}h ${m}m`;
	if (h > 0) return `${h}h`;
	return `${m}m`;
}

export function fmt(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return n.toLocaleString();
}
