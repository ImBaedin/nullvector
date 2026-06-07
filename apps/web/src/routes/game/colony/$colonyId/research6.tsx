/**
 * Research Mockup 6 — "Constellation"
 *
 * Five satellite branch-selector nodes orbit a central hub in a tight ring.
 * Clicking a satellite loads its tree radiating outward. The satellites
 * always remain visible. Active satellite glows, rest dim. Near-node
 * detail card. Arc edges for cross-links. Atmospheric star-field feel.
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
} from "@xyflow/react";
import { useState, useCallback, useMemo, useRef } from "react";

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

export const Route = createFileRoute("/game/colony/$colonyId/research6")({ component: Research6 });

/* ── Constants ────────────────────────────────────────────────────────────── */

const B = {
	bg: "#050810",
	glass: "rgba(8,12,24,0.82)",
	stroke: "rgba(100,160,220,0.10)",
	t1: "#edf5ff",
	t2: "#a4bed8",
	t3: "#5e7a94",
	completed: "#64f8bb",
	available: "#3dd9ff",
	researching: "#ffd166",
	locked: "rgba(94,122,148,0.18)",
};

/** Satellite positions — tight ring around center (radius 100, evenly spaced). */
const SAT_ANGLES = [-90, -18, 54, 126, 198]; // degrees, starting from top
function satPos(idx: number): { x: number; y: number } {
	const r = 100;
	const rad = (SAT_ANGLES[idx]! * Math.PI) / 180;
	return { x: Math.round(Math.cos(rad) * r), y: Math.round(Math.sin(rad) * r) };
}

function sc(s: NodeStatus) {
	switch (s) {
		case "completed":
			return { border: B.completed, fill: `${B.completed}14`, glow: `${B.completed}33` };
		case "available":
			return { border: B.available, fill: `${B.available}0C`, glow: "none" };
		case "researching":
			return { border: B.researching, fill: `${B.researching}10`, glow: `${B.researching}33` };
		default:
			return { border: B.locked, fill: "rgba(20,30,45,0.35)", glow: "none" };
	}
}

/* ── Handles ──────────────────────────────────────────────────────────────── */

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

/* ── Node label ───────────────────────────────────────────────────────────── */

function Lbl({ name, status }: { name: string; status: NodeStatus }) {
	return (
		<div
			style={{
				position: "absolute",
				top: "100%",
				left: "50%",
				transform: "translateX(-50%)",
				marginTop: 5,
				width: 100,
				textAlign: "center",
				pointerEvents: "none",
			}}
		>
			<span
				style={{
					fontFamily: "var(--nv-font-body)",
					fontSize: 9,
					fontWeight: 600,
					color: status === "locked" ? B.t3 : B.t2,
					lineHeight: 1.25,
					display: "block",
				}}
			>
				{name}
			</span>
		</div>
	);
}

/* ── Tree node types ──────────────────────────────────────────────────────── */

function CircleN({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = sc(d.status);
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: "50%",
					border: `2px solid ${c.border}`,
					background: `radial-gradient(circle at 38% 34%, ${c.fill}, rgba(5,8,16,0.5))`,
					opacity: d.status === "locked" ? 0.4 : 1,
					cursor: "pointer",
					boxShadow: c.glow !== "none" ? `0 0 20px ${c.glow}` : "none",
					display: "flex",
					flexDirection: "column",
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
									background: i < d.level ? c.border : `${c.border}30`,
									boxShadow: i < d.level ? `0 0 4px ${c.border}` : "none",
								}}
							/>
						))}
					</div>
				)}
			</div>
			<Lbl name={d.name} status={d.status} />
		</div>
	);
}

function HexN({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = sc(d.status);
	const clip = "polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)";
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					clipPath: clip,
					background: `linear-gradient(150deg, ${c.fill}, rgba(5,8,16,0.5))`,
					opacity: d.status === "locked" ? 0.4 : 1,
					cursor: "pointer",
					position: "relative",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 2,
						clipPath: clip,
						border: `2px solid ${c.border}`,
						background: c.fill,
						boxShadow: c.glow !== "none" ? `inset 0 0 14px ${c.glow}` : "none",
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
							border: `1px solid ${c.border}55`,
							background: `${c.border}22`,
							transform: "rotate(45deg)",
						}}
					/>
				</div>
			</div>
			<Lbl name={d.name} status={d.status} />
		</div>
	);
}

