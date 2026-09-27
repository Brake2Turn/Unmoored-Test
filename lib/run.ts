import {
  HOSTILE_JUMP_UNITS,
  JUMP_UNITS,
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  WEAPON_UNITS,
  capacityAfter,
  chargeRate,
  clampEnergy,
  damagedShield,
  defaultEnergy,
  fitEnergy,
  regenShield,
  shieldLevel,
  shift,
  type EnergyState,
  type Subsystem,
} from './energy.ts';
import { ENCOUNTER_RULES } from './encounterRules.ts';
import { MEETINGS, nameOf, type Meeting } from './dialogue.ts';
import { HULL_MAX, damagedHull, isWrecked } from './hull.ts';
import { cargoSlots, fitHold, moveItem, type Place } from './hold.ts';
import { shipById } from './ships.ts';
import { weaponById } from './weapons.ts';
import {
  FUEL_PER_RUN,
  bossIndex,
  encounterAt,
  generateMap,
  isSectorMap,
  meetingAt,
  type Encounter,
  type SectorMap,
} from './sectorMap.ts';

/**
 * The rules of a run: what a run holds, and every change that can happen to
 * it — jumping, moving energy, firing, being hit, the other ship's gun, the
 * clock. Each takes a run and hands back a new one, or the same one when the
 * change is not allowed, so a caller can tell nothing happened.
 *
 * Saving and loading live next door in `runStore.ts`. This file imports only
 * the other rule leaves, by relative path, so `npm run verify:run` can play
 * these rules under bare node — no phone, no storage, no screen.
 */

/**
 * A run as it exists in memory: every gameplay field present.
 *
 * Only `createRun` and `hydrateRun` build one from nothing, and screens get
 * theirs through `loadRun` (`runStore.ts`), which hydrates before handing it
 * over — so screens can read `run.fuel` and `run.map` without defending
 * against absence.
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
  /**
   * Bars destroyed in each of the player's subsystems by hits that got past
   * the shields. A subsystem holds four bars less this, for the rest of the
   * run — there is no repair yet — and bars that no longer fit went back to
   * the reactor as spare when they were lost.
   */
  systemDamage: EnergyState;
  /**
   * The same for the ship at each star, keyed by node index like `foeDamage`:
   * bars the player's aimed shots have destroyed in its subsystems.
   */
  foeSystemDamage: Record<string, EnergyState>;
  /**
   * The shield charge of the ship at this star, run by the player's own rules
   * (`regenShield`, `damagedShield`). Set to full on arrival — a ship waiting
   * at a star has its shields up — and not kept once the player leaves.
   */
  foeShieldCharge: number;
  /** Hits that ship's shield has taken, only ever compared with itself. */
  foeShieldHits: number;
  /**
   * The subsystem on the other ship the player's weapon is aimed at, or null
   * for none. **Nothing fires without one** — choosing a target is the
   * decision to attack. Cleared on every jump, since it named a ship that is
   * no longer there.
   */
  target: Subsystem | null;
  /**
   * The weapon keeps its target after firing, and so keeps firing at it every
   * time it is fully charged. Off, a shot spends the target: the marker goes
   * and nothing fires until another is chosen. Toggled by AUTOFIRE.
   */
  autofire: boolean;
};

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
 * `ENCOUNTER_RULES`, so this is not a second list of which stars mean trouble.
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
 * to build again. Refused (the same run back) when `fireBlocker` says so, and
 * when there is no ship here or nothing on it is targeted.
 *
 * It does not touch the other ship — the bolt has to get there first, and
 * `hitFoe` is what lands it.
 */
export function fireWeapon(run: RunState): RunState {
  if (fireBlocker(run) || !run.target || shipHere(run) === 'empty') return run;
  // Firing on a ship that was minding its own business starts a fight.
  const here = shipHere(run);
  const provokes =
    here !== 'empty' && !ENCOUNTER_RULES[here].hostile && !run.provoked.includes(run.position);
  return {
    ...run,
    weaponCharge: 0,
    // Without autofire a shot spends the target: one target, one shot.
    target: run.autofire ? run.target : null,
    provoked: provokes ? [...run.provoked, run.position] : run.provoked,
  };
}

