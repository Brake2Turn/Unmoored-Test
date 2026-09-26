/**
 * Property checks for reactor energy and the hull.
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
  HOSTILE_JUMP_UNITS,
  JUMP_UNITS,
  SHIELD_REGEN_PER_SECOND,
  SHIELD_SECONDS_PER_LEVEL,
  damagedShield,
  shieldLevel,
  shieldProgress,
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  TOTAL_CAPACITY,
  chargeRate,
  chargeSeconds,
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
import { HULL_MAX, damagedHull, isWrecked } from '../lib/hull.ts';
import {
  CARGO_SLOTS_MAX,
  CREW_SLOTS,
  cargoSlots,
  firstEmptySlot,
  fitHold,
  itemAt,
  moveItem,
  type Loadout,
  type Place,
} from '../lib/hold.ts';
import { WEAPONS, weaponById } from '../lib/weapons.ts';

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
// Charging a system. The curve has to reward power without making it cheap,
// and stop dead at no power.
// ---------------------------------------------------------------------------
check('no power, no rate', chargeRate(0) === 0);
check('no power stalls rather than finishes', chargeSeconds(0, JUMP_UNITS) === Infinity);
check('one bar does a unit a second', Math.abs(chargeRate(1) - 1) < 1e-9);

const holdTimes = [1, 2, 3, 4].map((bars) => chargeSeconds(bars, HOSTILE_JUMP_UNITS));
for (let i = 1; i < holdTimes.length; i++) {
  check(`${i + 1} bars is faster than ${i}`, holdTimes[i] < holdTimes[i - 1]);
}

// Diminishing returns: each extra bar must buy less than the one before it,
// or the fourth would trivialise every charge.
for (let i = 2; i < holdTimes.length; i++) {
  const thisGain = holdTimes[i - 1] - holdTimes[i];
  const lastGain = holdTimes[i - 2] - holdTimes[i - 1];
  check(`bar ${i + 1} buys less than bar ${i}`, thisGain < lastGain);
}

// Full engines must still cost real time, or there is no decision to make.
check('full engines still take over half the hold', holdTimes[3] > HOSTILE_JUMP_UNITS * 0.5);
check('full engines are faster than a third off', holdTimes[3] < HOSTILE_JUMP_UNITS * 0.8);

// A hostile star has to be worth dreading next to an ordinary one.
check('a hostile star holds far longer', HOSTILE_JUMP_UNITS >= JUMP_UNITS * 2);

// An ordinary hop should not feel like a wait at any sensible power.
const ordinary = [1, 2, 3, 4].map((bars) => chargeSeconds(bars, JUMP_UNITS));
check('an ordinary jump is under 15s even on one bar', ordinary[0] <= 15);
check('an ordinary jump still costs something on four', ordinary[3] >= 5);

// Negative or nonsense power is no power.
check('nonsense power gives no rate', chargeRate(-3) === 0 && chargeRate(NaN) === 0);

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

// A level takes the stated time, whichever level it is.
const secondsPerBar = 1 / SHIELD_REGEN_PER_SECOND;
check('a level takes the stated time', secondsPerBar === SHIELD_SECONDS_PER_LEVEL);

for (let cap = 1; cap <= SUBSYSTEM_CAPACITY; cap++) {
  // Every level, first or last, costs the same wait.
  for (let from = 0; from < cap; from++) {
    let charge = from;
    let seconds = 0;
    while (shieldLevel(charge) < from + 1 && seconds < 60) {
      charge = regenShield(charge, cap, 0.25);
      seconds += 0.25;
    }
    check(
      `level ${from + 1} of ${cap} takes ${SHIELD_SECONDS_PER_LEVEL}s`,
      Math.abs(seconds - SHIELD_SECONDS_PER_LEVEL) < 0.3,
    );
  }

  // The ceiling is the power, and waiting longer never beats it.
  let charge = 0;
  for (let step = 0; step < 400; step++) charge = regenShield(charge, cap, 0.25);
  check(`power of ${cap} caps the shield at level ${cap}`, shieldLevel(charge) === cap);
  check(`a capped shield stops charging`, shieldProgress(charge) === 0);
}

// A hit costs exactly one whole level, and part-charge goes with it.
check('a hit takes one level', damagedShield(3) === 2);
check('a hit discards progress toward the next', damagedShield(2.9) === 1);
check('a hit on a bare shield cannot go negative', damagedShield(0) === 0);
check('a hit on a part-charged first level clears it', damagedShield(0.8) === 0);
for (let i = 0; i < 200; i++) {
  const start = Math.random() * SUBSYSTEM_CAPACITY;
  const after = damagedShield(start);
  check('damage never raises the shield', after <= start);
  check('damage lands on a whole level', Number.isInteger(after));
  check('damage never goes below nothing', after >= 0);
}

// Levels and progress always agree with the charge they came from.
for (let i = 0; i < 500; i++) {
  const charge = Math.random() * SUBSYSTEM_CAPACITY;
  check('level plus progress is the charge', Math.abs(shieldLevel(charge) + shieldProgress(charge) - charge) < 1e-9);
  check('progress is under one whole level', shieldProgress(charge) < 1);
}
check('junk charge has no level', shieldLevel(NaN) === 0 && shieldProgress(NaN) === 0);

// Junk in, legal out.
check('junk charge starts from nothing', regenShield(NaN, 2, 1) > 0);
check('negative time does not drain a shield', regenShield(1, 3, -5) === 1);

// ---------------------------------------------------------------------------
// The hull. Nothing allocates it and nothing repairs it; it only goes down,
// one plate at a time, and never past nothing.
// ---------------------------------------------------------------------------
check('a ship starts with plating', HULL_MAX >= 1);
check('a hit costs one plate', damagedHull(HULL_MAX) === HULL_MAX - 1);
check('a bare hull cannot go negative', damagedHull(0) === 0);
check('junk plating reads as none', damagedHull(NaN) === 0);
check('a full hull is not a wreck', !isWrecked(HULL_MAX));
check('no plating is a wreck', isWrecked(0));

// Walking it all the way down takes exactly as many hits as there are plates.
let plates = HULL_MAX;
let blows = 0;
while (!isWrecked(plates) && blows < 100) {
  plates = damagedHull(plates);
  blows += 1;
}
check(`it takes ${HULL_MAX} hits to strip the hull`, blows === HULL_MAX);
check('and it stays stripped', damagedHull(plates) === 0);

// ---------------------------------------------------------------------------
// The hold and the berths. Every ship gets a hold with room in it — which is
// also what guarantees a weapon can always be taken off — and none gets more
// than the panel is built to draw.
// ---------------------------------------------------------------------------
const cargoDeclared = [...shipSource.matchAll(/^\s*cargo:\s*([\d.]+),/gm)].map((m) => Number(m[1]));
check('found a cargo stat for every ship', cargoDeclared.length === shipCount);

for (const cargo of cargoDeclared) {
  const slots = cargoSlots(cargo);
  check('a cargo stat is a fraction', cargo >= 0 && cargo <= 1);
  check(`every ship has somewhere to put something (cargo ${cargo})`, slots >= 1);
  check(`no ship overflows the hold panel (cargo ${cargo})`, slots <= CARGO_SLOTS_MAX);
  check(`slots are whole (cargo ${cargo})`, Number.isInteger(slots));
}

// More room on the sheet is never less room in the hold.
const sorted = [...cargoDeclared].sort((a, b) => a - b);
for (let i = 1; i < sorted.length; i += 1) {
  check('a roomier ship never has fewer slots', cargoSlots(sorted[i]) >= cargoSlots(sorted[i - 1]));
}

check('the roomiest ship fills the panel', cargoSlots(1) === CARGO_SLOTS_MAX);
check('junk cargo still leaves a slot', cargoSlots(NaN) === 1 && cargoSlots(-4) === 1);
check('absurd cargo does not overflow', cargoSlots(99) === CARGO_SLOTS_MAX);
check('there are berths to fill', CREW_SLOTS >= 1);

// ---------------------------------------------------------------------------
// Weapons. Every ship launches with one the table carries, and moving it
// between the hardpoint and the hold never loses, doubles or swaps anything.
// ---------------------------------------------------------------------------
const weaponDeclared = [...shipSource.matchAll(/^\s*weapon:\s*'([^']*)',/gm)].map((m) => m[1]);
check('found a weapon for every ship', weaponDeclared.length === shipCount);
for (const id of weaponDeclared) check(`ship weapon ${id} is in the table`, weaponById(id) !== null);
check('weapon ids are distinct', new Set(WEAPONS.map((w) => w.id)).size === WEAPONS.length);

/** Everything in a loadout, as a sorted list, to compare before and after. */
const contents = (l: Loadout) =>
  [l.mounted, ...l.hold].filter((item): item is string => item !== null).sort().join(',');

