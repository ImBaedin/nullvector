import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MOUSE, type Group, type OrthographicCamera } from "three";

export const Route = createFileRoute("/universe-explorer")({
  component: UniverseExplorerRoute,
});

type PlanetNode = {
  color: string;
  hazard: number;
  habitability: number;
  id: string;
  localX: number;
  localY: number;
  name: string;
  radius: number;
  resources: number;
};

type SolarSystemNode = {
  color: string;
  id: string;
  localX: number;
  localY: number;
  name: string;
  planets: PlanetNode[];
  radius: number;
};

type GalaxyNode = {
  color: string;
  id: string;
  name: string;
  radius: number;
  systems: SolarSystemNode[];
  x: number;
  y: number;
};

type UniverseData = {
  galaxies: GalaxyNode[];
};

type FocusState =
  | { level: "universe" }
  | { galaxyId: string; level: "galaxy" }
  | { galaxyId: string; level: "system"; systemId: string }
  | {
      galaxyId: string;
      level: "planet";
      planetId: string;
      systemId: string;
    };

type TransitionDirection = "down" | "up";

type TransitionState = {
  anchor: [number, number, number];
  direction: TransitionDirection;
  duration: number;
  from: FocusState;
  to: FocusState;
};

type LevelConfig = {
  maxZoom: number;
  minZoom: number;
  zoom: number;
};

type ListRowProps = {
  actionLabel: string;
  color: string;
  disabled?: boolean;
  meta: string;
  name: string;
  onDrill?: () => void;
};

const LEVEL_CONFIG: Record<FocusState["level"], LevelConfig> = {
  universe: { zoom: 7, minZoom: 3, maxZoom: 28 },
  galaxy: { zoom: 10, minZoom: 5, maxZoom: 42 },
  system: { zoom: 14, minZoom: 7, maxZoom: 58 },
  planet: { zoom: 24, minZoom: 12, maxZoom: 90 },
};

const GALAXY_SYSTEM_SCALE = 8;
const SYSTEM_PLANET_SCALE = 11;
const ISO_CAMERA_POSITION: [number, number, number] = [96, 96, 96];
const ISO_CAMERA_FAR = 900;
const FLAT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const GRID_SIZE = 280;

const GALAXY_PREFIXES = ["Andromeda", "Cygnus", "Helix", "Orion", "Lyra", "Vela"];
const GALAXY_SUFFIXES = ["Cluster", "Spiral", "Expanse", "Crown", "Reach", "Belt"];
const SYSTEM_NAMES = ["Aster", "Nova", "Kite", "Faro", "Drift", "Kora", "Atlas", "Pavo"];
const PLANET_NAMES = [
  "Aurum",
  "Brine",
  "Caelo",
  "Dune",
  "Erebus",
  "Flora",
  "Gale",
  "Haven",
  "Iris",
  "Juno",
  "Kora",
  "Lumen",
];

const GALAXY_COLORS = ["#78b4ff", "#89f0da", "#f7adff", "#ffd67a", "#ff9fba", "#8dc7ff"];
const SYSTEM_COLORS = ["#bfd7ff", "#a7ffe2", "#ffd7a9", "#f5c6ff", "#a6fff3", "#d0e1ff"];
const PLANET_COLORS = ["#b8ffe0", "#fbd3a2", "#9ee3ff", "#ffc2c2", "#e3ddff", "#f4ffb4"];

