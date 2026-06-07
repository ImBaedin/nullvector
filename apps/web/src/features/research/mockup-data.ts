/**
 * Mock data for research tree mockups.
 * All data is hand-authored for visual prototyping — no backend dependency.
 */

/* ── Meta-matter rarities ─────────────────────────────────────────────────── */

export type MetaMatterRarity = "common" | "rare" | "mythic";

export const META_MATTER_BALANCES: Record<MetaMatterRarity, number> = {
	common: 1_842,
	rare: 314,
	mythic: 27,
};

export const META_MATTER_LABELS: Record<MetaMatterRarity, string> = {
	common: "Common",
	rare: "Rare",
	mythic: "Mythic",
};

export const META_MATTER_COLORS: Record<MetaMatterRarity, string> = {
	common: "#a0b4cc",
	rare: "#6ecbff",
	mythic: "#e48cff",
};

/* ── Node shapes ──────────────────────────────────────────────────────────── */

export type NodeShape = "circle" | "hex" | "square" | "capstone";

/* ── Branch keys and tabs ─────────────────────────────────────────────────── */

export type ResearchBranchKey =
	| "applied_industry"
	| "military_systems"
	| "scientific_infrastructure"
	| "expansion_logistics"
	| "colony_specialization";

export type ResearchTabDef = {
	key: ResearchBranchKey;
	label: string;
	shortLabel: string;
	themeColor: string;
	themeColorSoft: string;
	ditherWaveColor: [number, number, number];
	ditherPixelSize: number;
};

export const RESEARCH_TABS: ResearchTabDef[] = [
	{
		key: "applied_industry",
		label: "Applied Industry",
		shortLabel: "Industry",
		themeColor: "#ff914f",
		themeColorSoft: "rgba(255,145,79,0.14)",
		ditherWaveColor: [0.65, 0.35, 0.12],
		ditherPixelSize: 2,
	},
	{
		key: "military_systems",
		label: "Military Systems",
		shortLabel: "Military",
		themeColor: "#ff6f88",
		themeColorSoft: "rgba(255,111,136,0.14)",
		ditherWaveColor: [0.6, 0.15, 0.2],
		ditherPixelSize: 2,
	},
	{
		key: "scientific_infrastructure",
		label: "Scientific Infrastructure",
		shortLabel: "Science",
		themeColor: "#9b7cff",
		themeColorSoft: "rgba(155,124,255,0.14)",
		ditherWaveColor: [0.3, 0.2, 0.6],
		ditherPixelSize: 3,
	},
	{
		key: "expansion_logistics",
		label: "Expansion & Logistics",
		shortLabel: "Expansion",
		themeColor: "#64f8bb",
		themeColorSoft: "rgba(100,248,187,0.14)",
		ditherWaveColor: [0.12, 0.5, 0.35],
		ditherPixelSize: 2,
	},
	{
		key: "colony_specialization",
		label: "Colony Specialization",
		shortLabel: "Colony",
		themeColor: "#ffd166",
		themeColorSoft: "rgba(255,209,102,0.14)",
		ditherWaveColor: [0.55, 0.45, 0.15],
		ditherPixelSize: 2,
	},
];

/* ── Node status ──────────────────────────────────────────────────────────── */

export type NodeStatus = "completed" | "available" | "locked" | "researching";

/* ── Research node definition ─────────────────────────────────────────────── */

export type MockResearchNode = {
	id: string;
	name: string;
	branch: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4 | 5;
	shape: NodeShape;
	description: string;
	position: { x: number; y: number };
	prerequisites: string[];
	level: number;
	maxLevel: number;
	status: NodeStatus;
	requiredResearchFacilityLevel: number;
	costs: {
		metaMatter: Partial<Record<MetaMatterRarity, number>>;
		resources?: { alloy?: number; crystal?: number; fuel?: number };
		seconds: number;
	};
	effects: string[];
};

/* ── Applied Industry tree ────────────────────────────────────────────────── */