/** Plates on the ship waiting at a star when it is undamaged; 0 for none. */
export function foeHullMax(run: RunState, node: number = run.position): number {
  return ENCOUNTER_RULES[encounterAt(run.map, node)].hull;
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
export function hitFoe(run: RunState, node: number, target: Subsystem | null = null, damage = 1): RunState {
  if (foeHull(run, node) <= 0) return run;
  // Its shields soak the hit first, exactly as the player's do. They only
  // stand at the star the player is at.
  if (node === run.position && shieldLevel(run.foeShieldCharge) > 0) {
    return {
      ...run,
      foeShieldCharge: damagedShield(run.foeShieldCharge),
      foeShieldHits: run.foeShieldHits + 1,
    };
  }
  const key = String(node);
  const struck: RunState = { ...run, foeDamage: { ...run.foeDamage, [key]: (run.foeDamage[key] ?? 0) + 1 } };
  // A ship shot to nothing takes the target with it: there is nothing left
  // to aim at, and autofire goes back to waiting for one.
  const next =
    node === run.position && foeHull(struck, node) <= 0 ? { ...struck, target: null } : struck;
  if (!target) return next;
  const before = run.foeSystemDamage[key] ?? NO_DAMAGE;
  const after = { ...before, [target]: Math.min(SUBSYSTEM_CAPACITY, before[target] + Math.max(0, damage)) };
  const hurt: RunState = { ...next, foeSystemDamage: { ...run.foeSystemDamage, [key]: after } };
  // A shield that has lost its bars loses the charge they held.
  return node === run.position
    ? { ...hurt, foeShieldCharge: Math.min(hurt.foeShieldCharge, foeSystems(hurt).shields) }
    : hurt;
}

/** No bars destroyed anywhere. */
const NO_DAMAGE: EnergyState = { shields: 0, weapons: 0, engines: 0 };

/**
 * The bars in each subsystem of the ship at a star: its kind's fixed split,
 * less whatever the player's aimed shots have destroyed. All none once it is
 * destroyed, or where there is no ship.
 */
export function foeSystems(run: RunState, node: number = run.position): EnergyState {
  if (foeHull(run, node) <= 0) return NO_DAMAGE;
  const split = ENCOUNTER_RULES[encounterAt(run.map, node)].systems;
  const capacity = capacityAfter(run.foeSystemDamage[String(node)] ?? NO_DAMAGE);
  return fitEnergy(split, capacity);
}

/** How many bars each of the ship's subsystems can still hold. */
export function foeCapacity(run: RunState, node: number = run.position): EnergyState {
  return capacityAfter(run.foeSystemDamage[String(node)] ?? NO_DAMAGE);
}

/** How many bars each of the player's subsystems can still hold. */
export function systemCapacity(run: RunState): EnergyState {
  return capacityAfter(run.systemDamage);
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
  return ENCOUNTER_RULES[here].hostile || foeProvoked(run);
}

/**
 * The ship here is drawn red: a hostile kind, or a friendly one the pilot has
 * fired on — from the moment the shot leaves, whether it hits or misses, the
 * same moment the fight starts.
 */
export function foeLooksHostile(run: RunState): boolean {
  const here = shipHere(run);
  if (here === 'empty') return false;
  return ENCOUNTER_RULES[here].hostile || foeProvoked(run);
}

/**
 * What the other party at this star is called: the name they speak under, or
 * for a ship that says nothing (the boss) the kind of ship it is.
 */
export function foeName(run: RunState): string | null {
  const here = encounterAt(run.map, run.position);
  if (here === 'empty') return null;
  const meeting = meetingAt(run.map, run.position);
  return (meeting && nameOf(meeting)) ?? ENCOUNTER_RULES[here].label;
}

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
  if (
    !foeArmed(run) ||
    isWrecked(run.hull) ||
    pendingMeeting(run) ||
    foeSystems(run).weapons <= 0 ||
    run.foeCharge < WEAPON_UNITS
  ) {
    return run;
  }
  return { ...run, foeCharge: -Math.random() * FOE_JITTER_UNITS };
}

/**
 * Each bar in a ship's Wren Drive makes shots at it this much likelier to
 * miss: it sways harder and is harder to hit. Four bars, 40%.
 */
