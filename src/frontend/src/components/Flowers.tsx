import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface FlowersProps {
  scrollProgress: number;
}

interface FlowerInstance {
  type: "white-petunia" | "blue-petunia" | "magenta-petunia";
  position: [number, number, number];
  scale: number;
  phase: number;
  rotationY: number;
  stemHeight: number;
  id: string;
}

function generateFlowerInstances(): FlowerInstance[] {
  const flowers: FlowerInstance[] = [];

  const configs = [
    { type: "white-petunia" as const, count: 120 },
    { type: "blue-petunia" as const, count: 100 },
    { type: "magenta-petunia" as const, count: 90 },
  ];

  let idx = 0;
  for (const { type, count } of configs) {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 58;
      const z = Math.random() * -68 + 8;
      flowers.push({
        type,
        position: [x, 0, z],
        scale: 0.5 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        rotationY: Math.random() * Math.PI * 2,
        stemHeight: 0.3 + Math.random() * 0.5,
        id: `${type}-${idx++}`,
      });
    }
  }
  return flowers;
}

/**
 * Creates a single petunia petal as a BufferGeometry.
 *
 * The petal is a broad fan shape. Looking from above, it fans out from
 * a narrow base to a wide rounded tip. The key shape property:
 * - The petal surface curves UPWARD at the edges (like a real petunia petal)
 * - This means the rim lifts upward while the center base stays at 0
 * - When petals are arranged radially this forms an open bowl facing upward
 *
 * Construction:
 * - Polar coordinate grid: radial distance r from 0 to maxR, angle a from -halfAngle to +halfAngle
 * - Y (height) = +liftCurve * (r / maxR)^1.6  =>  center is 0, outer rim lifts UP
 * - Slight extra lift at lateral edges for a natural ruffled look
 */
function createPetalGeometry(): THREE.BufferGeometry {
  const radialSegments = 12; // divisions along petal length (center to tip)
  const arcSegments = 10; // divisions across petal width
  const maxR = 0.46; // petal length from center (slightly larger)
  const halfAngle = 0.75; // half arc angle in radians (~43 deg each side = 86 deg total, fills gaps between 7 petals)
  const liftCurve = 0.32; // how much the rim lifts UPWARD above center
  const widthLift = 0.08; // extra lift at lateral edges for ruffled look

  const positions: number[] = [];
  const indices: number[] = [];

  // Build vertex grid in polar coords
  // row i = radial step (0 = center, radialSegments = tip)
  // col j = arc step (0 = left edge, arcSegments = right edge)
  const verts: THREE.Vector3[][] = [];

  for (let i = 0; i <= radialSegments; i++) {
    const t = i / radialSegments;
    const r = t * maxR;
    // Petal widens as it goes out: arc half-angle also scales with r
    const arcHalf = halfAngle * (0.25 + 0.75 * t); // narrow at base, wide at tip

    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= arcSegments; j++) {
      const u = j / arcSegments; // 0..1 across width
      const a = -arcHalf + u * arcHalf * 2; // angle from petal axis

      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r; // petal extends along +Z axis in local space

      // UPWARD lift: outer radius curves UP, center stays flat (opposite of umbrella)
      // Also lifts more at lateral edges for a natural ruffled look
      const radialLift = liftCurve * t ** 1.6;
      const lateralLift = widthLift * (Math.abs(u - 0.5) * 2) ** 2 * t;
      const y = radialLift + lateralLift; // POSITIVE = lifts up

      row.push(new THREE.Vector3(x, y, z));
    }
    verts.push(row);
  }

  // Triangulate grid
  let vertIdx = 0;
  const vertMap: number[][] = [];

  for (let i = 0; i <= radialSegments; i++) {
    const rowMap: number[] = [];
    for (let j = 0; j <= arcSegments; j++) {
      const v = verts[i][j];
      positions.push(v.x, v.y, v.z);
      rowMap.push(vertIdx++);
    }
    vertMap.push(rowMap);
  }

  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < arcSegments; j++) {
      const a = vertMap[i][j];
      const b = vertMap[i][j + 1];
      const c = vertMap[i + 1][j];
      const d = vertMap[i + 1][j + 1];
      // Two triangles per quad
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const petalGeo = createPetalGeometry();

// Vein geometry: thin tapered strip that follows the petal surface exactly.
// The petal surface Y at any z along the center axis (a=0) is:
//   y_petal(z) = liftCurve * (z / maxR)^1.6
// where liftCurve=0.32, maxR=0.46.
// We compute this precisely for the base (z=0) and tip (z=len) vertices
// and add a small epsilon so the vein sits just above the petal rather than below it.
function createVeinGeometry(): THREE.BufferGeometry {
  const liftCurve = 0.32;
  const maxR = 0.46;
  const epsilon = 0.005; // sit just on top of petal surface

  const len = 0.38;
  const w = 0.012;

  // y at base (z=0): liftCurve*(0/maxR)^1.6 = 0
  const yBase = liftCurve * (0 / maxR) ** 1.6 + epsilon;
  // y at tip (z=len): liftCurve*(len/maxR)^1.6
  const yTip = liftCurve * (len / maxR) ** 1.6 + epsilon;

  const positions = [
    // base-left,  base-right (wide)
    -w,
    yBase,
    0,
    w,
    yBase,
    0,
    // tip-left, tip-right (tapered to 30% width)
    -w * 0.3,
    yTip,
    len,
    w * 0.3,
    yTip,
    len,
  ];
  const indices = [0, 2, 1, 1, 2, 3];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const veinGeo = createVeinGeometry();

const PETAL_COUNT = 7;
const PETAL_INDICES = Array.from({ length: PETAL_COUNT }, (_, i) => i);

interface PetalColors {
  petal: THREE.Color;
  vein: THREE.Color;
  center: THREE.Color;
  emissive: THREE.Color;
}

function PetuniaHead({
  colors,
  time,
  phase,
}: {
  colors: PetalColors;
  time: number;
  phase: number;
}) {
  const shimmer = 0.12 + 0.06 * Math.sin(time * 1.2 + phase);

  // Use the petal color itself as emissive at a moderate intensity.
  // This ensures the backside (which receives no diffuse light due to inverted normals)
  // still shows the correct petal color rather than appearing dark.
  // The emissiveIntensity is set high enough to keep both sides visually consistent.
  const petalEmissiveIntensity = 0.55 + shimmer;

  return (
    <>
      {PETAL_INDICES.map((petalIdx) => {
        // Place each petal radially around Y axis
        // Each petal local geometry: base at origin, extends along +Z
        // Rotate around Y to fan the 5 petals
        const angleY = (petalIdx / PETAL_COUNT) * Math.PI * 2;

        // Tilt: negative X rotation tips the far end downward so the bowl opens upward
        const tiltX = 0.22; // petals flare outward and upward, bowl opens toward viewer from above

        return (
          <group key={`petal-${petalIdx}`} rotation={[0, angleY, 0]}>
            <group rotation={[tiltX, 0, 0]}>
              {/* Main petal surface */}
              <mesh geometry={petalGeo}>
                <meshStandardMaterial
                  color={colors.petal}
                  emissive={colors.petal}
                  emissiveIntensity={petalEmissiveIntensity}
                  roughness={0.88}
                  metalness={0.0}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Center vein */}
              <mesh geometry={veinGeo}>
                <meshStandardMaterial
                  color={colors.vein}
                  emissive={colors.vein}
                  emissiveIntensity={0.6}
                  roughness={0.9}
                  metalness={0.0}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Two side veins, angled slightly off center */}
              <group rotation={[0, 0.28, 0]}>
                <mesh geometry={veinGeo}>
                  <meshStandardMaterial
                    color={colors.vein}
                    emissive={colors.vein}
                    emissiveIntensity={0.5}
                    roughness={0.9}
                    metalness={0.0}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.6}
                  />
                </mesh>
              </group>
              <group rotation={[0, -0.28, 0]}>
                <mesh geometry={veinGeo}>
                  <meshStandardMaterial
                    color={colors.vein}
                    emissive={colors.vein}
                    emissiveIntensity={0.5}
                    roughness={0.9}
                    metalness={0.0}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.6}
                  />
                </mesh>
              </group>
            </group>
          </group>
        );
      })}

      {/* Throat tube - short cylinder at base center */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 8]} />
        <meshStandardMaterial
          color={colors.center}
          emissive={colors.center}
          emissiveIntensity={0.05}
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {/* Stamen sphere */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          color={colors.center}
          emissive={colors.center}
          emissiveIntensity={0.08}
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>
    </>
  );
}

