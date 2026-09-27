import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRun, hydrateRun, type RunState } from '@/lib/run';
import { DEFAULT_SHIP_ID } from '@/lib/ships';

/**
 * Where the run in progress is kept between sessions: saving it, loading it,
 * and throwing it away. The rules of a run live in `run.ts`.
 */

const KEY = 'unmoored.currentRun';

/**
 * Cached so the sector screen and the helm do not each pay a round trip to
 * AsyncStorage for a value one of them just wrote. `undefined` means "not read
 * yet"; `null` means "read, and there is no run".
 */
let cached: RunState | null | undefined;

/**
 * The only way to get a run. Reads once, checks what it finds (`hydrateRun`),
 * and writes the checked shape straight back, so every screen sees the same
 * run. A save from an older game is not a run any more: it is cleared, and the
 * start screen offers no run to continue.
 */
export async function loadRun(): Promise<RunState | null> {
  if (cached !== undefined) return cached;

  try {
    const raw = await AsyncStorage.getItem(KEY);
    const run = raw ? hydrateRun(JSON.parse(raw)) : null;
    if (!run) {
      if (raw) await clearRun();
      cached = null;
      return null;
    }
    cached = run;
    await saveRun(run);
    return run;
  } catch {
    cached = null;
    return null;
  }
}

export async function saveRun(run: RunState): Promise<void> {
  const next = { ...run, lastPlayedAt: Date.now() };
  cached = next;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
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
  cached = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore — the caller re-reads state either way.
  }
}
