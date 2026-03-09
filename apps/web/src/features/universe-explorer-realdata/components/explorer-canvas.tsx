import type { Group, Material, Object3D, OrthographicCamera, Vector3 } from "three";

import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";

import type { CameraFocusTarget, ExplorerResolvedQuality } from "../types";

import { CameraFocusController } from "../hooks/use-camera-focus";
import { NebulaBackground } from "./nebula-background";

type BasicMapControls = {
	target: Vector3;
	update: () => void;
};

type ExplorerCanvasProps = {
	antialias: boolean;
	dpr: [number, number];
	focusTarget: CameraFocusTarget | null;
	cameraMode?: "free" | "followPlanet";
	trackingOrbit?: {
		centerX: number;
		centerY: number;
		orbitRadius: number;
		orbitPhaseRad: number;
		orbitAngularVelocityRadPerSec: number;
		orbitEpochMs: number;
	} | null;
	maxFps?: number;
	onPanWhileLocked?: () => void;
	onPointerMissed: () => void;
	quality: ExplorerResolvedQuality;
	sceneKey: string | number;
	children: React.ReactNode;
};

const GRID_Z = -300;
const TARGET_MINOR_CELL_PIXELS = 56;
const MAJOR_GRID_MULTIPLIER = 5;
const MAJOR_DIVISIONS = 28;
const ISOMETRIC_CAMERA_OFFSET = {
	x: 3_000,
	y: -3_000,
	z: 3_000,
} as const;
const LEVEL_FADE_DURATION_SECONDS = 0.24;

type MaterialState = {
	opacity: number;
	transparent: boolean;
	depthWrite: boolean;
};
type SceneSnapshot = {
	id: number;
	node: React.ReactNode;
};

function shouldSkipFadeBetweenLevels(previousKey: string | number, nextKey: string | number) {
	if (typeof previousKey !== "string" || typeof nextKey !== "string") {
		return false;
	}

	return (
		(previousKey === "system" && nextKey === "planet") ||
		(previousKey === "planet" && nextKey === "system")
	);
}

const materialStateRegistry = new WeakMap<Material, MaterialState>();

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function forEachObjectMaterial(object: Object3D, callback: (material: Material) => void) {
	object.traverse((child) => {
		const material = (child as { material?: Material | Material[] }).material;
		if (!material) {
			return;
		}

		if (Array.isArray(material)) {
			material.forEach((entry) => callback(entry));
			return;
		}

		callback(material);
	});
}

function getMaterialState(material: Material) {
	const existing = materialStateRegistry.get(material);
	if (existing) {
		return existing;
	}

	const snapshot = {
		opacity: material.opacity,
		transparent: material.transparent,
		depthWrite: material.depthWrite,
	};
	materialStateRegistry.set(material, snapshot);
	return snapshot;
}

function applyFadeOpacity(object: Object3D, opacity: number) {
	const alpha = clamp01(opacity);

	forEachObjectMaterial(object, (material) => {
		const original = getMaterialState(material);
		const nextDepthWrite = original.depthWrite && alpha >= 0.999;

		if (!material.transparent) {
			material.transparent = true;
			material.needsUpdate = true;
		}

		if (material.depthWrite !== nextDepthWrite) {
			material.depthWrite = nextDepthWrite;
			material.needsUpdate = true;
		}

		material.opacity = original.opacity * alpha;
	});
}

function restoreMaterialState(object: Object3D) {
	forEachObjectMaterial(object, (material) => {
		const original = materialStateRegistry.get(material);
		if (!original) {
			return;
		}

		material.opacity = original.opacity;

		if (material.transparent !== original.transparent) {
			material.transparent = original.transparent;
			material.needsUpdate = true;
		}

		if (material.depthWrite !== original.depthWrite) {
			material.depthWrite = original.depthWrite;
			material.needsUpdate = true;
		}
	});
}

type AdaptiveGridConfig = {
	centerX: number;
	centerY: number;
	size: number;
	majorDivisions: number;
	minorDivisions: number;
};

