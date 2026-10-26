export type InputSource = 'hand' | 'pointer';

/**
 * Shared, mutable input state written by the hand tracker and pointer
 * handlers and read every frame by the scene. Kept out of React on purpose:
 * it changes 60 times a second.
 */
export const cursor = {
  /** A hand or pointer is currently aiming at the canvas. */
  visible: false,
  spraying: false,
  /** Normalized device coordinates, -1..1 (y up). */
  x: 0,
  y: 0,
  /** -1 (far) .. 1 (near). */
  depth: 0,
  source: null as InputSource | null,
  /** True while a pointer button is held; pointer wins over the hand. */
  pointerDown: false,
};

export interface HandFrame {
  /** Raw landmarks of the tracked hand, or null when no hand is visible. */
  landmarks: { x: number; y: number }[] | null;
  spraying: boolean;
}

/** Latest tracking result, for the camera preview overlay. */
export const handFrame: HandFrame = { landmarks: null, spraying: false };
