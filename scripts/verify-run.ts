/**
 * Property checks for the rules of a run: firing, provoking, destroying,
 * being hit, the other ship's gun, the clock, jumping, and loading a save.
 *
 * These are the rules a player feels in combat, and until they were split out
 * of the storage code nothing checked them automatically. They are played
 * here on a small hand-built sector, where every star's occupant is known,
 * and on a few thousand fresh runs pushed through random junk.
 *
 *   npm run verify:run
 */
import {
  autofireReady,
  shiftEnergy,
  foeCapacity,
  foeSystems,
  foeTargetFor,
  setTarget,
  systemCapacity,
  toggleAutofire,
  applyJump,
  chargeFractions,
  createRun,
  devStageEncounter,
  fireBlocker,
  fireWeapon,
  foeArmed,
  foeDestroyed,
  foeFires,
  foeHull,
  foeLooksHostile,
  FOE_JITTER_UNITS,
  hitFoe,
  hydrateRun,
  jumpBlocker,
  jumpUnitsFor,
  markSpoken,
  missChance,
  MISS_PER_WREN_BAR,
  shotMisses,
  wrenBars,
  modeOf,
  moveGear,
  pendingMeeting,
  shipHere,
  takeHit,
  tickRun,
  type RunState,
} from '../lib/run.ts';
import {
  HOSTILE_JUMP_UNITS,
  JUMP_UNITS,
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  WEAPON_UNITS,
  shieldLevel,
  spentEnergy,
} from '../lib/energy.ts';
import { ENCOUNTER_RULES } from '../lib/encounterRules.ts';
import { HULL_MAX } from '../lib/hull.ts';
import { cargoSlots } from '../lib/hold.ts';
import { MEETINGS } from '../lib/dialogue.ts';
import { FUEL_PER_RUN, type SectorMap } from '../lib/sectorMap.ts';
import { SHIPS, shipById } from '../lib/ships.ts';

const RUNS = Number(process.argv[2] ?? 2000);
const failures: string[] = [];

function check(label: string, condition: boolean) {
  if (!condition) failures.push(label);
}

// ---------------------------------------------------------------------------
// A sector where every star is known: 0 the start, 1 a red ship, 2 a yellow
// one, 3 empty, 4 the boss.
// ---------------------------------------------------------------------------
const red = MEETINGS.find((meeting) => meeting.hull === 'red');
const yellow = MEETINGS.find((meeting) => meeting.hull === 'yellow');
if (!red || !yellow) throw new Error('the table needs a red and a yellow meeting to check combat');

const SECTOR: SectorMap = {
  start: 0,
  boss: 4,
  nodes: [
    { x: 50, y: 150, band: 0, meeting: null },
    { x: 40, y: 125, band: 1, meeting: red.id },
    { x: 60, y: 125, band: 1, meeting: yellow.id },
    { x: 50, y: 100, band: 2, meeting: null },
    { x: 50, y: 20, band: 6, meeting: null },
  ],
};

/**
 * A fresh Drifter run standing at `star`, its arrival already spoken, with
 * the weapon aimed at the other ship's weapons — nothing fires untargeted.
 */
function at(star: number, extra: Partial<RunState> = {}): RunState {
  return { ...createRun('drifter'), map: SECTOR, position: star, spoken: [star], target: 'weapons', ...extra };
}

/** Lands `n` of the player's bolts on the ship here. */
function hits(run: RunState, n: number): RunState {
  for (let i = 0; i < n; i++) run = hitFoe(run, run.position);
  return run;
}

