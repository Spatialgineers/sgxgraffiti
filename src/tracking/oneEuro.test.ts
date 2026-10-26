import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from './oneEuro';

describe('OneEuroFilter', () => {
  it('smooths jitter around a still value', () => {
    const f = new OneEuroFilter();
    let maxDev = 0;
    for (let i = 0; i < 200; i++) {
      const noisy = 0.5 + (i % 2 ? 0.02 : -0.02);
      const out = f.filter(noisy, i / 60);
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(out - 0.5));
    }
    expect(maxDev).toBeLessThan(0.01);
  });

  it('follows fast motion closely', () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i <= 30; i++) out = f.filter(i * 0.05, i / 60);
    expect(Math.abs(out - 1.5)).toBeLessThan(0.1);
  });
});
