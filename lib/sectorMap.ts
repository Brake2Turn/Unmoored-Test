/**
 * The jump map for a run: twenty stars scattered across a fixed logical space.
 *
 * Coordinates live in a 100×160 box rather than screen pixels or 0–1 fractions,
 * so a jump that is in range on one phone is in range on every phone. The
 * renderer scales this box to fit whatever space it has.
 */

import { MEETINGS, meetingById, type Meeting } from './dialogue.ts';

export const MAP_W = 100;
export const MAP_H = 160;
export const NODE_COUNT = 20;

/** How far the ship can jump, in the same units as the map box. */
export const JUMP_RANGE = 34;

/** Share of the sector a full tank can reach. */
export const FUEL_COVERAGE = 0.5;

/**
 * Jumps in a full tank. One jump costs one fuel wherever it goes — including
 * a hop back to a star already visited — so a tank with no backtracking
 * reaches half the sector: 10 of 20. Derived from NODE_COUNT so the ratio
 * survives the sector growing.
 */
export const FUEL_PER_RUN = Math.round(NODE_COUNT * FUEL_COVERAGE);

/** Nodes per band, bottom (the start) to top. Sums to NODE_COUNT. */
const BANDS = [1, 3, 4, 4, 4, 3, 1] as const;

const EDGE_PADDING = 11;
const TOP_MARGIN = 14;
const BOTTOM_MARGIN = 10;

/**
 * How a star *presents* — which of the two hulls is drawn there, if any.
 *
 * Derived from the meeting the star holds rather than stored beside it: a red
 * hull means a combat encounter, a yellow one means a trader or a
 * conversation, and the boss is its own thing. Keeping it derived is what
 * stops the ship on screen and the words in the box from ever disagreeing.
 */
export type Encounter = 'empty' | 'enemy' | 'merchant' | 'boss';

export type MapNode = {
  x: number;
  y: number;
  /** 0 is the starting band at the bottom; higher means further out. */
  band: number;
  /**
   * Which entry of `MEETINGS` is waiting here, or null for an empty star.
   *
   * The id rather than the encounter's contents, so rewriting a line in the
   * table changes what an in-progress run says. Absent on maps saved before
   * meetings existed — see `assignMeetings`.
   */
  meeting?: number | null;
};

export type SectorMap = {
  nodes: MapNode[];
  /** Index of the node the ship starts on — always the lone bottom star. */
  start: number;
  /**
   * Index of the star holding the boss — the Elder Shrike — drawn red from
   * the start. Always in the top band, so reaching it is the end of the
   * sector.
   */
  boss: number;
};

export function distance(a: MapNode, b: MapNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isInRange(a: MapNode, b: MapNode): boolean {
  return distance(a, b) <= JUMP_RANGE;
}

/** Indices the ship could jump to from `from`, ignoring where it has been. */
export function reachableFrom(map: SectorMap, from: number): number[] {
  const origin = map.nodes[from];
  if (!origin) return [];
  return map.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node, index }) => index !== from && isInRange(origin, node))
    .map(({ index }) => index);
}

/**
 * Builds a fresh map.
 *
 * Bands are laid out bottom to top and each band's nodes are spread across
 * evenly sized slots with jitter, so the field looks scattered without ever
 * clumping into one corner. Any node that lands out of reach of every node in
 * the band below is then nudged sideways until it is reachable — which
 * guarantees a route from the start to the top without rejecting and
 * regenerating maps until one happens to work.
 */
