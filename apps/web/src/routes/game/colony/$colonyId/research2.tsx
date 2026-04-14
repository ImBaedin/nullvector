/**
 * Research Mockup 2 — "War Room"
 *
 * Direction: Military Systems tab active. Aggressive, angular war-room
 * aesthetic. Deep crimson dither background. Emphasizes the prerequisite
 * chain flow, the researching-in-progress state with animated edges,
 * and a bottom-docked queue + meta-matter economy bar. The detail panel
 * is an expandable overlay card that floats over the tree.
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
	MILITARY_SYSTEMS_NODES,
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

export const Route = createFileRoute("/game/colony/$colonyId/research2")({
	component: Research2,
});

/* ── Palette — crimson war-room ───────────────────────────────────────────── */

const MILITARY_TAB = RESEARCH_TABS[1]!;

const P = {
	accent: MILITARY_TAB.themeColor,
	accentDim: "rgba(255,111,136,0.35)",
	bg: "#070a10",
	glass: "rgba(14,8,16,0.78)",
	glassStroke: "rgba(255,111,136,0.18)",
	textPrimary: "#fff0f3",
	textSecondary: "#d4a0ad",
	textMuted: "#8a6575",
	edgeLit: "rgba(255,111,136,0.55)",
	edgeDim: "rgba(255,111,136,0.12)",
	edgePulse: "#ffd166",
	nodeCompleted: { fill: "rgba(255,111,136,0.16)", stroke: "#ff6f88" },
	nodeAvailable: { fill: "rgba(61,217,255,0.08)", stroke: "#3dd9ff" },
	nodeLocked: { fill: "rgba(60,40,55,0.30)", stroke: "rgba(140,100,120,0.25)" },
	nodeResearching: { fill: "rgba(255,209,102,0.12)", stroke: "#ffd166" },
	capstone: { fill: "rgba(255,111,136,0.08)", stroke: "#ff6f88" },
};

/* ── Status utils ─────────────────────────────────────────────────────────── */

function sc(status: NodeStatus, isCap: boolean) {
	if (isCap) return { ...P.capstone, op: status === "locked" ? 0.4 : 1 };
	switch (status) {
		case "completed":
			return { ...P.nodeCompleted, op: 1 };
		case "available":
			return { ...P.nodeAvailable, op: 1 };
		case "researching":
			return { ...P.nodeResearching, op: 1 };
		default:
			return { ...P.nodeLocked, op: 0.5 };
	}
}

/* ── Custom nodes — angular, war-room feel ────────────────────────────────── */

