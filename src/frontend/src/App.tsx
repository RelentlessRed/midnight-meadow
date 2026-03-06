import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Fireflies } from "./components/Fireflies";
import { Flowers } from "./components/Flowers";
import { Meadow } from "./components/Meadow";
import { Particles } from "./components/Particles";
import { Sky as SkyComponent } from "./components/Sky";

function Scene({ scrollProgress }: { scrollProgress: number }) {
  return (
    <>
      {/* Lighting - soft moonlight only, no harsh center point light */}
      <ambientLight color={new THREE.Color(0x0a0a30)} intensity={0.35} />
      <directionalLight
        color={new THREE.Color(0xc0d0ff)}
        intensity={0.7}
        position={[-12, 30, -20]}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={[0x060d1a, 30, 90]} />

      <SkyComponent scrollProgress={scrollProgress} />
      <Meadow scrollProgress={scrollProgress} />
      <Flowers scrollProgress={scrollProgress} />
      <Fireflies />
      <Particles />
    </>
  );
}

export default function App() {
  const scrollRef = useRef(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    // Create tall scrollable page
    document.body.style.height = "500vh";
    document.body.style.overflowY = "scroll";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.height = "100%";

    const handleScroll = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      scrollRef.current = progress;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{
          position: [0, 2.5, 10],
          fov: 42,
          near: 0.1,
          far: 200,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
