import type { ThreeEvent } from "@react-three/fiber";

type EntitySphereProps = {
  x: number;
  y: number;
  radius: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (screenX: number, screenY: number) => void;
  onHoverMove: (screenX: number, screenY: number) => void;
  onHoverEnd: () => void;
};

export function EntitySphere({
  x,
  y,
  radius,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onHoverMove,
  onHoverEnd,
}: EntitySphereProps) {
  const scale = isSelected ? 1.35 : isHovered ? 1.2 : 1;
  const emissiveIntensity = isSelected ? 0.65 : isHovered ? 0.35 : 0.12;

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
    <mesh
      position={[x, y, 0]}
      scale={scale}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
    >
      <sphereGeometry args={[radius, 18, 18]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={emissiveIntensity}
        roughness={0.28}
        metalness={0.05}
      />
    </mesh>
  );
}
