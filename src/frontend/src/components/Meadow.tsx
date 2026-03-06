import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface MeadowProps {
  scrollProgress: number;
}

const BLADE_COUNT = 6000;

export function Meadow({ scrollProgress }: MeadowProps) {
  const groundRef = useRef<THREE.Mesh>(null);
  const grassGroupRef = useRef<THREE.Group>(null);

  // Grass blade geometry - 3-segment blade with sharp pointed tip
  // Uses 4 quads (8 triangles) for a tapered, pointed blade
  const bladeBaseGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // 3 segments: wide base -> mid -> narrow -> sharp tip point
    // Each segment is a quad (2 triangles). Tip is a single triangle.
    // Base width 0.05, mid 0.03, upper 0.015, tip is a point at (0, height)
    const w0 = 0.055; // base half-width
    const w1 = 0.035; // 1/3 height half-width
    const w2 = 0.018; // 2/3 height half-width
    const h = 0.65; // blade height
    // Positions for each vertex (x, y, z)
    // Segment 0 (bottom quad): v0,v1,v2,v3
    // v0=(-w0,0,0), v1=(w0,0,0), v2=(-w1,h/3,0), v3=(w1,h/3,0)
    // Segment 1 (mid quad): v4,v5,v6,v7
    // v4=(-w1,h/3,0), v5=(w1,h/3,0), v6=(-w2,2h/3,0), v7=(w2,2h/3,0)
    // Segment 2 (top triangle): v8,v9,v10
    // v8=(-w2,2h/3,0), v9=(w2,2h/3,0), v10=(0,h,0)
    const verts = new Float32Array([
      // seg 0
      -w0,
      0,
      0,
      w0,
      0,
      0,
      -w1,
      h / 3,
      0,
      w0,
      0,
      0,
      w1,
      h / 3,
      0,
      -w1,
      h / 3,
      0,
      // seg 1
      -w1,
      h / 3,
      0,
      w1,
      h / 3,
      0,
      -w2,
      (2 * h) / 3,
      0,
      w1,
      h / 3,
      0,
      w2,
      (2 * h) / 3,
      0,
      -w2,
      (2 * h) / 3,
      0,
      // tip triangle
      -w2,
      (2 * h) / 3,
      0,
      w2,
      (2 * h) / 3,
      0,
      0,
      h,
      0,
    ]);
    // Height attribute for color gradient (0=base, 1=tip)
    const heights = new Float32Array([
      0, 0, 0.33, 0, 0.33, 0.33, 0.33, 0.33, 0.66, 0.33, 0.66, 0.66, 0.66, 0.66,
      1.0,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setAttribute("bladeHeight", new THREE.BufferAttribute(heights, 1));
    return geo;
  }, []);

  // Per-instance data
  const instanceData = useMemo(() => {
    const offsets = new Float32Array(BLADE_COUNT * 3);
    const phases = new Float32Array(BLADE_COUNT);
    const scales = new Float32Array(BLADE_COUNT);

    for (let i = 0; i < BLADE_COUNT; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * 80;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * 120 - 30;
      phases[i] = Math.random() * Math.PI * 2;
      scales[i] = 0.6 + Math.random() * 0.9;
    }
    return { offsets, phases, scales };
  }, []);

  // Create instanced geometry by combining blades into a single buffer
  const { combinedGeo, grassMaterial } = useMemo(() => {
    const vertsPerBlade = 15;
    const allPositions = new Float32Array(BLADE_COUNT * vertsPerBlade * 3);
    const allPhases = new Float32Array(BLADE_COUNT * vertsPerBlade);
    const allScales = new Float32Array(BLADE_COUNT * vertsPerBlade);
    const allHeights = new Float32Array(BLADE_COUNT * vertsPerBlade);

    const baseVerts = bladeBaseGeo.attributes.position.array as Float32Array;

    for (let b = 0; b < BLADE_COUNT; b++) {
      const phase = instanceData.phases[b];
      const scale = instanceData.scales[b];
      const ox = instanceData.offsets[b * 3];
      const oy = instanceData.offsets[b * 3 + 1];
      const oz = instanceData.offsets[b * 3 + 2];

      // Random rotation around Y
      const rotY = Math.random() * Math.PI * 2;
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);

      for (let v = 0; v < vertsPerBlade; v++) {
        const vi = b * vertsPerBlade * 3 + v * 3;
        const bx = baseVerts[v * 3] * scale;
        const by = baseVerts[v * 3 + 1] * scale;
        const bz = baseVerts[v * 3 + 2] * scale;

        // Apply Y rotation
        allPositions[vi] = bx * cosR - bz * sinR + ox;
        allPositions[vi + 1] = by + oy;
        allPositions[vi + 2] = bx * sinR + bz * cosR + oz;

        allPhases[b * vertsPerBlade + v] = phase;
        allScales[b * vertsPerBlade + v] = scale;
        allHeights[b * vertsPerBlade + v] = (
          bladeBaseGeo.attributes.bladeHeight as THREE.BufferAttribute
        ).array[v];
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(allPositions, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(allPhases, 1));
    geo.setAttribute("aScale", new THREE.BufferAttribute(allScales, 1));
    geo.setAttribute("aHeight", new THREE.BufferAttribute(allHeights, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aScale;
        attribute float aHeight;
        uniform float time;
        varying float vHeight;
        void main() {
          vHeight = aHeight;
          vec3 pos = position;
          float sway = aHeight * aHeight * sin(time * 1.5 + pos.x * 0.3 + aPhase) * 0.12;
          pos.x += sway;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vHeight;
        void main() {
          vec3 base = vec3(0.03, 0.10, 0.03);
          vec3 tip = vec3(0.09, 0.24, 0.07);
          vec3 col = mix(base, tip, vHeight);
          col += vHeight * vHeight * vec3(0.03, 0.07, 0.02);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    return { combinedGeo: geo, grassMaterial: mat };
  }, [bladeBaseGeo, instanceData]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (grassMaterial) {
      grassMaterial.uniforms.time.value = t;
    }

    const cameraZ = 10 - scrollProgress * 65;
    if (groundRef.current) {
      groundRef.current.position.z = cameraZ - 20;
    }
  });

  return (
    <group>
      {/* Ground plane */}
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, -10]}
      >
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial
          color={new THREE.Color(0x071407)}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Near ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[200, 100]} />
        <meshStandardMaterial
          color={new THREE.Color(0x060e06)}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Grass blades */}
      <group ref={grassGroupRef}>
        <mesh
          geometry={combinedGeo}
          material={grassMaterial}
          frustumCulled={false}
        />
      </group>
    </group>
  );
}
