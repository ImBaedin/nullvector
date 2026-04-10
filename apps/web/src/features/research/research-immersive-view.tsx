import "@/features/game-ui/theme";
import "@xyflow/react/dist/style.css";
import {
	Background,
	BaseEdge,
	type Edge,
	type EdgeProps,
	Handle,
	Position,
	ReactFlow,
	ReactFlowProvider,
	type Node,
	type NodeProps,
	useReactFlow,
	useViewport,
} from "@xyflow/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	POLAR_RESEARCH_LAYOUT,
	getPolarBranchForAngle,
	projectPolar,
} from "@/features/research/polar-layout";
import {
	ACTIVE_RESEARCH,
	META_MATTER_BALANCES,
	META_MATTER_COLORS,
	RESEARCH_TABS,
	fmt,
	formatDuration,
	getRadialTree,
	type NodeStatus,
	type RadialNode,
	type ResearchBranchKey,
} from "@/features/research/radial-tree-data";

const BASE = {
	bg: "#040810",
	glass: "rgba(5,9,20,0.84)",
	stroke: "rgba(100,150,220,0.10)",
	t1: "#edf5ff",
	t2: "#a4bed8",
	t3: "#5e7a94",
	completed: "#64f8bb",
	available: "#3dd9ff",
	researching: "#ffd166",
};

const DEFAULT_DITHER: [number, number, number] = [0.2, 0.24, 0.32];
const HUB_DEAD_ZONE = 112;
const HOVER_RADIUS = POLAR_RESEARCH_LAYOUT.maxRadius + 260;
const WORLD_RADIUS = POLAR_RESEARCH_LAYOUT.maxRadius + 440;

type AugNode = RadialNode & {
	branchKey: ResearchBranchKey;
	branchThemeColor: string;
	polarAngleDeg: number;
	size: number;
};

type PolarPathData = { path: string };

function edgeStrokeColor(args: {
	hovered: boolean;
	locked: boolean;
	researching: boolean;
	lit: boolean;
	themeColor: string;
}) {
	if (args.hovered) {
		if (args.locked) return `${BASE.available}96`;
		if (args.researching) return `${BASE.researching}cc`;
		return args.lit ? `${args.themeColor}e8` : `${args.themeColor}b6`;
	}

	if (args.lit && !args.locked) return `${args.themeColor}88`;
	if (args.researching) return `${BASE.researching}66`;
	return `${args.themeColor}2e`;
}

function useDitherColor(hoveredBranch: ResearchBranchKey | null): [number, number, number] {
	const targetRef = useRef<[number, number, number]>([...DEFAULT_DITHER]);
	const currentRef = useRef<[number, number, number]>([...DEFAULT_DITHER]);
	const lastSetMs = useRef(0);
	const [display, setDisplay] = useState<[number, number, number]>([...DEFAULT_DITHER]);

	useEffect(() => {
		if (!hoveredBranch) {
			targetRef.current = [...DEFAULT_DITHER];
			return;
		}

		const hoveredTab = RESEARCH_TABS.find((tab) => tab.key === hoveredBranch);
		if (!hoveredTab) return;

		const [r, g, b] = hoveredTab.ditherWaveColor;
		targetRef.current = [Math.min(r * 1.75, 1), Math.min(g * 1.75, 1), Math.min(b * 1.75, 1)];
	}, [hoveredBranch]);

	useEffect(() => {
		let frame = 0;
		const lerp = 0.06;

		const tick = (timestamp: number) => {
			const current = currentRef.current;
			const target = targetRef.current;
			const next: [number, number, number] = [
				current[0] + (target[0] - current[0]) * lerp,
				current[1] + (target[1] - current[1]) * lerp,
				current[2] + (target[2] - current[2]) * lerp,
			];

			const delta =
				Math.abs(next[0] - current[0]) +
				Math.abs(next[1] - current[1]) +
				Math.abs(next[2] - current[2]);
			if (delta > 0.0003) {
				currentRef.current = next;
				if (timestamp - lastSetMs.current > 32) {
					lastSetMs.current = timestamp;
					setDisplay([...next]);
				}
			}

			frame = requestAnimationFrame(tick);
		};

		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);

	return display;
}

function arcPoint(angleDeg: number, radius: number) {
	const radians = (angleDeg * Math.PI) / 180;
	return {
		x: Math.cos(radians) * radius,
		y: Math.sin(radians) * radius,
	};
}

function describeSectorPath(
	startDeg: number,
	endDeg: number,
	outerRadius: number,
	innerRadius = HUB_DEAD_ZONE,
) {
	const outerStart = arcPoint(startDeg, outerRadius);
	const outerEnd = arcPoint(endDeg, outerRadius);
	const innerStart = arcPoint(endDeg, innerRadius);
	const innerEnd = arcPoint(startDeg, innerRadius);
	const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;

	return [
		`M ${innerEnd.x} ${innerEnd.y}`,
		`L ${outerStart.x} ${outerStart.y}`,
		`A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
		`L ${innerStart.x} ${innerStart.y}`,
		`A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
		"Z",
	].join(" ");
}

const SECTOR_BOUNDARIES = [
	...new Set(POLAR_RESEARCH_LAYOUT.sectors.map((sector) => sector.startDeg)),
].sort((left, right) => left - right);

function WorldTransformOverlay({ children, zIndex }: { children: ReactNode; zIndex: number }) {
	const { x, y, zoom } = useViewport();

	return (
		<div
			style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex }}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					transform: `translate(${x}px, ${y}px) scale(${zoom})`,
					transformOrigin: "0 0",
				}}
			>
				{children}
			</div>
		</div>
	);
}

