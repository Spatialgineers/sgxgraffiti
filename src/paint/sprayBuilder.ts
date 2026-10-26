import { CAPS, type CapProfile } from './caps';
import { createRng } from './rng';
import { SAMPLE_STRIDE, type BrushSettings, type Stroke } from './types';

/** Particles emitted per second at full flow with inkFlow on. */
const SPRAY_RATE = 9000;
/** Particles per brush radius travelled (inkFlow off, or the minimum when moving fast). */
const LINEAR_DENSITY = 70;
const MIN_LINEAR_DENSITY = 14;
/** Upper bound per sample so a stall or a big jump can never freeze the frame. */
const MAX_PER_SAMPLE = 1600;
/** Paint accumulated (seconds of dwell at full flow) before a drip runs. */
const DRIP_THRESHOLD = 0.45;
/** Ink from frames without movement is held this long before landing in place, so a
 * render loop faster than the input (60fps vs a 30fps camera) doesn't bead the line. */
const HOLD_STILL_S = 0.12;
const MAX_DT = 0.05;

export interface BuiltSpray {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count: number;
  /** Down-sampled path for the solid core line. */
  path: number[];
}

function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [toLinear((n >> 16) & 255), toLinear((n >> 8) & 255), toLinear(n & 255)];
}

/**
 * Turns a stream of samples into spray particles, incrementally: each new
 * sample only appends the particles for its own segment. The same builder is
 * used live while drawing and to replay saved strokes, so a stroke looks
 * identical before and after you release it.
 */
export class SprayBuilder {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  count = 0;
  /** Bumped whenever the backing arrays are reallocated. */
  capacityVersion = 0;
  path: number[] = [];

  private readonly rng: () => number;
  private readonly cap: CapProfile;
  private readonly rgb: [number, number, number];
  private readonly radius: number;
  // Painting-plane basis: u, v span the wall, n points out of it.
  private readonly u: [number, number, number];
  private readonly v: [number, number, number];
  private readonly n: [number, number, number];
  private readonly drip: [number, number, number] | null;
  private last: [number, number, number, number] | null = null;
  private wetness = 0;
  private heldDt = 0;

  constructor(
    readonly brush: BrushSettings,
    seed: number,
    normal: [number, number, number],
    initialCapacity = 8192,
  ) {
    this.rng = createRng(seed);
    this.cap = CAPS[brush.cap];
    this.rgb = hexToLinearRgb(brush.color);
    this.radius = brush.size * this.cap.spread;
    this.positions = new Float32Array(initialCapacity * 3);
    this.colors = new Float32Array(initialCapacity * 4);
    this.sizes = new Float32Array(initialCapacity);

    const n = normalize(normal);
    // Pick any helper axis not parallel to n, then build an orthonormal basis.
    const helper: [number, number, number] = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = normalize(cross(helper, n));
    const v = cross(n, u);
    this.n = n;
    this.u = u;
    this.v = v;

    // Drips run along gravity projected onto the wall; none on a floor/ceiling.
    const g: [number, number, number] = [0, -1, 0];
    const gn = dot(g, n);
    const proj: [number, number, number] = [g[0] - n[0] * gn, g[1] - n[1] * gn, g[2] - n[2] * gn];
    this.drip = length(proj) > 0.3 ? normalize(proj) : null;
  }

  static fromStroke(stroke: Stroke): SprayBuilder {
    const samples = stroke.samples;
    const builder = new SprayBuilder(
      stroke.brush,
      stroke.seed,
      stroke.normal,
      Math.max(1024, (samples.length / SAMPLE_STRIDE) * 160),
    );
    for (let i = 0; i < samples.length; i += SAMPLE_STRIDE) {
      builder.addSample(samples[i], samples[i + 1], samples[i + 2], samples[i + 3]);
    }
    return builder;
  }