export const MISS_PER_WREN_BAR = 0.1;

export type Side = 'player' | 'foe';

/**
 * Bars in a ship's Wren Drive — the subsystem the code still calls
 * `engines`, which also charges the jump drive. The player's is whatever the
 * reactor puts there; the ship at the star has a fixed number for its kind
 * (`ENCOUNTER_RULES`), and none once it is destroyed.
 */
export function wrenBars(run: RunState, side: Side): number {
  return side === 'player' ? run.energy.engines : foeSystems(run).engines;
}

/** The chance, 0 to 1, that a shot at `target` misses it. */
export function missChance(run: RunState, target: Side): number {
  return Math.max(0, Math.min(1, wrenBars(run, target) * MISS_PER_WREN_BAR));
}

/**
 * Whether one shot at `target` misses, given a roll from 0 up to 1. The roll
 * is passed in rather than drawn here so the rule can be checked exactly.
 */
export function shotMisses(run: RunState, target: Side, roll: number): boolean {
  return roll < missChance(run, target);
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

  // The other ship's systems run by the player's rules, off its own bars.
  const foe = foeSystems(run);
  const foeCharge = foeArmed(run)
    ? Math.min(WEAPON_UNITS, run.foeCharge + seconds * chargeRate(foe.weapons))
    : run.foeCharge;
  const foeShieldCharge = regenShield(run.foeShieldCharge, foe.shields, seconds);
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
    foeCharge === run.foeCharge &&
    foeShieldCharge === run.foeShieldCharge
  ) {
    return run;
  }
  return { ...run, jumpCharge, weaponCharge, shieldCharge, foeCharge, foeShieldCharge };
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

/** A fresh run in the given ship: a new map, a full tank, shields up. */
export function createRun(shipId: string): RunState {
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
    systemDamage: { ...NO_DAMAGE },
    foeSystemDamage: {},
    foeShieldCharge: 0,
    foeShieldHits: 0,
    target: null,
    autofire: false,
  };
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
    // Whatever is at the next star starts charging from nothing, with its
    // shields already up — and the old target named a ship left behind.
    foeCharge: 0,
    foeShieldCharge: foeSystems(run, target).shields,
    target: null,
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
  const energy = shift(run.energy, reactorOf(run), subsystem, delta, systemCapacity(run));
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
export function takeHit(run: RunState, target: Subsystem | null = null, damage = 1): RunState {
  if (shieldLevel(run.shieldCharge) > 0) return damageShield(run);

  const hull = damagedHull(run.hull);
  // A wreck aims at nothing: the target (and its marker) go with the ship.
  const hit = hull === run.hull ? run : isWrecked(hull) ? { ...run, hull, target: null } : { ...run, hull };
  return target ? damageSystem(hit, target, damage) : hit;
}

/**
 * Destroys `damage` bars of one of the player's subsystems, for the rest of
 * the run. Bars that no longer fit come out of it and go back to the reactor
 * as spare, and whatever those bars were holding — shield layers, the drive's
 * reach — goes with them. Reached through `takeHit`.
 */
export function damageSystem(run: RunState, target: Subsystem, damage: number): RunState {
  const lost = Math.max(0, Math.min(SUBSYSTEM_CAPACITY - run.systemDamage[target], damage));
  if (lost === 0) return run;
  const systemDamage = { ...run.systemDamage, [target]: run.systemDamage[target] + lost };
  const energy = fitEnergy(run.energy, capacityAfter(systemDamage));
  return {
    ...run,
    systemDamage,
    energy,
    shieldCharge: Math.min(run.shieldCharge, energy.shields),
  };
}

/**
 * Aims the weapon at one subsystem on the other ship, or at nothing. A target
 * is an order to fire: the weapon goes at it as soon as it is charged. Only
 * while there is a ship here to aim at, and a ship to aim from.
 */
export function setTarget(run: RunState, target: Subsystem | null): RunState {
  if (target === run.target) return run;
  if (target && (shipHere(run) === 'empty' || isWrecked(run.hull))) return run;
  return { ...run, target };
}

/** Turns autofire on or off. */
export function toggleAutofire(run: RunState): RunState {
  return { ...run, autofire: !run.autofire };
}

