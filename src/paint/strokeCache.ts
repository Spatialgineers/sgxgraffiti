import { SprayBuilder, type BuiltSpray } from './sprayBuilder';
import type { Stroke } from './types';

/**
 * Built particle data per stroke id. The live stroke hands over its data on
 * release, so committing never regenerates anything; saved strokes are
 * rebuilt once on load.
 */
const cache = new Map<string, BuiltSpray>();

export function rememberBuilt(id: string, built: BuiltSpray): void {
  cache.set(id, built);
}

export function getBuilt(stroke: Stroke): BuiltSpray {
  let built = cache.get(stroke.id);
  if (!built) {
    built = SprayBuilder.fromStroke(stroke).finalize();
    cache.set(stroke.id, built);
  }
  return built;
}

/** Drop data for strokes that can no longer come back (not drawn, not redoable). */
export function pruneBuilt(liveIds: Set<string>): void {
  for (const id of cache.keys()) if (!liveIds.has(id)) cache.delete(id);
}
