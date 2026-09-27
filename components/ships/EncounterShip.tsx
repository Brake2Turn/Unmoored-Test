import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useSvgIds } from '@/components/svgIds';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { palette } from '@/lib/theme';
import { EngineBlocks, EngineGlow, EngineGlowDefs, type Engine } from '@/components/ships/EngineArt';
import { HULL, HULL_DEEP } from '@/components/ships/ShipArt';
import type { SystemSpots } from '@/components/ships/SystemMarks';
import { WeaponShape, weaponTip } from '@/components/WeaponArt';
import type { Encounter } from '@/lib/sectorMap';

type Props = {
  encounter: Encounter;
  width: number;
  height: number;
  /**
   * Draw a friendly ship red: the pilot has fired on it and it is fighting
   * back. Its silhouette stays its own — only its colour and its gun change.
   */
  angry?: boolean;
  /** Bars in its Wren Drive, which light the engines on its tail. Absent draws them cold. */
  engines?: number;
};

/**
 * The ship waiting at a star, drawn at helm size.
 *
 * Both are drawn nose-down; `Sideways` turns that to face left, toward the
 * player's ship on the left of the screen, so arriving reads as a meeting
 * rather than two ships in the same frame. The silhouettes match the ones the
 * sector map used to carry: the Shrike is all swept angles, the merchant is a
 * blunt slab.
 */
