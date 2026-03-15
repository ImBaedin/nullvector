import type { Doc, Id } from "@nullvector/backend/convex/_generated/dataModel";
import type {
	NotificationCategory,
	NotificationKind,
	NotificationPayload,
	NotificationSeverity,
	NotificationStatus,
} from "@nullvector/backend/runtime/gameplay/notificationsModel";
import { RESOURCE_SCALE } from "@nullvector/backend/convex/schema";

import { NvBadge } from "@/features/game-ui/primitives";
import { cn } from "@/lib/utils";

const RESOURCE_ICON_BY_KEY = {
	alloy: "/game-icons/alloy.png",
	crystal: "/game-icons/crystal.png",
	fuel: "/game-icons/deuterium.png",
} as const;

export type NotificationFeedItem = {
	archivedAt?: number;
	category: NotificationCategory;
	colonyId?: Id<"colonies">;
	createdAt: number;
	destination?: Doc<"notifications">["destination"];
	id: Id<"notifications">;
	kind: NotificationKind;
	occurredAt: number;
	payload: NotificationPayload;
	playerId: Id<"players">;
	readAt?: number;
	severity: NotificationSeverity;
	sourceKey: string;
	sourceKind: Doc<"notifications">["sourceKind"];
	status: NotificationStatus;
	universeId: Id<"universes">;
	updatedAt: number;
};

type ColonyNameResolver = (colonyId?: Id<"colonies">) => string | null;

function formatDateTime(timestamp: number) {
	return new Date(timestamp).toLocaleString();
}

function affectedColonyId(notification: NotificationFeedItem) {
	return notification.colonyId ?? notification.destination?.colonyId;
}

function titleWithColony(args: {
	baseTitle: string;
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
}) {
	const colonyName = args.getColonyName(affectedColonyId(args.notification));
	return colonyName ? `${args.baseTitle} • ${colonyName}` : args.baseTitle;
}

function storedToWholeUnits(storedAmount: number) {
	return Math.max(0, Math.floor(storedAmount / RESOURCE_SCALE));
}

function toWholeResourceBucket(bucket: { alloy: number; crystal: number; fuel: number }) {
	return {
		alloy: storedToWholeUnits(bucket.alloy),
		crystal: storedToWholeUnits(bucket.crystal),
		fuel: storedToWholeUnits(bucket.fuel),
	};
}

function formatResourceBucket(bucket: { alloy: number; crystal: number; fuel: number }) {
	const wholeBucket = toWholeResourceBucket(bucket);
	return [
		`Alloy ${wholeBucket.alloy.toLocaleString()}`,
		`Crystal ${wholeBucket.crystal.toLocaleString()}`,
		`Fuel ${wholeBucket.fuel.toLocaleString()}`,
	].join(" | ");
}

function formatShipCounts(
	ships: NonNullable<Extract<NotificationPayload, { kind: "raidIncoming" }>["attackerFleet"]>,
) {
	return Object.entries(ships)
		.filter(([, count]) => (count ?? 0) > 0)
		.map(([shipKey, count]) => `${count?.toLocaleString()} ${shipKey}`)
		.join(", ");
}

function ResourceToken({
	amount,
	resourceKey,
}: {
	amount: number;
	resourceKey: "alloy" | "crystal" | "fuel";
}) {
	return (
		<span className="
    inline-flex items-center gap-1 rounded-full border border-white/10
    bg-black/20 px-2 py-0.5
  ">
			<img
				alt={`${resourceKey} icon`}
				className="size-3 shrink-0 object-contain"
				src={RESOURCE_ICON_BY_KEY[resourceKey]}
			/>
			<span className="
     font-(family-name:--nv-font-mono) text-[11px] text-(--nv-text-secondary)
   ">
				{amount.toLocaleString()}
			</span>
		</span>
	);
}

function ResourceInlineList({
	bucket,
}: {
	bucket: { alloy: number; crystal: number; fuel: number };
}) {
	const wholeBucket = toWholeResourceBucket(bucket);
	const resources = [
		{ amount: wholeBucket.alloy, resourceKey: "alloy" as const },
		{ amount: wholeBucket.crystal, resourceKey: "crystal" as const },
		{ amount: wholeBucket.fuel, resourceKey: "fuel" as const },
	].filter((entry) => entry.amount > 0);

	if (resources.length === 0) {
		return <span className="text-(--nv-text-muted)">None</span>;
	}

	return (
		<span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
			{resources.map((resource) => (
				<ResourceToken
					amount={resource.amount}
					key={resource.resourceKey}
					resourceKey={resource.resourceKey}
				/>
			))}
		</span>
	);
}

function NotificationTitle({
	children,
	status,
}: {
	children: React.ReactNode;
	status: NotificationStatus;
}) {
	return (
		<h4
			className={cn(
				"truncate text-[13px] font-medium",
				status === "unread" ? "text-(--nv-text-primary)" : `
      text-(--nv-text-secondary)
    `,
			)}
		>
			{children}
		</h4>
	);
}