function UniverseExplorerRoute() {
  const universe = useMemo(
    () => createUniverse(Math.floor(Math.random() * 1_000_000_000)),
    []
  );
  const [focus, setFocus] = useState<FocusState>({ level: "universe" });
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [controlsResetKey, setControlsResetKey] = useState(0);

  const selected = resolveFocus(universe, focus);
  const selectedGalaxy = selected.galaxy;
  const selectedSystem = selected.system;
  const selectedPlanet = selected.planet;
  const isTransitioning = transition !== null;
  const activeFocus = transition?.to ?? focus;
  const currentLevelConfig = LEVEL_CONFIG[activeFocus.level];

  const drillTo = (nextFocus: FocusState) => {
    if (isTransitioning || isSameFocus(focus, nextFocus)) {
      return;
    }

    const direction: TransitionDirection =
      levelDepth(nextFocus.level) > levelDepth(focus.level) ? "down" : "up";
    const anchor = getTransitionAnchor(universe, focus, nextFocus);

    setTransition({
      anchor,
      direction,
      duration: 0.64,
      from: focus,
      to: nextFocus,
    });
    setFocus(nextFocus);
    setControlsResetKey((value) => value + 1);
  };

  const goUpOneLevel = () => {
    if (focus.level === "planet") {
      drillTo({
        level: "system",
        galaxyId: focus.galaxyId,
        systemId: focus.systemId,
      });
      return;
    }

    if (focus.level === "system") {
      drillTo({ level: "galaxy", galaxyId: focus.galaxyId });
      return;
    }

    if (focus.level === "galaxy") {
      drillTo({ level: "universe" });
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-[#050a12] text-slate-100">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#060d18]/95 p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Prototype</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Universe Explorer</h1>
          <p className="mt-2 text-sm text-slate-300/85">
            Drill from galaxy to planet and evaluate colonization potential.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="rounded-full border border-cyan-300/40 bg-cyan-200/10 px-3 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-200/20 disabled:opacity-50"
              disabled={isTransitioning}
              onClick={() => drillTo({ level: "universe" })}
              type="button"
            >
              Universe
            </button>

            {selectedGalaxy ? (
              <button
                className="rounded-full border border-cyan-300/30 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-200/20 disabled:opacity-50"
                disabled={isTransitioning}
                onClick={() => drillTo({ level: "galaxy", galaxyId: selectedGalaxy.id })}
                type="button"
              >
                {selectedGalaxy.name}
              </button>
            ) : null}

            {selectedSystem && selectedGalaxy ? (
              <button
                className="rounded-full border border-cyan-300/25 bg-cyan-200/10 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-200/20 disabled:opacity-50"
                disabled={isTransitioning}
                onClick={() =>
                  drillTo({
                    level: "system",
                    galaxyId: selectedGalaxy.id,
                    systemId: selectedSystem.id,
                  })
                }
                type="button"
              >
                {selectedSystem.name}
              </button>
            ) : null}

            {selectedPlanet ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-200">
                {selectedPlanet.name}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              className="rounded-md border border-white/20 bg-white/5 px-3 py-1 text-xs text-slate-100 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={focus.level === "universe" || isTransitioning}
              onClick={goUpOneLevel}
              type="button"
            >
              Up One Level
            </button>
            <p className="text-xs text-slate-300/70">Pan and zoom reset on drill transitions.</p>
          </div>

          <div className="mt-5 space-y-2">
            {focus.level === "universe"
              ? universe.galaxies.map((galaxy) => (
                  <ListRow
                    actionLabel="Drill"
                    color={galaxy.color}
                    disabled={isTransitioning}
                    key={galaxy.id}
                    meta={`${galaxy.systems.length} systems`}
                    name={galaxy.name}
                    onDrill={() => drillTo({ level: "galaxy", galaxyId: galaxy.id })}
                  />
                ))
              : null}

            {focus.level === "galaxy" && selectedGalaxy
              ? selectedGalaxy.systems.map((system) => (
                  <ListRow
                    actionLabel="Drill"
                    color={system.color}
                    disabled={isTransitioning}
                    key={system.id}
                    meta={`${system.planets.length} planets`}
                    name={system.name}
                    onDrill={() =>
                      drillTo({
                        level: "system",
                        galaxyId: selectedGalaxy.id,
                        systemId: system.id,
                      })
                    }
                  />
                ))
              : null}

            {focus.level === "system" && selectedGalaxy && selectedSystem
              ? selectedSystem.planets.map((planet) => (
                  <ListRow
                    actionLabel="Drill"
                    color={planet.color}
                    disabled={isTransitioning}
                    key={planet.id}
                    meta={`Readiness ${colonizationReadiness(planet)} / 100`}
                    name={planet.name}
                    onDrill={() =>
                      drillTo({
                        level: "planet",
                        galaxyId: selectedGalaxy.id,
                        systemId: selectedSystem.id,
                        planetId: planet.id,
                      })
                    }
                  />
                ))
              : null}

            {focus.level === "planet" && selectedPlanet ? (
              <ListRow
                actionLabel="Focused"
                color={selectedPlanet.color}
                disabled
                meta={`Habitability ${selectedPlanet.habitability}%`}
                name={selectedPlanet.name}
              />
            ) : null}
          </div>

          {selectedPlanet ? (
            <div className="mt-4 rounded-lg border border-emerald-300/35 bg-emerald-500/10 p-3 text-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/90">
                Colonization Snapshot
              </p>
              <p className="mt-2 text-slate-200">Habitability: {selectedPlanet.habitability}%</p>
              <p className="text-slate-200">Resource Index: {selectedPlanet.resources}%</p>
              <p className="text-slate-200">Hazard Index: {selectedPlanet.hazard}%</p>
              <p className="mt-1 font-medium text-emerald-200">
                Readiness Score: {colonizationReadiness(selectedPlanet)} / 100
              </p>
            </div>
          ) : null}
        </aside>

        <section className="relative min-h-[360px] lg:min-h-0">
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-white/20 bg-black/30 px-3 py-2 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/80">{focus.level}</p>
            <p className="text-xs text-slate-200/90">Click a shape or drill from the left panel.</p>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs text-slate-200/85 backdrop-blur-sm">
            Drag to pan. Scroll to zoom.
          </div>

          <Canvas
            orthographic
            camera={{
              far: ISO_CAMERA_FAR,
              near: 0.1,
              position: ISO_CAMERA_POSITION,
              zoom: LEVEL_CONFIG.universe.zoom,
            }}
          >
            <CameraRig resetToken={controlsResetKey} targetZoom={currentLevelConfig.zoom} />

            <color attach="background" args={["#050a12"]} />
            <ambientLight intensity={0.6} />
            <directionalLight intensity={0.95} position={[62, 110, 48]} />
            <gridHelper
              args={[GRID_SIZE, 34, "#35587b", "#1b2f49"]}
              position={[0, -0.38, 0]}
            />

            <UniverseScene
              focus={focus}
              isTransitioning={isTransitioning}
              onDrillToGalaxy={(galaxyId) => drillTo({ level: "galaxy", galaxyId })}
              onDrillToPlanet={(galaxyId, systemId, planetId) =>
                drillTo({ level: "planet", galaxyId, systemId, planetId })
              }
              onDrillToSystem={(galaxyId, systemId) =>
                drillTo({ level: "system", galaxyId, systemId })
              }
              onTransitionEnd={() => setTransition(null)}
              transition={transition}
              universe={universe}
            />

            <OrbitControls
              key={`controls-${controlsResetKey}`}
              makeDefault
              enableDamping
              enabled={!isTransitioning}
              enableRotate={false}
              minZoom={currentLevelConfig.minZoom}
              maxZoom={currentLevelConfig.maxZoom}
              screenSpacePanning
              target={[0, 0, 0]}
              zoomSpeed={0.65}
              mouseButtons={{
                LEFT: MOUSE.PAN,
                MIDDLE: MOUSE.DOLLY,
                RIGHT: MOUSE.PAN,
              }}
            />
          </Canvas>
        </section>
      </div>
    </div>
  );
}

function CameraRig({ resetToken, targetZoom }: { resetToken: number; targetZoom: number }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const orthographicCamera = camera as OrthographicCamera;
    const smoothing = 1 - Math.exp(-8 * delta);
    const nextZoom = lerp(orthographicCamera.zoom, targetZoom, smoothing);

    if (Math.abs(nextZoom - orthographicCamera.zoom) > 0.0005) {
      orthographicCamera.zoom = nextZoom;
      orthographicCamera.updateProjectionMatrix();
    }
  });

  useEffect(() => {
    const orthographicCamera = camera as OrthographicCamera;
    camera.position.set(...ISO_CAMERA_POSITION);
    camera.lookAt(0, 0, 0);
    orthographicCamera.updateProjectionMatrix();
  }, [camera, resetToken]);

  return null;
}

function UniverseScene({
  focus,
  isTransitioning,
  onDrillToGalaxy,
  onDrillToPlanet,
  onDrillToSystem,
  onTransitionEnd,
  transition,
  universe,
}: {
  focus: FocusState;
  isTransitioning: boolean;
  onDrillToGalaxy: (galaxyId: string) => void;
  onDrillToPlanet: (galaxyId: string, systemId: string, planetId: string) => void;
  onDrillToSystem: (galaxyId: string, systemId: string) => void;
  onTransitionEnd: () => void;
  transition: TransitionState | null;
  universe: UniverseData;
}) {
  const stars = useMemo(() => {
    const rng = createRng(2026);
    return Array.from({ length: 220 }, (_, index) => {
      return {
        elevation: randomRange(rng, 10, 52),
        id: `star-${index}`,
        opacity: randomRange(rng, 0.25, 0.92),
        size: randomRange(rng, 0.08, 0.22),
        x: randomRange(rng, -210, 210),
        y: randomRange(rng, -160, 160),
      };
    });
  }, []);

  return (
    <>
      {stars.map((star) => (
        <mesh key={star.id} position={[star.x, star.elevation, star.y]}>
          <sphereGeometry args={[star.size, 8, 8]} />
          <meshBasicMaterial color="#d7ecff" opacity={star.opacity} transparent />
        </mesh>
      ))}

      <mesh position={[0, -0.9, 0]} rotation={FLAT_ROTATION}>
        <circleGeometry args={[190, 64]} />
        <meshBasicMaterial color="#0b1729" opacity={0.45} transparent />
      </mesh>

      {transition ? (
        <TransitionLayers
          onTransitionEnd={onTransitionEnd}
          onDrillToGalaxy={onDrillToGalaxy}
          onDrillToPlanet={onDrillToPlanet}
          onDrillToSystem={onDrillToSystem}
          transition={transition}
          universe={universe}
        />
      ) : (
        <LevelContent
          focus={focus}
          interactive={!isTransitioning}
          onDrillToGalaxy={onDrillToGalaxy}
          onDrillToPlanet={onDrillToPlanet}
          onDrillToSystem={onDrillToSystem}
          universe={universe}
        />
      )}
    </>
  );
}

function TransitionLayers({
  onTransitionEnd,
  onDrillToGalaxy,
  onDrillToPlanet,
  onDrillToSystem,
  transition,
  universe,
}: {
  onTransitionEnd: () => void;
  onDrillToGalaxy: (galaxyId: string) => void;
  onDrillToPlanet: (galaxyId: string, systemId: string, planetId: string) => void;
  onDrillToSystem: (galaxyId: string, systemId: string) => void;
  transition: TransitionState;
  universe: UniverseData;
}) {
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);
  const fromGroupRef = useRef<Group | null>(null);
  const toGroupRef = useRef<Group | null>(null);

  useEffect(() => {
    elapsedRef.current = 0;
    finishedRef.current = false;

    if (transition.direction === "down") {
      applyTransform(fromGroupRef.current, [0, 0, 0], 1);
      applyTransform(toGroupRef.current, transition.anchor, 0.07);
      return;
    }

    applyTransform(toGroupRef.current, [0, 0, 0], 1.08);
    applyTransform(fromGroupRef.current, [0, 0, 0], 1);
  }, [transition.anchor, transition.direction]);

  useFrame((_, delta) => {
    elapsedRef.current = Math.min(transition.duration, elapsedRef.current + delta);
    const rawProgress = elapsedRef.current / transition.duration;
    const progress = easeInOutCubic(rawProgress);

    if (transition.direction === "down") {
      applyTransform(fromGroupRef.current, [0, 0, 0], lerp(1, 1.08, progress));
      applyTransform(
        toGroupRef.current,
        lerpPosition(transition.anchor, [0, 0, 0], progress),
        lerp(0.07, 1, progress)
      );
    } else {
      applyTransform(toGroupRef.current, [0, 0, 0], lerp(1.08, 1, progress));
      applyTransform(
        fromGroupRef.current,
        lerpPosition([0, 0, 0], transition.anchor, progress),
        lerp(1, 0.07, progress)
      );
    }

    if (rawProgress >= 1 && !finishedRef.current) {
      finishedRef.current = true;
      onTransitionEnd();
    }
  });

  if (transition.direction === "down") {
    return (
      <>
        <group ref={fromGroupRef}>
          <LevelContent
            focus={transition.from}
            interactive={false}
            onDrillToGalaxy={onDrillToGalaxy}
            onDrillToPlanet={onDrillToPlanet}
            onDrillToSystem={onDrillToSystem}
            universe={universe}
          />
        </group>
        <group ref={toGroupRef}>
          <LevelContent
            focus={transition.to}
            interactive={false}
            onDrillToGalaxy={onDrillToGalaxy}
            onDrillToPlanet={onDrillToPlanet}
            onDrillToSystem={onDrillToSystem}
            universe={universe}
          />
        </group>
      </>
    );
  }

  return (
    <>
      <group ref={toGroupRef}>
        <LevelContent
          focus={transition.to}
          interactive={false}
          onDrillToGalaxy={onDrillToGalaxy}
          onDrillToPlanet={onDrillToPlanet}
          onDrillToSystem={onDrillToSystem}
          universe={universe}
        />
      </group>
      <group ref={fromGroupRef}>
        <LevelContent
          focus={transition.from}
          interactive={false}
          onDrillToGalaxy={onDrillToGalaxy}
          onDrillToPlanet={onDrillToPlanet}
          onDrillToSystem={onDrillToSystem}
          universe={universe}
        />
      </group>
    </>
  );
}

