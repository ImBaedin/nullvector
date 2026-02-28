import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import type { Id } from "@nullvector/backend/convex/_generated/dataModel";

import type {
  CameraFocusTarget,
  ExplorerCameraLock,
  ExplorerLevel,
  ExplorerPathState,
} from "../types";

type FocusRequest = {
  x: number;
  y: number;
  zoom: number;
};

type ExplorerContextValue = {
  level: ExplorerLevel;
  path: ExplorerPathState;
  focusTarget: CameraFocusTarget | null;
  cameraLock: ExplorerCameraLock;
  unlockCameraLock: () => void;
  setUniverseLevel: (focus?: FocusRequest) => void;
  setGalaxyLevel: (
    galaxyId: Id<"galaxies">,
    focus: FocusRequest
  ) => void;
  setSectorLevel: (
    path: { galaxyId: Id<"galaxies">; sectorId: Id<"sectors"> },
    focus: FocusRequest
  ) => void;
  setSystemLevel: (
    path: {
      galaxyId: Id<"galaxies">;
      sectorId: Id<"sectors">;
      systemId: Id<"systems">;
    },
    focus?: FocusRequest
  ) => void;
  setPlanetLevel: (
    path: {
      galaxyId: Id<"galaxies">;
      sectorId: Id<"sectors">;
      systemId: Id<"systems">;
      planetId: Id<"planets">;
    },
    focus: FocusRequest
  ) => void;
};

const UNIVERSE_FOCUS = { x: 0, y: 0, zoom: 0.08 };

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function ExplorerProvider({ children }: { children: React.ReactNode }) {
  const focusKey = useRef(0);
  const [level, setLevel] = useState<ExplorerLevel>("universe");
  const [path, setPath] = useState<ExplorerPathState>({});
  const [cameraLock, setCameraLock] = useState<ExplorerCameraLock>({
    mode: "free",
  });
  const [focusTarget, setFocusTarget] = useState<CameraFocusTarget | null>({
    ...UNIVERSE_FOCUS,
    key: focusKey.current,
  });

  const pushFocus = useCallback((focus: FocusRequest) => {
    focusKey.current += 1;
    setFocusTarget({ ...focus, key: focusKey.current });
  }, []);

  const setUniverseLevel = useCallback(
    (focus?: FocusRequest) => {
      setLevel("universe");
      setPath({});
      setCameraLock({ mode: "free" });
      pushFocus(focus ?? UNIVERSE_FOCUS);
    },
    [pushFocus]
  );

  const setGalaxyLevel = useCallback(
    (galaxyId: Id<"galaxies">, focus: FocusRequest) => {
      setLevel("galaxy");
      setPath({ galaxyId });
      setCameraLock({ mode: "free" });
      pushFocus(focus);
    },
    [pushFocus]
  );

  const setSectorLevel = useCallback(
    (
      nextPath: { galaxyId: Id<"galaxies">; sectorId: Id<"sectors"> },
      focus: FocusRequest
    ) => {
      setLevel("sector");
      setPath(nextPath);
      setCameraLock({ mode: "free" });
      pushFocus(focus);
    },
    [pushFocus]
  );

  const setSystemLevel = useCallback(
    (
      nextPath: {
        galaxyId: Id<"galaxies">;
        sectorId: Id<"sectors">;
        systemId: Id<"systems">;
      },
      focus?: FocusRequest
    ) => {
      setLevel("system");
      setPath(nextPath);
      setCameraLock({ mode: "free" });
      if (focus) {
        pushFocus(focus);
        return;
      }

      setFocusTarget(null);
    },
    [pushFocus]
  );

  const setPlanetLevel = useCallback(
    (
      nextPath: {
        galaxyId: Id<"galaxies">;
        sectorId: Id<"sectors">;
        systemId: Id<"systems">;
        planetId: Id<"planets">;
      },
      focus: FocusRequest
    ) => {
      setLevel("planet");
      setPath(nextPath);
      setCameraLock({
        mode: "planet",
        planetId: nextPath.planetId,
      });
      pushFocus(focus);
    },
    [pushFocus]
  );

  const unlockCameraLock = useCallback(() => {
    setCameraLock({ mode: "free" });
    setFocusTarget(null);
  }, []);

  const value = useMemo(
    () => ({
      level,
      path,
      focusTarget,
      cameraLock,
      unlockCameraLock,
      setUniverseLevel,
      setGalaxyLevel,
      setSectorLevel,
      setSystemLevel,
      setPlanetLevel,
    }),
    [
      cameraLock,
      focusTarget,
      level,
      path,
      unlockCameraLock,
      setGalaxyLevel,
      setPlanetLevel,
      setSectorLevel,
      setSystemLevel,
      setUniverseLevel,
    ]
  );

  return <ExplorerContext value={value}>{children}</ExplorerContext>;
}

export function useExplorerContext() {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error("useExplorerContext must be used inside ExplorerProvider");
  }
  return context;
}
