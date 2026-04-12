import "@/features/game-ui/theme";
import "@xyflow/react/dist/style.css";
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import { api } from "@nullvector/backend/convex/_generated/api";
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

import { META_MATTER_ICON_SRC } from "@/features/game-ui/meta-matter-assets";
import {
	edgesForNodes,
	type RadialEdge,
	type RadialTree,
} from "@/features/research/canonical-tree-data";
import {
	META_MATTER_BALANCES,
	META_MATTER_COLORS,
	RESEARCH_TABS,
	fmt,
	formatDuration,
	getRadialTree,
	type NodeStatus,
	type RadialNode,
	type ResearchBranchKey,
} from "@/features/research/canonical-tree-data";
import { IsolatedDither } from "@/features/research/isolated-dither";
import {
	POLAR_RESEARCH_LAYOUT,
	getPolarBranchForAngle,
	projectPolar,
} from "@/features/research/polar-layout";
import { useConvexAuth, useQuery } from "@/lib/convex-hooks";

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
const GATE_HALF_WIDTH = 18;
const GATE_DETECT_RADIUS = 24;
const GATE_TIERS = [2, 3, 4] as const;
const GATE_RADII: Record<2 | 3 | 4, number> = {
	2: ((POLAR_RESEARCH_LAYOUT.rings[0] ?? 380) + (POLAR_RESEARCH_LAYOUT.rings[1] ?? 620)) / 2,
	3: ((POLAR_RESEARCH_LAYOUT.rings[1] ?? 620) + (POLAR_RESEARCH_LAYOUT.rings[2] ?? 890)) / 2,
	4: ((POLAR_RESEARCH_LAYOUT.rings[2] ?? 890) + (POLAR_RESEARCH_LAYOUT.rings[3] ?? 1160)) / 2,
};

const SECRET_SEAL_SIZE = 68;

type TierSecret = { title: string; body: string; effect: string };
const TIER_COMPLETION_SECRETS: Partial<
	Record<ResearchBranchKey, Partial<Record<1 | 2 | 3 | 4, TierSecret>>>
> = {
	appliedIndustry: {
		1: {
			title: "Cadence Protocol",
			body: "Industrial systems are now synchronised at a sub-cycle level invisible to standard monitoring. Base production ceilings have been silently raised.",
			effect: "+6% production output, account-wide",
		},
		2: {
			title: "Overclock Lattice",
			body: "A hidden assembly optimization layer has been unlocked. Your facilities can now exceed rated capacity during surge windows without triggering overload alerts.",
			effect: "Enables facility surge mode",
		},
		3: {
			title: "Substrate Memory",
			body: "Material reclamation algorithms are now active. A fraction of all construction waste is automatically reprocessed into raw stock.",
			effect: "Passive resource recovery on construction",
		},
		4: {
			title: "Industrial Singularity",
			body: "All applied industry systems are operating in unified resonance. The efficiency ceiling no longer applies to your network.",
			effect: "Removes industrial output cap",
		},
	},
	militarySystems: {
		1: {
			title: "Ghost Protocol",
			body: "Fleet targeting systems have been recalibrated using non-standard emission profiles. Ships operating in contested space now present reduced detection signatures.",
			effect: "−15% fleet detection radius",
		},
		2: {
			title: "Iron Veil Doctrine",
			body: "A classified tactical coordination framework has been activated. Defense installations now emit suppression fields that compound with adjacent structures.",
			effect: "Defense suppression field stacking",
		},
		3: {
			title: "Wrath Cascade",
			body: "Fire control systems are now synchronised across all platforms. Targeting data persists between engagements and sharpens over time.",
			effect: "Cumulative targeting accuracy bonus",
		},
		4: {
			title: "Theater Dominance",
			body: "Full-spectrum military coordination has been achieved. A hidden force projection coefficient is now applied to all fleet operations.",
			effect: "Fleet force projection +20%",
		},
	},
	scientificInfrastructure: {
		1: {
			title: "Resonant Archive",
			body: "Research data compression has exceeded projected bounds. A latent meta-matter signature has been detected in processed archives — origin unknown.",
			effect: "+8% meta-matter research yield",
		},
		2: {
			title: "Cascade Theorem",
			body: "Cross-disciplinary synthesis has been detected. Breakthroughs in one research domain now generate fractional advances in adjacent fields autonomously.",
			effect: "Research cross-pollination active",
		},
		3: {
			title: "Eigenstate Lock",
			body: "The research directorate is operating at theoretical maximum throughput. This configuration should not be stable. It is.",
			effect: "Research queue parallelism unlocked",
		},
		4: {
			title: "Cognitive Lattice",
			body: "All scientific infrastructure is now operating as a unified cognitive network. The boundary between directed research and emergent discovery has dissolved.",
			effect: "Emergent discovery system active",
		},
	},
	expansionLogistics: {
		1: {
			title: "Wayfinder Cache",
			body: "Logistics pathfinding algorithms have been updated with pre-calculated route matrices. Transport vessels now autonomously optimise multi-stop runs.",
			effect: "Transport route auto-optimisation",
		},
		2: {
			title: "Colonial Drift",
			body: "Expansion modeling indicates your next colony site selection is non-random. A location signature matching your operational patterns has been flagged in the system.",
			effect: "Colony site prediction active",
		},
		3: {
			title: "Arterial Web",
			body: "Your logistics network has reached critical density. Self-organising route optimisation is now compressing delivery windows below the theoretical minimum.",
			effect: "Sub-minimum transport windows",
		},
		4: {
			title: "Manifest Momentum",
			body: "Expansion and supply chains are operating in full resonance. A hidden velocity multiplier is now applied to all colonial growth curves.",
			effect: "+18% colonial growth rate",
		},
	},
	colonySpecialization: {
		1: {
			title: "Identity Seed",
			body: "Colony differentiation patterns have been detected. Each colony is now developing subtle specialization traits based on its operational history — no two colonies evolve identically.",
			effect: "Colony identity system active",
		},
		2: {
			title: "Adaptive Substrate",
			body: "Colony environments are self-modifying in response to sustained operations. Long-established colonies gain passive efficiency improvements that compound over time.",
			effect: "Colony age-efficiency scaling",
		},
		3: {
			title: "Cultural Resonance",
			body: "Colonial identity signals are now strong enough to influence surrounding space. Nearby neutral factions have begun adjusting trade terms in response.",
			effect: "Improved faction trade terms",
		},
		4: {
			title: "Sovereign Emergence",
			body: "All colonies are operating as a unified sovereign network. The distinction between colony and home system has become a matter of administrative convention.",
			effect: "Colony sovereignty bonus active",
		},
	},
};

