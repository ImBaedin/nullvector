export type TimedGameEvent = {
	atMs: number | null | undefined;
	id: string;
};

export type NormalizedTimedGameEvent = {
	atMs: number | null;
	id: string;
};

export type TimedSyncDueHandler = (dueEventIds: string[]) => Promise<void> | void;
