/**
 * Research Mockup 7 — "Progression Grid"
 *
 * All 5 research branches visible simultaneously in a radial sector layout.
 * Each branch occupies a 72-degree sector radiating from a central ROOT CORE hub.
 *
 * Key feature: the dither background smoothly lerps to each sector's theme
 * color when the cursor enters that sector — giving instant visual feedback
 * about which branch you're exploring.
 */

import "@/features/game-ui/theme";
import { createFileRoute } from "@tanstack/react-router";
import "@xyflow/react/dist/style.css";
import {
	ReactFlow,
	Background,
	BaseEdge,
	type Node,
	type Edge,
	type EdgeProps,
	Position,
	Handle,
	type NodeProps,
	ReactFlowProvider,
	useReactFlow,
} from "@xyflow/react";
import { useState, useCallback, useRef, useEffect } from "react";

import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	RESEARCH_TABS,
	META_MATTER_BALANCES,
	META_MATTER_COLORS,
	ACTIVE_RESEARCH,
	NODE_SIZE,
	bestHandles,
	formatDuration,
	fmt,
	getRadialTree,
	type RadialNode,
	type NodeStatus,
	type ResearchBranchKey,
} from "@/features/research/radial-tree-data";

export const Route = createFileRoute("/game/colony/$colonyId/research7")({
	component: Research7,
});

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  CONSTANTS                                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

const BASE = {
	bg: "#040810",
	glass: "rgba(5,9,20,0.86)",
	stroke: "rgba(100,150,220,0.10)",
	t1: "#edf5ff",
	t2: "#a4bed8",
	t3: "#5e7a94",
	completed: "#64f8bb",
	available: "#3dd9ff",
	researching: "#ffd166",
};

/**
 * Sector center angles (mathematical convention: 0° = right, CW positive
 * because screen y-axis points down).
 *
 *  Industry    −126° = upper-left
 *  Military     −54° = upper-right
 *  Science       18° = lower-right
 *  Colony        90° = straight down (bottom-center)
 *  Expansion    162° = lower-left
 */
const SECTOR_CENTERS: Record<ResearchBranchKey, number> = {
	applied_industry: -126,
	military_systems: -54,
	scientific_infrastructure: 18,
	colony_specialization: 90,
	expansion_logistics: 162,
};

/** Boundary angles — exactly halfway between adjacent sector centers. */
const SECTOR_BOUNDARIES = [-162, -90, -18, 54, 126] as const;

/** Radii per tier in the all-at-once layout (scaled up vs. radial-tree-data). */
const RADII: Record<0 | 1 | 2 | 3 | 4, number> = {
	0: 0,
	1: 270,
	2: 450,
	3: 610,
	4: 760,
};

/**
 * Sub-spoke offset (degrees) from sector center per original data spoke.
 *
 * Mapping from radial-tree-data.ts spoke angles:
 *   NW  −140° → most counter-CW  → −28°
 *   NE   −50° → second CCW       → −10°
 *   SE    40° → second CW        → +10°
 *   SW   130° → most CW          → +28°
 *   TOP  −95° → cross-link CCW   → −18°
 *   BOT   85° → cross-link CW    → +18°
 *   CAPSTONE 180° → sector axis  →   0°
 */
const SPOKE_OFFSET: Record<string, number> = {
	NW: -28,
	NE: -10,
	SE: 10,
	SW: 28,
	TOP: -18,
	BOT: 18,
	CAPSTONE: 0,
};

/** Default dither color (dark blue-tint neutral). */
const DEFAULT_DITHER: [number, number, number] = [0.13, 0.13, 0.2];

/** Flow-space radius within which we suppress sector detection (over the hub). */
const HUB_DEAD_ZONE = 100;

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  POSITION UTILITIES                                                        *
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Classify an original node position to its sub-spoke name by matching
 * the polar angle (atan2) against the known source spoke angles.
 */
function classifySpoke(pos: { x: number; y: number }): string {
	if (pos.x * pos.x + pos.y * pos.y < 25) return "HUB";
	const a = Math.atan2(pos.y, pos.x) * (180 / Math.PI);
	// Known spoke angles + offset variants (tier-3 nodes are ±10° from base)
	const SPOKES: [number, string][] = [
		[-150, "NW"],
		[-140, "NW"],
		[-95, "TOP"],
		[-60, "NE"],
		[-50, "NE"],
		[40, "SE"],
		[50, "SE"],
		[85, "BOT"],
		[130, "SW"],
		[140, "SW"],
		[180, "CAPSTONE"],
		[-180, "CAPSTONE"],
	];
	let best = "NE";
	let minD = Infinity;
	for (const [sd, sn] of SPOKES) {
		const raw = Math.abs(a - sd);
		const w = Math.min(raw, 360 - raw);
		if (w < minD) {
			minD = w;
			best = sn;
		}
	}
	return best;
}

