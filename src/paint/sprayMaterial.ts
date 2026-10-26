import * as THREE from 'three';

function createDotTexture(): THREE.Texture {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

/**
 * One material shared by every stroke: color, alpha and size live in vertex
 * attributes, so particles can vary individually and strokes need no per-stroke material.
 */
export function createSprayMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: createDotTexture() },
      uScale: { value: 500 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec4 aColor;
      uniform float uScale;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(aSize * uScale / -mv.z, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec4 vColor;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vColor.a;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor.rgb, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createCoreMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false });
}

/** Solid core line along the stroke path, or null when the cap has none / too few points. */
export function buildCoreGeometry(path: number[], radius: number): THREE.TubeGeometry | null {
  if (radius <= 0 || path.length < 6) return null;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < path.length; i += 3) pts.push(new THREE.Vector3(path[i], path[i + 1], path[i + 2]));
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, Math.min(pts.length * 4, 600), radius, 6, false);
}
