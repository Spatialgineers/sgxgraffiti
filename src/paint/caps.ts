export type CapId = 'skinny' | 'fat' | 'flare';

export interface CapProfile {
  /** Spray radius multiplier relative to brush size. */
  spread: number;
  /** Particle emission multiplier. */
  density: number;
  /** How readily paint pools and drips. */
  drip: number;
  /** Fraction of particles that land in the tight, opaque core. */
  coreRatio: number;
  /** Radius of the solid core line relative to the spray radius (0 = none). */
  coreLine: number;
}

export const CAPS: Record<CapId, CapProfile> = {
  skinny: { spread: 0.45, density: 1.5, drip: 0.45, coreRatio: 0.5, coreLine: 0.16 },
  fat: { spread: 1.0, density: 1.0, drip: 1.0, coreRatio: 0.28, coreLine: 0.1 },
  flare: { spread: 2.4, density: 0.55, drip: 0.15, coreRatio: 0.04, coreLine: 0 },
};

export const CAP_IDS: CapId[] = ['skinny', 'fat', 'flare'];
