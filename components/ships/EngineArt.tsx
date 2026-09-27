import React from 'react';
import { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

import { SUBSYSTEM_CAPACITY } from '@/lib/energy';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';

/**
 * Where an engine sits on a hull, in the ship's 200×260 box: the middle of
 * its mouth's edge, and how wide the mouth is.
 */
export type Engine = { x: number; y: number; width: number };

/**
 * Which way the engines point, in the upright drawing: `1` for the player's
 * ships, drawn nose-up with their tails at the bottom, `-1` for the ships
 * waiting at a star, drawn nose-down with their tails at the top.
 */
export type Aft = 1 | -1;

/**
 * The engine block on a ship's tail, and how hard it is running.
 *
 * There is no flame. The Wren Drive shows as the engine's mouth lighting up —
 * dead and dark with nothing in it, then orange, then hotter and whiter with
 * every bar — and as a glow out of the back and round the block (`EngineGlow`).
 */

/** The block the mouth is cut into: this much wider than the mouth, and this long. */
const HOUSING_PAD = 4;
const HOUSING_LENGTH = 12;
const MOUTH_DEPTH = 3.2;

/** The mouth of a cold engine: dark metal, nothing behind it. */
const DEAD = '#262B3B';

/** How strongly the mouth shows the engines' orange, and the white heat in it, per bar. */
const MOUTH = [0, 0.55, 0.72, 0.88, 1];
const CORE = [0, 0.12, 0.32, 0.56, 0.85];
/** How bright the glow out of the back is, per bar. */
const GLOW = [0, 0.32, 0.52, 0.72, 0.92];
/** The halo round the block itself, drawn over the hull. */
const HALO = [0, 0.18, 0.28, 0.38, 0.5];

function bars(level: number): number {
  return Math.max(0, Math.min(SUBSYSTEM_CAPACITY, Math.round(level)));
}

/**
 * The engine blocks, with their mouths lit by how many bars are in the Wren
 * Drive. Drawn *over* the hull, inside the ship's own `<Svg>`. `glowId` names
 * a gradient `EngineGlowDefs` has put in the same drawing.
 */
export function EngineBlocks({
  engines,
  aft,
  level,
  line,
  plate,
  glowId,
}: {
  engines: Engine[];
  aft: Aft;
  level: number;
  line: string;
  plate: string;
  glowId: string;
}) {
  const n = bars(level);
  const hot = SUBSYSTEM_STYLE.engines.accent;
  return (
    <>
      {engines.map((engine, i) => {
        const half = engine.width / 2 + HOUSING_PAD;
        // The block runs forward from the mouth, into the hull.
        const top = aft === 1 ? engine.y - HOUSING_LENGTH + MOUTH_DEPTH : engine.y - MOUTH_DEPTH;
        const mouthY = engine.y + aft * MOUTH_DEPTH;
        return (
          <React.Fragment key={i}>
            {n > 0 ? (
              <Ellipse
                cx={engine.x}
                cy={mouthY}
                rx={half + 7}
                ry={HOUSING_LENGTH * 0.9}
                fill={`url(#${glowId})`}
                opacity={HALO[n]}
              />
            ) : null}
            <Rect
              x={engine.x - half}
              y={top}
              width={half * 2}
              height={HOUSING_LENGTH}
              rx={3}
              fill={plate}
              stroke={line}
              strokeWidth={1.5}
            />
            <Ellipse cx={engine.x} cy={mouthY} rx={engine.width / 2} ry={MOUTH_DEPTH} fill={DEAD} />
            {n > 0 ? (
              <>
                <Ellipse
                  cx={engine.x}
                  cy={mouthY}
                  rx={engine.width / 2}
                  ry={MOUTH_DEPTH}
                  fill={hot}
                  fillOpacity={MOUTH[n]}
                />
                <Ellipse
                  cx={engine.x}
                  cy={mouthY}
                  rx={engine.width * 0.3}
                  ry={MOUTH_DEPTH * 0.55}
                  fill="#FFFFFF"
                  fillOpacity={CORE[n]}
                />
              </>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

/** The gradient every glow is painted with: white-hot in the middle, orange, then nothing. */
export function EngineGlowDefs({ id }: { id: string }) {
  const hot = SUBSYSTEM_STYLE.engines.accent;
  return (
    <Defs>
      <RadialGradient id={id} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#FFE9CC" stopOpacity={0.9} />
        <Stop offset="0.3" stopColor={hot} stopOpacity={0.7} />
        <Stop offset="1" stopColor={hot} stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

/**
 * The glow out of the back of each engine: an oval of light centred just
 * behind the mouth, reaching back along the way the engine points and a
 * little round its sides. Drawn *under* the hull, so what shows is the part
 * spilling past the tail. Nothing at all with no bars.
 */
export function EngineGlow({
  engines,
  aft,
  level,
  glowId,
}: {
  engines: Engine[];
  aft: Aft;
  level: number;
  glowId: string;
}) {
  const n = bars(level);
  if (n === 0) return null;
  return (
    <>
      {engines.map((engine, i) => (
        <Ellipse
          key={i}
          cx={engine.x}
          cy={engine.y + aft * 12}
          rx={engine.width * 0.8 + 10}
          ry={engine.width * 0.45 + 20}
          fill={`url(#${glowId})`}
          opacity={GLOW[n]}
        />
      ))}
    </>
  );
}
