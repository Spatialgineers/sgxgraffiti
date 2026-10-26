import { Brush, Orbit, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { SWATCHES } from '../brand';
import { useT } from '../i18n';
import { CAP_IDS, type CapId } from '../paint/caps';
import { useApp } from '../state/store';
import { cx, Divider, Segmented, SectionLabel, Slider, Toggle } from './primitives';

type PanelId = 'color' | 'adjust' | null;

/** Tiny illustration of what each cap paints. */
function CapGlyph({ cap }: { cap: CapId }) {
  if (cap === 'skinny') {
    return (
      <svg viewBox="0 0 40 24" className="h-5 w-8 sm:w-9" aria-hidden>
        <path d="M4 16 C 12 4, 22 20, 36 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (cap === 'fat') {
    return (
      <svg viewBox="0 0 40 24" className="h-5 w-8 sm:w-9" aria-hidden>
        <path d="M4 14 C 12 4, 22 18, 36 8" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M21 12 v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="21" cy="21" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 24" className="h-5 w-8 sm:w-9" aria-hidden>
      <defs>
        <filter id="flare-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <path
        d="M6 13 C 13 5, 23 19, 34 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.75"
        filter="url(#flare-blur)"
      />
    </svg>
  );
}

function ColorPanel() {
  const t = useT();
  const color = useApp((s) => s.brush.color);
  const recent = useApp((s) => s.recentColors);
  const setColor = useApp((s) => s.setColor);
  const setBrush = useApp((s) => s.setBrush);

  return (
    <div className="w-[min(18rem,calc(100vw-2rem))] space-y-3">
      <div>
        <SectionLabel>{t.color}</SectionLabel>
        <div className="grid grid-cols-9 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cx(
                'focus-ring aspect-square rounded-full border transition-transform hover:scale-110',
                c.toLowerCase() === color.toLowerCase() ? 'border-white ring-2 ring-white/40' : 'border-white/15',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {recent.length > 0 && (
        <div>
          <SectionLabel>{t.recent}</SectionLabel>
          <div className="flex gap-1.5">
            {recent.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="focus-ring size-6 rounded-full border border-white/15"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
      <div>
        <SectionLabel>{t.customColor}</SectionLabel>
        {/* Live-update the brush while dragging; record it as "recent" on release. */}
        <div onPointerUp={() => setColor(useApp.getState().brush.color)}>
          <HexColorPicker color={color} onChange={(c) => setBrush({ color: c })} />
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/40 px-2 py-1.5">
          <span className="size-5 rounded-md border border-white/15" style={{ backgroundColor: color }} />
          <span className="font-mono text-xs text-neutral-500">#</span>
          <HexColorInput
            color={color}
            onChange={setColor}
            aria-label={t.customColor}
            className="w-full bg-transparent font-mono text-xs text-white uppercase outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function AdjustPanel() {
  const t = useT();
  const brush = useApp((s) => s.brush);
  const setBrush = useApp((s) => s.setBrush);
  const glow = useApp((s) => s.glow);
  const gesture = useApp((s) => s.gesture);
  const depthEnabled = useApp((s) => s.depthEnabled);
  const backdrop = useApp((s) => s.backdrop);
  const showCamera = useApp((s) => s.showCamera);
  const set = useApp((s) => s.set);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))] space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Slider label={t.size} value={brush.size} min={0.05} max={1.2} step={0.01} onChange={(v) => setBrush({ size: v })} />
        <Slider label={t.flow} value={brush.flow} min={0.1} max={1} step={0.05} format={pct} onChange={(v) => setBrush({ flow: v })} />
        <Slider label={t.scatter} value={brush.scatter} min={0.3} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => setBrush({ scatter: v })} />
        <Slider label={t.drip} value={brush.drip} min={0} max={3} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => setBrush({ drip: v })} />
        <Slider label={t.grain} value={brush.grain} min={0.3} max={2.5} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => setBrush({ grain: v })} />
        <Slider label={t.glow} value={glow} min={0} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => set({ glow: v })} />
      </div>
      <Divider vertical={false} />
      <Toggle label={t.inkFlow} hint={t.inkFlowHint} checked={brush.inkFlow} onChange={(v) => setBrush({ inkFlow: v })} />
      <Toggle label={t.depth} hint={t.depthHint} checked={depthEnabled} onChange={(v) => set({ depthEnabled: v })} />
      <Toggle label={t.cameraPreview} checked={showCamera} onChange={(v) => set({ showCamera: v })} />
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Segmented
          label={t.gesture}
          value={gesture}
          onChange={(v) => set({ gesture: v })}
          options={[
            { value: 'pinch', label: t.gesturePinch },
            { value: 'fist', label: t.gestureFist },
          ]}
        />
        <Segmented
          label={t.backdrop}
          value={backdrop}
          onChange={(v) => set({ backdrop: v })}
          options={[
            { value: 'void', label: t.backdropVoid },
            { value: 'wall', label: t.backdropWall },
          ]}
        />
      </div>
    </div>
  );
}

