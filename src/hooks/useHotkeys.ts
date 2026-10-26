import { useEffect } from 'react';
import { CAP_IDS } from '../paint/caps';
import { clearAction, snapshotAction } from '../lib/actions';
import { useApp } from '../state/store';

const SIZE_MIN = 0.05;
const SIZE_MAX = 1.2;

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const app = useApp.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (key === 'z' && (mod || !e.altKey)) {
        e.preventDefault();
        if (e.shiftKey) app.redo();
        else app.undo();
        return;
      }
      if (key === 'y' && mod) {
        e.preventDefault();
        app.redo();
        return;
      }
      if (mod) return;

      switch (key) {
        case '1':
        case '2':
        case '3':
          app.setCap(CAP_IDS[Number(key) - 1]);
          break;
        case '[':
          app.setBrush({ size: Math.max(SIZE_MIN, +(app.brush.size * 0.85).toFixed(3)) });
          break;
        case ']':
          app.setBrush({ size: Math.min(SIZE_MAX, +(app.brush.size * 1.15).toFixed(3)) });
          break;
        case 's':
          void snapshotAction();
          break;
        case 'h':
          app.set({ uiHidden: !app.uiHidden });
          break;
        case 'b':
          app.set({ tool: 'paint' });
          break;
        case 'v':
          app.set({ tool: 'orbit' });
          break;
        case 'delete':
        case 'backspace':
          clearAction();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
