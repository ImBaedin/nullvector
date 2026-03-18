/**
 * Colony Overview
 *
 * Aesthetic: Classified intelligence document on a secure terminal. Single column
 * (~900px max), monospace-heavy, dark paper texture feel. A "file folder tab" at
 * the top edge. Each section separated by horizontal rules with section codes
 * (SEC-01 // PLANET PROFILE). Classification stamps float in margins. Activity
 * log renders as terminal output with line numbers and a blinking cursor.
 *
 * Owner section gets a dramatic red "EYES ONLY" stamp with a crimson tint overlay.
 * Everything feels typed, stamped, printed on secure paper in a dark room.
 */
import type { Id } from "@nullvector/backend/convex/_generated/dataModel";
import type { BuildingKey, DefenseKey, FacilityKey, ShipKey } from "@nullvector/game-logic";
import type { ReactNode } from "react";

import { api } from "@nullvector/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	Crosshair,
	Eye,
	EyeOff,
	Factory,
	FileText,
	Globe2,
	Lock,
	MapPin,
	Radar,
	Shield,
	Ship,
	Swords,
	TrendingUp,
	Users,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useColonySelectors } from "@/features/colony-state/hooks";
import { formatQueueRemainingLabel, getQueueProgress } from "@/features/colony-ui/queue-state";
import { formatColonyDuration } from "@/features/colony-ui/time";
import { useColonyResources } from "@/hooks/use-colony-resources";
import { formatResourceValue } from "@/lib/colony-resource-simulation";
import { useConvexAuth, useQuery } from "@/lib/convex-hooks";

import { OverviewRouteSkeleton } from "./loading-skeletons";

export const Route = createFileRoute("/game/colony/$colonyId/")({
	component: ColonyOverviewRoute,
});

const dossierStyles = `
	@keyframes dossier-typewriter {
		from { width: 0; }
		to { width: 100%; }
	}
	@keyframes dossier-cursor-blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}
	@keyframes dossier-stamp-slam {
		0% { opacity: 0; transform: scale(2) rotate(-8deg); }
		40% { opacity: 0.9; transform: scale(0.95) rotate(-6deg); }
		100% { opacity: 1; transform: scale(1) rotate(-6deg); }
	}
	@keyframes dossier-fade-up {
		0% { opacity: 0; transform: translateY(6px); }
		100% { opacity: 1; transform: translateY(0); }
	}
	.dossier-paper {
		background:
			repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.015) 23px, rgba(255,255,255,0.015) 24px),
			linear-gradient(180deg, rgba(8,12,22,0.97), rgba(6,10,18,0.99));
	}
	.dossier-tab {
		clip-path: polygon(0 100%, 8px 0, calc(100% - 8px) 0, 100% 100%);
	}
	.dossier-stamp {
		animation: dossier-stamp-slam 300ms var(--nv-ease-emphasis) both;
		transform-origin: center center;
	}
	.dossier-redacted {
		background: repeating-linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 4px, transparent 4px, transparent 6px);
	}
	.dossier-terminal-line::before {
		content: attr(data-line);
		display: inline-block;
		width: 28px;
		text-align: right;
		margin-right: 12px;
		color: rgba(255,255,255,0.12);
		font-size: 9px;
	}
`;

const CLASS_COLORS: Record<string, string> = {
	UNCLASSIFIED: "text-white/15 border-white/10",
	RESTRICTED: "text-amber-400/50 border-amber-400/30",
	CLASSIFIED: "text-rose-400/50 border-rose-400/30",
	"EYES ONLY": "text-rose-400/70 border-rose-400/50",
};

const SEV_INDICATOR: Record<string, { prefix: string; color: string }> = {
	critical: { prefix: "!!!", color: "text-rose-300" },
	warning: { prefix: " ! ", color: "text-amber-300/80" },
	info: { prefix: " i ", color: "text-cyan-300/70" },
	success: { prefix: " + ", color: "text-emerald-300/70" },
	neutral: { prefix: " . ", color: "text-white/40" },
};

const SHIP_LABELS = {
	smallCargo: "Small Cargo",
	largeCargo: "Large Cargo",
	colonyShip: "Colony Ship",
	interceptor: "Interceptor",
	frigate: "Frigate",
	cruiser: "Cruiser",
	bomber: "Bomber",
} as const satisfies Record<ShipKey, string>;

