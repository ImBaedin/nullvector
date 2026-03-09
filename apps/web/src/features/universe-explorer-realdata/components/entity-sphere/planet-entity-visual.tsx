import type { BufferGeometry, Group, Mesh } from "three";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, Color, Float32BufferAttribute } from "three";
import { MeshStandardMaterial } from "three";

import type { EntityVisualHandlers, EntityVisualProps } from "./types";

import { getWeightedPlanetColor, hashStringToUnit } from "../entity-visuals";

const PLANET_MODEL_PATH = "/models/planet/planet.glb";
useGLTF.preload(PLANET_MODEL_PATH);

type PlanetModelVisualProps = EntityVisualHandlers & {
	radius: number;
	color: string;
	seedKey: string;
};

function PlanetModelVisual({
	radius,
	color,
	seedKey,
	onClick,
	onPointerMove,
	onPointerOut,
	onPointerOver,
}: PlanetModelVisualProps) {
	const gltf = useGLTF(PLANET_MODEL_PATH);
	const spinRef = useRef<Group | null>(null);
	const baseColor = useMemo(() => new Color(color), [color]);
	const spinRateRadPerSec = useMemo(
		() => 0.045 + hashStringToUnit(`${seedKey}:spin`) * 0.035,
		[seedKey],
	);
	const initialSpinAngle = useMemo(
		() => hashStringToUnit(`${seedKey}:spinPhase`) * Math.PI * 2,
		[seedKey],
	);
	const tiltX = useMemo(() => (hashStringToUnit(`${seedKey}:tiltX`) - 0.5) * 0.28, [seedKey]);
	const tiltY = useMemo(() => (hashStringToUnit(`${seedKey}:tiltY`) - 0.5) * 0.22, [seedKey]);
	const patternConfig = useMemo(
		() => ({
			bandFreq: 2.4 + hashStringToUnit(`${seedKey}:bandFreq`) * 2.6,
			bandWarp: 1.4 + hashStringToUnit(`${seedKey}:bandWarp`) * 1.2,
			bandPhase: hashStringToUnit(`${seedKey}:bandPhase`) * Math.PI * 2,
			swirlFreq: 2.2 + hashStringToUnit(`${seedKey}:swirlFreq`) * 2.4,
			swirlPhase: hashStringToUnit(`${seedKey}:swirlPhase`) * Math.PI * 2,
			patchFreq: 3.2 + hashStringToUnit(`${seedKey}:patchFreq`) * 3.1,
			patchPhase: hashStringToUnit(`${seedKey}:patchPhase`) * Math.PI * 2,
			accentAThreshold: 0.28 + hashStringToUnit(`${seedKey}:ath`) * 0.23,
			accentBThreshold: 0.22 + hashStringToUnit(`${seedKey}:bth`) * 0.2,
		}),
		[seedKey],
	);
	const colorSet = useMemo(() => {
		const accentA = baseColor
			.clone()
			.offsetHSL(
				(hashStringToUnit(`${seedKey}:accentA:h`) - 0.5) * 0.1,
				(hashStringToUnit(`${seedKey}:accentA:s`) - 0.5) * 0.14 + 0.03,
				(hashStringToUnit(`${seedKey}:accentA:l`) - 0.5) * 0.18 + 0.06,
			);
		const accentB = baseColor
			.clone()
			.offsetHSL(
				(hashStringToUnit(`${seedKey}:accentB:h`) - 0.5) * 0.12,
				(hashStringToUnit(`${seedKey}:accentB:s`) - 0.5) * 0.14 - 0.03,
				(hashStringToUnit(`${seedKey}:accentB:l`) - 0.5) * 0.18 - 0.06,
			);

		return {
			base: baseColor.clone(),
			accentA,
			accentB,
		};
	}, [baseColor, seedKey]);
	const atmosphereUniforms = useMemo(
		() => ({
			uColor: {
				value: baseColor.clone().offsetHSL(0.01, -0.08, 0.16),
			},
			uOpacity: { value: 0.34 },
			uPower: { value: 2.2 },
			uMinAlpha: { value: 0.03 },
		}),
		[baseColor],
	);

	const material = useMemo(
		() =>
			new MeshStandardMaterial({
				color: "#ffffff",
				flatShading: true,
				vertexColors: true,
				roughness: 0.9,
				metalness: 0.02,
			}),
		[],
	);

	const centeredScene = useMemo(() => {
		const clone = gltf.scene.clone(true);
		const centeredGeometries: BufferGeometry[] = [];
		let normalizedRadius = Number.EPSILON;

		clone.traverse((object) => {
			const mesh = object as Mesh;
			if (!mesh.isMesh) {
				return;
			}
			const centeredGeometry = mesh.geometry.clone().toNonIndexed();
			centeredGeometry.computeBoundingSphere();
			if (centeredGeometry.boundingSphere) {
				normalizedRadius = Math.max(normalizedRadius, centeredGeometry.boundingSphere.radius);
			}
			centeredGeometry.center();
			centeredGeometry.computeVertexNormals();

			const positionAttr = centeredGeometry.getAttribute("position");
			const colors = new Float32Array(positionAttr.count * 3);

			for (let faceVertexIndex = 0; faceVertexIndex < positionAttr.count; faceVertexIndex += 3) {
				const x0 = positionAttr.getX(faceVertexIndex);
				const y0 = positionAttr.getY(faceVertexIndex);
				const z0 = positionAttr.getZ(faceVertexIndex);
				const x1 = positionAttr.getX(faceVertexIndex + 1);
				const y1 = positionAttr.getY(faceVertexIndex + 1);
				const z1 = positionAttr.getZ(faceVertexIndex + 1);
				const x2 = positionAttr.getX(faceVertexIndex + 2);
				const y2 = positionAttr.getY(faceVertexIndex + 2);
				const z2 = positionAttr.getZ(faceVertexIndex + 2);

				const cx = (x0 + x1 + x2) / 3;
				const cy = (y0 + y1 + y2) / 3;
				const cz = (z0 + z1 + z2) / 3;
				const radiusLength = Math.max(Math.sqrt(cx * cx + cy * cy + cz * cz), Number.EPSILON);
				const lat = cy / radiusLength;
				const lon = Math.atan2(cz, cx);

				const bandSignal =
					Math.sin(
						lon * patternConfig.bandFreq + lat * patternConfig.bandWarp + patternConfig.bandPhase,
					) +
					Math.sin(lat * (patternConfig.bandFreq * 1.75) + patternConfig.bandPhase * 0.7) * 0.28;
				const swirlSignal =
					Math.sin(
						(cx * 0.16 + cz * 0.2) * patternConfig.swirlFreq + cy * 0.32 + patternConfig.swirlPhase,
					) * 0.55;
				const patchSignal = Math.sin(
					(cx * 0.36 + cy * 0.29 + cz * 0.33) * patternConfig.patchFreq + patternConfig.patchPhase,
				);
				const accentAField = bandSignal + swirlSignal;
				const accentBField = patchSignal + bandSignal * 0.2;

				let faceColor = colorSet.base;
				if (accentAField > patternConfig.accentAThreshold) {
					faceColor = colorSet.accentA;
				} else if (accentBField > patternConfig.accentBThreshold) {
					faceColor = colorSet.accentB;
				}

				const microShift = (hashStringToUnit(`${seedKey}:${faceVertexIndex}:micro`) - 0.5) * 0.05;
				const finalFaceColor = faceColor.clone().offsetHSL(0, 0, microShift);

				for (let localVertex = 0; localVertex < 3; localVertex += 1) {
					const vertexIndex = faceVertexIndex + localVertex;
					const colorIndex = vertexIndex * 3;
					colors[colorIndex] = finalFaceColor.r;
					colors[colorIndex + 1] = finalFaceColor.g;
					colors[colorIndex + 2] = finalFaceColor.b;
				}
			}

			centeredGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
			mesh.geometry = centeredGeometry;
			mesh.material = material;
			centeredGeometries.push(centeredGeometry);
		});

		return {
			scene: clone,
			radius: normalizedRadius,
			dispose: () => {
				for (const geometry of centeredGeometries) {
					geometry.dispose();
				}
			},
		};
	}, [colorSet, gltf.scene, material, patternConfig, seedKey]);

	useEffect(() => {
		return () => {
			centeredScene.dispose();
			material.dispose();
		};
	}, [centeredScene, material]);

	useFrame((_, delta) => {
		if (!spinRef.current) {
			return;
		}
		spinRef.current.rotation.z += delta * spinRateRadPerSec;
	});

	return (
		<group
			onClick={onClick}
			onPointerMove={onPointerMove}
			onPointerOut={onPointerOut}
			onPointerOver={onPointerOver}
			renderOrder={25}
			scale={radius / centeredScene.radius}
			rotation={[tiltX, tiltY, 0]}
		>
			<mesh raycast={() => {}} renderOrder={22}>
				<sphereGeometry args={[centeredScene.radius * 1.08, 18, 18]} />
				<shaderMaterial
					transparent
					uniforms={atmosphereUniforms}
					side={BackSide}
					depthTest
					depthWrite={false}
					blending={AdditiveBlending}
					vertexShader={`
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;

            void main() {
              vec4 worldPos = modelMatrix * vec4(position, 1.0);
              vWorldPos = worldPos.xyz;
              vWorldNormal = normalize(mat3(modelMatrix) * normal);
              gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
          `}
					fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uPower;
            uniform float uMinAlpha;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;

            void main() {
              vec3 viewDir = normalize(cameraPosition - vWorldPos);
              float fresnel = pow(
                1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0),
                uPower
              );
              float alpha = (uMinAlpha + fresnel * (1.0 - uMinAlpha)) * uOpacity;
              if (alpha < 0.01) {
                discard;
              }
              gl_FragColor = vec4(uColor, alpha);
            }
          `}
				/>
			</mesh>
			<group ref={spinRef} rotation={[0, 0, initialSpinAngle]}>
				<primitive object={centeredScene.scene} />
			</group>
		</group>
	);
}

export function PlanetEntityVisual({
	radius,
	seedKey,
	quality,
	detailLevel,
	...handlers
}: EntityVisualProps) {
	const planetColor = getWeightedPlanetColor(seedKey);
	const segmentCount = quality === "high" ? (detailLevel === "compact" ? 18 : 22) : 14;

	return (
		<Suspense
			fallback={
				<mesh
					onClick={handlers.onClick}
					onPointerMove={handlers.onPointerMove}
					onPointerOut={handlers.onPointerOut}
					onPointerOver={handlers.onPointerOver}
					renderOrder={25}
				>
					<sphereGeometry args={[radius, segmentCount, segmentCount]} />
					<meshStandardMaterial color={planetColor} roughness={0.82} metalness={0.06} flatShading />
				</mesh>
			}
		>
			<PlanetModelVisual radius={radius} color={planetColor} seedKey={seedKey} {...handlers} />
		</Suspense>
	);
}
