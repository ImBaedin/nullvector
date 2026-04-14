/**
 * Research Mockup 3 — "Neural Archive"
 *
 * Direction: Scientific Infrastructure tab. Ethereal, neural-network
 * aesthetic with violet-teal dither. Emphasizes the research queue
 * management panel, meta-matter economy display, and an active-research
 * progress HUD. The tree lives in the center with a split layout:
 * queue/economy on the left, node inspector on the right.
 * Nodes glow with a soft bio-luminescent pulse.
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
	ReactFlowProvider,
} from "@xyflow/react";
import { useState, useCallback, useMemo } from "react";

import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	RESEARCH_TABS,
	SCIENTIFIC_INFRASTRUCTURE_NODES,
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

export const Route = createFileRoute("/game/colony/$colonyId/research3")({
	component: Research3,
});

/* ── Palette — neural violet ──────────────────────────────────────────────── */

const SCI_TAB = RESEARCH_TABS[2]!;

const V = {
	accent: SCI_TAB.themeColor,
	accentDim: "rgba(155,124,255,0.25)",
	bg: "#060811",
	glass: "rgba(10,10,22,0.76)",
	glassBright: "rgba(14,12,28,0.88)",
	glassStroke: "rgba(155,124,255,0.16)",
	textPrimary: "#f0eeff",
	textSecondary: "#bbb4d6",
	textMuted: "#726b8f",
	nodeCompleted: { fill: "rgba(155,124,255,0.18)", stroke: "#9b7cff" },
	nodeAvailable: { fill: "rgba(100,248,187,0.08)", stroke: "#64f8bb" },
	nodeLocked: { fill: "rgba(40,38,60,0.30)", stroke: "rgba(114,107,143,0.25)" },
	nodeResearching: { fill: "rgba(61,217,255,0.10)", stroke: "#3dd9ff" },
	capstone: { fill: "rgba(228,140,255,0.10)", stroke: "#e48cff" },
	edgeLit: "rgba(155,124,255,0.50)",
	edgeDim: "rgba(114,107,143,0.15)",
};

function sc(status: NodeStatus, isCap: boolean) {
	if (isCap) return { ...V.capstone, op: status === "locked" ? 0.35 : 1 };
	switch (status) {
		case "completed":
			return { ...V.nodeCompleted, op: 1 };
		case "available":
			return { ...V.nodeAvailable, op: 1 };
		case "researching":
			return { ...V.nodeResearching, op: 1 };
		default:
			return { ...V.nodeLocked, op: 0.45 };
	}
}

/* ── Custom nodes — bio-luminescent ───────────────────────────────────────── */