/**
 * Re-map a node from its original radial-tree-data position into the
 * allocated sector for its branch.
 */
function remapPos(
	orig: { x: number; y: number },
	tier: 0 | 1 | 2 | 3 | 4,
	sectorCenterDeg: number,
): { x: number; y: number } {
	if (orig.x * orig.x + orig.y * orig.y < 25) return { x: 0, y: 0 };
	const spoke = classifySpoke(orig);
	const offset = SPOKE_OFFSET[spoke] ?? 0;
	const rad = ((sectorCenterDeg + offset) * Math.PI) / 180;
	const r = RADII[Math.min(tier, 4) as 0 | 1 | 2 | 3 | 4];
	return { x: Math.round(Math.cos(rad) * r), y: Math.round(Math.sin(rad) * r) };
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  SECTOR DETECTION                                                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

function getSectorForAngle(angleDeg: number): ResearchBranchKey | null {
	for (const tab of RESEARCH_TABS) {
		let diff = angleDeg - SECTOR_CENTERS[tab.key];
		while (diff > 180) diff -= 360;
		while (diff < -180) diff += 360;
		if (Math.abs(diff) <= 36) return tab.key;
	}
	return null;
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  DITHER COLOR LERP HOOK                                                    *
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Smoothly interpolates the dither background color toward the hovered
 * sector's theme color. Internally uses a rAF loop; state is throttled to
 * ~21 fps to avoid hammering IsolatedDither's separate React root.
 */
function useDitherColor(hoveredBranch: ResearchBranchKey | null): [number, number, number] {
	const targetRef = useRef<[number, number, number]>([...DEFAULT_DITHER]);
	const currentRef = useRef<[number, number, number]>([...DEFAULT_DITHER]);
	const [display, setDisplay] = useState<[number, number, number]>([...DEFAULT_DITHER]);
	const lastSetMs = useRef(0);

	// Update target when hovered branch changes
	useEffect(() => {
		if (hoveredBranch) {
			const tab = RESEARCH_TABS.find((t) => t.key === hoveredBranch);
			if (tab) {
				const [r, g, b] = tab.ditherWaveColor;
				// Boost slightly so the color is clearly visible at moderate opacity
				targetRef.current = [Math.min(r * 1.5, 1), Math.min(g * 1.5, 1), Math.min(b * 1.5, 1)];
			}
		} else {
			targetRef.current = [...DEFAULT_DITHER];
		}
	}, [hoveredBranch]);

	// rAF lerp loop
	useEffect(() => {
		let raf: number;
		const LERP = 0.055;
		function tick(ts: number) {
			const c = currentRef.current;
			const t = targetRef.current;
			const n: [number, number, number] = [
				c[0] + (t[0] - c[0]) * LERP,
				c[1] + (t[1] - c[1]) * LERP,
				c[2] + (t[2] - c[2]) * LERP,
			];
			const delta = Math.abs(n[0] - c[0]) + Math.abs(n[1] - c[1]) + Math.abs(n[2] - c[2]);
			if (delta > 0.0003) {
				currentRef.current = n;
				if (ts - lastSetMs.current > 48) {
					// ~21 fps state update cap
					lastSetMs.current = ts;
					setDisplay([n[0], n[1], n[2]]);
				}
			}
			raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	return display;
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  BUILD ALL-BRANCH FLOW DATA                                                *
 * ═══════════════════════════════════════════════════════════════════════════ */

type AugNode = RadialNode & { branchThemeColor: string; branchKey: ResearchBranchKey };

function buildFlowData() {
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const posMap = new Map<string, { x: number; y: number }>();

	// ── Central hub ───────────────────────────────────────────────────────────
	const HUB = 120;
	posMap.set("hub_center", { x: 0, y: 0 });
	nodes.push({
		id: "hub_center",
		type: "hubCenter",
		position: { x: -HUB / 2, y: -HUB / 2 },
		data: {},
		draggable: false,
		selectable: false,
	});

	// ── Branch nodes + edges ──────────────────────────────────────────────────
	for (const tab of RESEARCH_TABS) {
		const tree = getRadialTree(tab.key);
		const sc = SECTOR_CENTERS[tab.key];

		// Nodes
		for (const n of tree.nodes) {
			const pos = remapPos(n.position, n.tier as 0 | 1 | 2 | 3 | 4, sc);
			posMap.set(n.id, pos);
			const sz = NODE_SIZE[n.shape as keyof typeof NODE_SIZE] ?? 60;
			nodes.push({
				id: n.id,
				type: n.shape,
				position: { x: pos.x - sz / 2, y: pos.y - sz / 2 },
				data: { ...n, branchThemeColor: tab.themeColor, branchKey: tab.key } as any,
				draggable: false,
			});
		}

		// Edges
		for (const ed of tree.edges) {
			const srcId = ed.source === "hub" ? "hub_center" : ed.source;
			const sp = ed.source === "hub" ? { x: 0, y: 0 } : (posMap.get(ed.source) ?? { x: 0, y: 0 });
			const tp = posMap.get(ed.target) ?? { x: 0, y: 0 };
			const { sourceHandle, targetHandle } = bestHandles(sp, tp);

			const srcN = tree.nodes.find((n) => n.id === ed.source);
			const tgtN = tree.nodes.find((n) => n.id === ed.target);
			const lit = srcN?.status === "completed" || ed.source === "hub";
			const locked = tgtN?.status === "locked";
			const researching = tgtN?.status === "researching";

			edges.push({
				id: `${ed.source}-${ed.target}`,
				source: srcId,
				target: ed.target,
				sourceHandle,
				targetHandle,
				type: ed.arc ? "arc" : "spoke",
				animated: researching,
				style: {
					stroke:
						lit && !locked
							? `${tab.themeColor}88`
							: researching
								? `${BASE.researching}55`
								: `${tab.themeColor}26`,
					strokeWidth: lit && !locked ? 1.8 : 1,
					strokeDasharray: locked ? "4 6" : undefined,
				},
			});
		}
	}
	return { nodes, edges };
}

// Build once at module load — static data, no reactivity needed
const { nodes: FLOW_NODES, edges: FLOW_EDGES } = buildFlowData();

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  HANDLE HELPERS                                                            *
 * ═══════════════════════════════════════════════════════════════════════════ */

const HS = {
	background: "transparent",
	border: "none",
	width: 1,
	height: 1,
	minWidth: 1,
	minHeight: 1,
} as const;

function H() {
	return (
		<>
			{(["Top", "Right", "Bottom", "Left"] as const).map((p) => (
				<Handle
					key={`t-${p}`}
					type="target"
					position={Position[p]}
					id={p.toLowerCase()}
					style={HS}
				/>
			))}
			{(["Top", "Right", "Bottom", "Left"] as const).map((p) => (
				<Handle
					key={`s-${p}`}
					type="source"
					position={Position[p]}
					id={p.toLowerCase()}
					style={HS}
				/>
			))}
		</>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  STATUS → COLORS                                                           *
 * ═══════════════════════════════════════════════════════════════════════════ */

function statusC(status: NodeStatus, branchColor: string) {
	switch (status) {
		case "completed":
			return {
				border: BASE.completed,
				fill: `${BASE.completed}14`,
				glow: `${BASE.completed}2a`,
				label: BASE.completed,
			};
		case "available":
			return { border: BASE.available, fill: `${BASE.available}0C`, glow: "none", label: BASE.t2 };
		case "researching":
			return {
				border: BASE.researching,
				fill: `${BASE.researching}10`,
				glow: `${BASE.researching}30`,
				label: BASE.researching,
			};
		default:
			return {
				border: `${branchColor}32`,
				fill: "rgba(12,18,34,0.55)",
				glow: "none",
				label: BASE.t3,
			};
	}
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  NODE LABEL                                                                *
 * ═══════════════════════════════════════════════════════════════════════════ */

function Lbl({ name, color }: { name: string; color: string }) {
	return (
		<div
			style={{
				position: "absolute",
				top: "100%",
				left: "50%",
				transform: "translateX(-50%)",
				marginTop: 6,
				width: 88,
				textAlign: "center",
				pointerEvents: "none",
			}}
		>
			<span
				style={{
					fontFamily: "var(--nv-font-body)",
					fontSize: 9,
					fontWeight: 600,
					color,
					lineHeight: 1.3,
					display: "block",
				}}
			>
				{name}
			</span>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  TREE NODE RENDERERS                                                       *
 * ═══════════════════════════════════════════════════════════════════════════ */

function CircleN({ data }: NodeProps) {
	const d = data as unknown as AugNode;
	const c = statusC(d.status, d.branchThemeColor);
	const dim = d.status === "locked" ? 0.42 : 1;
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: "50%",
					border: `2px solid ${c.border}`,
					background: `radial-gradient(circle at 38% 34%, ${c.fill}, rgba(4,8,16,0.72))`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						c.glow !== "none"
							? `0 0 20px ${c.glow}, 0 0 5px ${d.branchThemeColor}18`
							: `0 0 4px ${d.branchThemeColor}14`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{d.maxLevel > 1 && (
					<div style={{ display: "flex", gap: 3 }}>
						{Array.from({ length: d.maxLevel }).map((_, i) => (
							<div
								key={i}
								style={{
									width: 5,
									height: 5,
									borderRadius: "50%",
									background: i < d.level ? c.border : `${c.border}28`,
									boxShadow: i < d.level ? `0 0 4px ${c.border}` : "none",
								}}
							/>
						))}
					</div>
				)}
			</div>
			<Lbl name={d.name} color={c.label} />
		</div>
	);
}

function HexN({ data }: NodeProps) {
	const d = data as unknown as AugNode;
	const c = statusC(d.status, d.branchThemeColor);
	const dim = d.status === "locked" ? 0.42 : 1;
	const clip = "polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)";
	// SVG hex points for W=60 H=60 (inset 1px per side → from 3.5,15 to 56.5,15 etc.)
	const pts = "30,1 57,15.5 57,44.5 30,59 3,44.5 3,15.5";
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div style={{ width: 60, height: 60, position: "relative", opacity: dim, cursor: "pointer" }}>
				{/* Fill layer */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						clipPath: clip,
						background: `linear-gradient(150deg, ${c.fill}, rgba(4,8,16,0.72))`,
						boxShadow:
							c.glow !== "none"
								? `inset 0 0 14px ${c.glow}`
								: `inset 0 0 6px ${d.branchThemeColor}18`,
					}}
				/>
				{/* Inner gem accent */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						clipPath: clip,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							width: 10,
							height: 10,
							borderRadius: 1,
							border: `1px solid ${c.border}60`,
							background: `${c.border}1a`,
							transform: "rotate(45deg)",
						}}
					/>
				</div>
				{/* SVG border */}
				<svg style={{ position: "absolute", inset: 0 }} width="60" height="60" viewBox="0 0 60 60">
					<polygon points={pts} fill="none" stroke={c.border} strokeWidth="2" />
				</svg>
			</div>
			<Lbl name={d.name} color={c.label} />
		</div>
	);
}

function SquareN({ data }: NodeProps) {
	const d = data as unknown as AugNode;
	const c = statusC(d.status, d.branchThemeColor);
	const dim = d.status === "locked" ? 0.42 : 1;
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: 6,
					border: `2px solid ${c.border}`,
					background: `linear-gradient(145deg, ${c.fill}, rgba(4,8,16,0.72))`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						c.glow !== "none"
							? `0 0 16px ${c.glow}, 0 0 4px ${d.branchThemeColor}18`
							: `0 0 3px ${d.branchThemeColor}12`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: 12,
						height: 12,
						borderRadius: 2,
						border: `1px solid ${c.border}44`,
						background: `${c.border}18`,
					}}
				/>
			</div>
			<Lbl name={d.name} color={c.label} />
		</div>
	);
}

function CapstoneN({ data }: NodeProps) {
	const d = data as unknown as AugNode;
	const c = statusC(d.status, d.branchThemeColor);
	const dim = d.status === "locked" ? 0.35 : 1;
	return (
		<div style={{ width: 88, height: 88, position: "relative" }}>
			<H />
			<div
				style={{
					width: 88,
					height: 88,
					borderRadius: 14,
					border: `2.5px solid ${c.border}`,
					background: `radial-gradient(circle at 40% 35%, ${c.fill}, rgba(4,8,16,0.65) 70%)`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						c.glow !== "none"
							? `0 0 32px ${c.glow}, 0 0 8px ${d.branchThemeColor}22`
							: `0 0 6px ${d.branchThemeColor}18`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: 16,
						height: 16,
						borderRadius: "50%",
						border: `1.5px solid ${c.border}`,
						background: `radial-gradient(circle, ${c.border}55, transparent)`,
						boxShadow: `0 0 10px ${c.border}55`,
					}}
				/>
			</div>
			<Lbl name={d.name} color={c.label} />
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  CENTRAL HUB NODE                                                          *
 * ═══════════════════════════════════════════════════════════════════════════ */

function HubCenterN(_: NodeProps) {
	return (
		<div style={{ width: 120, height: 120, position: "relative" }}>
			<H />
			{/* Animated pulse rings */}
			<div
				style={{
					position: "absolute",
					inset: -10,
					borderRadius: "50%",
					border: "1px solid rgba(140,180,240,0.16)",
					animation: "hubRing 4s ease-in-out infinite",
					pointerEvents: "none",
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: -22,
					borderRadius: "50%",
					border: "1px solid rgba(140,180,240,0.07)",
					animation: "hubRing 4s ease-in-out infinite 1.6s",
					pointerEvents: "none",
				}}
			/>
			{/* Main circle */}
			<div
				style={{
					width: 120,
					height: 120,
					borderRadius: "50%",
					border: "2px solid rgba(160,200,255,0.40)",
					background:
						"radial-gradient(circle at 42% 38%, rgba(160,200,255,0.13), rgba(4,8,16,0.78))",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 3,
					boxShadow: "0 0 50px rgba(120,160,220,0.20), inset 0 0 28px rgba(120,160,220,0.08)",
				}}
			>
				{/* Gear SVG icon */}
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.88 }}>
					<circle cx="12" cy="12" r="3.2" stroke="rgba(180,215,255,0.75)" strokeWidth="1.4" />
					<path
						d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
						stroke="rgba(160,200,255,0.55)"
						strokeWidth="1.3"
						strokeLinecap="round"
					/>
					<circle
						cx="12"
						cy="12"
						r="6.5"
						stroke="rgba(140,185,255,0.20)"
						strokeWidth="1"
						strokeDasharray="1.6 2.4"
					/>
				</svg>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 8,
						fontWeight: 700,
						color: "rgba(210,230,255,0.92)",
						letterSpacing: "0.18em",
						textTransform: "uppercase",
					}}
				>
					ROOT CORE
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 7,
						color: "rgba(140,175,215,0.46)",
						letterSpacing: "0.08em",
					}}
				>
					TIER 0
				</span>
			</div>
		</div>
	);
}