let gearMoves = 0;
for (let run = 0; run < RUNS; run += 1) {
  const slots = 1 + Math.floor(Math.random() * CARGO_SLOTS_MAX);
  let loadout: Loadout = {
    mounted: WEAPONS[run % WEAPONS.length].id,
    hold: Array.from({ length: slots }, () => null),
  };
  const before = contents(loadout);
  const places: Place[] = ['mount', ...Array.from({ length: slots + 1 }, (_, i) => i), -1];

  for (let step = 0; step < 30; step += 1) {
    const from = places[Math.floor(Math.random() * places.length)];
    const to = places[Math.floor(Math.random() * places.length)];
    const next = moveItem(loadout, from, to);
    if (next !== loadout) {
      gearMoves += 1;
      check('a move takes from somewhere full', itemAt(loadout, from) !== null);
      check('a move lands somewhere empty', itemAt(loadout, to) === null);
      check('what moved is what arrived', itemAt(next, to) === itemAt(loadout, from));
      check('the place it left is empty', itemAt(next, from) === null);
    }
    check('the hold never changes size', next.hold.length === slots);
    check('nothing is lost or doubled', contents(next) === before);
    loadout = next;
  }
}

// The one move the player is actually asked to make, and back again.
const armed: Loadout = { mounted: 'weapon1', hold: [null, null] };
const stowed = moveItem(armed, 'mount', firstEmptySlot(armed) ?? 0);
check('a mounted weapon can be stowed', stowed.mounted === null && stowed.hold[0] === 'weapon1');
check('and mounted again', moveItem(stowed, 0, 'mount').mounted === 'weapon1');
check('a full hold refuses', moveItem({ mounted: 'weapon1', hold: ['weapon2'] }, 'mount', 0).mounted === 'weapon1');
check('a full hold has no empty slot', firstEmptySlot({ mounted: null, hold: ['weapon2'] }) === null);

// A save's hold is forced into shape without throwing anything away that fits.
const known = (id: unknown) => weaponById(id) !== null;
check('junk hold is empty', fitHold('junk', 3, known).join() === [null, null, null].join());
check('unknown ids are dropped', fitHold(['nope', 'weapon2'], 2, known)[0] === null);
check('a shrunk hold keeps what fits', fitHold([null, null, 'weapon3'], 2, known).includes('weapon3'));
check('a hold is always the size asked', fitHold(['weapon1', 'weapon2', 'weapon3'], 2, known).length === 2);

console.log(`hull plates       ${HULL_MAX}`);
console.log(`weapons           ${weaponDeclared.join(', ')}  (${gearMoves} gear moves made)`);
console.log(`cargo slots       ${cargoDeclared.map(cargoSlots).join(', ')} of ${CARGO_SLOTS_MAX}`);
console.log(`crew berths       ${CREW_SLOTS}`);
console.log(`hostile hold      ${holdTimes.map((t) => t.toFixed(1)).join('s, ')}s`);
console.log(`ordinary jump     ${ordinary.map((t) => t.toFixed(1)).join('s, ')}s`);
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
