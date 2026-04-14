/**
 * Research Mockup 4 — "Frontier Atlas"
 *
 * Direction: Expansion & Logistics tab. Deep emerald-gold cartographic
 * aesthetic — star-map atlas feel. Emphasizes the exploration/discovery
 * pattern: locked nodes appear as veiled silhouettes with hidden info,
 * creating a fog-of-war research experience. Full-width immersive tree
 * with a slide-up drawer for node details. Combined research capacity
 * display prominent. Tab selection as a vertical sidebar selector.
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
import { useState, useMemo } from "react";

import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	RESEARCH_TABS,
	EXPANSION_LOGISTICS_NODES,
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

export const Route = createFileRoute("/game/colony/$colonyId/research4")({
	component: Research4,
});

/* ── Palette — emerald cartography ────────────────────────────────────────── */

const EXP_TAB = RESEARCH_TABS[3]!;

const G = {
	accent: EXP_TAB.themeColor,
	accentDim: "rgba(100,248,187,0.20)",
	gold: "#ffd166",
	goldDim: "rgba(255,209,102,0.15)",
	bg: "#050c0a",
	glass: "rgba(8,18,14,0.78)",
	glassStroke: "rgba(100,248,187,0.14)",
	textPrimary: "#ecfff6",
	textSecondary: "#a8d4c0",
	textMuted: "#5f8a78",
	nodeCompleted: { fill: "rgba(100,248,187,0.16)", stroke: "#64f8bb" },
	nodeAvailable: { fill: "rgba(255,209,102,0.08)", stroke: "#ffd166" },
	nodeLocked: { fill: "rgba(30,50,40,0.30)", stroke: "rgba(95,138,120,0.20)" },
	nodeResearching: { fill: "rgba(61,217,255,0.08)", stroke: "#3dd9ff" },
	capstone: { fill: "rgba(100,248,187,0.06)", stroke: "#64f8bb" },
	edgeLit: "rgba(100,248,187,0.45)",
	edgeDim: "rgba(95,138,120,0.12)",
};

function sc(status: NodeStatus, isCap: boolean) {
	if (isCap) return { ...G.capstone, op: status === "locked" ? 0.3 : 1 };
	switch (status) {
		case "completed":
			return { ...G.nodeCompleted, op: 1 };
		case "available":
			return { ...G.nodeAvailable, op: 1 };
		case "researching":
			return { ...G.nodeResearching, op: 1 };
		default:
			return { ...G.nodeLocked, op: 0.35 };
	}
}

/* ── Custom nodes — cartographic style ────────────────────────────────────── */

