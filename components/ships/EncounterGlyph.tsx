import React from 'react';
import { G, Path } from 'react-native-svg';

import type { Encounter } from '@/lib/sectorMap';

type Props = {
  encounter: Encounter;
  /** Centre of the glyph, in the parent Svg's coordinates. */
  cx: number;
  cy: number;
  /** Width and height of the glyph box. */
  size: number;
  colour: string;
  opacity?: number;
};

/**
 * Markers drawn on each star of the sector map, inside the map's own `Svg`.
 *
 * Shape carries the kind and colour reinforces it: the Shrike is a sharp dart
 * turned toward anyone coming up from below, the merchant is a blunt cargo pod.
 * The boss is the same Shrike drawn larger — it is the same ship, grown.
 *
 * Both are authored in a 24×24 box and scaled by the caller, so they stay
 * legible at map size.
 */
export function EncounterGlyph({ encounter, cx, cy, size, colour, opacity = 1 }: Props) {
  if (encounter === 'empty') return null;

  const scale = size / 24;
  const transform = `translate(${cx - size / 2}, ${cy - size / 2}) scale(${scale})`;

  return (
    <G transform={transform} opacity={opacity}>
      {encounter === 'merchant' ? <MerchantPod colour={colour} /> : <Shrike colour={colour} />}
    </G>
  );
}

/** Predatory dart, nose down toward the ships coming up the sector. */
function Shrike({ colour }: { colour: string }) {
  return (
    <>
      <Path d="M12 21.5 L19.2 6.5 L12 9.4 L4.8 6.5 Z" fill={colour} />
      <Path
        d="M19.2 6.5 L21.6 11.6 M4.8 6.5 L2.4 11.6"
        stroke={colour}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  );
}

/** Blunt hexagonal hauler — nothing sharp anywhere on it. */
function MerchantPod({ colour }: { colour: string }) {
  return (
    <>
      <Path
        d="M12 3.6 L18.6 7.6 L18.6 16.4 L12 20.4 L5.4 16.4 L5.4 7.6 Z"
        fill={colour}
        fillOpacity={0.9}
      />
      <Path d="M5.4 12 L18.6 12" stroke="#05070F" strokeWidth={1.5} strokeOpacity={0.55} />
    </>
  );
}