type TierGateInfo = {
	tier: 1 | 2 | 3 | 4;
	unlocked: boolean;
	completed: boolean;
	requirements: Array<{ key: string; label: string; met: boolean }>;
};
type TierGatesByBranch = Map<ResearchBranchKey, TierGateInfo[]>;
type HoveredGate = {
	branchKey: ResearchBranchKey;
	tier: 2 | 3 | 4;
	themeColor: string;
	requirements: Array<{ key: string; label: string; met: boolean }>;
	containerX: number;
	containerY: number;
};

type SecretSealData = {
	branchKey: ResearchBranchKey;
	tier: 1 | 2 | 3 | 4;
	themeColor: string;
	size: number;
	secretTitle: string;
	secretBody: string;
	secretEffect: string | null;
};

type AugNode = RadialNode & {
	branchKey: ResearchBranchKey;
	branchThemeColor: string;
	polarAngleDeg: number;
	size: number;
};

type PolarPathData = { path: string };
type TreeByBranch = Map<ResearchBranchKey, RadialTree>;

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

function WorldGrid({
	hoveredBranch,
	tierGatesByBranch,
	hoveredGate,
}: {
	hoveredBranch: ResearchBranchKey | null;
	tierGatesByBranch: TierGatesByBranch | null;
	hoveredGate: HoveredGate | null;
}) {
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

				{/* Tier gate arc bands — locked / passed / completed */}
				{tierGatesByBranch &&
					RESEARCH_TABS.map((tab) => {
						const gates = tierGatesByBranch.get(tab.key) ?? [];
						const sector = POLAR_RESEARCH_LAYOUT.sectors.find((s) => s.branchKey === tab.key);
						if (!sector) return null;

						return GATE_TIERS.map((tierNum) => {
							const gate = gates.find((g) => g.tier === tierNum);
							if (!gate) return null;

							const gateRadius = GATE_RADII[tierNum];
							const isHovered = hoveredGate?.branchKey === tab.key && hoveredGate?.tier === tierNum;
							const isCompleted = gate.completed;
							const isLocked = !gate.unlocked;
							// isPassed = unlocked but nodes not all maxed yet

							const bandPath = describeSectorPath(
								sector.startDeg,
								sector.endDeg,
								gateRadius + GATE_HALF_WIDTH,
								gateRadius - GATE_HALF_WIDTH,
							);

							const midAngleRad = ((sector.startDeg + sector.endDeg) / 2) * (Math.PI / 180);
							const badgeX = Math.cos(midAngleRad) * gateRadius;
							const badgeY = Math.sin(midAngleRad) * gateRadius;

							return (
								<g key={`gate-${tab.key}-${tierNum}`}>
									{/* ── COMPLETED STATE ── solid glowing arc + star seal */}
									{isCompleted && (
										<>
											<path
												d={bandPath}
												fill={`${tab.themeColor}18`}
												stroke={`${tab.themeColor}aa`}
												strokeWidth={1.5}
												style={{
													filter: `drop-shadow(0 0 10px ${tab.themeColor}55)`,
												}}
											/>
											{/* Star seal badge */}
											<circle
												cx={badgeX}
												cy={badgeY}
												r={12}
												fill="rgba(4,8,16,0.94)"
												stroke={`${tab.themeColor}cc`}
												strokeWidth={1.5}
												style={{
													filter: `drop-shadow(0 0 6px ${tab.themeColor}88)`,
												}}
											/>
											<line
												x1={badgeX}
												y1={badgeY - 7}
												x2={badgeX}
												y2={badgeY + 7}
												stroke={tab.themeColor}
												strokeWidth={1.5}
												strokeLinecap="round"
											/>
											<line
												x1={badgeX - 7}
												y1={badgeY}
												x2={badgeX + 7}
												y2={badgeY}
												stroke={tab.themeColor}
												strokeWidth={1.5}
												strokeLinecap="round"
											/>
											<line
												x1={badgeX - 4.9}
												y1={badgeY - 4.9}
												x2={badgeX + 4.9}
												y2={badgeY + 4.9}
												stroke={`${tab.themeColor}99`}
												strokeWidth={1}
												strokeLinecap="round"
											/>
											<line
												x1={badgeX + 4.9}
												y1={badgeY - 4.9}
												x2={badgeX - 4.9}
												y2={badgeY + 4.9}
												stroke={`${tab.themeColor}99`}
												strokeWidth={1}
												strokeLinecap="round"
											/>
											<circle cx={badgeX} cy={badgeY} r={2.2} fill={tab.themeColor} />
										</>
									)}

									{/* ── LOCKED STATE ── dashed arc + padlock badge */}
									{isLocked && (
										<>
											<path
												d={bandPath}
												fill={isHovered ? `${tab.themeColor}1a` : `${tab.themeColor}09`}
												stroke={isHovered ? `${tab.themeColor}88` : `${tab.themeColor}32`}
												strokeWidth={isHovered ? 1.5 : 1}
												strokeDasharray="5 9"
												style={{ transition: "fill 0.2s ease, stroke 0.2s ease" }}
											/>
											<circle
												cx={badgeX}
												cy={badgeY}
												r={11}
												fill="rgba(4,8,16,0.92)"
												stroke={isHovered ? `${tab.themeColor}aa` : `${tab.themeColor}44`}
												strokeWidth={isHovered ? 1.5 : 1}
												style={{ transition: "stroke 0.2s ease" }}
											/>
											<rect
												x={badgeX - 3.5}
												y={badgeY - 0.5}
												width={7}
												height={5}
												rx={1}
												fill={isHovered ? `${tab.themeColor}cc` : `${tab.themeColor}66`}
												style={{ transition: "fill 0.2s ease" }}
											/>
											<path
												d={`M ${badgeX - 2.5} ${badgeY - 0.5} L ${badgeX - 2.5} ${badgeY - 3} A 2.5 2.5 0 0 1 ${badgeX + 2.5} ${badgeY - 3} L ${badgeX + 2.5} ${badgeY - 0.5}`}
												fill="none"
												stroke={isHovered ? `${tab.themeColor}cc` : `${tab.themeColor}66`}
												strokeWidth={1.2}
												style={{ transition: "stroke 0.2s ease" }}
											/>
											{isHovered && (
												<path
													d={describeSectorPath(
														sector.startDeg,
														sector.endDeg,
														gateRadius + GATE_HALF_WIDTH + 8,
														gateRadius - GATE_HALF_WIDTH - 8,
													)}
													fill="none"
													stroke={`${tab.themeColor}28`}
													strokeWidth={1}
													strokeDasharray="3 12"
												/>
											)}
										</>
									)}

									{/* ── PASSED STATE (unlocked, not yet complete) ── faint marker */}
									{!isLocked && !isCompleted && (
										<path d={bandPath} fill="none" stroke={`${BASE.completed}1a`} strokeWidth={1} />
									)}
								</g>
							);
						});
					})}
			</svg>
		</WorldTransformOverlay>
	);
}