function AtlasCircle({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const isLocked = d.status === "locked";
	return (
		<div style={{ position: "relative", width: 78, height: 78 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{/* Fog overlay for locked */}
			{isLocked && (
				<div
					style={{
						position: "absolute",
						inset: -4,
						borderRadius: "50%",
						background: "radial-gradient(circle, rgba(30,50,40,0.6), rgba(5,12,10,0.4))",
						backdropFilter: "blur(3px)",
						zIndex: 1,
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
							border: `1px dashed ${G.textMuted}44`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<span style={{ fontSize: 8, color: G.textMuted, opacity: 0.6 }}>?</span>
					</div>
				</div>
			)}
			<div
				style={{
					width: 78,
					height: 78,
					borderRadius: "50%",
					border: `1.5px solid ${c.stroke}`,
					background: `radial-gradient(circle at 35% 30%, ${c.fill}, rgba(5,12,10,0.6))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 22px ${c.stroke}33` : "none",
				}}
			>
				{d.maxLevel > 1 && !isLocked && (
					<div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
						{Array.from({ length: d.maxLevel }).map((_, i) => (
							<div
								key={i}
								style={{
									width: 4,
									height: 4,
									borderRadius: "50%",
									background: i < d.level ? c.stroke : `${c.stroke}33`,
								}}
							/>
						))}
					</div>
				)}
				{!isLocked && (
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
				)}
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function AtlasHex({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const isLocked = d.status === "locked";
	const clip = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

	return (
		<div style={{ position: "relative", width: 88, height: 88 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{isLocked && (
				<div
					style={{
						position: "absolute",
						inset: -2,
						clipPath: clip,
						background: "rgba(30,50,40,0.5)",
						backdropFilter: "blur(3px)",
						zIndex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<span style={{ fontSize: 8, color: G.textMuted, opacity: 0.5 }}>◇</span>
				</div>
			)}
			<div
				style={{
					width: 88,
					height: 88,
					clipPath: clip,
					background: `linear-gradient(160deg, ${c.fill}, rgba(5,12,10,0.5))`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
				}}
			>
				<div
					style={{
						width: 82,
						height: 82,
						clipPath: clip,
						border: `1.5px solid ${c.stroke}`,
						background: c.fill,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{!isLocked && (
						<>
							<div
								style={{
									width: 12,
									height: 12,
									borderRadius: 2,
									border: `1px solid ${c.stroke}66`,
									background: `${c.stroke}22`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									marginBottom: 3,
								}}
							>
								<span style={{ fontSize: 7, color: c.stroke }}>★</span>
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
						</>
					)}
				</div>
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function AtlasSquare({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, false);
	const isLocked = d.status === "locked";
	return (
		<div style={{ position: "relative", width: 82, height: 82 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
			{isLocked && (
				<div
					style={{
						position: "absolute",
						inset: -2,
						borderRadius: 8,
						background: "rgba(30,50,40,0.55)",
						backdropFilter: "blur(3px)",
						zIndex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div
						style={{
							width: 14,
							height: 14,
							borderRadius: 3,
							border: `1px dashed ${G.textMuted}44`,
						}}
					/>
				</div>
			)}
			<div
				style={{
					width: 82,
					height: 82,
					borderRadius: 6,
					border: `1.5px solid ${c.stroke}`,
					background: `linear-gradient(145deg, ${c.fill}, rgba(5,12,10,0.5))`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					opacity: c.op,
					cursor: "pointer",
					boxShadow: d.status === "completed" ? `0 0 16px ${c.stroke}22` : "none",
				}}
			>
				{!isLocked && (
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
				)}
			</div>
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

function AtlasCapstone({ data }: NodeProps) {
	const d = data as unknown as MockResearchNode;
	const c = sc(d.status, true);
	const isLocked = d.status === "locked";
	return (
		<div style={{ position: "relative", width: 130, height: 130 }}>
			<Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

			{/* Concentric rings */}
			<div
				style={{
					position: "absolute",
					inset: -14,
					borderRadius: "50%",
					border: `1px solid ${c.stroke}11`,
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: -8,
					borderRadius: "50%",
					border: `1px dashed ${c.stroke}18`,
					animation: isLocked ? undefined : "atlasRing 15s linear infinite",
				}}
			/>

			{isLocked ? (
				<div
					style={{
						width: 130,
						height: 130,
						borderRadius: "50%",
						border: `2px dashed ${c.stroke}22`,
						background: "rgba(30,50,40,0.4)",
						backdropFilter: "blur(4px)",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						opacity: c.op,
						cursor: "pointer",
					}}
				>
					<div
						style={{
							width: 24,
							height: 24,
							borderRadius: "50%",
							border: `1px dashed ${G.textMuted}33`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							marginBottom: 6,
						}}
					>
						<span style={{ fontSize: 10, color: G.textMuted, opacity: 0.5 }}>◈</span>
					</div>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 8,
							color: G.textMuted,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							opacity: 0.6,
						}}
					>
						CLASSIFIED
					</span>
				</div>
			) : (
				<div
					style={{
						width: 130,
						height: 130,
						borderRadius: "50%",
						border: `2px solid ${c.stroke}`,
						background: `radial-gradient(circle at 40% 35%, ${c.fill}, rgba(5,12,10,0.5) 70%)`,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						opacity: c.op,
						cursor: "pointer",
						boxShadow: `0 0 50px ${c.stroke}18`,
					}}
				>
					<div
						style={{
							width: 18,
							height: 18,
							borderRadius: "50%",
							border: `1.5px solid ${c.stroke}`,
							background: `radial-gradient(circle, ${c.stroke}55, transparent)`,
							marginBottom: 8,
							boxShadow: `0 0 12px ${c.stroke}66`,
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-display)",
							fontSize: 9,
							fontWeight: 700,
							color: c.stroke,
							letterSpacing: "0.10em",
							textTransform: "uppercase",
							textAlign: "center",
							lineHeight: 1.3,
							padding: "0 16px",
						}}
					>
						{d.name}
					</span>
				</div>
			)}
			<Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
		</div>
	);
}

const nodeTypes = {
	circle: AtlasCircle,
	hex: AtlasHex,
	square: AtlasSquare,
	capstone: AtlasCapstone,
};

/* ── Flow data ────────────────────────────────────────────────────────────── */

function buildFlowData(mockNodes: MockResearchNode[]) {
	const nodes: Node[] = mockNodes.map((n) => ({
		id: n.id,
		type: n.shape,
		position: { x: n.position.x + 300, y: n.position.y + 300 },
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
					stroke: lit ? G.edgeLit : G.edgeDim,
					strokeWidth: lit ? 2 : 1,
					strokeDasharray: n.status === "locked" ? "2 6" : undefined,
					opacity: n.status === "locked" ? 0.4 : 1,
				},
			});
		}
	}
	return { nodes, edges };
}

/* ── Vertical sidebar tab selector ────────────────────────────────────────── */

function VerticalTabSelector({
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
				flexDirection: "column",
				gap: 2,
				padding: "12px 6px",
			}}
		>
			{RESEARCH_TABS.map((tab) => {
				const active = tab.key === activeKey;
				return (
					<button
						key={tab.key}
						onClick={() => onTabChange(tab.key)}
						style={{
							width: 56,
							padding: "10px 4px",
							borderRadius: 8,
							border: active ? `1px solid ${tab.themeColor}44` : `1px solid transparent`,
							background: active ? `${tab.themeColor}14` : "transparent",
							color: active ? tab.themeColor : G.textMuted,
							fontFamily: "var(--nv-font-mono)",
							fontSize: 7,
							fontWeight: active ? 600 : 400,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							cursor: "pointer",
							transition: "all 0.25s",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 4,
							lineHeight: 1.2,
							textAlign: "center",
						}}
					>
						<div
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								background: active ? tab.themeColor : `${tab.themeColor}44`,
								boxShadow: active ? `0 0 8px ${tab.themeColor}66` : "none",
								transition: "all 0.25s",
							}}
						/>
						{tab.shortLabel}
					</button>
				);
			})}
		</div>
	);
}

/* ── Slide-up drawer ──────────────────────────────────────────────────────── */

function SlideUpDrawer({ node, onClose }: { node: MockResearchNode; onClose: () => void }) {
	const c = sc(node.status, node.shape === "capstone");
	const isLocked = node.status === "locked";

	return (
		<div
			style={{
				position: "absolute",
				bottom: 0,
				left: 64,
				right: 0,
				zIndex: 20,
				animation: "drawerUp 0.3s cubic-bezier(0.21, 1, 0.34, 1)",
			}}
		>
			{/* Handle bar */}
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "8px 0 0",
				}}
			>
				<button
					onClick={onClose}
					style={{
						width: 48,
						height: 4,
						borderRadius: 2,
						background: G.textMuted,
						opacity: 0.4,
						cursor: "pointer",
						border: "none",
					}}
				/>
			</div>

			<div
				style={{
					padding: "12px 24px 24px",
					background: G.glass,
					borderTop: `1px solid ${c.stroke}33`,
					backdropFilter: "blur(20px)",
					boxShadow: `0 -10px 40px rgba(0,0,0,0.5), 0 0 30px ${c.stroke}08`,
				}}
			>
				{/* Top row */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						marginBottom: 12,
					}}
				>
					<div style={{ flex: 1 }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								marginBottom: 4,
							}}
						>
							<div
								style={{
									width: 12,
									height: 12,
									borderRadius: "50%",
									background: c.stroke,
									boxShadow: `0 0 10px ${c.stroke}66`,
								}}
							/>
							<h3
								style={{
									fontFamily: "var(--nv-font-display)",
									fontSize: 16,
									fontWeight: 700,
									color: isLocked ? G.textMuted : G.textPrimary,
									margin: 0,
								}}
							>
								{isLocked ? "Classified Research" : node.name}
							</h3>
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
						</div>
						<p
							style={{
								fontFamily: "var(--nv-font-body)",
								fontSize: 12,
								lineHeight: 1.6,
								color: isLocked ? G.textMuted : G.textSecondary,
								margin: 0,
								maxWidth: 500,
								filter: isLocked ? "blur(3px)" : undefined,
								userSelect: isLocked ? "none" : undefined,
							}}
						>
							{node.description}
						</p>
					</div>

					{node.status === "available" && (
						<button
							style={{
								padding: "10px 24px",
								borderRadius: 8,
								border: `1px solid ${G.gold}55`,
								background: `linear-gradient(170deg, ${G.gold}33, ${G.gold}11)`,
								color: "#fff",
								fontFamily: "var(--nv-font-body)",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
								letterSpacing: "0.08em",
								textTransform: "uppercase",
								flexShrink: 0,
							}}
						>
							Begin Research
						</button>
					)}
				</div>

				{/* Detail grid */}
				{!isLocked && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 16,
						}}
					>
						{/* Effects */}
						<div>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 8,
									color: G.textMuted,
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
											borderLeft: `2px solid ${fx.startsWith("Unlock") || fx.startsWith("Enable") ? G.accent : G.gold}44`,
											background: "rgba(255,255,255,0.02)",
										}}
									>
										<span
											style={{
												fontFamily: "var(--nv-font-mono)",
												fontSize: 10,
												color:
													fx.startsWith("Unlock") || fx.startsWith("Enable")
														? G.accent
														: G.textPrimary,
											}}
										>
											{fx}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Cost */}
						<div>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 8,
									color: G.textMuted,
									letterSpacing: "0.16em",
									textTransform: "uppercase",
								}}
							>
								Cost
							</span>
							<div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
								{Object.entries(node.costs.metaMatter).map(([r, amt]) => (
									<div
										key={r}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											padding: "3px 8px",
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
												fontSize: 10,
												color: META_MATTER_COLORS[r as keyof typeof META_MATTER_COLORS],
											}}
										>
											{(amt as number).toLocaleString()}
										</span>
										<span
											style={{
												fontFamily: "var(--nv-font-mono)",
												fontSize: 8,
												color: G.textMuted,
												textTransform: "uppercase",
											}}
										>
											{r}
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
												background: "rgba(255,255,255,0.02)",
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
													color: G.textSecondary,
												}}
											>
												{formatResourceCount(amt as number)}
											</span>
											<span
												style={{
													fontFamily: "var(--nv-font-mono)",
													fontSize: 8,
													color: G.textMuted,
													textTransform: "capitalize",
												}}
											>
												{res}
											</span>
										</div>
									))}
							</div>
						</div>

						{/* Requirements + metadata */}
						<div>
							<span
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 8,
									color: G.textMuted,
									letterSpacing: "0.16em",
									textTransform: "uppercase",
								}}
							>
								Requirements
							</span>
							<div
								style={{
									marginTop: 6,
									display: "flex",
									flexDirection: "column",
									gap: 4,
								}}
							>
								<div
									style={{
										padding: "4px 8px",
										borderRadius: 3,
										background: "rgba(255,255,255,0.02)",
										border: `1px solid ${G.glassStroke}`,
									}}
								>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 9,
											color: G.textSecondary,
										}}
									>
										Research Sites {node.requiredResearchFacilityLevel}
									</span>
								</div>
								{node.prerequisites.length > 0 && (
									<div
										style={{
											padding: "4px 8px",
											borderRadius: 3,
											background: "rgba(255,255,255,0.02)",
											border: `1px solid ${G.glassStroke}`,
										}}
									>
										<span
											style={{
												fontFamily: "var(--nv-font-mono)",
												fontSize: 9,
												color: G.textSecondary,
											}}
										>
											{node.prerequisites.length} prerequisite
											{node.prerequisites.length > 1 ? "s" : ""}
										</span>
									</div>
								)}
								<div
									style={{
										padding: "4px 8px",
										borderRadius: 3,
										background: "rgba(255,255,255,0.02)",
									}}
								>
									<span
										style={{
											fontFamily: "var(--nv-font-mono)",
											fontSize: 9,
											color: G.textMuted,
										}}
									>
										⏱ {formatDuration(node.costs.seconds)}
									</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Locked state */}
				{isLocked && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							padding: "12px 16px",
							borderRadius: 8,
							background: "rgba(95,138,120,0.06)",
							border: `1px dashed ${G.textMuted}33`,
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 10,
								color: G.textMuted,
							}}
						>
							Complete prerequisites to reveal this research node. Requires Research Sites{" "}
							{node.requiredResearchFacilityLevel}.
						</span>
					</div>
				)}
			</div>
		</div>
	);
}

