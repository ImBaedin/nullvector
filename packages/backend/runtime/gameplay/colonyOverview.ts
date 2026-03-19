import {
	estimateColonyDefensePower,
	HOSTILE_FACTIONS,
	normalizeDefenseCounts,
	normalizeShipCounts,
	type DefenseCounts,
	type DefenseKey,
	type ShipCounts,
	type ShipKey,
} from "@nullvector/game-logic";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { query, type QueryCtx } from "../../convex/_generated/server";
import {
	listOpenColonyQueueItems,
	loadColonyState,
	loadPlanetState,
	readColonyDefenseCounts,
	resolveCurrentPlayer,
	storedToWholeUnits,
	toAddressLabel,
} from "./shared";

const BUILDING_LABELS = {
	alloyMineLevel: "Alloy Mine",
	crystalMineLevel: "Crystal Mine",
	fuelRefineryLevel: "Fuel Refinery",
	powerPlantLevel: "Power Plant",
	alloyStorageLevel: "Alloy Storage",
	crystalStorageLevel: "Crystal Storage",
	fuelStorageLevel: "Fuel Storage",
} as const;

const FACILITY_LABELS = {
	robotics_hub: "Robotics Hub",
	shipyard: "Shipyard",
	defense_grid: "Defense Grid",
} as const;

const SHIP_LABELS = {
	smallCargo: "Small Cargo",
	largeCargo: "Large Cargo",
	colonyShip: "Colony Ship",
	interceptor: "Interceptor",
	frigate: "Frigate",
	cruiser: "Cruiser",
	bomber: "Bomber",
} as const satisfies Record<ShipKey, string>;

const DEFENSE_LABELS = {
	missileBattery: "Missile Battery",
	laserTurret: "Laser Turret",
	gaussCannon: "Gauss Cannon",
	shieldDome: "Shield Dome",
} as const satisfies Record<DefenseKey, string>;

const viewerRelationValidator = v.union(
	v.literal("anonymous"),
	v.literal("otherPlayer"),
	v.literal("owner"),
);

const statusValidator = v.union(
	v.literal("calm"),
	v.literal("active"),
	v.literal("under attack"),
	v.literal("upgrading"),
	v.literal("high traffic"),
);

const classificationValidator = v.union(v.literal("RESTRICTED"), v.literal("CLASSIFIED"));

const shipCountsValidator = v.object({
	smallCargo: v.number(),
	largeCargo: v.number(),
	colonyShip: v.number(),
	interceptor: v.number(),
	frigate: v.number(),
	cruiser: v.number(),
	bomber: v.number(),
});

const defenseCountValidator = v.object({
	missileBattery: v.number(),
	laserTurret: v.number(),
	gaussCannon: v.number(),
	shieldDome: v.number(),
});

const activitySeverityValidator = v.union(
	v.literal("critical"),
	v.literal("warning"),
	v.literal("info"),
	v.literal("success"),
	v.literal("neutral"),
);

const activityEntryValidator = v.object({
	id: v.string(),
	text: v.string(),
	severity: activitySeverityValidator,
	occurredAt: v.number(),
	timeLabel: v.string(),
});

const lastRaidValidator = v.union(
	v.object({
		kind: v.literal("active"),
		factionName: v.string(),
		outcomeLabel: v.literal("ONGOING"),
		occurredAt: v.number(),
	}),
	v.object({
		kind: v.literal("result"),
		factionName: v.string(),
		outcomeLabel: v.string(),
		occurredAt: v.number(),
	}),
	v.null(),
);

