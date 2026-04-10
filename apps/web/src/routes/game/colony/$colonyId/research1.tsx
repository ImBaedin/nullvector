/**
 * Research Mockup 1 — "Blueprint Cartography"
 *
 * Direction: Applied Industry tab. Blueprint-meets-industrial aesthetic.
 * Warm amber dither background. Full tree canvas with glass sidebar for
 * node detail. Tab strip across the top. Meta-matter balance bar.
 * Emphasizes the hand-laid-out star-chart feel with authored node positions.
 */

import "@/features/game-ui/theme";
import { createFileRoute } from "@tanstack/react-router";
import "@xyflow/react/dist/style.css";
import {
	ReactFlow,
	Background,
	type Node,
	type Edge,
	Position,
	Handle,
	type NodeProps,
	useReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import { useState, useCallback, useMemo, type CSSProperties } from "react";

import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	RESEARCH_TABS,
	APPLIED_INDUSTRY_NODES,
	META_MATTER_BALANCES,
	META_MATTER_COLORS,
	META_MATTER_LABELS,
	ACTIVE_RESEARCH,
	formatDuration,
	formatResourceCount,
	type MockResearchNode,
	type NodeStatus,
	type ResearchBranchKey,
	getNodesForBranch,
} from "@/features/research/mockup-data";

export const Route = createFileRoute("/game/colony/$colonyId/research1")({
	component: Research1,
});

/* ── Palette ──────────────────────────────────────────────────────────────── */

const TAB = RESEARCH_TABS[0]!; // Applied Industry

const PALETTE = {
	accent: TAB.themeColor,
	accentSoft: TAB.themeColorSoft,
	bg: "#060b14",
	glass: "rgba(11,20,38,0.72)",
	glassStroke: "rgba(255,145,79,0.22)",
	textPrimary: "#edf5ff",
	textSecondary: "#b7c9df",
	textMuted: "#7f94af",
	completedFill: "rgba(255,145,79,0.18)",
	completedStroke: "#ff914f",
	availableFill: "rgba(61,217,255,0.10)",
	availableStroke: "#3dd9ff",
	lockedFill: "rgba(40,50,70,0.35)",
	lockedStroke: "rgba(127,148,175,0.30)",
	researchingFill: "rgba(255,209,102,0.14)",
	researchingStroke: "#ffd166",
	capstoneFill: "rgba(228,140,255,0.10)",
	capstoneBorder: "#e48cff",
	edgeCompleted: "rgba(255,145,79,0.50)",
	edgeAvailable: "rgba(61,217,255,0.35)",
	edgeLocked: "rgba(127,148,175,0.15)",
};

/* ── Status helpers ───────────────────────────────────────────────────────── */

function statusColors(status: NodeStatus, isCapstone: boolean) {
	if (isCapstone && status === "locked")
		return { fill: PALETTE.capstoneFill, stroke: PALETTE.capstoneBorder, opacity: 0.45 };
	switch (status) {
		case "completed":
			return { fill: PALETTE.completedFill, stroke: PALETTE.completedStroke, opacity: 1 };
		case "available":
			return { fill: PALETTE.availableFill, stroke: PALETTE.availableStroke, opacity: 1 };
		case "researching":
			return { fill: PALETTE.researchingFill, stroke: PALETTE.researchingStroke, opacity: 1 };
		case "locked":
		default:
			return { fill: PALETTE.lockedFill, stroke: PALETTE.lockedStroke, opacity: 0.55 };
	}
}

function statusLabel(s: NodeStatus): string {
	switch (s) {
		case "completed":
			return "COMPLETED";
		case "available":
			return "AVAILABLE";
		case "researching":
			return "IN PROGRESS";
		case "locked":
			return "LOCKED";
	}
}

/* ── Custom React Flow Nodes ──────────────────────────────────────────────── */