function LevelContent({
  focus,
  interactive,
  onDrillToGalaxy,
  onDrillToPlanet,
  onDrillToSystem,
  universe,
}: {
  focus: FocusState;
  interactive: boolean;
  onDrillToGalaxy: (galaxyId: string) => void;
  onDrillToPlanet: (galaxyId: string, systemId: string, planetId: string) => void;
  onDrillToSystem: (galaxyId: string, systemId: string) => void;
  universe: UniverseData;
}) {
  const resolved = resolveFocus(universe, focus);
  const selectedGalaxy = resolved.galaxy;
  const selectedSystem = resolved.system;
  const selectedPlanet = resolved.planet;

  return (
    <>
      {focus.level === "universe"
        ? universe.galaxies.map((galaxy) => (
            <GalaxyShape
              galaxy={galaxy}
              key={galaxy.id}
              onClick={interactive ? () => onDrillToGalaxy(galaxy.id) : undefined}
            />
          ))
        : null}

      {focus.level === "galaxy" && selectedGalaxy
        ? selectedGalaxy.systems.map((system) => (
            <SolarSystemShape
              key={system.id}
              onClick={
                interactive ? () => onDrillToSystem(selectedGalaxy.id, system.id) : undefined
              }
              system={system}
              x={system.localX * GALAXY_SYSTEM_SCALE}
              y={system.localY * GALAXY_SYSTEM_SCALE}
            />
          ))
        : null}

      {(focus.level === "system" || focus.level === "planet") && selectedSystem
        ? selectedSystem.planets.map((planet) => {
            const x = planet.localX * SYSTEM_PLANET_SCALE;
            const y = planet.localY * SYSTEM_PLANET_SCALE;
            const isFocused = selectedPlanet?.id === planet.id;
            const canDrill = interactive && focus.level === "system" && selectedGalaxy;
            return (
              <PlanetShape
                canDrill={Boolean(canDrill)}
                key={planet.id}
                onClick={
                  canDrill
                    ? () => onDrillToPlanet(selectedGalaxy.id, selectedSystem.id, planet.id)
                    : undefined
                }
                planet={planet}
                radiusMultiplier={isFocused ? 1.22 : 1}
                x={x}
                y={y}
              />
            );
          })
        : null}

      {focus.level === "galaxy" ? (
        <mesh position={[0, -0.12, 0]} rotation={FLAT_ROTATION}>
          <ringGeometry args={[42, 46, 120]} />
          <meshBasicMaterial color="#5fc1ff" opacity={0.1} transparent />
        </mesh>
      ) : null}

      {focus.level === "system" && selectedSystem
        ? selectedSystem.planets.map((planet) => {
            const orbitRadius =
              Math.sqrt(planet.localX ** 2 + planet.localY ** 2) * SYSTEM_PLANET_SCALE;
            return (
              <mesh key={`orbit-${planet.id}`} position={[0, -0.08, 0]} rotation={FLAT_ROTATION}>
                <ringGeometry args={[orbitRadius - 0.1, orbitRadius + 0.1, 80]} />
                <meshBasicMaterial color="#c5daff" opacity={0.18} transparent />
              </mesh>
            );
          })
        : null}

      {focus.level === "planet" && selectedPlanet ? (
        <group>
          <mesh position={[0, -0.1, 0]} rotation={FLAT_ROTATION}>
            <ringGeometry args={[26, 28, 120]} />
            <meshBasicMaterial color="#8ddcff" opacity={0.2} transparent />
          </mesh>
          <mesh rotation={FLAT_ROTATION}>
            <circleGeometry args={[18, 64]} />
            <meshStandardMaterial
              color={selectedPlanet.color}
              emissive={selectedPlanet.color}
              emissiveIntensity={0.2}
            />
          </mesh>
          <mesh position={[6, 2.2, 4]}>
            <sphereGeometry args={[2.6, 20, 20]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ) : null}
    </>
  );
}

function GalaxyShape({
  galaxy,
  onClick,
}: {
  galaxy: GalaxyNode;
  onClick?: () => void;
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onClick) {
      return;
    }

    event.stopPropagation();
    onClick();
  };

  return (
    <group position={isoPosition(galaxy.x, galaxy.y)}>
      <mesh onClick={handleClick} rotation={FLAT_ROTATION}>
        <circleGeometry args={[galaxy.radius, 36]} />
        <meshStandardMaterial color={galaxy.color} emissive={galaxy.color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={FLAT_ROTATION}>
        <ringGeometry args={[galaxy.radius * 1.2, galaxy.radius * 1.42, 64]} />
        <meshBasicMaterial color="#d4e5ff" opacity={0.25} transparent />
      </mesh>
    </group>
  );
}

function SolarSystemShape({
  onClick,
  system,
  x,
  y,
}: {
  onClick?: () => void;
  system: SolarSystemNode;
  x: number;
  y: number;
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onClick) {
      return;
    }

    event.stopPropagation();
    onClick();
  };

  return (
    <group position={isoPosition(x, y)}>
      <mesh onClick={handleClick} rotation={[-Math.PI / 2, Math.PI / 4, 0]}>
        <planeGeometry args={[system.radius * 2.4, system.radius * 2.4]} />
        <meshStandardMaterial color={system.color} emissive={system.color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={FLAT_ROTATION}>
        <circleGeometry args={[system.radius * 0.55, 24]} />
        <meshBasicMaterial color="#f5f8ff" opacity={0.85} transparent />
      </mesh>
    </group>
  );
}

function PlanetShape({
  canDrill,
  onClick,
  planet,
  radiusMultiplier,
  x,
  y,
}: {
  canDrill: boolean;
  onClick?: () => void;
  planet: PlanetNode;
  radiusMultiplier?: number;
  x: number;
  y: number;
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onClick) {
      return;
    }

    event.stopPropagation();
    onClick();
  };

  return (
    <group position={isoPosition(x, y)}>
      <mesh onClick={handleClick} rotation={FLAT_ROTATION}>
        <circleGeometry args={[planet.radius * (radiusMultiplier ?? 1), 28]} />
        <meshStandardMaterial color={planet.color} emissive={planet.color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={FLAT_ROTATION}>
        <ringGeometry
          args={[
            planet.radius * (radiusMultiplier ?? 1) * 1.32,
            planet.radius * (radiusMultiplier ?? 1) * 1.42,
            44,
          ]}
        />
        <meshBasicMaterial color="#dce9ff" opacity={canDrill ? 0.32 : 0.18} transparent />
      </mesh>
    </group>
  );
}

function ListRow({
  actionLabel,
  color,
  disabled,
  meta,
  name,
  onDrill,
}: ListRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
        <p className="text-xs text-slate-300/80">{meta}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <button
          className="rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-cyan-50 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={onDrill}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function createUniverse(seed: number): UniverseData {
  const rng = createRng(seed);
  const galaxyCount = randomInt(rng, 5, 8);
  const galaxies: GalaxyNode[] = [];

  for (let galaxyIndex = 0; galaxyIndex < galaxyCount; galaxyIndex++) {
    const galaxyId = `galaxy-${galaxyIndex + 1}`;
    const baseAngle = (galaxyIndex / galaxyCount) * Math.PI * 2;
    const angle = baseAngle + randomRange(rng, -0.22, 0.22);
    const distance = 30 + galaxyIndex * 9 + randomRange(rng, -4, 4);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const radius = randomRange(rng, 2.8, 4.6);
    const color = pick(rng, GALAXY_COLORS);
    const systems: SolarSystemNode[] = [];

    const systemCount = randomInt(rng, 4, 8);
    for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
      const systemId = `${galaxyId}-system-${systemIndex + 1}`;
      const systemAngle = randomRange(rng, 0, Math.PI * 2);
      const systemDistance = randomRange(rng, 2.2, 7.8);
      const localX = Math.cos(systemAngle) * systemDistance;
      const localY = Math.sin(systemAngle) * systemDistance;
      const systemRadius = randomRange(rng, 1.2, 1.95);
      const planetCount = randomInt(rng, 3, 6);
      const planets: PlanetNode[] = [];

      let orbitDistance = randomRange(rng, 1.2, 1.6);
      for (let planetIndex = 0; planetIndex < planetCount; planetIndex++) {
        orbitDistance += randomRange(rng, 0.9, 1.55);
        const planetAngle = randomRange(rng, 0, Math.PI * 2);
        const planetId = `${systemId}-planet-${planetIndex + 1}`;
        planets.push({
          color: pick(rng, PLANET_COLORS),
          hazard: randomInt(rng, 5, 90),
          habitability: randomInt(rng, 22, 95),
          id: planetId,
          localX: Math.cos(planetAngle) * orbitDistance,
          localY: Math.sin(planetAngle) * orbitDistance,
          name: `${pick(rng, PLANET_NAMES)}-${planetIndex + 1}`,
          radius: randomRange(rng, 0.5, 1.1),
          resources: randomInt(rng, 20, 99),
        });
      }

      systems.push({
        color: pick(rng, SYSTEM_COLORS),
        id: systemId,
        localX,
        localY,
        name: `${pick(rng, SYSTEM_NAMES)} ${systemIndex + 1}`,
        planets,
        radius: systemRadius,
      });
    }

    galaxies.push({
      color,
      id: galaxyId,
      name: `${pick(rng, GALAXY_PREFIXES)} ${pick(rng, GALAXY_SUFFIXES)}`,
      radius,
      systems,
      x,
      y,
    });
  }

  return { galaxies };
}

