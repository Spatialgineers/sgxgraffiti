import { getT } from '../i18n';
import { useApp } from '../state/store';
import { useToasts } from '../ui/toast';
import { saveSnapshot } from './snapshot';

export async function snapshotAction(): Promise<void> {
  if (await saveSnapshot()) useToasts.getState().push({ message: getT().savedSnapshot });
}

export function clearAction(): void {
  const app = useApp.getState();
  if (app.strokes.length === 0) return;
  app.clear();
  const t = getT();
  useToasts.getState().push({ message: t.cleared, action: { label: t.undo, run: () => useApp.getState().undo() } });
}
