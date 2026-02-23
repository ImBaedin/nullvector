import { useEffect, useRef } from "react";

import { gameSyncOrchestrator } from "@/lib/game-sync-orchestrator";
import type { TimedGameEvent, TimedSyncDueHandler } from "@/lib/game-sync-types";

type UseGameTimedSyncArgs = {
  enabled?: boolean;
  events: TimedGameEvent[];
  onDue: TimedSyncDueHandler;
  scopeId: string;
};

export function useGameTimedSync(args: UseGameTimedSyncArgs) {
  const enabled = args.enabled ?? true;
  const onDueRef = useRef(args.onDue);

  onDueRef.current = args.onDue;

  const eventsKey = args.events
    .map((event) => `${event.id}:${typeof event.atMs === "number" ? event.atMs : "null"}`)
    .join("|");

  useEffect(() => {
    gameSyncOrchestrator.registerScope({
      enabled,
      events: args.events,
      onDue: (dueEventIds) => onDueRef.current(dueEventIds),
      scopeId: args.scopeId,
    });

    return () => {
      gameSyncOrchestrator.unregisterScope(args.scopeId);
    };
  }, [enabled, eventsKey, args.scopeId]);
}
