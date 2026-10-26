import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CAPS } from '../paint/caps';
import { buildCoreGeometry, createCoreMaterial } from '../paint/sprayMaterial';
import { getBuilt } from '../paint/strokeCache';
import type { Stroke } from '../paint/types';
import { useSprayMaterial } from './sprayContext';

export function coreRadius(stroke: Pick<Stroke, 'brush'>): number {
  const cap = CAPS[stroke.brush.cap];
  return stroke.brush.size * cap.spread * cap.coreLine;
}

export function coreOpacity(stroke: Pick<Stroke, 'brush'>): number {
  return 0.3 * stroke.brush.flow;
}

export const StrokeView = memo(function StrokeView({ stroke }: { stroke: Stroke }) {
  const material = useSprayMaterial();

  const { points, core, coreMat } = useMemo(() => {
    const built = getBuilt(stroke);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(built.positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(built.colors, 4));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(built.sizes, 1));
    geometry.computeBoundingSphere();
    return {
      points: geometry,
      core: buildCoreGeometry(built.path, coreRadius(stroke)),
      coreMat: createCoreMaterial(stroke.brush.color, coreOpacity(stroke)),
    };
  }, [stroke]);

  useEffect(
    () => () => {
      points.dispose();
      core?.dispose();
      coreMat.dispose();
    },
    [points, core, coreMat],
  );

  return (
    <group>
      {core && <mesh geometry={core} material={coreMat} renderOrder={0} />}
      <points geometry={points} material={material} renderOrder={1} />
    </group>
  );
});
