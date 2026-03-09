import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group } from "three";

import type { ExplorerResolvedQuality, RenderableEntity } from "../types";

import { computeOrbitWorldPosition } from "../lib/orbits";
import { EntitySphere, EntitySphereVisual } from "./entity-sphere";

type LevelSystemProps = {
	entities: RenderableEntity[];
	hoveredId: string | null;
	quality: ExplorerResolvedQuality;
	selectedPlanetId: string | undefined;
	starCenter?: {
		x: number;
		y: number;
	};
	onSelect: (
		entity: RenderableEntity,
		position?: {
			x: number;
			y: number;
		},
	) => void;
	onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
};

function getOrbitSegments(quality: ExplorerResolvedQuality) {
	if (quality === "low") {
		return 48;
	}
	if (quality === "medium") {
		return 72;
	}
	return 96;
}

function OrbitPath({
	centerX,
	centerY,
	quality,
	radius,
}: {
	centerX: number;
	centerY: number;
	quality: ExplorerResolvedQuality;
	radius: number;
}) {
	const segmentCount = getOrbitSegments(quality);
	const positions = useMemo(() => {
		const values: number[] = [];
		for (let index = 0; index < segmentCount; index += 1) {
			const angle = (index / segmentCount) * Math.PI * 2;
			values.push(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, -1);
		}
		return values;
	}, [centerX, centerY, radius, segmentCount]);

	const geometry = useMemo(() => {
		const nextGeometry = new BufferGeometry();
		nextGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
		return nextGeometry;
	}, [positions]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	return (
		<lineLoop geometry={geometry} raycast={() => {}}>
			<lineBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} />
		</lineLoop>
	);
}

function OrbitingPlanetSphere({
	entity,
	isSelected,
	isHovered,
	quality,
	onSelect,
	onHover,
	onHoverEnd,
}: {
	entity: RenderableEntity;
	isSelected: boolean;
	isHovered: boolean;
	quality: ExplorerResolvedQuality;
	onSelect: (
		entity: RenderableEntity,
		position?: {
			x: number;
			y: number;
		},
	) => void;
	onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
}) {
	const orbit = entity.orbit;
	const groupRef = useRef<Group | null>(null);
	const currentPositionRef = useRef({
		x: entity.x,
		y: entity.y,
	});

	useFrame(({ clock }) => {
		if (!orbit || !groupRef.current) {
			return;
		}

		const nextPosition = computeOrbitWorldPosition(orbit, Date.now());
		currentPositionRef.current = nextPosition;
		groupRef.current.position.set(nextPosition.x, nextPosition.y, 0);
	});

	if (!orbit) {
		return (
			<EntitySphere
				x={entity.x}
				y={entity.y}
				radius={entity.sphereRadius}
				entityType={entity.entityType}
				seedKey={entity.visualSeed ?? entity.sourceId}
				quality={quality}
				isSelected={isSelected}
				isHovered={isHovered}
				onSelect={() => onSelect(entity)}
				onHover={(x, y) => onHover(entity, x, y)}
				onHoverMove={(x, y) => onHover(entity, x, y)}
				onHoverEnd={onHoverEnd}
			/>
		);
	}

	const scale = isSelected ? 1.35 : isHovered ? 1.2 : 1;

	return (
		<group ref={groupRef} position={[entity.x, entity.y, 0]} scale={scale}>
			<EntitySphereVisual
				radius={entity.sphereRadius}
				entityType={entity.entityType}
				seedKey={entity.visualSeed ?? entity.sourceId}
				quality={quality}
				isSelected={isSelected}
				isHovered={isHovered}
				detailLevel="compact"
				onClick={(event) => {
					event.stopPropagation();
					onSelect(entity, currentPositionRef.current);
				}}
				onPointerMove={(event) => {
					event.stopPropagation();
					onHover(entity, event.nativeEvent.clientX, event.nativeEvent.clientY);
				}}
				onPointerOut={(event) => {
					event.stopPropagation();
					onHoverEnd();
				}}
				onPointerOver={(event) => {
					event.stopPropagation();
					onHover(entity, event.nativeEvent.clientX, event.nativeEvent.clientY);
				}}
			/>
		</group>
	);
}

export function LevelSystem({
	entities,
	hoveredId,
	quality,
	selectedPlanetId,
	starCenter,
	onSelect,
	onHover,
	onHoverEnd,
}: LevelSystemProps) {
	return (
		<>
			{starCenter ? (
				<mesh position={[starCenter.x, starCenter.y, 0]} raycast={() => {}}>
					<sphereGeometry args={[10, 18, 18]} />
					<meshStandardMaterial
						color="#ffffff"
						emissive="#ffffff"
						emissiveIntensity={0.9}
						roughness={0.25}
						metalness={0.08}
					/>
				</mesh>
			) : null}
			{entities.map((entity) =>
				entity.orbit ? (
					<OrbitPath
						key={`orbit:${entity.id}`}
						centerX={entity.orbit.centerX}
						centerY={entity.orbit.centerY}
						quality={quality}
						radius={entity.orbit.orbitRadius}
					/>
				) : null,
			)}
			{entities.map((entity) => (
				<OrbitingPlanetSphere
					key={entity.id}
					entity={entity}
					isSelected={selectedPlanetId === entity.sourceId}
					isHovered={hoveredId === entity.id}
					quality={quality}
					onSelect={onSelect}
					onHover={onHover}
					onHoverEnd={onHoverEnd}
				/>
			))}
		</>
	);
}