// Subsystems, both ways -----------------------------------------------------
{
  // An aimed hit that gets past the shields takes a plate AND a bar.
  const bare = at(1, { shieldCharge: 0 });
  const hit = takeHit(bare, 'engines', 1);
  check('an aimed hit takes a plate', hit.hull === bare.hull - 1);
  check('an aimed hit takes a bar off that system', systemCapacity(hit).engines === SUBSYSTEM_CAPACITY - 1);
  check('the other systems are untouched', systemCapacity(hit).weapons === SUBSYSTEM_CAPACITY);
  // Shields soak it whole: no plate, no bar.
  const soaked = takeHit(at(1, { shieldCharge: 2, energy: { shields: 2, weapons: 2, engines: 2 } }), 'weapons', 1);
  check('a shield soaks an aimed hit whole', systemCapacity(soaked).weapons === SUBSYSTEM_CAPACITY && soaked.hull === HULL_MAX);
  // Bars that no longer fit go back to the reactor, and cannot be put back.
  let wrecked = at(1, { shieldCharge: 0, energy: { shields: 2, weapons: 2, engines: 2 } });
  for (let i = 0; i < 3; i++) wrecked = takeHit(wrecked, 'engines', 1);
  check('a damaged system sheds the bars it cannot hold', wrecked.energy.engines === 1);
  const refilled = shiftEnergy(wrecked, 'engines', 1);
  check('a damaged system takes no more than it can hold', refilled === wrecked);
  check('the shed bar is spare again', shiftEnergy(wrecked, 'weapons', 1).energy.weapons === 3);
  let dead = wrecked;
  for (let i = 0; i < 5; i++) dead = takeHit(dead, 'engines', 1);
  check('a system bottoms out at nothing', systemCapacity(dead).engines === 0 && dead.energy.engines === 0);
  check('damage outlasts a reload', hydrateRun(JSON.parse(JSON.stringify(dead)))?.systemDamage.engines === SUBSYSTEM_CAPACITY);
  const shieldsHit = takeHit(at(1, { shieldCharge: 0, energy: { shields: 3, weapons: 1, engines: 2 } }), 'shields', 1);
  check('the shield charge fits what is left', shieldsHit.energy.shields <= systemCapacity(shieldsHit).shields);

  // The other ship: the same three, by the same rules.
  const raider = at(1);
  check('a red ship carries its kind\'s split', foeSystems(raider).weapons === ENCOUNTER_RULES.enemy.systems.weapons);
  const aimed = hitFoe(raider, 1, 'weapons', 1);
  check('an aimed shot takes a plate from them', foeHull(aimed) === foeHull(raider) - 1);
  check('an aimed shot takes a bar from them', foeCapacity(aimed).weapons === SUBSYSTEM_CAPACITY - 1);
  let disarmed = raider;
  for (let i = 0; i < 4; i++) disarmed = hitFoe(disarmed, 1, 'weapons', 1);
  check('their weapons shot out', foeSystems(disarmed).weapons === 0);
  let sunk = raider;
  while (foeHull(sunk) > 0) sunk = hitFoe(sunk, 1, 'weapons', 1);
  check('destroying a ship lets go of the target', sunk.target === null);
  const silent = { ...disarmed, foeCharge: WEAPON_UNITS };
  check('a ship with no weapons does not fire', foeFires(silent) === silent);
  check('their Wren Drive is their dodge', wrenBars(raider, 'foe') === ENCOUNTER_RULES.enemy.systems.engines);
  let slowed = raider;
  for (let i = 0; i < 4; i++) slowed = hitFoe(slowed, 1, 'engines', 1);
  check('shooting out their Wren Drive stops their dodging', missChance(slowed, 'foe') === 0);
  // Their shields soak the player's shots exactly as the player's do.
  const guarded = at(1, { foeShieldCharge: 2 });
  const blocked = hitFoe(guarded, 1, 'weapons', 1);
  check('their shield soaks a shot', foeHull(blocked) === foeHull(guarded) && foeCapacity(blocked).weapons === SUBSYSTEM_CAPACITY);
  check('their shield loses a layer', shieldLevel(blocked.foeShieldCharge) === 1 && blocked.foeShieldHits === 1);
  // Arriving finds the next ship with its shields up and nothing targeted.
  const moved = applyJump(at(0, { jumpCharge: HOSTILE_JUMP_UNITS }), 1);
  check('a jump clears the target', moved.target === null);
  check('a jump finds their shields up', moved.foeShieldCharge === ENCOUNTER_RULES.enemy.systems.shields);

  // Targeting and autofire.
  check('nothing can be targeted at an empty star', setTarget(at(3, { target: null }), 'weapons').target === null);
  check('a ship here can be targeted', setTarget(at(1, { target: null }), 'shields').target === 'shields');
  const ready = at(1, { weaponCharge: WEAPON_UNITS, autofire: true });
  check('autofire fires a charged, aimed weapon', autofireReady(ready));
  check('autofire waits for a target', !autofireReady({ ...ready, target: null }));
  check('autofire waits for the charge', !autofireReady({ ...ready, weaponCharge: 1 }));
  check('autofire off holds fire', !autofireReady(toggleAutofire(ready)));
  check('autofire waits for the talking', !autofireReady({ ...ready, spoken: [] }));
  check('autofire never fires at nothing', !autofireReady(at(3, { weaponCharge: WEAPON_UNITS, autofire: true })));
  const picks = new Set<string>();
  for (let i = 0; i < 300; i++) picks.add(foeTargetFor(Math.random()));
  check('a hostile ship aims at every system', SUBSYSTEMS.every((s) => picks.has(s)) && foeTargetFor(0.9999) === 'engines');
}