export function generateMap(): SectorMap {
  const usableHeight = MAP_H - TOP_MARGIN - BOTTOM_MARGIN;
  const bandGap = usableHeight / (BANDS.length - 1);
  const nodes: MapNode[] = [];
  const bandRanges: { start: number; end: number }[] = [];

  BANDS.forEach((count, band) => {
    const rangeStart = nodes.length;
    // Band 0 sits at the bottom of the box; each later band steps upward.
    const baseY = MAP_H - BOTTOM_MARGIN - band * bandGap;
    const slot = (MAP_W - EDGE_PADDING * 2) / count;

    for (let i = 0; i < count; i++) {
      const centre = EDGE_PADDING + slot * i + slot / 2;
      const jitterX = count === 1 ? rand(-9, 9) : rand(-slot * 0.3, slot * 0.3);
      const jitterY = band === 0 ? 0 : rand(-bandGap * 0.22, bandGap * 0.22);

      nodes.push({
        x: clamp(centre + jitterX, EDGE_PADDING, MAP_W - EDGE_PADDING),
        y: clamp(baseY + jitterY, TOP_MARGIN, MAP_H - BOTTOM_MARGIN),
        band,
      });
    }

    bandRanges.push({ start: rangeStart, end: nodes.length });
  });

  // Pull any stranded node toward its nearest neighbour in the band below.
  for (let band = 1; band < BANDS.length; band++) {
    const below = bandRanges[band - 1];
    const here = bandRanges[band];

    for (let i = here.start; i < here.end; i++) {
      const node = nodes[i];
      let nearest = below.start;
      let best = Infinity;

      for (let j = below.start; j < below.end; j++) {
        const d = distance(node, nodes[j]);
        if (d < best) {
          best = d;
          nearest = j;
        }
      }

      if (best <= JUMP_RANGE) continue;

      // Keep the vertical gap, close the horizontal one until it fits.
      const anchor = nodes[nearest];
      const dy = Math.abs(node.y - anchor.y);
      const maxDx = Math.sqrt(Math.max(JUMP_RANGE * JUMP_RANGE - dy * dy, 1)) * 0.92;
      const direction = node.x >= anchor.x ? 1 : -1;
      node.x = clamp(anchor.x + direction * maxDx, EDGE_PADDING, MAP_W - EDGE_PADDING);
    }
  }

  // The boss waits in the top band. That band holds one star today, but
  // picking at random keeps this honest if the bands are ever reshaped.
  const top = bandRanges[bandRanges.length - 1];
  const boss = top.start + Math.floor(Math.random() * (top.end - top.start));

  const map: SectorMap = { nodes, start: 0, boss };
  assignMeetings(map);
  return map;
}

/**
 * Fills every star with what is waiting there.
 *
 * The start is left empty — you begin docked, nothing has happened yet — and
 * the boss star holds the Elder Shrike, which is no meeting at all. Of the 18
 * stars left, a third are empty and the rest are dealt from `MEETINGS` (see
 * `dealMeetings`). Shuffling the whole pool means a run's encounters land
 * differently every time.
 */
export function assignMeetings(map: SectorMap): void {
  // Resolved rather than read straight off the map, so a map saved before the
  // boss field existed still gets one.
  const boss = bossIndex(map);

  const free: number[] = [];
  for (let i = 0; i < map.nodes.length; i++) {
    if (i === map.start || i === boss) continue;
    free.push(i);
  }

  shuffle(free);

  // A third of the sector is empty; the rest is dealt from the table.
  const empties = Math.round(free.length / 3);
  const deck = dealMeetings(free.length - empties);

  free.forEach((index, rank) => {
    map.nodes[index].meeting = rank < empties ? null : deck[rank - empties];
  });

  map.nodes[map.start].meeting = null;
  if (map.nodes[boss]) {
    map.nodes[boss].meeting = null;
    // Record it, so a migrated map stops re-deriving the boss on every render.
    map.boss = boss;
  }
}

/**
 * `count` meeting ids, every encounter in the table used as evenly as the
 * count allows, in a random order.
 *
 * Deals the whole table before repeating any of it, which is the point: a
 * player crosses six or seven stars in a sector, and drawing each slot
 * independently would sometimes hand them the same pirate three times while
 * they never met the merchant at all.
 *
 * Written against `MEETINGS.length` rather than a number, because that table
 * is expected to grow and shrink. Fewer encounters than slots and each is
 * dealt more than once; more encounters than slots and each sector simply
 * shows a different subset.
 */
