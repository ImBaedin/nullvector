/**
 * Radial spoke-based research tree data for mockups 5–7.
 *
 * Each tree has ~15 nodes arranged in 4 spokes radiating from a central hub,
 * plus cross-links between adjacent spokes and a capstone node.
 *
 * Positions are authored as CENTER coordinates — the mockup code offsets
 * by half-node-size when placing React Flow nodes so visuals line up.
 */

import {
	type MetaMatterRarity,
	type NodeStatus,
	type ResearchBranchKey,
	RESEARCH_TABS,
	META_MATTER_BALANCES,
	META_MATTER_COLORS,
	META_MATTER_LABELS,
} from "./mockup-data";

export { RESEARCH_TABS, META_MATTER_BALANCES, META_MATTER_COLORS, META_MATTER_LABELS };
export type { MetaMatterRarity, NodeStatus, ResearchBranchKey };

/* ── Position helper ──────────────────────────────────────────────────────── */

const R1 = 200;
const R2 = 380;
const R3 = 540;
const R4 = 680;

/** Convert (degrees, tier) → {x,y} center coordinate. 0° = right, CW positive. */
function rp(deg: number, tier: 0 | 1 | 2 | 3 | 4): { x: number; y: number } {
	const radii = [0, R1, R2, R3, R4] as const;
	const r = radii[tier];
	const rad = (deg * Math.PI) / 180;
	return { x: Math.round(Math.cos(rad) * r), y: Math.round(Math.sin(rad) * r) };
}

/* ── Spoke angles ─────────────────────────────────────────────────────────── */

const NE = -50;
const SE = 40;
const SW = 130;
const NW = -140;
const TOP = -95;
const BOT = 85;

/* ── Shared types ─────────────────────────────────────────────────────────── */

export type NodeShape = "circle" | "hex" | "square" | "capstone";