// Firing -------------------------------------------------------------------
const armed = at(1, { weaponCharge: WEAPON_UNITS });
check('a charged weapon can fire', fireBlocker(armed) === null);
check('a half-charged weapon cannot', fireBlocker(at(1, { weaponCharge: WEAPON_UNITS / 2 })) === 'charging');
check('no weapon, no fire', fireBlocker(at(1, { mounted: null, weaponCharge: WEAPON_UNITS })) === 'weapon');
check('firing spends the whole charge', fireWeapon(armed).weaponCharge === 0);
const refused = at(1);
check('a refused shot is the same run', fireWeapon(refused) === refused);
check('firing on a red ship provokes nobody', fireWeapon(armed).provoked.length === 0);
const untargeted = { ...armed, target: null };
check('nothing fires without a target', fireWeapon(untargeted) === untargeted);
const nobody = at(3, { weaponCharge: WEAPON_UNITS });
check('nothing fires at an empty star', fireWeapon(nobody) === nobody);

// Provoking ----------------------------------------------------------------
const trader = at(2, { weaponCharge: WEAPON_UNITS });
check('a yellow ship is peaceful', !foeArmed(trader) && modeOf(trader) === 'explorer');
check('a yellow ship holds the drive briefly', jumpUnitsFor(trader) === JUMP_UNITS);
const provoked = fireWeapon(trader);
check('firing on a yellow ship provokes it', provoked.provoked.includes(2));
check('a provoked ship fights', foeArmed(provoked) && modeOf(provoked) === 'combat');
check('a provoked ship pins the drive', jumpUnitsFor(provoked) === HOSTILE_JUMP_UNITS);
// The shot leaving is what counts, so a miss turns it red and starts the
// fight just the same: nothing here has landed on it yet.
check('provoked turns red at once, hit or miss', foeLooksHostile(provoked) && (provoked.foeDamage['2'] ?? 0) === 0);
check('provoked starts the fight at once, hit or miss', modeOf(provoked) === 'combat');
check('an unprovoked yellow ship looks yellow', !foeLooksHostile(trader));
check('a hit alone provokes nobody', !foeArmed(hitFoe(trader, 2)));

