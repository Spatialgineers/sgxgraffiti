import { describe, expect, it } from 'vitest';
import { cursorAnchor, foldedFingers, pinchRatio, SprayTrigger, type Point3 } from './gestures';

/** A flat, upright right hand in image space. `curl` folds the four fingers, `pinch` closes thumb to index. */
function hand({ curl = 0, pinch = 0 }: { curl?: number; pinch?: number } = {}): Point3[] {
  const lm: Point3[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  lm[0] = wrist;
  const fingers = [
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  fingers.forEach((f, i) => {
    const x = 0.44 + i * 0.04;
    lm[f[0]] = { x, y: 0.62, z: 0 };
    const tipY = 0.62 - 0.2 * (1 - curl) + 0.14 * curl;
    lm[f[1]] = { x, y: (0.62 + tipY) / 2, z: 0 };
    lm[f[2]] = { x, y: (0.62 + tipY * 2) / 3, z: 0 };
    lm[f[3]] = { x, y: tipY, z: 0 };
  });
  // Thumb from the side, moving towards the index tip as we pinch.
  const idx = lm[8];
  const open = { x: 0.34, y: 0.6, z: 0 };
  lm[1] = { x: 0.44, y: 0.74, z: 0 };
  lm[2] = { x: 0.4, y: 0.7, z: 0 };
  lm[3] = { x: 0.37, y: 0.66, z: 0 };
  lm[4] = { x: open.x + (idx.x - open.x) * pinch, y: open.y + (idx.y - open.y) * pinch, z: 0 };
  return lm;
}

describe('gestures', () => {
  it('measures pinch relative to hand size', () => {
    expect(pinchRatio(hand(), 1)).toBeGreaterThan(0.5);
    expect(pinchRatio(hand({ pinch: 0.95 }), 1)).toBeLessThan(0.32);
  });

  it('counts folded fingers', () => {
    expect(foldedFingers(hand())).toBe(0);
    expect(foldedFingers(hand({ curl: 1 }))).toBe(4);
  });

  it('anchors the fist cursor to the knuckles so closing the hand does not move it', () => {
    const open = cursorAnchor(hand(), 'fist');
    const closed = cursorAnchor(hand({ curl: 1 }), 'fist');
    expect(Math.hypot(open.x - closed.x, open.y - closed.y)).toBeLessThan(1e-9);
  });

  it('needs consecutive frames and hysteresis to toggle', () => {
    const trig = new SprayTrigger('pinch');
    const closed = hand({ pinch: 0.95 });
    const half = hand({ pinch: 0.65 }); // between the on and off thresholds
    const open = hand();

    expect(trig.update(closed, 1)).toBe(false); // one noisy frame is not enough
    expect(trig.update(closed, 1)).toBe(true);
    expect(trig.update(half, 1)).toBe(true); // in the dead band: stays on
    expect(trig.update(half, 1)).toBe(true);
    expect(trig.update(open, 1)).toBe(true);
    expect(trig.update(open, 1)).toBe(false);
  });

  it('supports the fist gesture', () => {
    const trig = new SprayTrigger('fist');
    trig.update(hand({ curl: 1 }), 1);
    expect(trig.update(hand({ curl: 1 }), 1)).toBe(true);
  });
});
