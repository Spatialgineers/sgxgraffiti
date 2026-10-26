import { CircleHelp, EyeOff, ImageDown, Redo2, SprayCan, Trash2, Undo2 } from 'lucide-react';
import { useT } from '../i18n';
import { clearAction, snapshotAction } from '../lib/actions';
import { useApp } from '../state/store';
import { Divider, IconButton } from './primitives';

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const t = useT();
  const canUndo = useApp((s) => s.undoStack.length > 0);
  const canRedo = useApp((s) => s.redoStack.length > 0);
  const hasStrokes = useApp((s) => s.strokes.length > 0);
  const lang = useApp((s) => s.lang);
  const set = useApp((s) => s.set);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
      <div className="glass pointer-events-auto flex shrink-0 items-center gap-3 rounded-2xl p-1.5 min-[480px]:py-2 min-[480px]:pr-4 min-[480px]:pl-2">
        <div className="grid size-9 place-items-center rounded-xl bg-sgx-yellow text-ink shadow-[0_0_24px_rgb(253_204_13/0.35)]">
          <SprayCan className="size-5" strokeWidth={2.25} />
        </div>
        <div className="hidden leading-none min-[480px]:block">
          <div className="text-[15px] font-black tracking-tight uppercase">
            SGX<span className="text-sgx-yellow">.</span>Graffiti
          </div>
          <div className="mt-1 hidden text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase sm:block">
            Spatialgineers · {t.tagline}
          </div>
        </div>
      </div>

      <nav aria-label="Actions" className="glass pointer-events-auto flex min-w-0 items-center rounded-2xl p-1">
        <IconButton icon={Undo2} label={t.undo} shortcut="Z" onClick={undo} disabled={!canUndo} />
        <IconButton icon={Redo2} label={t.redo} shortcut="⇧Z" onClick={redo} disabled={!canRedo} />
        <Divider />
        <IconButton icon={ImageDown} label={t.snapshot} shortcut="S" onClick={() => void snapshotAction()} />
        <IconButton icon={Trash2} label={t.clear} tone="danger" onClick={clearAction} disabled={!hasStrokes} />
        <Divider />
        <span className="hidden sm:contents">
          <IconButton icon={EyeOff} label={t.hideUi} shortcut="H" onClick={() => set({ uiHidden: true })} />
        </span>
        <IconButton icon={CircleHelp} label={t.help} onClick={onHelp} />
        <button
          type="button"
          onClick={() => set({ lang: lang === 'es' ? 'en' : 'es' })}
          title={t.language}
          aria-label={t.language}
          className="focus-ring grid h-9 min-w-9 place-items-center rounded-xl px-2 font-mono sm:h-10 sm:min-w-10 text-[11px] font-bold text-neutral-300 hover:bg-white/8 hover:text-white"
        >
          {lang === 'es' ? 'EN' : 'ES'}
        </button>
      </nav>
    </header>
  );
}
