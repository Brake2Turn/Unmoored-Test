import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { HULL, HULL_DEEP } from '@/components/ships/ShipArt';
import { WeaponShape, weaponTip } from '@/components/WeaponArt';
import type { Encounter } from '@/lib/sectorMap';

type Props = {
  encounter: Encounter;
  width: number;
  height: number;
};

/**
 * The ship waiting at a star, drawn at helm size.
 *
 * Both face nose-down, toward the player's ship at the bottom of the screen,
 * so arriving reads as a meeting rather than two ships in the same frame. The
 * silhouettes match the ones the sector map used to carry: the Shrike is all
 * swept angles, the merchant is a blunt slab.
 */
export const EncounterShip = React.memo(function EncounterShip({
  encounter,
  width,
  height,
}: Props) {
  if (encounter === 'empty') return null;

  const { accent, hostile } = ENCOUNTER_STYLE[encounter];

  return (
    <Svg width={width} height={height} viewBox="0 0 200 260">
      <Defs>
        <LinearGradient id="enc-glass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity={0.85} />
          <Stop offset="1" stopColor={accent} stopOpacity={0.25} />
        </LinearGradient>
        <LinearGradient id="enc-plate" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hostile ? HOSTILE_HULL : HULL} />
          <Stop offset="1" stopColor={hostile ? HOSTILE_HULL_DEEP : HULL_DEEP} />
        </LinearGradient>
      </Defs>
      {hostile ? <Shrike accent={accent} /> : <Merchant accent={accent} />}
      {hostile ? (
        // The red ships' gun, turned round to point at the player.
        <G transform={`translate(${FOE_MOUNT.x} ${FOE_MOUNT.y}) rotate(180)`}>
          <WeaponShape weaponId={FOE_WEAPON} line={accent} fill="url(#enc-plate)" />
        </G>
      ) : null}
    </Svg>
  );
});

/**
 * Every red ship carries a copy of Weapon 1, the player's own placeholder,
 * mounted on the lower fuselage just behind the nose and pointing down.
 */
export const FOE_WEAPON = 'weapon1';
const FOE_MOUNT = { x: 100, y: 200 };

/**
 * Where a red ship's bolt leaves, in its 200×260 box: the weapon's tip,
 * turned round with it, so a tip written as "up 33" comes out 33 lower.
 */
export const FOE_MUZZLE = (() => {
  const tip = weaponTip(FOE_WEAPON);
  return { x: FOE_MOUNT.x - tip.x, y: FOE_MOUNT.y - tip.y };
})();

/** Raider plating runs warmer than the player's, so the red reads as its own. */
const HOSTILE_HULL = '#1E1320';
const HOSTILE_HULL_DEEP = '#0C0711';

/** Swept raider, nose down. The Elder Shrike is this same hull, drawn bigger. */
function Shrike({ accent }: { accent: string }) {
  return (
    <>
      <Path
        d="M82 150 L22 74 L42 60 L86 122 Z"
        fill="url(#enc-plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M118 150 L178 74 L158 60 L114 122 Z"
        fill="url(#enc-plate)"
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
        fill="url(#enc-plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx={100} cy={116} rx={10} ry={26} fill="url(#enc-glass)" stroke={accent} strokeWidth={1.5} />
      <Path
        d="M86 50 L97 50 M103 50 L114 50"
        stroke={accent}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.9}
      />
    </>
  );
}

/** Blunt freighter with its cargo slung outboard. Nothing sharp on it. */
function Merchant({ accent }: { accent: string }) {
  return (
    <>
      <Rect x={32} y={94} width={28} height={88} rx={9} fill="url(#enc-plate)" stroke={accent} strokeWidth={2} />
      <Rect x={140} y={94} width={28} height={88} rx={9} fill="url(#enc-plate)" stroke={accent} strokeWidth={2} />
      <Path
        d="M37 104 L55 104 M37 120 L55 120 M145 104 L163 104 M145 120 L163 120"
        stroke={accent}
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />

      <Rect x={66} y={58} width={68} height={148} rx={14} fill="url(#enc-plate)" stroke={accent} strokeWidth={2} />
      <Path d="M66 108 L134 108 M66 152 L134 152" stroke={accent} strokeWidth={1.5} strokeOpacity={0.3} />

      <Path
        d="M78 206 L122 206 L112 234 L88 234 Z"
        fill="url(#enc-glass)"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M76 54 L96 54 M104 54 L124 54"
        stroke={accent}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.85}
      />
    </>
  );
}
