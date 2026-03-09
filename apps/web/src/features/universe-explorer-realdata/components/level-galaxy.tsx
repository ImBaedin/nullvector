import type { ThreeEvent } from "@react-three/fiber";

import { Line } from "@react-three/drei";
import { useMemo } from "react";

import type { ExplorerResolvedQuality, RenderableEntity } from "../types";

import { EntitySphere } from "./entity-sphere";
import { getEntityVisualPreset, hashStringToUnit } from "./entity-visuals";

type LevelGalaxyProps = {
	entities: RenderableEntity[];
	hoveredId: string | null;
	quality: ExplorerResolvedQuality;
	onSelect: (entity: RenderableEntity) => void;
	onHover: (entity: RenderableEntity, screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
};

function SectorBoundingBox({
	entity,
	isHovered,
	onSelect,
	onHover,
	onHoverEnd,
}: {
	entity: RenderableEntity;
	isHovered: boolean;
	onSelect: () => void;
	onHover: (screenX: number, screenY: number) => void;
	onHoverEnd: () => void;
}) {
	const bounds = entity.bounds;
	if (!bounds) {
		return null;
	}

	const width = Math.max(1, bounds.maxX - bounds.minX);
	const height = Math.max(1, bounds.maxY - bounds.minY);
	const scale = isHovered ? 1.02 : 1;
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const preset = useMemo(
		() => getEntityVisualPreset("sector", hashStringToUnit(entity.sourceId)),
		[entity.sourceId],
	);
	const outlinePoints = useMemo(
		() =>
			[
				[-halfWidth, -halfHeight, 0.05],
				[halfWidth, -halfHeight, 0.05],
				[halfWidth, halfHeight, 0.05],
				[-halfWidth, halfHeight, 0.05],
				[-halfWidth, -halfHeight, 0.05],
			] as [number, number, number][],
		[halfHeight, halfWidth],
	);

	const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHover(event.nativeEvent.clientX, event.nativeEvent.clientY);
	};

	const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHover(event.nativeEvent.clientX, event.nativeEvent.clientY);
	};

	const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHoverEnd();
	};

	const handleClick = (event: ThreeEvent<MouseEvent>) => {
		event.stopPropagation();
		onSelect();
	};

	return (
		<group position={[entity.x, entity.y, 0]} scale={scale}>
			<mesh
				position={[0, 0, 0]}
				onClick={handleClick}
				onPointerMove={handlePointerMove}
				onPointerOut={handlePointerOut}
				onPointerOver={handlePointerOver}
			>
				<planeGeometry args={[width, height]} />
				<meshStandardMaterial
					color={preset.coreColor}
					emissive={preset.emissiveColor}
					emissiveIntensity={isHovered ? 0.18 : 0.1}
					transparent
					opacity={isHovered ? 0.22 : 0.14}
					roughness={0.45}
					metalness={0.2}
					depthWrite={false}
				/>
			</mesh>

			<Line
				points={outlinePoints}
				color={preset.haloColor}
				transparent
				opacity={isHovered ? 0.9 : 0.7}
				lineWidth={1}
				raycast={() => {}}
			/>
		</group>
	);
}

export function LevelGalaxy({
	entities,
	hoveredId,
	quality,
	onSelect,
	onHover,
	onHoverEnd,
}: LevelGalaxyProps) {
	return (
		<>
			{entities.map((entity) => {
				if (entity.entityType === "sector" && entity.bounds) {
					return (
						<SectorBoundingBox
							key={entity.id}
							entity={entity}
							isHovered={hoveredId === entity.id}
							onSelect={() => onSelect(entity)}
							onHover={(x, y) => onHover(entity, x, y)}
							onHoverEnd={onHoverEnd}
						/>
					);
				}

				return (
					<EntitySphere
						key={entity.id}
						x={entity.x}
						y={entity.y}
						radius={entity.sphereRadius}
						entityType={entity.entityType}
						seedKey={entity.sourceId}
						quality={quality}
						isSelected={false}
						isHovered={hoveredId === entity.id}
						onSelect={() => onSelect(entity)}
						onHover={(x, y) => onHover(entity, x, y)}
						onHoverMove={(x, y) => onHover(entity, x, y)}
						onHoverEnd={onHoverEnd}
					/>
				);
			})}
		</>
	);
}