const nodeTypes = {
	circle: CircleN,
	hex: HexN,
	square: SquareN,
	capstone: CapstoneN,
	hubCenter: HubCenterN,
};

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  CUSTOM EDGES                                                              *
 * ═══════════════════════════════════════════════════════════════════════════ */

function SpokeEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
	return (
		<BaseEdge id={id} path={`M ${sourceX},${sourceY} L ${targetX},${targetY}`} style={style} />
	);
}

function ArcEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
	const mx = (sourceX + targetX) / 2;
	const my = (sourceY + targetY) / 2;
	const dist = Math.sqrt(mx * mx + my * my) || 1;
	const bulge = dist * 0.24;
	const cx = mx + (mx / dist) * bulge;
	const cy = my + (my / dist) * bulge;
	return (
		<BaseEdge
			id={id}
			path={`M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`}
			style={style}
		/>
	);
}

const edgeTypes = { spoke: SpokeEdge, arc: ArcEdge };

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  NODE POPOVER                                                              *
 * ═══════════════════════════════════════════════════════════════════════════ */

function Popover({
	node,
	x,
	y,
	accent,
	onClose,
}: {
	node: AugNode;
	x: number;
	y: number;
	accent: string;
	onClose: () => void;
}) {
	const c = statusC(node.status, accent);
	const locked = node.status === "locked";

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				zIndex: 60,
				width: 282,
				borderRadius: 10,
				border: `1px solid ${c.border}3a`,
				background: BASE.glass,
				backdropFilter: "blur(24px)",
				boxShadow: `0 16px 52px rgba(0,0,0,0.65), 0 0 20px ${c.border}0C`,
				animation: "popIn 0.18s cubic-bezier(0.21,1,0.34,1)",
				overflow: "hidden",
			}}
		>
			{/* Accent bar */}
			<div
				style={{
					height: 2,
					background: `linear-gradient(90deg, transparent, ${c.border}, transparent)`,
					opacity: 0.5,
				}}
			/>

			<div style={{ padding: "12px 14px 14px" }}>
				{/* Header */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						marginBottom: 8,
					}}
				>
					<div>
						<div
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 13,
								fontWeight: 700,
								color: locked ? BASE.t3 : BASE.t1,
							}}
						>
							{locked ? "Classified" : node.name}
						</div>
						<div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 8,
									color: c.border,
									letterSpacing: "0.12em",
									textTransform: "uppercase",
									fontWeight: 600,
								}}
							>
								{node.status === "completed"
									? "DONE"
									: node.status === "available"
										? "READY"
										: node.status === "researching"
											? "ACTIVE"
											: "LOCKED"}
							</span>
							<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: BASE.t3 }}>
								T{node.tier}
							</span>
							{node.maxLevel > 1 && (
								<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: BASE.t3 }}>
									Lv {node.level}/{node.maxLevel}
								</span>
							)}
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 8,
									color: accent,
									letterSpacing: "0.07em",
									textTransform: "uppercase",
								}}
							>
								{node.branchKey.replace(/_/g, " ")}
							</span>
						</div>
					</div>
					<button
						onClick={onClose}
						style={{
							width: 22,
							height: 22,
							borderRadius: 5,
							border: `1px solid ${BASE.stroke}`,
							background: "rgba(255,255,255,0.03)",
							color: BASE.t3,
							cursor: "pointer",
							fontSize: 11,
							flexShrink: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						✕
					</button>
				</div>

				{/* Description */}
				<p
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						lineHeight: 1.56,
						color: locked ? BASE.t3 : BASE.t2,
						margin: "0 0 10px",
						filter: locked ? "blur(2.5px)" : undefined,
						userSelect: locked ? "none" : undefined,
					}}
				>
					{node.description}
				</p>

				{/* Effects */}
				{!locked && (
					<div style={{ marginBottom: 10 }}>
						{node.effects.map((fx, i) => {
							const isUnlock = fx.startsWith("Unlock") || fx.startsWith("Enable");
							return (
								<div
									key={i}
									style={{
										padding: "3px 7px",
										marginBottom: 2,
										borderRadius: 3,
										borderLeft: `2px solid ${isUnlock ? BASE.completed : accent}55`,
										background: "rgba(255,255,255,0.02)",
									}}
								>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 9,
											color: isUnlock ? BASE.completed : BASE.t1,
										}}
									>
										{fx}
									</span>
								</div>
							);
						})}
					</div>
				)}

				{/* Costs */}
				{!locked && (
					<div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
						{Object.entries(node.costs.metaMatter).map(([r, amt]) => (
							<span
								key={r}
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 9,
									color: META_MATTER_COLORS[r as keyof typeof META_MATTER_COLORS],
									padding: "2px 6px",
									borderRadius: 3,
									background: "rgba(255,255,255,0.03)",
								}}
							>
								{(amt as number).toLocaleString()} {r}
							</span>
						))}
						{node.costs.resources &&
							Object.entries(node.costs.resources).map(([r, amt]) => (
								<span
									key={r}
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 9,
										color: BASE.t2,
										padding: "2px 6px",
										borderRadius: 3,
										background: "rgba(255,255,255,0.03)",
									}}
								>
									{fmt(amt as number)} {r}
								</span>
							))}
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: BASE.t3,
								padding: "2px 6px",
							}}
						>
							{formatDuration(node.costs.seconds)}
						</span>
					</div>
				)}

				{/* Facility requirement */}
				<div
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: BASE.t3,
						padding: "4px 7px",
						borderRadius: 3,
						background: "rgba(255,255,255,0.02)",
						border: `1px solid ${BASE.stroke}`,
					}}
				>
					Requires Research Sites {node.requiredFacilityLevel}
				</div>

				{/* Action button */}
				{node.status === "available" && (
					<button
						style={{
							marginTop: 10,
							width: "100%",
							padding: "8px 0",
							borderRadius: 6,
							border: `1px solid ${accent}55`,
							background: `linear-gradient(170deg, ${accent}33, ${accent}11)`,
							color: "#fff",
							fontFamily: "var(--nv-font-body)",
							fontSize: 11,
							fontWeight: 600,
							cursor: "pointer",
							letterSpacing: "0.06em",
							textTransform: "uppercase",
						}}
					>
						Begin Research
					</button>
				)}
			</div>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  SECTOR DIVIDER SVG OVERLAY                                                *
 * ═══════════════════════════════════════════════════════════════════════════ */

