import { create } from "zustand";

import type { NormalizedTimedGameEvent } from "@/lib/game-sync-types";

type ScopeRegistrationState = {
  enabled: boolean;
  events: NormalizedTimedGameEvent[];
  inFlight: boolean;
  lastDispatchedByEventId: Record<string, number>;
};

type GameSyncState = {
  markDispatched: (args: { atMs: number; eventId: string; scopeId: string }) => void;
  removeScope: (scopeId: string) => void;
  scopes: Record<string, ScopeRegistrationState>;
  setNextDueAtMs: (nextDueAtMs: number | null) => void;
  setScopeInFlight: (scopeId: string, inFlight: boolean) => void;
  upsertScope: (args: {
    enabled: boolean;
    events: NormalizedTimedGameEvent[];
    scopeId: string;
  }) => void;
  nextDueAtMs: number | null;
};

export const useGameSyncStore = create<GameSyncState>((set) => ({
  markDispatched: ({ atMs, eventId, scopeId }) => {
    set((state) => {
      const scope = state.scopes[scopeId];
      if (!scope) {
        return state;
      }

      return {
        scopes: {
          ...state.scopes,
          [scopeId]: {
            ...scope,
            lastDispatchedByEventId: {
              ...scope.lastDispatchedByEventId,
              [eventId]: atMs,
            },
          },
        },
      };
    });
  },
  nextDueAtMs: null,
  removeScope: (scopeId) => {
    set((state) => {
      if (!state.scopes[scopeId]) {
        return state;
      }

      const nextScopes = { ...state.scopes };
      delete nextScopes[scopeId];

      return { scopes: nextScopes };
    });
  },
  scopes: {},
  setNextDueAtMs: (nextDueAtMs) => {
    set({ nextDueAtMs });
  },
  setScopeInFlight: (scopeId, inFlight) => {
    set((state) => {
      const scope = state.scopes[scopeId];
      if (!scope || scope.inFlight === inFlight) {
        return state;
      }

      return {
        scopes: {
          ...state.scopes,
          [scopeId]: {
            ...scope,
            inFlight,
          },
        },
      };
    });
  },
  upsertScope: ({ enabled, events, scopeId }) => {
    set((state) => {
      const existing = state.scopes[scopeId];

      return {
        scopes: {
          ...state.scopes,
          [scopeId]: {
            enabled,
            events,
            inFlight: existing?.inFlight ?? false,
            lastDispatchedByEventId: existing?.lastDispatchedByEventId ?? {},
          },
        },
      };
    });
  },
}));
