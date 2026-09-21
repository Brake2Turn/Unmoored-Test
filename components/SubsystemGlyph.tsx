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

/** The reactor itself: a bolt, for the power nothing has claimed. */
export function ReactorGlyph({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 16 17">
      <Path
        d="M9.4 0.8 L3.2 9.6 H7.2 L6.6 16.2 L12.8 7.2 H8.8 Z"
        fill={color}
        fillOpacity={0.9}
      />
    </Svg>
  );
}
