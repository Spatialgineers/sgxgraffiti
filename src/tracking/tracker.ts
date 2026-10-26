import { HandTracker } from './handTracker';

let video: HTMLVideoElement | null = null;
let tracker: HandTracker | null = null;

/** Registers the <video> element the camera preview renders. */
export function attachVideo(el: HTMLVideoElement | null): void {
  video = el;
}

export function startTracking(): Promise<void> {
  if (!video) return Promise.resolve();
  tracker ??= new HandTracker(video);
  return tracker.start();
}

export function stopTracking(): void {
  tracker?.stop();
}
