import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SHIP_ID } from '@/lib/ships';

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
};

function createRun(shipId: string): RunState {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    lastPlayedAt: now,
    sector: 1,
    elapsed: 0,
    hullIntegrity: 1,
    shipId,
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

/** One-line description shown under Continue Run, e.g. "SECTOR 3 · 12:40 · HULL 84%". */
export function summarize(run: RunState): string {
  const minutes = Math.floor(run.elapsed / 60);
  const seconds = Math.floor(run.elapsed % 60);
  const clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `SECTOR ${run.sector} · ${clock} · HULL ${Math.round(run.hullIntegrity * 100)}%`;
}