export const APPLIED_INDUSTRY_NODES: MockResearchNode[] = [
	{
		id: "automated_smelting",
		name: "Automated Smelting",
		branch: "applied_industry",
		tier: 1,
		shape: "circle",
		description: "Refine alloy extraction protocols using autonomous thermal regulation.",
		position: { x: 0, y: 0 },
		prerequisites: [],
		level: 1,
		maxLevel: 3,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 40 }, resources: { alloy: 200 }, seconds: 600 },
		effects: ["+8% alloy production per level"],
	},
	{
		id: "crystal_lattice_refinement",
		name: "Crystal Lattice Refinement",
		branch: "applied_industry",
		tier: 1,
		shape: "circle",
		description: "Optimize crystalline growth chambers for improved yield purity.",
		position: { x: 280, y: -60 },
		prerequisites: ["automated_smelting"],
		level: 0,
		maxLevel: 3,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 55 }, resources: { crystal: 180 }, seconds: 720 },
		effects: ["+8% crystal production per level"],
	},
	{
		id: "fuel_compression",
		name: "Fuel Compression",
		branch: "applied_industry",
		tier: 1,
		shape: "circle",
		description: "Pressurize refined fuel into ultra-dense cells for expanded capacity.",
		position: { x: 280, y: 60 },
		prerequisites: ["automated_smelting"],
		level: 0,
		maxLevel: 3,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 50 }, resources: { fuel: 300 }, seconds: 660 },
		effects: ["+12% fuel storage per level"],
	},
	{
		id: "modular_assembly",
		name: "Modular Assembly Standards",
		branch: "applied_industry",
		tier: 2,
		shape: "square",
		description: "Standardize construction modules across all colonies for faster deployment.",
		position: { x: 560, y: -60 },
		prerequisites: ["crystal_lattice_refinement"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 120, rare: 15 },
			resources: { alloy: 500, crystal: 300 },
			seconds: 1800,
		},
		effects: ["-10% building upgrade time"],
	},
	{
		id: "distributed_robotics",
		name: "Distributed Robotics",
		branch: "applied_industry",
		tier: 2,
		shape: "square",
		description: "Deploy autonomous construction drones across facility production lines.",
		position: { x: 560, y: 60 },
		prerequisites: ["fuel_compression"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 130, rare: 20 },
			resources: { alloy: 400, crystal: 400 },
			seconds: 2100,
		},
		effects: ["-10% facility upgrade time"],
	},
	{
		id: "industrial_overclock",
		name: "Industrial Overclock Doctrine",
		branch: "applied_industry",
		tier: 3,
		shape: "capstone",
		description:
			"Push all industrial systems beyond standard tolerances. Colony throughput surges at the cost of operational stability.",
		position: { x: 840, y: 0 },
		prerequisites: ["modular_assembly", "distributed_robotics"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 3,
		costs: {
			metaMatter: { common: 250, rare: 60, mythic: 5 },
			resources: { alloy: 1200, crystal: 800, fuel: 600 },
			seconds: 7200,
		},
		effects: ["+18% all production", "+15% queue throughput", "-5% resource efficiency"],
	},
];

/* ── Military Systems tree ────────────────────────────────────────────────── */

