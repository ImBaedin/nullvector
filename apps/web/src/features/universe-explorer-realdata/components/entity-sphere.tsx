import type { ThreeEvent } from "@react-three/fiber";

import type { EntitySphereProps } from "./entity-sphere/types";

import { EntitySphereVisual } from "./entity-sphere/entity-sphere-visual";

export { EntitySphereVisual } from "./entity-sphere/entity-sphere-visual";

export function EntitySphere({
	x,
	y,
	radius,
	entityType,
	seedKey,
	quality = "high",
	isSelected,
	isHovered,
	detailLevel = "full",
	onSelect,
	onHover,
	onHoverMove,
	onHoverEnd,
}: EntitySphereProps) {
	const scale = isSelected ? 1.35 : isHovered ? 1.2 : 1;

	const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHover(event.nativeEvent.clientX, event.nativeEvent.clientY);
	};

	const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHoverMove(event.nativeEvent.clientX, event.nativeEvent.clientY);
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
		<group position={[x, y, 0]} scale={scale}>
			<EntitySphereVisual
				radius={radius}
				entityType={entityType}
				seedKey={seedKey}
				quality={quality}
				isSelected={isSelected}
				isHovered={isHovered}
				detailLevel={detailLevel}
				onClick={handleClick}
				onPointerMove={handlePointerMove}
				onPointerOut={handlePointerOut}
				onPointerOver={handlePointerOver}
			/>
		</group>
	);
}
