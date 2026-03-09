import { DoubleSide } from "three";

import type { EntityVisualProps } from "./types";

import { getEntityVisualPreset, hashStringToUnit } from "../entity-visuals";
import { clamp01 } from "./utils";

export function DefaultEntityVisual({
	radius,
	entityType,
	seedKey,
	quality,
	isSelected,
	isHovered,
	detailLevel,
	onClick,
	onPointerOver,
	onPointerMove,
	onPointerOut,
}: EntityVisualProps) {
	const preset = getEntityVisualPreset(entityType, hashStringToUnit(seedKey));
	const emissiveIntensity = clamp01(
		preset.baseEmissiveIntensity +
			(isHovered ? preset.hoverEmissiveBoost : 0) +
			(isSelected ? preset.selectedEmissiveBoost : 0),
	);
	const haloOpacity = clamp01(
		preset.haloOpacity +
			(isHovered ? preset.hoverHaloBoost : 0) +
			(isSelected ? preset.selectedHaloBoost : 0),
	);
	const ringOpacity = clamp01(
		preset.ringOpacity + (isHovered ? 0.08 : 0) + (isSelected ? 0.14 : 0),
	);
	const shellOpacity = clamp01(
		preset.shellOpacity + (isHovered ? 0.05 : 0) + (isSelected ? 0.1 : 0),
	);
	const segmentCount = quality === "high" ? (detailLevel === "compact" ? 18 : 22) : 14;

	return (
		<>
			<mesh
				onClick={onClick}
				onPointerMove={onPointerMove}
				onPointerOut={onPointerOut}
				onPointerOver={onPointerOver}
				renderOrder={25}
			>
				<sphereGeometry args={[radius, segmentCount, segmentCount]} />
				<meshStandardMaterial
					color={preset.coreColor}
					emissive={preset.emissiveColor}
					emissiveIntensity={emissiveIntensity}
					roughness={preset.coreRoughness}
					metalness={preset.coreMetalness}
				/>
			</mesh>

			<mesh scale={preset.haloScale} renderOrder={12} raycast={() => {}}>
				<sphereGeometry
					args={[radius, quality === "high" ? 16 : 12, quality === "high" ? 16 : 12]}
				/>
				<meshBasicMaterial
					color={preset.haloColor}
					transparent
					opacity={haloOpacity}
					depthWrite={false}
				/>
			</mesh>

			{detailLevel === "full" && preset.hasShell ? (
				<mesh scale={preset.shellScale} renderOrder={18} raycast={() => {}}>
					<sphereGeometry
						args={[radius, quality === "high" ? 14 : 10, quality === "high" ? 14 : 10]}
					/>
					<meshBasicMaterial
						color={preset.shellColor}
						transparent
						opacity={shellOpacity}
						wireframe
						depthWrite={false}
					/>
				</mesh>
			) : null}

			{detailLevel === "full" && preset.hasRing ? (
				<mesh
					rotation={[preset.ringTiltRad, 0, preset.ringRotationRad]}
					renderOrder={19}
					raycast={() => {}}
				>
					<ringGeometry
						args={[
							radius * preset.ringInnerScale,
							radius * preset.ringOuterScale,
							quality === "high" ? 48 : 24,
						]}
					/>
					<meshBasicMaterial
						color={preset.ringColor}
						transparent
						opacity={ringOpacity}
						side={DoubleSide}
						depthWrite={false}
					/>
				</mesh>
			) : null}
		</>
	);
}
