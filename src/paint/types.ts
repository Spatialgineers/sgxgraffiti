import type { CapId } from './caps';

export interface BrushSettings {
  cap: CapId;
  color: string;
  /** Base spray radius in world units. */
  size: number;
  /** Paint flow / pressure, 0.1–1. */
  flow: number;
  /** Halo spread multiplier. */
  scatter: number;
  /** Drip multiplier, 0 disables drips. */
  drip: number;
  /** Particle (grain) size multiplier. */
  grain: number;
  /** When on, ink builds up where you move slowly (time-based emission). */
  inkFlow: boolean;
}

/**
 * A committed stroke. Only the inputs are stored; the particles are rebuilt
 * deterministically from `seed`, so saved art is small and replays exactly.
 */
export interface Stroke {
  id: string;
  seed: number;
  brush: BrushSettings;
  /** Normal of the painting plane (the camera's view direction when the stroke began). */
  normal: [number, number, number];
  /** Flattened samples: x, y, z, tMs, x, y, z, tMs, … */
  samples: number[];
}

export const SAMPLE_STRIDE = 4;
