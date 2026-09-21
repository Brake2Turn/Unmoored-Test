import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { Subsystem } from '@/lib/energy';

/**
 * The marks that stand in for the subsystem names.
 *
 * Shared by both states of the reactor panel, which is the point: the compact
 * panel has no room for words, so the icons have to carry the meaning on their
 * own, and they can only do that if they are the same marks the player learned
 * from the expanded controls.
 */
export function SubsystemGlyph({
  subsystem,
  color,
  size = 13,
}: {
  subsystem: Subsystem;
  color: string;
  size?: number;
}) {
  const height = size * 1.08;

  if (subsystem === 'shields') {
    return (
      <Svg width={size} height={height} viewBox="0 0 16 17">
        <Path
          d="M8 1 L14.5 3.6 V8.6 C14.5 12.4 11.7 15.2 8 16 C4.3 15.2 1.5 12.4 1.5 8.6 V3.6 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (subsystem === 'weapons') {
    return (
      <Svg width={size} height={height} viewBox="0 0 16 17">
        <Circle cx={8} cy={8.5} r={4.6} fill="none" stroke={color} strokeWidth={1.6} />
        <Line x1={8} y1={0.6} x2={8} y2={3.2} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={8} y1={13.8} x2={8} y2={16.4} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={0.6} y1={8.5} x2={3.2} y2={8.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={12.8} y1={8.5} x2={15.4} y2={8.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  // Engines: a dart, nose up, the same silhouette the ships are built from.
  return (
    <Svg width={size} height={height} viewBox="0 0 16 17">
      <Path
        d="M8 0.8 L14.2 15.6 L8 12.4 L1.8 15.6 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The hold: a crate, seen face on. */
export function CargoGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M2.2 4.6 L8 1.6 L13.8 4.6 V12.2 L8 15.2 L2.2 12.2 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path d="M2.2 4.6 L8 7.6 L13.8 4.6 M8 7.6 V15.2" fill="none" stroke={color} strokeWidth={1.2} strokeOpacity={0.7} />
    </Svg>
  );
}

/** The crew: a head and shoulders. */
export function CrewGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Circle cx={8} cy={5} r={3.1} fill="none" stroke={color} strokeWidth={1.5} />
      <Path
        d="M2.4 15.4 C2.4 11.3 5 9.4 8 9.4 C11 9.4 13.6 11.3 13.6 15.4"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * A bolt, for the power nothing has claimed.
 *
 * Drawn as an outline like every other mark here. It was a solid shape, which
 * made it the one filled glyph in the set and gave it a weight the others do
 * not have — it read as the loudest thing in the tab rather than as a quiet
 * footnote about spare power.
 */
export function ReactorGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M9.4 0.8 L3.2 9.6 H7.2 L6.6 16.2 L12.8 7.2 H8.8 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * The reactor tab's own mark: a power station, waisted like a cooling tower.
 *
 * Deliberately not the bolt. The bolt means *unclaimed* power and already
 * appears inside this tab next to the number, so it cannot also stand for the
 * tab as a whole — the section and one reading inside it would look like the
 * same thing. Straight edges rather than curves because this is drawn at
 * eleven pixels, where a curve turns to mush.
 */
export function SubstationGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M4.8 2.2 H11.2 L10.1 8.2 L13.4 15 H2.6 L5.9 8.2 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
