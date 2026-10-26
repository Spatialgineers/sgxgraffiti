import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { BRAND } from '../brand';
import { createSprayMaterial } from '../paint/sprayMaterial';
import { useApp } from '../state/store';
import { Backdrop } from './Backdrop';
import { PaintController } from './PaintController';
import { SprayMaterialContext } from './sprayContext';
import { StrokeView } from './StrokeView';

function Strokes() {
  const strokes = useApp((s) => s.strokes);
  return (
    <>
      {strokes.map((s) => (
        <StrokeView key={s.id} stroke={s} />
      ))}
    </>
  );
}

export function GraffitiCanvas() {
  const tool = useApp((s) => s.tool);
  const glow = useApp((s) => s.glow);
  const backdrop = useApp((s) => s.backdrop);
  const material = useMemo(() => createSprayMaterial(), []);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => () => material.dispose(), [material]);

  // In paint mode the left button / one finger paints; orbit stays on right button / two fingers.
  const mouseButtons =
    tool === 'paint'
      ? { LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  const touches =
    tool === 'paint'
      ? { ONE: undefined, TWO: THREE.TOUCH.DOLLY_ROTATE }
      : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 25], fov: 45, near: 0.1, far: 500 }}
      gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      className="!touch-none"
    >
      <PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} flipflops={3} onFallback={() => setDpr(1)} />
      <color attach="background" args={[BRAND.black]} />
      <fog attach="fog" args={[BRAND.black, 40, 140]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 12]} intensity={260} color={BRAND.amarilloMetalico} />
      <spotLight position={[-15, 15, 18]} angle={0.35} penumbra={1} intensity={900} color={BRAND.azulMetalico} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={70}
        mouseButtons={mouseButtons as never}
        touches={touches as never}
      />

      <Backdrop kind={backdrop} />

      <SprayMaterialContext.Provider value={material}>
        <Strokes />
        <PaintController />
      </SprayMaterialContext.Provider>

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.35} mipmapBlur intensity={glow} radius={0.6} />
        <Noise opacity={0.035} />
        <Vignette eskil={false} offset={0.15} darkness={1.05} />
      </EffectComposer>
    </Canvas>
  );
}
