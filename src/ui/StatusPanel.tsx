import { Hand, Video, VideoOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { handFrame } from '../input/cursor';
import { useT } from '../i18n';
import { useApp, type TrackingStatus } from '../state/store';
import { attachVideo, startTracking, stopTracking } from '../tracking/tracker';
import { cx } from './primitives';

// Bones of the MediaPipe hand skeleton, for the preview overlay.
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function SkeletonOverlay({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const lm = handFrame.landmarks;
      if (!lm) return;
      const active = handFrame.spraying;
      ctx.lineWidth = 2;
      ctx.strokeStyle = active ? colorRef.current : 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
      }
      ctx.stroke();
      ctx.fillStyle = active ? colorRef.current : '#FDCC0D';
      for (const i of [4, 8]) {
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={320} height={240} className="absolute inset-0 size-full -scale-x-100" />;
}

function statusText(status: TrackingStatus, t: ReturnType<typeof useT>): string {
  return {
    off: t.statusOff,
    requesting: t.statusRequesting,
    loading: t.statusLoading,
    ready: t.statusReady,
    denied: t.statusDenied,
    error: t.statusError,
    unsupported: t.statusUnsupported,
  }[status];
}

export function StatusPanel() {
  const t = useT();
  const tracking = useApp((s) => s.tracking);
  const handVisible = useApp((s) => s.handVisible);
  const spraying = useApp((s) => s.spraying);
  const gesture = useApp((s) => s.gesture);
  const showCamera = useApp((s) => s.showCamera);
  const strokes = useApp((s) => s.strokes.length);
  const color = useApp((s) => s.brush.color);

  const live = tracking === 'ready';
  const busy = tracking === 'requesting' || tracking === 'loading';
  const hint = !live ? null : spraying ? t.sprayingNow : handVisible ? (gesture === 'pinch' ? t.handPinch : t.handFist) : t.noHand;

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      {/* The video element always exists so the tracker can attach to it. */}
      <div
        className={cx(
          'glass relative aspect-[4/3] w-40 overflow-hidden rounded-2xl transition-all sm:w-48',
          live && showCamera ? 'opacity-100' : 'pointer-events-none absolute h-0 w-0 opacity-0',
        )}
      >
        <video ref={attachVideo} className="absolute inset-0 size-full -scale-x-100 object-cover opacity-60" muted playsInline />
        <SkeletonOverlay color={color} />
        {spraying && <div className="absolute inset-0 rounded-2xl ring-2 ring-inset" style={{ ['--tw-ring-color' as string]: color }} />}
      </div>

      <div className="glass flex items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3 text-xs">
        <span
          className={cx(
            'size-2 rounded-full',
            live ? (handVisible ? 'bg-emerald-400' : 'bg-emerald-400/50') : busy ? 'animate-pulse bg-sgx-yellow' : 'bg-neutral-600',
          )}
        />
        <span className="font-medium text-neutral-200">{statusText(tracking, t)}</span>
        {hint && (
          <span className="hidden items-center gap-1 text-neutral-400 sm:flex">
            <Hand className="size-3.5" />
            {hint}
          </span>
        )}
        <span className="ml-1 rounded-md bg-white/6 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400" title={t.strokes}>
          {strokes}
        </span>
        <button
          type="button"
          onClick={() => (live || busy ? stopTracking() : void startTracking())}
          disabled={busy}
          aria-label={live ? t.disableCamera : t.enableCamera}
          title={live ? t.disableCamera : t.enableCamera}
          className={cx(
            'focus-ring grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40',
            live ? 'bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25' : 'bg-sgx-yellow text-ink hover:bg-[#ffe04d]',
          )}
        >
          {live ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        </button>
      </div>
    </div>
  );
}
