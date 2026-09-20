/**
 * Reactor energy and the three subsystems it is spread across.
 *
 * A ship's reactor is deliberately smaller than the subsystems can hold, so
 * there is no allocation that leaves nothing wanting: every bar put into
 * shields is a bar not in weapons. That tension is the whole point of the
 * panel on the helm.
 *
 * **Nothing reads these levels yet.** There is no combat to spend them on.
 * The allocation is real, it is part of the run and it survives a reload —
 * what it *does* arrives with the systems that need it.
 *
 * This file imports nothing, for the same reason `sectorMap.ts` imports
 * nothing: it is pure rules, so `scripts/verify-energy.ts` can run them under
 * bare node. The colours and labels live in `lib/subsystems.ts`, which is to
 * this file what `encounters.ts` is to `sectorMap.ts`.
 */
export type Subsystem = 'shields' | 'weapons' | 'engines';

/** Allocation order, which is also the order they are drawn in. */
export const SUBSYSTEMS: readonly Subsystem[] = ['shields', 'weapons', 'engines'] as const;

/** Bars one subsystem holds when fully powered. */
export const SUBSYSTEM_CAPACITY = 4;

/**
 * What running everything at once would cost. No ship's reactor reaches it —
 * `npm run verify:energy` holds that line over the ship table.
 */
export const TOTAL_CAPACITY = SUBSYSTEMS.length * SUBSYSTEM_CAPACITY;

/** Bars currently routed to each subsystem. */
export type EnergyState = Record<Subsystem, number>;

/**
 * Breaking away from a hostile star.
 *
 * The hold is measured in *units of work*, not seconds, and the engines burn
 * through it at `escapeRate`. One bar clears 40 units in 40 seconds; more bars
 * burn faster, but on a curve with diminishing returns, so a full tank is a
 * meaningful head start rather than a free pass. No bars means no rate at all,
 * which is what pauses the timer rather than ending it.
 *
 * The exponent is the whole design: at 1 it would be a straight divide and
 * four bars would escape in ten seconds. At 0.35 four bars still costs about
 * twenty-five, and each extra bar buys less than the one before it.
 */
export const DETAIN_UNITS = 40;
export const ESCAPE_EXPONENT = 0.35;

/** Units of hold burned per second at this engine power. Zero bars, zero rate. */
export function escapeRate(engines: number): number {
  if (!Number.isFinite(engines) || engines <= 0) return 0;
  return Math.pow(engines, ESCAPE_EXPONENT);
}

/** How long a full hold takes at this engine power, or Infinity while paused. */
export function detainSeconds(engines: number, units: number = DETAIN_UNITS): number {
  const rate = escapeRate(engines);
  return rate <= 0 ? Infinity : units / rate;
}

/**
 * Shields come up a level at a time, and they do not snap on.
 *
 * The bars in the shields row set the *ceiling* — three bars means the shield
 * can reach level three and no further. Getting there is separate business:
 * every level takes `SHIELD_SECONDS_PER_LEVEL` to charge, whether it is the
 * first one back after a hit or the last one up to the cap.
 *
 * Pulling power is not symmetrical — that drops on the spot, in `shiftEnergy`
 * — because the energy is simply no longer there to hold it.
 */
export const SHIELD_SECONDS_PER_LEVEL = 5;
export const SHIELD_REGEN_PER_SECOND = 1 / SHIELD_SECONDS_PER_LEVEL;

/**
 * The whole levels currently standing.
 *
 * Charge is a float because it has to creep toward the next level, but only
 * completed levels count for anything — a shield nine tenths of the way to
 * its second layer still has one.
 */
export function shieldLevel(charge: number): number {
  if (!Number.isFinite(charge)) return 0;
  return Math.max(0, Math.floor(charge));
}

/** How far the level above `shieldLevel` has charged, 0 to 1. */
export function shieldProgress(charge: number): number {
  if (!Number.isFinite(charge)) return 0;
  return Math.max(0, charge - shieldLevel(charge));
}

/**
 * A hit takes a whole level off.
 *
 * Part-charged progress toward the next level goes with it: a shield caught at
 * 2.9 drops to 2, not to 1.9. Losing a layer means starting the next one over,
 * which is what makes being hit while regenerating expensive.
 */
export function damagedShield(charge: number): number {
  return Math.max(0, shieldLevel(charge) - 1);
}

/** The shield's strength after `seconds` of charging toward `target`. */
export function regenShield(charge: number, target: number, seconds: number): number {
  const safeTarget = Math.max(0, Math.min(SUBSYSTEM_CAPACITY, target));
  const safeCharge = Number.isFinite(charge) ? Math.max(0, charge) : 0;

  // Above the level the reactor is holding: the extra is gone at once.
  if (safeCharge >= safeTarget) return safeTarget;
  return Math.min(safeTarget, safeCharge + Math.max(0, seconds) * SHIELD_REGEN_PER_SECOND);
}