export type RadialNode = {
	id: string;
	name: string;
	tier: 0 | 1 | 2 | 3 | 4;
	shape: NodeShape | "hub";
	status: NodeStatus;
	position: { x: number; y: number };
	level: number;
	maxLevel: number;
	effects: string[];
	description: string;
	requiredFacilityLevel: number;
	costs: {
		metaMatter: Partial<Record<MetaMatterRarity, number>>;
		resources?: { alloy?: number; crystal?: number; fuel?: number };
		seconds: number;
	};
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

/* ── Cost defaults ────────────────────────────────────────────────────────── */

function costs(tier: number): RadialNode["costs"] {
	const table: Record<number, RadialNode["costs"]> = {
		1: { metaMatter: { common: 50 }, resources: { alloy: 200, crystal: 100 }, seconds: 480 },
		2: {
			metaMatter: { common: 120, rare: 25 },
			resources: { alloy: 450, crystal: 300 },
			seconds: 1800,
		},
		3: {
			metaMatter: { common: 220, rare: 55 },
			resources: { alloy: 700, crystal: 500, fuel: 300 },
			seconds: 4200,
		},
		4: {
			metaMatter: { common: 400, rare: 100, mythic: 12 },
			resources: { alloy: 1200, crystal: 800, fuel: 600 },
			seconds: 10800,
		},
	};
	return table[tier] ?? table[1]!;
}

/* ── Node builder ─────────────────────────────────────────────────────────── */

function n(
	id: string,
	name: string,
	tier: 1 | 2 | 3 | 4,
	shape: NodeShape,
	deg: number,
	status: NodeStatus,
	effects: string[],
	opts?: { maxLevel?: number; level?: number; description?: string },
): RadialNode {
	return {
		id,
		name,
		tier,
		shape,
		status,
		position: rp(deg, tier),
		level: opts?.level ?? (status === "completed" ? 1 : 0),
		maxLevel: opts?.maxLevel ?? (shape === "circle" ? 3 : 1),
		effects,
		description: opts?.description ?? `Breakthrough research in ${name.toLowerCase()}.`,
		requiredFacilityLevel: Math.min(tier, 4),
		costs: costs(tier),
	};
}

/** Shorthand edge builder. */
function e(source: string, target: string, arc = false): RadialEdge {
	return { source, target, arc };
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 * APPLIED INDUSTRY                                                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

const AI_NODES: RadialNode[] = [
	// ── Spoke NE: Resource Production ──
	n(
		"ai_smelting",
		"Automated Smelting",
		1,
		"circle",
		NE,
		"completed",
		["+8% alloy production per level"],
		{ maxLevel: 3, level: 2 },
	),
	n(
		"ai_crystal",
		"Crystal Lattice Refinement",
		2,
		"circle",
		NE,
		"available",
		["+8% crystal production per level"],
		{ maxLevel: 3 },
	),
	n(
		"ai_deepcore",
		"Deep Core Extraction",
		3,
		"circle",
		NE - 10,
		"locked",
		["+12% rare resource yield"],
		{ maxLevel: 3 },
	),

	// ── Spoke SE: Construction ──
	n("ai_assembly", "Modular Assembly", 1, "square", SE, "completed", ["-8% building upgrade time"]),
	n("ai_prefab", "Prefab Standards", 2, "square", SE, "available", ["-12% structure build time"]),
	n("ai_rapid", "Rapid Deployment", 3, "square", SE + 10, "locked", ["-18% all construction time"]),

	// ── Spoke SW: Efficiency ──
	n(
		"ai_power",
		"Power Grid Optimization",
		1,
		"circle",
		SW,
		"completed",
		["+10% energy efficiency per level"],
		{ maxLevel: 3, level: 1 },
	),
	n(
		"ai_thermal",
		"Thermal Reclaim",
		2,
		"circle",
		SW,
		"researching",
		["+6% production from waste heat per level"],
		{ maxLevel: 3 },
	),
	n(
		"ai_waste",
		"Waste Processing",
		3,
		"circle",
		SW + 10,
		"locked",
		["+15% resource recovery rate"],
		{ maxLevel: 3 },
	),

	// ── Spoke NW: Storage & Throughput ──
	n("ai_containment", "Pressurized Containment", 1, "square", NW, "completed", [
		"+15% fuel storage",
	]),
	n("ai_queue", "Queue Acceleration", 2, "square", NW, "available", ["+1 queue slot"]),
	n("ai_distributed", "Distributed Robotics", 3, "square", NW - 10, "locked", [
		"-10% facility upgrade time",
	]),

	// ── Cross-links ──
	n(
		"ai_metallurgy",
		"Advanced Metallurgy",
		2,
		"hex",
		TOP,
		"locked",
		["Unlock: Alloy Forge", "+5% alloy quality"],
		{
			description:
				"Combine extraction and assembly breakthroughs into a unified metallurgical process.",
		},
	),
	n(
		"ai_logistics",
		"Logistics Fusion",
		2,
		"hex",
		BOT,
		"locked",
		["Unlock: Mass Transit Hub", "+8% transport efficiency"],
		{
			description:
				"Merge efficiency and throughput research into an integrated logistics framework.",
		},
	),

	// ── Capstone ──
	n(
		"ai_overclock",
		"Industrial Overclock Doctrine",
		4,
		"capstone",
		180,
		"locked",
		["+18% all production", "+15% queue throughput", "-5% resource efficiency"],
		{
			description:
				"Push all industrial systems beyond standard tolerances. Colony throughput surges at the cost of operational stability.",
		},
	),
];

const AI_EDGES: RadialEdge[] = [
	// Hub → T1
	e("hub", "ai_smelting"),
	e("hub", "ai_assembly"),
	e("hub", "ai_power"),
	e("hub", "ai_containment"),
	// T1 → T2
	e("ai_smelting", "ai_crystal"),
	e("ai_assembly", "ai_prefab"),
	e("ai_power", "ai_thermal"),
	e("ai_containment", "ai_queue"),
	// T2 → T3
	e("ai_crystal", "ai_deepcore"),
	e("ai_prefab", "ai_rapid"),
	e("ai_thermal", "ai_waste"),
	e("ai_queue", "ai_distributed"),
	// Cross-links (arc edges)
	e("ai_crystal", "ai_metallurgy", true),
	e("ai_metallurgy", "ai_queue", true),
	e("ai_thermal", "ai_logistics", true),
	e("ai_logistics", "ai_prefab", true),
	// Capstone prerequisites
	e("ai_deepcore", "ai_overclock"),
	e("ai_distributed", "ai_overclock"),
	e("ai_metallurgy", "ai_overclock"),
	e("ai_logistics", "ai_overclock"),
];

/* ═══════════════════════════════════════════════════════════════════════════ *
 * MILITARY SYSTEMS                                                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

const MIL_NODES: RadialNode[] = [
	// ── Spoke NE: Defense ──
	n("mil_pointdef", "Point Defense Theory", 1, "hex", NE, "completed", ["Unlock: Laser Turret"]),
	n("mil_shield", "Shield Field Modulation", 2, "hex", NE, "available", ["Unlock: Shield Dome"]),
	n("mil_fortress", "Fortress Doctrine", 3, "hex", NE - 10, "locked", [
		"+25% defense grid effectiveness",
	]),

	// ── Spoke SE: Ship Tech ──
	n(
		"mil_hulls",
		"Reactor-Hardened Hulls",
		1,
		"circle",
		SE,
		"completed",
		["+6% frigate hull per level", "+6% cruiser hull per level"],
		{ maxLevel: 3, level: 1 },
	),
	n("mil_strike", "Advanced Strike Craft", 2, "hex", SE, "researching", ["Unlock: Bomber"]),
	n("mil_capital", "Capital Ship Design", 3, "hex", SE + 10, "locked", ["Unlock: Battlecruiser"]),

	// ── Spoke SW: Offense ──
	n("mil_missile", "Missile Guidance Suites", 1, "hex", SW, "completed", [
		"Unlock: Missile Battery",
	]),
	n(
		"mil_kinetic",
		"Kinetic Accelerators",
		2,
		"circle",
		SW,
		"available",
		["+10% projectile damage per level"],
		{ maxLevel: 3 },
	),
	n("mil_orbital", "Orbital Bombardment", 3, "hex", SW + 10, "locked", ["Unlock: Orbital Strike"]),

	// ── Spoke NW: Tactics ──
	n("mil_coord", "Fleet Coordination", 1, "square", NW, "available", ["+1 fleet slot"]),
	n("mil_ewar", "Electronic Warfare", 2, "square", NW, "locked", ["-12% enemy accuracy"]),
	n("mil_stealth", "Stealth Operations", 3, "square", NW - 10, "locked", ["Unlock: Cloaked Recon"]),

	// ── Cross-links ──
	n(
		"mil_integrated",
		"Integrated Defense Grid",
		2,
		"square",
		TOP,
		"locked",
		["+15% coordinated defense output"],
		{ description: "Link point defense and fleet systems into a unified defensive network." },
	),
	n(
		"mil_combined",
		"Combined Arms Doctrine",
		2,
		"square",
		BOT,
		"locked",
		["+12% mixed-fleet combat bonus"],
		{ description: "Formalize combined-arms tactics for multi-vector engagements." },
	),

	// ── Capstone ──
	n(
		"mil_theater",
		"Theater Command Systems",
		4,
		"capstone",
		180,
		"locked",
		["+1 task force slot", "+12% fleet operation efficiency"],
		{
			description:
				"Establish fleet-wide tactical coordination networks for synchronized operations across sectors.",
		},
	),
];

const MIL_EDGES: RadialEdge[] = [
	e("hub", "mil_pointdef"),
	e("hub", "mil_hulls"),
	e("hub", "mil_missile"),
	e("hub", "mil_coord"),
	e("mil_pointdef", "mil_shield"),
	e("mil_hulls", "mil_strike"),
	e("mil_missile", "mil_kinetic"),
	e("mil_coord", "mil_ewar"),
	e("mil_shield", "mil_fortress"),
	e("mil_strike", "mil_capital"),
	e("mil_kinetic", "mil_orbital"),
	e("mil_ewar", "mil_stealth"),
	e("mil_shield", "mil_integrated", true),
	e("mil_integrated", "mil_ewar", true),
	e("mil_kinetic", "mil_combined", true),
	e("mil_combined", "mil_strike", true),
	e("mil_fortress", "mil_theater"),
	e("mil_stealth", "mil_theater"),
	e("mil_integrated", "mil_theater"),
	e("mil_combined", "mil_theater"),
];

/* ═══════════════════════════════════════════════════════════════════════════ *
 * SCIENTIFIC INFRASTRUCTURE                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

const SCI_NODES: RadialNode[] = [
	// ── Spoke NE: Speed ──
	n(
		"sci_archive",
		"Archive Compression",
		1,
		"circle",
		NE,
		"completed",
		["-5% research duration per level"],
		{ maxLevel: 3, level: 2 },
	),
	n(
		"sci_quantum",
		"Quantum Processing",
		2,
		"circle",
		NE,
		"available",
		["-8% research duration per level"],
		{ maxLevel: 3 },
	),
	n(
		"sci_temporal",
		"Temporal Analysis",
		3,
		"circle",
		NE - 10,
		"locked",
		["-15% all research durations"],
		{ maxLevel: 3 },
	),

	// ── Spoke SE: Capacity ──
	n("sci_parallel", "Parallel Inquiry", 1, "hex", SE, "completed", ["+1 research queue slot"]),
	n("sci_distcomp", "Distributed Computing", 2, "square", SE, "available", [
		"+1 research queue slot",
	]),
	n("sci_neural", "Neural Net Integration", 3, "hex", SE + 10, "locked", [
		"Unlock: Automated Research",
	]),

	// ── Spoke SW: Economy ──
	n(
		"sci_method",
		"Experimental Methodology",
		1,
		"circle",
		SW,
		"completed",
		["-4% meta-matter costs per level"],
		{ maxLevel: 3, level: 1 },
	),
	n("sci_peer", "Peer Review Protocols", 2, "square", SW, "available", [
		"50% meta-matter refund on cancel",
	]),
	n(
		"sci_grant",
		"Grant Optimization",
		3,
		"circle",
		SW + 10,
		"locked",
		["+20% contract meta-matter rewards"],
		{ maxLevel: 3 },
	),

	// ── Spoke NW: Synergy ──
	n("sci_datalink", "Cross-Colony Datalinks", 1, "square", NW, "available", [
		"+5% per-colony research synergy",
	]),
	n("sci_federated", "Federated Databanks", 2, "square", NW, "locked", [
		"+15% multi-colony research synergy",
	]),
	n("sci_collective", "Collective Intelligence", 3, "hex", NW - 10, "locked", [
		"Unlock: Hive Research Mode",
	]),

	// ── Cross-links ──
	n(
		"sci_synthesis",
		"Knowledge Synthesis",
		2,
		"hex",
		TOP,
		"locked",
		["Unlock: Cross-Branch Research"],
		{ description: "Fuse speed and capacity breakthroughs into a knowledge synthesis engine." },
	),
	n(
		"sci_meta",
		"Meta-Analysis Framework",
		2,
		"hex",
		BOT,
		"locked",
		["-10% late-game research costs"],
		{ description: "Apply systematic meta-analysis to reduce waste across all research pathways." },
	),

	// ── Capstone ──
	n(
		"sci_unified",
		"Unified Theory Initiative",
		4,
		"capstone",
		180,
		"locked",
		["-20% all research durations", "Unlock: tier 5 research nodes"],
		{
			description:
				"Pursue a grand unification framework that accelerates all late-game research pathways.",
		},
	),
];

const SCI_EDGES: RadialEdge[] = [
	e("hub", "sci_archive"),
	e("hub", "sci_parallel"),
	e("hub", "sci_method"),
	e("hub", "sci_datalink"),
	e("sci_archive", "sci_quantum"),
	e("sci_parallel", "sci_distcomp"),
	e("sci_method", "sci_peer"),
	e("sci_datalink", "sci_federated"),
	e("sci_quantum", "sci_temporal"),
	e("sci_distcomp", "sci_neural"),
	e("sci_peer", "sci_grant"),
	e("sci_federated", "sci_collective"),
	e("sci_quantum", "sci_synthesis", true),
	e("sci_synthesis", "sci_federated", true),
	e("sci_peer", "sci_meta", true),
	e("sci_meta", "sci_distcomp", true),
	e("sci_temporal", "sci_unified"),
	e("sci_collective", "sci_unified"),
	e("sci_synthesis", "sci_unified"),
	e("sci_meta", "sci_unified"),
];

/* ═══════════════════════════════════════════════════════════════════════════ *
 * EXPANSION & LOGISTICS                                                     *
 * ═══════════════════════════════════════════════════════════════════════════ */

const EXP_NODES: RadialNode[] = [
	// ── Spoke NE: Transport ──
	n(
		"exp_cargo",
		"Cargo Standardization",
		1,
		"circle",
		NE,
		"completed",
		["+10% cargo capacity per level"],
		{ maxLevel: 3, level: 2 },
	),
	n("exp_convoy", "Automated Convoys", 2, "square", NE, "available", ["-25% transport time"]),
	n("exp_hyper", "Hyperspace Corridors", 3, "hex", NE - 10, "locked", ["Unlock: Hyperspace Lane"]),

	// ── Spoke SE: Range ──
	n(
		"exp_refuel",
		"Deep Space Refueling",
		1,
		"circle",
		SE,
		"completed",
		["-6% fleet fuel cost per level"],
		{ maxLevel: 3, level: 1 },
	),
	n("exp_sensors", "Long Range Sensors", 2, "square", SE, "researching", ["+40% sensor range"]),
	n("exp_warp", "Warp Gate Technology", 3, "hex", SE + 10, "locked", ["Unlock: Warp Gate"]),

	// ── Spoke SW: Colony ──
	n("exp_frontier", "Frontier Supply Doctrine", 1, "square", SW, "available", [
		"-20% colonization setup cost",
	]),
	n("exp_bureau", "Colonial Bureaucracy", 2, "square", SW, "locked", [
		"Colony cap progression hook",
	]),
	n("exp_terraform", "Terraforming Basics", 3, "hex", SW + 10, "locked", ["Unlock: Terraforming"]),

	// ── Spoke NW: Infrastructure ──
	n(
		"exp_supply",
		"Supply Chain Optimization",
		1,
		"circle",
		NW,
		"available",
		["+8% trade efficiency per level"],
		{ maxLevel: 3 },
	),
	n("exp_backbone", "Logistics Backbone", 2, "square", NW, "locked", ["+20% transport efficiency"]),
	n("exp_commerce", "Interstellar Commerce", 3, "hex", NW - 10, "locked", ["Unlock: Trade Routes"]),

	// ── Cross-links ──
	n(
		"exp_transit",
		"Transit Efficiency",
		2,
		"hex",
		TOP,
		"locked",
		["+15% fleet speed in friendly space"],
		{
			description:
				"Merge transport and range research into a unified transit optimization framework.",
		},
	),
	n("exp_frontlog", "Frontier Logistics", 2, "hex", BOT, "locked", ["-15% frontier supply cost"], {
		description: "Combine colony and infrastructure know-how for efficient frontier logistics.",
	}),

	// ── Capstone ──
	n(
		"exp_network",
		"Interstellar Research Network",
		4,
		"capstone",
		180,
		"locked",
		["Enable: Combined Research Capacity", "Late-game nodes use sum of all directorate levels"],
		{
			description:
				"Link all research directorate facilities into a single aggregate capacity pool.",
		},
	),
];

const EXP_EDGES: RadialEdge[] = [
	e("hub", "exp_cargo"),
	e("hub", "exp_refuel"),
	e("hub", "exp_frontier"),
	e("hub", "exp_supply"),
	e("exp_cargo", "exp_convoy"),
	e("exp_refuel", "exp_sensors"),
	e("exp_frontier", "exp_bureau"),
	e("exp_supply", "exp_backbone"),
	e("exp_convoy", "exp_hyper"),
	e("exp_sensors", "exp_warp"),
	e("exp_bureau", "exp_terraform"),
	e("exp_backbone", "exp_commerce"),
	e("exp_convoy", "exp_transit", true),
	e("exp_transit", "exp_backbone", true),
	e("exp_sensors", "exp_frontlog", true),
	e("exp_frontlog", "exp_bureau", true),
	e("exp_hyper", "exp_network"),
	e("exp_commerce", "exp_network"),
	e("exp_transit", "exp_network"),
	e("exp_frontlog", "exp_network"),
];

/* ═══════════════════════════════════════════════════════════════════════════ *
 * COLONY SPECIALIZATION                                                     *
 * ═══════════════════════════════════════════════════════════════════════════ */

const COL_NODES: RadialNode[] = [
	// ── Spoke NE: Defense ──
	n("col_defgrid", "Defense Grid Architecture", 1, "hex", NE, "completed", [
		"Unlock: Defense Grid",
	]),
	n("col_shieldinfra", "Shield Infrastructure", 2, "square", NE, "available", [
		"+20% shield coverage",
	]),
	n("col_planetary", "Planetary Fortress", 3, "hex", NE - 10, "locked", [
		"Unlock: Planetary Shield",
	]),

	// ── Spoke SE: Production ──
	n("col_naval", "Naval Production Coordination", 1, "hex", SE, "available", ["Unlock: Shipyard"]),
	n(
		"col_asmline",
		"Assembly Line Mastery",
		2,
		"circle",
		SE,
		"locked",
		["+12% ship build speed per level"],
		{ maxLevel: 3 },
	),
	n("col_mega", "Megastructure Foundation", 3, "hex", SE + 10, "locked", [
		"Unlock: Megastructure Slot",
	]),

	// ── Spoke SW: Automation ──
	n(
		"col_robotics",
		"Advanced Robotics Admin",
		1,
		"circle",
		SW,
		"available",
		["+5% robotics effectiveness per level"],
		{ maxLevel: 3 },
	),
	n("col_aigov", "AI Governance", 2, "square", SW, "locked", ["Unlock: AI Governor"]),
	n("col_fullauto", "Full Autonomy Protocols", 3, "hex", SW + 10, "locked", [
		"Unlock: Full Automation",
	]),

	// ── Spoke NW: Science ──
	n("col_survey", "Planetary Survey Methods", 1, "hex", NW, "available", [
		"Unlock: Planetary Scanner",
	]),
	n(
		"col_geology",
		"Geological Exploitation",
		2,
		"circle",
		NW,
		"locked",
		["+15% rare mineral yield per level"],
		{ maxLevel: 3 },
	),
	n("col_anomaly", "Anomaly Research", 3, "hex", NW - 10, "locked", ["Unlock: Anomaly Lab"]),

	// ── Cross-links ──
	n(
		"col_infrasynergy",
		"Infrastructure Synergy",
		2,
		"square",
		TOP,
		"locked",
		["+10% building synergy bonus"],
		{ description: "Fuse defense and science infrastructure for amplified colony output." },
	),
	n(
		"col_specproc",
		"Specialized Processing",
		2,
		"square",
		BOT,
		"locked",
		["+10% specialized output"],
		{ description: "Merge production and automation insights for specialized processing gains." },
	),

	// ── Capstone ──
	n(
		"col_controlled",
		"Controlled Automation",
		4,
		"capstone",
		180,
		"locked",
		["+25% specialized colony output"],
		{
			description:
				"Grant full autonomous governance to specialized colonies, dramatically boosting their focused output.",
		},
	),
];

const COL_EDGES: RadialEdge[] = [
	e("hub", "col_defgrid"),
	e("hub", "col_naval"),
	e("hub", "col_robotics"),
	e("hub", "col_survey"),
	e("col_defgrid", "col_shieldinfra"),
	e("col_naval", "col_asmline"),
	e("col_robotics", "col_aigov"),
	e("col_survey", "col_geology"),
	e("col_shieldinfra", "col_planetary"),
	e("col_asmline", "col_mega"),
	e("col_aigov", "col_fullauto"),
	e("col_geology", "col_anomaly"),
	e("col_shieldinfra", "col_infrasynergy", true),
	e("col_infrasynergy", "col_geology", true),
	e("col_asmline", "col_specproc", true),
	e("col_specproc", "col_aigov", true),
	e("col_planetary", "col_controlled"),
	e("col_anomaly", "col_controlled"),
	e("col_infrasynergy", "col_controlled"),
	e("col_specproc", "col_controlled"),
];

/* ── Lookup ───────────────────────────────────────────────────────────────── */

const TREES: Record<ResearchBranchKey, RadialTree> = {
	applied_industry: { branchKey: "applied_industry", nodes: AI_NODES, edges: AI_EDGES },
	military_systems: { branchKey: "military_systems", nodes: MIL_NODES, edges: MIL_EDGES },
	scientific_infrastructure: {
		branchKey: "scientific_infrastructure",
		nodes: SCI_NODES,
		edges: SCI_EDGES,
	},
	expansion_logistics: { branchKey: "expansion_logistics", nodes: EXP_NODES, edges: EXP_EDGES },
	colony_specialization: { branchKey: "colony_specialization", nodes: COL_NODES, edges: COL_EDGES },
};

export function getRadialTree(branch: ResearchBranchKey): RadialTree {
	return TREES[branch];
}

/* ── Active research ──────────────────────────────────────────────────────── */

export const ACTIVE_RESEARCH = {
	nodeId: "mil_strike",
	nodeName: "Advanced Strike Craft",
	branch: "military_systems" as ResearchBranchKey,
	fromLevel: 0,
	toLevel: 1,
	originColony: "Aegis Prime",
	pct: 75,
	remaining: "15:00",
};

/* ── Layout helpers for mockups ───────────────────────────────────────────── */

export const NODE_SIZE = { circle: 60, hex: 60, square: 60, capstone: 88, hub: 110 } as const;

/**
 * Determine which handle direction (top/right/bottom/left) a source node
 * should use to face toward a target node. Returns handle IDs for both ends.
 */
export function bestHandles(
	src: { x: number; y: number },
	tgt: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
	const dx = tgt.x - src.x;
	const dy = tgt.y - src.y;
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	if (angle > -45 && angle <= 45) return { sourceHandle: "right", targetHandle: "left" };
	if (angle > 45 && angle <= 135) return { sourceHandle: "bottom", targetHandle: "top" };
	if (angle > -135 && angle <= -45) return { sourceHandle: "top", targetHandle: "bottom" };
	return { sourceHandle: "left", targetHandle: "right" };
}

/** Format seconds to a human string (e.g. "1h 30m"). */
export function formatDuration(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	if (h > 0 && m > 0) return `${h}h ${m}m`;
	if (h > 0) return `${h}h`;
	return `${m}m`;
}

/** Format large numbers (e.g. 1200 → "1.2k"). */
export function fmt(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return n.toLocaleString();
}
