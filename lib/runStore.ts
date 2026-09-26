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
import { nameOf, type Meeting } from '@/lib/dialogue';
import { HULL_MAX, damagedHull, isWrecked } from '@/lib/hull';
import { cargoSlots, fitHold, moveItem, type Place } from '@/lib/hold';
import { DEFAULT_SHIP_ID, shipById } from '@/lib/ships';
import { weaponById } from '@/lib/weapons';
import {
  FUEL_PER_RUN,
  encounterAt,
  meetingAt,
  bossIndex,
  generateMap,
  migrateMap,
  type Encounter,
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
   * Units of weapon charge built since arriving. The weapon can fire once
   * this reaches `WEAPON_UNITS`, and firing spends all of it.
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
  /**
   * Hits the player has landed on the ship at each star, keyed by node index.
   * Stored as damage rather than hull left, so the other ship's hull is always
   * its kind's `hull` minus this, and retuning that number moves every save.
   */
  foeDamage: Record<string, number>;
  /**
   * Units of charge the hostile ship at this star has built toward its next
   * shot. It fires when this reaches `WEAPON_UNITS`, the same full charge the
   * player's weapon needs, and then starts again from a little below nothing
   * (see `foeFires`). Emptied on every jump.
   */
  foeCharge: number;
  /**
   * Stars where the pilot opened fire on a ship that was not hostile. That
   * ship is hostile from then on — it fights back and pins the drive, the
   * same as a red one — and once damaged it is drawn red. By node index.
   */
  provoked: number[];
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
export type JumpBlock = 'wrecked' | 'fuel' | 'engines' | 'charging' | null;

/**
 * What is stopping this run from jumping.
 *
 * Both the helm and the sector map ask this rather than each deciding for
 * itself, so the button that offers the jump and the button that performs it
 * can never disagree. A destroyed ship is reported before anything else, then
 * fuel: an empty tank is the harder stop, since the engines can be powered
 * again in a moment and fuel cannot.
 */
export function jumpBlocker(run: RunState): JumpBlock {
  // A ship with no hull left goes nowhere, whatever is in the tank.
  if (isWrecked(run.hull)) return 'wrecked';
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
  // Pinned down only while the ship pinning you is still there: destroy it and
  // the star becomes an ordinary one, charge already built included.
  return foeArmed(run) ? HOSTILE_JUMP_UNITS : JUMP_UNITS;
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

/** Why the weapon cannot fire, or null when it can. */
export type FireBlock = 'wrecked' | 'weapon' | 'charging' | null;

/**
 * What is stopping the weapon firing: nothing on the hardpoint, or a charge
 * not yet full. The fire button reads this, and `fireWeapon` refuses on it,
 * the same way the jump button and `applyJump` both ask `jumpBlocker`.
 */
export function fireBlocker(run: RunState): FireBlock {
  if (isWrecked(run.hull)) return 'wrecked';
  if (!run.mounted) return 'weapon';
  if (run.weaponCharge < WEAPON_UNITS) return 'charging';
  return null;
}

/**
 * Fires the weapon: spends the whole charge, so it fires once and then has
 * to build again. Refused (the same run back) when `fireBlocker` says so.
 *
 * It does not touch the other ship — the bolt has to get there first, and
 * `hitFoe` is what lands it.
 */
export function fireWeapon(run: RunState): RunState {
  if (fireBlocker(run)) return run;
  // Firing on a ship that was minding its own business starts a fight.
  const here = shipHere(run);
  const provokes =
    here !== 'empty' && !ENCOUNTER_STYLE[here].hostile && !run.provoked.includes(run.position);
  return {
    ...run,
    weaponCharge: 0,
    provoked: provokes ? [...run.provoked, run.position] : run.provoked,
  };
}

/** Plates on the ship waiting at a star when it is undamaged; 0 for none. */
export function foeHullMax(run: RunState, node: number = run.position): number {
  return ENCOUNTER_STYLE[encounterAt(run.map, node)].hull;
}

/** Plates left on the ship waiting at a star. */
export function foeHull(run: RunState, node: number = run.position): number {
  return Math.max(0, foeHullMax(run, node) - (run.foeDamage[String(node)] ?? 0));
}

/**
 * A bolt lands on the ship at `node`, taking a plate.
 *
 * Takes the node the shot was fired at rather than reading `position`, so a
 * bolt still in flight when the ship jumps cannot land on the next star's
 * ship instead. Nothing at the star, or nothing left of its hull, and the run
 * comes back unchanged.
 */
export function hitFoe(run: RunState, node: number): RunState {
  if (foeHull(run, node) <= 0) return run;
  const key = String(node);
  return { ...run, foeDamage: { ...run.foeDamage, [key]: (run.foeDamage[key] ?? 0) + 1 } };
}

/**
 * The ship at a star has been shot to nothing. It is gone: not drawn, not
 * named, not shooting, and no longer pinning the player down. Derived from the
 * damage, so a reload finds the wreck exactly as it was left.
 */
export function foeDestroyed(run: RunState, node: number = run.position): boolean {
  return foeHullMax(run, node) > 0 && foeHull(run, node) <= 0;
}

/**
 * What is at the star the ship is on, as far as the screen is concerned: the
 * encounter, or `empty` once its ship has been destroyed.
 */
export function shipHere(run: RunState): Encounter {
  return foeDestroyed(run) ? 'empty' : encounterAt(run.map, run.position);
}

/** The ship here was not hostile until the pilot fired on it. */
export function foeProvoked(run: RunState, node: number = run.position): boolean {
  return run.provoked.includes(node);
}

/**
 * A live hostile ship is here — the kind that shoots back: a red one, or one
 * the pilot has provoked. Hostile is the same flag that makes a star hold the
 * drive longer, so "red", "shoots" and "pins you down" cannot come apart.
 */
export function foeArmed(run: RunState): boolean {
  const here = shipHere(run);
  if (here === 'empty') return false;
  return ENCOUNTER_STYLE[here].hostile || foeProvoked(run);
}

/**
 * The ship here is drawn red: a hostile kind, or a friendly one the pilot has
 * both fired on and actually damaged.
 */
export function foeLooksHostile(run: RunState): boolean {
  const here = shipHere(run);
  if (here === 'empty') return false;
  return ENCOUNTER_STYLE[here].hostile || (foeProvoked(run) && (run.foeDamage[String(run.position)] ?? 0) > 0);
}

/**
 * What the other party at this star is called: the name they speak under, or
 * for a ship that says nothing (the boss) the kind of ship it is.
 */
export function foeName(run: RunState): string | null {
  const here = encounterAt(run.map, run.position);
  if (here === 'empty') return null;
  const meeting = meetingAt(run.map, run.position);
  return (meeting && nameOf(meeting)) ?? ENCOUNTER_STYLE[here].label;
}

/**
 * How fast a hostile ship's weapon charges, as if it had this many bars in
 * its weapons row: two, which fills `WEAPON_UNITS` in about nine seconds.
 */
export const FOE_WEAPON_BARS = 2;

/**
 * After each shot a hostile ship starts up to this many units *below* empty,
 * so its shots come every nine to fourteen seconds rather than on a steady
 * beat the player could count along to.
 */
export const FOE_JITTER_UNITS = 6;

/**
 * The hostile ship's weapon is charged: it fires, and starts charging again
 * from a random point just below empty. The run comes back unchanged when
 * there is nothing to fire, so the caller knows not to draw a shot.
 */
export function foeFires(run: RunState): RunState {
  if (!foeArmed(run) || isWrecked(run.hull) || pendingMeeting(run) || run.foeCharge < WEAPON_UNITS) {
    return run;
  }
  return { ...run, foeCharge: -Math.random() * FOE_JITTER_UNITS };
}

/** The two modes a run can be in. */
export type Mode = 'explorer' | 'combat';

/**
 * Explorer mode is the normal one. Combat is on while a live hostile ship is
 * here — a red one, or one the pilot has fired on — and only once the talking
 * is over: nobody fights mid-conversation.
 *
 * Derived, not stored, so it cannot disagree with the ship on screen. Other
 * ways into combat (events) will be more clauses here.
 */
export function modeOf(run: RunState): Mode {
  return foeArmed(run) && !pendingMeeting(run) ? 'combat' : 'explorer';
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
 * regenerates, and a hostile ship's gun charges toward its next shot.
 *
 * Driven by the helm, which is the only screen that sits still. Returns the
 * same run when nothing has anything left to do, so a caller can stop ticking.
 */
export function tickRun(run: RunState, seconds: number): RunState {
  // Nothing builds on a wreck, and nothing on either ship — drive, weapons,
  // shields — charges until the conversation at this star is over.
  if (isWrecked(run.hull) || pendingMeeting(run)) return run;

  const foeCharge = foeArmed(run)
    ? Math.min(WEAPON_UNITS, run.foeCharge + seconds * chargeRate(FOE_WEAPON_BARS))
    : run.foeCharge;
  const jumpCharge = Math.min(
    jumpUnitsFor(run),
    run.jumpCharge + seconds * chargeRate(run.energy.engines),
  );
  // A weapon only charges while there is one on the hardpoint.
  const weaponCharge = run.mounted
    ? Math.min(WEAPON_UNITS, run.weaponCharge + seconds * chargeRate(run.energy.weapons))
    : 0;
  const shieldCharge = regenShield(run.shieldCharge, run.energy.shields, seconds);

  if (
    jumpCharge === run.jumpCharge &&
    weaponCharge === run.weaponCharge &&
    shieldCharge === run.shieldCharge &&
    foeCharge === run.foeCharge
  ) {
    return run;
  }
  return { ...run, jumpCharge, weaponCharge, shieldCharge, foeCharge };
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
    foeDamage: {},
    foeCharge: 0,
    provoked: [],
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
    // Whatever is at the next star starts charging from nothing.
    foeCharge: 0,
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
 * Takes a level off the shield, counting it as a hit so the envelope knows to
 * play its break. Reached through `takeHit`, which decides whether the shield
 * or the hull pays. Returns the run unchanged when there is nothing to knock
 * down.
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
  // Taking the weapon off the hardpoint loses its charge, and whatever goes
  // on in its place starts charging from nothing.
  const swapped = next.mounted !== run.mounted;
  return {
    ...run,
    mounted: next.mounted,
    hold: next.hold,
    weaponCharge: swapped ? 0 : run.weaponCharge,
  };
}

/**
 * Dev mode only: every charge on the player's ship full at once — the drive,
 * the weapon (if one is mounted) and the shields, up to the level they are
 * powered for. Returns the run unchanged when there is nothing to fill.
 */
export function devRefillCharges(run: RunState): RunState {
  if (isWrecked(run.hull)) return run;
  const jumpCharge = jumpUnitsFor(run);
  const weaponCharge = run.mounted ? WEAPON_UNITS : 0;
  const shieldCharge = run.energy.shields;
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
 * Dev mode only: put the ship in front of a chosen encounter, fresh, so it can
 * be tried out.
 *
 * `meetingId` stages that meeting at a star — the one the ship is on if it can
 * hold one, else the first that can — and `'boss'` moves the ship to the boss.
 * Either way the star is reset as if never visited: the dialogue plays again,
 * its ship is undamaged and unprovoked, and both guns and the drive start from
 * nothing. It rewrites the map for this run, which is fine for a test run and
 * is why the button only exists in dev mode.
 */
export function devStageEncounter(run: RunState, target: number | 'boss'): RunState {
  const boss = bossIndex(run.map);
  let node: number;
  let map = run.map;
  if (target === 'boss') {
    node = boss;
  } else {
    const canHold = (i: number) => i !== boss && i !== run.map.start;
    node = canHold(run.position) ? run.position : run.map.nodes.findIndex((_, i) => canHold(i));
    if (node < 0) return run;
    map = {
      ...run.map,
      nodes: run.map.nodes.map((n, i) => (i === node ? { ...n, meeting: target } : n)),
    };
  }

  const key = String(node);
  const { [key]: _wiped, ...foeDamage } = run.foeDamage;
  return {
    ...run,
    map,
    position: node,
    visited: run.visited.includes(node) ? run.visited : [...run.visited, node],
    spoken: run.spoken.filter((i) => i !== node),
    provoked: run.provoked.filter((i) => i !== node),
    foeDamage,
    foeCharge: 0,
    jumpCharge: 0,
    weaponCharge: 0,
  };
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
  const run: RunState = {
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
    // Older saves predate the charges. A shield with no stored charge comes
    // back at the level it is powered for, so a reload does not strip a run
    // of its shields. The drive charge is capped at what this star asks for
    // below, once the run is whole.
    jumpCharge: storedJumpCharge(stored, map, position),
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
    // A save from before weapons fired has hit nothing.
    foeDamage: cleanDamage(stored.foeDamage),
    foeCharge: clampNumber(stored.foeCharge, -FOE_JITTER_UNITS, WEAPON_UNITS, 0),
    provoked: Array.isArray(stored.provoked)
      ? [...new Set(stored.provoked.filter((index) => typeof index === 'number'))]
      : [],
  };
  // How long this star holds the drive depends on who is here — a red ship,
  // a yellow one the pilot provoked, or a wreck — and that is only known once
  // the damage and the provocations above are read in. Capping earlier, by the
  // star's colour alone, cut a charge built against a provoked ship back to an
  // ordinary star's on every reload.
  return { ...run, jumpCharge: Math.min(run.jumpCharge, jumpUnitsFor(run)) };
}

/** Only whole, positive hit counts survive a load. */
function cleanDamage(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const clean: Record<string, number> = {};
  for (const [key, hits] of Object.entries(value)) {
    if (typeof hits === 'number' && Number.isFinite(hits) && hits > 0) clean[key] = Math.floor(hits);
  }
  return clean;
}

/**
 * The drive charge a save holds, in either of the shapes it has been written
 * in, capped only at the longest build any star can ask for.
 */
function storedJumpCharge(stored: StoredRun, map: SectorMap, position: number): number {
  if (typeof stored.jumpCharge === 'number' && Number.isFinite(stored.jumpCharge)) {
    return clampNumber(stored.jumpCharge, 0, HOSTILE_JUMP_UNITS, 0);
  }
  // It used to be stored the other way up, as `detain`: units of hold *left*
  // at a hostile star, counting down from the full hold, so what is built is
  // the rest. Those saves predate provoking and destroying ships, so the
  // star's own colour is the whole story there.
  const units = ENCOUNTER_STYLE[encounterAt(map, position)].hostile
    ? HOSTILE_JUMP_UNITS
    : JUMP_UNITS;
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
