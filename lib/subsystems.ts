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

/**
 * How a button driven by a subsystem's charge looks: its bright colour when
 * ready, and a dark version of the same colour while it is still charging.
 *
 * FIRE is the weapons row's button and JUMP the engines row's, so each takes
 * its row's colour — the button lighting up is the row's charge arriving.
 */
export type ButtonTone = {
  bright: string;
  /** Near-black ink for a label on the bright fill. */
  ink: string;
  dark: { fill: string; border: string; label: string };
};

export const BUTTON_TONE: Record<'weapons' | 'engines', ButtonTone> = {
  weapons: {
    bright: palette.weapons,
    ink: '#1A0507',
    dark: { fill: '#3A1216', border: '#6E1F26', label: '#A14A52' },
  },
  engines: {
    bright: palette.engines,
    ink: '#1C0E03',
    dark: { fill: '#3A2210', border: '#72421A', label: '#B07A45' },
  },
};
