import { palette } from '@/lib/theme';
import { ENCOUNTER_RULES } from '@/lib/encounterRules';
import type { Encounter } from '@/lib/sectorMap';

/**
 * How each kind of star presents itself: its rules (`ENCOUNTER_RULES` — name,
 * whether it fights, its hull) plus its colour and the size its ship is drawn.
 *
 * One table, because "the boss is red, larger and labelled ELDER SHRIKE" was
 * previously spelled out separately in the sector map, the helm and the ship
 * art — three places to find when a fourth encounter type arrives.
 */
export const ENCOUNTER_STYLE: Record<
  Encounter,
  (typeof ENCOUNTER_RULES)[Encounter] & { accent: string; width: number; height: number }
> = {
  empty: { ...ENCOUNTER_RULES.empty, accent: palette.textPrimary, width: 0, height: 0 },
  enemy: { ...ENCOUNTER_RULES.enemy, accent: palette.danger, width: 132, height: 172 },
  merchant: { ...ENCOUNTER_RULES.merchant, accent: palette.trade, width: 132, height: 172 },
  boss: { ...ENCOUNTER_RULES.boss, accent: palette.danger, width: 188, height: 244 },
};
