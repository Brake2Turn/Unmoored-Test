import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clampEnergy,
  defaultEnergy,
  shift,
  type EnergyState,
  type Subsystem,
} from '@/lib/energy';
import { DEFAULT_SHIP_ID, shipById } from '@/lib/ships';
import {
  FUEL_PER_RUN,
  assignEncounters,
  generateMap,
  hasEncounters,
  type SectorMap,
} from '@/lib/sectorMap';

const KEY = 'unmoored.currentRun';

/**
 * A run as it exists in memory: every gameplay field present.
 *
 * Nothing outside this file constructs one. `loadRun` is the only way to get
 * hold of a run, and it hydrates before handing it over, so screens can read
 * `run.fuel` and `run.map` without defending against absence.
 */
export type RunState = {
  id: string;
  startedAt: number;
  lastPlayedAt: number;
  /** Which ship this run launched in. */
  shipId: string;
  /** The jump map, rolled once when the run is created. */
  map: SectorMap;
  /** Index of the node the ship is currently sitting on. */
  position: number;
  /** Distinct nodes stood on, oldest first. Revisiting one does not re-add it. */
  visited: number[];
  /** Jumps made, counting a hop back to a star already visited. */
  jumps: number;
  /** Jumps left in the tank. Each jump costs one, wherever it goes. */
  fuel: number;
  /**
   * How the reactor is currently spread across the subsystems. Part of the
   * run, so a reload comes back to the same allocation.
   */
  energy: EnergyState;
};

/**
 * A run as it comes off disk. Every field is suspect: saves written by earlier
 * versions are missing whole features, and `sector` is a field this game no
 * longer keeps (it is `jumps + 1`).
 */
type StoredRun = Partial<RunState> & { sector?: number };

/** Which sector the run is in. Derived, so it cannot drift out of step. */
export function sectorOf(run: RunState): number {
  return run.jumps + 1;
}

/**
 * Reactor output for the ship this run launched in.
 *
 * Derived from the ship rather than copied into the run, so retuning a ship's
 * reactor takes effect on the next load instead of leaving old saves on the
 * old number.
 */
export function reactorOf(run: RunState): number {
  return shipById(run.shipId).reactor;
}

/**
 * Cached so the sector screen and the helm do not each pay a round trip to
 * AsyncStorage for a value one of them just wrote. `undefined` means "not read
 * yet"; `null` means "read, and there is no run".
 */
let cached: RunState | null | undefined;

function createRun(shipId: string): RunState {
  const now = Date.now();
  const map = generateMap();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    lastPlayedAt: now,
    shipId,
    map,
    position: map.start,
    visited: [map.start],
    jumps: 0,
    fuel: FUEL_PER_RUN,
    energy: defaultEnergy(shipById(shipId).reactor),
  };
}

/**
 * The only way to get a run. Reads once, hydrates whatever it finds, and
 * writes the hydrated shape straight back so the migration happens exactly
 * once rather than differently on each screen.
 */
export async function loadRun(): Promise<RunState | null> {
  if (cached !== undefined) return cached;

  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      cached = null;
      return null;
    }

    const parsed = JSON.parse(raw) as StoredRun;
    // A run has always had an id; anything without one is a half-written save.
    if (typeof parsed?.id !== 'string') {
      cached = null;
      return null;
    }

    const hydrated = hydrate(parsed);
    cached = hydrated;
    // Hydration rolls fresh maps for very old saves, so persist it or the next
    // load would roll a different one.
    await saveRun(hydrated);
    return hydrated;
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

/**
 * Spends a jump.
 *
 * The rule lives here rather than in the screen that draws the button, so the
 * cost of a jump is defined once. Fuel comes off wherever the jump goes — a
 * hop back to a star already visited costs the same as a new one.
 */
export function applyJump(run: RunState, target: number): RunState {
  return {
    ...run,
    position: target,
    visited: run.visited.includes(target) ? run.visited : [...run.visited, target],
    jumps: run.jumps + 1,
    fuel: Math.max(run.fuel - 1, 0),
  };
}

/**
 * Moves one bar of reactor energy into or out of a subsystem.
 *
 * The rule lives here, beside `applyJump`, rather than in the panel that draws
 * the buttons: what counts as a legal move is a property of the run, not of
 * one screen's controls. An illegal move — no spare energy, a full subsystem,
 * an empty one — returns the run unchanged *by identity*, which is how the
 * caller knows to skip the save and the haptic.
 */
export function shiftEnergy(run: RunState, subsystem: Subsystem, delta: number): RunState {
  const energy = shift(run.energy, reactorOf(run), subsystem, delta);
  return energy === run.energy ? run : { ...run, energy };
}

/**
 * Fills in anything a save predates — a ship, a jump map, a tank of fuel — so
 * an older run opens instead of being thrown away.
 *
 * Kept private: `loadRun` is the only caller, which is what makes `RunState`
 * safe to declare fully required.
 */
function hydrate(stored: StoredRun): RunState {
  const map = stored.map ?? generateMap();
  // A map saved before encounters existed gets them rolled in place, so an
  // in-progress run keeps its layout and its history.
  if (!hasEncounters(map)) assignEncounters(map);

  const position = typeof stored.position === 'number' ? stored.position : map.start;
  // Older saves appended a duplicate on every backtrack; collapse them.
  const visited = stored.visited?.length ? [...new Set(stored.visited)] : [position];
  const jumps =
    typeof stored.jumps === 'number' ? stored.jumps : Math.max(visited.length - 1, 0);

  const now = Date.now();
  const shipId = stored.shipId ?? DEFAULT_SHIP_ID;
  return {
    id: stored.id ?? `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: stored.startedAt ?? now,
    lastPlayedAt: stored.lastPlayedAt ?? now,
    shipId,
    map,
    position,
    visited,
    jumps,
    // Clamped unconditionally: a save made when tanks were bigger must not
    // hold more fuel than the badge can show.
    fuel: Math.min(
      typeof stored.fuel === 'number' ? stored.fuel : Math.max(FUEL_PER_RUN - jumps, 0),
      FUEL_PER_RUN,
    ),
    // Saves predate the reactor entirely, and a ship's output can be retuned
    // under a run in progress, so the stored allocation is forced back into
    // something this ship can actually power rather than trusted.
    energy: clampEnergy(stored.energy, shipById(shipId).reactor),
  };
}

/**
 * One-line description shown under Continue Run, e.g. "SECTOR 4 · 7 FUEL".
 *
 * Both halves are live: the sector is derived from jumps made, and the fuel is
 * what is actually left in the tank.
 */
export function summarize(run: RunState): string {
  return `SECTOR ${sectorOf(run)} · ${run.fuel} FUEL`;
}
