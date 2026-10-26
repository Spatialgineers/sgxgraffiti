import { describe, expect, it } from 'vitest';
import { SprayBuilder } from './sprayBuilder';
import { SAMPLE_STRIDE, type BrushSettings, type Stroke } from './types';

const brush: BrushSettings = {
  cap: 'fat',
  color: '#E3FF00',
  size: 0.3,
  flow: 0.8,
  scatter: 1,
  drip: 1,
  grain: 1,
  inkFlow: true,
};

function line(n: number, step = 0.05, dtMs = 16): number[] {
  const s: number[] = [];
  for (let i = 0; i < n; i++) s.push(i * step, 0, 0, i * dtMs);
  return s;
}

function stroke(samples: number[], patch: Partial<BrushSettings> = {}, seed = 42): Stroke {
  return { id: 'x', seed, brush: { ...brush, ...patch }, normal: [0, 0, 1], samples };
}

describe('SprayBuilder', () => {
  it('is deterministic for the same seed and samples', () => {
    const a = SprayBuilder.fromStroke(stroke(line(60))).finalize();
    const b = SprayBuilder.fromStroke(stroke(line(60))).finalize();
    expect(a.count).toBeGreaterThan(0);
    expect(a.count).toBe(b.count);
    expect(a.positions).toEqual(b.positions);
  });

  it('produces the same result whether built live or replayed', () => {
    const samples = line(80);
    const live = new SprayBuilder(brush, 7, [0, 0, 1], 16); // tiny capacity forces growth
    for (let i = 0; i < samples.length; i += SAMPLE_STRIDE) {
      live.addSample(samples[i], samples[i + 1], samples[i + 2], samples[i + 3]);
    }
    const replay = SprayBuilder.fromStroke(stroke(samples, {}, 7)).finalize();
    expect(live.capacityVersion).toBeGreaterThan(0);
    expect(live.finalize().positions).toEqual(replay.positions);
  });

  it('keeps particle counts bounded per sample', () => {
    // One huge jump must not explode the particle count.
    const built = SprayBuilder.fromStroke(stroke([0, 0, 0, 0, 500, 0, 0, 16])).finalize();
    expect(built.count).toBeLessThan(5000);
  });

  it('lays down more paint when moving slowly with speed-sensitive ink', () => {
    // Same distance covered, once in 0.5s and once in 5s.
    const fast = SprayBuilder.fromStroke(stroke(line(30, 0.1, 16))).finalize().count;
    const slow = SprayBuilder.fromStroke(stroke(line(300, 0.01, 16))).finalize().count;
    expect(slow).toBeGreaterThan(fast * 3);
  });

  it('only drips when paint pools, and never with drips off', () => {
    const dwell: number[] = [];
    for (let i = 0; i < 120; i++) dwell.push(0, 0, 0, i * 16);
    const wet = SprayBuilder.fromStroke(stroke(dwell)).finalize();
    const dry = SprayBuilder.fromStroke(stroke(dwell, { drip: 0 })).finalize();
    // Drips run downward along -y.
    const minY = (b: { positions: Float32Array; count: number }) => {
      let m = Infinity;
      for (let i = 0; i < b.count; i++) m = Math.min(m, b.positions[i * 3 + 1]);
      return m;
    };
    expect(minY(wet)).toBeLessThan(minY(dry) - 0.3);
  });

  it('does not bead when the input updates slower than the render loop', () => {
    // Camera at 30Hz, render at 60Hz: every other sample repeats the previous position.
    const doubled: number[] = [];
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(i / 2) * 0.1;
      doubled.push(x, 0, 0, i * 16);
    }
    // A brush much narrower than the sample spacing, so beads would be clearly separable.
    const built = SprayBuilder.fromStroke(stroke(doubled, { cap: 'skinny', size: 0.02 })).finalize();
    // Compare paint landing right on a sample point with paint between samples.
    let onPoint = 0;
    let between = 0;
    for (let i = 0; i < built.count; i++) {
      const frac = (built.positions[i * 3] / 0.1) % 1;
      if (frac < 0.1 || frac > 0.9) onPoint++;
      else if (frac > 0.4 && frac < 0.6) between++;
    }
    expect(onPoint / 2).toBeLessThan(between * 1.6);
  });

  it('keeps particles on the painting plane', () => {
    const built = SprayBuilder.fromStroke(stroke(line(40))).finalize();
    for (let i = 0; i < built.count; i++) expect(Math.abs(built.positions[i * 3 + 2])).toBeLessThan(0.05);
  });

  it('down-samples the core path', () => {
    const built = SprayBuilder.fromStroke(stroke(line(200, 0.01))).finalize();
    expect(built.path.length / 3).toBeLessThan(200);
    expect(built.path.length / 3).toBeGreaterThan(5);
  });
});