function resolveFocus(universe: UniverseData, focus: FocusState) {
  if (focus.level === "universe") {
    return {
      galaxy: undefined,
      planet: undefined,
      system: undefined,
    };
  }

  const galaxy = getGalaxy(universe, focus.galaxyId);
  if (!galaxy || focus.level === "galaxy") {
    return {
      galaxy,
      planet: undefined,
      system: undefined,
    };
  }

  const system = getSystem(universe, focus.galaxyId, focus.systemId);
  if (!system || focus.level === "system") {
    return {
      galaxy,
      planet: undefined,
      system,
    };
  }

  return {
    galaxy,
    planet: getPlanet(universe, focus.galaxyId, focus.systemId, focus.planetId),
    system,
  };
}

function getTransitionAnchor(
  universe: UniverseData,
  fromFocus: FocusState,
  toFocus: FocusState
): [number, number, number] {
  if (toFocus.level === "universe") {
    const galaxyId = fromFocus.level === "universe" ? undefined : fromFocus.galaxyId;
    const galaxy = galaxyId ? getGalaxy(universe, galaxyId) : undefined;
    return galaxy ? isoPosition(galaxy.x, galaxy.y) : [0, 0, 0];
  }

  if (toFocus.level === "galaxy") {
    if (fromFocus.level === "universe") {
      const galaxy = getGalaxy(universe, toFocus.galaxyId);
      return galaxy ? isoPosition(galaxy.x, galaxy.y) : [0, 0, 0];
    }

    const systemId =
      fromFocus.level === "system" || fromFocus.level === "planet"
        ? fromFocus.systemId
        : undefined;
    const system = systemId ? getSystem(universe, fromFocus.galaxyId, systemId) : undefined;
    return system
      ? isoPosition(system.localX * GALAXY_SYSTEM_SCALE, system.localY * GALAXY_SYSTEM_SCALE)
      : [0, 0, 0];
  }

  if (toFocus.level === "system") {
    if (fromFocus.level === "planet") {
      const planet = getPlanet(universe, fromFocus.galaxyId, fromFocus.systemId, fromFocus.planetId);
      return planet
        ? isoPosition(planet.localX * SYSTEM_PLANET_SCALE, planet.localY * SYSTEM_PLANET_SCALE)
        : [0, 0, 0];
    }

    const system = getSystem(universe, toFocus.galaxyId, toFocus.systemId);
    return system
      ? isoPosition(system.localX * GALAXY_SYSTEM_SCALE, system.localY * GALAXY_SYSTEM_SCALE)
      : [0, 0, 0];
  }

  const planet = getPlanet(universe, toFocus.galaxyId, toFocus.systemId, toFocus.planetId);
  return planet
    ? isoPosition(planet.localX * SYSTEM_PLANET_SCALE, planet.localY * SYSTEM_PLANET_SCALE)
    : [0, 0, 0];
}