export const colonyOverviewValidator = v.object({
	colonyId: v.id("colonies"),
	viewerRelation: viewerRelationValidator,
	header: v.object({
		name: v.string(),
		ownerName: v.string(),
		addressLabel: v.string(),
		fileId: v.string(),
		status: statusValidator,
		classification: classificationValidator,
		factionPlaceholder: v.string(),
	}),
	planet: v.object({
		compositionType: v.union(
			v.literal("metallic"),
			v.literal("silicate"),
			v.literal("icy"),
			v.literal("volatileRich"),
		),
		tierPlaceholder: v.string(),
		usedSlots: v.number(),
		maxSlots: v.number(),
		multipliers: v.object({
			alloy: v.number(),
			crystal: v.number(),
			fuel: v.number(),
		}),
		notes: v.array(v.string()),
	}),
	infrastructure: v.object({
		buildings: v.array(
			v.object({
				key: v.string(),
				name: v.string(),
				level: v.number(),
			}),
		),
		facilities: v.array(
			v.object({
				key: v.union(v.literal("robotics_hub"), v.literal("shipyard"), v.literal("defense_grid")),
				name: v.string(),
				level: v.number(),
			}),
		),
	}),
	defense: v.object({
		firepower: v.number(),
		shieldLabel: v.string(),
		units: v.array(
			v.object({
				key: v.union(
					v.literal("missileBattery"),
					v.literal("laserTurret"),
					v.literal("gaussCannon"),
					v.literal("shieldDome"),
				),
				name: v.string(),
				count: v.number(),
			}),
		),
		lastRaid: lastRaidValidator,
	}),
	fleet: v.object({
		docked: shipCountsValidator,
		totalDocked: v.number(),
		inboundFriendly: v.number(),
		inboundHostile: v.number(),
		outbound: v.number(),
	}),
	strategic: v.object({
		tags: v.array(v.string()),
		notesPlaceholder: v.string(),
		diplomacyPolicy: v.union(
			v.literal("allowAll"),
			v.literal("denyAll"),
			v.literal("alliesOnly"),
			v.literal("unknown"),
		),
		threatStatus: v.string(),
		visibilityPlaceholder: v.string(),
		surveillance: v.object({
			contactsPlaceholder: v.string(),
			anomaliesPlaceholder: v.string(),
		}),
	}),
	activity: v.array(activityEntryValidator),
	timing: v.object({
		nextEventAt: v.optional(v.number()),
		serverNowMs: v.number(),
	}),
});

type OverviewStatus = "calm" | "active" | "under attack" | "upgrading" | "high traffic";
type ActivitySeverity = "critical" | "warning" | "info" | "success" | "neutral";

type FleetActivityOperation = Pick<
	Doc<"fleetOperations">,
	"_id" | "arriveAt" | "nextEventAt" | "originColonyId" | "ownerPlayerId" | "status" | "target"
>;

function formatElapsedLabel(args: { now: number; occurredAt: number }) {
	const deltaMs = Math.max(0, args.now - args.occurredAt);
	const totalSeconds = Math.max(0, Math.floor(deltaMs / 1_000));
	if (totalSeconds < 10) {
		return "NOW";
	}
	if (totalSeconds < 60) {
		return `${totalSeconds}s ago`;
	}
	if (totalSeconds < 3_600) {
		return `${Math.floor(totalSeconds / 60)}m ago`;
	}
	return `${Math.floor(totalSeconds / 3_600)}h ago`;
}

function formatEtaLabel(args: { now: number; at: number }) {
	const deltaMs = Math.max(0, args.at - args.now);
	const totalSeconds = Math.max(0, Math.ceil(deltaMs / 1_000));
	if (totalSeconds < 10) {
		return "NOW";
	}
	if (totalSeconds < 60) {
		return `ETA ${totalSeconds}s`;
	}
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes < 60) {
		return `ETA ${minutes}m ${String(seconds).padStart(2, "0")}s`;
	}
	const hours = Math.floor(minutes / 60);
	const remMinutes = minutes % 60;
	return `ETA ${hours}h ${String(remMinutes).padStart(2, "0")}m`;
}

function buildPlanetNotes(args: {
	alloyMultiplier: number;
	compositionType: "metallic" | "silicate" | "icy" | "volatileRich";
	crystalMultiplier: number;
	fuelMultiplier: number;
}) {
	const notes: string[] = [];

	if (args.fuelMultiplier > 1) {
		notes.push(`Volatile extraction +${Math.round((args.fuelMultiplier - 1) * 100)}%`);
	}
	if (args.alloyMultiplier > 1) {
		notes.push(`Dense ore seams +${Math.round((args.alloyMultiplier - 1) * 100)}% alloy yield`);
	}
	if (args.crystalMultiplier > 1) {
		notes.push(`High-grade crystal lattice +${Math.round((args.crystalMultiplier - 1) * 100)}%`);
	}
	if (notes.length === 0) {
		notes.push("No unusual extraction modifiers recorded in the latest survey.");
	}

	const compositionNote =
		args.compositionType === "volatileRich"
			? "Gas giant adjacency remains favorable for fuel harvest."
			: args.compositionType === "metallic"
				? "Metal-rich crust supports heavy industrial extraction."
				: args.compositionType === "icy"
					? "Cryotic layers complicate expansion but stabilize reserves."
					: "Silicate surface yields balanced but unremarkable output.";
	notes.push(compositionNote);

	return notes.slice(0, 3);
}