function getTreeForBranch(treeByBranch: TreeByBranch | null, branch: ResearchBranchKey) {
	return treeByBranch?.get(branch) ?? getRadialTree(branch);
}

function buildFlowNodes(
	treeByBranch: TreeByBranch | null,
	tierGatesByBranch?: TierGatesByBranch | null,
) {
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
		const tree = getTreeForBranch(treeByBranch, tab.key);

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

	// Inject secret seal nodes for completed tiers
	if (tierGatesByBranch) {
		for (const tab of RESEARCH_TABS) {
			const gates = tierGatesByBranch.get(tab.key) ?? [];
			const sector = POLAR_RESEARCH_LAYOUT.sectors.find((s) => s.branchKey === tab.key);
			if (!sector) continue;

			for (const tierNum of GATE_TIERS) {
				const gate = gates.find((g) => g.tier === tierNum);
				if (!gate?.completed) continue;

				const gateRadius = GATE_RADII[tierNum];
				const midAngleRad = ((sector.startDeg + sector.endDeg) / 2) * (Math.PI / 180);
				const sealCenterX = Math.cos(midAngleRad) * gateRadius;
				const sealCenterY = Math.sin(midAngleRad) * gateRadius;
				const secrets = TIER_COMPLETION_SECRETS[tab.key as ResearchBranchKey];
				const secret = secrets?.[tierNum];

				nodes.push({
					id: `secretSeal_${tab.key}_${tierNum}`,
					type: "secretSeal",
					position: {
						x: sealCenterX - SECRET_SEAL_SIZE / 2,
						y: sealCenterY - SECRET_SEAL_SIZE / 2,
					},
					data: {
						branchKey: tab.key,
						tier: tierNum,
						themeColor: tab.themeColor,
						size: SECRET_SEAL_SIZE,
						secretTitle: secret?.title ?? "Classified Protocol",
						secretBody: secret?.body ?? "Data encrypted. Access requires higher clearance.",
						secretEffect: secret?.effect ?? null,
					} satisfies SecretSealData,
					draggable: false,
				});
			}
		}
	}

	return nodes;
}