function applyTransform(group: Group | null, position: [number, number, number], scale: number) {
  if (!group) {
    return;
  }

  group.position.set(position[0], position[1], position[2]);
  group.scale.set(scale, scale, scale);
}

function levelDepth(level: FocusState["level"]) {
  if (level === "universe") {
    return 0;
  }

  if (level === "galaxy") {
    return 1;
  }

  if (level === "system") {
    return 2;
  }

  return 3;
}

function getGalaxy(universe: UniverseData, galaxyId: string) {
  return universe.galaxies.find((galaxy) => galaxy.id === galaxyId);
}

function getSystem(universe: UniverseData, galaxyId: string, systemId: string) {
  return getGalaxy(universe, galaxyId)?.systems.find((system) => system.id === systemId);
}

function getPlanet(
  universe: UniverseData,
  galaxyId: string,
  systemId: string,
  planetId: string
) {
  return getSystem(universe, galaxyId, systemId)?.planets.find((planet) => planet.id === planetId);
}

function isSameFocus(left: FocusState, right: FocusState) {
  if (left.level !== right.level) {
    return false;
  }

  if (left.level === "universe" && right.level === "universe") {
    return true;
  }

  if (left.level === "galaxy" && right.level === "galaxy") {
    return left.galaxyId === right.galaxyId;
  }

  if (left.level === "system" && right.level === "system") {
    return left.galaxyId === right.galaxyId && left.systemId === right.systemId;
  }

  if (left.level === "planet" && right.level === "planet") {
    return (
      left.galaxyId === right.galaxyId &&
      left.systemId === right.systemId &&
      left.planetId === right.planetId
    );
  }

  return false;
}

function easeInOutCubic(value: number) {
  if (value < 0.5) {
    return 4 * value ** 3;
  }

  return 1 - (-2 * value + 2) ** 3 / 2;
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function lerpPosition(
  from: [number, number, number],
  to: [number, number, number],
  progress: number
): [number, number, number] {
  return [
    lerp(from[0], to[0], progress),
    lerp(from[1], to[1], progress),
    lerp(from[2], to[2], progress),
  ];
}

function isoPosition(x: number, y: number, elevation = 0): [number, number, number] {
  return [x, elevation, y];
}

function createRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomRange(rng: () => number, min: number, max: number) {
  return rng() * (max - min) + min;
}

function pick<T>(rng: () => number, values: T[]) {
  return values[Math.floor(rng() * values.length)] as T;
}

function colonizationReadiness(planet: PlanetNode) {
  const score =
    planet.habitability * 0.56 + planet.resources * 0.38 - planet.hazard * 0.32 + 18;
  return Math.max(0, Math.min(100, Math.round(score)));
}
