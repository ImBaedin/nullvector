/**
 * Research Mockup 5 — "Nexus"
 *
 * Central dropdown hub node swaps between branch trees. Full-viewport
 * immersive tree with radial spoke layout. Arc edges between same-tier
 * cross-links. Near-node detail popover. Thin floating overlays for
 * meta-matter and active research.
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

export const Route = createFileRoute("/game/colony/$colonyId/research5")({ component: Research5 });

/* ── Palette ──────────────────────────────────────────────────────────────── */

function palette(branch: ResearchBranchKey) {
	const tab = RESEARCH_TABS.find((t) => t.key === branch)!;
	return {
		accent: tab.themeColor,
		accentSoft: tab.themeColorSoft,
		dither: tab.ditherWaveColor,
		ditherPx: tab.ditherPixelSize,
		label: tab.label,
		shortLabel: tab.shortLabel,
	};
}

const BASE = {
	bg: "#050910",
	glass: "rgba(8,14,26,0.80)",
	stroke: "rgba(120,160,200,0.12)",
	text1: "#edf5ff",
	text2: "#a8bdd4",
	text3: "#6a7f96",
	completed: "#64f8bb",
	available: "#3dd9ff",
	researching: "#ffd166",
	locked: "rgba(106,127,150,0.22)",
};

function statusColor(s: NodeStatus, accent: string) {
	switch (s) {
		case "completed":
			return { border: BASE.completed, fill: `${BASE.completed}14`, glow: `${BASE.completed}33` };
		case "available":
			return { border: BASE.available, fill: `${BASE.available}0C`, glow: "none" };
		case "researching":
			return {
				border: BASE.researching,
				fill: `${BASE.researching}10`,
				glow: `${BASE.researching}33`,
			};
		default:
			return { border: BASE.locked, fill: "rgba(20,30,45,0.4)", glow: "none" };
	}
}

/* ── Invisible handles ────────────────────────────────────────────────────── */

const HS = {
	background: "transparent",
	border: "none",
	width: 1,
	height: 1,
	minWidth: 1,
	minHeight: 1,
} as const;

function Handles() {
	return (
		<>
			<Handle type="target" position={Position.Top} id="top" style={HS} />
			<Handle type="target" position={Position.Right} id="right" style={HS} />
			<Handle type="target" position={Position.Bottom} id="bottom" style={HS} />
			<Handle type="target" position={Position.Left} id="left" style={HS} />
			<Handle type="source" position={Position.Top} id="top" style={HS} />
			<Handle type="source" position={Position.Right} id="right" style={HS} />
			<Handle type="source" position={Position.Bottom} id="bottom" style={HS} />
			<Handle type="source" position={Position.Left} id="left" style={HS} />
		</>
	);
}

/* ── Custom nodes ─────────────────────────────────────────────────────────── */

function NodeLabel({ name, color, status }: { name: string; color: string; status: NodeStatus }) {
	return (
		<div
			style={{
				position: "absolute",
				top: "100%",
				left: "50%",
				transform: "translateX(-50%)",
				marginTop: 5,
				width: 96,
				textAlign: "center",
				pointerEvents: "none",
			}}
		>
			<span
				style={{
					fontFamily: "var(--nv-font-body)",
					fontSize: 9,
					fontWeight: 600,
					color: status === "locked" ? BASE.text3 : BASE.text2,
					lineHeight: 1.25,
					display: "block",
				}}
			>
				{name}
			</span>
		</div>
	);
}

function CircleNode({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = statusColor(d.status, "");
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<Handles />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: "50%",
					border: `2px solid ${c.border}`,
					background: `radial-gradient(circle at 38% 34%, ${c.fill}, rgba(5,9,16,0.5))`,
					opacity: d.status === "locked" ? 0.45 : 1,
					cursor: "pointer",
					boxShadow: c.glow !== "none" ? `0 0 20px ${c.glow}` : "none",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					transition: "box-shadow 0.3s",
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
									background: i < d.level ? c.border : `${c.border}33`,
									boxShadow: i < d.level ? `0 0 4px ${c.border}` : "none",
								}}
							/>
						))}
					</div>
				)}
			</div>
			<NodeLabel name={d.name} color={c.border} status={d.status} />
		</div>
	);
}

