/**
 * Property checks for sector generation.
 *
 * The generator promises things no type can express — every star reachable,
 * the boss always in the top band, encounters split into exact thirds — so
 * they are asserted here over many rolls instead of being taken on trust.
 *
 *   npm run verify:map
 */
import {
  FUEL_PER_RUN,
  NODE_COUNT,
  allNodesReachable,
  bossIndex,
  encounterAt,
  generateMap,
  hasMeetings,
  meetingAt,
  reachableFrom,
} from '../lib/sectorMap.ts';
import { MEETINGS, meetingById } from '../lib/dialogue.ts';

const RUNS = Number(process.argv[2] ?? 2000);
const failures: string[] = [];

function check(label: string, condition: boolean) {
  if (!condition) failures.push(label);
}

let worstToBoss = 0;
const tally: Record<string, number> = { empty: 0, enemy: 0, merchant: 0, boss: 0 };
const dealt: Record<number, number> = {};

for (let i = 0; i < RUNS; i++) {
  const map = generateMap();

  check('node count', map.nodes.length === NODE_COUNT);
  check('every star reachable', allNodesReachable(map));
  check('start has somewhere to go', reachableFrom(map, map.start).length > 0);
  check('meetings assigned', hasMeetings(map));
  check('boss index recorded', typeof map.boss === 'number');

  const boss = bossIndex(map);
  const topBand = Math.max(...map.nodes.map((n) => n.band));
  check('boss in top band', map.nodes[boss].band === topBand);
  check('boss is not the start', boss !== map.start);
  check('boss star holds the boss', encounterAt(map, boss) === 'boss');
  check('start is empty', encounterAt(map, map.start) === 'empty');

  const counts: Record<string, number> = { empty: 0, enemy: 0, merchant: 0, boss: 0 };
  map.nodes.forEach((_, index) => {
    const kind = encounterAt(map, index);
    counts[kind]++;
    tally[kind]++;
  });
  check('one boss', counts.boss === 1);

  // A third of the sector is empty, and the rest is dealt from the table.
  // Written against the table's own length rather than a number, because
  // `MEETINGS` is expected to be rewritten — add an encounter and these still
  // hold without anyone remembering to come back here.
  const free = map.nodes.length - 2;
  const wantEmpty = Math.round(free / 3);
  const wantMeetings = free - wantEmpty;
  check('a third of the sector is empty', counts.empty === wantEmpty + 1);
  check('the rest hold meetings', counts.enemy + counts.merchant === wantMeetings);

  // Every encounter is dealt before any is dealt twice.
  const seen = new Map<number, number>();
  map.nodes.forEach((_, index) => {
    const meeting = meetingAt(map, index);
    if (meeting) seen.set(meeting.id, (seen.get(meeting.id) ?? 0) + 1);
  });
  const least = Math.floor(wantMeetings / MEETINGS.length);
  const most = Math.ceil(wantMeetings / MEETINGS.length);
  check(
    'every encounter dealt before any repeats',
    MEETINGS.every((meeting) => {
      const times = seen.get(meeting.id) ?? 0;
      return times >= least && times <= most;
    }),
  );
  check('no meeting the table does not carry', [...seen.keys()].every(meetingById));
  for (const meeting of MEETINGS) dealt[meeting.id] = (dealt[meeting.id] ?? 0) + (seen.get(meeting.id) ?? 0);

  // Shortest jump count to the boss, which must fit in one tank.
  const distance = new Map<number, number>([[map.start, 0]]);
  const queue = [map.start];
  while (queue.length) {
    const current = queue.shift() as number;
    for (const next of reachableFrom(map, current)) {
      if (distance.has(next)) continue;
      distance.set(next, (distance.get(current) as number) + 1);
      queue.push(next);
    }
  }
  const toBoss = distance.get(boss) ?? Infinity;
  worstToBoss = Math.max(worstToBoss, toBoss);
  check('boss reachable within a tank', toBoss <= FUEL_PER_RUN);
}

const unique = [...new Set(failures)];
console.log(`maps checked        ${RUNS}`);
console.log(
  `encounters in table ${MEETINGS.length} ` +
    `(${MEETINGS.filter((m) => m.hull === 'red').length} red, ` +
    `${MEETINGS.filter((m) => m.hull === 'yellow').length} yellow)`,
);
console.log(
  'dealt per encounter ' +
    MEETINGS.map((m) => `${m.id}:${((dealt[m.id] ?? 0) / RUNS).toFixed(1)}`).join('  '),
);
console.log(`worst path to boss  ${worstToBoss} jumps (tank holds ${FUEL_PER_RUN})`);
console.log(
  `average per map     ` +
    Object.entries(tally)
      .map(([k, v]) => `${k} ${(v / RUNS).toFixed(2)}`)
      .join('  '),
);

if (unique.length) {
  console.error(`\nFAILED: ${unique.join(', ')}`);
  process.exit(1);
}
console.log('\nall properties hold');
