import React from 'react';
import { ClipPath, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { palette } from '@/lib/theme';

type Props = {
  /** The board's pixel size. The chart fills it exactly. */
  width: number;
  height: number;
  /**
   * Where the map's own coordinate system sits inside that board, and how
   * large a map unit is drawn.
   *
   * The graticule is generated from these rather than from the pixel box, so
   * it is the *sector's* grid — a line every ten map units, wherever that
   * falls on this phone — rather than a decoration ruled over the top of it.
   * Hand it the same numbers the stars are placed with and the two cannot
   * drift apart.
   */
  offsetX: number;
  offsetY: number;
  scale: number;
};

/** Map units between the fine lines, and how many of those make a heavy one. */
const MINOR_UNITS = 10;
const MAJOR_EVERY = 5;

/** Below this the graticule is denser than it is legible, so it is dropped. */
const MIN_SPACING = 6;

/** The display's rounded corner, and the bezel brackets inside it. */
const RADIUS = 10;
const BRACKET_INSET = 6;
const BRACKET_ARM = 15;

/** Graduations along the bottom and left edges, minor and major. */
const TICK = 5;
const TICK_MAJOR = 9;

type GridLine = { at: number; index: number };

/**
 * Every gridline crossing `0 … limit`, stepping from the map's origin.
 *
 * `index` counts map intervals from that origin rather than from the edge of
 * the screen, which is what lets a heavy line mean a round number of map
 * units instead of a round number of pixels.
 */
function gridLines(origin: number, step: number, limit: number): GridLine[] {
  const out: GridLine[] = [];
  let index = Math.ceil(-origin / step);
  for (let at = origin + index * step; at <= limit; at += step, index += 1) {
    out.push({ at, index });
  }
  return out;
}

/**
 * The sector map drawn as a chart on a piloting console rather than as a
 * window onto space: a lit display, the sector's own graticule, graduations
 * down two edges, a bezel with corner brackets, and a vignette that curves the
 * glass.
 *
 * It renders as bare SVG elements for the board's own `<Svg>` to hold, so the
 * stars, the routes and the range ring sit *on* the chart in one coordinate
 * system. Drawing it into a separate layer behind them would mean keeping two
 * transforms in step, and they would come apart the first time the board was
 * resized.
 *
 * Nothing here moves. A sweep would say "console" louder than any of it, but
 * motion cannot be checked in this container at all, and a scanner that
 * silently sat still would be worse than one that was never there.
 */
export function StarChart({ width, height, offsetX, offsetY, scale }: Props) {
  const step = MINOR_UNITS * scale;
  const dense = step < MIN_SPACING;
  const cols = dense ? [] : gridLines(offsetX, step, width);
  const rows = dense ? [] : gridLines(offsetY, step, height);

  const isMajor = (index: number) => index % MAJOR_EVERY === 0;

  // Inset by half a pixel so the bezel lands on the pixel rather than across
  // two of them.
  const x = 0.5;
  const y = 0.5;
  const w = width - 1;
  const h = height - 1;

  const i = BRACKET_INSET;
  const a = BRACKET_ARM;
  const brackets = [
    `M ${i} ${i + a} V ${i} H ${i + a}`,
    `M ${width - i - a} ${i} H ${width - i} V ${i + a}`,
    `M ${i} ${height - i - a} V ${height - i} H ${i + a}`,
    `M ${width - i - a} ${height - i} H ${width - i} V ${height - i - a}`,
  ];

  return (
    <>
      <Defs>
        <ClipPath id="chart-face">
          <Rect x={x} y={y} width={w} height={h} rx={RADIUS} />
        </ClipPath>
        {/* Curves the glass: the graticule falls away toward the bezel. */}
        <RadialGradient id="chart-vignette" cx="50%" cy="50%" r="70%">
          <Stop offset="0.5" stopColor={palette.void} stopOpacity={0} />
          <Stop offset="1" stopColor={palette.void} stopOpacity={0.9} />
        </RadialGradient>
      </Defs>

      <Rect x={x} y={y} width={w} height={h} rx={RADIUS} fill={palette.chartPanel} />

      <G clipPath="url(#chart-face)">
        {cols.map(({ at, index }) => (
          <Line
            key={`col-${index}`}
            x1={at}
            y1={0}
            x2={at}
            y2={height}
            stroke={palette.accentDim}
            strokeOpacity={isMajor(index) ? 0.26 : 0.13}
            strokeWidth={isMajor(index) ? 1 : 0.7}
          />
        ))}
        {rows.map(({ at, index }) => (
          <Line
            key={`row-${index}`}
            x1={0}
            y1={at}
            x2={width}
            y2={at}
            stroke={palette.accentDim}
            strokeOpacity={isMajor(index) ? 0.26 : 0.13}
            strokeWidth={isMajor(index) ? 1 : 0.7}
          />
        ))}

        {/* Graduations, so the grid reads as a scale and not as wallpaper. */}
        {rows.map(({ at, index }) => (
          <Line
            key={`tick-y-${index}`}
            x1={0}
            y1={at}
            x2={isMajor(index) ? TICK_MAJOR : TICK}
            y2={at}
            stroke={palette.accentDim}
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        ))}
        {cols.map(({ at, index }) => (
          <Line
            key={`tick-x-${index}`}
            x1={at}
            y1={height}
            x2={at}
            y2={height - (isMajor(index) ? TICK_MAJOR : TICK)}
            stroke={palette.accentDim}
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        ))}

        <Rect x={0} y={0} width={width} height={height} fill="url(#chart-vignette)" />
      </G>

      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={RADIUS}
        fill="none"
        stroke={palette.accentDim}
        strokeOpacity={0.45}
        strokeWidth={1}
      />

      {brackets.map((d, index) => (
        <Path
          key={`bracket-${index}`}
          d={d}
          fill="none"
          stroke={palette.accentDim}
          strokeOpacity={0.75}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}
