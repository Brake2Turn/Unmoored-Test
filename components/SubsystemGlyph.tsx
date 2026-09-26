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
 * The reactor's mark: a power station, waisted like a cooling tower. It sits
 * with the word REACTOR and the energy nothing has claimed, at the right of
 * the subsystems header. Straight edges rather than curves because it is
 * drawn at twelve pixels, where a curve turns to mush.
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

/**
 * The ship section's mark: a small rocket with fins and a porthole.
 *
 * Not the engines' dart, which is already a ship-shaped mark in the reactor;
 * this one is rounded and finned so the two cannot be taken for each other.
 */
export function ShipGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M8 1.2 C10.6 3.6 11.4 7 11.4 10.4 V14.6 H4.6 V10.4 C4.6 7 5.4 3.6 8 1.2 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M4.6 10.6 L1.8 14.6 H4.6 M11.4 10.6 L14.2 14.6 H11.4"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Circle cx={8} cy={7.4} r={1.6} fill="none" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

/**
 * The subsystems section's mark: three sliders, each set to a different level
 * — power shared out across rows, which is what the section is for. It took
 * over the section's name from REACTOR, whose power-station mark now labels
 * the spare energy instead.
 */
export function SubsystemsGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M1.5 3.5 H14.5 M1.5 8.5 H14.5 M1.5 13.5 H14.5"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeOpacity={0.55}
      />
      <Circle cx={10.5} cy={3.5} r={1.9} fill="none" stroke={color} strokeWidth={1.5} />
      <Circle cx={5} cy={8.5} r={1.9} fill="none" stroke={color} strokeWidth={1.5} />
      <Circle cx={8.5} cy={13.5} r={1.9} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}
