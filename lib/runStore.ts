import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SHIP_ID } from '@/lib/ships';
import { FUEL_PER_RUN, generateMap, type SectorMap } from '@/lib/sectorMap';

const KEY = 'unmoored.currentRun';

/**
 * A single in-progress run. Deliberately small for now — it exists so the start
 * screen has something real to save, resume and describe. Gameplay fields get
 * added here as the game itself grows.
 */
export type RunState = {
  id: string;
  startedAt: number;
  lastPlayedAt: number;
  /** How far the ship has drifted. Doubles as the run's headline progress. */
  sector: number;
  /** Seconds of play accumulated across all sessions of this run. */
  elapsed: number;
  hullIntegrity: number;
  /** Which ship this run launched in. Absent on saves from before ship select. */
  shipId?: string;
  /** The jump map, rolled once when the run is created. */
  map?: SectorMap;
  /** Index of the node the ship is currently sitting on. */
  position?: number;
  /** Distinct nodes stood on, oldest first. Revisiting one does not re-add it. */
  visited?: number[];
  /** Jumps made, counting a hop back to a star already visited. */
  jumps?: number;
  /** Jumps left in the tank. Each jump costs one, wherever it goes. */
  fuel?: number;
};

function createRun(shipId: string): RunState {
  const now = Date.now();
  const map = generateMap();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    lastPlayedAt: now,
    sector: 1,
    elapsed: 0,
    hullIntegrity: 1,
    shipId,
    map,
    position: map.start,
    visited: [map.start],
    jumps: 0,
    fuel: FUEL_PER_RUN,
  };
}

export async function loadRun(): Promise<RunState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    // Guard against a half-written or older save shape.
    if (typeof parsed?.sector !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveRun(run: RunState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...run, lastPlayedAt: Date.now() }));
  } catch {
    // A failed save should never take the screen down with it.
  }
}

export async function startNewRun(shipId: string = DEFAULT_SHIP_ID): Promise<RunState> {
  const run = createRun(shipId);
  await saveRun(run);
  return run;
}

export async function clearRun(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore — the caller re-reads state either way.
  }
}

/**
 * Fills in anything a save predates — a jump map, a position, a tank of fuel —
 * so an older run opens instead of being thrown away.
 */
export function hydrateRun(run: RunState): RunState {
  const complete =
    run.map &&
    typeof run.position === 'number' &&
    run.visited?.length &&
    typeof run.fuel === 'number' &&
    run.fuel <= FUEL_PER_RUN &&
    typeof run.jumps === 'number';
  if (complete) return run;

  const map = run.map ?? generateMap();
  const position = typeof run.position === 'number' ? run.position : map.start;
  // Older saves appended a duplicate on every backtrack; collapse them.
  const visited = run.visited?.length ? [...new Set(run.visited)] : [position];
  const jumps = typeof run.jumps === 'number' ? run.jumps : Math.max((run.visited?.length ?? 1) - 1, 0);

  return {
    ...run,
    map,
    position,
    visited,
    jumps,
    // Clamped, so a save made when tanks were bigger cannot hold more fuel
    // than the badge is able to show.
    fuel:
      typeof run.fuel === 'number'
        ? Math.min(run.fuel, FUEL_PER_RUN)
        : Math.max(FUEL_PER_RUN - jumps, 0),
  };
}

/** One-line description shown under Continue Run, e.g. "SECTOR 3 · 12:40 · HULL 84%". */
export function summarize(run: RunState): string {
  const minutes = Math.floor(run.elapsed / 60);
  const seconds = Math.floor(run.elapsed % 60);
  const clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `SECTOR ${run.sector} · ${clock} · HULL ${Math.round(run.hullIntegrity * 100)}%`;
}