  addSample(x: number, y: number, z: number, tMs: number): void {
    const prev = this.last;
    this.last = [x, y, z, tMs];
    if (!prev) {
      this.path.push(x, y, z);
      // A short initial burst so a tap leaves a visible dot.
      this.emit(this.last, this.last, Math.round(SPRAY_RATE * 0.02 * this.flowFactor()));
      return;
    }

    const dt = Math.min(MAX_DT, Math.max(0, (tMs - prev[3]) / 1000));
    const dist = Math.hypot(x - prev[0], y - prev[1], z - prev[2]);
    const r = Math.max(this.radius, 1e-4);
    const flow = this.flowFactor();

    let n = 0;
    if (this.brush.inkFlow) {
      if (dist < r * 0.05) {
        // Not moving: hold the ink briefly in case the input just hasn't updated yet.
        this.heldDt += dt;
        if (this.heldDt >= HOLD_STILL_S) {
          n = SPRAY_RATE * this.heldDt * flow;
          this.heldDt = 0;
        }
      } else {
        // Spray cans emit per unit time: slow = dense, fast = thin (but never broken).
        n = Math.max(SPRAY_RATE * (dt + this.heldDt) * flow, (dist / r) * MIN_LINEAR_DENSITY * flow);
        this.heldDt = 0;
      }
    } else {
      n = (dist / r) * LINEAR_DENSITY * flow;
    }
    this.emit(prev, this.last, Math.min(MAX_PER_SAMPLE, Math.round(n)));

    // Pooling paint: dwelling in place soaks the wall until it runs.
    const speed = dt > 0 ? dist / dt : Infinity;
    if (speed < r * 2) {
      this.wetness += dt * this.brush.flow * this.cap.drip * this.brush.drip;
    } else {
      this.wetness *= 0.85;
    }
    if (this.drip && this.brush.drip > 0 && this.wetness > DRIP_THRESHOLD) {
      this.emitDrip(x, y, z, Math.min(this.wetness / DRIP_THRESHOLD, 3));
      this.wetness -= DRIP_THRESHOLD;
    }

    const lastPathIdx = this.path.length - 3;
    const pd = Math.hypot(
      x - this.path[lastPathIdx],
      y - this.path[lastPathIdx + 1],
      z - this.path[lastPathIdx + 2],
    );
    if (pd > r * 0.3) this.path.push(x, y, z);
  }

  /** Copy of the live data trimmed to size, ready to hand to a static geometry. */
  finalize(): BuiltSpray {
    return {
      positions: this.positions.slice(0, this.count * 3),
      colors: this.colors.slice(0, this.count * 4),
      sizes: this.sizes.slice(0, this.count),
      count: this.count,
      path: this.path.slice(),
    };
  }

  private flowFactor(): number {
    return this.brush.flow * this.cap.density;
  }

  private emit(a: number[], b: number[], n: number): void {
    if (n <= 0) return;
    this.reserve(n * 1.2);
    const { rng, u, v, n: nrm, cap, brush } = this;
    const r = this.radius;
    const halo = r * brush.scatter;
    const grain = brush.grain * Math.max(r, 0.02);

    for (let i = 0; i < n; i++) {
      const t = rng();
      const cx = a[0] + (b[0] - a[0]) * t;
      const cy = a[1] + (b[1] - a[1]) * t;
      const cz = a[2] + (b[2] - a[2]) * t;

      const isCore = rng() < cap.coreRatio;
      let rad: number;
      if (isCore) {
        rad = Math.pow(rng(), 2) * r * 0.35;
      } else {
        // Gaussian falloff gives the soft edge of a real spray.
        const g = Math.sqrt(-2 * Math.log(1 - rng() * 0.999));
        rad = Math.min(g * 0.42, 1.7) * halo;
      }
      const ang = rng() * Math.PI * 2;
      const du = Math.cos(ang) * rad;
      const dv = Math.sin(ang) * rad;
      const dn = (rng() - 0.5) * r * 0.06;

      const edge = isCore ? 0 : Math.min(rad / (halo * 1.7), 1);
      const grit = 0.82 + rng() * 0.36;
      const alpha = isCore ? 0.85 : 0.5 * (1 - edge * 0.85);
      const size = grain * (isCore ? 0.55 : 0.32) * (0.5 + rng());

      this.push(
        cx + u[0] * du + v[0] * dv + nrm[0] * dn,
        cy + u[1] * du + v[1] * dv + nrm[1] * dn,
        cz + u[2] * du + v[2] * dv + nrm[2] * dn,
        grit,
        alpha * (0.35 + brush.flow * 0.65),
        size,
      );

      // Occasional clumps of pigment in the core give the stroke texture.
      if (isCore && rng() < 0.03 * cap.density) {
        const clump = 3 + Math.floor(rng() * 6);
        this.reserve(clump);
        for (let c = 0; c < clump; c++) {
          const ca = rng() * Math.PI * 2;
          const cr = Math.sqrt(rng()) * r * 0.08;
          this.push(
            cx + u[0] * (du + Math.cos(ca) * cr) + v[0] * (dv + Math.sin(ca) * cr),
            cy + u[1] * (du + Math.cos(ca) * cr) + v[1] * (dv + Math.sin(ca) * cr),
            cz + u[2] * (du + Math.cos(ca) * cr) + v[2] * (dv + Math.sin(ca) * cr),
            0.85,
            0.9,
            size * 0.7,
          );
        }
      }
    }
  }

