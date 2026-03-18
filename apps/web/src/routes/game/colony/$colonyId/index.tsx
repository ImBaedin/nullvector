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

const D = {
	name: "Obsidian Reach",
	owner: "Commander Voss",
	faction: "Frontier Coalition",
	address: "G2 · S1 · Sys3 · P5",
	fileId: "NV-INT-2847-FOXTROT",
	status: "under attack" as const,
	classification: "RESTRICTED" as const,
	planet: {
		type: "volatileRich" as const,
		tier: "IV",
		slots: { used: 20, max: 22 },
		multipliers: { alloy: 0.9, crystal: 1.0, fuel: 1.45 },
		bonuses: ["Gas giant proximity bonus", "Volatile extraction +15%"],
	},
	buildings: [
		{ name: "Alloy Mine", lv: 10 },
		{ name: "Crystal Mine", lv: 9 },
		{ name: "Fuel Refinery", lv: 14 },
		{ name: "Power Plant", lv: 12 },
		{ name: "Alloy Storage", lv: 5 },
		{ name: "Crystal Storage", lv: 5 },
		{ name: "Fuel Storage", lv: 7 },
	],
	facilities: [
		{ name: "Robotics Hub", lv: 5 },
		{ name: "Shipyard", lv: 7 },
		{ name: "Defense Grid", lv: 6 },
	],
	defense: {
		power: 52_800,
		shield: "damaged" as const,
		units: [
			{ name: "Missile Battery", count: 55 },
			{ name: "Laser Turret", count: 30 },
			{ name: "Gauss Cannon", count: 14 },
			{ name: "Shield Dome", count: 1 },
		],
		lastRaid: { faction: "Space Pirates", outcome: "ONGOING", time: "NOW" },
	},
	fleet: {
		docked: { interceptor: 20, frigate: 12, cruiser: 4, bomber: 2, smallCargo: 6, largeCargo: 4 },
		total: 48,
		inbound: { friendly: 3, hostile: 1 },
		outbound: 1,
	},
	activity: [
		{ text: "ALERT: Space Pirate raid wave 2 — shields breached", time: "T+00:00", sev: "critical" as const },
		{ text: "Reinforcement fleet inbound from Forge Primaris", time: "T+04:12", sev: "info" as const },
		{ text: "Gauss Cannon battery #3 scoring hits on hostile frigate", time: "T+06:44", sev: "success" as const },
		{ text: "Fuel shipment departed for Nexus-7 (pre-raid order)", time: "T+58:20", sev: "neutral" as const },
		{ text: "NPC scout detected at jump point Sigma-4", time: "T+122:00", sev: "warning" as const },
	],
	strategic: {
		tags: ["Fuel Exporter", "Frontier Outpost", "Contested Zone"],
		notes: "Controls the only fuel-rich planet in Sector 1. Frequent pirate raids make it a high-value but high-risk position. Loss would cripple frontier fuel supply.",
	},
	diplomacy: { stance: "hostile" as const, policy: "denyAll" as const },
	resources: { alloy: 32_440, crystal: 28_100, fuel: 105_800 },
	caps: { alloy: 60_000, crystal: 55_000, fuel: 140_000 },
	rates: { alloy: 186, crystal: 162, fuel: 388 },
	queues: [
		{ lane: "DEF", item: "Laser Turret ×8", eta: "6m 12s", pct: 72 },
		{ lane: "BLD", item: "Fuel Refinery Lv 15", eta: "28m 44s", pct: 14 },
		{ lane: "SHP", item: "Cruiser ×2", eta: "14m 08s", pct: 38 },
	],
};

const IS_OWNER = true;

const CLASS_COLORS: Record<string, string> = {
	UNCLASSIFIED: "text-white/15 border-white/10",
	RESTRICTED: "text-amber-400/50 border-amber-400/30",
	CLASSIFIED: "text-rose-400/50 border-rose-400/30",
	"EYES ONLY": "text-rose-400/70 border-rose-400/50",
};

function SectionRule({ code, label, classification = "UNCLASSIFIED" }: { code: string; label: string; classification?: string }) {
	const cls = CLASS_COLORS[classification] ?? CLASS_COLORS.UNCLASSIFIED;
	return (
		<div className="my-5 flex items-center gap-3">
			<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold text-white/20">{code}</span>
			<div className="h-px flex-1 bg-white/6" />
			<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.15em] text-white/30 uppercase">{label}</span>
			<div className="h-px flex-1 bg-white/6" />
			<span className={`rounded border px-1.5 py-0.5 font-(family-name:--nv-font-mono) text-[7px] font-bold tracking-[0.2em] ${cls}`}>{classification}</span>
		</div>
	);
}

function DataRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
	return (
		<div className="flex items-baseline justify-between border-b border-white/3 py-1 last:border-0">
			<span className="font-(family-name:--nv-font-mono) text-[10px] text-white/30">{label}</span>
			<span className={`text-[11px] text-white/75 ${mono ? "font-(family-name:--nv-font-mono) font-semibold" : ""}`}>{value}</span>
		</div>
	);
}