function dealMeetings(count: number): number[] {
  const out: number[] = [];
  if (MEETINGS.length === 0) return out;

  while (out.length < count) {
    const round = MEETINGS.map((meeting) => meeting.id);
    shuffle(round);
    out.push(...round.slice(0, count - out.length));
  }
  return out;
}

/**
 * Brings a map up to date, whatever shape it was saved in.
 *
 * A map saved before meetings existed carried a coarse `encounter` string per
 * star instead. Those are converted rather than reshuffled: a star the player
 * has already stood on keeps the hull colour it had, and only gains words.
 * A map from before either simply gets dealt.
 */
export function migrateMap(map: SectorMap): void {
  if (hasMeetings(map)) return;
  if (carryLegacyEncounters(map)) return;
  assignMeetings(map);
}

/**
 * Converts the old per-star `encounter` strings into meetings, in place.
 *
 * Returns false — leaving the map untouched — unless every star carries one,
 * so a half-written save is dealt fresh rather than half converted.
 */
function carryLegacyEncounters(map: SectorMap): boolean {
  type Legacy = { encounter?: string };
  const legacy = map.nodes.map((node) => (node as MapNode & Legacy).encounter);
  if (legacy.some((kind) => typeof kind !== 'string')) return false;

  const red = MEETINGS.filter((meeting) => meeting.hull === 'red');
  const yellow = MEETINGS.filter((meeting) => meeting.hull === 'yellow');

  map.nodes.forEach((node, index) => {
    const pool = legacy[index] === 'enemy' ? red : legacy[index] === 'merchant' ? yellow : [];
    node.meeting = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
  });

  map.boss = bossIndex(map);
  map.nodes[map.start].meeting = null;
  if (map.nodes[map.boss]) map.nodes[map.boss].meeting = null;
  return true;
}

/** True once every star knows what is waiting on it. */
export function hasMeetings(map: SectorMap): boolean {
  return map.nodes.every((node) => node.meeting !== undefined);
}

/**
 * The encounter waiting at a star, or null.
 *
 * Returns null for an id the table no longer carries, which is the case that
 * matters while `MEETINGS` is still being written: deleting an entry must
 * quietly empty the stars holding it in an in-progress run, not crash them.
 */
export function meetingAt(map: SectorMap, index: number): Meeting | null {
  if (index === bossIndex(map)) return null;
  const id = map.nodes[index]?.meeting;
  return typeof id === 'number' ? meetingById(id) ?? null : null;
}

/** How a star presents, derived from what is waiting there. */
export function encounterAt(map: SectorMap, index: number): Encounter {
  if (index === bossIndex(map)) return 'boss';
  const meeting = meetingAt(map, index);
  if (!meeting) return 'empty';
  return meeting.hull === 'red' ? 'enemy' : 'merchant';
}

/** Clamps a value into a range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Fisher-Yates, in place. */
function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Which star holds the boss, tolerating maps saved before bosses existed by
 * falling back to the furthest band.
 */
export function bossIndex(map: SectorMap): number {
  if (typeof map.boss === 'number' && map.nodes[map.boss]) return map.boss;

  let best = 0;
  for (let i = 1; i < map.nodes.length; i++) {
    if (map.nodes[i].band > map.nodes[best].band) best = i;
  }
  return best;
}

/**
 * True when every node can be reached from the start by some chain of jumps.
 * The generator aims for this; this is here so it can be asserted in tests.
 */
export function allNodesReachable(map: SectorMap): boolean {
  const seen = new Set<number>([map.start]);
  const queue = [map.start];

  while (queue.length) {
    const current = queue.shift() as number;
    for (const next of reachableFrom(map, current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return seen.size === map.nodes.length;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
