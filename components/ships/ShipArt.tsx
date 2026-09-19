import React from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

type Props = {
  shipId: string;
  accent: string;
  width: number;
  height: number;
  /** Draws the ship in cold grey instead of its own colour. */
  locked?: boolean;
};

/** Every edge and light on a locked ship drops to this. */
const LOCKED_TINT = '#3E4763';

/** Dark silhouette that lets the accent-coloured edges and glass do the work. */
const HULL = '#141A2E';
const HULL_DEEP = '#0B0F1E';

/**
 * Vector art for each ship, drawn in a shared 200×260 box so every silhouette
 * sits on the same baseline and swipes between cleanly.
 */
export function ShipArt({ shipId, accent, width, height, locked = false }: Props) {
  const tint = locked ? LOCKED_TINT : accent;
  return (
    <Svg width={width} height={height} viewBox="0 0 200 260">
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
      {shipId === 'lance' ? (
        <Lance accent={tint} />
      ) : shipId === 'bulwark' ? (
        <Bulwark accent={tint} />
      ) : shipId === 'halo' ? (
        <Halo accent={tint} />
      ) : shipId === 'mantis' ? (
        <Mantis accent={tint} />
      ) : shipId === 'vesper' ? (
        <Vesper accent={tint} />
      ) : (
        <Drifter accent={tint} />
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

/** Ring tender: the hull is a torus, the cargo rides inside the hole. */
function Halo({ accent }: { accent: string }) {
  return (
    <>
      <Rect x={92} y={34} width={16} height={190} rx={7} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Circle cx={100} cy={132} r={62} fill="none" stroke="url(#plate)" strokeWidth={26} />
      <Circle cx={100} cy={132} r={75} fill="none" stroke={accent} strokeWidth={2} />
      <Circle cx={100} cy={132} r={49} fill="none" stroke={accent} strokeWidth={2} strokeOpacity={0.6} />
      <Path
        d="M100 57 L100 70 M175 132 L162 132 M100 207 L100 194 M25 132 L38 132"
        stroke={accent}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.8}
      />
      <Circle cx={100} cy={56} r={13} fill="url(#glass)" stroke={accent} strokeWidth={1.5} />
      <Path d="M92 220 L108 220" stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </>
  );
}

/** Salvage craft: a narrow body between two forward grappling claws. */
function Mantis({ accent }: { accent: string }) {
  return (
    <>
      <Path
        d="M84 98 C 50 112 38 154 52 192 L68 184 C 58 154 66 124 88 116 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M116 98 C 150 112 162 154 148 192 L132 184 C 142 154 134 124 112 116 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M100 30 L118 88 L112 206 L88 206 L82 88 Z"
        fill="url(#plate)"
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Ellipse cx={100} cy={74} rx={12} ry={22} fill="url(#glass)" stroke={accent} strokeWidth={1.5} />
      <Path d="M52 192 L46 202 M148 192 L154 202" stroke={accent} strokeWidth={3} strokeLinecap="round" />
      <Path d="M90 214 L110 214" stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </>
  );
}

/** Sail clipper: an enormous solar sail dragging a very small boat. */
function Vesper({ accent }: { accent: string }) {
  return (
    <>
      <Path
        d="M100 22 L172 178 L28 178 Z"
        fill={accent}
        fillOpacity={0.09}
        stroke={accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M100 22 L100 178 M100 22 L64 178 M100 22 L136 178"
        stroke={accent}
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />
      <Path d="M56 150 L144 150" stroke={accent} strokeWidth={1.5} strokeOpacity={0.3} />
      <Rect x={90} y={168} width={20} height={56} rx={9} fill="url(#plate)" stroke={accent} strokeWidth={2} />
      <Circle cx={100} cy={184} r={7} fill="url(#glass)" stroke={accent} strokeWidth={1.2} />
      <Path d="M93 228 L107 228" stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
    </>
  );
}
