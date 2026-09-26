/**
 * What the ship carries: the weapon on its hardpoint, cargo space and crew
 * berths.
 *
 * The hold takes weapons and nothing else so far — there is no trade — and the
 * berths take nobody, since there is no crew roster. A cargo slot holds a
 * weapon id or null.
 *
 * Imports nothing, like the other rule leaves, so `verify:energy` can check it.
 */

/** The most any hold can take, which the roomiest ship has all of. */
export const CARGO_SLOTS_MAX = 8;

/** Berths. Fixed for now; ships do not differ on crew yet. */
export const CREW_SLOTS = 3;

/**
 * Slots for a ship's `cargo` stat, which is a 0–1 impression rather than a
 * count. Every ship gets at least one — a hold with no slots at all would be
 * a panel showing nothing, and no ship in the table is meant to be that bare.
 * It also means a weapon can always be taken off.
 */
export function cargoSlots(cargo: number): number {
  if (!Number.isFinite(cargo)) return 1;
  const scaled = Math.round(Math.max(0, Math.min(1, cargo)) * CARGO_SLOTS_MAX);
  return Math.max(1, Math.min(CARGO_SLOTS_MAX, scaled));
}

/** The weapon on the hardpoint, and what is in each cargo slot. */
export type Loadout = {
  mounted: string | null;
  hold: (string | null)[];
};

/** Somewhere a weapon can be: on the hardpoint, or in a cargo slot by index. */
export type Place = 'mount' | number;

/** What is at a place, or null for an empty one or one that does not exist. */
export function itemAt(loadout: Loadout, place: Place): string | null {
  if (place === 'mount') return loadout.mounted;
  return loadout.hold[place] ?? null;
}

function exists(loadout: Loadout, place: Place): boolean {
  return place === 'mount' || (Number.isInteger(place) && place >= 0 && place < loadout.hold.length);
}

/**
 * Moves whatever is at `from` into `to`.
 *
 * Only into an empty place: nothing is ever swapped, dropped or doubled, so a
 * weapon cannot be lost by dragging it somewhere full. An illegal move hands
 * back the same loadout *by identity*, the way `shift` does for energy, so the
 * caller can tell nothing happened and skip the save.
 */
export function moveItem(loadout: Loadout, from: Place, to: Place): Loadout {
  if (from === to || !exists(loadout, from) || !exists(loadout, to)) return loadout;
  const item = itemAt(loadout, from);
  if (item === null || itemAt(loadout, to) !== null) return loadout;

  const hold = [...loadout.hold];
  let mounted = loadout.mounted;
  if (from === 'mount') mounted = null;
  else hold[from] = null;
  if (to === 'mount') mounted = item;
  else hold[to] = item;
  return { mounted, hold };
}

/** The first empty cargo slot, or null when the hold is full. */
export function firstEmptySlot(loadout: Loadout): number | null {
  const index = loadout.hold.indexOf(null);
  return index === -1 ? null : index;
}

/**
 * A stored hold forced into `slots` slots of known weapons.
 *
 * Anything unrecognised becomes an empty slot. If the ship's hold has shrunk
 * since the save, items past the end are moved into whatever empty slots are
 * left rather than silently cut off, and only dropped when there is truly no
 * room.
 */
export function fitHold(
  stored: unknown,
  slots: number,
  known: (id: unknown) => boolean,
): (string | null)[] {
  const items = Array.isArray(stored) ? stored : [];
  const hold: (string | null)[] = Array.from({ length: slots }, (_, i) =>
    known(items[i]) ? (items[i] as string) : null,
  );
  for (const extra of items.slice(slots)) {
    if (!known(extra)) continue;
    const free = hold.indexOf(null);
    if (free === -1) break;
    hold[free] = extra as string;
  }
  return hold;
}