function buildFlowEdges(hoveredNodeId: string | null, treeByBranch: TreeByBranch | null) {
	const edges: Edge[] = [];

	for (const tab of RESEARCH_TABS) {
		const tree = getTreeForBranch(treeByBranch, tab.key);
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
	const dim = node.status === "locked" || node.status === "hidden" ? 0.42 : 1;

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
	const dim = node.status === "locked" || node.status === "hidden" ? 0.42 : 1;
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
	const dim = node.status === "locked" || node.status === "hidden" ? 0.42 : 1;

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
	const dim = node.status === "locked" || node.status === "hidden" ? 0.36 : 1;

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

function SecretSealNode({ data }: NodeProps) {
	const { themeColor, size, tier } = data as SecretSealData;

	return (
		<div style={{ width: size, height: size, position: "relative", cursor: "pointer" }}>
			<HiddenHandles />

			{/* Outermost orbit ring — slow rotation */}
			<div
				style={{
					position: "absolute",
					inset: -6,
					borderRadius: "50%",
					border: `1px solid ${themeColor}30`,
					borderTopColor: `${themeColor}aa`,
					borderRightColor: `${themeColor}55`,
					animation: "sealOrbit 10s linear infinite",
					pointerEvents: "none",
				}}
			/>

			{/* Second counter-rotating ring */}
			<div
				style={{
					position: "absolute",
					inset: 2,
					borderRadius: "50%",
					border: `1px solid ${themeColor}22`,
					borderBottomColor: `${themeColor}77`,
					borderLeftColor: `${themeColor}44`,
					animation: "sealOrbitReverse 16s linear infinite",
					pointerEvents: "none",
				}}
			/>

			{/* Main body */}
			<div
				style={{
					position: "absolute",
					inset: 10,
					borderRadius: "50%",
					border: `2px solid ${themeColor}`,
					background: `radial-gradient(circle at 40% 36%, ${themeColor}2e, rgba(4,8,16,0.92))`,
					boxShadow: `0 0 28px ${themeColor}44, 0 0 8px ${themeColor}22, inset 0 0 16px ${themeColor}1e`,
					animation: "sealPulse 4s ease-in-out infinite",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{/* 8-pointed star glyph */}
				<svg
					width={size * 0.3}
					height={size * 0.3}
					viewBox="0 0 20 20"
					fill="none"
					style={{ filter: `drop-shadow(0 0 4px ${themeColor}cc)` }}
				>
					<line
						x1="10"
						y1="1.5"
						x2="10"
						y2="18.5"
						stroke={themeColor}
						strokeWidth="1.6"
						strokeLinecap="round"
					/>
					<line
						x1="1.5"
						y1="10"
						x2="18.5"
						y2="10"
						stroke={themeColor}
						strokeWidth="1.6"
						strokeLinecap="round"
					/>
					<line
						x1="3.6"
						y1="3.6"
						x2="16.4"
						y2="16.4"
						stroke={`${themeColor}aa`}
						strokeWidth="1.1"
						strokeLinecap="round"
					/>
					<line
						x1="16.4"
						y1="3.6"
						x2="3.6"
						y2="16.4"
						stroke={`${themeColor}aa`}
						strokeWidth="1.1"
						strokeLinecap="round"
					/>
					<circle cx="10" cy="10" r="2.2" fill={themeColor} />
					<circle cx="10" cy="10" r="1" fill="rgba(4,8,16,0.85)" />
				</svg>
			</div>

			{/* Label */}
			<div
				style={{
					position: "absolute",
					top: "100%",
					left: "50%",
					transform: "translateX(-50%)",
					marginTop: 9,
					width: 110,
					textAlign: "center",
					pointerEvents: "none",
				}}
			>
				<span
					style={{
						fontFamily: "var(--nv-font-mono)",
						fontSize: 7.5,
						color: themeColor,
						letterSpacing: "0.16em",
						textTransform: "uppercase",
						display: "block",
						textShadow: `0 0 10px ${themeColor}77`,
					}}
				>
					Tier {tier} Mastery
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
	secretSeal: SecretSealNode,
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
	const hidden = node.visibility === "hidden";
	const concealed = hidden || (node.visibility === "silhouette" && !node.canStart);
	const locked = node.status === "locked" || hidden;
	const disclosedCosts = concealed ? null : node.costs;
	const unmetRequirements = node.requirements.filter((requirement) => !requirement.met);

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
							{hidden ? "Classified" : node.name}
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
											: hidden
												? "HIDDEN"
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
					{hidden
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
						{concealed ? (
							<div style={{ fontSize: 11, color: BASE.t3 }}>Effects classified</div>
						) : (
							node.effects.map((effect) => (
								<div key={effect} style={{ fontSize: 11, color: BASE.t1 }}>
									{effect}
								</div>
							))
						)}
					</div>

					{node.requirements.length > 0 ? (
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
								Requirements
							</span>
							{node.requirements.map((requirement) => (
								<div
									key={requirement.key}
									style={{
										fontSize: 11,
										color: requirement.met ? BASE.t2 : "#ff7a7a",
									}}
								>
									{requirement.label}
								</div>
							))}
						</div>
					) : null}

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
						<span style={{ fontSize: 11, color: concealed ? BASE.t3 : BASE.t1 }}>
							{disclosedCosts ? formatDuration(disclosedCosts.seconds) : "Classified"}
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
							{disclosedCosts ? (
								(["common", "rare", "mythic"] as const).map((rarity) => {
									const amount = disclosedCosts.metaMatter[rarity];
									if (!amount) return null;

									return (
										<div key={rarity} style={{ display: "flex", alignItems: "center", gap: 4 }}>
											<img
												alt={`${rarity} meta-matter`}
												src={META_MATTER_ICON_SRC[rarity]}
												style={{
													width: 16,
													height: 16,
													objectFit: "contain",
													filter: `drop-shadow(0 0 5px ${META_MATTER_COLORS[rarity]}44)`,
												}}
											/>
											<span style={{ fontSize: 11, color: META_MATTER_COLORS[rarity] }}>
												{fmt(amount)}
											</span>
										</div>
									);
								})
							) : (
								<span style={{ fontSize: 11, color: BASE.t3 }}>Costs classified</span>
							)}
						</div>

						<button
							disabled={!node.canStart}
							style={{
								padding: "7px 10px",
								borderRadius: 8,
								border: `1px solid ${!node.canStart ? BASE.stroke : colors.border}55`,
								background: !node.canStart ? "rgba(255,255,255,0.02)" : `${colors.border}14`,
								color: !node.canStart ? BASE.t3 : colors.border,
								cursor: !node.canStart ? "not-allowed" : "pointer",
								fontFamily: "var(--nv-font-display)",
								fontSize: 11,
								fontWeight: 700,
							}}
							type="button"
						>
							{node.status === "researching"
								? "Track"
								: node.canStart
									? "Queue"
									: unmetRequirements.length > 0
										? "Requirements"
										: "Locked"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function SecretSealPopover({
	data,
	x,
	y,
	onClose,
}: {
	data: SecretSealData;
	x: number;
	y: number;
	onClose: () => void;
}) {
	const { themeColor, tier, secretTitle, secretBody, secretEffect } = data;

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				zIndex: 65,
				width: 310,
				borderRadius: 12,
				border: `1px solid ${themeColor}55`,
				background: BASE.glass,
				backdropFilter: "blur(28px)",
				boxShadow: `0 20px 60px rgba(0,0,0,0.72), 0 0 36px ${themeColor}18, inset 0 0 24px ${themeColor}06`,
				animation: "popIn 0.22s cubic-bezier(0.21,1,0.34,1)",
				overflow: "hidden",
			}}
		>
			{/* Top accent — full-brightness gradient in branch color */}
			<div
				style={{
					height: 3,
					background: `linear-gradient(90deg, transparent, ${themeColor}, ${themeColor}cc, transparent)`,
				}}
			/>

			<div style={{ padding: "14px 16px 16px" }}>
				{/* Classification header */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 12,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						{/* Radiant star icon */}
						<svg width="14" height="14" viewBox="0 0 20 20" fill="none">
							<line
								x1="10"
								y1="1"
								x2="10"
								y2="19"
								stroke={themeColor}
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
							<line
								x1="1"
								y1="10"
								x2="19"
								y2="10"
								stroke={themeColor}
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
							<line
								x1="3.2"
								y1="3.2"
								x2="16.8"
								y2="16.8"
								stroke={`${themeColor}99`}
								strokeWidth="1.2"
								strokeLinecap="round"
							/>
							<line
								x1="16.8"
								y1="3.2"
								x2="3.2"
								y2="16.8"
								stroke={`${themeColor}99`}
								strokeWidth="1.2"
								strokeLinecap="round"
							/>
							<circle cx="10" cy="10" r="2.5" fill={themeColor} />
						</svg>
						<div>
							<div
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 7.5,
									color: themeColor,
									letterSpacing: "0.22em",
									textTransform: "uppercase",
									fontWeight: 600,
								}}
							>
								Tier {tier} — Mastery Unlocked
							</div>
							<div
								style={{
									fontFamily: "var(--nv-font-mono)",
									fontSize: 6.5,
									color: BASE.t3,
									letterSpacing: "0.14em",
									textTransform: "uppercase",
									marginTop: 1,
								}}
							>
								Classified protocol — decrypted
							</div>
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
							flexShrink: 0,
						}}
						type="button"
					>
						×
					</button>
				</div>

				{/* Divider */}
				<div
					style={{
						height: 1,
						background: `linear-gradient(90deg, ${themeColor}44, ${themeColor}18, transparent)`,
						marginBottom: 12,
					}}
				/>

				{/* Secret title */}
				<div
					style={{
						fontFamily: "var(--nv-font-display)",
						fontSize: 17,
						fontWeight: 800,
						color: BASE.t1,
						letterSpacing: "0.04em",
						marginBottom: 8,
						textShadow: `0 0 18px ${themeColor}44`,
					}}
				>
					{secretTitle}
				</div>

				{/* Secret body */}
				<p
					style={{
						fontSize: 11,
						lineHeight: 1.6,
						color: BASE.t2,
						margin: 0,
						marginBottom: 12,
					}}
				>
					{secretBody}
				</p>

				{/* Effect label */}
				{secretEffect && (
					<div
						style={{
							padding: "8px 10px",
							borderRadius: 7,
							border: `1px solid ${themeColor}35`,
							background: `${themeColor}0c`,
							display: "flex",
							alignItems: "center",
							gap: 8,
						}}
					>
						{/* Small pulsing orb */}
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: "50%",
								background: themeColor,
								boxShadow: `0 0 8px ${themeColor}`,
								animation: "pulseGlow 2.5s ease-in-out infinite",
								flexShrink: 0,
							}}
						/>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 10,
								color: themeColor,
								letterSpacing: "0.06em",
							}}
						>
							{secretEffect}
						</span>
					</div>
				)}
			</div>

			{/* Bottom accent line */}
			<div
				style={{
					height: 1,
					background: `linear-gradient(90deg, transparent, ${themeColor}30, transparent)`,
				}}
			/>
		</div>
	);
}

