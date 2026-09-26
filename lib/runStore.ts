import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  HOSTILE_JUMP_UNITS,
  JUMP_UNITS,
  WEAPON_UNITS,
  chargeRate,
  clampEnergy,
  damagedShield,
  shieldLevel,
  defaultEnergy,
  regenShield,
  shift,
  type EnergyState,
  type Subsystem,
} from '@/lib/energy';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import type { Meeting } from '@/lib/dialogue';
import { HULL_MAX, damagedHull } from '@/lib/hull';
import { cargoSlots, fitHold, moveItem, type Place } from '@/lib/hold';
import { DEFAULT_SHIP_ID, shipById } from '@/lib/ships';
import { weaponById } from '@/lib/weapons';
import {
  FUEL_PER_RUN,
  encounterAt,
  meetingAt,
  generateMap,
  migrateMap,
  type SectorMap,
} from '@/lib/sectorMap';

const KEY = 'unmoored.currentRun';

/**
 * A run as it exists in memory: every gameplay field present.
 *
 * Nothing outside this file constructs one. `loadRun` is the only way to get
 * hold of a run, and it hydrates before handing it over, so screens can read
 * `run.fuel` and `run.map` without defending against absence.
 */
export type RunState = {
  id: string;
  startedAt: number;
  lastPlayedAt: number;
  /** Which ship this run launched in. */
  shipId: string;
  /** The jump map, rolled once when the run is created. */
  map: SectorMap;
  /** Index of the node the ship is currently sitting on. */
  position: number;
  /** Distinct nodes stood on, oldest first. Revisiting one does not re-add it. */
  visited: number[];
  /** Jumps made, counting a hop back to a star already visited. */
  jumps: number;
  /** Jumps left in the tank. Each jump costs one, wherever it goes. */
  fuel: number;
  /**
   * How the reactor is currently spread across the subsystems. Part of the
   * run, so a reload comes back to the same allocation.
   */
  energy: EnergyState;
  /**
   * Units of jump charge built since arriving. The drive is ready once this
   * reaches `jumpUnitsFor(run)`. Counted in units rather than seconds because
   * the engines build it at their own rate — see `chargeRate`.
   */
  jumpCharge: number;
  /**
   * Units of weapon charge built since arriving. Nothing reads it yet; the
   * slider under the weapons row is the whole of it so far.
   */
  weaponCharge: number;
  /**
   * The shield's actual strength, which chases `energy.shields` rather than
   * matching it. A float: the envelope fades up as it charges.
   */
  shieldCharge: number;
  /**
   * Plates left on the hull. Nothing allocates it and nothing repairs it yet;
   * it is simply what is left once the shields have failed to stop something.
   */
  hull: number;
  /**
   * How many hits this shield has taken, only ever counted up.
   *
   * The envelope plays a shimmer when a layer breaks and a shatter when the
   * last one goes, and it has to tell a hit from the player simply pulling the
   * power — both lower the level, but only one is something striking the ship.
   * A counter says "that was a hit" without the drawing having to guess.
   */
  shieldHits: number;
  /**
   * Stars whose dialogue has already played, by node index.
   *
   * An encounter speaks once per run, on arrival. Backing out to the map and
   * returning, or hopping away and coming back, finds the ship already there
   * and says nothing — which is why this records *where* rather than merely
   * counting how many have spoken.
   */
  spoken: number[];
  /**
   * The weapon on the ship's hardpoint, by id, or null once it has been
   * moved into the hold. This is what decides whether a weapon is drawn on
   * the ship's nose.
   */
  mounted: string | null;
  /**
   * The cargo slots, one entry per slot the ship's hold has: a weapon id, or
   * null for an empty slot. Always exactly `cargoSlots(ship.cargo)` long.
   */
  hold: (string | null)[];
};

/**
 * A run as it comes off disk. Every field is suspect: saves written by earlier
 * versions are missing whole features, and `sector` is a field this game no
 * longer keeps (it is `jumps + 1`).
 */
type StoredRun = Partial<RunState> & { sector?: number };

/** Which sector the run is in. Derived, so it cannot drift out of step. */
export function sectorOf(run: RunState): number {
  return run.jumps + 1;
}

/**
 * Bars the engines need before the ship can jump at all.
 *
 * One is enough: this is a gate, not a cost. It exists so the reactor has
 * teeth — energy in the engines is energy not in the shields, and now that
 * trade is a real one.
 */
export const MIN_JUMP_ENGINES = 1;

/** Why a jump cannot happen, or null when it can. */
export type JumpBlock = 'fuel' | 'engines' | 'charging' | null;

/**
 * What is stopping this run from jumping.
 *
 * Both the helm and the sector map ask this rather than each deciding for
 * itself, so the button that offers the jump and the button that performs it
 * can never disagree. Fuel is reported first: an empty tank is the harder
 * stop, since the engines can be powered again in a moment and fuel cannot.
 */