function WorldGrid({ hoveredBranch }: { hoveredBranch: ResearchBranchKey | null }) {
	const hoveredSector = hoveredBranch
		? (POLAR_RESEARCH_LAYOUT.sectors.find((sector) => sector.branchKey === hoveredBranch) ?? null)
		: null;
	const hoveredTab = hoveredBranch
		? (RESEARCH_TABS.find((tab) => tab.key === hoveredBranch) ?? null)
		: null;

	return (
		<WorldTransformOverlay zIndex={2}>
			<svg
				viewBox={`${-WORLD_RADIUS} ${-WORLD_RADIUS} ${WORLD_RADIUS * 2} ${WORLD_RADIUS * 2}`}
				style={{
					position: "absolute",
					left: -WORLD_RADIUS,
					top: -WORLD_RADIUS,
					width: WORLD_RADIUS * 2,
					height: WORLD_RADIUS * 2,
					overflow: "visible",
				}}
			>
				{hoveredSector && hoveredTab ? (
					<path
						d={describeSectorPath(hoveredSector.startDeg, hoveredSector.endDeg, WORLD_RADIUS - 40)}
						fill={`${hoveredTab.themeColor}0c`}
						stroke={`${hoveredTab.themeColor}14`}
						strokeWidth={2}
					/>
				) : null}

				{SECTOR_BOUNDARIES.map((angleDeg) => {
					const point = projectPolar(angleDeg, WORLD_RADIUS - 50);
					return (
						<line
							key={angleDeg}
							x1={0}
							y1={0}
							x2={point.x}
							y2={point.y}
							stroke="rgba(100,145,210,0.14)"
							strokeWidth={2}
							strokeDasharray="8 12"
						/>
					);
				})}

				{POLAR_RESEARCH_LAYOUT.rings.map((radius) => (
					<circle
						key={radius}
						cx={0}
						cy={0}
						r={radius}
						fill="none"
						stroke="rgba(100,145,210,0.09)"
						strokeWidth={1.5}
						strokeDasharray="2 8"
					/>
				))}

				<circle
					cx={0}
					cy={0}
					r={HUB_DEAD_ZONE - 26}
					fill="none"
					stroke="rgba(160,200,255,0.09)"
					strokeWidth={1.5}
					strokeDasharray="3 6"
				/>
			</svg>
		</WorldTransformOverlay>
	);
}

function buildFlowNodes() {
	const nodes: Node[] = [];

	const hubPlacement = POLAR_RESEARCH_LAYOUT.nodes.get("hub_center");
	if (!hubPlacement) {
		throw new Error("Polar research layout is missing the hub node.");
	}

	nodes.push({
		id: hubPlacement.id,
		type: "hubCenter",
		position: {
			x: hubPlacement.center.x - hubPlacement.size / 2,
			y: hubPlacement.center.y - hubPlacement.size / 2,
		},
		data: { size: hubPlacement.size },
		draggable: false,
		selectable: false,
	});

	for (const tab of RESEARCH_TABS) {
		const tree = getRadialTree(tab.key);

		for (const node of tree.nodes) {
			const placement = POLAR_RESEARCH_LAYOUT.nodes.get(node.id);
			if (!placement) continue;

			nodes.push({
				id: node.id,
				type: node.shape,
				position: {
					x: placement.center.x - placement.size / 2,
					y: placement.center.y - placement.size / 2,
				},
				data: {
					...node,
					branchThemeColor: tab.themeColor,
					branchKey: tab.key,
					polarAngleDeg: placement.angleDeg,
					size: placement.size,
				} satisfies AugNode,
				draggable: false,
			});
		}
	}

	return nodes;
}

