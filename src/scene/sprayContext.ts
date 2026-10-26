import { createContext, useContext } from 'react';
import type * as THREE from 'three';

export const SprayMaterialContext = createContext<THREE.ShaderMaterial | null>(null);

export function useSprayMaterial(): THREE.ShaderMaterial {
  const m = useContext(SprayMaterialContext);
  if (!m) throw new Error('SprayMaterialContext missing');
  return m;
}
