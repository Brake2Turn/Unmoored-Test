import React from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { MountedWeapon } from '@/components/WeaponArt';
import { palette } from '@/lib/theme';

type Props = {
  shipId: string;
  width: number;
  height: number;
  /** Draws the ship in cold grey instead of in the usual white. */
  locked?: boolean;
  /**
   * The weapon on the hardpoint, drawn on the nose. Null or absent draws the
   * bare hull — which is what a ship looks like once its weapon is in the hold.
   */
  weapon?: string | null;
};

/** Every edge and light on a locked ship drops to this. */
const LOCKED_TINT = '#3E4763';

/** Dark silhouette that lets the white edges and glass do the work. */
export const HULL = '#141A2E';
export const HULL_DEEP = '#0B0F1E';

/** The box every ship is drawn in. Anything layered over a ship shares it. */
export const SHIP_BOX_W = 200;
export const SHIP_BOX_H = 260;

/** Where a ship's exhaust leaves it, in the same 200×260 box as the art. */
export type Engine = { x: number; y: number; width: number };

/**
 * The engine bar on each hull, transcribed from the art above.
 *
 * It lives here rather than with the thruster that draws the flame, because
 * these numbers are read off the very paths in this file — move a ship's
 * tail and the nozzle is right there to move with it. Every ship's engines
 * share one `y`, which is what lets a thruster pulse from a single anchor.
 */
export const ENGINES: Record<string, Engine[]> = {
  drifter: [{ x: 100, y: 232, width: 28 }],
  lance: [{ x: 100, y: 210, width: 16 }],
  bulwark: [
    { x: 84, y: 216, width: 20 },
    { x: 116, y: 216, width: 20 },
  ],
};

/**
 * Where each hull carries its weapon, in the same 200×260 box: the base of the
 * weapon, with the barrel pointing forward from there.
 *
 * Read off the paths below the same way `ENGINES` is. Each sits on the front
 * of the hull — between the Drifter's prongs on top of its canopy, just ahead
 * of the Lance's cockpit, on the Bulwark's blunt bow — and none reaches past
 * the ship's own furthest point, so the shield's clear zone (`SHIELD_CLEAR`)
 * still clears every armed ship.
 */
export const MOUNTS: Record<string, { x: number; y: number }> = {
  drifter: { x: 100, y: 94 },
  lance: { x: 100, y: 64 },
  bulwark: { x: 100, y: 46 },
};

/** Same fallback as the art: an unknown ship gets the Drifter's. */
export function enginesFor(shipId: string): Engine[] {
  return ENGINES[shipId] ?? ENGINES.drifter;
}

/**
 * Vector art for each ship, drawn in a shared 200×260 box so every silhouette
 * sits on the same baseline and swipes between cleanly.
 */
export const ShipArt = React.memo(function ShipArt({
  shipId,
  width,
  height,
  locked = false,
  weapon = null,
}: Props) {
  const tint = locked ? LOCKED_TINT : palette.player;
  const Art = ART[shipId] ?? Drifter;
  const mount = MOUNTS[shipId] ?? MOUNTS.drifter;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${SHIP_BOX_W} ${SHIP_BOX_H}`}>
      <Defs>
        <LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tint} stopOpacity={locked ? 0.4 : 0.85} />
          <Stop offset="1" stopColor={tint} stopOpacity={locked ? 0.12 : 0.25} />
        </LinearGradient>
        <LinearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={HULL} />
          <Stop offset="1" stopColor={HULL_DEEP} />
        </LinearGradient>
      </Defs>
      <Art line={tint} />
      {weapon ? (
        <MountedWeapon weaponId={weapon} x={mount.x} y={mount.y} line={tint} fill="url(#plate)" />
      ) : null}
    </Svg>
  );
});

/** Survey cutter: twin forward prongs, domed canopy, V-notched hull. */
function Drifter({ line }: { line: string }) {
  return (
    <>
      <Rect x={48} y={34} width={24} height={92} rx={8} fill="url(#plate)" stroke={line} strokeWidth={2} />
      <Rect x={128} y={34} width={24} height={92} rx={8} fill="url(#plate)" stroke={line} strokeWidth={2} />
      <Rect x={53} y={40} width={14} height={20} rx={5} fill={line} opacity={0.8} />
      <Rect x={133} y={40} width={14} height={20} rx={5} fill={line} opacity={0.8} />

      <Path d="M68 124 A32 32 0 0 1 132 124 Z" fill="url(#glass)" stroke={line} strokeWidth={2} />

      <Path
        d="M52 122 L148 122 L136 198 L100 240 L64 198 Z"
        fill="url(#plate)"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M78 146 L100 196 L122 146" fill="none" stroke={line} strokeWidth={2} strokeOpacity={0.5} />
      <Path d="M86 232 L114 232" stroke={line} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </>
  );
}

/** Interceptor: needle nose, swept wings, everything stripped out. */
function Lance({ line }: { line: string }) {
  return (
    <>
      <Path
        d="M114 118 L162 196 L138 204 L116 166 Z"
        fill="url(#plate)"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M86 118 L38 196 L62 204 L84 166 Z"
        fill="url(#plate)"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M100 18 L116 112 L120 198 L100 216 L80 198 L84 112 Z"
        fill="url(#plate)"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx={100} cy={86} rx={13} ry={26} fill="url(#glass)" stroke={line} strokeWidth={1.5} />
      <Path d="M92 210 L108 210" stroke={line} strokeWidth={5} strokeLinecap="round" />
    </>
  );
}

/** Heavy hauler: slab body, external cargo pods, blunt everything. */
function Bulwark({ line }: { line: string }) {
  return (
    <>
      <Rect x={28} y={104} width={30} height={94} rx={9} fill="url(#plate)" stroke={line} strokeWidth={2} />
      <Rect x={142} y={104} width={30} height={94} rx={9} fill="url(#plate)" stroke={line} strokeWidth={2} />
      <Path d="M33 186 L53 186 M147 186 L167 186" stroke={line} strokeWidth={3} strokeLinecap="round" opacity={0.85} />

      <Path
        d="M70 40 L130 40 L142 206 L58 206 Z"
        fill="url(#plate)"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M80 58 L120 58 L126 92 L74 92 Z" fill="url(#glass)" stroke={line} strokeWidth={1.5} />
      <Path
        d="M66 120 L134 120 M68 144 L132 144"
        stroke={line}
        strokeWidth={1.5}
        strokeOpacity={0.35}
      />
      <Path d="M74 216 L94 216 M106 216 L126 216" stroke={line} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
    </>
  );
}

/** One entry per ship id, so the roster and the art can be read side by side. */
const ART: Record<string, (props: { line: string }) => React.JSX.Element> = {
  drifter: Drifter,
  lance: Lance,
  bulwark: Bulwark,
};
