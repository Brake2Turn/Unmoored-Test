/**
 * The plating, and what is left of it.
 *
 * Separate from the reactor: hull is not something the player allocates, it is
 * what is left after everything else has failed to stop a hit. The shields
 * soak what they can and the hull takes the rest — that rule lives in
 * `runStore.takeHit`, which is the only thing that should be reducing this.
 *
 * This file imports nothing, for the same reason `energy.ts` and `sectorMap.ts`
 * import nothing: pure rules run under bare node in the verify script.
 */

/** Plates a ship starts with. Every ship gets the same for now. */
export const HULL_MAX = 8;

/** One plate gone, and never past nothing. */
export function damagedHull(hull: number): number {
  if (!Number.isFinite(hull)) return 0;
  return Math.max(0, Math.floor(hull) - 1);
}

/** A ship with no plating left. Nothing reads this yet — there is no run end. */
export function isWrecked(hull: number): boolean {
  return !(hull > 0);
}
