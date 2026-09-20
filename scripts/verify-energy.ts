/**
 * Property checks for reactor energy.
 *
 * The rules promise things no type can express — a reactor that cannot power
 * everything, an allocation that never exceeds what the reactor makes, a save
 * file that cannot produce an illegal one — so they are asserted here over
 * many random sequences instead of being taken on trust.
 *
 *   npm run verify:energy
 */
import { readFileSync } from 'node:fs';

import {
  DETAIN_UNITS,
  SHIELD_REGEN_PER_SECOND,
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  TOTAL_CAPACITY,
  detainSeconds,
  escapeRate,
  regenShield,
  canAdd,
  canRemove,
  clampEnergy,
  defaultEnergy,
  freeEnergy,
  shift,
  spentEnergy,
  type EnergyState,
  type Subsystem,
} from '../lib/energy.ts';

const RUNS = Number(process.argv[2] ?? 2000);
const failures: string[] = [];

function check(label: string, condition: boolean) {
  if (!condition) failures.push(label);
}

/** Every invariant an allocation must satisfy, whatever produced it. */
function checkLegal(where: string, energy: EnergyState, reactor: number) {
  for (const subsystem of SUBSYSTEMS) {
    check(`${where}: ${subsystem} not negative`, energy[subsystem] >= 0);
    check(`${where}: ${subsystem} within capacity`, energy[subsystem] <= SUBSYSTEM_CAPACITY);
    check(`${where}: ${subsystem} is a whole number`, Number.isInteger(energy[subsystem]));
  }
  const budget = Math.max(0, Math.min(reactor, TOTAL_CAPACITY));
  check(`${where}: spends no more than the reactor makes`, spentEnergy(energy) <= budget);
  check(`${where}: free is what is left`, freeEnergy(energy, reactor) === budget - spentEnergy(energy));
}