function TierGateTooltip({ gate }: { gate: HoveredGate }) {
	const { themeColor, tier, requirements, containerX, containerY } = gate;
	const metRequirements = requirements.filter((r) => r.met);
	const unmetRequirements = requirements.filter((r) => !r.met);

	return (
		<div
			style={{
				position: "absolute",
				left: containerX + 18,
				top: Math.max(8, containerY - 16),
				zIndex: 70,
				width: 230,
				borderRadius: 10,
				border: `1px solid ${themeColor}30`,
				background: BASE.glass,
				backdropFilter: "blur(28px)",
				boxShadow: `0 14px 48px rgba(0,0,0,0.68), 0 0 24px ${themeColor}0e`,
				animation: "popIn 0.15s cubic-bezier(0.21,1,0.34,1)",
				pointerEvents: "none",
				overflow: "hidden",
			}}
		>
			{/* Accent line */}
			<div
				style={{
					height: 2,
					background: `linear-gradient(90deg, transparent, ${themeColor}90, transparent)`,
				}}
			/>

			<div style={{ padding: "11px 13px 13px" }}>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 7,
						marginBottom: 10,
					}}
				>
					{/* Lock icon */}
					<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style={{ flexShrink: 0 }}>
						<rect
							x="1"
							y="5.5"
							width="9"
							height="6.5"
							rx="1.5"
							stroke={themeColor}
							strokeWidth="1"
							fill={`${themeColor}18`}
						/>
						<path
							d="M3 5.5V3.5a2.5 2.5 0 0 1 5 0v2"
							stroke={themeColor}
							strokeWidth="1"
							strokeLinecap="round"
						/>
					</svg>
					<div>
						<div
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 9,
								color: themeColor,
								letterSpacing: "0.16em",
								textTransform: "uppercase",
								fontWeight: 600,
							}}
						>
							Tier {tier} — Locked
						</div>
						<div
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 7,
								color: BASE.t3,
								letterSpacing: "0.1em",
								textTransform: "uppercase",
								marginTop: 1,
							}}
						>
							Unlock to reveal technologies
						</div>
					</div>
				</div>

				{/* Separator */}
				<div
					style={{
						height: 1,
						background: `linear-gradient(90deg, ${themeColor}22, transparent)`,
						marginBottom: 9,
					}}
				/>

				{/* Requirements */}
				{requirements.length === 0 ? (
					<div style={{ fontSize: 10, color: BASE.t3, fontStyle: "italic" }}>No requirements</div>
				) : (
					<div style={{ display: "grid", gap: 6 }}>
						{[...unmetRequirements, ...metRequirements].map((req) => (
							<div
								key={req.key}
								style={{
									display: "flex",
									alignItems: "flex-start",
									gap: 7,
								}}
							>
								{/* Status dot */}
								<div
									style={{
										width: 5,
										height: 5,
										borderRadius: "50%",
										marginTop: 3,
										flexShrink: 0,
										background: req.met ? BASE.completed : "rgba(255,90,90,0.75)",
										boxShadow: req.met
											? `0 0 5px ${BASE.completed}88`
											: "0 0 4px rgba(255,90,90,0.4)",
									}}
								/>
								<span
									style={{
										fontFamily: "var(--nv-font-body)",
										fontSize: 10,
										color: req.met ? BASE.t2 : BASE.t1,
										lineHeight: 1.45,
									}}
								>
									{req.label}
								</span>
							</div>
						))}
					</div>
				)}

				{/* Progress summary */}
				{requirements.length > 0 && (
					<div
						style={{
							marginTop: 10,
							paddingTop: 8,
							borderTop: `1px solid ${BASE.stroke}`,
							display: "flex",
							alignItems: "center",
							gap: 8,
						}}
					>
						<div
							style={{
								flex: 1,
								height: 3,
								borderRadius: 2,
								background: "rgba(255,255,255,0.06)",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									width: `${(metRequirements.length / requirements.length) * 100}%`,
									height: "100%",
									borderRadius: 2,
									background: `linear-gradient(90deg, ${themeColor}66, ${themeColor})`,
									transition: "width 0.4s ease",
								}}
							/>
						</div>
						<span
							style={{
								fontFamily: "var(--nv-font-mono)",
								fontSize: 8,
								color: BASE.t3,
								letterSpacing: "0.1em",
								whiteSpace: "nowrap",
							}}
						>
							{metRequirements.length}/{requirements.length}
						</span>
					</div>
				)}
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

