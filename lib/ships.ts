/**
 * The ships a player can launch a run in.
 *
 * Each entry is pure data — the drawing lives in `components/ships/ShipArt.tsx`,
 * keyed by `id`. Adding a ship means adding an entry here and a case there.
 *
 * Three ships, one per weapon. There were six; the other three (Halo, Mantis,
 * Vesper) were cut to keep the roster small while weapons are worked out. A
 * save launched in one of them loads as the first ship instead.
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
   * The weapon on the hardpoint at launch, by id in `lib/weapons.ts`. Once the
   * run starts it can be moved into the hold and back; this is only where it
   * begins.
   */
  weapon: string;
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
    cargo: 0.6,
    reactor: 6,
    weapon: 'weapon1',
  },
  {
    id: 'lance',
    name: 'LANCE',
    className: 'INTERCEPTOR',
    tagline: 'Outrun the dark. Nothing spare aboard.',
    cargo: 0.2,
    reactor: 5,
    weapon: 'weapon2',
  },
  {
    id: 'bulwark',
    name: 'BULWARK',
    className: 'HEAVY HAULER',
    tagline: 'Carries everything. Hurries for nothing.',
    cargo: 1.0,
    reactor: 7,
    weapon: 'weapon3',
    unlockHint: 'REACH SECTOR 5',
  },
];

export const DEFAULT_SHIP_ID = SHIPS[0].id;

/** Ships available before the player has earned anything. */
export const STARTER_SHIP_IDS = SHIPS.filter((ship) => !ship.unlockHint).map((ship) => ship.id);

/** Falls back to the first ship, so an older save with no ship still opens. */
export function shipById(id: string | undefined): Ship {
  return SHIPS.find((ship) => ship.id === id) ?? SHIPS[0];
}