export const MILITARY_SYSTEMS_NODES: MockResearchNode[] = [
	{
		id: "point_defense_theory",
		name: "Point Defense Theory",
		branch: "military_systems",
		tier: 1,
		shape: "hex",
		description: "Develop targeting algorithms for close-range interception batteries.",
		position: { x: 0, y: 0 },
		prerequisites: [],
		level: 1,
		maxLevel: 1,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 60 }, resources: { alloy: 300, crystal: 100 }, seconds: 900 },
		effects: ["Unlock: Laser Turret"],
	},
	{
		id: "missile_guidance",
		name: "Missile Guidance Suites",
		branch: "military_systems",
		tier: 1,
		shape: "hex",
		description: "Install guidance-corrected warhead tracking for long-range batteries.",
		position: { x: 280, y: -80 },
		prerequisites: ["point_defense_theory"],
		level: 1,
		maxLevel: 1,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 80 }, resources: { alloy: 400, crystal: 200 }, seconds: 1200 },
		effects: ["Unlock: Missile Battery"],
	},
	{
		id: "reactor_hardened_hulls",
		name: "Reactor-Hardened Hulls",
		branch: "military_systems",
		tier: 2,
		shape: "circle",
		description: "Line ship hulls with reactor-grade composite plating for improved survivability.",
		position: { x: 280, y: 80 },
		prerequisites: ["point_defense_theory"],
		level: 0,
		maxLevel: 3,
		status: "researching",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 100, rare: 25 },
			resources: { alloy: 600, crystal: 300 },
			seconds: 2400,
		},
		effects: ["+6% frigate hull per level", "+6% cruiser hull per level"],
	},
	{
		id: "advanced_strike_craft",
		name: "Advanced Strike Craft",
		branch: "military_systems",
		tier: 2,
		shape: "hex",
		description: "Design high-maneuverability bombers capable of capital-ship assault runs.",
		position: { x: 560, y: -80 },
		prerequisites: ["missile_guidance"],
		level: 0,
		maxLevel: 1,
		status: "available",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 140, rare: 35 },
			resources: { alloy: 700, crystal: 500 },
			seconds: 3000,
		},
		effects: ["Unlock: Bomber"],
	},
	{
		id: "shield_field_modulation",
		name: "Shield Field Modulation",
		branch: "military_systems",
		tier: 2,
		shape: "hex",
		description: "Generate overlapping shield envelopes across colony defense perimeters.",
		position: { x: 560, y: 80 },
		prerequisites: ["reactor_hardened_hulls"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 160, rare: 40 },
			resources: { alloy: 500, crystal: 700 },
			seconds: 3600,
		},
		effects: ["Unlock: Shield Dome"],
	},
	{
		id: "theater_command",
		name: "Theater Command Systems",
		branch: "military_systems",
		tier: 3,
		shape: "capstone",
		description:
			"Establish fleet-wide tactical coordination networks for synchronized operations across sectors.",
		position: { x: 840, y: 0 },
		prerequisites: ["advanced_strike_craft", "shield_field_modulation"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 3,
		costs: {
			metaMatter: { common: 300, rare: 80, mythic: 10 },
			resources: { alloy: 1500, crystal: 1000, fuel: 800 },
			seconds: 9000,
		},
		effects: ["+1 task force slot", "+12% fleet operation efficiency"],
	},
];

/* ── Scientific Infrastructure tree ───────────────────────────────────────── */