export function jumpBlocker(run: RunState): JumpBlock {
  if (run.fuel <= 0) return 'fuel';
  // Cold engines outrank a part-built charge: with nothing in the engines the
  // charge is not building at all, so that is the thing to say.
  if (run.energy.engines < MIN_JUMP_ENGINES) return 'engines';
  if (run.jumpCharge < jumpUnitsFor(run)) return 'charging';
  return null;
}

/**
 * What the drive has to build before this star will let the ship go.
 *
 * Derived from where the ship is standing rather than stored, so it cannot
 * drift: a hostile star simply costs more, which is what being pinned down by
 * a Shrike now amounts to. The `hostile` flag already lives in
 * `ENCOUNTER_STYLE`, so this is not a second list of which stars mean trouble.
 */
export function jumpUnitsFor(run: RunState): number {
  const here = encounterAt(run.map, run.position);
  return ENCOUNTER_STYLE[here].hostile ? HOSTILE_JUMP_UNITS : JUMP_UNITS;
}

/**
 * Whether the star the ship is on still has something to say.
 *
 * Both halves of the question in one place: there has to *be* an encounter
 * here, and it must not have spoken yet this run.
 */
export function pendingMeeting(run: RunState): Meeting | null {
  if (run.spoken.includes(run.position)) return null;
  const meeting = meetingAt(run.map, run.position);
  // An encounter with no lines has nothing to say. Caught here rather than in
  // the overlay so the box never opens empty — the table is still being
  // written, and a row may well arrive before its dialogue does.
  return meeting && meeting.lines.length > 0 ? meeting : null;
}

/** Records that this star has spoken, so it does not speak again. */
export function markSpoken(run: RunState): RunState {
  if (run.spoken.includes(run.position)) return run;
  return { ...run, spoken: [...run.spoken, run.position] };
}

/** How far each charge has come, 0 to 1, for the sliders on the helm. */
export function chargeFractions(run: RunState): { jump: number; weapon: number } {
  return {
    jump: Math.min(1, run.jumpCharge / jumpUnitsFor(run)),
    weapon: Math.min(1, run.weaponCharge / WEAPON_UNITS),
  };
}

/**
 * Advances everything on a clock: the drive and the weapons build, the shield
 * regenerates.
 *
 * Driven by the helm, which is the only screen that sits still. Returns the
 * same run when nothing has anything left to do, so a caller can stop ticking.
 */
export function tickRun(run: RunState, seconds: number): RunState {
  const jumpCharge = Math.min(
    jumpUnitsFor(run),
    run.jumpCharge + seconds * chargeRate(run.energy.engines),
  );
  const weaponCharge = Math.min(
    WEAPON_UNITS,
    run.weaponCharge + seconds * chargeRate(run.energy.weapons),
  );
  const shieldCharge = regenShield(run.shieldCharge, run.energy.shields, seconds);

  if (
    jumpCharge === run.jumpCharge &&
    weaponCharge === run.weaponCharge &&
    shieldCharge === run.shieldCharge
  ) {
    return run;
  }
  return { ...run, jumpCharge, weaponCharge, shieldCharge };
}

/**
 * Reactor output for the ship this run launched in.
 *
 * Derived from the ship rather than copied into the run, so retuning a ship's
 * reactor takes effect on the next load instead of leaving old saves on the
 * old number.
 */
export function reactorOf(run: RunState): number {
  return shipById(run.shipId).reactor;
}

/**
 * Cached so the sector screen and the helm do not each pay a round trip to
 * AsyncStorage for a value one of them just wrote. `undefined` means "not read
 * yet"; `null` means "read, and there is no run".
 */
let cached: RunState | null | undefined;

function createRun(shipId: string): RunState {
  const now = Date.now();
  const map = generateMap();
  const ship = shipById(shipId);
  const energyAtStart = defaultEnergy(ship.reactor);
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: now,
    lastPlayedAt: now,
    shipId: ship.id,
    map,
    position: map.start,
    visited: [map.start],
    jumps: 0,
    fuel: FUEL_PER_RUN,
    energy: energyAtStart,
    // A run opens with the drive still to build, the same as any arrival.
    jumpCharge: 0,
    weaponCharge: 0,
    hull: HULL_MAX,
    shieldHits: 0,
    spoken: [],
    // A run opens with its shields already up; the charge time is for changes
    // made in flight, not a penalty for launching.
    shieldCharge: energyAtStart.shields,
    // Every ship launches armed, with an empty hold.
    mounted: ship.weapon,
    hold: Array.from({ length: cargoSlots(ship.cargo) }, () => null),
  };
}

/**
 * The only way to get a run. Reads once, hydrates whatever it finds, and
 * writes the hydrated shape straight back so the migration happens exactly
 * once rather than differently on each screen.
 */