/**
 * The player's weapon should fire now: a subsystem on a ship here is
 * targeted, the weapon is charged, and nobody is still talking. Whether it
 * fires again after that is autofire's business (`fireWeapon`).
 */
export function fireReady(run: RunState): boolean {
  return (
    !!run.target &&
    shipHere(run) !== 'empty' &&
    !pendingMeeting(run) &&
    fireBlocker(run) === null
  );
}

/** The damage stat of the weapon on the hardpoint, 0 with none mounted. */
export function weaponDamage(run: RunState): number {
  return run.mounted ? (weaponById(run.mounted)?.damage ?? 1) : 0;
}

/**
 * Which of the player's subsystems a hostile ship's shot is aimed at: one of
 * the three, picked by `roll` from 0 up to 1. Passed in, like the miss roll,
 * so the rule can be checked exactly.
 */
export function foeTargetFor(roll: number): Subsystem {
  return SUBSYSTEMS[Math.max(0, Math.min(SUBSYSTEMS.length - 1, Math.floor(roll * SUBSYSTEMS.length)))];
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
  const { [key]: _mended, ...foeSystemDamage } = run.foeSystemDamage;
  const fresh = { ...run, map, foeDamage, foeSystemDamage };
  return {
    ...run,
    map,
    position: node,
    visited: run.visited.includes(node) ? run.visited : [...run.visited, node],
    spoken: run.spoken.filter((i) => i !== node),
    provoked: run.provoked.filter((i) => i !== node),
    foeDamage,
    foeSystemDamage,
    foeCharge: 0,
    foeShieldCharge: foeSystems(fresh, node).shields,
    target: null,
    jumpCharge: 0,
    weaponCharge: 0,
  };
}

/**
 * Dev mode only: the stage for the dodge-and-fire demo — a red ship at a
 * star, its talking already done, nothing targeted and autofire off, and a
 * weapon on the hardpoint (brought up from the hold if it is down there). The
 * demo itself is played by the space screen; this only sets the scene. The
 * red ship is whichever the table lists first, so nothing names an id. Null
 * when the table has no red ship to stage.
 */
export function devStageDodgeDemo(run: RunState): RunState | null {
  const red = MEETINGS.find((meeting) => meeting.hull === 'red');
  if (!red) return null;
  let staged = devStageEncounter(run, red.id);
  if (!staged.mounted) {
    const slot = staged.hold.findIndex((item) => item !== null);
    if (slot >= 0) staged = moveGear(staged, slot, 'mount');
  }
  return {
    ...staged,
    spoken: staged.spoken.includes(staged.position) ? staged.spoken : [...staged.spoken, staged.position],
    target: null,
    autofire: false,
  };
}

/**
 * A run read back off disk, checked field by field — or null when what is
 * there is not a run this game writes.
 *
 * Only `loadRun` calls it (and the verify script, to throw junk at it). Old
 * save shapes are not converted: a save without a whole map is from an older
 * game and is dropped rather than patched. Within a current save nothing is
 * taken on trust either — every number is forced into range and every list
 * filtered to real stars, so a damaged save still opens as a legal run.
 */
