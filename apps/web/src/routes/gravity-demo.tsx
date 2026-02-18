import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { MOUSE, type Mesh, Vector3 } from "three";

export const Route = createFileRoute("/gravity-demo")({
  component: GravityDemoRoute,
});

type BodyConfig = {
  color: string;
  name: string;
  phase: number;
  radius: number;
  size: number;
  speed: number;
};

type KeyboardEnabledControls = {
  keyPanSpeed: number;
  listenToKeyEvents: (domElement: HTMLElement) => void;
  stopListenToKeyEvents: () => void;
};

const ORBIT_PLANE_Y = 5.6;

const STAR: BodyConfig = {
  name: "Helios",
  color: "#ffb76a",
  size: 1.6,
  radius: 0,
  speed: 0,
  phase: 0,
};

const PLANETS: BodyConfig[] = [
  {
    name: "Ari",
    color: "#ffffff",
    size: 0.4,
    radius: 20,
    speed: 0.1,
    phase: 0.6,
  },
  {
    name: "Ari",
    color: "#ffffff",
    size: 0.4,
    radius: 30,
    speed: 0.1,
    phase: 0.1,
  },
  {
    name: "Boreal",
    color: "#ffffff",
    size: 0.4,
    radius: 40,
    speed: 0.09,
    phase: 1.8,
  },
  {
    name: "Ari",
    color: "#ffffff",
    size: 0.4,
    radius: 50,
    speed: 0.1,
    phase: 0.6,
  },
  {
    name: "Crya",
    color: "#ffffff",
    size: 0.4,
    radius: 60,
    speed: 0.07,
    phase: 3.5,
  },
];

const MAX_ORBIT_RADIUS = Math.max(...PLANETS.map((planet) => planet.radius));
const CAMERA_DISTANCE = Math.max(30, MAX_ORBIT_RADIUS * 1.8);
const CAMERA_POSITION: [number, number, number] = [
  CAMERA_DISTANCE,
  CAMERA_DISTANCE,
  CAMERA_DISTANCE,
];
const CAMERA_FAR = Math.max(3000, CAMERA_DISTANCE * 30);
const GRID_SIZE = Math.max(56, MAX_ORBIT_RADIUS * 2.4);
const GRID_DIVISIONS = Math.max(56, Math.round(GRID_SIZE));

function circlePoints(
  radius: number,
  segments = 140
): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push([
      Math.cos(theta) * radius,
      ORBIT_PLANE_Y,
      Math.sin(theta) * radius,
    ]);
  }
  return points;
}

function getBodyPosition(config: BodyConfig, elapsed: number, target: Vector3) {
  if (config.radius === 0) {
    target.set(0, ORBIT_PLANE_Y, 0);
    return target;
  }

  const angle = elapsed * config.speed + config.phase;
  target.set(
    Math.cos(angle) * config.radius,
    ORBIT_PLANE_Y,
    Math.sin(angle) * config.radius
  );
  return target;
}

function GravityDemoRoute() {
  const controlsRef = useRef<KeyboardEnabledControls | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    controls.listenToKeyEvents(document.body);
    return () => {
      controls.stopListenToKeyEvents();
    };
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#03050b] text-white">
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none p-4">
        <div className="inline-flex flex-col gap-1 rounded-md border border-white/20 bg-black/40 px-3 py-2 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">
            Demo
          </p>
          <h1 className="text-sm font-medium tracking-wide">
            Isometric Gravity Grid
          </h1>
        </div>
      </div>
      <Canvas
        orthographic
        camera={{
          position: CAMERA_POSITION,
          zoom: 34,
          near: 0.01,
          far: CAMERA_FAR,
        }}
        shadows
      >
        <color attach="background" args={["#03050b"]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          castShadow
          intensity={1.15}
          position={[12, 24, 8]}
          shadow-mapSize-height={2048}
          shadow-mapSize-width={2048}
        />

        <GroundGrid />
        <SolarSystem />

        <OrbitControls
          ref={(controls) => {
            controlsRef.current = controls as KeyboardEnabledControls | null;
          }}
          makeDefault
          enableDamping
          enableRotate={false}
          mouseButtons={{
            LEFT: MOUSE.PAN,
            MIDDLE: MOUSE.DOLLY,
            RIGHT: MOUSE.PAN,
          }}
          keyPanSpeed={45}
          screenSpacePanning
          minZoom={1}
          maxZoom={200}
          target={[0, ORBIT_PLANE_Y, 0]}
          zoomSpeed={0.55}
        />
      </Canvas>
    </div>
  );
}

function GroundGrid() {
  return (
    <>
      <mesh position={[0, -0.01, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial
          color="#0a111e"
          metalness={0.08}
          roughness={0.92}
        />
      </mesh>
      <gridHelper
        args={[GRID_SIZE, GRID_DIVISIONS, "#2f3d58", "#18243c"]}
        position={[0, 0.02, 0]}
      />
    </>
  );
}

function SolarSystem() {
  const starRef = useRef<Mesh | null>(null);
  const planetRefs = useRef<Array<Mesh | null>>([]);
  const temp = useRef(new Vector3());
  const planetPositions = useMemo(() => PLANETS.map(() => new Vector3()), []);
  const orbitLines = useMemo(
    () => PLANETS.map((planet) => circlePoints(planet.radius)),
    []
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (starRef.current) {
      const starPosition = getBodyPosition(STAR, elapsed, temp.current);
      starRef.current.position.copy(starPosition);
    }

    PLANETS.forEach((planet, index) => {
      const mesh = planetRefs.current[index];
      if (!mesh) {
        return;
      }

      const planetPosition = getBodyPosition(
        planet,
        elapsed,
        planetPositions[index] ?? new Vector3()
      );
      mesh.position.copy(planetPosition);
    });
  });

  return (
    <>
      {orbitLines.map((points, index) => (
        <Line
          key={PLANETS[index]?.name}
          color="#a0b7ff"
          lineWidth={1}
          opacity={0.2}
          points={points}
          transparent
        />
      ))}

      <mesh castShadow ref={starRef}>
        <sphereGeometry args={[STAR.size, 40, 40]} />
        <meshStandardMaterial
          color={STAR.color}
          emissive={STAR.color}
          emissiveIntensity={1.2}
        />
        <pointLight color={STAR.color} decay={2} distance={66} intensity={85} />
      </mesh>

      {PLANETS.map((planet, index) => (
        <mesh
          castShadow
          key={planet.name}
          ref={(node: Mesh | null) => {
            planetRefs.current[index] = node;
          }}
        >
          <sphereGeometry args={[planet.size, 28, 28]} />
          <meshStandardMaterial
            color={planet.color}
            emissive={planet.color}
            emissiveIntensity={0.45}
          />
        </mesh>
      ))}
    </>
  );
}
