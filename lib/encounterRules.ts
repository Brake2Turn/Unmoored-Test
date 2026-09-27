import type { EnergyState } from './energy.ts';
import type { Encounter } from './sectorMap.ts';

/**
 * What each kind of star *is*, as far as the rules are concerned: what its
 * ship is called, whether it fights, and how much hull it has.
 *
 * Kept apart from how each kind looks (`ENCOUNTER_STYLE` in `encounters.ts`,
 * which spreads this in and adds colour and size) because the look needs the
 * theme, and the theme needs React Native — which the verify scripts, running
 * the rules under bare node, cannot load. Imports nothing else, like the other
 * rule leaves.
 */
export const ENCOUNTER_RULES: Record<
  Encounter,
  {
    label: string;
    /** Shoots back, and holds the drive for the long charge. */
    hostile: boolean;
    /**
     * Plates on the ship waiting here, which each hit from the player's weapon
     * takes one of; at zero it is destroyed. Placeholder numbers.
     */
    hull: number;
    /**
     * The bars in each of its three subsystems — the same three the player
     * has, run by the same rules. It has no reactor to move them with, so this
     * is fixed, less whatever hits destroy (`foeSystems` in `run.ts`).
     *
     * - **weapons** set how fast its gun charges;
     * - **engines** are its Wren Drive: each bar makes the player's shots 10%
     *   likelier to miss it;
     * - **shields** soak the player's shots exactly as the player's own do.
     *
     * Every shield here is **zero, on purpose**. A shield layer rebuilds in
     * five seconds and the player's one weapon fires every seven to nine, so
     * a ship with even one powered shield bar can never be hurt. The system is
     * there, drawn and targetable; power it once the player can outgun it.
     * Placeholder numbers.
     */
    systems: EnergyState;
  }
> = {
  empty: { label: 'EMPTY', hostile: false, hull: 0, systems: { shields: 0, weapons: 0, engines: 0 } },
  enemy: { label: 'SHRIKE', hostile: true, hull: 6, systems: { shields: 0, weapons: 2, engines: 2 } },
  merchant: { label: 'MERCHANT', hostile: false, hull: 4, systems: { shields: 0, weapons: 2, engines: 1 } },
  boss: { label: 'ELDER SHRIKE', hostile: true, hull: 12, systems: { shields: 0, weapons: 2, engines: 3 } },
};