function HexNode({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = statusColor(d.status, "");
	const clip = "polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)";
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<Handles />
			<div
				style={{
					width: 60,
					height: 60,
					clipPath: clip,
					background: `linear-gradient(150deg, ${c.fill}, rgba(5,9,16,0.5))`,
					opacity: d.status === "locked" ? 0.45 : 1,
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
			<NodeLabel name={d.name} color={c.border} status={d.status} />
		</div>
	);
}

function SquareNode({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = statusColor(d.status, "");
	return (
		<div style={{ width: 60, height: 60, position: "relative" }}>
			<Handles />
			<div
				style={{
					width: 60,
					height: 60,
					borderRadius: 6,
					border: `2px solid ${c.border}`,
					background: `linear-gradient(145deg, ${c.fill}, rgba(5,9,16,0.5))`,
					opacity: d.status === "locked" ? 0.45 : 1,
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
			<NodeLabel name={d.name} color={c.border} status={d.status} />
		</div>
	);
}

function CapstoneNode({ data }: NodeProps) {
	const d = data as unknown as RadialNode;
	const c = statusColor(d.status, "");
	return (
		<div style={{ width: 88, height: 88, position: "relative" }}>
			<Handles />
			<div
				style={{
					width: 88,
					height: 88,
					borderRadius: 14,
					border: `2.5px solid ${c.border}`,
					background: `radial-gradient(circle at 40% 35%, ${c.fill}, rgba(5,9,16,0.4) 70%)`,
					opacity: d.status === "locked" ? 0.35 : 1,
					cursor: "pointer",
					boxShadow: `0 0 36px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: 12,
						height: 12,
						borderRadius: "50%",
						border: `1.5px solid ${c.border}`,
						background: `radial-gradient(circle, ${c.border}55, transparent)`,
						boxShadow: `0 0 10px ${c.border}55`,
					}}
				/>
			</div>
			<NodeLabel name={d.name} color={c.border} status={d.status} />
		</div>
	);
}

/* ── Hub node with dropdown ───────────────────────────────────────────────── */

function HubNode({ data }: NodeProps) {
	const d = data as unknown as {
		accent: string;
		label: string;
		onSwitch: () => void;
		menuOpen: boolean;
		branches: typeof RESEARCH_TABS;
	};
	return (
		<div style={{ width: 110, height: 110, position: "relative" }}>
			<Handles />
			{/* Outer glow ring */}
			<div
				style={{
					position: "absolute",
					inset: -8,
					borderRadius: "50%",
					border: `1px solid ${d.accent}22`,
					background: `radial-gradient(circle, ${d.accent}08, transparent 70%)`,
				}}
			/>
			<div
				onClick={d.onSwitch}
				style={{
					width: 110,
					height: 110,
					borderRadius: "50%",
					border: `2.5px solid ${d.accent}66`,
					background: `radial-gradient(circle at 40% 36%, ${d.accent}18, rgba(5,9,16,0.6) 70%)`,
					cursor: "pointer",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: `0 0 40px ${d.accent}15`,
					transition: "border-color 0.3s, box-shadow 0.3s",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 8,
						fontWeight: 700,
						color: d.accent,
						letterSpacing: "0.16em",
						textTransform: "uppercase",
						opacity: 0.7,
						marginBottom: 2,
					}}
				>
					Research
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 11,
						fontWeight: 700,
						color: BASE.text1,
						letterSpacing: "0.04em",
					}}
				>
					{d.label}
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 7,
						color: BASE.text3,
						marginTop: 2,
						letterSpacing: "0.1em",
						textTransform: "uppercase",
					}}
				>
					▾ switch
				</span>
			</div>
		</div>
	);
}

const nodeTypes = {
	circle: CircleNode,
	hex: HexNode,
	square: SquareNode,
	capstone: CapstoneNode,
	hub: HubNode,
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
	const dx = mx,
		dy = my; // from center (0,0) approx
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	const bulge = dist * 0.28;
	const cx = mx + (dx / dist) * bulge;
	const cy = my + (dy / dist) * bulge;
	return (
		<BaseEdge
			id={id}
			path={`M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`}
			style={style}
		/>
	);
}

const edgeTypes = { spoke: SpokeEdge, arc: ArcEdge };

/* ── Build React Flow data ────────────────────────────────────────────────── */

function buildFlowData(branch: ResearchBranchKey, hubData: any) {
	const tree = getRadialTree(branch);
	const tab = RESEARCH_TABS.find((t) => t.key === branch)!;

	// Hub node at center
	const hubSize = NODE_SIZE.hub;
	const nodes: Node[] = [
		{
			id: "hub",
			type: "hub",
			position: { x: -hubSize / 2, y: -hubSize / 2 },
			data: hubData,
			draggable: false,
		},
	];

	// Tree nodes — offset so position is visual center
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

	// Edges
	const hubPos = { x: 0, y: 0 };
	const posMap = new Map<string, { x: number; y: number }>();
	posMap.set("hub", hubPos);
	for (const n of tree.nodes) posMap.set(n.id, n.position);

	const edges: Edge[] = tree.edges.map((ed) => {
		const sp = posMap.get(ed.source) ?? hubPos;
		const tp = posMap.get(ed.target) ?? hubPos;
		const { sourceHandle, targetHandle } = bestHandles(sp, tp);

		const srcNode = tree.nodes.find((n) => n.id === ed.source);
		const tgtNode = tree.nodes.find((n) => n.id === ed.target);
		const srcDone = srcNode?.status === "completed" || ed.source === "hub";
		const tgtLocked = tgtNode?.status === "locked";
		const tgtResearching = tgtNode?.status === "researching";

		return {
			id: `${ed.source}-${ed.target}`,
			source: ed.source,
			target: ed.target,
			sourceHandle,
			targetHandle,
			type: ed.arc ? "arc" : "spoke",
			animated: tgtResearching,
			style: {
				stroke:
					srcDone && !tgtLocked
						? `${tab.themeColor}88`
						: tgtResearching
							? `${BASE.researching}66`
							: `${BASE.text3}22`,
				strokeWidth: srcDone && !tgtLocked ? 2 : 1.2,
				strokeDasharray: tgtLocked ? "4 6" : undefined,
			},
		};
	});

	return { nodes, edges };
}

/* ── Near-node detail popover ─────────────────────────────────────────────── */

function NodePopover({
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
	const c = statusColor(node.status, accent);
	const locked = node.status === "locked";

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				zIndex: 50,
				width: 280,
				borderRadius: 10,
				border: `1px solid ${c.border}44`,
				background: BASE.glass,
				backdropFilter: "blur(20px)",
				boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 24px ${c.border}11`,
				animation: "popIn 0.2s cubic-bezier(0.21,1,0.34,1)",
				overflow: "hidden",
			}}
		>
			{/* Accent top bar */}
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
								color: BASE.text1,
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
							<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: BASE.text3 }}>
								T{node.tier}
							</span>
							{node.maxLevel > 1 && (
								<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 8, color: BASE.text3 }}>
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
							border: `1px solid ${BASE.stroke}`,
							background: "rgba(255,255,255,0.03)",
							color: BASE.text3,
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

				{/* Description */}
				<p
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						lineHeight: 1.55,
						color: locked ? BASE.text3 : BASE.text2,
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
						{node.effects.map((fx, i) => (
							<div
								key={i}
								style={{
									padding: "3px 7px",
									marginBottom: 2,
									borderRadius: 3,
									borderLeft: `2px solid ${fx.startsWith("Unlock") || fx.startsWith("Enable") ? BASE.completed : accent}55`,
									background: "rgba(255,255,255,0.02)",
								}}
							>
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 9,
										color:
											fx.startsWith("Unlock") || fx.startsWith("Enable")
												? BASE.completed
												: BASE.text1,
									}}
								>
									{fx}
								</span>
							</div>
						))}
					</div>
				)}

				{/* Costs */}
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
										color: BASE.text2,
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
								color: BASE.text3,
								padding: "2px 6px",
							}}
						>
							{formatDuration(node.costs.seconds)}
						</span>
					</div>
				)}

				{/* Requirement */}
				<div
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: BASE.text3,
						padding: "4px 7px",
						borderRadius: 3,
						background: "rgba(255,255,255,0.02)",
						border: `1px solid ${BASE.stroke}`,
					}}
				>
					Requires Research Sites {node.requiredFacilityLevel}
				</div>

				{/* Action */}
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