function getNiceStep(step: number) {
	const safeStep = Math.max(step, Number.EPSILON);
	const exponent = Math.floor(Math.log10(safeStep));
	const base = 10 ** exponent;
	const normalized = safeStep / base;

	if (normalized <= 1) return base;
	if (normalized <= 2) return 2 * base;
	if (normalized <= 5) return 5 * base;
	return 10 * base;
}

function snapToStep(value: number, step: number) {
	if (!Number.isFinite(value) || step <= 0) return 0;
	return Math.round(value / step) * step;
}

function getGridConfig({
	zoom,
	centerX,
	centerY,
	quality,
}: {
	zoom: number;
	centerX: number;
	centerY: number;
	quality: ExplorerResolvedQuality;
}): AdaptiveGridConfig {
	const safeZoom = Math.max(zoom, Number.EPSILON);
	const minorStep = getNiceStep(TARGET_MINOR_CELL_PIXELS / safeZoom);
	const majorStep = minorStep * MAJOR_GRID_MULTIPLIER;
	const majorDivisions = MAJOR_DIVISIONS;
	const size = majorDivisions * majorStep;
	const minorDivisions =
		quality === "low"
			? majorDivisions
			: quality === "medium"
				? majorDivisions * 3
				: majorDivisions * MAJOR_GRID_MULTIPLIER;

	return {
		centerX: snapToStep(centerX, majorStep),
		centerY: snapToStep(centerY, majorStep),
		size,
		majorDivisions,
		minorDivisions,
	};
}

function getGridConfigKey(config: AdaptiveGridConfig) {
	return [
		config.centerX,
		config.centerY,
		config.size,
		config.majorDivisions,
		config.minorDivisions,
	].join("|");
}

function AdaptiveGrid({
	controlsRef,
	quality,
}: {
	controlsRef: RefObject<BasicMapControls | null>;
	quality: ExplorerResolvedQuality;
}) {
	const camera = useThree((state) => state.camera);
	const [gridConfig, setGridConfig] = useState<AdaptiveGridConfig>(() =>
		getGridConfig({
			zoom: 0.08,
			centerX: 0,
			centerY: 0,
			quality,
		}),
	);
	const gridKeyRef = useRef(getGridConfigKey(gridConfig));

	useFrame(() => {
		if (camera.type !== "OrthographicCamera") return;

		const orthographicCamera = camera as OrthographicCamera;
		const target = controlsRef.current?.target;
		const nextGridConfig = getGridConfig({
			zoom: orthographicCamera.zoom,
			centerX: target?.x ?? 0,
			centerY: target?.y ?? 0,
			quality,
		});
		const nextGridKey = getGridConfigKey(nextGridConfig);
		if (nextGridKey === gridKeyRef.current) return;

		gridKeyRef.current = nextGridKey;
		setGridConfig(nextGridConfig);
	});

	return (
		<>
			{quality === "low" ? null : (
				<gridHelper
					key={`minor-${gridConfig.size}-${gridConfig.minorDivisions}`}
					args={[gridConfig.size, gridConfig.minorDivisions, "#6ea8ff", "#3c5f8f"]}
					position={[gridConfig.centerX, gridConfig.centerY, GRID_Z]}
					rotation={[Math.PI / 2, 0, 0]}
					renderOrder={1}
					material-transparent
					material-opacity={0.2}
					material-depthTest
					material-depthWrite={false}
					raycast={() => {}}
				/>
			)}
			<gridHelper
				key={`major-${gridConfig.size}-${gridConfig.majorDivisions}`}
				args={[gridConfig.size, gridConfig.majorDivisions, "#b4d6ff", "#6ea8ff"]}
				position={[gridConfig.centerX, gridConfig.centerY, GRID_Z + 0.1]}
				rotation={[Math.PI / 2, 0, 0]}
				renderOrder={2}
				material-transparent
				material-opacity={0.5}
				material-depthTest
				material-depthWrite={false}
				raycast={() => {}}
			/>
		</>
	);
}

