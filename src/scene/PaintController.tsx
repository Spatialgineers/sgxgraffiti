import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { cursor } from '../input/cursor';
import { CAPS } from '../paint/caps';
import { randomSeed } from '../paint/rng';
import { SprayBuilder } from '../paint/sprayBuilder';
import { buildCoreGeometry, createCoreMaterial } from '../paint/sprayMaterial';
import { rememberBuilt } from '../paint/strokeCache';
import type { Stroke } from '../paint/types';
import { useApp } from '../state/store';
import { useSprayMaterial } from './sprayContext';
import { coreOpacity, coreRadius } from './StrokeView';

/** How far in front of / behind the focus plane the hand can reach, relative to camera distance. */
const DEPTH_REACH = 0.35;
const CORE_REBUILD_EVERY = 4;

interface Live {
  builder: SprayBuilder;
  stroke: Stroke;
  start: number;
  geometry: THREE.BufferGeometry;
  capacityVersion: number;
  uploaded: number;
  frames: number;
  corePathLength: number;
}

let idCounter = 0;
function newId(): string {
  return `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function bindGeometry(builder: SprayBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(builder.positions, 3).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(builder.colors, 4).setUsage(THREE.DynamicDrawUsage);
  const size = new THREE.BufferAttribute(builder.sizes, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', pos);
  g.setAttribute('aColor', col);
  g.setAttribute('aSize', size);
  g.setDrawRange(0, 0);
  return g;
}

/**
 * Turns cursor input into paint: projects the cursor onto a plane facing the
 * camera, feeds samples to an incremental SprayBuilder, streams only the new
 * particles to the GPU, and commits the stroke on release.
 */
export function PaintController() {
  const material = useSprayMaterial();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const gl = useThree((s) => s.gl);

  const pointsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const reticleRef = useRef<THREE.Group>(null);
  const live = useRef<Live | null>(null);

  const tmp = useMemo(
    () => ({
      ndc: new THREE.Vector2(),
      forward: new THREE.Vector3(),
      planePoint: new THREE.Vector3(),
      plane: new THREE.Plane(),
      hit: new THREE.Vector3(),
      raycaster: new THREE.Raycaster(),
      origin: new THREE.Vector3(),
    }),
    [],
  );
  const coreMat = useMemo(() => createCoreMaterial('#ffffff', 0.3), []);
  const reticleMat = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthTest: false, side: THREE.DoubleSide }),
    [],
  );

  useEffect(() => () => {
    coreMat.dispose();
    reticleMat.dispose();
    live.current?.geometry.dispose();
  }, [coreMat, reticleMat]);

  const commit = () => {
    const l = live.current;
    if (!l) return;
    live.current = null;
    if (pointsRef.current) pointsRef.current.visible = false;
    if (coreRef.current) {
      coreRef.current.geometry.dispose();
      coreRef.current.geometry = new THREE.BufferGeometry();
    }
    l.geometry.dispose();
    if (l.stroke.samples.length === 0) return;
    rememberBuilt(l.stroke.id, l.builder.finalize());
    useApp.getState().addStroke(l.stroke);
  };

  // Lifting the nozzle when the component goes away still keeps the stroke.
  useEffect(() => commit, []);

  useFrame(({ clock }) => {
    material.uniforms.uScale.value = gl.domElement.height / 2;

    const target = controls?.target ?? tmp.origin;
    camera.getWorldDirection(tmp.forward);
    const reach = camera.position.distanceTo(target) * DEPTH_REACH;
    tmp.planePoint.copy(target).addScaledVector(tmp.forward, -cursor.depth * reach);
    tmp.plane.setFromNormalAndCoplanarPoint(tmp.forward, tmp.planePoint);
    tmp.ndc.set(cursor.x, cursor.y);
    tmp.raycaster.setFromCamera(tmp.ndc, camera);
    const hasHit = cursor.visible && tmp.raycaster.ray.intersectPlane(tmp.plane, tmp.hit) !== null;

    const { brush } = useApp.getState();
    const reticle = reticleRef.current;
    if (reticle) {
      reticle.visible = hasHit;
      if (hasHit) {
        reticle.position.copy(tmp.hit);
        reticle.quaternion.copy(camera.quaternion);
        const r = brush.size * CAPS[brush.cap].spread * Math.max(brush.scatter, 0.6);
        const pulse = cursor.spraying ? 1 + Math.sin(clock.elapsedTime * 18) * 0.04 : 1;
        reticle.scale.setScalar(r * pulse);
        reticleMat.color.set(brush.color);
        reticleMat.opacity = cursor.spraying ? 0.95 : 0.55;
      }
    }

    const wantSpray = hasHit && cursor.spraying;
    if (!wantSpray) {
      if (live.current) commit();
      return;
    }

    if (!live.current) {
      const seed = randomSeed();
      const normal: [number, number, number] = [-tmp.forward.x, -tmp.forward.y, -tmp.forward.z];
      const builder = new SprayBuilder({ ...brush }, seed, normal);
      const stroke: Stroke = { id: newId(), seed, brush: { ...brush }, normal, samples: [] };
      live.current = {
        builder,
        stroke,
        start: performance.now(),
        geometry: bindGeometry(builder),
        capacityVersion: builder.capacityVersion,
        uploaded: 0,
        frames: 0,
        corePathLength: 0,
      };
      if (pointsRef.current) {
        pointsRef.current.geometry = live.current.geometry;
        pointsRef.current.visible = true;
      }
      coreMat.color.set(brush.color);
      coreMat.opacity = coreOpacity(stroke);
    }

    const l = live.current;
    const t = Math.round(performance.now() - l.start);
    const x = round(tmp.hit.x, 3);
    const y = round(tmp.hit.y, 3);
    const z = round(tmp.hit.z, 3);
    l.stroke.samples.push(x, y, z, t);
    l.builder.addSample(x, y, z, t);
    l.frames++;

    // Upload only what changed since last frame.
    if (l.builder.capacityVersion !== l.capacityVersion) {
      l.geometry.dispose();
      l.geometry = bindGeometry(l.builder);
      l.capacityVersion = l.builder.capacityVersion;
      l.uploaded = 0;
      if (pointsRef.current) pointsRef.current.geometry = l.geometry;
    }
    const count = l.builder.count;
    if (count > l.uploaded) {
      const from = l.uploaded;
      const n = count - from;
      const pos = l.geometry.getAttribute('position') as THREE.BufferAttribute;
      const col = l.geometry.getAttribute('aColor') as THREE.BufferAttribute;
      const size = l.geometry.getAttribute('aSize') as THREE.BufferAttribute;
      pos.clearUpdateRanges();
      col.clearUpdateRanges();
      size.clearUpdateRanges();
      pos.addUpdateRange(from * 3, n * 3);
      col.addUpdateRange(from * 4, n * 4);
      size.addUpdateRange(from, n);
      pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
      l.geometry.setDrawRange(0, count);
      l.uploaded = count;
    }

    const path = l.builder.path;
    if (coreRef.current && path.length !== l.corePathLength && l.frames % CORE_REBUILD_EVERY === 0) {
      const next = buildCoreGeometry(path, coreRadius(l.stroke));
      coreRef.current.geometry.dispose();
      coreRef.current.geometry = next ?? new THREE.BufferGeometry();
      l.corePathLength = path.length;
    }
  });

  return (
    <group>
      <mesh ref={coreRef} material={coreMat} frustumCulled={false} renderOrder={2} />
      <points ref={pointsRef} material={material} frustumCulled={false} visible={false} renderOrder={3} />
      <group ref={reticleRef} visible={false} renderOrder={10}>
        <mesh material={reticleMat}>
          <ringGeometry args={[0.92, 1, 48]} />
        </mesh>
        <mesh material={reticleMat}>
          <circleGeometry args={[0.08, 16]} />
        </mesh>
      </group>
    </group>
  );
}