export async function loadRun(): Promise<RunState | null> {
  if (cached !== undefined) return cached;

  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      cached = null;
      return null;
    }

    const parsed = JSON.parse(raw) as StoredRun;
    // A run has always had an id; anything without one is a half-written save.
    if (typeof parsed?.id !== 'string') {
      cached = null;
      return null;
    }

    const hydrated = hydrate(parsed);
    cached = hydrated;
    // Hydration rolls fresh maps for very old saves, so persist it or the next
    // load would roll a different one.
    await saveRun(hydrated);
    return hydrated;
  } catch {
    cached = null;
    return null;
  }
}

export async function saveRun(run: RunState): Promise<void> {
  const next = { ...run, lastPlayedAt: Date.now() };
  cached = next;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A failed save should never take the screen down with it.
  }
}

export async function startNewRun(shipId: string = DEFAULT_SHIP_ID): Promise<RunState> {
  const run = createRun(shipId);
  await saveRun(run);
  return run;
}

export async function clearRun(): Promise<void> {
  cached = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore — the caller re-reads state either way.
  }
}

/**
 * Spends a jump.
 *
 * The rule lives here rather than in the screen that draws the button, so the
 * cost of a jump is defined once. Fuel comes off wherever the jump goes — a
 * hop back to a star already visited costs the same as a new one.
 */
export function applyJump(run: RunState, target: number): RunState {
  // Belt-and-braces, the same way `shiftEnergy` refuses an illegal move: the
  // screens disable the button, and a refused jump hands the run back
  // unchanged so a caller can tell nothing happened.
  if (jumpBlocker(run)) return run;

  return {
    ...run,
    position: target,
    visited: run.visited.includes(target) ? run.visited : [...run.visited, target],
    jumps: run.jumps + 1,
    fuel: Math.max(run.fuel - 1, 0),
    // Arriving spends both charges: the drive has to build again before the
    // ship can leave, and a hostile star makes that build far longer.
    jumpCharge: 0,
    weaponCharge: 0,
  };
}

/**
 * Moves one bar of reactor energy into or out of a subsystem.
 *
 * The rule lives here, beside `applyJump`, rather than in the panel that draws
 * the buttons: what counts as a legal move is a property of the run, not of
 * one screen's controls. An illegal move — no spare energy, a full subsystem,
 * an empty one — returns the run unchanged *by identity*, which is how the
 * caller knows to skip the save and the haptic.
 */
export function shiftEnergy(run: RunState, subsystem: Subsystem, delta: number): RunState {
  const energy = shift(run.energy, reactorOf(run), subsystem, delta);
  if (energy === run.energy) return run;

  return {
    ...run,
    energy,
    // Charging up takes time; losing power does not. Pulling a bar out of the
    // shields drops the envelope to the new level on the spot, and it has to
    // climb back if the bar goes in again.
    shieldCharge: Math.min(run.shieldCharge, energy.shields),
  };
}

/**
 * Something hits the ship.
 *
 * The shields soak it while any are standing, and only once they are down does
 * the hull start losing plates — which is the whole reason to spend energy on
 * shields. One rule, so that whatever starts shooting later does not get to
 * invent its own order.
 */
export function takeHit(run: RunState): RunState {
  if (shieldLevel(run.shieldCharge) > 0) return damageShield(run);

  const hull = damagedHull(run.hull);
  return hull === run.hull ? run : { ...run, hull };
}

/**
 * Takes a level off the shield.
 *
 * The one thing that damages a shield today is the dev control on the helm —
 * there is no combat yet. The rule lives here anyway, so that when something
 * does start shooting it calls this rather than inventing its own idea of what
 * a hit costs. Returns the run unchanged when there is nothing to knock down.
 */
export function damageShield(run: RunState): RunState {
  const shieldCharge = damagedShield(run.shieldCharge);
  if (shieldCharge === run.shieldCharge) return run;
  return { ...run, shieldCharge, shieldHits: run.shieldHits + 1 };
}

/**
 * Moves a weapon between the hardpoint and the hold, or between two cargo
 * slots.
 *
 * The rule itself is `moveItem` in `lib/hold.ts`; this only carries it onto
 * the run. Like `shiftEnergy`, an illegal move — nothing to move, somewhere
 * already full — returns the run unchanged by identity.
 */
export function moveGear(run: RunState, from: Place, to: Place): RunState {
  const current = { mounted: run.mounted, hold: run.hold };
  const next = moveItem(current, from, to);
  if (next === current) return run;
  return { ...run, mounted: next.mounted, hold: next.hold };
}

/**
 * Fills in anything a save predates — a ship, a jump map, a tank of fuel — so
 * an older run opens instead of being thrown away.
 *
 * Kept private: `loadRun` is the only caller, which is what makes `RunState`
 * safe to declare fully required.
 */
