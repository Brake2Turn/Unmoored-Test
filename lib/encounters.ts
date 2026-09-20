import { palette } from '@/lib/theme';
import type { Encounter } from '@/lib/sectorMap';

/**
 * How each kind of star presents itself.
 *
 * One table, because "the boss is red, larger and labelled BOSS" was
 * previously spelled out separately in the sector map, the helm and the ship
 * art — three places to find when a fourth encounter type arrives.
 */
export const ENCOUNTER_STYLE: Record<
  Encounter,
  { label: string; accent: string; hostile: boolean; width: number; height: number }
> = {
  empty: { label: 'EMPTY', accent: palette.textPrimary, hostile: false, width: 0, height: 0 },
  enemy: { label: 'SHRIKE', accent: palette.danger, hostile: true, width: 132, height: 172 },
  merchant: { label: 'MERCHANT', accent: palette.trade, hostile: false, width: 132, height: 172 },
  boss: { label: 'ELDER SHRIKE', accent: palette.danger, hostile: true, width: 188, height: 244 },
};