function FadingSceneGroup({
	direction,
	transitionKey,
	animate,
	children,
	onFadeOutComplete,
}: {
	direction: "in" | "out";
	transitionKey: string | number;
	animate: boolean;
	children: React.ReactNode;
	onFadeOutComplete?: () => void;
}) {
	const groupRef = useRef<Group | null>(null);
	const opacityRef = useRef(1);
	const completedRef = useRef(false);

	useEffect(() => {
		const initialOpacity = animate ? (direction === "in" ? 0 : 1) : 1;
		opacityRef.current = initialOpacity;
		completedRef.current = !animate;

		if (groupRef.current) {
			applyFadeOpacity(groupRef.current, initialOpacity);
			if (!animate) {
				restoreMaterialState(groupRef.current);
			}
		}

		return () => {
			if (groupRef.current) {
				restoreMaterialState(groupRef.current);
			}
		};
	}, [animate, direction, transitionKey]);

	useFrame((_, delta) => {
		if (!animate || completedRef.current || !groupRef.current) {
			return;
		}

		const targetOpacity = direction === "in" ? 1 : 0;
		const step = delta / LEVEL_FADE_DURATION_SECONDS;
		const nextOpacity =
			direction === "in"
				? Math.min(targetOpacity, opacityRef.current + step)
				: Math.max(targetOpacity, opacityRef.current - step);

		opacityRef.current = nextOpacity;
		applyFadeOpacity(groupRef.current, nextOpacity);

		if (nextOpacity !== targetOpacity) {
			return;
		}

		completedRef.current = true;
		if (direction === "in") {
			restoreMaterialState(groupRef.current);
			return;
		}

		onFadeOutComplete?.();
	});

	return <group ref={groupRef}>{children}</group>;
}

function DemandFrameTicker({ fps }: { fps: number }) {
	const invalidate = useThree((state) => state.invalidate);

	useEffect(() => {
		if (!Number.isFinite(fps) || fps <= 0) {
			return;
		}

		const intervalMs = Math.max(16, Math.round(1_000 / fps));
		const id = window.setInterval(() => {
			invalidate();
		}, intervalMs);

		return () => {
			window.clearInterval(id);
		};
	}, [fps, invalidate]);

	return null;
}

