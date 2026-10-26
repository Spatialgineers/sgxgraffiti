import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BRAND } from '../brand';
import type { CapId } from '../paint/caps';
import type { BrushSettings, Stroke } from '../paint/types';
import type { GestureMode } from '../tracking/gestures';
import type { Lang } from '../i18n';

export type TrackingStatus = 'off' | 'requesting' | 'loading' | 'ready' | 'denied' | 'error' | 'unsupported';
export type ToolMode = 'paint' | 'orbit';
export type Backdrop = 'void' | 'wall';

type HistoryEntry = { type: 'add'; stroke: Stroke } | { type: 'clear'; strokes: Stroke[] };

const MAX_HISTORY = 200;
const MAX_RECENT = 6;

export interface AppState {
  brush: BrushSettings;
  strokes: Stroke[];
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  recentColors: string[];

  lang: Lang;
  tool: ToolMode;
  gesture: GestureMode;
  depthEnabled: boolean;
  backdrop: Backdrop;
  glow: number;
  showCamera: boolean;
  uiHidden: boolean;
  onboarded: boolean;

  tracking: TrackingStatus;
  handVisible: boolean;
  spraying: boolean;

  setBrush: (patch: Partial<BrushSettings>) => void;
  setCap: (cap: CapId) => void;
  setColor: (color: string) => void;
  addStroke: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  set: (patch: Partial<AppState>) => void;
}

export const DEFAULT_BRUSH: BrushSettings = {
  cap: 'fat',
  color: BRAND.amarilloNeon,
  size: 0.32,
  flow: 0.8,
  scatter: 1,
  drip: 1,
  grain: 1,
  inkFlow: true,
};

/** localStorage that never throws (private mode, quota, blocked storage). */
const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Out of quota: keep painting, just stop autosaving the artwork.
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function defaultLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function pushHistory(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...stack, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      brush: DEFAULT_BRUSH,
      strokes: [],
      undoStack: [],
      redoStack: [],
      recentColors: [],

      lang: defaultLang(),
      tool: 'paint',
      gesture: 'pinch',
      depthEnabled: true,
      backdrop: 'void',
      glow: 1.4,
      showCamera: true,
      uiHidden: false,
      onboarded: false,

      tracking: 'off',
      handVisible: false,
      spraying: false,

      setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
      setCap: (cap) => set((s) => ({ brush: { ...s.brush, cap } })),
      setColor: (color) =>
        set((s) => ({
          brush: { ...s.brush, color },
          recentColors: [color, ...s.recentColors.filter((c) => c !== color)].slice(0, MAX_RECENT),
        })),

      addStroke: (stroke) =>
        set((s) => ({
          strokes: [...s.strokes, stroke],
          undoStack: pushHistory(s.undoStack, { type: 'add', stroke }),
          redoStack: [],
        })),

      undo: () => {
        const { undoStack, strokes, redoStack } = get();
        const entry = undoStack[undoStack.length - 1];
        if (!entry) return;
        set({
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, entry],
          strokes: entry.type === 'add' ? strokes.filter((s) => s.id !== entry.stroke.id) : entry.strokes,
        });
      },

      redo: () => {
        const { undoStack, strokes, redoStack } = get();
        const entry = redoStack[redoStack.length - 1];
        if (!entry) return;
        set({
          redoStack: redoStack.slice(0, -1),
          undoStack: [...undoStack, entry],
          strokes: entry.type === 'add' ? [...strokes, entry.stroke] : [],
        });
      },

      // Clearing is undoable, so it never needs a confirmation dialog.
      clear: () => {
        const { strokes, undoStack } = get();
        if (strokes.length === 0) return;
        set({ strokes: [], undoStack: pushHistory(undoStack, { type: 'clear', strokes }), redoStack: [] });
      },

      set: (patch) => set(patch),
    }),
    {
      name: 'sgx-graffiti',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        brush: s.brush,
        strokes: s.strokes,
        recentColors: s.recentColors,
        lang: s.lang,
        gesture: s.gesture,
        depthEnabled: s.depthEnabled,
        backdrop: s.backdrop,
        glow: s.glow,
        showCamera: s.showCamera,
        onboarded: s.onboarded,
      }),
    },
  ),
);
