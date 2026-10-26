import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useHotkeys } from './hooks/useHotkeys';
import { useT } from './i18n';
import { usePointerPainting } from './input/usePointerPainting';
import { pruneBuilt } from './paint/strokeCache';
import { GraffitiCanvas } from './scene/GraffitiCanvas';
import { useApp } from './state/store';
import { Dock } from './ui/Dock';
import { Onboarding } from './ui/Onboarding';
import { StatusPanel } from './ui/StatusPanel';
import { Toasts } from './ui/Toasts';
import { TopBar } from './ui/TopBar';

// Free particle data for strokes that are neither on the canvas nor redoable.
useApp.subscribe((s, prev) => {
  if (s.strokes === prev.strokes && s.redoStack === prev.redoStack) return;
  const live = new Set(s.strokes.map((x) => x.id));
  for (const entry of s.redoStack) {
    if (entry.type === 'add') live.add(entry.stroke.id);
    else entry.strokes.forEach((x) => live.add(x.id));
  }
  for (const entry of s.undoStack) if (entry.type === 'clear') entry.strokes.forEach((x) => live.add(x.id));
  pruneBuilt(live);
});

export default function App() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const uiHidden = useApp((s) => s.uiHidden);
  const tool = useApp((s) => s.tool);
  const [showOnboarding, setShowOnboarding] = useState(() => !useApp.getState().onboarded);
  const pointer = usePointerPainting();
  useHotkeys();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-ink font-sans text-neutral-100 select-none">
      <div
        id="scene"
        className={tool === 'paint' ? 'absolute inset-0 cursor-crosshair' : 'absolute inset-0 cursor-grab active:cursor-grabbing'}
        {...pointer}
      >
        <GraffitiCanvas />
      </div>

      {uiHidden ? (
        <button
          type="button"
          onClick={() => useApp.getState().set({ uiHidden: false })}
          className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] text-white/30 transition hover:bg-white/5 hover:text-white/70"
        >
          {t.showUiHint}
        </button>
      ) : (
        <>
          <TopBar onHelp={() => setShowOnboarding(true)} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
            <div className="order-2 self-start sm:order-1 sm:w-64 sm:self-auto">
              <StatusPanel />
            </div>
            <div className="order-1 sm:order-2">
              <Dock />
            </div>
            <div className="order-3 hidden w-64 justify-end text-right text-[11px] leading-relaxed text-pretty text-neutral-600 lg:flex">
              <span>
                <span className="font-semibold text-neutral-500">{t.shortcuts}</span>
                <br />
                {t.shortcutsList}
              </span>
            </div>
          </div>
          <Toasts />
        </>
      )}

      <AnimatePresence>{showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}</AnimatePresence>
    </main>
  );
}