function NeuralCircle({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	return (
		<div style={{ position: "relative", width: 76, height: 76 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{/* Glow ring */}
			{d.status !== "locked" && (
				<div
					style={{
						position: "absolute",
						inset: -6,
						borderRadius: "50%",
						background: `radial-gradient(circle, ${c.stroke}18, transparent 70%)`,
						animation:
							d.status === "researching" ? "neuralPulse 3s ease-in-out infinite" : undefined,
					}}
				/>
			)}
			<div
				style={{
					width: 76,
					height: 76,
					borderRadius: "50%",
					border: `1.5px solid ${c.stroke}`,
					background: `radial-gradient(circle at 40% 30%, ${c.fill}, rgba(6,8,17,0.7))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 24px ${c.stroke}22` : "none",
				}}
			>
				{d.maxLevel > 1 && (
					<div
						style={{
							display: "flex",
							gap: 3,
							marginBottom: 3,
						}}
					>
						{Array.from({ length: d.maxLevel }).map((_, i) => (
							<div
								key={i}
								style={{
									width: 4,
									height: 4,
									borderRadius: "50%",
									background: i < d.level ? c.stroke : `${c.stroke}33`,
									boxShadow: i < d.level ? `0 0 4px ${c.stroke}` : "none",
								}}
							/>
						))}
					</div>
				)}
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: c.stroke,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.2,
						padding: "0 8px",
					}}
				>
					{d.name.split(" ").slice(0, 2).join(" ")}
				</span>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function NeuralHex({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const clip = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
	return (
		<div style={{ position: "relative", width: 86, height: 86 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{d.status !== "locked" && (
				<div
					style={{
						position: "absolute",
						inset: -8,
						borderRadius: "50%",
						background: `radial-gradient(circle, ${c.stroke}14, transparent 65%)`,
					}}
				/>
			)}
			<div
				style={{
					width: 86,
					height: 86,
					clipPath: clip,
					background: `linear-gradient(160deg, ${c.fill}, rgba(6,8,17,0.5))`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
				}}
			>
				<div
					style={{
						width: 80,
						height: 80,
						clipPath: clip,
						border: `1.5px solid ${c.stroke}`,
						background: c.fill,
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
							border: `1px solid ${c.stroke}55`,
							background: `${c.stroke}22`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							marginBottom: 4,
						}}
					>
						<div
							style={{
								width: 4,
								height: 4,
								borderRadius: "50%",
								background: c.stroke,
							}}
						/>
					</div>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 7,
							color: c.stroke,
							letterSpacing: "0.06em",
							textTransform: "uppercase",
							textAlign: "center",
							lineHeight: 1.2,
							padding: "0 10px",
						}}
					>
						{d.name}
					</span>
				</div>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function NeuralSquare({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	return (
		<div style={{ position: "relative", width: 80, height: 80 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 80,
					height: 80,
					borderRadius: 8,
					border: `1.5px solid ${c.stroke}`,
					background: `linear-gradient(150deg, ${c.fill}, rgba(6,8,17,0.6))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 18px ${c.stroke}22` : "none",
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
						padding: "0 8px",
					}}
				>
					{d.name.split(" ").slice(0, 2).join("\n")}
				</span>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function NeuralCapstone({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, true);
	return (
		<div style={{ position: "relative", width: 114, height: 114 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{/* Orbital ring */}
			<div
				style={{
					position: "absolute",
					inset: -10,
					borderRadius: "50%",
					border: `1px dashed ${c.stroke}22`,
					animation: "neuralOrbit 12s linear infinite",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: -3,
						left: "50%",
						width: 6,
						height: 6,
						borderRadius: "50%",
						background: c.stroke,
						opacity: 0.4,
						boxShadow: `0 0 8px ${c.stroke}`,
					}}
				/>
			</div>
			<div
				style={{
					width: 114,
					height: 114,
					borderRadius: "50%",
					border: `2px solid ${c.stroke}`,
					background: `radial-gradient(circle at 40% 35%, ${c.fill}, rgba(6,8,17,0.6) 70%)`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: `0 0 40px ${c.stroke}15`,
				}}
			>
				<div
					style={{
						width: 14,
						height: 14,
						borderRadius: "50%",
						border: `1.5px solid ${c.stroke}`,
						background: `radial-gradient(circle, ${c.stroke}44, transparent)`,
						marginBottom: 6,
					}}
				/>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 8,
						fontWeight: 700,
						color: c.stroke,
						letterSpacing: "0.12em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.25,
						padding: "0 14px",
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
	circle: NeuralCircle,
	hex: NeuralHex,
	square: NeuralSquare,
	capstone: NeuralCapstone,
};

/* ── Flow data builder ────────────────────────────────────────────────────── */

function buildFlowData(mockNodes: MockResearchNode[]) {
	const nodes: Node[] = mockNodes.map((n) => ({
		id: n.id,
		type: n.shape,
		position: { x: n.position.x + 200, y: n.position.y + 200 },
		data: n as any,
		draggable: false,
		selectable: true,
	}));

	const edges: Edge[] = [];
	for (const n of mockNodes) {
		for (const preId of n.prerequisites) {
			const pre = mockNodes.find((p) => p.id === preId);
			const lit = pre?.status === "completed" && n.status !== "locked";
			edges.push({
				id: `${preId}-${n.id}`,
				source: preId,
				target: n.id,
				type: "default",
				animated: n.status === "researching",
				style: {
					stroke: lit ? V.edgeLit : V.edgeDim,
					strokeWidth: lit ? 2 : 1,
					strokeDasharray: n.status === "locked" ? "3 5" : undefined,
				},
			});
		}
	}
	return { nodes, edges };
}

/* ── Left panel: Queue + Economy ──────────────────────────────────────────── */

function QueueEconomyPanel() {
	const pct = 75;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 12,
				height: "100%",
				overflow: "auto",
				padding: 16,
			}}
		>
			{/* Meta-matter balances */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: V.textMuted,
						letterSpacing: "0.18em",
						textTransform: "uppercase",
					}}
				>
					Meta-Matter Reserve
				</span>
				<div
					style={{
						marginTop: 8,
						display: "flex",
						flexDirection: "column",
						gap: 6,
					}}
				>
					{(["common", "rare", "mythic"] as const).map((r) => (
						<div
							key={r}
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "6px 10px",
								borderRadius: 6,
								background: `${META_MATTER_COLORS[r]}08`,
								border: `1px solid ${META_MATTER_COLORS[r]}18`,
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<div
									style={{
										width: 8,
										height: 8,
										borderRadius: r === "mythic" ? 2 : r === "rare" ? "50%" : "50%",
										background: META_MATTER_COLORS[r],
										boxShadow: `0 0 8px ${META_MATTER_COLORS[r]}55`,
										transform: r === "mythic" ? "rotate(45deg)" : undefined,
									}}
								/>
								<span
									style={{
										fontFamily: "var(--nv-font-body)",
										fontSize: 11,
										color: V.textSecondary,
										textTransform: "capitalize",
									}}
								>
									{META_MATTER_LABELS[r]}
								</span>
							</div>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 13,
									fontWeight: 600,
									color: META_MATTER_COLORS[r],
								}}
							>
								{META_MATTER_BALANCES[r].toLocaleString()}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Divider */}
			<div style={{ height: 1, background: V.glassStroke }} />

			{/* Active research */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: V.textMuted,
						letterSpacing: "0.18em",
						textTransform: "uppercase",
					}}
				>
					Research Queue
				</span>
				<div
					style={{
						marginTop: 8,
						padding: 12,
						borderRadius: 8,
						background: "rgba(61,217,255,0.04)",
						border: `1px solid rgba(61,217,255,0.15)`,
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 8,
						}}
					>
						<div
							style={{
								width: 7,
								height: 7,
								borderRadius: "50%",
								background: "#3dd9ff",
								boxShadow: "0 0 8px rgba(61,217,255,0.6)",
								animation: "neuralPulse 2s ease-in-out infinite",
							}}
						/>
						<span
							style={{
								fontFamily: "var(--nv-font-body)",
								fontSize: 11,
								fontWeight: 600,
								color: V.textPrimary,
							}}
						>
							{ACTIVE_RESEARCH.nodeName}
						</span>
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: 4,
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: V.textMuted,
							}}
						>
							Lv {ACTIVE_RESEARCH.fromLevel} → {ACTIVE_RESEARCH.toLevel}
						</span>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: "#3dd9ff",
							}}
						>
							{Math.round(pct)}%
						</span>
					</div>
					{/* Progress bar */}
					<div
						style={{
							width: "100%",
							height: 6,
							borderRadius: 3,
							background: "rgba(255,255,255,0.06)",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								width: `${pct}%`,
								height: "100%",
								borderRadius: 3,
								background: "linear-gradient(90deg, rgba(61,217,255,0.5), #3dd9ff)",
								position: "relative",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									position: "absolute",
									inset: 0,
									background:
										"linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
									animation: "neuralScan 2.5s ease-in-out infinite",
								}}
							/>
						</div>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							marginTop: 6,
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: V.textMuted,
							}}
						>
							{ACTIVE_RESEARCH.originColony}
						</span>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: V.textMuted,
							}}
						>
							~15:00 remaining
						</span>
					</div>

					{/* Cancel button */}
					<button
						style={{
							marginTop: 10,
							width: "100%",
							padding: "6px 0",
							borderRadius: 4,
							border: `1px solid rgba(255,111,136,0.3)`,
							background: "rgba(255,111,136,0.06)",
							color: "#ff6f88",
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							cursor: "pointer",
						}}
					>
						Cancel (Full Refund)
					</button>
				</div>
			</div>

			{/* Divider */}
			<div style={{ height: 1, background: V.glassStroke }} />

			{/* Queue slot indicator */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: V.textMuted,
						letterSpacing: "0.18em",
						textTransform: "uppercase",
					}}
				>
					Queue Slots
				</span>
				<div
					style={{
						marginTop: 8,
						display: "flex",
						gap: 6,
					}}
				>
					<div
						style={{
							flex: 1,
							height: 36,
							borderRadius: 6,
							border: `1px solid rgba(61,217,255,0.3)`,
							background: "rgba(61,217,255,0.08)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: "#3dd9ff",
								letterSpacing: "0.08em",
							}}
						>
							ACTIVE
						</span>
					</div>
					<div
						style={{
							flex: 1,
							height: 36,
							borderRadius: 6,
							border: `1px dashed ${V.glassStroke}`,
							background: "rgba(255,255,255,0.02)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: V.textMuted,
								letterSpacing: "0.06em",
							}}
						>
							LOCKED
						</span>
					</div>
				</div>
				<div
					style={{
						marginTop: 6,
						padding: "4px 8px",
						borderRadius: 4,
						background: "rgba(155,124,255,0.06)",
						border: `1px solid rgba(155,124,255,0.12)`,
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: V.accent,
						}}
					>
						Unlock +1 slot via Parallel Inquiry
					</span>
				</div>
			</div>

			{/* Colony info */}
			<div style={{ marginTop: "auto" }}>
				<div
					style={{
						padding: "8px 10px",
						borderRadius: 6,
						background: "rgba(255,255,255,0.02)",
						border: `1px solid ${V.glassStroke}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-body)",
								fontSize: 10,
								color: V.textSecondary,
							}}
						>
							Origin Colony
						</span>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 10,
								color: V.textPrimary,
								fontWeight: 600,
							}}
						>
							Aegis Prime
						</span>
					</div>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginTop: 4,
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-body)",
								fontSize: 10,
								color: V.textSecondary,
							}}
						>
							Research Sites
						</span>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 10,
								color: V.accent,
							}}
						>
							2
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ── Right panel: Node inspector ──────────────────────────────────────────── */

function NodeInspector({ node }: { node: MockResearchNode | null }) {
	if (!node) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100%",
					padding: 20,
					textAlign: "center",
				}}
			>
				<div
					style={{
						width: 48,
						height: 48,
						borderRadius: "50%",
						border: `1px dashed ${V.glassStroke}`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: 12,
					}}
				>
					<div
						style={{
							width: 16,
							height: 16,
							borderRadius: "50%",
							border: `1px solid ${V.accent}44`,
							background: `${V.accent}11`,
						}}
					/>
				</div>
				<span
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						color: V.textMuted,
					}}
				>
					Select a node to inspect
				</span>
			</div>
		);
	}

	const c = sc(node.status, node.shape === "capstone");

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 12,
				padding: 16,
				height: "100%",
				overflow: "auto",
			}}
		>
			{/* Title */}
			<div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 4,
					}}
				>
					<div
						style={{
							width: 10,
							height: 10,
							borderRadius: "50%",
							background: c.stroke,
							boxShadow: `0 0 8px ${c.stroke}66`,
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-display)",
							fontSize: 13,
							fontWeight: 700,
							color: V.textPrimary,
						}}
					>
						{node.name}
					</span>
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: c.stroke,
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							fontWeight: 600,
						}}
					>
						{node.status === "completed"
							? "COMPLETED"
							: node.status === "available"
								? "AVAILABLE"
								: node.status === "researching"
									? "IN PROGRESS"
									: "LOCKED"}
					</span>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: V.textMuted,
						}}
					>
						T{node.tier}
					</span>
					{node.maxLevel > 1 && (
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: V.textMuted,
							}}
						>
							Lv {node.level}/{node.maxLevel}
						</span>
					)}
				</div>
			</div>

			{/* Description */}
			<p
				style={{
					fontFamily: "var(--nv-font-body)",
					fontSize: 11,
					lineHeight: 1.6,
					color: node.status === "locked" ? V.textMuted : V.textSecondary,
					margin: 0,
					filter: node.status === "locked" ? "blur(2px)" : undefined,
				}}
			>
				{node.description}
			</p>

			<div style={{ height: 1, background: V.glassStroke, opacity: 0.5 }} />

			{/* Effects */}
			<div>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 8,
						color: V.textMuted,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Effects
				</span>
				<div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
					{node.effects.map((fx, i) => (
						<div
							key={i}
							style={{
								padding: "4px 8px",
								borderRadius: 4,
								background: "rgba(255,255,255,0.02)",
								borderLeft: `2px solid ${fx.startsWith("Unlock") || fx.startsWith("Enable") ? "#64f8bb" : V.accent}44`,
							}}
						>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 10,
									color:
										fx.startsWith("Unlock") || fx.startsWith("Enable") ? "#64f8bb" : V.textPrimary,
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
						fontSize: 8,
						color: V.textMuted,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
					}}
				>
					Cost
				</span>
				<div
					style={{
						marginTop: 6,
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: 4,
					}}
				>
					{Object.entries(node.costs.metaMatter).map(([r, amt]) => (
						<div
							key={r}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 4,
								padding: "3px 6px",
								borderRadius: 3,
								background: "rgba(255,255,255,0.02)",
							}}
						>
							<div
								style={{
									width: 5,
									height: 5,
									borderRadius: r === "mythic" ? 1 : "50%",
									background: META_MATTER_COLORS[r as keyof typeof META_MATTER_COLORS],
									transform: r === "mythic" ? "rotate(45deg)" : undefined,
								}}
							/>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 9,
									color: META_MATTER_COLORS[r as keyof typeof META_MATTER_COLORS],
								}}
							>
								{(amt as number).toLocaleString()}
							</span>
						</div>
					))}
				</div>
				<div style={{ marginTop: 6 }}>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: V.textMuted,
						}}
					>
						⏱ {formatDuration(node.costs.seconds)}
					</span>
				</div>
			</div>

			{/* Requirement */}
			<div
				style={{
					padding: "6px 8px",
					borderRadius: 4,
					background: "rgba(255,255,255,0.02)",
					border: `1px solid ${V.glassStroke}`,
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: V.textSecondary,
					}}
				>
					Requires Research Sites {node.requiredResearchFacilityLevel}
				</span>
			</div>

			{/* Action */}
			{node.status === "available" && (
				<button
					style={{
						marginTop: "auto",
						padding: "10px 0",
						borderRadius: 6,
						border: `1px solid ${V.nodeAvailable.stroke}55`,
						background: `linear-gradient(170deg, ${V.nodeAvailable.stroke}33, ${V.nodeAvailable.stroke}11)`,
						color: "#fff",
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						fontWeight: 600,
						cursor: "pointer",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
					}}
				>
					Begin Research
				</button>
			)}
		</div>
	);
}

/* ── Tab strip — pill style ───────────────────────────────────────────────── */

function PillTabs({
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
				gap: 4,
				padding: "8px 16px",
			}}
		>
			{RESEARCH_TABS.map((tab) => {
				const active = tab.key === activeKey;
				return (
					<button
						key={tab.key}
						onClick={() => onTabChange(tab.key)}
						style={{
							padding: "6px 14px",
							borderRadius: 20,
							border: active ? `1px solid ${tab.themeColor}55` : `1px solid ${V.glassStroke}`,
							background: active ? `${tab.themeColor}18` : "rgba(255,255,255,0.02)",
							color: active ? tab.themeColor : V.textMuted,
							fontFamily: "var(--nv-font-body)",
							fontSize: 10,
							fontWeight: active ? 600 : 400,
							letterSpacing: "0.06em",
							cursor: "pointer",
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

/* ── Tree canvas ──────────────────────────────────────────────────────────── */

function TreeCanvas({
	activeTab,
	onNodeSelect,
}: {
	activeTab: ResearchBranchKey;
	onNodeSelect: (node: MockResearchNode | null) => void;
}) {
	const mockNodes = getNodesForBranch(activeTab);
	const { nodes, edges } = useMemo(() => buildFlowData(mockNodes), [activeTab]);

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodeClick={(_, n) => {
				const found = mockNodes.find((m) => m.id === n.id);
				onNodeSelect(found ?? null);
			}}
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
			<Background color="rgba(155,124,255,0.04)" gap={60} size={1} />
		</ReactFlow>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research3() {
	const [activeTab, setActiveTab] = useState<ResearchBranchKey>("scientific_infrastructure");
	const [selectedNode, setSelectedNode] = useState<MockResearchNode | null>(null);
	const currentTab = RESEARCH_TABS.find((t) => t.key === activeTab) ?? SCI_TAB;

	return (
		<div
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: V.bg,
				fontFamily: "var(--nv-font-body)",
				color: V.textPrimary,
			}}
		>
			{/* Dither */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					opacity: 0.28,
				}}
			>
				<IsolatedDither
					waveSpeed={0.025}
					waveFrequency={2}
					waveAmplitude={0.4}
					waveColor={currentTab.ditherWaveColor}
					colorNum={5}
					pixelSize={currentTab.ditherPixelSize}
					enableMouseInteraction={false}
				/>
			</div>

			{/* Soft radial overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					background: `
          radial-gradient(ellipse at 25% 30%, ${V.accent}0A, transparent 50%),
          radial-gradient(ellipse at 75% 70%, rgba(61,217,255,0.04), transparent 50%),
          radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(6,8,17,0.65) 80%)
        `,
					pointerEvents: "none",
				}}
			/>

			{/* Content */}
			<div
				style={{
					position: "relative",
					zIndex: 2,
					display: "flex",
					flexDirection: "column",
					height: "100%",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "12px 20px 0",
					}}
				>
					<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
						<h1
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 16,
								fontWeight: 800,
								letterSpacing: "0.06em",
								color: V.textPrimary,
								margin: 0,
							}}
						>
							RESEARCH
						</h1>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: V.accent,
								letterSpacing: "0.10em",
							}}
						>
							{currentTab.label}
						</span>
					</div>
				</div>

				{/* Pill tabs */}
				<PillTabs
					activeKey={activeTab}
					onTabChange={(k) => {
						setActiveTab(k);
						setSelectedNode(null);
					}}
				/>

				{/* Three-column layout */}
				<div
					style={{
						flex: 1,
						display: "flex",
						overflow: "hidden",
						padding: "0 16px 16px",
						gap: 12,
					}}
				>
					{/* Left: Queue + Economy */}
					<div
						style={{
							width: 240,
							flexShrink: 0,
							borderRadius: 10,
							border: `1px solid ${V.glassStroke}`,
							background: V.glass,
							backdropFilter: "blur(14px)",
							overflow: "hidden",
						}}
					>
						<QueueEconomyPanel />
					</div>

					{/* Center: Tree */}
					<div
						style={{
							flex: 1,
							borderRadius: 10,
							overflow: "hidden",
							border: `1px solid ${V.glassStroke}`,
							background: "rgba(6,8,17,0.35)",
							backdropFilter: "blur(4px)",
						}}
					>
						<ReactFlowProvider>
							<TreeCanvas activeTab={activeTab} onNodeSelect={setSelectedNode} />
						</ReactFlowProvider>
					</div>

					{/* Right: Inspector */}
					<div
						style={{
							width: 250,
							flexShrink: 0,
							borderRadius: 10,
							border: `1px solid ${V.glassStroke}`,
							background: V.glass,
							backdropFilter: "blur(14px)",
							overflow: "hidden",
						}}
					>
						<NodeInspector node={selectedNode} />
					</div>
				</div>
			</div>

			<style>{`
        @keyframes neuralPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes neuralOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes neuralScan {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
		</div>
	);
}