function FlowerMesh({
  flower,
  time,
}: { flower: FlowerInstance; time: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(t * 0.8 + flower.phase) * 0.08;
      groupRef.current.rotation.x =
        Math.sin(t * 0.6 + flower.phase * 1.3) * 0.04;
    }
  });

  const petalColors = useMemo((): PetalColors => {
    switch (flower.type) {
      case "white-petunia":
        return {
          petal: new THREE.Color(0xf0e8f8),
          vein: new THREE.Color(0xcc4488),
          center: new THREE.Color(0xe0d060),
          emissive: new THREE.Color(0x1a0820),
        };
      case "blue-petunia":
        return {
          petal: new THREE.Color(0x6070c8),
          vein: new THREE.Color(0x200880),
          center: new THREE.Color(0x180430),
          emissive: new THREE.Color(0x0a0830),
        };
      case "magenta-petunia":
        return {
          petal: new THREE.Color(0xc01898),
          vein: new THREE.Color(0x600880),
          center: new THREE.Color(0x480050),
          emissive: new THREE.Color(0x400020),
        };
    }
  }, [flower.type]);

  return (
    <group
      ref={groupRef}
      position={flower.position}
      rotation={[0, flower.rotationY, 0]}
      scale={flower.scale}
    >
      {/* Stem */}
      <mesh position={[0, flower.stemHeight / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.03, flower.stemHeight, 5]} />
        <meshStandardMaterial
          color={new THREE.Color(0x1a3a0a)}
          roughness={0.8}
          emissive={new THREE.Color(0x0a1a05)}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Flower head - tilted toward camera so face is visible from viewer's angle */}
      <group position={[0, flower.stemHeight, 0]} rotation={[0.45, 0, 0]}>
        <PetuniaHead colors={petalColors} time={time} phase={flower.phase} />
      </group>
    </group>
  );
}

export function Flowers({ scrollProgress }: FlowersProps) {
  const flowers = useMemo(() => generateFlowerInstances(), []);
  const timeRef = useRef(0);

  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    timeRef.current = t;
    const cameraZ = 10 - scrollProgress * 65;
    camera.position.z = cameraZ;
    camera.position.y = 2.5 + Math.sin(scrollProgress * Math.PI * 2) * 0.8;
    camera.rotation.x = 0.18 - scrollProgress * 0.08;
  });

  return (
    <group>
      {flowers.map((flower) => (
        <FlowerMesh key={flower.id} flower={flower} time={timeRef.current} />
      ))}
    </group>
  );
}