export function Dock() {
  const t = useT();
  const tool = useApp((s) => s.tool);
  const cap = useApp((s) => s.brush.cap);
  const color = useApp((s) => s.brush.color);
  const set = useApp((s) => s.set);
  const setCap = useApp((s) => s.setCap);
  const [panel, setPanel] = useState<PanelId>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close popovers on outside click or Escape.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [panel]);

  const toggle = (p: Exclude<PanelId, null>) => setPanel((cur) => (cur === p ? null : p));
  const capLabel: Record<CapId, [string, string]> = {
    skinny: [t.capSkinny, t.capSkinnyHint],
    fat: [t.capFat, t.capFatHint],
    flare: [t.capFlare, t.capFlareHint],
  };

  return (
    <div ref={ref} className="pointer-events-auto relative flex flex-col items-center gap-2">
      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass glass-strong max-h-[60vh] overflow-y-auto rounded-2xl p-4"
            role="dialog"
            aria-label={panel === 'color' ? t.color : t.adjust}
          >
            {panel === 'color' ? <ColorPanel /> : <AdjustPanel />}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass no-scrollbar flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-2xl p-1.5">
        <div role="radiogroup" aria-label="Tool" className="flex shrink-0 gap-0.5 rounded-xl bg-black/40 p-0.5">
          {(
            [
              ['paint', Brush, t.paintTool, t.paintToolHint, 'B'],
              ['orbit', Orbit, t.orbitTool, t.orbitToolHint, 'V'],
            ] as const
          ).map(([id, Icon, label, hint, key]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tool === id}
              aria-label={label}
              title={`${label} (${key}) — ${hint}`}
              onClick={() => set({ tool: id })}
              className={cx(
                'focus-ring grid size-10 place-items-center rounded-[10px] transition-colors',
                tool === id ? 'bg-white/14 text-white' : 'text-neutral-400 hover:text-white',
              )}
            >
              <Icon className="size-[18px]" />
            </button>
          ))}
        </div>

        <Divider />

        <div role="radiogroup" aria-label={t.caps} className="flex shrink-0 gap-0.5">
          {CAP_IDS.map((id, i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={cap === id}
              title={`${capLabel[id][0]} (${i + 1}) — ${capLabel[id][1]}`}
              onClick={() => setCap(id)}
              className={cx(
                'focus-ring flex h-10 shrink-0 flex-col items-center justify-center rounded-xl px-1.5 transition-colors sm:px-2.5',
                cap === id ? 'bg-sgx-yellow text-ink' : 'text-neutral-400 hover:bg-white/8 hover:text-white',
              )}
            >
              <CapGlyph cap={id} />
              <span className="text-[9px] leading-none font-bold tracking-wider uppercase">{capLabel[id][0]}</span>
            </button>
          ))}
        </div>

        <Divider />

        <button
          type="button"
          onClick={() => toggle('color')}
          aria-label={t.color}
          aria-expanded={panel === 'color'}
          title={t.color}
          className={cx(
            'focus-ring grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
            panel === 'color' ? 'bg-white/14' : 'hover:bg-white/8',
          )}
        >
          <span
            className="size-6 rounded-full border-2 border-white/80 shadow-[0_0_14px_var(--c)]"
            style={{ backgroundColor: color, ['--c' as string]: color }}
          />
        </button>
        <button
          type="button"
          onClick={() => toggle('adjust')}
          aria-label={t.adjust}
          aria-expanded={panel === 'adjust'}
          title={t.adjust}
          className={cx(
            'focus-ring grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
            panel === 'adjust' ? 'bg-white/14 text-white' : 'text-neutral-300 hover:bg-white/8 hover:text-white',
          )}
        >
          <SlidersHorizontal className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}