const BUILDING_LABELS = {
	alloyMineLevel: "Alloy Mine",
	crystalMineLevel: "Crystal Mine",
	fuelRefineryLevel: "Fuel Refinery",
	powerPlantLevel: "Power Plant",
	alloyStorageLevel: "Alloy Storage",
	crystalStorageLevel: "Crystal Storage",
	fuelStorageLevel: "Fuel Storage",
} as const satisfies Record<BuildingKey, string>;

const FACILITY_LABELS = {
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
	defense_grid: "Defense Grid",
} as const satisfies Record<FacilityKey, string>;

const DEFENSE_LABELS = {
	missileBattery: "Missile Battery",
	laserTurret: "Laser Turret",
	gaussCannon: "Gauss Cannon",
	shieldDome: "Shield Dome",
} as const satisfies Record<DefenseKey, string>;

type OwnerQueueDisplay = {
	etaLabel: string;
	id: string;
	itemLabel: string;
	lane: "BLD" | "DEF" | "SHP";
	progressPercent: number;
	sortAt: number;
};

type QueueLikeItem = {
	completesAt: number;
	id?: string;
	kind: string;
	payload: unknown;
	startsAt?: number;
};

function SectionRule({
	code,
	label,
	classification = "UNCLASSIFIED",
}: {
	classification?: string;
	code: string;
	label: string;
}) {
	const cls = CLASS_COLORS[classification] ?? CLASS_COLORS.UNCLASSIFIED;
	return (
		<div className="my-5 flex items-center gap-3">
			<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold text-white/20">
				{code}
			</span>
			<div className="h-px flex-1 bg-white/6" />
			<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.15em] text-white/30 uppercase">
				{label}
			</span>
			<div className="h-px flex-1 bg-white/6" />
			<span
				className={`rounded border px-1.5 py-0.5 font-(family-name:--nv-font-mono) text-[7px] font-bold tracking-[0.2em] ${cls}`}
			>
				{classification}
			</span>
		</div>
	);
}