function NotificationSummary({
	children,
	status,
}: {
	children: React.ReactNode;
	status: NotificationStatus;
}) {
	return (
		<p
			className={cn(
				"mt-0.5 line-clamp-2 text-xs/relaxed",
				status === "unread" ? "text-(--nv-text-secondary)" : `
      text-(--nv-text-muted)
    `,
			)}
		>
			{children}
		</p>
	);
}

function NotificationStat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
			<p className="text-[11px] font-medium text-(--nv-text-muted)">{label}</p>
			<p className="text-xs/relaxed text-(--nv-text-secondary)">{value}</p>
		</div>
	);
}

function NotificationBody({ children }: { children: React.ReactNode }) {
	return <div className="space-y-2">{children}</div>;
}

function NotificationRowLayout({
	notification,
	title,
	summary,
}: {
	notification: NotificationFeedItem;
	summary: React.ReactNode;
	title: React.ReactNode;
}) {
	return (
		<NotificationBody>
			<div className="flex min-w-0 items-center gap-2">
				<NotificationTitle status={notification.status}>{title}</NotificationTitle>
				{notification.status === "unread" ? (
					<span className="
       size-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(61,217,255,0.5)]
     " />
				) : null}
			</div>
			<NotificationSummary status={notification.status}>{summary}</NotificationSummary>
		</NotificationBody>
	);
}

function NotificationDetailLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="space-y-2 rounded-xl border border-white/8 bg-white/3 p-4">{children}</div>
	);
}

function RaidIncomingNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<NotificationPayload, { kind: "raidIncoming" }>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={`Incoming raid arrives ${formatDateTime(payload.arriveAt)}.`}
				title={titleWithColony({
					baseTitle: "Raid incoming",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Faction" value={payload.hostileFactionKey} />
			<NotificationStat label="Difficulty" value={`Tier ${payload.difficultyTier}`} />
			<NotificationStat label="Arrival" value={formatDateTime(payload.arriveAt)} />
			<NotificationStat
				label="Attacker fleet"
				value={formatShipCounts(payload.attackerFleet) || "Unknown"}
			/>
		</NotificationDetailLayout>
	);
}

function RaidResolvedNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<NotificationPayload, { kind: "raidResolved" }>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={
					payload.success ? (
						<>
							Lost <ResourceInlineList bucket={payload.resourcesLooted} /> to the raid.
						</>
					) : (
						<>
							Recovered <ResourceInlineList bucket={payload.salvageGranted} /> from salvage.
						</>
					)
				}
				title={titleWithColony({
					baseTitle: payload.success ? "Raid breached defenses" : "Raid defended",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Outcome" value={payload.success ? "Breached" : "Defended"} />
			<NotificationStat label="Rounds fought" value={payload.roundsFought} />
			<NotificationStat
				label="Resources gained"
				value={<ResourceInlineList bucket={payload.salvageGranted} />}
			/>
			<NotificationStat
				label="Resources looted"
				value={<ResourceInlineList bucket={payload.resourcesLooted} />}
			/>
			<NotificationStat label="Rank XP delta" value={payload.rankXpDelta.toLocaleString()} />
		</NotificationDetailLayout>
	);
}

function ContractResolvedNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<
		NotificationPayload,
		{ kind: "contractResolved" }
	>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={
					payload.success
						? `Granted ${payload.rewardCreditsGranted.toLocaleString()} credits and ${payload.rewardRankXpGranted.toLocaleString()} XP.`
						: `Granted ${payload.rewardRankXpGranted.toLocaleString()} XP after failure.`
				}
				title={titleWithColony({
					baseTitle: payload.success ? "Contract completed" : "Contract failed",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Outcome" value={payload.success ? "Success" : "Failed"} />
			<NotificationStat label="Rounds fought" value={payload.roundsFought} />
			<NotificationStat label="Credits" value={payload.rewardCreditsGranted.toLocaleString()} />
			<NotificationStat label="Rank XP" value={payload.rewardRankXpGranted.toLocaleString()} />
			<NotificationStat
				label="Cargo loaded"
				value={<ResourceInlineList bucket={payload.rewardCargoLoaded} />}
			/>
			<NotificationStat
				label="Cargo lost"
				value={<ResourceInlineList bucket={payload.rewardCargoLostByCapacity} />}
			/>
			<NotificationStat
				label="Control reduction"
				value={payload.controlReductionApplied.toLocaleString()}
			/>
		</NotificationDetailLayout>
	);
}

function TransportDeliveredNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<
		NotificationPayload,
		{ kind: "transportDelivered" }
	>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={
					payload.returnAt
						? "Cargo arrived and the fleet is returning to origin."
						: "Cargo arrived and the fleet is stationed at destination."
				}
				title={titleWithColony({
					baseTitle: "Transport delivered",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat
				label="Delivered to storage"
				value={<ResourceInlineList bucket={payload.deliveredToStorage} />}
			/>
			<NotificationStat
				label="Delivered to overflow"
				value={<ResourceInlineList bucket={payload.deliveredToOverflow} />}
			/>
			{payload.returnAt ? (
				<NotificationStat label="Fleet return ETA" value={formatDateTime(payload.returnAt)} />
			) : null}
		</NotificationDetailLayout>
	);
}

function TransportIncomingNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<
		NotificationPayload,
		{ kind: "transportIncoming" }
	>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={
					<>
						Incoming cargo: <ResourceInlineList bucket={payload.cargoRequested} />. ETA{" "}
						{formatDateTime(payload.arriveAt)}.
					</>
				}
				title={titleWithColony({
					baseTitle: "Transport incoming",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat
				label="Incoming cargo"
				value={<ResourceInlineList bucket={payload.cargoRequested} />}
			/>
			<NotificationStat label="Arrival ETA" value={formatDateTime(payload.arriveAt)} />
		</NotificationDetailLayout>
	);
}

function TransportReceivedNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<
		NotificationPayload,
		{ kind: "transportReceived" }
	>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={
					<>
						Cargo delivered: <ResourceInlineList bucket={payload.deliveredToStorage} /> to storage
						and <ResourceInlineList bucket={payload.deliveredToOverflow} /> to overflow.
					</>
				}
				title={titleWithColony({
					baseTitle: "Transport received",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat
				label="Delivered to storage"
				value={<ResourceInlineList bucket={payload.deliveredToStorage} />}
			/>
			<NotificationStat
				label="Delivered to overflow"
				value={<ResourceInlineList bucket={payload.deliveredToOverflow} />}
			/>
		</NotificationDetailLayout>
	);
}

function TransportReturnedNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary="The transport fleet returned to its origin colony."
				title={titleWithColony({
					baseTitle: "Transport returned",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Status" value="The transport fleet returned to its origin colony." />
		</NotificationDetailLayout>
	);
}

function OperationFailedNotification({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const payload = notification.payload as Extract<NotificationPayload, { kind: "operationFailed" }>;

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary={payload.resultMessage}
				title={titleWithColony({
					baseTitle: "Operation failed",
					getColonyName,
					notification,
				})}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Operation kind" value={payload.operationKind} />
			<NotificationStat label="Result code" value={payload.resultCode ?? "failed"} />
			<NotificationStat label="Message" value={payload.resultMessage} />
		</NotificationDetailLayout>
	);
}

function NotificationFallback({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	const title = titleWithColony({
		baseTitle: "Notification",
		getColonyName,
		notification,
	});

	if (variant === "row") {
		return (
			<NotificationRowLayout
				notification={notification}
				summary="Open this notification for details."
				title={title}
			/>
		);
	}

	return (
		<NotificationDetailLayout>
			<NotificationStat label="Kind" value={notification.kind} />
			<NotificationStat label="Status" value="Open destination if available." />
		</NotificationDetailLayout>
	);
}

export function NotificationContent({
	getColonyName,
	notification,
	variant,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
	variant: "detail" | "row";
}) {
	switch (notification.payload.kind) {
		case "raidIncoming":
			return (
				<RaidIncomingNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "raidResolved":
			return (
				<RaidResolvedNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "contractResolved":
			return (
				<ContractResolvedNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "transportDelivered":
			return (
				<TransportDeliveredNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "transportIncoming":
			return (
				<TransportIncomingNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "transportReceived":
			return (
				<TransportReceivedNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "transportReturned":
			return (
				<TransportReturnedNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		case "operationFailed":
			return (
				<OperationFailedNotification
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
		default:
			return (
				<NotificationFallback
					getColonyName={getColonyName}
					notification={notification}
					variant={variant}
				/>
			);
	}
}

export function NotificationDisplayTitle({
	getColonyName,
	notification,
}: {
	getColonyName: ColonyNameResolver;
	notification: NotificationFeedItem;
}) {
	switch (notification.payload.kind) {
		case "raidIncoming":
			return titleWithColony({ baseTitle: "Raid incoming", getColonyName, notification });
		case "raidResolved":
			return titleWithColony({
				baseTitle: notification.payload.success ? "Raid breached defenses" : "Raid defended",
				getColonyName,
				notification,
			});
		case "contractResolved":
			return titleWithColony({
				baseTitle: notification.payload.success ? "Contract completed" : "Contract failed",
				getColonyName,
				notification,
			});
		case "transportDelivered":
			return titleWithColony({ baseTitle: "Transport delivered", getColonyName, notification });
		case "transportIncoming":
			return titleWithColony({ baseTitle: "Transport incoming", getColonyName, notification });
		case "transportReceived":
			return titleWithColony({ baseTitle: "Transport received", getColonyName, notification });
		case "transportReturned":
			return titleWithColony({ baseTitle: "Transport returned", getColonyName, notification });
		case "operationFailed":
			return titleWithColony({ baseTitle: "Operation failed", getColonyName, notification });
		default:
			return titleWithColony({ baseTitle: "Notification", getColonyName, notification });
	}
}

export function NotificationStateBadge({ status }: { status: NotificationStatus }) {
	return (
		<NvBadge tone="neutral">
			{status === "archived" ? "Archived" : status === "read" ? "Read" : "Unread"}
		</NvBadge>
	);
}