// Destroying ---------------------------------------------------------------
const raider = at(1);
check('a red ship fights', foeArmed(raider) && modeOf(raider) === 'combat');
check('a red ship pins the drive', jumpUnitsFor(raider) === HOSTILE_JUMP_UNITS);
check('each bolt takes one plate', foeHull(hitFoe(raider, 1)) === foeHull(raider) - 1);
const wreck = hits(raider, foeHull(raider));
check('a hull at zero is destroyed', foeDestroyed(wreck) && shipHere(wreck) === 'empty');
check('a destroyed ship stops fighting', !foeArmed(wreck) && modeOf(wreck) === 'explorer');
check('a destroyed ship frees the drive', jumpUnitsFor(wreck) === JUMP_UNITS);
check('a destroyed ship cannot be hit again', hitFoe(wreck, 1) === wreck);
check('an empty star cannot be hit', hitFoe(at(3), 3).foeDamage['3'] === undefined);
check('a bolt lands on the star it was fired at', hitFoe(at(3), 1).foeDamage['1'] === 1);
check('the boss carries the heaviest hull', foeHull(at(4)) > foeHull(raider));

// The other ship's gun ------------------------------------------------------
const notYet = at(1, { foeCharge: WEAPON_UNITS - 0.1 });
check('a gun not yet full does not fire', foeFires(notYet) === notYet);
for (let i = 0; i < 200; i++) {
  const fired = foeFires(at(1, { foeCharge: WEAPON_UNITS }));
  check('a shot resets the gun to just below empty', fired.foeCharge <= 0 && fired.foeCharge > -FOE_JITTER_UNITS - 1e-9);
}
const peaceful = at(2, { foeCharge: WEAPON_UNITS });
check('a peaceful ship never fires', foeFires(peaceful) === peaceful);
const talking = at(1, { spoken: [], foeCharge: WEAPON_UNITS });
check('nobody fires mid-conversation', foeFires(talking) === talking);
check('a conversation is not combat', pendingMeeting(talking) !== null && modeOf(talking) === 'explorer');
check('speaking ends the conversation', pendingMeeting(markSpoken(talking)) === null);

// Being hit -----------------------------------------------------------------
const shielded = at(1, { shieldCharge: 2, energy: { shields: 2, weapons: 2, engines: 2 } });
const struck = takeHit(shielded);
check('shields take a hit first', shieldLevel(struck.shieldCharge) === 1 && struck.hull === HULL_MAX);
check('a shield hit is counted', struck.shieldHits === shielded.shieldHits + 1);
const bare = takeHit(takeHit(struck));
check('then the hull', bare.hull === HULL_MAX - 1);
let sunk = at(1, { shieldCharge: 0, energy: { shields: 0, weapons: 2, engines: 2 } });
for (let i = 0; i < HULL_MAX + 3; i++) sunk = takeHit(sunk);
check('the hull stops at nothing', sunk.hull === 0);
check('a wreck cannot jump', jumpBlocker({ ...sunk, jumpCharge: HOSTILE_JUMP_UNITS }) === 'wrecked');
check('a wreck cannot fire', fireBlocker({ ...sunk, weaponCharge: WEAPON_UNITS }) === 'wrecked');
check('a wreck stops the clock', tickRun(sunk, 1) === sunk);
const lastShot = { ...sunk, foeCharge: WEAPON_UNITS };
check('nobody shoots a wreck', foeFires(lastShot) === lastShot);

// The clock -----------------------------------------------------------------
check('nothing charges mid-conversation', tickRun(talking, 5) === talking);
const ticked = tickRun(at(1, { jumpCharge: 0, weaponCharge: 0, foeCharge: 0 }), 1);
check('the drive, the gun and theirs all build', ticked.jumpCharge > 0 && ticked.weaponCharge > 0 && ticked.foeCharge > 0);
check('a peaceful ship does not charge', tickRun(at(2), 1).foeCharge === 0);
check('no weapon, no charge', tickRun(at(1, { mounted: null }), 1).weaponCharge === 0);
let long = at(1);
for (let i = 0; i < 400; i++) long = tickRun(long, 0.25);
check('charges stop when full', long.jumpCharge === HOSTILE_JUMP_UNITS && long.weaponCharge === WEAPON_UNITS && long.foeCharge === WEAPON_UNITS);
check('full reads as full', chargeFractions(long).jump === 1 && chargeFractions(long).weapon === 1);