function buildFlowEdges(hoveredNodeId: string | null) {
	const edges: Edge[] = [];

	for (const tab of RESEARCH_TABS) {
		const tree = getRadialTree(tab.key);
		const nodeById = new Map(tree.nodes.map((node) => [node.id, node]));

		for (const edge of tree.edges) {
			const geometry = POLAR_RESEARCH_LAYOUT.edges.find(
				(item) => item.id === `${edge.source}-${edge.target}`,
			);
			if (!geometry) continue;

			const sourceNode = edge.source === "hub" ? null : nodeById.get(edge.source);
			const targetNode = nodeById.get(edge.target);
			const lit = sourceNode?.status === "completed" || edge.source === "hub";
			const locked = targetNode?.status === "locked";
			const researching = targetNode?.status === "researching";
			const hovered =
				hoveredNodeId !== null &&
				(geometry.source === hoveredNodeId || geometry.target === hoveredNodeId);

			edges.push({
				id: geometry.id,
				source: geometry.source,
				target: geometry.target,
				type: geometry.arc ? "polarArc" : "polarLine",
				selectable: false,
				animated: false,
				data: { path: geometry.path } satisfies PolarPathData,
				style: {
					stroke: edgeStrokeColor({
						hovered,
						locked: Boolean(locked),
						researching: Boolean(researching),
						lit,
						themeColor: tab.themeColor,
					}),
					strokeWidth: hovered ? 3 : lit && !locked ? 1.9 : 1.15,
					strokeDasharray: locked ? "4 7" : undefined,
					opacity: hoveredNodeId && !hovered ? 0.32 : 1,
					filter: hovered
						? `drop-shadow(0 0 12px ${tab.themeColor}66)`
						: researching
							? "drop-shadow(0 0 7px rgba(255, 209, 102, 0.22))"
							: undefined,
				},
			});
		}
	}

	return edges;
}

const FLOW_NODES = buildFlowNodes();

const HS = {
	background: "transparent",
	border: "none",
	width: 1,
	height: 1,
	minWidth: 1,
	minHeight: 1,
} as const;

function HiddenHandles() {
	return (
		<>
			{(["Top", "Right", "Bottom", "Left"] as const).map((position) => (
				<Handle
					key={`target-${position}`}
					type="target"
					position={Position[position]}
					id={position.toLowerCase()}
					style={HS}
				/>
			))}
			{(["Top", "Right", "Bottom", "Left"] as const).map((position) => (
				<Handle
					key={`source-${position}`}
					type="source"
					position={Position[position]}
					id={position.toLowerCase()}
					style={HS}
				/>
			))}
		</>
	);
}

function statusColors(status: NodeStatus, branchColor: string) {
	switch (status) {
		case "completed":
			return {
				border: BASE.completed,
				fill: `${BASE.completed}16`,
				glow: `${BASE.completed}2d`,
				label: BASE.completed,
			};
		case "available":
			return {
				border: BASE.available,
				fill: `${BASE.available}10`,
				glow: `${BASE.available}18`,
				label: BASE.t2,
			};
		case "researching":
			return {
				border: BASE.researching,
				fill: `${BASE.researching}14`,
				glow: `${BASE.researching}34`,
				label: BASE.researching,
			};
		default:
			return {
				border: `${branchColor}34`,
				fill: "rgba(12,18,34,0.60)",
				glow: "none",
				label: BASE.t3,
			};
	}
}

function NodeLabel({ name, color, size }: { color: string; name: string; size: number }) {
	return (
		<div
			style={{
				position: "absolute",
				top: "100%",
				left: "50%",
				transform: "translateX(-50%)",
				marginTop: 7,
				width: Math.max(96, size + 28),
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
					lineHeight: 1.35,
					display: "block",
				}}
			>
				{name}
			</span>
		</div>
	);
}

