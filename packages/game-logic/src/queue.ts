import type {
	BuildingUpgradeQueuePayload,
	DefenseBuildQueuePayload,
	FacilityUpgradeQueuePayload,
	QueueItemKind,
	QueueItemStatus,
	QueueLane,
	ResourceBucket,
	ShipBuildQueuePayload,
} from "./gameplay";

export type ColonyQueuePayload =
	| BuildingUpgradeQueuePayload
	| FacilityUpgradeQueuePayload
	| ShipBuildQueuePayload
	| DefenseBuildQueuePayload;

export type ColonyQueueEntry = {
	completesAt: number;
	cost: ResourceBucket;
	id: string;
	kind: QueueItemKind;
	lane: QueueLane;
	order: number;
	payload: ColonyQueuePayload;
	queuedAt: number;
	startsAt: number;
	status: QueueItemStatus;
};

export type ColonyQueueSnapshot = {
	openQueues: ColonyQueueEntry[];
};

export type ColonyQueueViewItem = {
	completesAt: number;
	cost: ResourceBucket;
	id: string;
	isComplete: boolean;
	kind: QueueItemKind;
	lane: QueueLane;
	order: number;
	payload: ColonyQueuePayload;
	queuedAt: number;
	remainingMs: number;
	startsAt: number;
	status: QueueItemStatus;
};

export type ColonyLaneQueueView = {
	activeItem?: ColonyQueueViewItem;
	isFull: boolean;
	lane: QueueLane;
	maxItems: number;
	pendingItems: ColonyQueueViewItem[];
	totalItems: number;
};

export type ColonyQueueLanesView = {
	lanes: Record<QueueLane, ColonyLaneQueueView>;
	nextEventAt?: number;
};

const OPEN_QUEUE_STATUSES: ReadonlyArray<QueueItemStatus> = ["active", "queued"];

export const LANE_QUEUE_CAPACITY: Record<QueueLane, number> = {
	building: 2,
	defense: 5,
	research: 2,
	shipyard: 5,
};

export function isOpenQueueStatus(status: QueueItemStatus) {
	return OPEN_QUEUE_STATUSES.includes(status);
}

export function compareQueueOrder(left: ColonyQueueEntry, right: ColonyQueueEntry) {
	if (left.order !== right.order) {
		return left.order - right.order;
	}
	if (left.queuedAt !== right.queuedAt) {
		return left.queuedAt - right.queuedAt;
	}
	return left.id.localeCompare(right.id);
}

export function queueEventsNextAt(rows: ColonyQueueEntry[]) {
	let nextAt: number | undefined;
	for (const row of rows) {
		if (!isOpenQueueStatus(row.status)) {
			continue;
		}
		nextAt = nextAt === undefined ? row.completesAt : Math.min(nextAt, row.completesAt);
	}
	return nextAt;
}

export function toQueueViewItem(item: ColonyQueueEntry, now: number): ColonyQueueViewItem {
	const remainingMs = Math.max(0, item.completesAt - now);
	return {
		...item,
		isComplete: remainingMs === 0,
		remainingMs,
	};
}

export function emptyLaneQueueView(lane: QueueLane, maxItems = LANE_QUEUE_CAPACITY[lane]) {
	return {
		activeItem: undefined,
		isFull: false,
		lane,
		maxItems,
		pendingItems: [],
		totalItems: 0,
	} satisfies ColonyLaneQueueView;
}

export function projectQueueLane(args: {
	lane: QueueLane;
	maxItems?: number;
	now: number;
	openQueues: ColonyQueueEntry[];
}) {
	const open = args.openQueues
		.filter((row) => row.lane === args.lane && isOpenQueueStatus(row.status))
		.sort(compareQueueOrder);
	const active = open.find((row) => row.status === "active");
	const pending = open.filter((row) => row.status === "queued");
	const maxItems = args.maxItems ?? LANE_QUEUE_CAPACITY[args.lane];

	return {
		activeItem: active ? toQueueViewItem(active, args.now) : undefined,
		isFull: open.length >= maxItems,
		lane: args.lane,
		maxItems,
		pendingItems: pending.map((item) => toQueueViewItem(item, args.now)),
		totalItems: open.length,
	} satisfies ColonyLaneQueueView;
}

export function projectQueueLanes(args: {
	buildingMaxItems: number;
	now: number;
	openQueues: ColonyQueueEntry[];
}) {
	return {
		lanes: {
			building: projectQueueLane({
				lane: "building",
				maxItems: args.buildingMaxItems,
				now: args.now,
				openQueues: args.openQueues,
			}),
			defense: projectQueueLane({
				lane: "defense",
				now: args.now,
				openQueues: args.openQueues,
			}),
			research: projectQueueLane({
				lane: "research",
				now: args.now,
				openQueues: args.openQueues,
			}),
			shipyard: projectQueueLane({
				lane: "shipyard",
				now: args.now,
				openQueues: args.openQueues,
			}),
		},
		nextEventAt: queueEventsNextAt(args.openQueues),
	} satisfies ColonyQueueLanesView;
}
