import { beforeEach, describe, expect, it } from 'vitest';
import type { Stroke } from '../paint/types';
import { DEFAULT_BRUSH, useApp } from './store';

const s = (id: string): Stroke => ({ id, seed: 1, brush: DEFAULT_BRUSH, normal: [0, 0, 1], samples: [0, 0, 0, 0] });

describe('history', () => {
  beforeEach(() => useApp.setState({ strokes: [], undoStack: [], redoStack: [] }));

  it('undoes and redoes strokes', () => {
    const app = useApp.getState();
    app.addStroke(s('a'));
    app.addStroke(s('b'));
    app.undo();
    expect(useApp.getState().strokes.map((x) => x.id)).toEqual(['a']);
    useApp.getState().redo();
    expect(useApp.getState().strokes.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('makes clear undoable', () => {
    useApp.getState().addStroke(s('a'));
    useApp.getState().clear();
    expect(useApp.getState().strokes).toEqual([]);
    useApp.getState().undo();
    expect(useApp.getState().strokes.map((x) => x.id)).toEqual(['a']);
  });

  it('drops the redo stack on a new stroke', () => {
    useApp.getState().addStroke(s('a'));
    useApp.getState().undo();
    useApp.getState().addStroke(s('b'));
    expect(useApp.getState().redoStack).toEqual([]);
  });
});