/* ── Top HUD overlay ──────────────────────────────────────────────────────── */

function TopHUD({ activeTab }: { activeTab: ResearchBranchKey }) {
	const tab = RESEARCH_TABS.find((t) => t.key === activeTab) ?? EXP_TAB;
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 64,
				right: 0,
				zIndex: 10,
				display: "flex",
				justifyContent: "space-between",
				alignItems: "flex-start",
				padding: "14px 20px",
				pointerEvents: "none",
			}}
		>
			{/* Left: title + branch */}
			<div style={{ pointerEvents: "auto" }}>
				<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
					<h1
						style={{
							fontFamily: "var(--nv-font-display)",
							fontSize: 18,
							fontWeight: 800,
							letterSpacing: "0.06em",
							color: G.textPrimary,
							margin: 0,
							textShadow: `0 0 20px ${tab.themeColor}33`,
						}}
					>
						RESEARCH
					</h1>
					<div
						style={{
							height: 16,
							width: 1,
							background: G.textMuted,
							opacity: 0.3,
						}}
					/>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 10,
							color: tab.themeColor,
							letterSpacing: "0.10em",
							textTransform: "uppercase",
						}}
					>
						{tab.label}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						gap: 12,
						marginTop: 8,
					}}
				>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: G.textMuted,
						}}
					>
						Aegis Prime — 2 Research Sites
					</span>
					<span
						style={{
							fontFamily: "var(--nv-font-mono)",
							fontSize: 9,
							color: G.accent,
						}}
					>
						Combined Capacity: 2 / 5
					</span>
				</div>
			</div>

			{/* Right: meta-matter balances */}
			<div
				style={{
					display: "flex",
					gap: 10,
					pointerEvents: "auto",
					padding: "8px 14px",
					borderRadius: 10,
					background: G.glass,
					border: `1px solid ${G.glassStroke}`,
					backdropFilter: "blur(10px)",
				}}
			>
				{(["common", "rare", "mythic"] as const).map((r) => (
					<div
						key={r}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
						}}
					>
						<div
							style={{
								width: 7,
								height: 7,
								borderRadius: r === "mythic" ? 2 : "50%",
								background: META_MATTER_COLORS[r],
								boxShadow: `0 0 6px ${META_MATTER_COLORS[r]}55`,
								transform: r === "mythic" ? "rotate(45deg)" : undefined,
							}}
						/>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 11,
								fontWeight: 500,
								color: META_MATTER_COLORS[r],
							}}
						>
							{META_MATTER_BALANCES[r].toLocaleString()}
						</span>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: G.textMuted,
								textTransform: "uppercase",
								letterSpacing: "0.08em",
							}}
						>
							{META_MATTER_LABELS[r]}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/* ── Active research floating badge ───────────────────────────────────────── */