// ---------------------------------------------------------------------------
// The ship table: no reactor may reach what all three subsystems can hold.
// ---------------------------------------------------------------------------
// Relative to the package root, which is where npm runs a script from.
const shipSource = readFileSync('lib/ships.ts', 'utf8');
const declared = [...shipSource.matchAll(/^\s*reactor:\s*(\d+),/gm)].map((m) => Number(m[1]));
const shipCount = [...shipSource.matchAll(/^\s*id:\s*'/gm)].length;

// If this trips, the table was reshaped and this check went blind rather than
// failing — which is the one way a data lint can quietly stop being one.
check('found a reactor for every ship', declared.length > 0 && declared.length === shipCount);
for (const reactor of declared) {
  check(`reactor ${reactor} cannot power everything`, reactor < TOTAL_CAPACITY);
  check(`reactor ${reactor} powers something`, reactor >= 1);
}

// ---------------------------------------------------------------------------
// The opening split, across every reactor size a ship could plausibly carry.
// ---------------------------------------------------------------------------
for (let reactor = 0; reactor <= TOTAL_CAPACITY + 2; reactor++) {
  const energy = defaultEnergy(reactor);
  checkLegal(`default(${reactor})`, energy, reactor);
  check(
    `default(${reactor}) spends the whole reactor`,
    spentEnergy(energy) === Math.min(reactor, TOTAL_CAPACITY),
  );

  // Round-robin: no subsystem may run more than one bar ahead of another.
  const levels = SUBSYSTEMS.map((subsystem) => energy[subsystem]);
  check(`default(${reactor}) spreads evenly`, Math.max(...levels) - Math.min(...levels) <= 1);
}

// ---------------------------------------------------------------------------
// Random sequences of moves. Whatever order they come in, the state stays legal
// and the can-do predicates agree with what actually happens.
// ---------------------------------------------------------------------------
let movesMade = 0;
let movesRefused = 0;

for (let i = 0; i < RUNS; i++) {
  const reactor = 1 + Math.floor(Math.random() * (TOTAL_CAPACITY - 1));
  let energy = defaultEnergy(reactor);

  for (let step = 0; step < 40; step++) {
    const subsystem = SUBSYSTEMS[Math.floor(Math.random() * SUBSYSTEMS.length)] as Subsystem;
    const delta = Math.random() < 0.5 ? 1 : -1;

    const expected = delta > 0 ? canAdd(energy, reactor, subsystem) : canRemove(energy, subsystem);
    const before = energy[subsystem];
    const next = shift(energy, reactor, subsystem, delta);

    if (expected) {
      movesMade++;
      check('a legal move returns a new object', next !== energy);
      check('a legal move moves exactly one bar', next[subsystem] === before + delta);
    } else {
      movesRefused++;
      check('an illegal move returns the same object', next === energy);
    }

    energy = next;
    checkLegal('after a move', energy, reactor);
  }

  // A zero delta is never a move.
  check('zero delta changes nothing', shift(energy, reactor, 'shields', 0) === energy);
}

// ---------------------------------------------------------------------------
// Saves. Anything at all can come off disk; a legal allocation must come back.
// ---------------------------------------------------------------------------
const JUNK: unknown[] = [
  undefined,
  null,
  0,
  'shields',
  [],
  {},
  { shields: 99, weapons: -4, engines: 2.7 },
  { shields: NaN, weapons: Infinity, engines: -Infinity },
  { shields: 4, weapons: 4, engines: 4 },
  { shields: '3', weapons: null, engines: 1 },
  { hull: 3, speed: 2 },
];

for (const value of JUNK) {
  for (let reactor = 0; reactor <= TOTAL_CAPACITY + 2; reactor++) {
    checkLegal(`clamp(${JSON.stringify(value) ?? 'undefined'}, ${reactor})`, clampEnergy(value, reactor), reactor);
  }
}

// An allocation that is already legal must survive a reload untouched.
for (let i = 0; i < RUNS; i++) {
  const reactor = 1 + Math.floor(Math.random() * (TOTAL_CAPACITY - 1));
  const energy = defaultEnergy(reactor);
  const roundTripped = clampEnergy(JSON.parse(JSON.stringify(energy)), reactor);
  check(
    'a legal allocation survives a save and load',
    SUBSYSTEMS.every((subsystem) => roundTripped[subsystem] === energy[subsystem]),
  );
}

// An all-zero allocation is a choice the player can make, not a missing field.
check(
  'an emptied reactor is kept, not refilled',
  spentEnergy(clampEnergy({ shields: 0, weapons: 0, engines: 0 }, 6)) === 0,
);

// Engines shipped as "piloting". A save under the old name must keep its bars:
// losing them would leave a loaded run unable to jump at all.
const legacy = clampEnergy({ shields: 1, weapons: 2, piloting: 3 }, 6);
check('a save written as "piloting" becomes engines', legacy.engines === 3);
check('the rest of a legacy save is untouched', legacy.shields === 1 && legacy.weapons === 2);
checkLegal('legacy save', legacy, 6);

// The new name wins if a save somehow carries both.
check(
  'a save carrying both names prefers engines',
  clampEnergy({ engines: 1, piloting: 4 }, 6).engines === 1,
);

// Every ship must start able to move, or a new run would open stranded.
for (const reactor of declared) {
  check(`reactor ${reactor} starts with engines running`, defaultEnergy(reactor).engines >= 1);
}

// ---------------------------------------------------------------------------
// Breaking away from a hostile star. The curve has to reward engine power
// without making it cheap, and stop dead at no power.
// ---------------------------------------------------------------------------
check('no engines, no escape', escapeRate(0) === 0);
check('no engines pauses rather than ends the hold', detainSeconds(0) === Infinity);
check('one bar clears the hold in the full time', Math.round(detainSeconds(1)) === DETAIN_UNITS);

const holdTimes = [1, 2, 3, 4].map((bars) => detainSeconds(bars));
for (let i = 1; i < holdTimes.length; i++) {
  check(`${i + 1} bars is faster than ${i}`, holdTimes[i] < holdTimes[i - 1]);
}

// Diminishing returns: each extra bar must buy less than the one before it,
// or the fourth would trivialise the hold.
for (let i = 2; i < holdTimes.length; i++) {
  const thisGain = holdTimes[i - 1] - holdTimes[i];
  const lastGain = holdTimes[i - 2] - holdTimes[i - 1];
  check(`bar ${i + 1} buys less than bar ${i}`, thisGain < lastGain);
}

// Full engines must still cost real time, or there is no decision to make.
check('full engines still take over half the hold', holdTimes[3] > DETAIN_UNITS * 0.5);
check('full engines are faster than a third off', holdTimes[3] < DETAIN_UNITS * 0.8);

// Negative or nonsense power is no power.
check('nonsense engine power gives no rate', escapeRate(-3) === 0 && escapeRate(NaN) === 0);

// ---------------------------------------------------------------------------
// Shields charge toward the level they are powered for, and never past it.
// ---------------------------------------------------------------------------
for (let target = 0; target <= SUBSYSTEM_CAPACITY; target++) {
  let charge = 0;
  for (let step = 0; step < 400; step++) {
    charge = regenShield(charge, target, 0.25);
    check(`charge toward ${target} never overshoots`, charge <= target + 1e-9);
    check(`charge toward ${target} never goes negative`, charge >= 0);
  }
  check(`charge reaches ${target}`, Math.abs(charge - target) < 1e-9);
}

// Pulling power drops the envelope at once rather than draining it.
check('over-charge falls to the new level immediately', regenShield(4, 1, 0.25) === 1);
check('a shield with no power goes out at once', regenShield(3, 0, 0.25) === 0);

// A full charge takes a sensible handful of seconds, not an instant.
const secondsPerBar = 1 / SHIELD_REGEN_PER_SECOND;
check('a bar of shield takes a moment to come up', secondsPerBar >= 2 && secondsPerBar <= 8);

// Junk in, legal out.
check('junk charge starts from nothing', regenShield(NaN, 2, 1) > 0);
check('negative time does not drain a shield', regenShield(1, 3, -5) === 1);

console.log(`hold at 1-4 bars  ${holdTimes.map((t) => t.toFixed(1)).join('s, ')}s`);
console.log(`shield per bar    ${secondsPerBar.toFixed(1)}s`);
console.log(`sequences checked  ${RUNS}`);
console.log(`ships in the table ${shipCount} (reactors ${declared.join(', ')} of ${TOTAL_CAPACITY})`);
console.log(`moves made         ${movesMade}  refused ${movesRefused}`);

if (failures.length) {
  const unique = [...new Set(failures)];
  console.error(`\n${failures.length} failures across ${unique.length} properties:`);
  for (const label of unique.slice(0, 20)) console.error(`  - ${label}`);
  process.exit(1);
}

console.log('\nall properties hold');