// Wren Drive: dodging ---------------------------------------------------------
for (let bars = 0; bars <= 4; bars++) {
  const swaying = at(1, { energy: { shields: 0, weapons: 1, engines: bars } });
  check(`${bars} bars of Wren Drive: ${bars * 10}% of shots at the player miss`, Math.abs(missChance(swaying, 'player') - bars * MISS_PER_WREN_BAR) < 1e-9);
}
const still = at(1, { energy: { shields: 2, weapons: 2, engines: 0 } });
check('no Wren Drive, nothing misses the player', !shotMisses(still, 'player', 0));
check('a shot at a Shrike misses 20%', Math.abs(missChance(raider, 'foe') - 0.2) < 1e-9);
check('a shot at a merchant misses 10%', Math.abs(missChance(trader, 'foe') - 0.1) < 1e-9);
check('a shot at the Elder Shrike misses 30%', Math.abs(missChance(at(4), 'foe') - 0.3) < 1e-9);
check('a destroyed ship has no Wren Drive', wrenBars(wreck, 'foe') === 0);
check('a roll under the chance misses, over it hits', shotMisses(raider, 'foe', 0.19) && !shotMisses(raider, 'foe', 0.2));
let missed = 0;
const swaying4 = at(1, { energy: { shields: 0, weapons: 0, engines: 4 } });
for (let i = 0; i < 20000; i++) if (shotMisses(swaying4, 'player', Math.random())) missed++;
check('four bars miss about four shots in ten', Math.abs(missed / 20000 - 0.4) < 0.02);

// Gear ----------------------------------------------------------------------
const stowed = moveGear(at(1, { weaponCharge: 7 }), 'mount', 0);
check('stowing the weapon takes it off the ship', stowed.mounted === null && stowed.hold[0] === 'weapon1');
check('stowing it loses its charge', stowed.weaponCharge === 0);
check('remounting starts from nothing', moveGear({ ...stowed, weaponCharge: 5 }, 0, 'mount').weaponCharge === 0);

// Jumping -------------------------------------------------------------------
const ready = at(3, { jumpCharge: JUMP_UNITS, weaponCharge: 4, foeCharge: 3 });
const jumped = applyJump(ready, 1);
check('a ready drive jumps', jumped !== ready && jumped.position === 1);
check('a jump costs one fuel', jumped.fuel === ready.fuel - 1 && jumped.jumps === ready.jumps + 1);
check('arriving empties every charge', jumped.jumpCharge === 0 && jumped.weaponCharge === 0 && jumped.foeCharge === 0);
check('a building drive refuses', applyJump(at(3), 1).position === 3);
check('an empty tank refuses', jumpBlocker({ ...ready, fuel: 0 }) === 'fuel');
check('cold engines refuse', jumpBlocker({ ...ready, energy: { shields: 3, weapons: 3, engines: 0 } }) === 'engines');

// The encounter tester ---------------------------------------------------------
const staged = devStageEncounter(hits(fireWeapon(trader), 1), red.id);
check('staging makes the star speak again', !staged.spoken.includes(staged.position));
check('a staged ship is whole and unprovoked', foeHull(staged) > 0 && !staged.provoked.includes(staged.position) && pendingMeeting(staged) !== null);

// ---------------------------------------------------------------------------
// Saves. A run survives a save and a load exactly; older shapes are dropped;
// junk in a current save comes back legal.
// ---------------------------------------------------------------------------
const roundTrip = (run: RunState) => hydrateRun(JSON.parse(JSON.stringify(run)));

/** Two runs alike in every field but when they were last saved, key order aside. */
function same(a: RunState | null, b: RunState | null): boolean {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]))
        : v;
  return !!a && !!b && JSON.stringify(canon({ ...a, lastPlayedAt: 0 })) === JSON.stringify(canon({ ...b, lastPlayedAt: 0 }));
}