function buildStrategicTags(args: {
	alloyMultiplier: number;
	crystalMultiplier: number;
	fuelMultiplier: number;
	status: OverviewStatus;
}) {
	const tags: string[] = [];
	if (
		args.fuelMultiplier > args.alloyMultiplier &&
		args.fuelMultiplier > args.crystalMultiplier
	) {
		tags.push("Fuel Exporter");
	}
	if (args.alloyMultiplier > 1.1) {
		tags.push("Industrial Yield");
	}
	if (args.crystalMultiplier > 1.1) {
		tags.push("Crystal Veins");
	}
	if (args.status === "under attack") {
		tags.push("Contested Zone");
	}
	if (args.status === "high traffic") {
		tags.push("Transit Node");
	}
	if (tags.length === 0) {
		tags.push("Sector Holding");
	}
	return tags.slice(0, 3);
}

export function deriveOverviewStatus(args: {
	activeRaid: Doc<"npcRaidOperations"> | null;
	hasOpenQueue: boolean;
	hostileInboundCount: number;
	inboundFriendlyCount: number;
	outboundCount: number;
}): OverviewStatus {
	if (args.activeRaid || args.hostileInboundCount > 0) {
		return "under attack";
	}
	const trafficCount = args.inboundFriendlyCount + args.hostileInboundCount + args.outboundCount;
	if (trafficCount >= 3) {
		return "high traffic";
	}
	if (args.hasOpenQueue) {
		return "upgrading";
	}
	if (trafficCount > 0) {
		return "active";
	}
	return "calm";
}

export function deriveShieldLabel(args: {
	activeRaid: Doc<"npcRaidOperations"> | null;
	lastRaidResult: Doc<"npcRaidResults"> | null;
}): "damaged" | "recovering" | "stable" {
	if (args.activeRaid) {
		return "damaged";
	}
	if (args.lastRaidResult?.success === false) {
		return "recovering";
	}
	if (args.lastRaidResult?.success === true) {
		return "damaged";
	}
	return "stable";
}

function uniqueOperations(rows: FleetActivityOperation[]) {
	return [...new Map(rows.map((row) => [row._id, row])).values()];
}