export const SCIENTIFIC_INFRASTRUCTURE_NODES: MockResearchNode[] = [
	{
		id: "research_protocols",
		name: "Research Network Protocols",
		branch: "scientific_infrastructure",
		tier: 1,
		shape: "square",
		description: "Formalize internal research methodologies across the directorate.",
		position: { x: 0, y: 0 },
		prerequisites: [],
		level: 1,
		maxLevel: 1,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 30 }, seconds: 300 },
		effects: ["Enable research queue"],
	},
	{
		id: "archive_compression",
		name: "Archive Compression",
		branch: "scientific_infrastructure",
		tier: 1,
		shape: "circle",
		description: "Compress archived data streams to accelerate retrieval and analysis.",
		position: { x: 260, y: -50 },
		prerequisites: ["research_protocols"],
		level: 1,
		maxLevel: 3,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 45 }, seconds: 480 },
		effects: ["-5% research duration per level"],
	},
	{
		id: "experimental_methodology",
		name: "Experimental Methodology",
		branch: "scientific_infrastructure",
		tier: 1,
		shape: "circle",
		description: "Introduce controlled experimentation standards to reduce meta-matter waste.",
		position: { x: 260, y: 50 },
		prerequisites: ["research_protocols"],
		level: 0,
		maxLevel: 3,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 50 }, seconds: 540 },
		effects: ["-4% meta-matter costs (tier 1-2 nodes) per level"],
	},
	{
		id: "parallel_inquiry",
		name: "Parallel Inquiry",
		branch: "scientific_infrastructure",
		tier: 2,
		shape: "hex",
		description: "Enable simultaneous research streams by partitioning directorate capacity.",
		position: { x: 520, y: -50 },
		prerequisites: ["archive_compression"],
		level: 0,
		maxLevel: 1,
		status: "available",
		requiredResearchFacilityLevel: 2,
		costs: { metaMatter: { common: 200, rare: 50 }, seconds: 3600 },
		effects: ["+1 research queue slot"],
	},
	{
		id: "peer_review",
		name: "Peer Review Protocols",
		branch: "scientific_infrastructure",
		tier: 2,
		shape: "circle",
		description: "Institute cross-colony peer validation for reduced cancellation waste.",
		position: { x: 520, y: 50 },
		prerequisites: ["experimental_methodology"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: { metaMatter: { common: 140, rare: 30 }, seconds: 2400 },
		effects: ["50% meta-matter refund on cancellation"],
	},
	{
		id: "federated_databanks",
		name: "Federated Databanks",
		branch: "scientific_infrastructure",
		tier: 3,
		shape: "square",
		description: "Link all colony research archives into a unified knowledge network.",
		position: { x: 780, y: 0 },
		prerequisites: ["parallel_inquiry", "peer_review"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 3,
		costs: { metaMatter: { common: 300, rare: 70, mythic: 8 }, seconds: 5400 },
		effects: ["+15% multi-colony research synergy"],
	},
	{
		id: "unified_theory",
		name: "Unified Theory Initiative",
		branch: "scientific_infrastructure",
		tier: 4,
		shape: "capstone",
		description:
			"Pursue a grand unification framework that accelerates all late-game research pathways.",
		position: { x: 1040, y: 0 },
		prerequisites: ["federated_databanks"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 4,
		costs: { metaMatter: { common: 500, rare: 120, mythic: 20 }, seconds: 14400 },
		effects: ["-20% all research durations", "Unlock: tier 5 research nodes"],
	},
];

/* ── Expansion & Logistics tree ───────────────────────────────────────────── */

export const EXPANSION_LOGISTICS_NODES: MockResearchNode[] = [
	{
		id: "cargo_standardization",
		name: "Cargo Standardization",
		branch: "expansion_logistics",
		tier: 1,
		shape: "circle",
		description: "Adopt universal cargo dimensions for seamless intercolony shipment.",
		position: { x: 0, y: 0 },
		prerequisites: [],
		level: 1,
		maxLevel: 3,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 35 }, resources: { alloy: 150 }, seconds: 450 },
		effects: ["+10% cargo capacity per level"],
	},
	{
		id: "deep_space_refueling",
		name: "Deep Space Refueling",
		branch: "expansion_logistics",
		tier: 1,
		shape: "circle",
		description: "Deploy autonomous fuel depots at interstellar waypoints.",
		position: { x: 280, y: -70 },
		prerequisites: ["cargo_standardization"],
		level: 0,
		maxLevel: 3,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 55 }, resources: { fuel: 400 }, seconds: 600 },
		effects: ["-6% fleet fuel cost per level"],
	},
	{
		id: "frontier_supply",
		name: "Frontier Supply Doctrine",
		branch: "expansion_logistics",
		tier: 2,
		shape: "square",
		description: "Establish forward supply chains that reduce colony foundation friction.",
		position: { x: 280, y: 70 },
		prerequisites: ["cargo_standardization"],
		level: 0,
		maxLevel: 1,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: {
			metaMatter: { common: 90, rare: 10 },
			resources: { alloy: 300, fuel: 200 },
			seconds: 1500,
		},
		effects: ["-20% colonization setup cost"],
	},
	{
		id: "colonial_bureaucracy",
		name: "Colonial Bureaucracy",
		branch: "expansion_logistics",
		tier: 2,
		shape: "square",
		description: "Formalize governance frameworks that support additional colony oversight.",
		position: { x: 560, y: -70 },
		prerequisites: ["deep_space_refueling"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: { metaMatter: { common: 180, rare: 40 }, seconds: 3000 },
		effects: ["Colony cap progression hook"],
	},
	{
		id: "logistics_backbone",
		name: "Logistics Backbone",
		branch: "expansion_logistics",
		tier: 2,
		shape: "square",
		description: "Build a resilient transport network between core and frontier worlds.",
		position: { x: 560, y: 70 },
		prerequisites: ["frontier_supply"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: {
			metaMatter: { common: 160, rare: 35 },
			resources: { alloy: 500, crystal: 300 },
			seconds: 2700,
		},
		effects: ["+20% transport efficiency"],
	},
	{
		id: "interstellar_research_network",
		name: "Interstellar Research Network",
		branch: "expansion_logistics",
		tier: 3,
		shape: "capstone",
		description: "Link research sites into a single empire-wide research network.",
		position: { x: 840, y: 0 },
		prerequisites: ["colonial_bureaucracy", "logistics_backbone"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 3,
		costs: {
			metaMatter: { common: 400, rare: 100, mythic: 15 },
			resources: { alloy: 1000, crystal: 1000, fuel: 500 },
			seconds: 10800,
		},
		effects: [
			"Enable: Combined Research Capacity",
			"Late-game nodes use sum of all directorate levels",
		],
	},
];

/* ── Colony Specialization tree ───────────────────────────────────────────── */

export const COLONY_SPECIALIZATION_NODES: MockResearchNode[] = [
	{
		id: "defense_grid_architecture",
		name: "Defense Grid Architecture",
		branch: "colony_specialization",
		tier: 1,
		shape: "hex",
		description: "Design integrated defense grids capable of coordinated zone-wide response.",
		position: { x: 0, y: -50 },
		prerequisites: [],
		level: 1,
		maxLevel: 1,
		status: "completed",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 50 }, resources: { alloy: 250 }, seconds: 600 },
		effects: ["Unlock: Defense Grid"],
	},
	{
		id: "naval_production_coordination",
		name: "Naval Production Coordination",
		branch: "colony_specialization",
		tier: 1,
		shape: "hex",
		description: "Centralize shipyard operations for capital vessel assembly lines.",
		position: { x: 0, y: 50 },
		prerequisites: [],
		level: 0,
		maxLevel: 1,
		status: "available",
		requiredResearchFacilityLevel: 1,
		costs: { metaMatter: { common: 55 }, resources: { alloy: 300, crystal: 150 }, seconds: 720 },
		effects: ["Unlock: Shipyard"],
	},
	{
		id: "advanced_robotics_admin",
		name: "Advanced Robotics Administration",
		branch: "colony_specialization",
		tier: 2,
		shape: "circle",
		description: "Extend robotic oversight protocols for deeper facility automation.",
		position: { x: 280, y: -50 },
		prerequisites: ["defense_grid_architecture"],
		level: 0,
		maxLevel: 3,
		status: "available",
		requiredResearchFacilityLevel: 2,
		costs: { metaMatter: { common: 100, rare: 20 }, resources: { alloy: 400 }, seconds: 1800 },
		effects: ["+5% robotics effectiveness per level"],
	},
	{
		id: "planetary_survey",
		name: "Planetary Survey Methods",
		branch: "colony_specialization",
		tier: 2,
		shape: "hex",
		description: "Deploy deep-core surveying to reveal hidden resource deposits and anomalies.",
		position: { x: 280, y: 50 },
		prerequisites: ["naval_production_coordination"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 2,
		costs: { metaMatter: { common: 120, rare: 25 }, resources: { crystal: 400 }, seconds: 2100 },
		effects: ["Unlock: Planetary Scanner"],
	},
	{
		id: "controlled_automation",
		name: "Controlled Automation",
		branch: "colony_specialization",
		tier: 3,
		shape: "capstone",
		description:
			"Grant full autonomous governance to specialized colonies, dramatically boosting their focused output.",
		position: { x: 560, y: 0 },
		prerequisites: ["advanced_robotics_admin", "planetary_survey"],
		level: 0,
		maxLevel: 1,
		status: "locked",
		requiredResearchFacilityLevel: 3,
		costs: {
			metaMatter: { common: 350, rare: 85, mythic: 12 },
			resources: { alloy: 800, crystal: 600, fuel: 400 },
			seconds: 7800,
		},
		effects: ["+25% specialized colony output"],
	},
];

/* ── Active research mock ─────────────────────────────────────────────────── */

export const ACTIVE_RESEARCH = {
	nodeId: "reactor_hardened_hulls",
	nodeName: "Reactor-Hardened Hulls",
	branch: "military_systems" as ResearchBranchKey,
	fromLevel: 0,
	toLevel: 1,
	originColony: "Aegis Prime",
	startedAt: Date.now() - 45 * 60_000,
	completesAt: Date.now() + 15 * 60_000,
	totalSeconds: 2400,
};

/* ── Helper: get nodes for a branch ───────────────────────────────────────── */

export function getNodesForBranch(branch: ResearchBranchKey): MockResearchNode[] {
	switch (branch) {
		case "applied_industry":
			return APPLIED_INDUSTRY_NODES;
		case "military_systems":
			return MILITARY_SYSTEMS_NODES;
		case "scientific_infrastructure":
			return SCIENTIFIC_INFRASTRUCTURE_NODES;
		case "expansion_logistics":
			return EXPANSION_LOGISTICS_NODES;
		case "colony_specialization":
			return COLONY_SPECIALIZATION_NODES;
	}
}

/* ── Helper: format seconds to human string ───────────────────────────────── */

export function formatDuration(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	if (h > 0 && m > 0) return `${h}h ${m}m`;
	if (h > 0) return `${h}h`;
	return `${m}m`;
}

export function formatResourceCount(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return n.toLocaleString();
}