function CircleNode({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = statusColors(d.status, false);
	return (
		<div style={{ position: "relative", width: 72, height: 72 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 72,
					height: 72,
					borderRadius: "50%",
					border: `2px solid ${c.stroke}`,
					background: c.fill,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.opacity,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 20px ${c.stroke}44` : "none",
					transition: "box-shadow 0.3s, border-color 0.3s",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: c.stroke,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.15,
						padding: "0 6px",
					}}
				>
					{d.name.split(" ").slice(0, 2).join(" ")}
				</span>
				{d.maxLevel > 1 && (
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: PALETTE.textMuted,
							marginTop: 2,
						}}
					>
						{d.level}/{d.maxLevel}
					</span>
				)}
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function HexNode({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = statusColors(d.status, false);
	const hexClip = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
	return (
		<div style={{ position: "relative", width: 82, height: 82 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 82,
					height: 82,
					clipPath: hexClip,
					background: `linear-gradient(135deg, ${c.fill}, transparent)`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.opacity,
					cursor: "pointer",
				}}
			>
				<div
					style={{
						width: 76,
						height: 76,
						clipPath: hexClip,
						border: `2px solid ${c.stroke}`,
						background: c.fill,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						boxShadow: d.status === "completed" ? `inset 0 0 24px ${c.stroke}33` : "none",
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: c.stroke,
							letterSpacing: "0.06em",
							textTransform: "uppercase",
							textAlign: "center",
							lineHeight: 1.2,
							padding: "0 10px",
						}}
					>
						{d.name.split(" ").slice(0, 2).join("\n")}
					</span>
				</div>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function SquareNode({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = statusColors(d.status, false);
	return (
		<div style={{ position: "relative", width: 78, height: 78 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 78,
					height: 78,
					borderRadius: 6,
					border: `2px solid ${c.stroke}`,
					background: c.fill,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.opacity,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 16px ${c.stroke}44` : "none",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: c.stroke,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.2,
						padding: "0 6px",
					}}
				>
					{d.name.split(" ").slice(0, 2).join("\n")}
				</span>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function CapstoneNode({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = statusColors(d.status, true);
	return (
		<div style={{ position: "relative", width: 110, height: 110 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 110,
					height: 110,
					borderRadius: 12,
					border: `2.5px solid ${c.stroke}`,
					background: `linear-gradient(160deg, ${c.fill}, rgba(6,11,20,0.6))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.opacity,
					cursor: "pointer",
					boxShadow: `0 0 30px ${c.stroke}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
				}}
			>
				<div
					style={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						background: c.stroke,
						marginBottom: 6,
						opacity: 0.6,
						boxShadow: `0 0 8px ${c.stroke}`,
					}}
				/>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 9,
						fontWeight: 700,
						color: c.stroke,
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.25,
						padding: "0 8px",
					}}
				>
					{d.name}
				</span>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

const nodeTypes = {
	circle: CircleNode,
	hex: HexNode,
	square: SquareNode,
	capstone: CapstoneNode,
};

/* ── Build React Flow data from mock nodes ────────────────────────────────── */

function buildFlowData(mockNodes: MockResearchNode[]) {
	const nodes: Node[] = mockNodes.map((n) => ({
		id: n.id,
		type: n.shape,
		position: { x: n.position.x + 200, y: n.position.y + 300 },
		data: n as any,
		draggable: false,
		selectable: true,
	}));

	const edges: Edge[] = [];
	for (const n of mockNodes) {
		for (const preId of n.prerequisites) {
			const pre = mockNodes.find((p) => p.id === preId);
			const isCompleted = pre?.status === "completed" && n.status !== "locked";
			edges.push({
				id: `${preId}-${n.id}`,
				source: preId,
				target: n.id,
				type: "default",
				animated: n.status === "researching",
				style: {
					stroke: isCompleted
						? PALETTE.edgeCompleted
						: n.status === "locked"
							? PALETTE.edgeLocked
							: PALETTE.edgeAvailable,
					strokeWidth: isCompleted ? 2 : 1.5,
					strokeDasharray: n.status === "locked" ? "6 4" : undefined,
				},
			});
		}
	}

	return { nodes, edges };
}

/* ── Meta-matter pill ─────────────────────────────────────────────────────── */

function MetaMatterPill({
	rarity,
	amount,
}: {
	rarity: "common" | "rare" | "mythic";
	amount: number;
}) {
	const color = META_MATTER_COLORS[rarity];
	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "4px 10px",
				borderRadius: 6,
				background: `${color}14`,
				border: `1px solid ${color}33`,
			}}
		>
			<div
				style={{
					width: 7,
					height: 7,
					borderRadius: rarity === "mythic" ? 2 : "50%",
					background: color,
					boxShadow: `0 0 6px ${color}88`,
					transform: rarity === "mythic" ? "rotate(45deg)" : undefined,
				}}
			/>
			<span
				style={{
					fontFamily: "var(--nv-font-mono)",
					fontSize: 11,
					color: color,
					fontWeight: 500,
				}}
			>
				{amount.toLocaleString()}
			</span>
			<span
				style={{
					fontSize: 9,
					color: PALETTE.textMuted,
					textTransform: "uppercase",
					letterSpacing: "0.1em",
				}}
			>
				{META_MATTER_LABELS[rarity]}
			</span>
		</div>
	);
}