function hydrate(stored: StoredRun): RunState {
  const map = stored.map ?? generateMap();
  // A map saved before encounters existed gets them rolled in place, so an
  // in-progress run keeps its layout and its history.
  migrateMap(map);

  const position = typeof stored.position === 'number' ? stored.position : map.start;
  // Older saves appended a duplicate on every backtrack; collapse them.
  const visited = stored.visited?.length ? [...new Set(stored.visited)] : [position];
  const jumps =
    typeof stored.jumps === 'number' ? stored.jumps : Math.max(visited.length - 1, 0);

  const now = Date.now();
  // Resolved through the table rather than trusted, so a run launched in a
  // ship that has since been cut from the roster loads as the first ship
  // everywhere, instead of being the old ship in some places and not others.
  const ship = shipById(stored.shipId ?? DEFAULT_SHIP_ID);
  const shipId = ship.id;
  const energy = clampEnergy(stored.energy, ship.reactor);
  return {
    id: stored.id ?? `${now}-${Math.random().toString(36).slice(2, 10)}`,
    startedAt: stored.startedAt ?? now,
    lastPlayedAt: stored.lastPlayedAt ?? now,
    shipId,
    map,
    position,
    visited,
    jumps,
    // Clamped unconditionally: a save made when tanks were bigger must not
    // hold more fuel than the badge can show.
    fuel: Math.min(
      typeof stored.fuel === 'number' ? stored.fuel : Math.max(FUEL_PER_RUN - jumps, 0),
      FUEL_PER_RUN,
    ),
    // Saves predate the reactor entirely, and a ship's output can be retuned
    // under a run in progress, so the stored allocation is forced back into
    // something this ship can actually power rather than trusted.
    energy,
    // Saves predate both clocks. A hold longer than the rules allow is capped;
    // a shield with no stored charge comes back at the level it is powered
    // for, so a reload does not strip a run of its shields.
    // The drive charge used to be stored the other way up, as `detain`: units
    // of hold *left* at a hostile star. A save holding one is turned round
    // into the charge already built, so a run mid-hold keeps its progress.
    jumpCharge: legacyJumpCharge(stored, map, position),
    weaponCharge: clampNumber(stored.weaponCharge, 0, WEAPON_UNITS, 0),
    // A save from before the hull existed comes back intact rather than wrecked.
    hull: clampNumber(stored.hull, 0, HULL_MAX, HULL_MAX),
    shieldCharge: clampNumber(stored.shieldCharge, 0, energy.shields, energy.shields),
    // Only ever compared against itself to spot a change, so any finite
    // number will do; a save from before the counter starts at nothing.
    shieldHits: clampNumber(stored.shieldHits, 0, Number.MAX_SAFE_INTEGER, 0),
    // A save from before dialogue existed has heard nothing — but it has
    // already *been* to its visited stars, and replaying their encounters on
    // load would be a conversation with a merchant long since passed. So the
    // stars already stood on count as spoken, and only new ones talk.
    spoken: Array.isArray(stored.spoken)
      ? [...new Set(stored.spoken.filter((index) => typeof index === 'number'))]
      : [...visited],
    // A save from before weapons existed comes back armed with its ship's
    // weapon. One that has deliberately stowed it keeps `null`, which is why
    // this asks whether the field is there rather than whether it is truthy.
    mounted:
      'mounted' in stored ? (weaponById(stored.mounted)?.id ?? null) : ship.weapon,
    hold: fitHold(stored.hold, cargoSlots(ship.cargo), (id) => weaponById(id) !== null),
  };
}

/** Reads either shape of drive charge off a save, new or old. */
function legacyJumpCharge(stored: StoredRun, map: SectorMap, position: number): number {
  const units = ENCOUNTER_STYLE[encounterAt(map, position)].hostile
    ? HOSTILE_JUMP_UNITS
    : JUMP_UNITS;

  if (typeof stored.jumpCharge === 'number' && Number.isFinite(stored.jumpCharge)) {
    return clampNumber(stored.jumpCharge, 0, units, 0);
  }
  // `detain` counted downward from the full hold, so what is built is the rest.
  const held = clampNumber((stored as { detain?: unknown }).detain, 0, units, 0);
  return units - held;
}

/** A stored number forced into range, or `fallback` when it is not one. */
function clampNumber(value: unknown, low: number, high: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(low, Math.min(high, value));
}

/**
 * One-line description shown under Continue Run, e.g. "SECTOR 4 · 7 FUEL".
 *
 * Both halves are live: the sector is derived from jumps made, and the fuel is
 * what is actually left in the tank.
 */
export function summarize(run: RunState): string {
  return `SECTOR ${sectorOf(run)} · ${run.fuel} FUEL`;
}
