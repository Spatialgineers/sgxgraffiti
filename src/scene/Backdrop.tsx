import { Grid } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BRAND } from '../brand';
import type { Backdrop as BackdropId } from '../state/store';

function createConcreteTexture(): THREE.CanvasTexture {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b1b1d';
  ctx.fillRect(0, 0, s, s);
  // Brick courses with mortar, then grime and speckle on top.
  const bw = 128;
  const bh = 48;
  for (let row = 0; row * bh < s; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < s + bw; x += bw) {
      const shade = 26 + Math.random() * 14;
      ctx.fillStyle = `rgb(${shade + 4},${shade},${shade - 2})`;
      ctx.fillRect(x + off + 3, row * bh + 3, bw - 6, bh - 6);
    }
  }
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function Backdrop({ kind }: { kind: BackdropId }) {
  const wallTexture = useMemo(() => (kind === 'wall' ? createConcreteTexture() : null), [kind]);
  useEffect(() => () => wallTexture?.dispose(), [wallTexture]);

  if (kind === 'wall' && wallTexture) {
    return (
      <group>
        <mesh position={[0, 0, -3]} receiveShadow>
          <planeGeometry args={[64, 38]} />
          <meshStandardMaterial map={wallTexture} roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0, -19, 8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[64, 22]} />
          <meshStandardMaterial color="#0d0d0e" roughness={1} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0, -12]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#070708" roughness={0.9} metalness={0.1} />
      </mesh>
      <Grid
        infiniteGrid
        fadeDistance={80}
        fadeStrength={8}
        cellSize={1}
        sectionSize={5}
        sectionColor={BRAND.azulMetalico}
        cellColor="#18181b"
        position={[0, -10, 0]}
      />
    </group>
  );
}