function SquareN({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = sc(d.status);
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: 6,
					border: `2px solid ${c.border}`,
					background: `linear-gradient(145deg, ${c.fill}, rgba(5,8,16,0.5))`,
					opacity: d.status === "locked" ? 0.4 : 1,
					cursor: "pointer",
					boxShadow: c.glow !== "none" ? `0 0 16px ${c.glow}` : "none",
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
			<Lbl name={d.name} status={d.status} />
		</div>
	);
}

function CapstoneN({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = sc(d.status);
	return (
		<div style={{ width: 88, height: 88, position: "relative" }}>
			<H />
			<div
				style={{
					width: 88,
					height: 88,
					borderRadius: 14,
					border: `2.5px solid ${c.border}`,
					background: `radial-gradient(circle at 40% 35%, ${c.fill}, rgba(5,8,16,0.4) 70%)`,
					opacity: d.status === "locked" ? 0.3 : 1,
					cursor: "pointer",
					boxShadow: `0 0 36px ${c.glow}`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: 14,
						height: 14,
						borderRadius: "50%",
						border: `1.5px solid ${c.border}`,
						background: `radial-gradient(circle, ${c.border}55, transparent)`,
						boxShadow: `0 0 10px ${c.border}55`,
					}}
				/>
			</div>
			<Lbl name={d.name} status={d.status} />
		</div>
	);
}

/* ── Central hub node ─────────────────────────────────────────────────────── */

function HubCenterNode(_: NodeProps) {
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<H />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: "50%",
					border: "2px solid rgba(120,160,200,0.20)",
					background:
						"radial-gradient(circle at 40% 36%, rgba(120,160,200,0.06), rgba(5,8,16,0.4))",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 7,
						fontWeight: 700,
						color: B.t3,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					HUB
				</span>
			</div>
		</div>
	);
}

/* ── Satellite selector node ──────────────────────────────────────────────── */

function SatelliteNode({ data }: NodeProps) {
	const d = data as unknown as {
		branchKey: ResearchBranchKey;
		color: string;
		label: string;
		active: boolean;
		onClick: () => void;
	};
	return (
		<div style={{ width: 48, height: 48, position: "relative" }}>
			<H />
			{/* Glow ring when active */}
			{d.active && (
				<div
					style={{
						position: "absolute",
						inset: -6,
						borderRadius: "50%",
						background: `radial-gradient(circle, ${d.color}20, transparent 70%)`,
						animation: "satGlow 3s ease-in-out infinite",
					}}
				/>
			)}
			<div
				onClick={d.onClick}
				style={{
					width: 48,
					height: 48,
					borderRadius: "50%",
					border: `2px solid ${d.active ? d.color : `${d.color}44`}`,
					background: d.active
						? `radial-gradient(circle at 40% 36%, ${d.color}22, rgba(5,8,16,0.5))`
						: "rgba(20,30,45,0.3)",
					cursor: "pointer",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: d.active ? `0 0 20px ${d.color}33` : "none",
					transition: "all 0.35s cubic-bezier(0.21,1,0.34,1)",
				}}
			>
				<div
					style={{
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: d.active ? d.color : `${d.color}66`,
						boxShadow: d.active ? `0 0 6px ${d.color}` : "none",
						transition: "all 0.3s",
					}}
				/>
			</div>
			<div
				style={{
					position: "absolute",
					top: "100%",
					left: "50%",
					transform: "translateX(-50%)",
					marginTop: 4,
					width: 72,
					textAlign: "center",
					pointerEvents: "none",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 7,
						fontWeight: 600,
						color: d.active ? d.color : B.t3,
						letterSpacing: "0.10em",
						textTransform: "uppercase",
						transition: "color 0.3s",
					}}
				>
					{d.label}
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
	hubCenter: HubCenterNode,
	satellite: SatelliteNode,
};

/* ── Custom edges ─────────────────────────────────────────────────────────── */

function SpokeEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
	return (
		<BaseEdge id={id} path={`M ${sourceX},${sourceY} L ${targetX},${targetY}`} style={style} />
	);
}

