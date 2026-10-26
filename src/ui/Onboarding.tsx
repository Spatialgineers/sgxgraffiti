import { Hand, LoaderCircle, MousePointer2, MoveDiagonal, ShieldCheck, SprayCan, Video, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { useApp } from '../state/store';
import { startTracking } from '../tracking/tracker';

/** Looping illustration of the paint gesture: a hand closing on the nozzle. */
function GestureIllustration({ fist }: { fist: boolean }) {
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="spray" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E3FF00" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#E3FF00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M20 108 C 60 40, 110 120, 182 46"
        fill="none"
        stroke="#E3FF00"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="260"
        className="[animation:sgx-draw_2.8s_ease-in-out_infinite]"
        style={{ filter: 'drop-shadow(0 0 8px #E3FF00)' }}
      />
      <g className="[animation:sgx-trace_2.8s_ease-in-out_infinite]">
        <circle r="18" fill="url(#spray)" opacity="0.7" />
        {fist ? (
          <circle r="10" fill="none" stroke="#F5F5F5" strokeWidth="2.5" className="[animation:sgx-press_2.8s_ease-in-out_infinite]" />
        ) : (
          <g stroke="#F5F5F5" strokeWidth="2.5" strokeLinecap="round">
            <line x1="-12" y1="-10" x2="-3" y2="-1" className="[animation:sgx-pinch-a_2.8s_ease-in-out_infinite]" />
            <line x1="12" y1="-10" x2="3" y2="-1" className="[animation:sgx-pinch-b_2.8s_ease-in-out_infinite]" />
          </g>
        )}
      </g>
      <style>{`
        @keyframes sgx-draw { 0%,12% { stroke-dashoffset: 260 } 75%,100% { stroke-dashoffset: 0 } }
        @keyframes sgx-trace {
          0%,12% { transform: translate(20px,108px) }
          30% { transform: translate(62px,72px) }
          45% { transform: translate(100px,86px) }
          60% { transform: translate(140px,76px) }
          75%,100% { transform: translate(182px,46px) }
        }
        @keyframes sgx-pinch-a { 0%,8% { transform: translate(-4px,-4px) } 14%,76% { transform: none } 84%,100% { transform: translate(-4px,-4px) } }
        @keyframes sgx-pinch-b { 0%,8% { transform: translate(4px,-4px) } 14%,76% { transform: none } 84%,100% { transform: translate(4px,-4px) } }
        @keyframes sgx-press { 0%,8% { r: 13px } 14%,76% { r: 7px } 84%,100% { r: 13px } }
      `}</style>
    </svg>
  );
}

export function Onboarding({ onClose }: { onClose: () => void }) {
  const t = useT();
  const tracking = useApp((s) => s.tracking);
  const gesture = useApp((s) => s.gesture);
  const set = useApp((s) => s.set);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const busy = tracking === 'requesting' || tracking === 'loading';
  const failed = tracking === 'denied' || tracking === 'error' || tracking === 'unsupported';
  const errorBody = tracking === 'denied' ? t.deniedBody : tracking === 'unsupported' ? t.unsupportedBody : t.errorBody;

  const finish = (tool: 'paint' | 'orbit') => {
    set({ onboarded: true, tool });
    onClose();
  };

  // Once tracking is live there is nothing left to explain.
  useEffect(() => {
    if (tracking === 'ready') finish('orbit');
  }, [tracking]);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish(tracking === 'ready' ? 'orbit' : 'paint');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const steps = [
    { icon: Hand, title: t.step1Title, body: t.step1Body },
    {
      icon: SprayCan,
      title: gesture === 'pinch' ? t.step2TitlePinch : t.step2TitleFist,
      body: gesture === 'pinch' ? t.step2BodyPinch : t.step2BodyFist,
    },
    { icon: MoveDiagonal, title: t.step3Title, body: t.step3Body },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, scale: 0.98 }}
        className="glass relative w-full max-w-3xl overflow-hidden rounded-3xl"
      >
        <button
          type="button"
          onClick={() => finish(tracking === 'ready' ? 'orbit' : 'paint')}
          aria-label="Close"
          className="focus-ring absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-xl text-neutral-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <div className="grid md:grid-cols-[1fr_1.15fr]">
          <div className="relative flex flex-col justify-between gap-6 bg-gradient-to-br from-sgx-blue/40 via-black/40 to-black/60 p-6 sm:p-8">
            <div>
              <div className="text-[11px] font-bold tracking-[0.2em] text-sgx-yellow uppercase">Spatialgineers · SGX</div>
              <h1 id="onboard-title" className="mt-2 text-3xl leading-[1.05] font-black tracking-tight sm:text-4xl">
                {t.onboardTitle}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t.onboardSubtitle}</p>
            </div>
            <div className="h-32 sm:h-40">
              <GestureIllustration fist={gesture === 'fist'} />
            </div>
          </div>

          <div className="flex flex-col gap-5 p-6 sm:p-8">
            <ol className="space-y-4">
              {steps.map(({ icon: I, title, body }, i) => (
                <li key={i} className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-sgx-yellow/25 bg-sgx-yellow/10 text-sgx-yellow">
                    <I className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <p className="mt-0.5 text-[13px] leading-snug text-neutral-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            {failed && (
              <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-[13px] leading-snug text-red-200">
                {errorBody}
              </div>
            )}

            <div className="mt-auto space-y-2">
              <button
                ref={primaryRef}
                type="button"
                disabled={busy}
                onClick={() => void startTracking()}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-sgx-yellow py-3 text-sm font-black tracking-wide text-ink uppercase shadow-[0_10px_30px_-8px_rgb(253_204_13/0.6)] transition hover:bg-[#ffe04d] disabled:opacity-70"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Video className="size-4" />}
                {busy ? (tracking === 'loading' ? t.statusLoading : t.statusRequesting) : failed ? t.retry : t.enableCamera}
              </button>
              <button
                type="button"
                onClick={() => finish('paint')}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-white/8"
              >
                <MousePointer2 className="size-4" />
                {t.usePointer}
              </button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-neutral-500">
                <ShieldCheck className="size-3.5" />
                {t.privacy}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
