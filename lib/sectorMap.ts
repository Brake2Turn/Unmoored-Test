/**
 * The jump map for a run: twenty stars scattered across a fixed logical space.
 *
 * Coordinates live in a 100×160 box rather than screen pixels or 0–1 fractions,
 * so a jump that is in range on one phone is in range on every phone. The
 * renderer scales this box to fit whatever space it has.
 */

export const MAP_W = 100;
export const MAP_H = 160;
export const NODE_COUNT = 20;

/** How far the ship can jump, in the same units as the map box. */
export const JUMP_RANGE = 34;

/** Nodes per band, bottom (the start) to top. Sums to NODE_COUNT. */
const BANDS = [1, 3, 4, 4, 4, 3, 1] as const;

const EDGE_PADDING = 11;
const TOP_MARGIN = 14;
const BOTTOM_MARGIN = 10;

export type MapNode = {
  x: number;
  y: number;
  /** 0 is the starting band at the bottom; higher means further out. */
  band: number;
};

export type SectorMap = {
  nodes: MapNode[];
  /** Index of the node the ship starts on — always the lone bottom star. */
  start: number;
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

  return { nodes, start: 0 };
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