check('the drive charge at a provoked star survives a reload', roundTrip({ ...provoked, jumpCharge: 30 })?.jumpCharge === 30);
check('at a peaceful star it is capped to an ordinary hold', roundTrip({ ...at(2), jumpCharge: 30 })?.jumpCharge === JUMP_UNITS);
check('a stowed weapon stays stowed', roundTrip(stowed)?.mounted === null);

const oldShapes: unknown[] = [
  null,
  42,
  'run',
  {},
  { id: 'old', shipId: 'drifter' },
  { id: 'old', map: { nodes: [{ x: 1, y: 1, band: 0 }], start: 0, boss: 0 } },
  { id: 'old', map: { nodes: SECTOR.nodes, start: 0 } },
  { id: 'old', map: { nodes: SECTOR.nodes.map((n) => ({ ...n, meeting: undefined, encounter: 'enemy' })), start: 0, boss: 4 } },
  { id: 7, map: SECTOR },
];
for (const shape of oldShapes) check(`an old or broken save is dropped (${JSON.stringify(shape)?.slice(0, 40)})`, hydrateRun(shape) === null);

const JUNK: unknown[] = [undefined, null, -1, 1e9, NaN, 'x', [], {}, 2.5, -0.5, true];
const pick = () => JUNK[Math.floor(Math.random() * JUNK.length)];

for (let i = 0; i < RUNS; i++) {
  const ship = SHIPS[i % SHIPS.length];
  const fresh = createRun(ship.id);
  const back = roundTrip(fresh);
  check('a fresh run survives a save and load', same(back, fresh));

  const junked: Record<string, unknown> = { ...fresh };
  for (const key of Object.keys(fresh)) if (key !== 'id' && key !== 'map' && Math.random() < 0.4) junked[key] = pick();
  const legal = hydrateRun(JSON.parse(JSON.stringify(junked)));
  if (!legal) {
    check('junk fields never lose a run with a whole map', false);
    continue;
  }
  const star = (n: number) => Number.isInteger(n) && n >= 0 && n < legal.map.nodes.length;
  const reactor = shipById(legal.shipId).reactor;
  check('position is a star', star(legal.position));
  check('where the ship stands counts as visited', legal.visited.includes(legal.position));
  check('lists hold stars only', [...legal.visited, ...legal.spoken, ...legal.provoked].every(star));
  check('fuel fits the tank', legal.fuel >= 0 && legal.fuel <= FUEL_PER_RUN && Number.isInteger(legal.fuel));
  check('hull fits the plating', legal.hull >= 0 && legal.hull <= HULL_MAX && Number.isInteger(legal.hull));
  check('energy fits the reactor', spentEnergy(legal.energy) <= reactor && Object.values(legal.energy).every((v) => v >= 0 && v <= SUBSYSTEM_CAPACITY));
  check('shields fit their power', legal.shieldCharge >= 0 && legal.shieldCharge <= legal.energy.shields);
  check('charges fit their builds', legal.jumpCharge >= 0 && legal.jumpCharge <= jumpUnitsFor(legal) && legal.weaponCharge >= 0 && legal.weaponCharge <= WEAPON_UNITS);
  check('the hold matches the ship', legal.hold.length === cargoSlots(shipById(legal.shipId).cargo));
  check('damage is whole hits', Object.values(legal.foeDamage).every((d) => Number.isInteger(d) && d > 0));
  check('a checked run checks the same again', same(roundTrip(legal), legal));
}

console.log(`combat sector     red "${red.lines[0].speaker}", yellow "${yellow.lines[0].speaker}"`);
console.log(`old saves dropped ${oldShapes.length}`);
console.log(`runs round-tripped ${RUNS}`);

if (failures.length) {
  const unique = [...new Set(failures)];
  console.error(`\n${failures.length} failures across ${unique.length} properties:`);
  for (const label of unique.slice(0, 20)) console.error(`  - ${label}`);
  process.exit(1);
}

console.log('\nall properties hold');