/**
 * Names a subsystem used to be saved under.
 *
 * Engines shipped as "piloting" first. A save written under the old name has
 * to keep its bars — and now that the engines must be running to jump at all,
 * silently dropping them would leave a loaded run unable to move.
 */
const LEGACY_KEYS: Partial<Record<Subsystem, string>> = {
  engines: 'piloting',
};

/** Bars the reactor is currently carrying. */
export function spentEnergy(energy: EnergyState): number {
  return SUBSYSTEMS.reduce((total, subsystem) => total + energy[subsystem], 0);
}

/** Bars the reactor is making that nothing is using. */
export function freeEnergy(energy: EnergyState, reactor: number): number {
  return Math.max(0, reactorBudget(reactor) - spentEnergy(energy));
}

/** A bar can be added only if the reactor is making a spare one and the subsystem has room. */
export function canAdd(energy: EnergyState, reactor: number, subsystem: Subsystem): boolean {
  return freeEnergy(energy, reactor) > 0 && energy[subsystem] < SUBSYSTEM_CAPACITY;
}

export function canRemove(energy: EnergyState, subsystem: Subsystem): boolean {
  return energy[subsystem] > 0;
}

/**
 * One bar into or out of a subsystem, or the state handed straight back when
 * the move is not legal.
 *
 * An illegal move returns the *same object*, which is what lets every caller
 * up the stack — the run store, then the panel — tell "nothing happened" from
 * "something happened" without comparing fields.
 */
export function shift(
  energy: EnergyState,
  reactor: number,
  subsystem: Subsystem,
  delta: number,
): EnergyState {
  if (delta === 0) return energy;

  const allowed = delta > 0 ? canAdd(energy, reactor, subsystem) : canRemove(energy, subsystem);
  if (!allowed) return energy;

  return { ...energy, [subsystem]: energy[subsystem] + (delta > 0 ? 1 : -1) };
}

/**
 * The opening split: round-robin, so a small reactor spreads across all three
 * rather than filling shields and leaving the rest dark. It spends the whole
 * reactor, which is what makes the shortfall obvious on the first look — every
 * subsystem is visibly part-powered.
 */
export function defaultEnergy(reactor: number): EnergyState {
  const energy: EnergyState = { shields: 0, weapons: 0, engines: 0 };
  let left = reactorBudget(reactor);

  while (left > 0) {
    let placedOne = false;
    for (const subsystem of SUBSYSTEMS) {
      if (left === 0) break;
      if (energy[subsystem] < SUBSYSTEM_CAPACITY) {
        energy[subsystem] += 1;
        left -= 1;
        placedOne = true;
      }
    }
    // Everything is full and there is still reactor left over. Cannot happen
    // with a legal ship, but the loop must not spin if one ever slips through.
    if (!placedOne) break;
  }

  return energy;
}

/**
 * Forces whatever a save holds into a legal allocation.
 *
 * Saves predate this system entirely, and a run can also be reloaded after the
 * ship table changed under it, so nothing here is taken on trust: unknown
 * shapes fall back to the default split, and an allocation larger than the
 * reactor is shed from the last subsystem backwards.
 */
export function clampEnergy(value: unknown, reactor: number): EnergyState {
  if (typeof value !== 'object' || value === null) return defaultEnergy(reactor);

  const source = value as Partial<Record<Subsystem, unknown>>;
  const energy: EnergyState = { shields: 0, weapons: 0, engines: 0 };
  let sawOne = false;

  for (const subsystem of SUBSYSTEMS) {
    const legacy = LEGACY_KEYS[subsystem];
    const raw =
      source[subsystem] ??
      (legacy ? (source as Record<string, unknown>)[legacy] : undefined);
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      energy[subsystem] = Math.max(0, Math.min(SUBSYSTEM_CAPACITY, Math.floor(raw)));
      sawOne = true;
    }
  }

  // Nothing recognisable in there — treat it as a save from before the reactor.
  if (!sawOne) return defaultEnergy(reactor);

  const budget = reactorBudget(reactor);
  for (let i = SUBSYSTEMS.length - 1; i >= 0; i--) {
    const over = spentEnergy(energy) - budget;
    if (over <= 0) break;
    const subsystem = SUBSYSTEMS[i];
    energy[subsystem] = Math.max(0, energy[subsystem] - over);
  }

  return energy;
}

/** A reactor rating as the rules actually use it: whole bars, never negative. */
function reactorBudget(reactor: number): number {
  if (!Number.isFinite(reactor)) return 0;
  return Math.max(0, Math.min(Math.floor(reactor), TOTAL_CAPACITY));
}
