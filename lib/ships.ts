/**
 * The ships a player can launch a run in.
 *
 * Each entry is pure data — the drawing lives in `components/ships/ShipArt.tsx`,
 * keyed by `id`. Adding a ship means adding an entry here and a case there.
 */
export type ShipStats = {
  /** All three are 0–1 and render as five-segment bars. */
  hull: number;
  speed: number;
  cargo: number;
};

export type Ship = {
  id: string;
  name: string;
  /** Short role label shown above the name. */
  className: string;
  tagline: string;
  /** Tints this ship's glow, its stat bars and the launch button. */
  accent: string;
  stats: ShipStats;
};

export const SHIPS: Ship[] = [
  {
    id: 'drifter',
    name: 'DRIFTER',
    className: 'SURVEY CUTTER',
    tagline: 'Slow, stubborn, and built to come home.',
    accent: '#5FD9E8',
    stats: { hull: 0.8, speed: 0.4, cargo: 0.6 },
  },
  {
    id: 'lance',
    name: 'LANCE',
    className: 'INTERCEPTOR',
    tagline: 'Outrun the dark. Nothing spare aboard.',
    accent: '#E8A85F',
    stats: { hull: 0.4, speed: 1.0, cargo: 0.2 },
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    className: 'HEAVY HAULER',
    tagline: 'Carries everything. Hurries for nothing.',
    accent: '#9B7FE8',
    stats: { hull: 1.0, speed: 0.2, cargo: 1.0 },
  },
];

export const DEFAULT_SHIP_ID = SHIPS[0].id;

/** Falls back to the first ship, so an older save with no ship still opens. */
export function shipById(id: string | undefined): Ship {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}
