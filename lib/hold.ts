/**
 * What the ship carries: cargo space and crew berths.
 *
 * Neither holds anything yet — there is no trade and no crew roster — so this
 * is only the shape of the room they take up. When something does fill them,
 * it fills these slots.
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
 */
export function cargoSlots(cargo: number): number {
  if (!Number.isFinite(cargo)) return 1;
  const scaled = Math.round(Math.max(0, Math.min(1, cargo)) * CARGO_SLOTS_MAX);
  return Math.max(1, Math.min(CARGO_SLOTS_MAX, scaled));
}
