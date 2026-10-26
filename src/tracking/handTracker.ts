import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { cursor, handFrame } from '../input/cursor';
import { useApp } from '../state/store';
import { cursorAnchor, handScale, SprayTrigger } from './gestures';
import { OneEuroFilter } from './oneEuro';

const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${__MEDIAPIPE_VERSION__}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** The central part of the camera frame maps to the full canvas, so corners are reachable. */
const REACH_GAIN = 1.45;
/** Hand sizes (wrist → knuckle, fraction of frame height) mapped to far/near. */
const DEPTH_FAR = 0.13;
const DEPTH_NEAR = 0.3;
/** How long a lost hand keeps its stroke alive before we lift the nozzle. */
const LOST_GRACE_MS = 160;

async function createLandmarker(): Promise<HandLandmarker> {
  // Loaded on demand: the tracker is ~1MB of JS we don't need until the camera is on.
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  const options = {
    runningMode: 'VIDEO' as const,
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  };
  try {
    return await HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    });
  } catch {
    return HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    });
  }
}

/**
 * Owns the webcam stream and the MediaPipe loop. Results go straight into the
 * shared `cursor` object (no React re-renders per frame); only coarse status
 * changes are pushed to the store.
 */
export class HandTracker {
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private frameHandle = 0;
  private running = false;
  private lastVideoTime = -1;
  private lastSeen = 0;
  private readonly trigger = new SprayTrigger();
  private readonly fx = new OneEuroFilter();
  private readonly fy = new OneEuroFilter();
  private readonly fz = new OneEuroFilter(0.8, 1.5);

  constructor(private readonly video: HTMLVideoElement) {}

  async start(): Promise<void> {
    if (this.running) return;
    const app = useApp.getState();
    if (!navigator.mediaDevices?.getUserMedia) {
      app.set({ tracking: 'unsupported' });
      return;
    }

    app.set({ tracking: 'requesting' });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      app.set({ tracking: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported' });
      return;
    }

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play().catch(() => undefined);

    useApp.getState().set({ tracking: 'loading' });
    try {
      this.landmarker ??= await createLandmarker();
    } catch (err) {
      console.error('Hand tracking failed to initialize', err);
      this.stopStream();
      useApp.getState().set({ tracking: 'error' });
      return;
    }

    this.running = true;
    useApp.getState().set({ tracking: 'ready', tool: 'orbit' });
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle) {
      if ('cancelVideoFrameCallback' in this.video) this.video.cancelVideoFrameCallback(this.frameHandle);
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
    this.stopStream();
    this.releaseHand();
    useApp.getState().set({ tracking: 'off' });
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  private schedule(): void {
    if (!this.running) return;
    // Run inference once per *new* camera frame, not once per display frame.
    if ('requestVideoFrameCallback' in this.video) {
      this.frameHandle = this.video.requestVideoFrameCallback(() => this.tick());
    } else {
      this.frameHandle = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (!this.running || !this.landmarker) return;
    const video = this.video;
    if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = this.landmarker.detectForVideo(video, now);
      const lm = result.landmarks?.[0];
      if (lm) {
        this.onHand(lm, now, video.videoWidth / Math.max(1, video.videoHeight));
      } else if (now - this.lastSeen > LOST_GRACE_MS) {
        this.releaseHand();
      }
    }
    this.schedule();
  }

  private onHand(lm: { x: number; y: number; z: number }[], now: number, aspect: number): void {
    const app = useApp.getState();
    this.lastSeen = now;
    this.trigger.mode = app.gesture;
    const pressed = this.trigger.update(lm, aspect);
    const anchor = cursorAnchor(lm, app.gesture);
    const t = now / 1000;

    // Mirror x so the canvas behaves like a mirror, then expand the reachable area.
    const x = this.fx.filter(clamp((0.5 - anchor.x) * 2 * REACH_GAIN, -1, 1), t);
    const y = this.fy.filter(clamp((0.5 - anchor.y) * 2 * REACH_GAIN, -1, 1), t);
    const scale = handScale(lm, aspect);
    const near = clamp((scale - DEPTH_FAR) / (DEPTH_NEAR - DEPTH_FAR), 0, 1) * 2 - 1;
    const depth = this.fz.filter(near, t);

    handFrame.landmarks = lm;
    handFrame.spraying = pressed;

    if (!cursor.pointerDown) {
      cursor.visible = true;
      cursor.source = 'hand';
      cursor.x = x;
      cursor.y = y;
      cursor.depth = app.depthEnabled ? depth : 0;
      cursor.spraying = pressed;
    }

    if (!app.handVisible || app.spraying !== pressed) {
      app.set({ handVisible: true, spraying: pressed });
    }
  }

  private releaseHand(): void {
    handFrame.landmarks = null;
    handFrame.spraying = false;
    this.trigger.reset();
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
    if (cursor.source === 'hand') {
      cursor.visible = false;
      cursor.spraying = false;
      cursor.source = null;
    }
    const app = useApp.getState();
    if (app.handVisible || app.spraying) app.set({ handVisible: false, spraying: false });
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