function DataRow({ label, value, mono = true }: { label: string; mono?: boolean; value: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between border-b border-white/3 py-1 last:border-0">
			<span className="font-(family-name:--nv-font-mono) text-[10px] text-white/30">{label}</span>
			<span
				className={`text-[11px] text-white/75 ${mono ? "font-(family-name:--nv-font-mono) font-semibold" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}

function formatAddressLabel(addressLabel: string) {
	return addressLabel.replace(/:SYS/g, " · Sys").replace(/:S/g, " · S").replace(/:P/g, " · P");
}

function formatPlanetType(type: "metallic" | "silicate" | "icy" | "volatileRich") {
	switch (type) {
		case "volatileRich":
			return "Volatile Rich";
		case "metallic":
			return "Metallic";
		case "silicate":
			return "Silicate";
		case "icy":
			return "Icy";
	}
}

function formatMultiplier(multiplier: number) {
	return `${Math.round(multiplier * 100)}%`;
}

function getOwnerQueueItemLabel(item: QueueLikeItem) {
	if (
		item.kind === "buildingUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"buildingKey" in item.payload
	) {
		const payload = item.payload as {
			buildingKey: BuildingKey;
			toLevel: number;
		};
		return `${BUILDING_LABELS[payload.buildingKey]} Lv ${payload.toLevel}`;
	}
	if (
		item.kind === "facilityUpgrade" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"facilityKey" in item.payload
	) {
		const payload = item.payload as {
			facilityKey: FacilityKey;
			toLevel: number;
		};
		return `${FACILITY_LABELS[payload.facilityKey]} Lv ${payload.toLevel}`;
	}
	if (
		item.kind === "shipBuild" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"shipKey" in item.payload
	) {
		const payload = item.payload as {
			quantity: number;
			shipKey: ShipKey;
		};
		return `${SHIP_LABELS[payload.shipKey]} ×${payload.quantity}`;
	}
	if (
		item.kind === "defenseBuild" &&
		typeof item.payload === "object" &&
		item.payload !== null &&
		"defenseKey" in item.payload
	) {
		const payload = item.payload as {
			defenseKey: DefenseKey;
			quantity: number;
		};
		return `${DEFENSE_LABELS[payload.defenseKey]} ×${payload.quantity}`;
	}
	return "Queued task";
}

function collectOwnerQueueDisplays(args: {
	nowMs: number;
	queueLanes: NonNullable<ReturnType<typeof useColonySelectors>>["queueLanes"];
}) {
	const lanes = [
		{ code: "BLD" as const, items: [args.queueLanes.lanes.building.activeItem, ...args.queueLanes.lanes.building.pendingItems] },
		{ code: "DEF" as const, items: [args.queueLanes.lanes.defense.activeItem, ...args.queueLanes.lanes.defense.pendingItems] },
		{ code: "SHP" as const, items: [args.queueLanes.lanes.shipyard.activeItem, ...args.queueLanes.lanes.shipyard.pendingItems] },
	];

	return lanes
		.flatMap((lane) =>
			(lane.items.filter(Boolean) as QueueLikeItem[]).slice(0, 1).map((item) => ({
					id: item.id ?? `${lane.code}-${item.completesAt}`,
					itemLabel: getOwnerQueueItemLabel(item),
					lane: lane.code,
					etaLabel: formatQueueRemainingLabel(args.nowMs, item.completesAt),
					progressPercent: getQueueProgress(args.nowMs, item.startsAt, item.completesAt).percent,
					sortAt: item.completesAt,
				})),
		)
		.sort((left, right) => left.sortAt - right.sortAt);
}

function buildOwnerResources(args: {
	caps: { alloy: number; crystal: number; fuel: number };
	rates: { alloy: number; crystal: number; fuel: number };
	stored: { alloy: number; crystal: number; fuel: number };
}) {
	return [
		{
			key: "alloy" as const,
			label: "alloy",
			value: `${formatResourceValue(args.stored.alloy)} / ${formatResourceValue(args.caps.alloy)} (${formatResourceValue(args.rates.alloy)}/m)`,
		},
		{
			key: "crystal" as const,
			label: "crystal",
			value: `${formatResourceValue(args.stored.crystal)} / ${formatResourceValue(args.caps.crystal)} (${formatResourceValue(args.rates.crystal)}/m)`,
		},
		{
			key: "fuel" as const,
			label: "fuel",
			value: `${formatResourceValue(args.stored.fuel)} / ${formatResourceValue(args.caps.fuel)} (${formatResourceValue(args.rates.fuel)}/m)`,
		},
	];
}

function ColonyOverviewRoute() {
	const { colonyId } = Route.useParams();
	const colonyIdAsId = colonyId as Id<"colonies">;
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
	const overview = useQuery(api.colonyOverview.getColonyOverview, {
		colonyId: colonyIdAsId,
	});
	const isOwnerView = overview?.viewerRelation === "owner";
	const colonySelectors = useColonySelectors(isAuthenticated && isOwnerView ? colonyIdAsId : null);
	const colonyResources = useColonyResources(isAuthenticated && isOwnerView ? colonyIdAsId : null);
	const [clientNowMs, setClientNowMs] = useState(() => Date.now());

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setClientNowMs(Date.now());
		}, 1_000);
		return () => {
			window.clearInterval(intervalId);
		};
	}, []);

	const ownerReady =
		!isOwnerView ||
		(isAuthenticated &&
			!!colonySelectors &&
			!!colonyResources.snapshot &&
			!!colonyResources.projected);

	const nowMs = isOwnerView ? colonyResources.nowMs : clientNowMs;

	const ownerQueues = useMemo(
		() =>
			colonySelectors
				? collectOwnerQueueDisplays({
						nowMs,
						queueLanes: colonySelectors.queueLanes,
					})
				: [],
		[colonySelectors, nowMs],
	);

	const ownerResources = useMemo(() => {
		if (!colonyResources.projected) {
			return [];
		}
		return buildOwnerResources({
			caps: colonyResources.projected.storageCaps,
			rates: colonyResources.projected.ratesPerMinute,
			stored: colonyResources.projected.stored,
		});
	}, [colonyResources.projected]);

	if (!overview || (isOwnerView && (isAuthLoading || !ownerReady))) {
		return <OverviewRouteSkeleton />;
	}

	const statusColors: Record<(typeof overview.header)["status"], string> = {
		calm: "text-emerald-300/70",
		active: "text-cyan-300/70",
		"under attack": "text-rose-300",
		upgrading: "text-amber-300/70",
		"high traffic": "text-violet-300/70",
	};
	const nextEventLabel = overview.timing.nextEventAt
		? formatColonyDuration(Math.max(0, overview.timing.nextEventAt - nowMs), "milliseconds")
		: null;

	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: dossierStyles }} />
			<div className="mx-auto w-full max-w-[920px] px-4 pt-2 pb-16 text-white">
				<div className="mb-0 flex items-end gap-0">
					<div className="dossier-tab border-x border-t border-white/8 bg-[rgba(12,18,30,0.95)] px-6 py-1.5">
						<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.2em] text-white/30">
							INTELLIGENCE BRIEF
						</span>
					</div>
					<div className="flex-1 border-b border-white/8" />
				</div>

				<div className="dossier-paper relative overflow-hidden border border-white/8 px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_80%_100%,rgba(255,255,255,0.03),transparent_35%)]" />

					<div className="relative z-10">
						<div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
							<div>
								<p className="font-(family-name:--nv-font-mono) text-[10px] tracking-[0.25em] text-white/25 uppercase">
									Colony Overview
								</p>
								<h1 className="mt-1 font-(family-name:--nv-font-display) text-3xl font-black tracking-tight text-white sm:text-4xl">
									{overview.header.name}
								</h1>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/38">
									<span className="flex items-center gap-1">
										<Users className="size-3" />
										{overview.header.ownerName}
									</span>
									<span className="size-1 rounded-full bg-white/15" />
									<span>{overview.header.factionPlaceholder}</span>
									<span className="size-1 rounded-full bg-white/15" />
									<span className="flex items-center gap-1">
										<MapPin className="size-3" />
										{formatAddressLabel(overview.header.addressLabel)}
									</span>
								</div>
							</div>
							<div className="flex flex-col items-start gap-2 sm:items-end">
								<div className="rounded border border-white/10 px-2 py-1 font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.2em] text-white/35">
									{overview.header.fileId}
								</div>
								<div className="flex items-center gap-2">
									<span
										className={`font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.18em] uppercase ${statusColors[overview.header.status] ?? "text-white/60"}`}
									>
										{overview.header.status}
									</span>
									<span className="rounded border border-amber-400/30 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[8px] font-bold tracking-[0.2em] text-amber-300/70">
										{overview.header.classification}
									</span>
								</div>
							</div>
						</div>

						<SectionRule
							code="SEC-01"
							label="Planet Profile"
							classification={overview.header.classification}
						/>
						<div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
							<div className="space-y-2">
								<DataRow label="TYPE" value={formatPlanetType(overview.planet.compositionType)} />
								<DataRow label="TIER" value={overview.planet.tierPlaceholder} />
								<DataRow
									label="SLOTS"
									value={`${overview.planet.usedSlots}/${overview.planet.maxSlots}`}
								/>
								<DataRow label="ALLOY MULT" value={formatMultiplier(overview.planet.multipliers.alloy)} />
								<DataRow
									label="CRYSTAL MULT"
									value={formatMultiplier(overview.planet.multipliers.crystal)}
								/>
								<DataRow label="FUEL MULT" value={formatMultiplier(overview.planet.multipliers.fuel)} />
							</div>
							<div className="rounded border border-white/8 bg-white/[0.03] p-3">
								<div className="mb-2 flex items-center gap-2 text-white/45">
									<Globe2 className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
										Planetary Notes
									</span>
								</div>
								<div className="space-y-2 text-[12px] text-white/70">
									{overview.planet.notes.map((bonus: string) => (
										<div key={bonus} className="flex items-start gap-2">
											<ArrowUpRight className="mt-0.5 size-3 text-emerald-300/70" />
											<span>{bonus}</span>
										</div>
									))}
								</div>
							</div>
						</div>

						<SectionRule code="SEC-02" label="Infrastructure" classification="RESTRICTED" />
						<div className="grid gap-5 md:grid-cols-2">
							<div>
								<div className="mb-2 flex items-center gap-2 text-white/45">
									<Factory className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
										Buildings
									</span>
								</div>
								<div className="space-y-1">
									{overview.infrastructure.buildings.map((building: (typeof overview.infrastructure.buildings)[number]) => (
										<DataRow key={building.key} label={building.name} value={`LV ${building.level}`} />
									))}
								</div>
							</div>
							<div>
								<div className="mb-2 flex items-center gap-2 text-white/45">
									<Zap className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
										Facilities
									</span>
								</div>
								<div className="space-y-1">
									{overview.infrastructure.facilities.map((facility: (typeof overview.infrastructure.facilities)[number]) => (
										<DataRow key={facility.key} label={facility.name} value={`LV ${facility.level}`} />
									))}
								</div>
							</div>
						</div>

						<SectionRule code="SEC-03" label="Defense & Fleet" classification="CLASSIFIED" />
						<div className="grid gap-5 md:grid-cols-2">
							<div className="rounded border border-rose-400/15 bg-rose-400/[0.04] p-3">
								<div className="mb-3 flex items-center justify-between">
									<div className="flex items-center gap-2 text-rose-200/80">
										<Shield className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
											Defense Grid
										</span>
									</div>
									<span className="dossier-stamp rotate-[-6deg] border border-rose-400/40 px-2 py-0.5 font-(family-name:--nv-font-display) text-[10px] font-black tracking-[0.2em] text-rose-300/75">
										{overview.header.status === "under attack" ? "ALERT" : "MONITOR"}
									</span>
								</div>
								<DataRow label="FIREPOWER" value={overview.defense.firepower.toLocaleString()} />
								<DataRow label="SHIELD" value={overview.defense.shieldLabel.toUpperCase()} />
								<DataRow
									label="LAST RAID"
									value={
										overview.defense.lastRaid
											? `${overview.defense.lastRaid.factionName} / ${overview.defense.lastRaid.outcomeLabel}`
											: "No recent raid data"
									}
									mono={false}
								/>
								<div className="mt-3 space-y-1">
									{overview.defense.units.map((unit: (typeof overview.defense.units)[number]) => (
										<DataRow key={unit.key} label={unit.name} value={unit.count.toLocaleString()} />
									))}
								</div>
							</div>
							<div className="rounded border border-cyan-400/15 bg-cyan-400/[0.03] p-3">
								<div className="mb-3 flex items-center gap-2 text-cyan-200/75">
									<Ship className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
										Fleet Posture
									</span>
								</div>
								<DataRow label="TOTAL DOCKED" value={overview.fleet.totalDocked.toLocaleString()} />
								<DataRow
									label="INBOUND"
									value={`F ${overview.fleet.inboundFriendly} / H ${overview.fleet.inboundHostile}`}
								/>
								<DataRow label="OUTBOUND" value={overview.fleet.outbound.toLocaleString()} />
								<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
									{(Object.entries(overview.fleet.docked) as Array<[ShipKey, number]>).map(
										([key, value]) => (
											<DataRow
												key={key}
												label={SHIP_LABELS[key]}
												value={value.toLocaleString()}
											/>
										),
									)}
								</div>
							</div>
						</div>

						<SectionRule code="SEC-04" label="Strategic Analysis" classification="RESTRICTED" />
						<div className="space-y-4">
							<div className="flex flex-wrap gap-2">
								{overview.strategic.tags.map((tag: string) => (
									<span
										key={tag}
										className="rounded border border-white/10 px-2 py-1 font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.12em] text-white/45 uppercase"
									>
										{tag}
									</span>
								))}
							</div>
							<div className="rounded border border-white/8 bg-white/[0.03] p-3 text-[12px] leading-6 text-white/72">
								{overview.strategic.notesPlaceholder}
							</div>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Swords className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
											Diplomacy
										</span>
									</div>
									<DataRow label="STANCE" value={overview.viewerRelation === "owner" ? "owner" : "visitor"} />
									<DataRow label="POLICY" value={overview.strategic.diplomacyPolicy} />
								</div>
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Crosshair className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
											Threat
										</span>
									</div>
									<DataRow label="STATUS" value={overview.strategic.threatStatus} mono={false} />
									<DataRow label="VISIBILITY" value={overview.strategic.visibilityPlaceholder} />
								</div>
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Radar className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
											Surveillance
										</span>
									</div>
									<DataRow label="CONTACTS" value={overview.strategic.surveillance.contactsPlaceholder} />
									<DataRow label="ANOMALIES" value={overview.strategic.surveillance.anomaliesPlaceholder} />
								</div>
							</div>
						</div>

						{isOwnerView ? (
							<>
								<SectionRule code="SEC-05" label="Owner Annex" classification="EYES ONLY" />
								<div className="relative overflow-hidden rounded border border-rose-400/20 bg-rose-950/10 p-4">
									<div className="pointer-events-none absolute right-3 top-3">
										<span className="dossier-stamp inline-flex rotate-[-8deg] items-center gap-1 border border-rose-400/35 px-2 py-1 font-(family-name:--nv-font-display) text-[10px] font-black tracking-[0.2em] text-rose-300/70">
											<Eye className="size-3" />
											EYES ONLY
										</span>
									</div>
									<div className="grid gap-5 md:grid-cols-[1fr_1fr]">
										<div>
											<div className="mb-2 flex items-center gap-2 text-white/45">
												<BarChart3 className="size-4" />
												<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
													Resources
												</span>
											</div>
											{ownerResources.map((resource) => (
												<DataRow
													key={resource.key}
													label={resource.label}
													value={resource.value}
													mono={false}
												/>
											))}
										</div>
										<div>
											<div className="mb-2 flex items-center gap-2 text-white/45">
												<FileText className="size-4" />
												<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">
													Queues
												</span>
											</div>
											<div className="space-y-3">
												{ownerQueues.length > 0 ? (
													ownerQueues.map((queue) => (
														<div
															key={queue.id}
															className="rounded border border-white/8 bg-white/[0.03] p-3"
														>
															<div className="mb-2 flex items-center justify-between gap-3">
																<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">
																	{queue.lane}
																</span>
																<span className="font-(family-name:--nv-font-mono) text-[10px] text-white/40">
																	{queue.etaLabel}
																</span>
															</div>
															<p className="text-[12px] text-white/72">{queue.itemLabel}</p>
															<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
																<div
																	className="h-full rounded-full bg-rose-300/60"
																	style={{ width: `${queue.progressPercent}%` }}
																/>
															</div>
														</div>
													))
												) : (
													<div className="rounded border border-white/8 bg-white/[0.03] p-3 text-[12px] text-white/55">
														No active colony queues.
													</div>
												)}
											</div>
										</div>
									</div>
								</div>
							</>
						) : null}

						<SectionRule code="SEC-06" label="Activity Log" classification="UNCLASSIFIED" />
						<div className="rounded border border-white/8 bg-black/20 p-3 font-(family-name:--nv-font-mono)">
							<div className="mb-3 flex items-center justify-between">
								<div className="flex items-center gap-2 text-white/42">
									<Activity className="size-4" />
									<span className="text-[10px] font-bold tracking-[0.16em] uppercase">
										Terminal Feed
									</span>
								</div>
								<div className="flex items-center gap-2 text-[9px] text-white/28">
									<Lock className="size-3" />
									<span>LIVE BUFFER</span>
								</div>
							</div>
							<div className="space-y-2 text-[11px] leading-5">
								{overview.activity.map((entry: (typeof overview.activity)[number], index: number) => {
									const indicator = SEV_INDICATOR[entry.severity];
									return (
										<div
											key={entry.id}
											className="dossier-terminal-line flex items-start gap-3 text-white/70"
											data-line={String(index + 1).padStart(2, "0")}
										>
											<span className={`w-6 shrink-0 font-bold ${indicator.color}`}>
												{indicator.prefix}
											</span>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-baseline gap-x-2">
													<span>{entry.text}</span>
													<span className="text-[10px] text-white/28">{entry.timeLabel}</span>
												</div>
											</div>
										</div>
									);
								})}
								<div className="flex items-center gap-2 pt-1 text-white/28">
									<span className="inline-block h-3 w-1 animate-pulse bg-white/45" />
									<span className="text-[10px] tracking-[0.16em] uppercase">
										{nextEventLabel ? `Next event in ${nextEventLabel}` : "Awaiting next event"}
									</span>
								</div>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3 text-[10px] text-white/25">
							<div className="flex items-center gap-2">
								<AlertTriangle className="size-3" />
								<span>Automated dossier. Values subject to sensor lag.</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1">
									<TrendingUp className="size-3" />
									strategic priority
								</span>
								<span className="flex items-center gap-1">
									<ArrowDownRight className="size-3" />
									contested frontier
								</span>
								<span className="flex items-center gap-1">
									<EyeOff className="size-3" />
									restricted circulation
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
