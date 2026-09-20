import { palette } from '@/lib/theme';

/**
 * The ships a player can launch a run in.
 *
 * Each entry is pure data — the drawing lives in `components/ships/ShipArt.tsx`,
 * keyed by `id`. Adding a ship means adding an entry here and a case there.
 *
 * A ship with an `unlockHint` starts locked: it still appears in the carousel,
 * because seeing what is coming is half the reason to keep playing, but it
 * cannot be launched until `lib/unlocks.ts` says otherwise.
 */
export type Ship = {
  id: string;
  name: string;
  /** Short role label shown above the name. */
  className: string;
  tagline: string;
  /** Tints this ship's glow, its stat bars and the launch button. */
  accent: string;
  /**
   * Hold space, 0–1, drawn as a five-segment bar.
   *
   * The one thing that still varies ship to ship without being energy. Hull
   * and speed used to sit beside it; they are gone, folded into what the
   * reactor can power.
   */
  cargo: number;
  /**
   * Bars of reactor output, the pool the helm panel spreads across shields,
   * weapons and engines.
   *
   * Always short of `TOTAL_CAPACITY` (12) — a ship that could run everything
   * at once would have nothing to decide. `npm run verify:energy` fails if one
   * ever creeps up to it.
   */
  reactor: number;
  /**
   * What the player has to do to earn this ship. Present means locked by
   * default; absent means available from the first launch.
   */
  unlockHint?: string;
};

export const SHIPS: Ship[] = [
  {
    id: 'drifter',
    name: 'DRIFTER',
    className: 'SURVEY CUTTER',
    tagline: 'Slow, stubborn, and built to come home.',
    accent: palette.accent,
    cargo: 0.6,
    reactor: 6,
  },
  {
    id: 'lance',
    name: 'LANCE',
    className: 'INTERCEPTOR',
    tagline: 'Outrun the dark. Nothing spare aboard.',
    accent: '#E8A85F',
    cargo: 0.2,
    reactor: 5,
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    className: 'HEAVY HAULER',
    tagline: 'Carries everything. Hurries for nothing.',
    accent: '#9B7FE8',
    cargo: 1.0,
    reactor: 7,
    unlockHint: 'REACH SECTOR 5',
  },
  {
    id: 'halo',
    name: 'HALO',
    className: 'RING TENDER',
    tagline: 'Built around a hole. Holds what others cannot.',
    accent: '#7FE8C4',
    cargo: 0.9,
    reactor: 6,
    unlockHint: 'REACH SECTOR 10',
  },
  {
    id: 'mantis',
    name: 'MANTIS',
    className: 'SALVAGE CRAFT',
    tagline: 'Takes what it needs from whatever it finds.',
    accent: '#E8637F',
    cargo: 0.3,
    reactor: 7,
    unlockHint: 'SURVIVE A HULL BREACH',
  },
  {
    id: 'vesper',
    name: 'VESPER',
    className: 'SAIL CLIPPER',
    tagline: 'Rides the solar wind. Nothing else to give.',
    accent: '#6E8FE8',
    cargo: 0.5,
    reactor: 4,
    unlockHint: 'FINISH A RUN UNDER 10:00',
  },
];

export const DEFAULT_SHIP_ID = SHIPS[0].id;

/** Ships available before the player has earned anything. */
export const STARTER_SHIP_IDS = SHIPS.filter((ship) => !ship.unlockHint).map((ship) => ship.id);

/** Falls back to the first ship, so an older save with no ship still opens. */
export function shipById(id: string | undefined): Ship {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}