/* ── Tab strip ────────────────────────────────────────────────────────────── */

function ResearchTabStrip({
	activeKey,
	onTabChange,
}: {
	activeKey: ResearchBranchKey;
	onTabChange: (key: ResearchBranchKey) => void;
}) {
	return (
		<div
			style={{
				display: "flex",
				gap: 2,
				borderBottom: "1px solid rgba(127,148,175,0.15)",
			}}
		>
			{RESEARCH_TABS.map((tab) => {
				const active = tab.key === activeKey;
				return (
					<button
						key={tab.key}
						onClick={() => onTabChange(tab.key)}
						style={{
							padding: "8px 16px",
							borderBottom: active ? `2px solid ${tab.themeColor}` : "2px solid transparent",
							background: active ? `${tab.themeColor}0A` : "transparent",
							color: active ? tab.themeColor : PALETTE.textMuted,
							fontFamily: "var(--nv-font-body)",
							fontSize: 11,
							fontWeight: active ? 700 : 500,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							cursor: "pointer",
							border: "none",
							borderBottomStyle: "solid",
							borderBottomWidth: 2,
							borderBottomColor: active ? tab.themeColor : "transparent",
							transition: "all 0.2s",
						}}
					>
						{tab.shortLabel}
					</button>
				);
			})}
		</div>
	);
}

/* ── Node detail sidebar ──────────────────────────────────────────────────── */

