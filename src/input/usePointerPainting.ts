import { useCallback } from 'react';
import type { PointerEvent } from 'react';
import { useApp } from '../state/store';
import { cursor } from './cursor';

function toNdc(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  cursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  cursor.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
}

/** Mouse / touch / pen painting for the canvas wrapper. Works with or without a camera. */
export function usePointerPainting() {
  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    const { tool } = useApp.getState();
    if (tool !== 'paint' || e.button !== 0 || !e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    toNdc(e);
    cursor.pointerDown = true;
    cursor.visible = true;
    cursor.spraying = true;
    cursor.source = 'pointer';
    cursor.depth = 0;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!e.isPrimary) return;
    const { tool, handVisible } = useApp.getState();
    if (cursor.pointerDown) {
      toNdc(e);
      return;
    }
    // Hover preview of the spray ring, unless a hand is driving the cursor.
    if (tool === 'paint' && !handVisible && e.pointerType === 'mouse') {
      toNdc(e);
      cursor.visible = true;
      cursor.source = 'pointer';
      cursor.depth = 0;
    }
  }, []);

  const end = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!cursor.pointerDown) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    cursor.pointerDown = false;
    cursor.spraying = false;
    if (e.pointerType !== 'mouse') cursor.visible = false;
  }, []);

  const onPointerLeave = useCallback(() => {
    if (cursor.source === 'pointer' && !cursor.pointerDown) cursor.visible = false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onPointerLeave };
}
