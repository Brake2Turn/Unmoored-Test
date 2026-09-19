import React from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = { shipId: string; accent: string; width: number; height: number };

/** Dark silhouette that lets the accent-coloured edges and glass do the work. */
const HULL = '#141A2E';
const HULL_DEEP = '#0B0F1E';

/**
 * Vector art for each ship, drawn in a shared 200×260 box so every silhouette
 * sits on the same baseline and swipes between cleanly.
 */
export function ShipArt({ shipId, accent, width, height }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 260">
      <Defs>
        <LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity={0.85} />
          <Stop offset="1" stopColor={accent} stopOpacity={0.25} />
        </LinearGradient>
        <LinearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={HULL} />
          <Stop offset="1" stopColor={HULL_DEEP} />
        </LinearGradient>
      </Defs>
      {shipId === 'lance' ? (
        <Lance accent={accent} />
      ) : shipId === 'bulwark' ? (
        <Bulwark accent={accent} />
      ) : (
        <Drifter accent={accent} />
      )}
    </Svg>
  );
}

/** Survey cutter: twin forward prongs, domed canopy, V-notched hull. */
function Drifter({ accent }: { accent: string }) {
  return (
    <>
      <Rect x={48} y={34} width={24} height={92} rx={8} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Rect x={128} y={34} width={24} height={92} rx={8} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Rect x={53} y={40} width={14} height={20} rx={5} fill={accent} opacity={0.8} />
      <Rect x={133} y={40} width={14} height={20} rx={5} fill={accent} opacity={0.8} />

      <Path d="M68 124 A32 32 0 0 1 132 124 Z" fill="url(#glass)" stroke={accent} strokeWidth={2} />

      <Path
        d="M52 122 L148 122 L136 198 L100 240 L64 198 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M78 146 L100 196 L122 146" fill="none" stroke={accent} strokeWidth={2} strokeOpacity={0.5} />
      <Path d="M86 232 L114 232" stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </>
  );
}

/** Interceptor: needle nose, swept wings, everything stripped out. */
function Lance({ accent }: { accent: string }) {
  return (
    <>
      <Path
        d="M114 118 L162 196 L138 204 L116 166 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M86 118 L38 196 L62 204 L84 166 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M100 18 L116 112 L120 198 L100 216 L80 198 L84 112 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx={100} cy={86} rx={13} ry={26} fill="url(#glass)" stroke={accent} strokeWidth={1.5} />
      <Path d="M92 210 L108 210" stroke={accent} strokeWidth={5} strokeLinecap="round" />
    </>
  );
}

/** Heavy hauler: slab body, external cargo pods, blunt everything. */
function Bulwark({ accent }: { accent: string }) {
  return (
    <>
      <Rect x={28} y={104} width={30} height={94} rx={9} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Rect x={142} y={104} width={30} height={94} rx={9} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Path d="M33 186 L53 186 M147 186 L167 186" stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={0.85} />

      <Path
        d="M70 40 L130 40 L142 206 L58 206 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M80 58 L120 58 L126 92 L74 92 Z" fill="url(#glass)" stroke={accent} strokeWidth={1.5} />
      <Path
        d="M66 120 L134 120 M68 144 L132 144"
        stroke={accent}
        strokeWidth={1.5}
        strokeOpacity={0.35}
      />
      <Path d="M74 216 L94 216 M106 216 L126 216" stroke={accent} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
    </>
  );
}