function MilCircle({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const isActive = d.status === "researching";
	return (
		<div style={{ position: "relative", width: 80, height: 80 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{/* Outer ring for active */}
			{isActive && (
				<div
					style={{
						position: "absolute",
						inset: -4,
						borderRadius: "50%",
						border: `1.5px solid ${P.edgePulse}44`,
						animation: "warPulse 2s ease-in-out infinite",
					}}
				/>
			)}
			<div
				style={{
					width: 80,
					height: 80,
					borderRadius: "50%",
					border: `2px solid ${c.stroke}`,
					background: `radial-gradient(circle at 35% 35%, ${c.fill}, rgba(7,10,16,0.6))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow:
						d.status === "completed"
							? `0 0 22px ${c.stroke}33, inset 0 0 12px ${c.stroke}22`
							: isActive
								? `0 0 18px ${P.edgePulse}33`
								: "none",
				}}
			>
				{/* rank pips */}
				{d.maxLevel > 1 && (
					<div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
						{Array.from({ length: d.maxLevel }).map((_, i) => (
							<div
								key={i}
								style={{
									width: 5,
									height: 5,
									borderRadius: 1,
									background: i < d.level ? c.stroke : `${c.stroke}33`,
									transform: "rotate(45deg)",
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
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.15,
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

function MilHex({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const clip = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
	return (
		<div style={{ position: "relative", width: 90, height: 90 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 90,
					height: 90,
					clipPath: clip,
					background: `linear-gradient(160deg, ${c.fill}, rgba(7,10,16,0.5))`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					position: "relative",
				}}
			>
				{/* inner hex border effect */}
				<div
					style={{
						position: "absolute",
						inset: 2,
						clipPath: clip,
						border: `1.5px solid ${c.stroke}`,
						background: c.fill,
					}}
				/>
				<div
					style={{
						position: "relative",
						zIndex: 1,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 3,
					}}
				>
					{/* Unlock icon placeholder */}
					<div
						style={{
							width: 14,
							height: 14,
							borderRadius: 2,
							border: `1px solid ${c.stroke}66`,
							background: `${c.stroke}22`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<span style={{ fontSize: 8, color: c.stroke }}>⬡</span>
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
							padding: "0 12px",
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

function MilSquare({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	return (
		<div style={{ position: "relative", width: 84, height: 84 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			<div
				style={{
					width: 84,
					height: 84,
					borderRadius: 4,
					border: `2px solid ${c.stroke}`,
					background: `linear-gradient(145deg, ${c.fill}, rgba(7,10,16,0.5))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					// diagonal corner cut effect via clip-path
					clipPath:
						"polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
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

function MilCapstone({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, true);
	return (
		<div style={{ position: "relative", width: 120, height: 120 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{/* Animated outer border ring */}
			<div
				style={{
					position: "absolute",
					inset: -6,
					borderRadius: 14,
					border: `1px solid ${c.stroke}22`,
					animation: "warCapRotate 8s linear infinite",
					backgroundImage: `conic-gradient(from 0deg, ${c.stroke}00, ${c.stroke}44, ${c.stroke}00)`,
					WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
					WebkitMaskComposite: "xor",
					maskComposite: "exclude",
					padding: 1,
				}}
			/>
			<div
				style={{
					width: 120,
					height: 120,
					borderRadius: 12,
					border: `2px solid ${c.stroke}`,
					background: `linear-gradient(150deg, ${c.fill}, rgba(14,8,16,0.7) 60%, ${c.fill})`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: `0 0 40px ${c.stroke}18, inset 0 0 20px ${c.stroke}11`,
				}}
			>
				{/* Decorative corner marks */}
				{[
					{ top: 6, left: 6 },
					{ top: 6, right: 6 },
					{ bottom: 6, left: 6 },
					{ bottom: 6, right: 6 },
				].map((pos, i) => (
					<div
						key={i}
						style={
							{
								position: "absolute",
								...pos,
								width: 8,
								height: 8,
								borderTop: i < 2 ? `1.5px solid ${c.stroke}55` : undefined,
								borderBottom: i >= 2 ? `1.5px solid ${c.stroke}55` : undefined,
								borderLeft: i % 2 === 0 ? `1.5px solid ${c.stroke}55` : undefined,
								borderRight: i % 2 === 1 ? `1.5px solid ${c.stroke}55` : undefined,
							} as any
						}
					/>
				))}
				<div
					style={{
						width: 10,
						height: 10,
						borderRadius: 2,
						background: c.stroke,
						marginBottom: 6,
						opacity: 0.7,
						boxShadow: `0 0 12px ${c.stroke}`,
						transform: "rotate(45deg)",
					}}
				/>
				<span
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 9,
						fontWeight: 700,
						color: c.stroke,
						letterSpacing: "0.12em",
						textTransform: "uppercase",
						textAlign: "center",
						lineHeight: 1.3,
						padding: "0 10px",
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
	circle: MilCircle,
	hex: MilHex,
	square: MilSquare,
	capstone: MilCapstone,
};

/* ── Build flow data ──────────────────────────────────────────────────────── */

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
			const both = pre?.status === "completed";
			edges.push({
				id: `${preId}-${n.id}`,
				source: preId,
				target: n.id,
				type: "default",
				animated: n.status === "researching",
				style: {
					stroke: both ? P.edgeLit : n.status === "locked" ? P.edgeDim : "rgba(61,217,255,0.30)",
					strokeWidth: both ? 2.5 : 1.5,
					strokeDasharray: n.status === "locked" ? "4 6" : undefined,
				},
			});
		}
	}
	return { nodes, edges };
}

/* ── Floating detail card ─────────────────────────────────────────────────── */

function FloatingDetailCard({ node, onClose }: { node: MockResearchNode; onClose: () => void }) {
	const c = sc(node.status, node.shape === "capstone");

	return (
		<div
			style={{
				position: "absolute",
				top: 20,
				left: "50%",
				transform: "translateX(-50%)",
				width: 420,
				maxWidth: "calc(100% - 40px)",
				zIndex: 20,
				borderRadius: 12,
				border: `1px solid ${c.stroke}44`,
				background: P.glass,
				backdropFilter: "blur(20px)",
				boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${c.stroke}11`,
				overflow: "hidden",
				animation: "slideDown 0.25s cubic-bezier(0.21, 1, 0.34, 1)",
			}}
		>
			{/* Top accent bar */}
			<div
				style={{
					height: 3,
					background: `linear-gradient(90deg, transparent, ${c.stroke}, transparent)`,
					opacity: 0.6,
				}}
			/>

			<div style={{ padding: "16px 20px 20px" }}>
				{/* Header row */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						marginBottom: 10,
					}}
				>
					<div>
						<h3
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 15,
								fontWeight: 700,
								color: P.textPrimary,
								margin: 0,
								letterSpacing: "0.02em",
							}}
						>
							{node.name}
						</h3>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginTop: 4,
							}}
						>
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
									fontSize: 9,
									color: P.textMuted,
								}}
							>
								Tier {node.tier}
							</span>
							{node.maxLevel > 1 && (
								<span
									style={{
										fontFamily: "var(--nv-font-mono)",
										fontSize: 9,
										color: P.textMuted,
									}}
								>
									Lv {node.level}/{node.maxLevel}
								</span>
							)}
						</div>
					</div>
					<button
						onClick={onClose}
						style={{
							width: 28,
							height: 28,
							borderRadius: 6,
							border: `1px solid ${P.glassStroke}`,
							background: "rgba(255,255,255,0.04)",
							color: P.textMuted,
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 14,
						}}
					>
						✕
					</button>
				</div>

				{/* Description */}
				<p
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 12,
						lineHeight: 1.65,
						color: node.status === "locked" ? P.textMuted : P.textSecondary,
						margin: "0 0 14px",
						filter: node.status === "locked" ? "blur(2px)" : undefined,
					}}
				>
					{node.description}
				</p>

				{/* Effects + Costs in columns */}
				<div style={{ display: "flex", gap: 16 }}>
					{/* Effects */}
					<div style={{ flex: 1 }}>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: P.textMuted,
								letterSpacing: "0.16em",
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
										borderRadius: 3,
										background: `${fx.startsWith("Unlock") ? "rgba(100,248,187,0.06)" : "rgba(255,111,136,0.06)"}`,
										borderLeft: `2px solid ${fx.startsWith("Unlock") ? "#64f8bb" : c.stroke}44`,
									}}
								>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 10,
											color: fx.startsWith("Unlock") ? "#64f8bb" : P.textPrimary,
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
					<div style={{ flex: 1 }}>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: P.textMuted,
								letterSpacing: "0.16em",
								textTransform: "uppercase",
							}}
						>
							Cost
						</span>
						<div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
							{Object.entries(node.costs.metaMatter).map(([rarity, amt]) => (
								<div
									key={rarity}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 6,
										padding: "3px 8px",
										borderRadius: 3,
										background: "rgba(255,255,255,0.03)",
									}}
								>
									<div
										style={{
											width: 5,
											height: 5,
											borderRadius: rarity === "mythic" ? 1 : "50%",
											background: META_MATTER_COLORS[rarity as keyof typeof META_MATTER_COLORS],
											transform: rarity === "mythic" ? "rotate(45deg)" : undefined,
										}}
									/>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 10,
											color: META_MATTER_COLORS[rarity as keyof typeof META_MATTER_COLORS],
										}}
									>
										{(amt as number).toLocaleString()}
									</span>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 8,
											color: P.textMuted,
											textTransform: "uppercase",
										}}
									>
										{rarity}
									</span>
								</div>
							))}
							{node.costs.resources &&
								Object.entries(node.costs.resources).map(([res, amt]) => (
									<div
										key={res}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											padding: "3px 8px",
											borderRadius: 3,
											background: "rgba(255,255,255,0.03)",
										}}
									>
										<div
											style={{
												width: 5,
												height: 5,
												borderRadius: "50%",
												background:
													res === "alloy" ? "#ff914f" : res === "crystal" ? "#6ecbff" : "#ffd166",
											}}
										/>
										<span
											style={{
												fontFamily: "var(--nv-font-mono)",
												fontSize: 10,
												color: P.textSecondary,
											}}
										>
											{formatResourceCount(amt as number)}
										</span>
										<span
											style={{
												fontFamily: "var(--nv-font-mono)",
												fontSize: 8,
												color: P.textMuted,
												textTransform: "capitalize",
											}}
										>
											{res}
										</span>
									</div>
								))}
						</div>
						<div style={{ marginTop: 8, padding: "4px 8px" }}>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 9,
									color: P.textMuted,
								}}
							>
								⏱ {formatDuration(node.costs.seconds)}
							</span>
						</div>
					</div>
				</div>

				{/* Action bar */}
				{node.status === "available" && (
					<div style={{ marginTop: 16, display: "flex", gap: 8 }}>
						<button
							style={{
								flex: 1,
								padding: "10px 0",
								borderRadius: 6,
								border: `1px solid ${P.accent}66`,
								background: `linear-gradient(170deg, ${P.accent}44, ${P.accent}18)`,
								color: "#fff",
								fontFamily: "var(--nv-font-body)",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
								letterSpacing: "0.08em",
								textTransform: "uppercase",
							}}
						>
							Begin Research
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

/* ── Bottom economy bar ───────────────────────────────────────────────────── */

function EconomyBar() {
	const pct = 75;
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "10px 20px",
				borderTop: `1px solid ${P.glassStroke}`,
				background: P.glass,
				backdropFilter: "blur(14px)",
			}}
		>
			{/* Left: active research */}
			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				<div
					style={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						background: P.edgePulse,
						boxShadow: `0 0 10px ${P.edgePulse}`,
						animation: "warPulse 2s ease-in-out infinite",
					}}
				/>
				<div>
					<span
						style={{
							fontFamily: "var(--nv-font-body)",
							fontSize: 11,
							fontWeight: 600,
							color: P.textPrimary,
						}}
					>
						{ACTIVE_RESEARCH.nodeName}
					</span>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: P.textMuted,
							marginLeft: 8,
						}}
					>
						from {ACTIVE_RESEARCH.originColony}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginLeft: 12,
					}}
				>
					<div
						style={{
							width: 140,
							height: 5,
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
								background: `linear-gradient(90deg, ${P.edgePulse}88, ${P.edgePulse})`,
								position: "relative",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									position: "absolute",
									inset: 0,
									background:
										"linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
									animation: "warScan 2s ease-in-out infinite",
								}}
							/>
						</div>
					</div>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 10,
							color: P.edgePulse,
						}}
					>
						15:00
					</span>
				</div>
			</div>

			{/* Right: meta-matter balances */}
			<div style={{ display: "flex", gap: 16 }}>
				{(["common", "rare", "mythic"] as const).map((r) => (
					<div key={r} style={{ display: "flex", alignItems: "center", gap: 5 }}>
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: r === "mythic" ? 1.5 : "50%",
								background: META_MATTER_COLORS[r],
								boxShadow: `0 0 6px ${META_MATTER_COLORS[r]}66`,
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
		</div>
	);
}

/* ── Tab bar — angular war-room style ─────────────────────────────────────── */

function WarRoomTabs({
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
				gap: 0,
				padding: "0 20px",
				background: "rgba(14,8,16,0.5)",
				borderBottom: `1px solid ${P.glassStroke}`,
			}}
		>
			{RESEARCH_TABS.map((tab) => {
				const active = tab.key === activeKey;
				return (
					<button
						key={tab.key}
						onClick={() => onTabChange(tab.key)}
						style={{
							padding: "10px 20px",
							background: active
								? `linear-gradient(180deg, ${tab.themeColor}14, transparent)`
								: "transparent",
							color: active ? tab.themeColor : P.textMuted,
							fontFamily: "var(--nv-font-display)",
							fontSize: 10,
							fontWeight: active ? 700 : 500,
							letterSpacing: "0.18em",
							textTransform: "uppercase",
							cursor: "pointer",
							border: "none",
							borderBottom: active ? `2px solid ${tab.themeColor}` : "2px solid transparent",
							position: "relative",
							transition: "all 0.2s",
						}}
					>
						{tab.shortLabel}
						{active && (
							<div
								style={{
									position: "absolute",
									bottom: 0,
									left: "20%",
									right: "20%",
									height: 1,
									background: tab.themeColor,
									boxShadow: `0 0 8px ${tab.themeColor}`,
								}}
							/>
						)}
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

	const handleNodeClick = useCallback(
		(_: any, node: Node) => {
			const found = mockNodes.find((n) => n.id === node.id);
			onNodeSelect(found ?? null);
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
			fitViewOptions={{ padding: 0.35 }}
			minZoom={0.25}
			maxZoom={1.8}
			proOptions={{ hideAttribution: true }}
			panOnScroll
			zoomOnScroll
			style={{ width: "100%", height: "100%" }}
		>
			<Background color="rgba(255,111,136,0.04)" gap={40} size={1} />
		</ReactFlow>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research2() {
	const [activeTab, setActiveTab] = useState<ResearchBranchKey>("military_systems");
	const [selectedNode, setSelectedNode] = useState<MockResearchNode | null>(null);

	const currentTab = RESEARCH_TABS.find((t) => t.key === activeTab) ?? MILITARY_TAB;

	return (
		<div
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: P.bg,
				fontFamily: "var(--nv-font-body)",
				color: P.textPrimary,
			}}
		>
			{/* Dither */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					opacity: 0.3,
				}}
			>
				<IsolatedDither
					waveSpeed={0.04}
					waveFrequency={3}
					waveAmplitude={0.3}
					waveColor={currentTab.ditherWaveColor}
					colorNum={3}
					pixelSize={currentTab.ditherPixelSize}
					enableMouseInteraction={false}
				/>
			</div>

			{/* Dark vignette */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					background:
						"radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(7,10,16,0.75) 80%)",
					pointerEvents: "none",
				}}
			/>

			{/* Scan-line overlay for war-room feel */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					backgroundImage:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
					pointerEvents: "none",
					opacity: 0.4,
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
						padding: "14px 20px 0",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<div
							style={{
								width: 3,
								height: 24,
								background: currentTab.themeColor,
								borderRadius: 1,
								boxShadow: `0 0 8px ${currentTab.themeColor}66`,
							}}
						/>
						<h1
							style={{
								fontFamily: "var(--nv-font-display)",
								fontSize: 16,
								fontWeight: 800,
								letterSpacing: "0.16em",
								color: P.textPrimary,
								margin: 0,
								textTransform: "uppercase",
							}}
						>
							Research
						</h1>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: currentTab.themeColor,
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								opacity: 0.8,
							}}
						>
							{currentTab.label}
						</span>
					</div>
					<div
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 10,
							color: P.textMuted,
							letterSpacing: "0.08em",
						}}
					>
						Aegis Prime — 2 Research Sites
					</div>
				</div>

				{/* Tabs */}
				<div style={{ marginTop: 10 }}>
					<WarRoomTabs
						activeKey={activeTab}
						onTabChange={(k) => {
							setActiveTab(k);
							setSelectedNode(null);
						}}
					/>
				</div>

				{/* Tree area */}
				<div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					<ReactFlowProvider>
						<TreeCanvas activeTab={activeTab} onNodeSelect={setSelectedNode} />
					</ReactFlowProvider>

					{/* Floating detail */}
					{selectedNode && (
						<FloatingDetailCard node={selectedNode} onClose={() => setSelectedNode(null)} />
					)}
				</div>

				{/* Bottom economy bar */}
				<EconomyBar />
			</div>

			{/* Keyframes */}
			<style>{`
        @keyframes warPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes warCapRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes warScan {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
		</div>
	);
}