export function hydrateRun(value: unknown): RunState | null {
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<Record<keyof RunState, unknown>>;
  if (typeof stored.id !== 'string' || !isSectorMap(stored.map)) return null;
  const map = stored.map;

  // Star indices only: whole numbers that name a star on this map, once each.
  const stars = (list: unknown): number[] =>
    Array.isArray(list)
      ? [...new Set(list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < map.nodes.length))]
      : [];
  const position = stars([stored.position])[0] ?? map.start;
  const visited = stars(stored.visited);

  // Resolved through the table rather than trusted: a run launched in a ship
  // since cut from the roster flies as the first ship.
  const ship = shipById(typeof stored.shipId === 'string' ? stored.shipId : undefined);
  // A ship's reactor can be retuned under a run in progress, so the stored
  // allocation is forced into something this ship can actually power — and
  // into what its damaged subsystems can still hold.
  const systemDamage = cleanSystems(stored.systemDamage) ?? { ...NO_DAMAGE };
  const energy = fitEnergy(clampEnergy(stored.energy, ship.reactor), capacityAfter(systemDamage));
  const now = Date.now();

  const run: RunState = {
    id: stored.id,
    startedAt: clampNumber(stored.startedAt, 0, now, now),
    lastPlayedAt: clampNumber(stored.lastPlayedAt, 0, now, now),
    shipId: ship.id,
    map,
    position,
    visited: visited.includes(position) ? visited : [...visited, position],
    jumps: Math.floor(clampNumber(stored.jumps, 0, Number.MAX_SAFE_INTEGER, 0)),
    fuel: Math.floor(clampNumber(stored.fuel, 0, FUEL_PER_RUN, FUEL_PER_RUN)),
    energy,
    // Capped at the longest build any star asks for; capped again below at
    // what this star asks for, once the run is whole.
    jumpCharge: clampNumber(stored.jumpCharge, 0, HOSTILE_JUMP_UNITS, 0),
    weaponCharge: clampNumber(stored.weaponCharge, 0, WEAPON_UNITS, 0),
    shieldCharge: clampNumber(stored.shieldCharge, 0, energy.shields, energy.shields),
    hull: Math.floor(clampNumber(stored.hull, 0, HULL_MAX, HULL_MAX)),
    // Only ever compared against itself to spot a change.
    shieldHits: Math.floor(clampNumber(stored.shieldHits, 0, Number.MAX_SAFE_INTEGER, 0)),
    spoken: stars(stored.spoken),
    // Null is a real answer here — the weapon is in the hold.
    mounted: weaponById(stored.mounted)?.id ?? null,
    hold: fitHold(stored.hold, cargoSlots(ship.cargo), (id) => weaponById(id) !== null),
    foeDamage: cleanDamage(stored.foeDamage),
    foeCharge: clampNumber(stored.foeCharge, -FOE_JITTER_UNITS, WEAPON_UNITS, 0),
    provoked: stars(stored.provoked),
    systemDamage,
    foeSystemDamage: cleanSystemMap(stored.foeSystemDamage),
    foeShieldCharge: 0,
    foeShieldHits: Math.floor(clampNumber(stored.foeShieldHits, 0, Number.MAX_SAFE_INTEGER, 0)),
    target:
      typeof stored.target === 'string' && (SUBSYSTEMS as readonly string[]).includes(stored.target)
        ? (stored.target as Subsystem)
        : null,
    autofire: stored.autofire === true,
  };
  // How long this star holds the drive depends on who is here — a red ship,
  // a yellow one the pilot provoked, or a wreck — and that is only known once
  // the damage and the provocations above are read in. Capping by the star's
  // colour alone cut a charge built against a provoked ship back to an
  // ordinary star's on every reload.
  // The other ship's shield, like the drive, depends on who is here and what
  // is left of them. A save from before it had one finds its shields up.
  const foeShields = foeSystems(run).shields;
  return {
    ...run,
    jumpCharge: Math.min(run.jumpCharge, jumpUnitsFor(run)),
    foeShieldCharge: clampNumber(stored.foeShieldCharge, 0, foeShields, foeShields),
    // Nothing to aim at, or nothing left to aim from: no target, no order.
    target: shipHere(run) === 'empty' || isWrecked(run.hull) ? null : run.target,
  };
}

/** Destroyed bars per subsystem, each forced to a whole 0–4; null when absent. */
function cleanSystems(value: unknown): EnergyState | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<Record<Subsystem, unknown>>;
  const clean = { ...NO_DAMAGE };
  for (const subsystem of SUBSYSTEMS) {
    clean[subsystem] = Math.floor(clampNumber(source[subsystem], 0, SUBSYSTEM_CAPACITY, 0));
  }
  return clean;
}

/** The other ships' destroyed bars, keyed by star; anything unreadable is dropped. */
function cleanSystemMap(value: unknown): Record<string, EnergyState> {
  if (!value || typeof value !== 'object') return {};
  const clean: Record<string, EnergyState> = {};
  for (const [key, entry] of Object.entries(value)) {
    const systems = cleanSystems(entry);
    if (systems && SUBSYSTEMS.some((s) => systems[s] > 0)) clean[key] = systems;
  }
  return clean;
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
