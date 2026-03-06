import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 220;

export function Particles() {
  const pointsRef = useRef<THREE.Points>(null);

  const particleData = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);
    const opacities = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;

      velocities[i * 3] = (Math.random() - 0.5) * 0.008;
      velocities[i * 3 + 1] = 0.003 + Math.random() * 0.006;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;

      phases[i] = Math.random() * Math.PI * 2;
      opacities[i] = 0.1 + Math.random() * 0.25;
      sizes[i] = 0.8 + Math.random() * 1.6;
    }

    return { positions, velocities, phases, opacities, sizes };
  }, []);

  const geo = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particleData.positions.slice(), 3),
    );
    geometry.setAttribute(
      "aOpacity",
      new THREE.BufferAttribute(particleData.opacities.slice(), 1),
    );
    geometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(particleData.sizes.slice(), 1),
    );
    return geometry;
  }, [particleData]);

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float aOpacity;
        attribute float aSize;
        uniform float time;
        varying float vOpacity;
        void main() {
          vOpacity = aOpacity * (0.6 + 0.4 * sin(time * 0.5 + position.x));
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          float alpha = (1.0 - dist * 2.0) * vOpacity;
          gl_FragColor = vec4(0.75, 0.85, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mat) {
      mat.uniforms.time.value = t;
    }

    if (!pointsRef.current) return;
    const positions = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let y = positions.getY(i);
      const x =
        positions.getX(i) +
        particleData.velocities[i * 3] +
        Math.sin(t * 0.3 + particleData.phases[i]) * 0.002;
      y += particleData.velocities[i * 3 + 1];
      const z = positions.getZ(i) + particleData.velocities[i * 3 + 2];

      // Reset when too high
      if (y > 8) {
        y = 0;
        positions.setXYZ(
          i,
          (Math.random() - 0.5) * 60,
          0,
          (Math.random() - 0.5) * 80 - 20,
        );
      } else {
        positions.setXYZ(i, x, y, z);
      }
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </points>
  );
}