  private emitDrip(x: number, y: number, z: number, strength: number): void {
    const d = this.drip!;
    const { rng, u, v, cap } = this;
    const r = this.radius;
    const off = (rng() - 0.5) * r * 0.8;
    const sx = x + u[0] * off;
    const sy = y + u[1] * off;
    const sz = z + u[2] * off;
    const len = Math.max(r, 0.05) * (2.5 + rng() * 6) * strength * (0.6 + cap.drip * 0.4);
    const width = Math.max(r * 0.09, 0.006);
    const n = Math.min(900, Math.round((len / width) * 7));
    const grain = this.brush.grain * Math.max(r, 0.02);
    this.reserve(n + 40);

    for (let i = 0; i < n; i++) {
      const t = i / n;
      // Drips thin out then end in a bead.
      const w = width * (1 - t * 0.55);
      const lateral = (rng() - 0.5) * w;
      this.push(
        sx + d[0] * t * len + u[0] * lateral,
        sy + d[1] * t * len + u[1] * lateral,
        sz + d[2] * t * len + u[2] * lateral,
        0.8 + rng() * 0.2,
        0.85,
        grain * 0.28 * (0.6 + rng() * 0.6),
      );
    }
    const bead = 18 + Math.floor(rng() * 18);
    for (let i = 0; i < bead; i++) {
      const ba = rng() * Math.PI * 2;
      const br = Math.sqrt(rng()) * width * 0.9;
      this.push(
        sx + d[0] * len + u[0] * Math.cos(ba) * br + v[0] * Math.sin(ba) * br,
        sy + d[1] * len + u[1] * Math.cos(ba) * br + v[1] * Math.sin(ba) * br,
        sz + d[2] * len + u[2] * Math.cos(ba) * br + v[2] * Math.sin(ba) * br,
        0.75,
        0.95,
        grain * 0.35,
      );
    }
  }

  private push(x: number, y: number, z: number, grit: number, alpha: number, size: number): void {
    const i = this.count++;
    const p = i * 3;
    const c = i * 4;
    this.positions[p] = x;
    this.positions[p + 1] = y;
    this.positions[p + 2] = z;
    this.colors[c] = this.rgb[0] * grit;
    this.colors[c + 1] = this.rgb[1] * grit;
    this.colors[c + 2] = this.rgb[2] * grit;
    this.colors[c + 3] = alpha;
    this.sizes[i] = size;
  }

  private reserve(extra: number): void {
    const needed = this.count + Math.ceil(extra);
    if (needed <= this.sizes.length) return;
    let cap = this.sizes.length;
    while (cap < needed) cap *= 2;
    this.positions = grow(this.positions, cap * 3);
    this.colors = grow(this.colors, cap * 4);
    this.sizes = grow(this.sizes, cap);
    this.capacityVersion++;
  }
}

function grow(a: Float32Array, size: number): Float32Array {
  const next = new Float32Array(size);
  next.set(a);
  return next;
}

function normalize(a: [number, number, number]): [number, number, number] {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function length(a: [number, number, number]): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