function SectorDividers() {
	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 4,
				overflow: "visible",
			}}
			viewBox="-1000 -1000 2000 2000"
			preserveAspectRatio="xMidYMid slice"
		>
			{/* Boundary lines */}
			{SECTOR_BOUNDARIES.map((deg) => {
				const rad = (deg * Math.PI) / 180;
				const x = Math.cos(rad) * 1900;
				const y = Math.sin(rad) * 1900;
				return (
					<line
						key={deg}
						x1="0"
						y1="0"
						x2={x}
						y2={y}
						stroke="rgba(100,145,210,0.10)"
						strokeWidth="1.5"
						strokeDasharray="5 9"
					/>
				);
			})}

			{/* Faint tier arc rings */}
			{[270, 450, 610, 760].map((r) => (
				<circle
					key={r}
					cx="0"
					cy="0"
					r={r}
					fill="none"
					stroke="rgba(100,145,210,0.055)"
					strokeWidth="1"
				/>
			))}

			{/* Hub dead-zone outline */}
			<circle
				cx="0"
				cy="0"
				r="75"
				fill="none"
				stroke="rgba(160,200,255,0.08)"
				strokeWidth="1"
				strokeDasharray="2 4"
			/>
		</svg>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  SECTION LABEL POSITIONS                                                   *
 * ═══════════════════════════════════════════════════════════════════════════ */

