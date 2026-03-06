import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface SkyProps {
  scrollProgress: number;
}

export function Sky({ scrollProgress }: SkyProps) {
  const starsRef = useRef<THREE.Points>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const moonGlowRef = useRef<THREE.Mesh>(null);
  const skyRef = useRef<THREE.Mesh>(null);

  // Star data: position + phase for twinkle
  const { starPositions, starPhases, starSizes } = useMemo(() => {
    const count = 400;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // upper hemisphere only
      const r = 90 + Math.random() * 10;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 40;

      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.5 + Math.random() * 2.0;
    }

    return { starPositions: positions, starPhases: phases, starSizes: sizes };
  }, []);

  // Sky gradient shader material
  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x020510) },
        horizonColor: { value: new THREE.Color(0x0d1a3a) },
        midColor: { value: new THREE.Color(0x050d20) },
        offset: { value: 0.3 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 midColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(0.0, h);
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.3, t));
          col = mix(col, topColor, smoothstep(0.3, 1.0, t));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
  }, []);

  // Star shader material
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float phase;
        attribute float size;
        uniform float time;
        varying float vAlpha;
        void main() {
          vAlpha = 0.5 + 0.5 * sin(time * 1.2 + phase);
          gl_PointSize = size * (0.7 + 0.3 * sin(time * 0.8 + phase * 2.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          float brightness = 1.0 - dist * 2.0;
          brightness = pow(brightness, 1.5);
          gl_FragColor = vec4(0.85, 0.9, 1.0, brightness * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const starGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    geo.setAttribute("phase", new THREE.BufferAttribute(starPhases, 1));
    geo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
    return geo;
  }, [starPositions, starPhases, starSizes]);

  // Moon glow material
  const moonGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float pulse = 0.95 + 0.05 * sin(time * 0.5);
          float glow = (1.0 - smoothstep(0.1, 0.5, dist)) * pulse;
          gl_FragColor = vec4(0.7, 0.8, 1.0, glow * 0.35);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (starMaterial) {
      starMaterial.uniforms.time.value = t;
    }
    if (moonGlowMaterial) {
      moonGlowMaterial.uniforms.time.value = t;
    }

    // Sky parallax - moves slightly with scroll
    if (skyRef.current) {
      skyRef.current.position.z = scrollProgress * 5;
    }
    if (starsRef.current) {
      starsRef.current.position.z = scrollProgress * 5;
    }
    if (moonRef.current) {
      moonRef.current.position.z = -70 + scrollProgress * 5;
    }
    if (moonGlowRef.current) {
      moonGlowRef.current.position.z = -70 + scrollProgress * 5;
    }
  });

  return (
    <group>
      {/* Sky dome */}
      <mesh ref={skyRef} position={[0, 0, -40]}>
        <sphereGeometry args={[100, 32, 16]} />
        <primitive object={skyMaterial} attach="material" />
      </mesh>

      {/* Stars */}
      <points ref={starsRef} geometry={starGeometry}>
        <primitive object={starMaterial} attach="material" />
      </points>

      {/* Moon */}
      <mesh ref={moonRef} position={[-25, 40, -70]}>
        <sphereGeometry args={[4, 24, 24]} />
        <meshStandardMaterial
          color={new THREE.Color(0xffffff)}
          emissive={new THREE.Color(0xddeeff)}
          emissiveIntensity={0.8}
          roughness={0.9}
        />
      </mesh>

      {/* Moon glow halo */}
      <mesh ref={moonGlowRef} position={[-25, 40, -69.5]}>
        <planeGeometry args={[22, 22]} />
        <primitive object={moonGlowMaterial} attach="material" />
      </mesh>

      {/* Distant hill silhouettes */}
      <HillSilhouettes scrollProgress={scrollProgress} />
    </group>
  );
}

function HillSilhouettes({ scrollProgress }: { scrollProgress: number }) {
  const hillRef = useRef<THREE.Group>(null);

  // Generate jagged hill shapes
  const hillGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-80, 0);

    // Left side hills
    shape.lineTo(-70, 8);
    shape.lineTo(-62, 4);
    shape.lineTo(-55, 12);
    shape.lineTo(-48, 6);
    shape.lineTo(-42, 15);
    shape.lineTo(-35, 9);
    shape.lineTo(-28, 18);
    shape.lineTo(-20, 11);
    shape.lineTo(-14, 20);
    shape.lineTo(-6, 14);
    shape.lineTo(0, 22);
    shape.lineTo(6, 16);
    shape.lineTo(14, 24);
    shape.lineTo(22, 13);
    shape.lineTo(30, 19);
    shape.lineTo(38, 10);
    shape.lineTo(46, 17);
    shape.lineTo(54, 8);
    shape.lineTo(62, 13);
    shape.lineTo(70, 5);
    shape.lineTo(80, 9);
    shape.lineTo(80, -5);
    shape.lineTo(-80, -5);
    shape.closePath();

    return new THREE.ShapeGeometry(shape);
  }, []);

  useFrame(() => {
    if (hillRef.current) {
      hillRef.current.position.z = -65 + scrollProgress * 6;
    }
  });

  return (
    <group ref={hillRef} position={[0, -1, -65]}>
      <mesh geometry={hillGeometry}>
        <meshBasicMaterial
          color={new THREE.Color(0x020810)}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* Second layer of hills, slightly closer */}
      <mesh geometry={hillGeometry} position={[5, -3, 5]} scale={[0.9, 0.7, 1]}>
        <meshBasicMaterial
          color={new THREE.Color(0x030c14)}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
