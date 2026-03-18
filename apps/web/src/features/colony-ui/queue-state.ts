import { formatColonyDuration } from "@/features/colony-ui/time";

export type QueueProgress = {
	durationMs: number;
	percent: number;
	remainingMs: number;
};

export type QueuePanelItem = {
	id: string;
	isActive: boolean;
	remainingLabel?: string;
	subtitle: string;
	title: string;
	totalLabel?: string;
};

export function getQueueProgress(
	nowMs: number,
	startsAt?: number | null,
	completesAt?: number | null,
): QueueProgress {
	if (!startsAt || !completesAt) {
		return {
			durationMs: 0,
			percent: 0,
			remainingMs: 0,
		};
	}

	const durationMs = Math.max(0, completesAt - startsAt);
	if (durationMs <= 0) {
		return {
			durationMs,
			percent: 0,
			remainingMs: Math.max(0, completesAt - nowMs),
		};
	}

	return {
		durationMs,
		percent: Math.min(100, Math.max(0, ((nowMs - startsAt) / durationMs) * 100)),
		remainingMs: Math.max(0, completesAt - nowMs),
	};
}

export function getPendingQueueIndexLabel(index: number): string {
	return `${index + 1}`;
}

export function formatQueueRemainingLabel(nowMs: number, completesAt?: number | null): string {
	if (!completesAt) {
		return "—";
	}

	return formatColonyDuration(Math.max(0, completesAt - nowMs), "milliseconds");
}