function NodeDetailPanel({ node }: { node: MockResearchNode | null }) {
	if (!node) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
					color: PALETTE.textMuted,
					fontFamily: "var(--nv-font-body)",
					fontSize: 12,
					textAlign: "center",
					padding: 24,
					gap: 8,
				}}
			>
				<div
					style={{
						width: 40,
						height: 40,
						borderRadius: "50%",
						border: `1px dashed ${PALETTE.glassStroke}`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: 4,
					}}
				>
					<span style={{ fontSize: 18, opacity: 0.5 }}>?</span>
				</div>
				<span>Select a node to inspect</span>
			</div>
		);
	}

	const c = statusColors(node.status, node.shape === "capstone");

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 14,
				padding: 16,
				height: "100%",
				overflowY: "auto",
			}}
		>
			{/* Header */}
			<div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 6,
					}}
				>
					<div
						style={{
							width: 10,
							height: 10,
							borderRadius: node.shape === "circle" ? "50%" : node.shape === "hex" ? 2 : 3,
							background: c.stroke,
							boxShadow: `0 0 8px ${c.stroke}66`,
							transform: node.shape === "hex" ? "rotate(45deg)" : undefined,
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-display)",
							fontSize: 14,
							fontWeight: 700,
							color: PALETTE.textPrimary,
							letterSpacing: "0.02em",
						}}
					>
						{node.name}
					</span>
				</div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: c.stroke,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
						fontWeight: 600,
					}}
				>
					{statusLabel(node.status)}
					{node.maxLevel > 1 && ` — LV ${node.level}/${node.maxLevel}`}
				</span>
			</div>

			{/* Description */}
			<p
				style={{
					fontFamily: "var(--nv-font-body)",
					fontSize: 12,
					lineHeight: 1.6,
					color: node.status === "locked" ? PALETTE.textMuted : PALETTE.textSecondary,
					margin: 0,
					filter: node.status === "locked" ? "blur(2px)" : undefined,
					userSelect: node.status === "locked" ? "none" : undefined,
				}}
			>
				{node.description}
			</p>

			{/* Divider */}
			<div style={{ height: 1, background: PALETTE.glassStroke, opacity: 0.5 }} />

			{/* Effects */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: PALETTE.textMuted,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Effects
				</span>
				<div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
					{node.effects.map((fx, i) => (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								padding: "4px 8px",
								borderRadius: 4,
								background: "rgba(255,255,255,0.03)",
								border: "1px solid rgba(255,255,255,0.06)",
							}}
						>
							<div
								style={{
									width: 4,
									height: 4,
									borderRadius: "50%",
									background: fx.startsWith("Unlock") ? "#64f8bb" : PALETTE.accent,
								}}
							/>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 10,
									color: node.status === "locked" ? PALETTE.textMuted : PALETTE.textPrimary,
									filter: node.status === "locked" ? "blur(1.5px)" : undefined,
								}}
							>
								{fx}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Costs */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: PALETTE.textMuted,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Cost
				</span>
				<div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
					{node.costs.metaMatter.common && (
						<CostChip
							label="Common"
							value={node.costs.metaMatter.common}
							color={META_MATTER_COLORS.common}
						/>
					)}
					{node.costs.metaMatter.rare && (
						<CostChip
							label="Rare"
							value={node.costs.metaMatter.rare}
							color={META_MATTER_COLORS.rare}
						/>
					)}
					{node.costs.metaMatter.mythic && (
						<CostChip
							label="Mythic"
							value={node.costs.metaMatter.mythic}
							color={META_MATTER_COLORS.mythic}
						/>
					)}
					{node.costs.resources?.alloy && (
						<CostChip label="Alloy" value={node.costs.resources.alloy} color="#ff914f" />
					)}
					{node.costs.resources?.crystal && (
						<CostChip label="Crystal" value={node.costs.resources.crystal} color="#6ecbff" />
					)}
					{node.costs.resources?.fuel && (
						<CostChip label="Fuel" value={node.costs.resources.fuel} color="#ffd166" />
					)}
				</div>
				<div style={{ marginTop: 8 }}>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 10,
							color: PALETTE.textMuted,
						}}
					>
						Duration: {formatDuration(node.costs.seconds)}
					</span>
				</div>
			</div>

			{/* Requirements */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: PALETTE.textMuted,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Requirements
				</span>
				<div
					style={{
						marginTop: 6,
						padding: "6px 8px",
						borderRadius: 4,
						background: "rgba(255,255,255,0.02)",
						border: "1px solid rgba(255,255,255,0.06)",
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 10,
							color: PALETTE.textSecondary,
						}}
					>
						Research Directorate Lv {node.requiredResearchFacilityLevel}
					</span>
				</div>
			</div>

			{/* Action */}
			{node.status === "available" && (
				<button
					style={{
						marginTop: "auto",
						padding: "10px 16px",
						borderRadius: 6,
						border: `1px solid ${PALETTE.accent}66`,
						background: `linear-gradient(170deg, ${PALETTE.accent}44, ${PALETTE.accent}18)`,
						color: "#fff",
						fontFamily: "var(--nv-font-body)",
						fontSize: 12,
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
	);
}

function CostChip({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<div
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "3px 8px",
				borderRadius: 4,
				background: `${color}11`,
				border: `1px solid ${color}28`,
			}}
		>
			<div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
			<span
				style={{
					fontFamily: "var(--nv-font-mono)",
					fontSize: 10,
					color,
				}}
			>
				{formatResourceCount(value)}
			</span>
			<span
				style={{
					fontFamily: "var(--nv-font-mono)",
					fontSize: 8,
					color: PALETTE.textMuted,
					textTransform: "uppercase",
				}}
			>
				{label}
			</span>
		</div>
	);
}

/* ── Main layout ──────────────────────────────────────────────────────────── */

function ResearchTreeCanvas({
	activeTab,
	onNodeSelect,
}: {
	activeTab: ResearchBranchKey;
	onNodeSelect: (node: MockResearchNode | null) => void;
}) {
	const mockNodes = getNodesForBranch(activeTab);
	const { nodes, edges } = useMemo(() => buildFlowData(mockNodes), [activeTab]);

	const handleNodeClick = useCallback(
		(_: any, node: Node) => {
			const mockNode = mockNodes.find((n) => n.id === node.id);
			onNodeSelect(mockNode ?? null);
		},
		[mockNodes, onNodeSelect],
	);

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodeClick={handleNodeClick}
			onPaneClick={() => onNodeSelect(null)}
			fitView
			fitViewOptions={{ padding: 0.4 }}
			minZoom={0.3}
			maxZoom={1.6}
			proOptions={{ hideAttribution: true }}
			panOnScroll
			zoomOnScroll
			style={{ width: "100%", height: "100%" }}
		>
			<Background color="rgba(255,145,79,0.06)" gap={48} size={1} />
		</ReactFlow>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research1() {
	const [activeTab, setActiveTab] = useState<ResearchBranchKey>("applied_industry");
	const [selectedNode, setSelectedNode] = useState<MockResearchNode | null>(null);

	const currentTab = RESEARCH_TABS.find((t) => t.key === activeTab) ?? TAB;

	return (
		<div
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: PALETTE.bg,
				fontFamily: "var(--nv-font-body)",
				color: PALETTE.textPrimary,
			}}
		>
			{/* Dither background */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					opacity: 0.35,
					transition: "opacity 0.6s",
				}}
			>
				<IsolatedDither
					waveSpeed={0.03}
					waveFrequency={2.5}
					waveAmplitude={0.35}
					waveColor={currentTab.ditherWaveColor}
					colorNum={4}
					pixelSize={currentTab.ditherPixelSize}
					enableMouseInteraction={false}
				/>
			</div>

			{/* Gradient overlay to push dither into background */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(6,11,20,0.7) 80%)",
					pointerEvents: "none",
				}}
			/>

			{/* Content layer */}
			<div
				style={{
					position: "relative",
					zIndex: 2,
					display: "flex",
					flexDirection: "column",
					height: "100%",
				}}
			>
				{/* Top bar */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "12px 20px 0",
					}}
				>
					{/* Title */}
					<div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
						<h1
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 18,
								fontWeight: 800,
								letterSpacing: "0.04em",
								color: currentTab.themeColor,
								margin: 0,
								textShadow: `0 0 24px ${currentTab.themeColor}44`,
							}}
						>
							RESEARCH
						</h1>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: PALETTE.textMuted,
								letterSpacing: "0.16em",
								textTransform: "uppercase",
							}}
						>
							Aegis Prime — Directorate Lv 2
						</span>
					</div>

					{/* Meta-matter balances */}
					<div style={{ display: "flex", gap: 8 }}>
						<MetaMatterPill rarity="common" amount={META_MATTER_BALANCES.common} />
						<MetaMatterPill rarity="rare" amount={META_MATTER_BALANCES.rare} />
						<MetaMatterPill rarity="mythic" amount={META_MATTER_BALANCES.mythic} />
					</div>
				</div>

				{/* Tab strip */}
				<div style={{ padding: "8px 20px 0" }}>
					<ResearchTabStrip
						activeKey={activeTab}
						onTabChange={(k) => {
							setActiveTab(k);
							setSelectedNode(null);
						}}
					/>
				</div>

				{/* Main area: tree + sidebar */}
				<div
					style={{
						flex: 1,
						display: "flex",
						overflow: "hidden",
						padding: "12px 20px 20px",
						gap: 16,
					}}
				>
					{/* Tree canvas */}
					<div
						style={{
							flex: 1,
							borderRadius: 12,
							overflow: "hidden",
							border: `1px solid ${PALETTE.glassStroke}`,
							background: "rgba(6,11,20,0.4)",
							backdropFilter: "blur(4px)",
							position: "relative",
						}}
					>
						<ReactFlowProvider>
							<ResearchTreeCanvas activeTab={activeTab} onNodeSelect={setSelectedNode} />
						</ReactFlowProvider>

						{/* Active research ticker at bottom of canvas */}
						<div
							style={{
								position: "absolute",
								bottom: 12,
								left: 12,
								right: 12,
								padding: "8px 14px",
								borderRadius: 8,
								background: PALETTE.glass,
								border: `1px solid ${PALETTE.researchingStroke}33`,
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								backdropFilter: "blur(10px)",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<div
									style={{
										width: 6,
										height: 6,
										borderRadius: "50%",
										background: PALETTE.researchingStroke,
										boxShadow: `0 0 8px ${PALETTE.researchingStroke}`,
										animation: "pulse 2s ease-in-out infinite",
									}}
								/>
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 10,
										color: PALETTE.researchingStroke,
										letterSpacing: "0.08em",
										textTransform: "uppercase",
									}}
								>
									Researching
								</span>
								<span
									style={{
										fontFamily: "var(--nv-font-body)",
										fontSize: 11,
										color: PALETTE.textPrimary,
										fontWeight: 600,
									}}
								>
									{ACTIVE_RESEARCH.nodeName}
								</span>
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 10,
										color: PALETTE.textMuted,
									}}
								>
									Lv {ACTIVE_RESEARCH.fromLevel} → {ACTIVE_RESEARCH.toLevel}
								</span>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<div
									style={{
										width: 120,
										height: 4,
										borderRadius: 2,
										background: "rgba(255,255,255,0.08)",
										overflow: "hidden",
									}}
								>
									<div
										style={{
											width: "75%",
											height: "100%",
											borderRadius: 2,
											background: `linear-gradient(90deg, ${PALETTE.researchingStroke}88, ${PALETTE.researchingStroke})`,
										}}
									/>
								</div>
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 10,
										color: PALETTE.researchingStroke,
									}}
								>
									15m
								</span>
							</div>
						</div>
					</div>

					{/* Detail sidebar */}
					<div
						style={{
							width: 280,
							flexShrink: 0,
							borderRadius: 12,
							border: `1px solid ${PALETTE.glassStroke}`,
							background: PALETTE.glass,
							backdropFilter: "blur(14px)",
							overflow: "hidden",
						}}
					>
						<NodeDetailPanel node={selectedNode} />
					</div>
				</div>
			</div>

			{/* Pulse keyframes */}
			<style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
		</div>
	);
}
