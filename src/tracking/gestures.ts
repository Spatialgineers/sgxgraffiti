export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type GestureMode = 'pinch' | 'fist';

// MediaPipe hand landmark indices.
export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const INDEX_TIP = 8;
export const MIDDLE_MCP = 9;
const TIPS = [8, 12, 16, 20];
const MCPS = [5, 9, 13, 17];

/** Distance in image space, correcting x for the frame's aspect ratio. */
function dist2d(a: Point3, b: Point3, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Apparent hand size (wrist → middle knuckle). Bigger = closer to the camera. */
export function handScale(lm: Point3[], aspect: number): number {
  return dist2d(lm[WRIST], lm[MIDDLE_MCP], aspect);
}

/** Thumb-to-index gap relative to hand size; ~0.15 when pinched, >0.6 when open. */
export function pinchRatio(lm: Point3[], aspect: number): number {
  return dist2d(lm[THUMB_TIP], lm[INDEX_TIP], aspect) / Math.max(handScale(lm, aspect), 1e-4);
}

/** Number of the four fingers curled back towards the wrist. */
export function foldedFingers(lm: Point3[]): number {
  const w = lm[WRIST];
  let folded = 0;
  for (let i = 0; i < TIPS.length; i++) {
    const tip = lm[TIPS[i]];
    const mcp = lm[MCPS[i]];
    const tipD = Math.hypot(tip.x - w.x, tip.y - w.y, tip.z - w.z);
    const mcpD = Math.hypot(mcp.x - w.x, mcp.y - w.y, mcp.z - w.z);
    if (tipD < mcpD * 1.05) folded++;
  }
  return folded;
}

/**
 * Where the nozzle is. Anchored to points that barely move while the gesture
 * closes, so starting to spray doesn't make the line jump.
 */
export function cursorAnchor(lm: Point3[], mode: GestureMode): { x: number; y: number } {
  if (mode === 'pinch') {
    const a = lm[THUMB_TIP];
    const b = lm[INDEX_TIP];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const k = lm[MIDDLE_MCP];
  const i = lm[INDEX_MCP];
  return { x: (k.x + i.x) / 2, y: (k.y + i.y) / 2 };
}

const PINCH_ON = 0.32;
const PINCH_OFF = 0.5;
const FIST_ON = 3;
const FIST_OFF = 1;
const CONFIRM_FRAMES = 2;

/**
 * Decides whether the nozzle is pressed, with hysteresis and a short
 * confirmation window so tracking noise doesn't break strokes.
 */
export class SprayTrigger {
  private pressed = false;
  private pending = 0;

  constructor(public mode: GestureMode = 'pinch') {}

  update(lm: Point3[], aspect: number): boolean {
    let wantOn: boolean;
    let wantOff: boolean;
    if (this.mode === 'pinch') {
      const r = pinchRatio(lm, aspect);
      wantOn = r < PINCH_ON;
      wantOff = r > PINCH_OFF;
    } else {
      const f = foldedFingers(lm);
      wantOn = f >= FIST_ON;
      wantOff = f <= FIST_OFF;
    }

    const flip = this.pressed ? wantOff : wantOn;
    this.pending = flip ? this.pending + 1 : 0;
    if (this.pending >= CONFIRM_FRAMES) {
      this.pressed = !this.pressed;
      this.pending = 0;
    }
    return this.pressed;
  }

  reset(): void {
    this.pressed = false;
    this.pending = 0;
  }
}