function ArcEdge({ id, sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
	const mx = (sourceX + targetX) / 2;
	const my = (sourceY + targetY) / 2;
	const dist = Math.sqrt(mx * mx + my * my) || 1;
	const bulge = dist * 0.28;
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

/* ── Build flow data ──────────────────────────────────────────────────────── */

function buildFlowData(
	activeBranch: ResearchBranchKey,
	satelliteCallbacks: Record<ResearchBranchKey, () => void>,
) {
	const tree = getRadialTree(activeBranch);
	const tab = RESEARCH_TABS.find((t) => t.key === activeBranch)!;
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	// Central hub (smaller than mockup 5 to make room for satellites)
	nodes.push({
		id: "hubCenter",
		type: "hubCenter",
		position: { x: -30, y: -30 },
		data: {},
		draggable: false,
	});

	// Satellite nodes
	RESEARCH_TABS.forEach((t, i) => {
		const pos = satPos(i);
		nodes.push({
			id: `sat_${t.key}`,
			type: "satellite",
			position: { x: pos.x - 24, y: pos.y - 24 },
			data: {
				branchKey: t.key,
				color: t.themeColor,
				label: t.shortLabel,
				active: t.key === activeBranch,
				onClick: satelliteCallbacks[t.key],
			},
			draggable: false,
		});
		// Edge from hub center to satellite
		const { sourceHandle, targetHandle } = bestHandles({ x: 0, y: 0 }, pos);
		edges.push({
			id: `hub-sat-${t.key}`,
			source: "hubCenter",
			target: `sat_${t.key}`,
			sourceHandle,
			targetHandle,
			type: "spoke",
			style: {
				stroke: t.key === activeBranch ? `${t.themeColor}44` : "rgba(120,160,200,0.06)",
				strokeWidth: 1,
			},
		});
	});

	// Active satellite ID
	const satId = `sat_${activeBranch}`;
	const satIndex = RESEARCH_TABS.findIndex((t) => t.key === activeBranch);
	const satCenter = satPos(satIndex);

	// Positions map — satellite is the effective "hub" for tree edges
	const posMap = new Map<string, { x: number; y: number }>();
	posMap.set("hub", satCenter);
	for (const n of tree.nodes) posMap.set(n.id, n.position);

	// Tree nodes
	for (const n of tree.nodes) {
		const s = NODE_SIZE[n.shape as keyof typeof NODE_SIZE] ?? 60;
		nodes.push({
			id: n.id,
			type: n.shape,
			position: { x: n.position.x - s / 2, y: n.position.y - s / 2 },
			data: n as any,
			draggable: false,
		});
	}

	// Tree edges
	for (const ed of tree.edges) {
		const sp = ed.source === "hub" ? satCenter : (posMap.get(ed.source) ?? { x: 0, y: 0 });
		const tp = posMap.get(ed.target) ?? { x: 0, y: 0 };
		const { sourceHandle, targetHandle } = bestHandles(sp, tp);

		const srcNode = tree.nodes.find((n) => n.id === ed.source);
		const tgtNode = tree.nodes.find((n) => n.id === ed.target);
		const srcDone = srcNode?.status === "completed" || ed.source === "hub";
		const tgtLocked = tgtNode?.status === "locked";
		const tgtResearching = tgtNode?.status === "researching";

		edges.push({
			id: `${ed.source}-${ed.target}`,
			source: ed.source === "hub" ? satId : ed.source,
			target: ed.target,
			sourceHandle,
			targetHandle,
			type: ed.arc ? "arc" : "spoke",
			animated: tgtResearching,
			style: {
				stroke:
					srcDone && !tgtLocked
						? `${tab.themeColor}77`
						: tgtResearching
							? `${B.researching}55`
							: `${B.t3}18`,
				strokeWidth: srcDone && !tgtLocked ? 2 : 1,
				strokeDasharray: tgtLocked ? "4 6" : undefined,
			},
		});
	}

	return { nodes, edges };
}

/* ── Near-node popover ────────────────────────────────────────────────────── */

function Popover({
	node,
	x,
	y,
	accent,
	onClose,
}: {
	node: RadialNode;
	x: number;
	y: number;
	accent: string;
	onClose: () => void;
}) {
	const c = sc(node.status);
	const locked = node.status === "locked";
	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				zIndex: 50,
				width: 274,
				borderRadius: 10,
				border: `1px solid ${c.border}44`,
				background: B.glass,
				backdropFilter: "blur(20px)",
				boxShadow: `0 14px 44px rgba(0,0,0,0.6), 0 0 20px ${c.border}0C`,
				animation: "popIn 0.2s cubic-bezier(0.21,1,0.34,1)",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					height: 2,
					background: `linear-gradient(90deg, transparent, ${c.border}, transparent)`,
					opacity: 0.4,
				}}
			/>
			<div style={{ padding: "12px 14px 14px" }}>
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
								color: locked ? B.t3 : B.t1,
							}}
						>
							{locked ? "Classified" : node.name}
						</div>
						<div style={{ display: "flex", gap: 6, marginTop: 3 }}>
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
							<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: B.t3 }}>
								T{node.tier}
							</span>
							{node.maxLevel > 1 && (
								<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: B.t3 }}>
									Lv {node.level}/{node.maxLevel}
								</span>
							)}
						</div>
					</div>
					<button
						onClick={onClose}
						style={{
							width: 22,
							height: 22,
							borderRadius: 5,
							border: `1px solid ${B.stroke}`,
							background: "rgba(255,255,255,0.03)",
							color: B.t3,
							cursor: "pointer",
							fontSize: 11,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						✕
					</button>
				</div>
				<p
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						lineHeight: 1.55,
						color: locked ? B.t3 : B.t2,
						margin: "0 0 10px",
						filter: locked ? "blur(2.5px)" : undefined,
						userSelect: locked ? "none" : undefined,
					}}
				>
					{node.description}
				</p>
				{!locked && (
					<div style={{ marginBottom: 10 }}>
						{node.effects.map((fx, i) => (
							<div
								key={i}
								style={{
									padding: "3px 7px",
									marginBottom: 2,
									borderRadius: 3,
									borderLeft: `2px solid ${fx.startsWith("Unlock") || fx.startsWith("Enable") ? B.completed : accent}55`,
									background: "rgba(255,255,255,0.02)",
								}}
							>
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 9,
										color: fx.startsWith("Unlock") || fx.startsWith("Enable") ? B.completed : B.t1,
									}}
								>
									{fx}
								</span>
							</div>
						))}
					</div>
				)}
				{!locked && (
					<div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
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
										color: B.t2,
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
								color: B.t3,
								padding: "2px 6px",
							}}
						>
							{formatDuration(node.costs.seconds)}
						</span>
					</div>
				)}
				<div
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: B.t3,
						padding: "4px 7px",
						borderRadius: 3,
						background: "rgba(255,255,255,0.02)",
						border: `1px solid ${B.stroke}`,
					}}
				>
					Requires Research Sites {node.requiredFacilityLevel}
				</div>
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

