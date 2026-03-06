import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const FIREFLY_COUNT = 80;

interface FireflyDatum {
  // Current world position
  x: number;
  y: number;
  z: number;
  // Roaming target
  targetX: number;
  targetY: number;
  targetZ: number;
  // Movement speed
  speed: number;
  // Glow phase
  phaseOpacity: number;
  opacitySpeed: number;
  // Time until next target pick
  timeToNewTarget: number;
}

export function Fireflies() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const fireflyData = useMemo<FireflyDatum[]>(() => {
    const data: FireflyDatum[] = [];
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const x = (Math.random() - 0.5) * 55;
      const y = 0.4 + Math.random() * 3.5;
      const z = (Math.random() - 0.5) * 30 - 15;
      data.push({
        x,
        y,
        z,
        targetX: x + (Math.random() - 0.5) * 8,
        targetY: 0.3 + Math.random() * 4.0,
        targetZ: z + (Math.random() - 0.5) * 8,
        speed: 0.008 + Math.random() * 0.014,
        phaseOpacity: Math.random() * Math.PI * 2,
        opacitySpeed: 0.6 + Math.random() * 1.4,
        timeToNewTarget: Math.random() * 4,
      });
    }
    return data;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fireflyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: `
        attribute float instanceOpacity;
        varying float vOpacity;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vOpacity = instanceOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center) * 2.0;
          float glow = exp(-dist * dist * 2.5);
          float core = exp(-dist * dist * 18.0);
          // Warm yellow-green firefly color
          vec3 color = mix(vec3(0.3, 0.85, 0.05), vec3(0.95, 1.0, 0.6), core);
          gl_FragColor = vec4(color, (glow * 0.55 + core * 0.45) * vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);

  const opacityAttr = useMemo(() => {
    return new THREE.InstancedBufferAttribute(
      new Float32Array(FIREFLY_COUNT),
      1,
    );
  }, []);

  const planeGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    geo.setAttribute("instanceOpacity", opacityAttr);
    return geo;
  }, [opacityAttr]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    if (fireflyMaterial) {
      fireflyMaterial.uniforms.time.value = t;
    }

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const d = fireflyData[i];

      // Count down to next target selection
      d.timeToNewTarget -= 0.016;
      if (d.timeToNewTarget <= 0) {
        // Pick a new nearby target with organic drift
        d.targetX = d.x + (Math.random() - 0.5) * 10;
        d.targetY = 0.3 + Math.random() * 4.2;
        d.targetZ = d.z + (Math.random() - 0.5) * 10;
        // Clamp within scene bounds
        d.targetX = Math.max(-27, Math.min(27, d.targetX));
        d.targetZ = Math.max(-55, Math.min(5, d.targetZ));
        d.timeToNewTarget = 2 + Math.random() * 5;
      }

      // Lerp toward target (organic, slightly wobbly)
      const wobbleX = Math.sin(t * 1.3 + i * 0.7) * 0.018;
      const wobbleY = Math.cos(t * 0.9 + i * 1.1) * 0.012;
      const wobbleZ = Math.sin(t * 1.1 + i * 0.5) * 0.015;

      d.x += (d.targetX - d.x) * d.speed + wobbleX;
      d.y += (d.targetY - d.y) * d.speed + wobbleY;
      d.z += (d.targetZ - d.z) * d.speed + wobbleZ;

      dummy.position.set(d.x, d.y, d.z);
      dummy.lookAt(camera.position);
      dummy.updateMatrix();

      if (meshRef.current) {
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }

      // Pulse opacity - varies between dim and bright for blinking effect
      const sinVal = 0.5 + 0.5 * Math.sin(t * d.opacitySpeed + d.phaseOpacity);
      const baseOpacity = 0.3 + 0.7 * sinVal ** 2.0;
      opacityAttr.setX(i, baseOpacity);
    }

    opacityAttr.needsUpdate = true;
    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[planeGeo, fireflyMaterial, FIREFLY_COUNT]}
      frustumCulled={false}
    />
  );
}