/* ── Branch selector dropdown ─────────────────────────────────────────────── */

function BranchMenu({
	activeBranch,
	onSelect,
	position,
}: {
	activeBranch: ResearchBranchKey;
	onSelect: (b: ResearchBranchKey) => void;
	position: { x: number; y: number };
}) {
	return (
		<div
			style={{
				position: "absolute",
				left: position.x,
				top: position.y,
				zIndex: 60,
				width: 200,
				borderRadius: 10,
				border: `1px solid ${BASE.stroke}`,
				background: BASE.glass,
				backdropFilter: "blur(20px)",
				boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
				padding: 6,
				animation: "popIn 0.15s cubic-bezier(0.21,1,0.34,1)",
			}}
		>
			{RESEARCH_TABS.map((tab) => (
				<button
					key={tab.key}
					onClick={() => onSelect(tab.key)}
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						width: "100%",
						padding: "8px 10px",
						borderRadius: 6,
						border: "none",
						cursor: "pointer",
						background: tab.key === activeBranch ? `${tab.themeColor}14` : "transparent",
						transition: "background 0.15s",
					}}
					onMouseEnter={(ev) => {
						ev.currentTarget.style.background = `${tab.themeColor}14`;
					}}
					onMouseLeave={(ev) => {
						if (tab.key !== activeBranch) ev.currentTarget.style.background = "transparent";
					}}
				>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: tab.themeColor,
							boxShadow: tab.key === activeBranch ? `0 0 8px ${tab.themeColor}` : "none",
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-body)",
							fontSize: 11,
							color: tab.key === activeBranch ? tab.themeColor : BASE.text2,
							fontWeight: tab.key === activeBranch ? 600 : 400,
						}}
					>
						{tab.label}
					</span>
				</button>
			))}
		</div>
	);
}

