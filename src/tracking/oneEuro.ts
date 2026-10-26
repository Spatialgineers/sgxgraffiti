/**
 * One Euro filter (Casiez et al.): heavy smoothing when the hand is still,
 * low latency when it moves fast. Removes MediaPipe jitter without lag.
 */
export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  constructor(
    private readonly minCutoff = 1.5,
    private readonly beta = 4,
    private readonly dCutoff = 1,
  ) {}

  filter(value: number, tSec: number): number {
    if (this.x === null || this.lastT === null) {
      this.x = value;
      this.lastT = tSec;
      return value;
    }
    const dt = Math.max(1e-3, tSec - this.lastT);
    this.lastT = tSec;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.lastT = null;
    this.dx = 0;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}
