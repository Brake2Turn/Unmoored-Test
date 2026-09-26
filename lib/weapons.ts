/**
 * The weapons a ship can carry.
 *
 * Placeholders: three generic entries so that a weapon can exist, be drawn on
 * the ship's nose, and be moved in and out of the hold. Nothing fires yet —
 * there is no combat — so a weapon is only a name and a shape for now. The
 * shape lives in `components/WeaponArt.tsx`, keyed by `id`, the same way the
 * ship art is keyed off `lib/ships.ts`.
 *
 * Imports nothing, so the verify scripts can read it under bare node.
 */
export type Weapon = {
  id: string;
  name: string;
};

export const WEAPONS: Weapon[] = [
  { id: 'weapon1', name: 'WEAPON 1' },
  { id: 'weapon2', name: 'WEAPON 2' },
  { id: 'weapon3', name: 'WEAPON 3' },
];

/** Null for an id the table no longer carries, so a stale save drops it. */
export function weaponById(id: unknown): Weapon | null {
  return WEAPONS.find((weapon) => weapon.id === id) ?? null;
}