function countFleetShips(counts: ShipCounts) {
	return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function buildThreatStatus(args: {
	activeRaid: Doc<"npcRaidOperations"> | null;
	hostileInboundCount: number;
	inboundFriendlyCount: number;
	outboundCount: number;
	status: OverviewStatus;
}) {
	if (args.activeRaid) {
		return "Raid in progress";
	}
	if (args.hostileInboundCount > 0) {
		return "Hostile inbound traffic";
	}
	if (args.status === "high traffic") {
		return "Elevated logistics activity";
	}
	if (args.inboundFriendlyCount + args.outboundCount > 0) {
		return "Operational traffic detected";
	}
	return "No immediate threat indicators";
}

function buildActivityFeed(args: {
	activeRaid: Doc<"npcRaidOperations"> | null;
	colony: Doc<"colonies">;
	lastRaidResult: Doc<"npcRaidResults"> | null;
	now: number;
	operations: FleetActivityOperation[];
}) {
	const entries: Array<{
		id: string;
		text: string;
		severity: ActivitySeverity;
		occurredAt: number;
		timeLabel: string;
	}> = [];

	if (args.activeRaid) {
		const faction = HOSTILE_FACTIONS[args.activeRaid.hostileFactionKey];
		entries.push({
			id: `raid:${args.activeRaid._id}`,
			text: `${faction.displayName} raid wave inbound to ${args.colony.name}`,
			severity: "critical",
			occurredAt: args.activeRaid.departAt,
			timeLabel: formatEtaLabel({
				now: args.now,
				at: args.activeRaid.arriveAt,
			}),
		});
	}

	for (const operation of args.operations) {
		const isInbound =
			operation.target.colonyId === args.colony._id && operation.originColonyId !== args.colony._id;
		const isHostile = operation.ownerPlayerId !== args.colony.playerId;
		const severity: ActivitySeverity = isInbound ? (isHostile ? "warning" : "info") : "neutral";
		const relationLabel = isInbound
			? isHostile
				? "Hostile fleet inbound"
				: "Friendly fleet inbound"
			: "Outbound fleet active";
		entries.push({
			id: `op:${operation._id}`,
			text: `${relationLabel} (${operation.status})`,
			severity,
			occurredAt: operation.nextEventAt,
			timeLabel: formatEtaLabel({
				now: args.now,
				at: operation.nextEventAt,
			}),
		});
	}

	if (args.lastRaidResult) {
		const faction = HOSTILE_FACTIONS[args.lastRaidResult.hostileFactionKey];
		entries.push({
			id: `raid-result:${args.lastRaidResult._id}`,
			text: args.lastRaidResult.success
				? `${faction.displayName} raid breached defenses`
				: `${faction.displayName} raid repelled`,
			severity: args.lastRaidResult.success ? "critical" : "success",
			occurredAt: args.lastRaidResult.createdAt,
			timeLabel: formatElapsedLabel({
				now: args.now,
				occurredAt: args.lastRaidResult.createdAt,
			}),
		});
	}

	const fallbackEntries = [
		{
			id: "fallback:sensors",
			text: "Long-range sensor sweep nominal",
			severity: "neutral" as const,
			occurredAt: args.now - 15_000,
			timeLabel: formatElapsedLabel({
				now: args.now,
				occurredAt: args.now - 15_000,
			}),
		},
		{
			id: "fallback:traffic",
			text: "No additional flagged events in live buffer",
			severity: "info" as const,
			occurredAt: args.now - 45_000,
			timeLabel: formatElapsedLabel({
				now: args.now,
				occurredAt: args.now - 45_000,
			}),
		},
	];

	return [...entries, ...fallbackEntries]
		.sort((left, right) => right.occurredAt - left.occurredAt)
		.slice(0, 5);
}

function buildFileId(args: { addressLabel: string; colonyId: Id<"colonies"> }) {
	const seed =
		String(args.colonyId)
			.replace(/[^a-z0-9]/gi, "")
			.slice(-8)
			.toUpperCase() || "00000000";
	const address = args.addressLabel
		.replace(/[^A-Z0-9]/gi, "")
		.slice(0, 10)
		.toUpperCase();
	return `NV-INT-${address}-${seed}`;
}

async function readColonyShipCounts(args: { colonyId: Id<"colonies">; ctx: QueryCtx }) {
	const rows = await args.ctx.db
		.query("colonyShips")
		.withIndex("by_colony", (q) => q.eq("colonyId", args.colonyId))
		.collect();
	const counts = normalizeShipCounts({});
	for (const row of rows) {
		counts[row.shipKey] = row.count;
	}
	return counts;
}

async function getPublicColonyOrThrow(args: { colonyId: Id<"colonies">; ctx: QueryCtx }) {
	const colony = await args.ctx.db.get(args.colonyId);
	if (!colony) {
		throw new ConvexError("Colony not found");
	}
	const planet = await args.ctx.db.get(colony.planetId);
	if (!planet) {
		throw new ConvexError("Planet not found for colony");
	}
	const player = await args.ctx.db.get(colony.playerId);
	if (!player) {
		throw new ConvexError("Owner not found for colony");
	}
	const [colonyState, planetState] = await Promise.all([
		loadColonyState({ colony, ctx: args.ctx }),
		loadPlanetState({ planet, ctx: args.ctx }),
	]);
	return {
		colony: colonyState,
		planet: planetState,
		player,
	};
}

export const getColonyOverview = query({
	args: {
		colonyId: v.id("colonies"),
	},
	returns: colonyOverviewValidator,
	handler: async (ctx, args) => {
		const serverNowMs = Date.now();
		const [viewer, publicColony] = await Promise.all([
			resolveCurrentPlayer(ctx),
			getPublicColonyOrThrow({
				colonyId: args.colonyId,
				ctx,
			}),
		]);

		const [
			queueRows,
			dockedShips,
			defenseCountsRaw,
			originOps,
			inboundOps,
			activeRaid,
			lastRaidResult,
		] = await Promise.all([
			listOpenColonyQueueItems({
				colonyId: publicColony.colony._id,
				ctx,
			}),
			readColonyShipCounts({
				colonyId: publicColony.colony._id,
				ctx,
			}),
			readColonyDefenseCounts({
				colonyId: publicColony.colony._id,
				ctx,
			}),
			Promise.all([
				ctx.db
					.query("fleetOperations")
					.withIndex("by_origin_stat_evt", (q) =>
						q.eq("originColonyId", publicColony.colony._id).eq("status", "inTransit"),
					)
					.collect(),
				ctx.db
					.query("fleetOperations")
					.withIndex("by_origin_stat_evt", (q) =>
						q.eq("originColonyId", publicColony.colony._id).eq("status", "returning"),
					)
					.collect(),
			]).then((rows) => rows.flat()),
			Promise.all([
				ctx.db
					.query("fleetOperations")
					.withIndex("by_tcol_st_evt", (q) =>
						q.eq("target.colonyId", publicColony.colony._id).eq("status", "inTransit"),
					)
					.collect(),
			]).then((rows) => rows.flat()),
			ctx.db
				.query("npcRaidOperations")
				.withIndex("by_target_status_event", (q) =>
					q.eq("targetColonyId", publicColony.colony._id).eq("status", "inTransit"),
				)
				.first(),
			ctx.db
				.query("npcRaidResults")
				.withIndex("by_target_colony_created_at", (q) =>
					q.eq("targetColonyId", publicColony.colony._id),
				)
				.order("desc")
				.first(),
		]);

		const viewerRelation: "anonymous" | "otherPlayer" | "owner" =
			viewer?.player?._id === publicColony.player._id
				? "owner"
				: viewer?.player
					? "otherPlayer"
					: "anonymous";

		const defenseCounts = normalizeDefenseCounts(defenseCountsRaw);
		const operations = uniqueOperations([...originOps, ...inboundOps]);
		const inboundFriendlyCount = operations.filter(
			(operation) =>
				operation.target.colonyId === publicColony.colony._id &&
				operation.originColonyId !== publicColony.colony._id &&
				operation.ownerPlayerId === publicColony.player._id,
		).length;
		const inboundHostileCount = operations.filter(
			(operation) =>
				operation.target.colonyId === publicColony.colony._id &&
				operation.originColonyId !== publicColony.colony._id &&
				operation.ownerPlayerId !== publicColony.player._id,
		).length;
		const outboundCount = operations.filter(
			(operation) => operation.originColonyId === publicColony.colony._id,
		).length;
		const status = deriveOverviewStatus({
			activeRaid,
			hasOpenQueue: queueRows.length > 0,
			hostileInboundCount: inboundHostileCount,
			inboundFriendlyCount,
			outboundCount,
		});
		const defenseFirepower = estimateColonyDefensePower({
			defenses: defenseCounts,
			ships: dockedShips,
		});
		const nextEventCandidates = [
			activeRaid?.nextEventAt,
			...queueRows.map((row) => row.completesAt),
			...operations.map((row) => row.nextEventAt),
		].filter((value): value is number => typeof value === "number");
		const nextEventAt =
			nextEventCandidates.length > 0 ? Math.min(...nextEventCandidates) : undefined;

		const classification: "RESTRICTED" | "CLASSIFIED" =
			status === "under attack" || status === "high traffic" ? "CLASSIFIED" : "RESTRICTED";
		const diplomacyPolicy: "allowAll" | "denyAll" | "alliesOnly" | "unknown" =
			publicColony.colony.inboundMissionPolicy ?? "unknown";

		const lastRaid = activeRaid
			? ({
					kind: "active",
					factionName: HOSTILE_FACTIONS[activeRaid.hostileFactionKey].displayName,
					outcomeLabel: "ONGOING",
					occurredAt: activeRaid.departAt,
				} as const)
			: lastRaidResult
				? ({
						kind: "result",
						factionName: HOSTILE_FACTIONS[lastRaidResult.hostileFactionKey].displayName,
						outcomeLabel: lastRaidResult.success ? "BREACHED" : "REPELLED",
						occurredAt: lastRaidResult.createdAt,
					} as const)
				: null;

		return {
			colonyId: publicColony.colony._id,
			viewerRelation,
			header: {
				name: publicColony.colony.name,
				ownerName: publicColony.player.displayName,
				addressLabel: toAddressLabel(publicColony.planet),
				fileId: buildFileId({
					addressLabel: toAddressLabel(publicColony.planet),
					colonyId: publicColony.colony._id,
				}),
				status,
				classification,
				factionPlaceholder: "Frontier Coalition",
			},
			planet: {
				compositionType: publicColony.planet.compositionType,
				tierPlaceholder: "IV",
				usedSlots: publicColony.colony.usedSlots,
				maxSlots: publicColony.planet.maxBuildingSlots,
				multipliers: {
					alloy: publicColony.planet.alloyMultiplier,
					crystal: publicColony.planet.crystalMultiplier,
					fuel: publicColony.planet.fuelMultiplier,
				},
				notes: buildPlanetNotes({
					alloyMultiplier: publicColony.planet.alloyMultiplier,
					compositionType: publicColony.planet.compositionType,
					crystalMultiplier: publicColony.planet.crystalMultiplier,
					fuelMultiplier: publicColony.planet.fuelMultiplier,
				}),
			},
			infrastructure: {
				buildings: Object.entries(BUILDING_LABELS).map(([key, name]) => ({
					key,
					name,
					level: publicColony.colony.buildings[key as keyof typeof BUILDING_LABELS] ?? 0,
				})),
				facilities: [
					{
						key: "robotics_hub" as const,
						name: FACILITY_LABELS.robotics_hub,
						level: publicColony.colony.buildings.roboticsHubLevel ?? 0,
					},
					{
						key: "shipyard" as const,
						name: FACILITY_LABELS.shipyard,
						level: publicColony.colony.buildings.shipyardLevel ?? 0,
					},
					{
						key: "defense_grid" as const,
						name: FACILITY_LABELS.defense_grid,
						level: publicColony.colony.buildings.defenseGridLevel ?? 0,
					},
				],
			},
			defense: {
				firepower: defenseFirepower,
				shieldLabel: deriveShieldLabel({
					activeRaid,
					lastRaidResult,
				}),
				units: Object.entries(DEFENSE_LABELS).map(([key, name]) => ({
					key: key as DefenseKey,
					name,
					count: defenseCounts[key as DefenseKey] ?? 0,
				})),
				lastRaid,
			},
			fleet: {
				docked: dockedShips,
				totalDocked: countFleetShips(dockedShips),
				inboundFriendly: inboundFriendlyCount,
				inboundHostile: inboundHostileCount,
				outbound: outboundCount,
			},
			strategic: {
				tags: buildStrategicTags({
					alloyMultiplier: publicColony.planet.alloyMultiplier,
					crystalMultiplier: publicColony.planet.crystalMultiplier,
					fuelMultiplier: publicColony.planet.fuelMultiplier,
					status,
				}),
				notesPlaceholder:
					"Strategic assessment pending expanded intelligence synthesis. Treat current dossier as a live operational snapshot.",
				diplomacyPolicy,
				threatStatus: buildThreatStatus({
					activeRaid,
					hostileInboundCount: inboundHostileCount,
					inboundFriendlyCount,
					outboundCount,
					status,
				}),
				visibilityPlaceholder: status === "under attack" ? "CONTESTED" : "MONITORED",
				surveillance: {
					contactsPlaceholder: String(operations.length),
					anomaliesPlaceholder: activeRaid ? "1" : "0",
				},
			},
			activity: buildActivityFeed({
				activeRaid,
				colony: publicColony.colony,
				lastRaidResult,
				now: serverNowMs,
				operations,
			}),
			timing: {
				nextEventAt,
				serverNowMs,
			},
		};
	},
});