export const EncounterShip = React.memo(function EncounterShip({
  encounter,
  width,
  height,
  angry = false,
  engines = 0,
}: Props) {
  const id = useSvgIds();
  if (encounter === 'empty') return null;

  const style = ENCOUNTER_STYLE[encounter];
  // The silhouette comes off what the ship is; the colour off how it is behaving.
  const raider = style.hostile;
  const hostile = raider || angry;
  const accent = hostile ? palette.danger : style.accent;
  const mount = raider ? SHRIKE_MOUNT : MERCHANT_MOUNT;
  const plate = `url(#${id('enc-plate')})`;
  const glass = `url(#${id('enc-glass')})`;
  const tail = raider ? SHRIKE_ENGINES : MERCHANT_ENGINES;
  const glowId = id('enc-engine-glow');

  return (
    <Svg width={width} height={height} viewBox="0 0 200 260">
      <Defs>
        <LinearGradient id={id('enc-glass')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity={0.85} />
          <Stop offset="1" stopColor={accent} stopOpacity={0.25} />
        </LinearGradient>
        <LinearGradient id={id('enc-plate')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hostile ? HOSTILE_HULL : HULL} />
          <Stop offset="1" stopColor={hostile ? HOSTILE_HULL_DEEP : HULL_DEEP} />
        </LinearGradient>
      </Defs>
      <EngineGlowDefs id={glowId} />
      {/* Under the hull, so what shows is the light spilling past the tail. */}
      <EngineGlow engines={tail} aft={-1} level={engines} glowId={glowId} />
      {raider ? (
        <Shrike accent={accent} plate={plate} glass={glass} />
      ) : (
        <Merchant accent={accent} plate={plate} glass={glass} />
      )}
      <EngineBlocks engines={tail} aft={-1} level={engines} line={accent} plate={plate} glowId={glowId} />
      {hostile ? (
        // The red ships' gun, turned round to point at the player.
        <G transform={`translate(${mount.x} ${mount.y}) rotate(180)`}>
          <WeaponShape weaponId={FOE_WEAPON} line={accent} fill={plate} />
        </G>
      ) : null}
    </Svg>
  );
});

/**
 * Every hostile ship carries a copy of Weapon 1, the player's own
 * placeholder, on the nose it points at the player — a provoked merchant
 * included.
 */
export const FOE_WEAPON = 'weapon1';

/**
 * Where each silhouette carries that gun: the Shrike on its lower fuselage
 * behind the nose, the merchant on the glazed bow it points at the player
 * with — which it only needs once it has been provoked.
 */
const SHRIKE_MOUNT = { x: 100, y: 200 };
const MERCHANT_MOUNT = { x: 100, y: 224 };

/**
 * The engines on each silhouette's tail — the top of the drawing, since both
 * are drawn nose-down. The Shrike carries a pair either side of its spine; the
 * merchant a pair across its blunt stern.
 */
const SHRIKE_ENGINES: Engine[] = [
  { x: 90, y: 50, width: 11 },
  { x: 110, y: 50, width: 11 },
];
const MERCHANT_ENGINES: Engine[] = [
  { x: 86, y: 54, width: 18 },
  { x: 114, y: 54, width: 18 },
];

/**
 * Where a hostile ship's bolt leaves, in its 200×260 box: the weapon's tip,
 * turned round with it, so a tip written as "up 33" comes out 33 lower.
 */
export function foeMuzzle(encounter: Encounter): { x: number; y: number } {
  const mount = ENCOUNTER_STYLE[encounter].hostile ? SHRIKE_MOUNT : MERCHANT_MOUNT;
  const tip = weaponTip(FOE_WEAPON);
  return { x: mount.x - tip.x, y: mount.y - tip.y };
}

/**
 * Where each silhouette carries its three subsystems, for `SystemMarks`: the
 * Shrike's shields and weapons out in its two swept wings with the Wren Drive
 * in the spine behind the cockpit; the merchant's in its two slung pods, the
 * Wren Drive amidships. The Elder Shrike is the Shrike drawn bigger.
 */
export function systemSpots(encounter: Encounter): SystemSpots {
  return ENCOUNTER_STYLE[encounter].hostile ? SHRIKE_SPOTS : MERCHANT_SPOTS;
}
const SHRIKE_SPOTS: SystemSpots = {
  shields: { x: 52, y: 94 },
  weapons: { x: 148, y: 94 },
  engines: { x: 100, y: 66 },
};
const MERCHANT_SPOTS: SystemSpots = {
  shields: { x: 46, y: 140 },
  weapons: { x: 154, y: 140 },
  engines: { x: 100, y: 90 },
};

/** Raider plating runs warmer than the player's, so the red reads as its own. */
const HOSTILE_HULL = '#1E1320';
const HOSTILE_HULL_DEEP = '#0C0711';

/** Swept raider, nose down. The Elder Shrike is this same hull, drawn bigger. */
function Shrike({ accent, plate, glass }: { accent: string; plate: string; glass: string }) {
  return (
    <>
      <Path
        d="M82 150 L22 74 L42 60 L86 122 Z"
        fill={plate}
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M118 150 L178 74 L158 60 L114 122 Z"
        fill={plate}
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M22 74 L17 95 M178 74 L183 95"
        stroke={accent}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.85}
      />

      <Path
        d="M100 246 L120 150 L116 54 L84 54 L80 150 Z"
        fill={plate}
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx={100} cy={116} rx={10} ry={26} fill={glass} stroke={accent} strokeWidth={1.5} />
    </>
  );
}

/** Blunt freighter with its cargo slung outboard. Nothing sharp on it. */
function Merchant({ accent, plate, glass }: { accent: string; plate: string; glass: string }) {
  return (
    <>
      <Rect x={32} y={94} width={28} height={88} rx={9} fill={plate} stroke={accent} strokeWidth={2} />
      <Rect x={140} y={94} width={28} height={88} rx={9} fill={plate} stroke={accent} strokeWidth={2} />
      <Path
        d="M37 104 L55 104 M37 120 L55 120 M145 104 L163 104 M145 120 L163 120"
        stroke={accent}
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />

      <Rect x={66} y={58} width={68} height={148} rx={14} fill={plate} stroke={accent} strokeWidth={2} />
      <Path d="M66 108 L134 108 M66 152 L134 152" stroke={accent} strokeWidth={1.5} strokeOpacity={0.3} />

      <Path
        d="M78 206 L122 206 L112 234 L88 234 Z"
        fill={glass}
        stroke={accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </>
  );
}