type ResearchStateNode = {
	id: string;
	name: string;
	branch: string;
	tier: number;
	description: string;
	layout: { lane: string; shape: string };
	position: { x: number; y: number };
	prerequisites: string[];
	level: number;
	maxLevel: number;
	visibility: "hidden" | "silhouette" | "visible";
	status: NodeStatus;
	canStart: boolean;
	requiredResearchFacilityLevel: number;
	requiredCombinedResearchCapacity?: number;
	requirements: Array<{ key: string; label: string; met: boolean }>;
	effects: string[];
	nextCost: {
		metaMatter: Record<"common" | "rare" | "mythic", number>;
		resources: { alloy: number; crystal: number; fuel: number };
		seconds: number;
	} | null;
};

type ResearchStateBranch = {
	key: string;
	tiers: Array<{
		tier: number;
		unlocked: boolean;
		requirements: Array<{ key: string; label: string; met: boolean }>;
		nodes: ResearchStateNode[];
	}>;
};

function buildTreeByBranch(branches: ResearchStateBranch[] | undefined): {
	treeByBranch: TreeByBranch;
	tierGatesByBranch: TierGatesByBranch;
} | null {
	if (!branches) return null;

	const treeByBranch = new Map<ResearchBranchKey, RadialTree>();
	const tierGatesByBranch = new Map<ResearchBranchKey, TierGateInfo[]>();

	for (const branch of branches) {
		const branchKey = branch.key as ResearchBranchKey;

		// Extract per-tier unlock state and completion
		const tierGates: TierGateInfo[] = branch.tiers.map((tier) => ({
			tier: Math.max(1, Math.min(4, Math.floor(tier.tier))) as 1 | 2 | 3 | 4,
			unlocked: tier.unlocked,
			completed:
				tier.unlocked &&
				tier.nodes.length > 0 &&
				tier.nodes.every((n) => n.level > 0 && n.level >= n.maxLevel),
			requirements: tier.requirements,
		}));
		tierGatesByBranch.set(branchKey, tierGates);

		// Determine visibility tiers:
		//   ≤ highestUnlocked  → render normally
		//   highestUnlocked+1  → silhouette (ghost, no interaction)
		//   beyond that        → omit entirely
		const highestUnlocked = tierGates.reduce(
			(max, g) => (g.unlocked ? Math.max(max, g.tier) : max),
			0,
		);
		const silhouetteTier = highestUnlocked < 4 ? highestUnlocked + 1 : null;

		const nodes: RadialNode[] = branch.tiers.flatMap((tier) => {
			const tierNum = Math.max(1, Math.min(4, Math.floor(tier.tier))) as 1 | 2 | 3 | 4;
			if (silhouetteTier !== null && tierNum > silhouetteTier) return [];

			const isSilhouette = silhouetteTier !== null && tierNum === silhouetteTier;
			return tier.nodes.map((node) => ({
				id: node.id,
				name: node.name,
				branch: branchKey,
				tier: tierNum,
				shape: node.layout.shape as RadialNode["shape"],
				status: isSilhouette ? ("locked" as const) : node.status,
				visibility: isSilhouette ? ("silhouette" as const) : node.visibility,
				canStart: isSilhouette ? false : node.canStart,
				position: node.position,
				prerequisites: node.prerequisites,
				level: node.level,
				maxLevel: node.maxLevel,
				effects: node.effects,
				description: node.description,
				requiredFacilityLevel: node.requiredResearchFacilityLevel,
				requiredCombinedResearchCapacity: node.requiredCombinedResearchCapacity,
				requirements: node.requirements,
				costs: node.nextCost
					? {
							metaMatter: node.nextCost.metaMatter,
							resources: node.nextCost.resources,
							seconds: node.nextCost.seconds,
						}
					: null,
			}));
		});

		treeByBranch.set(branchKey, {
			branchKey,
			nodes,
			edges: edgesForNodes(nodes) as RadialEdge[],
		});
	}

	return { treeByBranch, tierGatesByBranch };
}

