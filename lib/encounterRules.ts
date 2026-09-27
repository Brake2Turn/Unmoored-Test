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
     * Bars in its Wren Drive, which it has no reactor to move: how hard it
     * sways in a fight, and so how often the player's shots miss it (see
     * `missChance`). Placeholder numbers.
     */
    wren: number;
  }
> = {
  empty: { label: 'EMPTY', hostile: false, hull: 0, wren: 0 },
  enemy: { label: 'SHRIKE', hostile: true, hull: 6, wren: 2 },
  merchant: { label: 'MERCHANT', hostile: false, hull: 4, wren: 1 },
  boss: { label: 'ELDER SHRIKE', hostile: true, hull: 12, wren: 3 },
};