const LABEL_POS: Record<ResearchBranchKey, React.CSSProperties> = {
	applied_industry: { top: "5%", left: "5%" },
	military_systems: { top: "5%", right: "5%" },
	scientific_infrastructure: { bottom: "11%", right: "4%" },
	colony_specialization: { bottom: "3%", left: "50%", transform: "translateX(-50%)" },
	expansion_logistics: { bottom: "11%", left: "4%" },
};

function SectorLabels({ hoveredBranch }: { hoveredBranch: ResearchBranchKey | null }) {
	return (
		<>
			{RESEARCH_TABS.map((tab) => {
				const active = hoveredBranch === tab.key;
				return (
					<div
						key={tab.key}
						style={{
							position: "absolute",
							zIndex: 8,
							pointerEvents: "none",
							...LABEL_POS[tab.key],
							opacity: active ? 0.92 : 0.28,
							transition: "opacity 0.3s ease",
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 20,
								fontWeight: 800,
								letterSpacing: "0.24em",
								textTransform: "uppercase",
								color: tab.themeColor,
								textShadow: active
									? `0 0 28px ${tab.themeColor}60, 0 0 55px ${tab.themeColor}28`
									: "none",
								display: "block",
								transition: "text-shadow 0.3s ease",
							}}
						>
							{tab.shortLabel}
						</span>
					</div>
				);
			})}
		</>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  INNER APP — needs useReactFlow (must be inside ReactFlowProvider)         *
 * ═══════════════════════════════════════════════════════════════════════════ */

function InnerApp() {
	const { screenToFlowPosition } = useReactFlow();
	const containerRef = useRef<HTMLDivElement>(null);

	const [hoveredBranch, setHoveredBranch] = useState<ResearchBranchKey | null>(null);
	const [popover, setPopover] = useState<{ node: AugNode; x: number; y: number } | null>(null);

	const ditherColor = useDitherColor(hoveredBranch);

	// Look up hovered tab for overlays
	const hoveredTab = hoveredBranch
		? (RESEARCH_TABS.find((t) => t.key === hoveredBranch) ?? null)
		: null;

	/* ── Mouse move: sector detection ──────────────────────────────────────── */
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY });
			const distSq = fp.x * fp.x + fp.y * fp.y;
			if (distSq < HUB_DEAD_ZONE * HUB_DEAD_ZONE) {
				setHoveredBranch(null);
				return;
			}
			const angleDeg = Math.atan2(fp.y, fp.x) * (180 / Math.PI);
			setHoveredBranch(getSectorForAngle(angleDeg));
		},
		[screenToFlowPosition],
	);

	const handleMouseLeave = useCallback(() => setHoveredBranch(null), []);

	/* ── Node click: open popover ───────────────────────────────────────────── */
	const handleNodeClick = useCallback((event: React.MouseEvent, rfNode: Node) => {
		if (rfNode.id === "hub_center") return;
		const container = containerRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const d = rfNode.data as AugNode;

		let x = event.clientX - rect.left + 16;
		let y = event.clientY - rect.top - 64;
		if (x + 294 > rect.width) x = event.clientX - rect.left - 294;
		if (y < 8) y = 8;
		if (y + 360 > rect.height) y = rect.height - 368;

		setPopover({ node: d, x, y });
	}, []);

	/* ── Sector conic highlight ─────────────────────────────────────────────── */
	// CSS conic-gradient: 0° = top (12 o'clock), CW
	// Math angle: 0° = right, CW (in screen coords)
	// Convert: cssAngle = 90 - mathAngle
	const sectorHighlight = hoveredTab
		? (() => {
				const mathStart = SECTOR_CENTERS[hoveredTab.key] - 36;
				const cssFrom = 90 - mathStart;
				return (
					<div
						style={{
							position: "absolute",
							inset: 0,
							zIndex: 2,
							pointerEvents: "none",
							background: `conic-gradient(from ${cssFrom}deg at 50% 50%,
                ${hoveredTab.themeColor}07 0deg,
                ${hoveredTab.themeColor}04 66deg,
                transparent 72deg)`,
						}}
					/>
				);
			})()
		: null;

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: BASE.bg,
				fontFamily: "var(--nv-font-body)",
				color: BASE.t1,
			}}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			{/* ── Dither background ──────────────────────────────────────────────── */}
			<div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.24 }}>
				<IsolatedDither
					waveSpeed={0.02}
					waveFrequency={2.0}
					waveAmplitude={0.38}
					waveColor={ditherColor}
					colorNum={3}
					pixelSize={3}
					enableMouseInteraction={false}
				/>
			</div>

			{/* ── Vignette ────────────────────────────────────────────────────────── */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					pointerEvents: "none",
					background: "radial-gradient(ellipse at 50% 50%, transparent 16%, rgba(4,8,16,0.62) 76%)",
				}}
			/>

			{/* ── Sector conic highlight ───────────────────────────────────────────── */}
			{sectorHighlight}

			{/* ── React Flow canvas ────────────────────────────────────────────────── */}
			<div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
				<ReactFlow
					nodes={FLOW_NODES}
					edges={FLOW_EDGES}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					onNodeClick={handleNodeClick}
					onPaneClick={() => setPopover(null)}
					fitView
					fitViewOptions={{ padding: 0.13 }}
					minZoom={0.1}
					maxZoom={2.5}
					proOptions={{ hideAttribution: true }}
					panOnScroll
					zoomOnScroll
				>
					<Background color="rgba(80,120,185,0.025)" gap={90} size={1} />
				</ReactFlow>
			</div>

			{/* ── SVG sector dividers + tier rings ─────────────────────────────────── */}
			<div style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
				<SectorDividers />
			</div>

			{/* ── Section labels ───────────────────────────────────────────────────── */}
			<SectorLabels hoveredBranch={hoveredBranch} />

			{/* ══ HUD: top-left label ══════════════════════════════════════════════ */}
			<div
				style={{
					position: "absolute",
					top: 16,
					left: 16,
					zIndex: 10,
					display: "flex",
					alignItems: "baseline",
					gap: 8,
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 13,
						fontWeight: 800,
						color: hoveredTab?.themeColor ?? "rgba(200,220,255,0.68)",
						textShadow: hoveredTab ? `0 0 18px ${hoveredTab.themeColor}44` : "none",
						transition: "color 0.3s, text-shadow 0.3s",
					}}
				>
					RESEARCH
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: BASE.t3,
						letterSpacing: "0.12em",
						textTransform: "uppercase",
					}}
				>
					{hoveredTab ? hoveredTab.label : "Progression Grid · Aegis Prime"}
				</span>
			</div>

			{/* ══ HUD: top-right — meta-matter ════════════════════════════════════ */}
			<div
				style={{
					position: "absolute",
					top: 16,
					right: 16,
					zIndex: 10,
					display: "flex",
					gap: 10,
					padding: "8px 14px",
					borderRadius: 8,
					background: BASE.glass,
					border: `1px solid ${BASE.stroke}`,
					backdropFilter: "blur(14px)",
				}}
			>
				{(["common", "rare", "mythic"] as const).map((r) => (
					<div key={r} style={{ display: "flex", alignItems: "center", gap: 5 }}>
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: r === "mythic" ? 1.5 : "50%",
								background: META_MATTER_COLORS[r],
								boxShadow: `0 0 5px ${META_MATTER_COLORS[r]}55`,
								transform: r === "mythic" ? "rotate(45deg)" : undefined,
							}}
						/>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 11,
								color: META_MATTER_COLORS[r],
								fontWeight: 500,
							}}
						>
							{META_MATTER_BALANCES[r].toLocaleString()}
						</span>
					</div>
				))}
			</div>

			{/* ══ HUD: bottom-left — active research ══════════════════════════════ */}
			<div
				style={{
					position: "absolute",
					bottom: 16,
					left: 16,
					zIndex: 10,
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "8px 14px",
					borderRadius: 8,
					background: BASE.glass,
					border: `1px solid ${BASE.researching}22`,
					backdropFilter: "blur(14px)",
				}}
			>
				<div
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: BASE.researching,
						boxShadow: `0 0 8px ${BASE.researching}`,
						animation: "pulseGlow 2s ease-in-out infinite",
					}}
				/>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: BASE.researching,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}
				>
					Researching
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						fontWeight: 600,
						color: BASE.t1,
					}}
				>
					{ACTIVE_RESEARCH.nodeName}
				</span>
				<div
					style={{
						width: 82,
						height: 4,
						borderRadius: 2,
						background: "rgba(255,255,255,0.06)",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							width: `${ACTIVE_RESEARCH.pct}%`,
							height: "100%",
							borderRadius: 2,
							background: `linear-gradient(90deg, ${BASE.researching}66, ${BASE.researching})`,
						}}
					/>
				</div>
				<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 9, color: BASE.t3 }}>
					{ACTIVE_RESEARCH.remaining}
				</span>
			</div>

			{/* ══ HUD: bottom-right — colony info ══════════════════════════════════ */}
			<div
				style={{
					position: "absolute",
					bottom: 16,
					right: 16,
					zIndex: 10,
					padding: "6px 12px",
					borderRadius: 6,
					background: BASE.glass,
					border: `1px solid ${BASE.stroke}`,
					backdropFilter: "blur(10px)",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: BASE.t3,
						letterSpacing: "0.06em",
					}}
				>
					Aegis Prime — 2 Research Sites
				</span>
			</div>

			{/* ══ Node popover ═════════════════════════════════════════════════════ */}
			{popover && (
				<Popover
					node={popover.node}
					x={popover.x}
					y={popover.y}
					accent={
						RESEARCH_TABS.find((t) => t.key === popover.node.branchKey)?.themeColor ??
						BASE.available
					}
					onClose={() => setPopover(null)}
				/>
			)}

			{/* ── Keyframes ────────────────────────────────────────────────────────── */}
			<style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.94) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 1;   }
        }
        @keyframes hubRing {
          0%, 100% { opacity: 0.35; transform: scale(1);    }
          50%       { opacity: 0.80; transform: scale(1.04); }
        }
      `}</style>
		</div>
	);
}

/* ═══════════════════════════════════════════════════════════════════════════ *
 *  PAGE ROOT                                                                 *
 * ═══════════════════════════════════════════════════════════════════════════ */

function Research7() {
	return (
		<ReactFlowProvider>
			<InnerApp />
		</ReactFlowProvider>
	);
}