/* ── Tree canvas ──────────────────────────────────────────────────────────── */

function TreeCanvas({
	branch,
	onNodeSelect,
	onHubClick,
	menuOpen,
}: {
	branch: ResearchBranchKey;
	onNodeSelect: (node: RadialNode, x: number, y: number) => void;
	onHubClick: () => void;
	menuOpen: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const pal = palette(branch);

	const hubData = useMemo(
		() => ({
			accent: pal.accent,
			label: pal.shortLabel,
			onSwitch: onHubClick,
			menuOpen,
			branches: RESEARCH_TABS,
		}),
		[pal, onHubClick, menuOpen],
	);

	const { nodes, edges } = useMemo(() => buildFlowData(branch, hubData), [branch, hubData]);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, rfNode: Node) => {
			if (rfNode.id === "hub") return;
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			const tree = getRadialTree(branch);
			const dataNode = tree.nodes.find((n) => n.id === rfNode.id);
			if (!dataNode) return;

			let x = event.clientX - rect.left + 16;
			let y = event.clientY - rect.top - 60;
			if (x + 296 > rect.width) x = event.clientX - rect.left - 296;
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
				onPaneClick={() => onNodeSelect(null as any, 0, 0)}
				fitView
				fitViewOptions={{ padding: 0.25 }}
				minZoom={0.2}
				maxZoom={2}
				proOptions={{ hideAttribution: true }}
				panOnScroll
				zoomOnScroll
			>
				<Background color={`${pal.accent}05`} gap={80} size={1} />
			</ReactFlow>
		</div>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research5() {
	const [branch, setBranch] = useState<ResearchBranchKey>("applied_industry");
	const [popover, setPopover] = useState<{ node: RadialNode; x: number; y: number } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);

	const pal = palette(branch);

	const handleNodeSelect = useCallback((node: RadialNode | null, x: number, y: number) => {
		setMenuOpen(false);
		if (!node) {
			setPopover(null);
			return;
		}
		setPopover({ node, x, y });
	}, []);

	const handleHubClick = useCallback(() => {
		setPopover(null);
		// Position menu at center of viewport
		const rect = containerRef.current?.getBoundingClientRect();
		if (rect) setMenuPos({ x: rect.width / 2 - 100, y: rect.height / 2 - 80 });
		setMenuOpen((o) => !o);
	}, []);

	const handleBranchSelect = useCallback((b: ResearchBranchKey) => {
		setBranch(b);
		setMenuOpen(false);
		setPopover(null);
	}, []);

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
				color: BASE.text1,
			}}
		>
			{/* Dither */}
			<div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
				<IsolatedDither
					waveSpeed={0.02}
					waveFrequency={2}
					waveAmplitude={0.4}
					waveColor={pal.dither}
					colorNum={4}
					pixelSize={pal.ditherPx}
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
					background: "radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(5,9,16,0.6) 75%)",
				}}
			/>

			{/* Tree canvas */}
			<div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
				<ReactFlowProvider>
					<TreeCanvas
						branch={branch}
						onNodeSelect={handleNodeSelect}
						onHubClick={handleHubClick}
						menuOpen={menuOpen}
					/>
				</ReactFlowProvider>

				{/* Near-node popover */}
				{popover && (
					<NodePopover
						node={popover.node}
						x={popover.x}
						y={popover.y}
						accent={pal.accent}
						onClose={() => setPopover(null)}
					/>
				)}

				{/* Branch menu */}
				{menuOpen && (
					<BranchMenu activeBranch={branch} onSelect={handleBranchSelect} position={menuPos} />
				)}

				{/* Top overlay: meta-matter */}
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
						background: BASE.glass,
						border: `1px solid ${BASE.stroke}`,
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

				{/* Top-left: colony info */}
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
							color: pal.accent,
							textShadow: `0 0 16px ${pal.accent}33`,
						}}
					>
						RESEARCH
					</span>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: BASE.text3,
							letterSpacing: "0.08em",
						}}
					>
						Aegis Prime — 2 Research Sites
					</span>
				</div>

				{/* Bottom-left: active research */}
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
						background: BASE.glass,
						border: `1px solid ${BASE.researching}22`,
						backdropFilter: "blur(12px)",
					}}
				>
					<div
						style={{
							width: 6,
							height: 6,
							borderRadius: "50%",
							background: BASE.researching,
							boxShadow: `0 0 8px ${BASE.researching}`,
							animation: "pulse 2s ease-in-out infinite",
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
							color: BASE.text1,
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
								background: `linear-gradient(90deg, ${BASE.researching}66, ${BASE.researching})`,
							}}
						/>
					</div>
					<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 9, color: BASE.text3 }}>
						{ACTIVE_RESEARCH.remaining}
					</span>
				</div>
			</div>

			<style>{`
        @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
		</div>
	);
}
