import AsyncStorage from '@react-native-async-storage/async-storage';

import { SHIPS, STARTER_SHIP_IDS } from '@/lib/ships';

const KEY = 'unmoored.unlockedShips';

/**
 * Which ships the player has earned.
 *
 * Nothing calls `unlockShip` yet — nothing in a run earns a ship so far. It
 * is here so that when something does, awarding a ship is one call and the
 * rest of the app already reacts.
 */
export async function loadUnlocked(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [...STARTER_SHIP_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...STARTER_SHIP_IDS];
    // Keep only ids that still exist, and always include the starters.
    const known = new Set(SHIPS.map((ship) => ship.id));
    const merged = new Set([...STARTER_SHIP_IDS, ...parsed.filter((id) => known.has(id))]);
    return [...merged];
  } catch {
    return [...STARTER_SHIP_IDS];
  }
}

/** Returns the full unlocked list after awarding `shipId`. */
export async function unlockShip(shipId: string): Promise<string[]> {
  const current = await loadUnlocked();
  if (current.includes(shipId)) return current;

  const next = [...current, shipId];
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The award is lost on a write failure, but the app keeps running.
  }
  return next;
}

/**
 * Unlocks every ship at once, for Unlock All Ships in Settings (dev mode).
 *
 * There is no unlock trigger in the game yet, so the locked ships are
 * otherwise unreachable and untestable. It writes through the same store as an
 * earned ship rather than holding a flag of its own, which means Reset Progress
 * in Settings clears it exactly like anything else the player earned — no
 * second thing to remember to reset.
 */
export async function unlockAll(): Promise<string[]> {
  const every = SHIPS.map((ship) => ship.id);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(every));
  } catch {
    // The unlock is lost on a write failure, but the app keeps running.
  }
  return every;
}

/** Wipes earned ships back to the starters. Used by Reset Progress. */
export async function resetUnlocks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore — callers re-read either way.
  }
}
