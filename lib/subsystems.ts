import { palette } from '@/lib/theme';
import type { Subsystem } from '@/lib/energy';

/**
 * How each subsystem presents itself.
 *
 * One table, for the same reason `ENCOUNTER_STYLE` is one table: the label and
 * the tint were otherwise going to be spelled out once in the helm panel and
 * again in anything that reports on power later.
 */
export const SUBSYSTEM_STYLE: Record<Subsystem, { label: string; accent: string }> = {
  shields: { label: 'SHIELDS', accent: palette.shields },
  weapons: { label: 'WEAPONS', accent: palette.weapons },
  engines: { label: 'ENGINES', accent: palette.engines },
};