/* ── Main tree canvas ─────────────────────────────────────────────────────── */

function TreeCanvas({
	branch,
	onBranchChange,
	onNodeSelect,
}: {
	branch: ResearchBranchKey;
	onBranchChange: (b: ResearchBranchKey) => void;
	onNodeSelect: (node: RadialNode | null, x: number, y: number) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	const callbacks = useMemo(() => {
		const map: Record<string, () => void> = {};
		for (const t of RESEARCH_TABS) map[t.key] = () => onBranchChange(t.key);
		return map as Record<ResearchBranchKey, () => void>;
	}, [onBranchChange]);

	const { nodes, edges } = useMemo(() => buildFlowData(branch, callbacks), [branch, callbacks]);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, rfNode: Node) => {
			if (rfNode.id === "hubCenter" || rfNode.id.startsWith("sat_")) return;
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const tree = getRadialTree(branch);
			const dataNode = tree.nodes.find((n) => n.id === rfNode.id);
			if (!dataNode) return;
			let x = event.clientX - rect.left + 16;
			let y = event.clientY - rect.top - 60;
			if (x + 290 > rect.width) x = event.clientX - rect.left - 290;
			if (y < 8) y = 8;
			if (y + 300 > rect.height) y = rect.height - 308;
			onNodeSelect(dataNode, x, y);
		},
		[branch, onNodeSelect],
	);

	return (
		<div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				onNodeClick={handleNodeClick}
				onPaneClick={() => onNodeSelect(null, 0, 0)}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				minZoom={0.2}
				maxZoom={2}
				proOptions={{ hideAttribution: true }}
				panOnScroll
				zoomOnScroll
			>
				<Background color="rgba(100,160,220,0.03)" gap={80} size={1} />
			</ReactFlow>
		</div>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research6() {
	const [branch, setBranch] = useState<ResearchBranchKey>("military_systems");
	const [popover, setPopover] = useState<{ node: RadialNode; x: number; y: number } | null>(null);

	const tab = RESEARCH_TABS.find((t) => t.key === branch)!;

	const handleBranch = useCallback((b: ResearchBranchKey) => {
		setBranch(b);
		setPopover(null);
	}, []);

	const handleNode = useCallback((node: RadialNode | null, x: number, y: number) => {
		if (!node) {
			setPopover(null);
			return;
		}
		setPopover({ node, x, y });
	}, []);

	return (
		<div
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: B.bg,
				fontFamily: "var(--nv-font-body)",
				color: B.t1,
			}}
		>
			{/* Dither */}
			<div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.14 }}>
				<IsolatedDither
					waveSpeed={0.025}
					waveFrequency={2.2}
					waveAmplitude={0.35}
					waveColor={tab.ditherWaveColor}
					colorNum={4}
					pixelSize={tab.ditherPixelSize}
					enableMouseInteraction={false}
				/>
			</div>

			{/* Vignette */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					pointerEvents: "none",
					background: "radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(5,8,16,0.65) 80%)",
				}}
			/>

			{/* Tree */}
			<div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
				<ReactFlowProvider>
					<TreeCanvas branch={branch} onBranchChange={handleBranch} onNodeSelect={handleNode} />
				</ReactFlowProvider>

				{/* Popover */}
				{popover && (
					<Popover
						node={popover.node}
						x={popover.x}
						y={popover.y}
						accent={tab.themeColor}
						onClose={() => setPopover(null)}
					/>
				)}

				{/* Top-left label */}
				<div
					style={{
						position: "absolute",
						top: 14,
						left: 14,
						zIndex: 10,
						display: "flex",
						alignItems: "baseline",
						gap: 8,
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-display)",
							fontSize: 14,
							fontWeight: 800,
							color: tab.themeColor,
							textShadow: `0 0 16px ${tab.themeColor}33`,
						}}
					>
						RESEARCH
					</span>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: B.t3,
							letterSpacing: "0.08em",
						}}
					>
						{tab.label}
					</span>
				</div>

				{/* Top-right meta-matter */}
				<div
					style={{
						position: "absolute",
						top: 14,
						right: 14,
						zIndex: 10,
						display: "flex",
						gap: 10,
						padding: "8px 14px",
						borderRadius: 8,
						background: B.glass,
						border: `1px solid ${B.stroke}`,
						backdropFilter: "blur(12px)",
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

				{/* Bottom-left active research */}
				<div
					style={{
						position: "absolute",
						bottom: 14,
						left: 14,
						zIndex: 10,
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "8px 14px",
						borderRadius: 8,
						background: B.glass,
						border: `1px solid ${B.researching}22`,
						backdropFilter: "blur(12px)",
					}}
				>
					<div
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: B.researching,
							boxShadow: `0 0 8px ${B.researching}`,
							animation: "pulse 2s ease-in-out infinite",
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: B.researching,
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
							color: B.t1,
						}}
					>
						{ACTIVE_RESEARCH.nodeName}
					</span>
					<div
						style={{
							width: 80,
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
								background: `linear-gradient(90deg, ${B.researching}66, ${B.researching})`,
							}}
						/>
					</div>
					<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 9, color: B.t3 }}>
						{ACTIVE_RESEARCH.remaining}
					</span>
				</div>

				{/* Bottom-right colony info */}
				<div
					style={{
						position: "absolute",
						bottom: 14,
						right: 14,
						zIndex: 10,
						padding: "6px 12px",
						borderRadius: 6,
						background: B.glass,
						border: `1px solid ${B.stroke}`,
						backdropFilter: "blur(10px)",
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: B.t3,
							letterSpacing: "0.06em",
						}}
					>
						Aegis Prime — 2 Research Sites
					</span>
				</div>
			</div>

			<style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes satGlow { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
      `}</style>
		</div>
	);
}