function CircleNode({ data }: NodeProps) {
	const node = data as AugNode;
	const colors = statusColors(node.status, node.branchThemeColor);
	const dim = node.status === "locked" ? 0.42 : 1;

	return (
		<div style={{ width: node.size, height: node.size, position: "relative" }}>
			<HiddenHandles />
			<div
				style={{
					width: node.size,
					height: node.size,
					borderRadius: "50%",
					border: `2px solid ${colors.border}`,
					background: `radial-gradient(circle at 38% 34%, ${colors.fill}, rgba(4,8,16,0.74))`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						colors.glow !== "none"
							? `0 0 20px ${colors.glow}, 0 0 6px ${node.branchThemeColor}1e`
							: `0 0 5px ${node.branchThemeColor}16`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{node.maxLevel > 1 ? (
					<div style={{ display: "flex", gap: 3 }}>
						{Array.from({ length: node.maxLevel }).map((_, index) => (
							<div
								key={index}
								style={{
									width: 5,
									height: 5,
									borderRadius: "50%",
									background: index < node.level ? colors.border : `${colors.border}28`,
									boxShadow: index < node.level ? `0 0 4px ${colors.border}` : "none",
								}}
							/>
						))}
					</div>
				) : null}
			</div>
			<NodeLabel name={node.name} color={colors.label} size={node.size} />
		</div>
	);
}

function HexNode({ data }: NodeProps) {
	const node = data as AugNode;
	const colors = statusColors(node.status, node.branchThemeColor);
	const dim = node.status === "locked" ? 0.42 : 1;
	const clipPath = "polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)";
	const half = node.size / 2;
	const polygon = `${half},1 ${node.size - 3},14.5 ${node.size - 3},${node.size - 14.5} ${half},${node.size - 1} 3,${node.size - 14.5} 3,14.5`;

	return (
		<div style={{ width: node.size, height: node.size, position: "relative" }}>
			<HiddenHandles />
			<div
				style={{
					width: node.size,
					height: node.size,
					position: "relative",
					opacity: dim,
					cursor: "pointer",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						clipPath,
						background: `linear-gradient(150deg, ${colors.fill}, rgba(4,8,16,0.72))`,
						boxShadow:
							colors.glow !== "none"
								? `inset 0 0 14px ${colors.glow}`
								: `inset 0 0 8px ${node.branchThemeColor}18`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						clipPath,
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
							border: `1px solid ${colors.border}66`,
							background: `${colors.border}1e`,
							transform: "rotate(45deg)",
						}}
					/>
				</div>
				<svg
					style={{ position: "absolute", inset: 0 }}
					width={node.size}
					height={node.size}
					viewBox={`0 0 ${node.size} ${node.size}`}
				>
					<polygon points={polygon} fill="none" stroke={colors.border} strokeWidth="2" />
				</svg>
			</div>
			<NodeLabel name={node.name} color={colors.label} size={node.size} />
		</div>
	);
}

function SquareNode({ data }: NodeProps) {
	const node = data as AugNode;
	const colors = statusColors(node.status, node.branchThemeColor);
	const dim = node.status === "locked" ? 0.42 : 1;

	return (
		<div style={{ width: node.size, height: node.size, position: "relative" }}>
			<HiddenHandles />
			<div
				style={{
					width: node.size,
					height: node.size,
					borderRadius: 7,
					border: `2px solid ${colors.border}`,
					background: `linear-gradient(145deg, ${colors.fill}, rgba(4,8,16,0.74))`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						colors.glow !== "none"
							? `0 0 18px ${colors.glow}, 0 0 4px ${node.branchThemeColor}1a`
							: `0 0 4px ${node.branchThemeColor}14`,
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
						border: `1px solid ${colors.border}4d`,
						background: `${colors.border}1a`,
					}}
				/>
			</div>
			<NodeLabel name={node.name} color={colors.label} size={node.size} />
		</div>
	);
}

function CapstoneNode({ data }: NodeProps) {
	const node = data as AugNode;
	const colors = statusColors(node.status, node.branchThemeColor);
	const dim = node.status === "locked" ? 0.36 : 1;

	return (
		<div style={{ width: node.size, height: node.size, position: "relative" }}>
			<HiddenHandles />
			<div
				style={{
					width: node.size,
					height: node.size,
					borderRadius: 16,
					border: `2.5px solid ${colors.border}`,
					background: `radial-gradient(circle at 40% 35%, ${colors.fill}, rgba(4,8,16,0.66) 70%)`,
					opacity: dim,
					cursor: "pointer",
					boxShadow:
						colors.glow !== "none"
							? `0 0 36px ${colors.glow}, 0 0 10px ${node.branchThemeColor}24`
							: `0 0 8px ${node.branchThemeColor}1a`,
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
						border: `1.5px solid ${colors.border}`,
						background: `radial-gradient(circle, ${colors.border}55, transparent)`,
						boxShadow: `0 0 12px ${colors.border}55`,
					}}
				/>
			</div>
			<NodeLabel name={node.name} color={colors.label} size={node.size} />
		</div>
	);
}

function HubCenterNode({ data }: NodeProps) {
	const hubSize = (data as { size?: number }).size ?? 120;

	return (
		<div style={{ width: hubSize, height: hubSize, position: "relative" }}>
			<HiddenHandles />
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
			<div
				style={{
					width: hubSize,
					height: hubSize,
					borderRadius: "50%",
					border: "2px solid rgba(160,200,255,0.42)",
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
	circle: CircleNode,
	hex: HexNode,
	square: SquareNode,
	capstone: CapstoneNode,
	hubCenter: HubCenterNode,
};

function PolarEdge({ id, data, style }: EdgeProps<Edge<PolarPathData>>) {
	const path = data?.path ?? "";
	return <BaseEdge id={id} path={path} style={style} />;
}

const edgeTypes = {
	polarLine: PolarEdge,
	polarArc: PolarEdge,
};

function Popover({
	node,
	x,
	y,
	accent,
	onClose,
}: {
	accent: string;
	node: AugNode;
	onClose: () => void;
	x: number;
	y: number;
}) {
	const colors = statusColors(node.status, accent);
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
				border: `1px solid ${colors.border}3a`,
				background: BASE.glass,
				backdropFilter: "blur(24px)",
				boxShadow: `0 16px 52px rgba(0,0,0,0.65), 0 0 20px ${colors.border}0C`,
				animation: "popIn 0.18s cubic-bezier(0.21,1,0.34,1)",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					height: 2,
					background: `linear-gradient(90deg, transparent, ${colors.border}, transparent)`,
					opacity: 0.5,
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
									color: colors.border,
									letterSpacing: "0.12em",
									textTransform: "uppercase",
									fontWeight: 600,
								}}
							>
								{node.status === "completed"
									? "DONE"
									: node.status === "available"
										? "AVAILABLE"
										: node.status === "researching"
											? "ACTIVE"
											: "LOCKED"}
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
								Tier {node.tier}
							</span>
						</div>
					</div>

					<button
						onClick={onClose}
						style={{
							width: 22,
							height: 22,
							borderRadius: 6,
							border: `1px solid ${BASE.stroke}`,
							background: "rgba(255,255,255,0.03)",
							color: BASE.t3,
							cursor: "pointer",
							fontSize: 11,
						}}
						type="button"
					>
						×
					</button>
				</div>

				<p
					style={{
						fontSize: 11,
						lineHeight: 1.55,
						color: locked ? BASE.t3 : BASE.t2,
						margin: 0,
					}}
				>
					{locked
						? "Further analysis required before this technology can be decrypted."
						: node.description}
				</p>

				<div
					style={{
						marginTop: 12,
						paddingTop: 10,
						borderTop: `1px solid ${BASE.stroke}`,
						display: "grid",
						gap: 8,
					}}
				>
					<div style={{ display: "grid", gap: 4 }}>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								letterSpacing: "0.12em",
								color: BASE.t3,
								textTransform: "uppercase",
							}}
						>
							Effects
						</span>
						{node.effects.map((effect) => (
							<div key={effect} style={{ fontSize: 11, color: locked ? BASE.t3 : BASE.t1 }}>
								{effect}
							</div>
						))}
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr auto",
							gap: 6,
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								letterSpacing: "0.12em",
								color: BASE.t3,
								textTransform: "uppercase",
							}}
						>
							Research Time
						</span>
						<span style={{ fontSize: 11, color: locked ? BASE.t3 : BASE.t1 }}>
							{formatDuration(node.costs.seconds)}
						</span>
					</div>

					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 10,
						}}
					>
						<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
							{(["common", "rare", "mythic"] as const).map((rarity) => {
								const amount = node.costs.metaMatter[rarity];
								if (!amount) return null;

								return (
									<div key={rarity} style={{ display: "flex", alignItems: "center", gap: 4 }}>
										<div
											style={{
												width: 6,
												height: 6,
												borderRadius: rarity === "mythic" ? 1.5 : "50%",
												background: META_MATTER_COLORS[rarity],
												transform: rarity === "mythic" ? "rotate(45deg)" : undefined,
											}}
										/>
										<span style={{ fontSize: 11, color: META_MATTER_COLORS[rarity] }}>
											{fmt(amount)}
										</span>
									</div>
								);
							})}
						</div>

						<button
							disabled={locked}
							style={{
								padding: "7px 10px",
								borderRadius: 8,
								border: `1px solid ${locked ? BASE.stroke : colors.border}55`,
								background: locked ? "rgba(255,255,255,0.02)" : `${colors.border}14`,
								color: locked ? BASE.t3 : colors.border,
								cursor: locked ? "not-allowed" : "pointer",
								fontFamily: "var(--nv-font-display)",
								fontSize: 11,
								fontWeight: 700,
							}}
							type="button"
						>
							{node.status === "researching" ? "Track" : locked ? "Locked" : "Queue"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function SectorLabels({ hoveredBranch }: { hoveredBranch: ResearchBranchKey | null }) {
	return (
		<>
			{RESEARCH_TABS.map((tab) => {
				const active = hoveredBranch === tab.key;
				const labelPoint = projectPolar(
					POLAR_RESEARCH_LAYOUT.branchCenters[tab.key],
					WORLD_RADIUS - 140,
				);
				return (
					<div
						key={tab.key}
						style={{
							position: "absolute",
							left: `calc(50% + ${labelPoint.x}px)`,
							top: `calc(50% + ${labelPoint.y}px)`,
							transform: "translate(-50%, -50%)",
							pointerEvents: "none",
							zIndex: 8,
							textAlign: "center",
							opacity: active ? 1 : 0.48,
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

type ResearchImmersiveViewProps = {
	hudInsetBottom?: number;
	hudInsetLeft?: number;
	hudInsetRight?: number;
	hudInsetTop?: number;
};

function InnerResearchImmersiveViewWithInsets({
	hudInsetBottom = 16,
	hudInsetLeft = 16,
	hudInsetRight = 16,
	hudInsetTop = 16,
}: ResearchImmersiveViewProps) {
	const { screenToFlowPosition } = useReactFlow();
	const viewport = useViewport();
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredBranch, setHoveredBranch] = useState<ResearchBranchKey | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [popover, setPopover] = useState<{ node: AugNode; x: number; y: number } | null>(null);

	const ditherColor = useDitherColor(hoveredBranch);

	const hoveredTab = hoveredBranch
		? (RESEARCH_TABS.find((tab) => tab.key === hoveredBranch) ?? null)
		: null;

	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
			const distance = Math.hypot(flowPoint.x, flowPoint.y);

			if (distance < HUB_DEAD_ZONE || distance > HOVER_RADIUS) {
				setHoveredBranch(null);
				return;
			}

			const angleDeg = (Math.atan2(flowPoint.y, flowPoint.x) * 180) / Math.PI;
			setHoveredBranch(getPolarBranchForAngle(angleDeg, POLAR_RESEARCH_LAYOUT.sectors));
		},
		[screenToFlowPosition],
	);

	const handleMouseLeave = useCallback(() => {
		setHoveredBranch(null);
		setHoveredNodeId(null);
	}, []);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, node: Node) => {
			if (node.id === "hub_center") return;
			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			const data = node.data as AugNode;

			let x = event.clientX - rect.left + 16;
			let y = event.clientY - rect.top - 64;

			if (x + 294 > rect.width) x = event.clientX - rect.left - 294;
			if (y < hudInsetTop) y = hudInsetTop;
			if (y + 360 > rect.height - hudInsetBottom) y = rect.height - hudInsetBottom - 360;

			setPopover({ node: data, x, y });
		},
		[hudInsetBottom, hudInsetTop],
	);

	const warningSummary = useMemo(() => {
		if (POLAR_RESEARCH_LAYOUT.warnings.length === 0) return "layout clear";
		return `${POLAR_RESEARCH_LAYOUT.warnings.length} density warning${POLAR_RESEARCH_LAYOUT.warnings.length === 1 ? "" : "s"}`;
	}, []);

	const flowEdges = useMemo(() => buildFlowEdges(hoveredNodeId), [hoveredNodeId]);

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				overflow: "hidden",
				background: BASE.bg,
				fontFamily: "var(--nv-font-body)",
				color: BASE.t1,
			}}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
		>
			<div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.1 }}>
				<IsolatedDither
					waveSpeed={0.018}
					waveFrequency={1.8}
					waveAmplitude={0.44}
					waveColor={ditherColor}
					colorNum={4}
					pixelSize={2}
					enableMouseInteraction={false}
					useViewportTransform
					viewportOffset={[viewport.x, viewport.y]}
					viewportZoom={viewport.zoom}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 1,
					pointerEvents: "none",
					background: "radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(4,8,16,0.44) 78%)",
				}}
			/>

			<WorldGrid hoveredBranch={hoveredBranch} />

			<div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
				<ReactFlow
					nodes={FLOW_NODES}
					edges={flowEdges}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					onNodeClick={handleNodeClick}
					onNodeMouseEnter={(_, node) =>
						setHoveredNodeId(node.id === "hub_center" ? null : node.id)
					}
					onNodeMouseLeave={() => setHoveredNodeId(null)}
					onPaneClick={() => setPopover(null)}
					fitView
					fitViewOptions={{ padding: 0.12 }}
					minZoom={0.1}
					maxZoom={2.5}
					panOnScroll
					zoomOnScroll
					proOptions={{ hideAttribution: true }}
				>
					<Background color="rgba(80,120,185,0.03)" gap={112} size={1.1} />
				</ReactFlow>
			</div>

			<SectorLabels hoveredBranch={hoveredBranch} />

			<div
				style={{
					position: "absolute",
					top: hudInsetTop,
					left: hudInsetLeft,
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
					{hoveredTab ? hoveredTab.label : "Polar progression grid · Aegis Prime"}
				</span>
			</div>

			<div
				style={{
					position: "absolute",
					top: hudInsetTop,
					right: hudInsetRight,
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
				{(["common", "rare", "mythic"] as const).map((rarity) => (
					<div key={rarity} style={{ display: "flex", alignItems: "center", gap: 5 }}>
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: rarity === "mythic" ? 1.5 : "50%",
								background: META_MATTER_COLORS[rarity],
								boxShadow: `0 0 5px ${META_MATTER_COLORS[rarity]}55`,
								transform: rarity === "mythic" ? "rotate(45deg)" : undefined,
							}}
						/>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 11,
								color: META_MATTER_COLORS[rarity],
								fontWeight: 500,
							}}
						>
							{META_MATTER_BALANCES[rarity].toLocaleString()}
						</span>
					</div>
				))}
			</div>

			<div
				style={{
					position: "absolute",
					bottom: hudInsetBottom,
					left: hudInsetLeft,
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

			<div
				style={{
					position: "absolute",
					bottom: hudInsetBottom,
					right: hudInsetRight,
					zIndex: 10,
					padding: "6px 12px",
					borderRadius: 6,
					background: BASE.glass,
					border: `1px solid ${BASE.stroke}`,
					backdropFilter: "blur(10px)",
					display: "flex",
					gap: 12,
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
					Aegis Prime — Directorate Lv 2
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 9,
						color: POLAR_RESEARCH_LAYOUT.warnings.length === 0 ? BASE.completed : BASE.researching,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
					}}
				>
					{warningSummary}
				</span>
			</div>

			{popover ? (
				<Popover
					node={popover.node}
					x={popover.x}
					y={popover.y}
					accent={
						RESEARCH_TABS.find((tab) => tab.key === popover.node.branchKey)?.themeColor ??
						BASE.available
					}
					onClose={() => setPopover(null)}
				/>
			) : null}

			<style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.94) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @keyframes hubRing {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.04); }
        }
      `}</style>
		</div>
	);
}

export function ResearchImmersiveView(props: ResearchImmersiveViewProps) {
	return (
		<ReactFlowProvider>
			<InnerResearchImmersiveViewWithInsets {...props} />
		</ReactFlowProvider>
	);
}
