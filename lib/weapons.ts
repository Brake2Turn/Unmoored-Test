/**
 * The weapons a ship can carry.
 *
 * Placeholders: three generic entries, each only a name, a line of
 * description and a shape. They all fire the same way for now — one bolt per
 * full charge (`WEAPON_UNITS`) — so the difference between them is only how
 * they look. The shape lives in `components/WeaponArt.tsx`, keyed by `id`, the
 * same way the ship art is keyed off `lib/ships.ts`.
 *
 * Imports nothing, so the verify scripts can read it under bare node.
 */
export type Weapon = {
  id: string;
  name: string;
  /** One line for the pop-up in the ship panel. Placeholder, like the rest. */
  description: string;
  /**
   * Bars a hit takes off the subsystem it was aimed at. Every weapon does one
   * for now; this is where a heavier one would say otherwise.
   */
  damage: number;
};

export const WEAPONS: Weapon[] = [
  { id: 'weapon1', name: 'WEAPON 1', description: 'A single long barrel. One bolt per full charge.', damage: 1 },
  { id: 'weapon2', name: 'WEAPON 2', description: 'Twin barrels on a wide mount. One bolt per full charge.', damage: 1 },
  { id: 'weapon3', name: 'WEAPON 3', description: 'A spiked emitter on a round turret. One bolt per full charge.', damage: 1 },
];

/** Null for an id the table no longer carries, so a stale save drops it. */
export function weaponById(id: unknown): Weapon | null {
  return WEAPONS.find((weapon) => weapon.id === id) ?? null;
}