function ActiveResearchBadge() {
	return (
		<div
			style={{
				position: "absolute",
				bottom: 16,
				left: 80,
				zIndex: 10,
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "8px 14px",
				borderRadius: 8,
				background: G.glass,
				border: "1px solid rgba(61,217,255,0.18)",
				backdropFilter: "blur(14px)",
			}}
		>
			<div
				style={{
					width: 6,
					height: 6,
					borderRadius: "50%",
					background: "#3dd9ff",
					boxShadow: "0 0 8px rgba(61,217,255,0.6)",
					animation: "atlasPulse 2s ease-in-out infinite",
				}}
			/>
			<span
				style={{
					fontFamily: "var(--nv-font-mono)",
					fontSize: 9,
					color: "#3dd9ff",
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
					fontWeight: 600,
					color: G.textPrimary,
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
						width: "75%",
						height: "100%",
						borderRadius: 2,
						background: "linear-gradient(90deg, rgba(61,217,255,0.5), #3dd9ff)",
					}}
				/>
			</div>
			<span
				style={{
					fontFamily: "var(--nv-font-mono)",
					fontSize: 9,
					color: G.textMuted,
				}}
			>
				15m
			</span>
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
			fitViewOptions={{ padding: 0.5 }}
			minZoom={0.25}
			maxZoom={1.8}
			proOptions={{ hideAttribution: true }}
			panOnScroll
			zoomOnScroll
			style={{ width: "100%", height: "100%" }}
		>
			<Background color="rgba(100,248,187,0.03)" gap={64} size={1} />
		</ReactFlow>
	);
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Research4() {
	const [activeTab, setActiveTab] = useState<ResearchBranchKey>("expansion_logistics");
	const [selectedNode, setSelectedNode] = useState<MockResearchNode | null>(null);
	const currentTab = RESEARCH_TABS.find((t) => t.key === activeTab) ?? EXP_TAB;

	return (
		<div
			style={{
				width: "100%",
				height: "100vh",
				position: "relative",
				overflow: "hidden",
				background: G.bg,
				fontFamily: "var(--nv-font-body)",
				color: G.textPrimary,
			}}
		>
			{/* Dither */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					opacity: 0.25,
				}}
			>
				<IsolatedDither
					waveSpeed={0.02}
					waveFrequency={1.8}
					waveAmplitude={0.45}
					waveColor={currentTab.ditherWaveColor}
					colorNum={4}
					pixelSize={currentTab.ditherPixelSize}
					enableMouseInteraction={false}
				/>
			</div>

			{/* Cartographic grid overlay */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					backgroundImage: `
          linear-gradient(rgba(100,248,187,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(100,248,187,0.02) 1px, transparent 1px)
        `,
					backgroundSize: "80px 80px",
					pointerEvents: "none",
				}}
			/>

			{/* Vignette */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					background: `
          radial-gradient(ellipse at 35% 40%, transparent 30%, rgba(5,12,10,0.6) 75%),
          radial-gradient(ellipse at 80% 20%, ${G.accent}06, transparent 40%)
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
					height: "100%",
				}}
			>
				{/* Vertical tab sidebar */}
				<div
					style={{
						width: 64,
						flexShrink: 0,
						background: G.glass,
						borderRight: `1px solid ${G.glassStroke}`,
						backdropFilter: "blur(10px)",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					<VerticalTabSelector
						activeKey={activeTab}
						onTabChange={(k) => {
							setActiveTab(k);
							setSelectedNode(null);
						}}
					/>
				</div>

				{/* Main tree area — full width */}
				<div
					style={{
						flex: 1,
						position: "relative",
						overflow: "hidden",
					}}
				>
					{/* Top HUD */}
					<TopHUD activeTab={activeTab} />

					{/* Tree canvas — fills everything */}
					<ReactFlowProvider>
						<TreeCanvas activeTab={activeTab} onNodeSelect={setSelectedNode} />
					</ReactFlowProvider>

					{/* Active research badge */}
					<ActiveResearchBadge />

					{/* Slide-up drawer for selected node */}
					{selectedNode && (
						<SlideUpDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
					)}
				</div>
			</div>

			<style>{`
        @keyframes atlasPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes atlasRing {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes drawerUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
		</div>
	);
}