export function ExplorerCanvas({
	antialias,
	dpr,
	focusTarget,
	cameraMode = "free",
	trackingOrbit = null,
	maxFps = 60,
	onPanWhileLocked,
	onPointerMissed,
	quality,
	sceneKey,
	children,
}: ExplorerCanvasProps) {
	const controlsRef = useRef<BasicMapControls | null>(null);
	const [exitingScene, setExitingScene] = useState<SceneSnapshot | null>(null);
	const [enterTransitionId, setEnterTransitionId] = useState(0);
	const [animateEnterScene, setAnimateEnterScene] = useState(false);
	const previousSceneRef = useRef({
		key: sceneKey,
		node: children,
	});
	const sceneCounterRef = useRef(0);
	const interactionStateRef = useRef({
		pointerDown: false,
		startX: 0,
		startY: 0,
		didMove: false,
	});

	useEffect(() => {
		const handleWindowPointerUp = () => {
			const state = interactionStateRef.current;
			if (!state.pointerDown) {
				return;
			}

			if (state.didMove && cameraMode === "followPlanet") {
				onPanWhileLocked?.();
			}

			state.pointerDown = false;
			state.didMove = false;
		};

		const handleWindowBlur = () => {
			interactionStateRef.current.pointerDown = false;
			interactionStateRef.current.didMove = false;
		};

		window.addEventListener("pointerup", handleWindowPointerUp);
		window.addEventListener("pointercancel", handleWindowPointerUp);
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("pointerup", handleWindowPointerUp);
			window.removeEventListener("pointercancel", handleWindowPointerUp);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [cameraMode, onPanWhileLocked]);

	useEffect(() => {
		const previousScene = previousSceneRef.current;
		if (sceneKey !== previousScene.key) {
			const shouldSkipFade = shouldSkipFadeBetweenLevels(previousScene.key, sceneKey);

			if (shouldSkipFade) {
				setExitingScene(null);
				setAnimateEnterScene(false);
			} else {
				sceneCounterRef.current += 1;
				setExitingScene({
					id: sceneCounterRef.current,
					node: previousScene.node,
				});
				setAnimateEnterScene(true);
			}

			setEnterTransitionId((currentId) => currentId + 1);
		}

		previousSceneRef.current = {
			key: sceneKey,
			node: children,
		};
	}, [children, sceneKey]);

	return (
		<div
			className="size-full"
			onPointerDownCapture={(event) => {
				if (cameraMode !== "followPlanet" || event.pointerType === "touch") {
					return;
				}

				const state = interactionStateRef.current;
				state.pointerDown = true;
				state.startX = event.clientX;
				state.startY = event.clientY;
				state.didMove = false;
			}}
			onPointerMoveCapture={(event) => {
				const state = interactionStateRef.current;
				if (!state.pointerDown || state.didMove || cameraMode !== "followPlanet") {
					return;
				}

				const dx = event.clientX - state.startX;
				const dy = event.clientY - state.startY;
				if (Math.hypot(dx, dy) >= 6) {
					state.didMove = true;
				}
			}}
			onPointerUpCapture={() => {
				const state = interactionStateRef.current;
				if (!state.pointerDown) {
					return;
				}

				if (state.didMove && cameraMode === "followPlanet") {
					onPanWhileLocked?.();
				}

				state.pointerDown = false;
				state.didMove = false;
			}}
			onWheelCapture={(event) => {
				event.preventDefault();
			}}
			style={{ touchAction: "none" }}
		>
			<Canvas
				frameloop={maxFps >= 50 ? "always" : "demand"}
				dpr={dpr}
				gl={{
					antialias,
					powerPreference: "high-performance",
				}}
				orthographic
				camera={{
					position: [
						ISOMETRIC_CAMERA_OFFSET.x,
						ISOMETRIC_CAMERA_OFFSET.y,
						ISOMETRIC_CAMERA_OFFSET.z,
					],
					up: [0, 0, 1],
					zoom: 0.08,
					near: -100_000,
					far: 100_000,
				}}
				onPointerMissed={onPointerMissed}
			>
				{maxFps < 50 ? <DemandFrameTicker fps={maxFps} /> : null}
				<color attach="background" args={["#030812"]} />
				<NebulaBackground controlsRef={controlsRef} quality={quality} />
				<ambientLight intensity={0.85} />
				<directionalLight intensity={0.5} position={[0, 0, 500]} />
				<AdaptiveGrid controlsRef={controlsRef} quality={quality} />

				<CameraFocusController
					controlsRef={controlsRef}
					focusTarget={focusTarget}
					mode={cameraMode}
					trackingOrbit={trackingOrbit}
					cameraOffset={ISOMETRIC_CAMERA_OFFSET}
				/>

				{exitingScene ? (
					<FadingSceneGroup
						key={`out-${exitingScene.id}`}
						direction="out"
						transitionKey={exitingScene.id}
						animate
						onFadeOutComplete={() => {
							setExitingScene((currentScene) =>
								currentScene?.id === exitingScene.id ? null : currentScene,
							);
						}}
					>
						{exitingScene.node}
					</FadingSceneGroup>
				) : null}

				<FadingSceneGroup
					key={`in-${String(sceneKey)}`}
					direction="in"
					transitionKey={enterTransitionId}
					animate={animateEnterScene}
				>
					{children}
				</FadingSceneGroup>

				<MapControls
					ref={(instance) => {
						controlsRef.current = instance as BasicMapControls | null;
					}}
					makeDefault
					enableRotate={false}
					minZoom={0.015}
					maxZoom={24}
					zoomSpeed={0.8}
					panSpeed={1.2}
				/>
			</Canvas>
		</div>
	);
}
