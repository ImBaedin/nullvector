import type {
	NormalizedTimedGameEvent,
	TimedGameEvent,
	TimedSyncDueHandler,
} from "@/lib/game-sync-types";

import { useGameSyncStore } from "@/stores/game-sync-store";

const MAX_TIMEOUT_MS = 2_147_483_647;

function normalizeEvents(events: TimedGameEvent[]): NormalizedTimedGameEvent[] {
	return events.map((event) => ({
		atMs: typeof event.atMs === "number" ? event.atMs : null,
		id: event.id,
	}));
}

class GameSyncOrchestrator {
	private dueHandlers = new Map<string, TimedSyncDueHandler>();
	private timerId: number | null = null;

	registerScope(args: {
		enabled: boolean;
		events: TimedGameEvent[];
		onDue: TimedSyncDueHandler;
		scopeId: string;
	}) {
		this.dueHandlers.set(args.scopeId, args.onDue);
		useGameSyncStore.getState().upsertScope({
			enabled: args.enabled,
			events: normalizeEvents(args.events),
			scopeId: args.scopeId,
		});
		this.scheduleNext();
	}

	unregisterScope(scopeId: string) {
		this.dueHandlers.delete(scopeId);
		useGameSyncStore.getState().removeScope(scopeId);
		this.scheduleNext();
	}

	private scheduleNext() {
		if (this.timerId !== null) {
			window.clearTimeout(this.timerId);
			this.timerId = null;
		}

		const now = Date.now();
		const state = useGameSyncStore.getState();

		let hasDue = false;
		let nextDueAtMs: number | null = null;

		for (const scope of Object.values(state.scopes)) {
			if (!scope.enabled) {
				continue;
			}

			for (const event of scope.events) {
				if (!Number.isFinite(event.atMs)) {
					continue;
				}

				const atMs = event.atMs as number;
				const lastDispatchedAt = scope.lastDispatchedByEventId[event.id];

				if (atMs <= now && lastDispatchedAt !== atMs) {
					hasDue = true;
					break;
				}

				if (atMs > now && lastDispatchedAt !== atMs) {
					nextDueAtMs = nextDueAtMs === null ? atMs : Math.min(nextDueAtMs, atMs);
				}
			}

			if (hasDue) {
				break;
			}
		}

		if (hasDue) {
			state.setNextDueAtMs(now);
			this.timerId = window.setTimeout(() => {
				void this.flushDueScopes();
			}, 0);
			return;
		}

		state.setNextDueAtMs(nextDueAtMs);
		if (nextDueAtMs === null) {
			return;
		}

		const timeoutMs = Math.min(Math.max(0, nextDueAtMs - now), MAX_TIMEOUT_MS);
		this.timerId = window.setTimeout(() => {
			void this.flushDueScopes();
		}, timeoutMs);
	}

	private async flushDueScopes() {
		const now = Date.now();
		const state = useGameSyncStore.getState();

		const pending: Array<{ dueEventIds: string[]; scopeId: string }> = [];

		for (const [scopeId, scope] of Object.entries(state.scopes)) {
			if (!scope.enabled || scope.inFlight) {
				continue;
			}

			const dueEventIds: string[] = [];

			for (const event of scope.events) {
				if (!Number.isFinite(event.atMs)) {
					continue;
				}

				const atMs = event.atMs as number;
				const lastDispatchedAt = scope.lastDispatchedByEventId[event.id];
				if (atMs <= now && lastDispatchedAt !== atMs) {
					dueEventIds.push(event.id);
					state.markDispatched({ atMs, eventId: event.id, scopeId });
				}
			}

			if (dueEventIds.length > 0) {
				state.setScopeInFlight(scopeId, true);
				pending.push({ dueEventIds, scopeId });
			}
		}

		if (pending.length === 0) {
			this.scheduleNext();
			return;
		}

		await Promise.all(
			pending.map(async ({ dueEventIds, scopeId }) => {
				const onDue = this.dueHandlers.get(scopeId);
				if (!onDue) {
					useGameSyncStore.getState().setScopeInFlight(scopeId, false);
					return;
				}

				try {
					await onDue(dueEventIds);
				} finally {
					useGameSyncStore.getState().setScopeInFlight(scopeId, false);
				}
			}),
		);

		this.scheduleNext();
	}
}

export const gameSyncOrchestrator = new GameSyncOrchestrator();