type ResearchImmersiveViewProps = {
	colonyId?: Id<"colonies">;
	hudInsetBottom?: number;
	hudInsetLeft?: number;
	hudInsetRight?: number;
	hudInsetTop?: number;
};

function InnerResearchImmersiveViewWithInsets({
	colonyId,
	hudInsetBottom = 16,
	hudInsetLeft = 16,
	hudInsetRight = 16,
	hudInsetTop = 16,
}: ResearchImmersiveViewProps) {
	const { isAuthenticated } = useConvexAuth();
	const researchState = useQuery(
		api.research.getState,
		isAuthenticated && colonyId ? { colonyId } : "skip",
	);
	const { screenToFlowPosition } = useReactFlow();
	const viewport = useViewport();
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredBranch, setHoveredBranch] = useState<ResearchBranchKey | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [hoveredGate, setHoveredGate] = useState<HoveredGate | null>(null);
	const [popover, setPopover] = useState<{ node: AugNode; x: number; y: number } | null>(null);
	const [sealPopover, setSealPopover] = useState<{
		data: SecretSealData;
		x: number;
		y: number;
	} | null>(null);

	const ditherColor = useDitherColor(hoveredBranch);

	const hoveredTab = hoveredBranch
		? (RESEARCH_TABS.find((tab) => tab.key === hoveredBranch) ?? null)
		: null;
	const treeAndGates = useMemo(() => buildTreeByBranch(researchState?.tree), [researchState?.tree]);
	const treeByBranch = treeAndGates?.treeByBranch ?? null;
	const tierGatesByBranch = treeAndGates?.tierGatesByBranch ?? null;
	const balances = researchState?.balances ?? META_MATTER_BALANCES;
	const activeResearch = researchState?.activeResearch;
	const serverNow = researchState?.serverNow ?? 0;
	const activeTreeNode =
		activeResearch && treeByBranch
			? (Array.from(treeByBranch.values())
					.flatMap((tree) => tree.nodes)
					.find((node) => node.id === activeResearch.researchKey) ?? null)
			: null;
	const activeProgress = activeResearch
		? Math.max(
				0,
				Math.min(
					100,
					((serverNow - activeResearch.startsAt) /
						Math.max(1, activeResearch.completesAt - activeResearch.startsAt)) *
						100,
				),
			)
		: 0;
	const activeRemainingSeconds = activeResearch
		? Math.max(0, Math.ceil((activeResearch.completesAt - serverNow) / 1_000))
		: 0;

	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
			const distance = Math.hypot(flowPoint.x, flowPoint.y);
			const angleDeg = (Math.atan2(flowPoint.y, flowPoint.x) * 180) / Math.PI;

			// Check tier gate hover first — takes priority over branch hover
			if (tierGatesByBranch) {
				for (const tierNum of GATE_TIERS) {
					const gateRadius = GATE_RADII[tierNum];
					if (Math.abs(distance - gateRadius) < GATE_DETECT_RADIUS) {
						const branchKey = getPolarBranchForAngle(angleDeg, POLAR_RESEARCH_LAYOUT.sectors);
						if (branchKey) {
							const gates = tierGatesByBranch.get(branchKey);
							const gate = gates?.find((g) => g.tier === tierNum);
							if (gate && !gate.unlocked) {
								const container = containerRef.current;
								const rect = container?.getBoundingClientRect();
								const containerX = rect ? event.clientX - rect.left : event.clientX;
								const containerY = rect ? event.clientY - rect.top : event.clientY;
								const tab = RESEARCH_TABS.find((t) => t.key === branchKey);
								setHoveredGate({
									branchKey,
									tier: tierNum,
									themeColor: tab?.themeColor ?? BASE.available,
									requirements: gate.requirements,
									containerX,
									containerY,
								});
								setHoveredBranch(null);
								return;
							}
						}
					}
				}
			}

			setHoveredGate(null);

			if (distance < HUB_DEAD_ZONE || distance > HOVER_RADIUS) {
				setHoveredBranch(null);
				return;
			}

			setHoveredBranch(getPolarBranchForAngle(angleDeg, POLAR_RESEARCH_LAYOUT.sectors));
		},
		[screenToFlowPosition, tierGatesByBranch],
	);

	const handleMouseLeave = useCallback(() => {
		setHoveredBranch(null);
		setHoveredNodeId(null);
		setHoveredGate(null);
	}, []);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, node: Node) => {
			if (node.id === "hub_center") return;
			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();

			// Secret seal node — special popover
			if (node.type === "secretSeal") {
				const sealData = node.data as SecretSealData;
				let x = event.clientX - rect.left + 16;
				let y = event.clientY - rect.top - 80;
				if (x + 326 > rect.width) x = event.clientX - rect.left - 326;
				if (y < hudInsetTop) y = hudInsetTop;
				if (y + 420 > rect.height - hudInsetBottom) y = rect.height - hudInsetBottom - 420;
				setPopover(null);
				setSealPopover({ data: sealData, x, y });
				return;
			}

			const data = node.data as AugNode;
			let x = event.clientX - rect.left + 16;
			let y = event.clientY - rect.top - 64;

			if (x + 294 > rect.width) x = event.clientX - rect.left - 294;
			if (y < hudInsetTop) y = hudInsetTop;
			if (y + 360 > rect.height - hudInsetBottom) y = rect.height - hudInsetBottom - 360;

			setSealPopover(null);
			setPopover({ node: data, x, y });
		},
		[hudInsetBottom, hudInsetTop],
	);

	const warningSummary = useMemo(() => {
		if (POLAR_RESEARCH_LAYOUT.warnings.length === 0) return "layout clear";
		return `${POLAR_RESEARCH_LAYOUT.warnings.length} density warning${POLAR_RESEARCH_LAYOUT.warnings.length === 1 ? "" : "s"}`;
	}, []);

	const flowNodes = useMemo(
		() => buildFlowNodes(treeByBranch, tierGatesByBranch),
		[treeByBranch, tierGatesByBranch],
	);
	const flowEdges = useMemo(
		() => buildFlowEdges(hoveredNodeId, treeByBranch),
		[hoveredNodeId, treeByBranch],
	);

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
			<div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.2 }}>
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

			<WorldGrid
				hoveredBranch={hoveredBranch}
				tierGatesByBranch={tierGatesByBranch}
				hoveredGate={hoveredGate}
			/>

			<div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
				<ReactFlow
					nodes={flowNodes}
					edges={flowEdges}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					onNodeClick={handleNodeClick}
					onNodeMouseEnter={(_, node) =>
						setHoveredNodeId(node.id === "hub_center" ? null : node.id)
					}
					onNodeMouseLeave={() => setHoveredNodeId(null)}
					onPaneClick={() => {
						setPopover(null);
						setSealPopover(null);
					}}
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
					{hoveredTab ? hoveredTab.label : "Polar progression grid · live research data"}
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
						<img
							alt={`${rarity} meta-matter`}
							src={META_MATTER_ICON_SRC[rarity]}
							style={{
								width: 18,
								height: 18,
								objectFit: "contain",
								filter: `drop-shadow(0 0 5px ${META_MATTER_COLORS[rarity]}55)`,
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
							{balances[rarity].toLocaleString()}
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
					{activeResearch ? "Researching" : "Research Idle"}
				</span>
				<span
					style={{
						fontFamily: "var(--nv-font-body)",
						fontSize: 11,
						fontWeight: 600,
						color: BASE.t1,
					}}
				>
					{activeTreeNode?.name ?? "No active project"}
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
							width: `${activeProgress}%`,
							height: "100%",
							borderRadius: 2,
							background: `linear-gradient(90deg, ${BASE.researching}66, ${BASE.researching})`,
						}}
					/>
				</div>
				<span style={{ fontFamily: "var(--nv-font-mono)", fontSize: 9, color: BASE.t3 }}>
					{activeResearch ? formatDuration(activeRemainingSeconds) : "Ready"}
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
					Directorate Lv {researchState?.localResearchFacilityLevel ?? 0}
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

			{sealPopover ? (
				<SecretSealPopover
					data={sealPopover.data}
					x={sealPopover.x}
					y={sealPopover.y}
					onClose={() => setSealPopover(null)}
				/>
			) : null}

			{hoveredGate ? <TierGateTooltip gate={hoveredGate} /> : null}

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
        @keyframes gateDash {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -28; }
        }
        @keyframes sealOrbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sealOrbitReverse {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes sealPulse {
          0%, 100% { box-shadow: 0 0 28px var(--seal-glow, rgba(100,200,255,0.26)), 0 0 8px var(--seal-glow, rgba(100,200,255,0.13)), inset 0 0 16px rgba(100,200,255,0.12); }
          50%       { box-shadow: 0 0 44px var(--seal-glow, rgba(100,200,255,0.38)), 0 0 14px var(--seal-glow, rgba(100,200,255,0.20)), inset 0 0 24px rgba(100,200,255,0.18); }
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