const SEV_INDICATOR: Record<string, { prefix: string; color: string }> = {
	critical: { prefix: "!!!", color: "text-rose-300" },
	warning: { prefix: " ! ", color: "text-amber-300/80" },
	info: { prefix: " i ", color: "text-cyan-300/70" },
	success: { prefix: " + ", color: "text-emerald-300/70" },
	neutral: { prefix: " . ", color: "text-white/40" },
};

function ColonyOverviewRoute() {
	const statusColors: Record<string, string> = {
		calm: "text-emerald-300/70",
		active: "text-cyan-300/70",
		"under attack": "text-rose-300",
		upgrading: "text-amber-300/70",
		"high traffic": "text-violet-300/70",
	};

	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: dossierStyles }} />
			<div className="mx-auto w-full max-w-[920px] px-4 pt-2 pb-16 text-white">
				<div className="mb-0 flex items-end gap-0">
					<div className="dossier-tab border-x border-t border-white/8 bg-[rgba(12,18,30,0.95)] px-6 py-1.5">
						<span className="font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.2em] text-white/30">INTELLIGENCE BRIEF</span>
					</div>
					<div className="flex-1 border-b border-white/8" />
				</div>

				<div className="dossier-paper relative overflow-hidden border border-white/8 px-5 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_80%_100%,rgba(255,255,255,0.03),transparent_35%)]" />

					<div className="relative z-10">
						<div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
							<div>
								<p className="font-(family-name:--nv-font-mono) text-[10px] tracking-[0.25em] text-white/25 uppercase">Colony Overview</p>
								<h1 className="mt-1 font-(family-name:--nv-font-display) text-3xl font-black tracking-tight text-white sm:text-4xl">{D.name}</h1>
								<div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/38">
									<span className="flex items-center gap-1"><Users className="size-3" />{D.owner}</span>
									<span className="size-1 rounded-full bg-white/15" />
									<span>{D.faction}</span>
									<span className="size-1 rounded-full bg-white/15" />
									<span className="flex items-center gap-1"><MapPin className="size-3" />{D.address}</span>
								</div>
							</div>
							<div className="flex flex-col items-start gap-2 sm:items-end">
								<div className="rounded border border-white/10 px-2 py-1 font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.2em] text-white/35">
									{D.fileId}
								</div>
								<div className="flex items-center gap-2">
									<span className={`font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.18em] uppercase ${statusColors[D.status] ?? "text-white/60"}`}>
										{D.status}
									</span>
									<span className="rounded border border-amber-400/30 px-2 py-0.5 font-(family-name:--nv-font-mono) text-[8px] font-bold tracking-[0.2em] text-amber-300/70">
										{D.classification}
									</span>
								</div>
							</div>
						</div>

						<SectionRule code="SEC-01" label="Planet Profile" classification={D.classification} />
						<div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
							<div className="space-y-2">
								<DataRow label="TYPE" value={<span className="capitalize">{D.planet.type}</span>} />
								<DataRow label="TIER" value={D.planet.tier} />
								<DataRow label="SLOTS" value={`${D.planet.slots.used}/${D.planet.slots.max}`} />
								<DataRow label="ALLOY MULT" value={`${Math.round(D.planet.multipliers.alloy * 100)}%`} />
								<DataRow label="CRYSTAL MULT" value={`${Math.round(D.planet.multipliers.crystal * 100)}%`} />
								<DataRow label="FUEL MULT" value={`${Math.round(D.planet.multipliers.fuel * 100)}%`} />
							</div>
							<div className="rounded border border-white/8 bg-white/[0.03] p-3">
								<div className="mb-2 flex items-center gap-2 text-white/45">
									<Globe2 className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Planetary Notes</span>
								</div>
								<div className="space-y-2 text-[12px] text-white/70">
									{D.planet.bonuses.map((bonus) => (
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
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Buildings</span>
								</div>
								<div className="space-y-1">
									{D.buildings.map((building) => (
										<DataRow key={building.name} label={building.name} value={`LV ${building.lv}`} />
									))}
								</div>
							</div>
							<div>
								<div className="mb-2 flex items-center gap-2 text-white/45">
									<Zap className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Facilities</span>
								</div>
								<div className="space-y-1">
									{D.facilities.map((facility) => (
										<DataRow key={facility.name} label={facility.name} value={`LV ${facility.lv}`} />
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
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Defense Grid</span>
									</div>
									<span className="dossier-stamp rotate-[-6deg] border border-rose-400/40 px-2 py-0.5 font-(family-name:--nv-font-display) text-[10px] font-black tracking-[0.2em] text-rose-300/75">
										ALERT
									</span>
								</div>
								<DataRow label="FIREPOWER" value={D.defense.power.toLocaleString()} />
								<DataRow label="SHIELD" value={D.defense.shield.toUpperCase()} />
								<DataRow label="LAST RAID" value={`${D.defense.lastRaid.faction} / ${D.defense.lastRaid.outcome}`} mono={false} />
								<div className="mt-3 space-y-1">
									{D.defense.units.map((unit) => (
										<DataRow key={unit.name} label={unit.name} value={unit.count.toLocaleString()} />
									))}
								</div>
							</div>
							<div className="rounded border border-cyan-400/15 bg-cyan-400/[0.03] p-3">
								<div className="mb-3 flex items-center gap-2 text-cyan-200/75">
									<Ship className="size-4" />
									<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Fleet Posture</span>
								</div>
								<DataRow label="TOTAL DOCKED" value={D.fleet.total.toLocaleString()} />
								<DataRow label="INBOUND" value={`F ${D.fleet.inbound.friendly} / H ${D.fleet.inbound.hostile}`} />
								<DataRow label="OUTBOUND" value={D.fleet.outbound.toLocaleString()} />
								<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
									{Object.entries(D.fleet.docked).map(([key, value]) => (
										<DataRow key={key} label={key} value={value.toLocaleString()} />
									))}
								</div>
							</div>
						</div>

						<SectionRule code="SEC-04" label="Strategic Analysis" classification="RESTRICTED" />
						<div className="space-y-4">
							<div className="flex flex-wrap gap-2">
								{D.strategic.tags.map((tag) => (
									<span key={tag} className="rounded border border-white/10 px-2 py-1 font-(family-name:--nv-font-mono) text-[9px] font-bold tracking-[0.12em] text-white/45 uppercase">
										{tag}
									</span>
								))}
							</div>
							<div className="rounded border border-white/8 bg-white/[0.03] p-3 text-[12px] leading-6 text-white/72">
								{D.strategic.notes}
							</div>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Swords className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Diplomacy</span>
									</div>
									<DataRow label="STANCE" value={D.diplomacy.stance} />
									<DataRow label="POLICY" value={D.diplomacy.policy} />
								</div>
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Crosshair className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Threat</span>
									</div>
									<DataRow label="STATUS" value={D.status} />
									<DataRow label="VISIBILITY" value="CONTESTED" />
								</div>
								<div className="rounded border border-white/8 bg-white/[0.03] p-3">
									<div className="mb-2 flex items-center gap-2 text-white/45">
										<Radar className="size-4" />
										<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Surveillance</span>
									</div>
									<DataRow label="CONTACTS" value="7" />
									<DataRow label="ANOMALIES" value="1" />
								</div>
							</div>
						</div>

						{IS_OWNER ? (
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
												<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Resources</span>
											</div>
											{Object.entries(D.resources).map(([key, value]) => (
												<DataRow
													key={key}
													label={key}
													value={`${value.toLocaleString()} / ${D.caps[key as keyof typeof D.caps].toLocaleString()} (${D.rates[key as keyof typeof D.rates]}/m)`}
													mono={false}
												/>
											))}
										</div>
										<div>
											<div className="mb-2 flex items-center gap-2 text-white/45">
												<FileText className="size-4" />
												<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] uppercase">Queues</span>
											</div>
											<div className="space-y-3">
												{D.queues.map((queue) => (
													<div key={`${queue.lane}-${queue.item}`} className="rounded border border-white/8 bg-white/[0.03] p-3">
														<div className="mb-2 flex items-center justify-between gap-3">
															<span className="font-(family-name:--nv-font-mono) text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">{queue.lane}</span>
															<span className="font-(family-name:--nv-font-mono) text-[10px] text-white/40">{queue.eta}</span>
														</div>
														<p className="text-[12px] text-white/72">{queue.item}</p>
														<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
															<div className="h-full rounded-full bg-rose-300/60" style={{ width: `${queue.pct}%` }} />
														</div>
													</div>
												))}
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
									<span className="text-[10px] font-bold tracking-[0.16em] uppercase">Terminal Feed</span>
								</div>
								<div className="flex items-center gap-2 text-[9px] text-white/28">
									<Lock className="size-3" />
									<span>LIVE BUFFER</span>
								</div>
							</div>
							<div className="space-y-2 text-[11px] leading-5">
								{D.activity.map((entry, index) => {
									const indicator = SEV_INDICATOR[entry.sev];
									return (
										<div key={`${entry.time}-${entry.text}`} className="dossier-terminal-line flex items-start gap-3 text-white/70" data-line={String(index + 1).padStart(2, "0")}>
											<span className={`w-6 shrink-0 font-bold ${indicator.color}`}>{indicator.prefix}</span>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-baseline gap-x-2">
													<span>{entry.text}</span>
													<span className="text-[10px] text-white/28">{entry.time}</span>
												</div>
											</div>
										</div>
									);
								})}
								<div className="flex items-center gap-2 pt-1 text-white/28">
									<span className="inline-block h-3 w-1 animate-pulse bg-white/45" />
									<span className="text-[10px] tracking-[0.16em] uppercase">Awaiting next event</span>
								</div>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3 text-[10px] text-white/25">
							<div className="flex items-center gap-2">
								<AlertTriangle className="size-3" />
								<span>Automated dossier. Values subject to sensor lag.</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="flex items-center gap-1"><TrendingUp className="size-3" /> strategic priority</span>
								<span className="flex items-center gap-1"><ArrowDownRight className="size-3" /> contested frontier</span>
								<span className="flex items-center gap-1"><EyeOff className="size-3" /> restricted circulation</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
