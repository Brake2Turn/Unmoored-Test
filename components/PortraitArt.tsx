import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import type { EntityId } from '@/lib/dialogue';
import { palette } from '@/lib/theme';

/**
 * Placeholder faces for whoever is speaking.
 *
 * **These are stand-ins.** They exist so a line of dialogue has someone
 * attached to it and so two speakers can be told apart at a glance; they are
 * not the art. Each is a head and one distinguishing mark, drawn from the same
 * few parts so the set looks like a set — a square head means a machine, a
 * round one means a person, and the mark says which person.
 *
 * Adding an entity to `MEETINGS` adds it to `EntityId`, and the compiler will
 * point at the table below until it has a face.
 */

/** Every portrait is drawn in this box and scaled by the caller. */
const BOX = 40;

type FaceProps = { stroke: string };

const HEAD_R = 12;
const CX = 20;
const CY = 19;

/** A person's head: the shape eight of the ten share. */
function RoundHead({ stroke }: FaceProps) {
  return <Circle cx={CX} cy={CY} r={HEAD_R} fill="none" stroke={stroke} strokeWidth={1.8} />;
}

/** A machine's head. Square, because a machine is not a person. */
function SquareHead({ stroke }: FaceProps) {
  return (
    <Rect
      x={CX - HEAD_R}
      y={CY - HEAD_R}
      width={HEAD_R * 2}
      height={HEAD_R * 2}
      rx={3}
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
    />
  );
}

function DotEyes({ stroke }: FaceProps) {
  return (
    <>
      <Circle cx={CX - 4.6} cy={CY - 2.4} r={1.5} fill={stroke} />
      <Circle cx={CX + 4.6} cy={CY - 2.4} r={1.5} fill={stroke} />
    </>
  );
}

function FlatMouth({ stroke }: FaceProps) {
  return (
    <Line
      x1={CX - 4}
      y1={CY + 5}
      x2={CX + 4}
      y2={CY + 5}
      stroke={stroke}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  );
}

/**
 * One entry per entity. A table rather than a switch, for the same reason
 * `ENCOUNTER_STYLE` is one: the next face is a row, not a branch.
 */
const FACES: Record<EntityId, (props: FaceProps) => React.JSX.Element> = {
  // The player. Round head under a peaked cap, mouth open mid-sentence.
  pilot: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <DotEyes stroke={stroke} />
      <Circle cx={CX} cy={CY + 5.6} r={2.4} fill="none" stroke={stroke} strokeWidth={1.5} />
      <Path
        d={`M ${CX - 11} ${CY - 7} A 11 9 0 0 1 ${CX + 11} ${CY - 7} Z`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Line
        x1={CX + 8}
        y1={CY - 7}
        x2={CX + 16}
        y2={CY - 7.6}
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </>
  ),

  // Square head, slot eyes, a grid where a mouth would be.
  ai: ({ stroke }) => (
    <>
      <SquareHead stroke={stroke} />
      <Rect x={CX - 6.5} y={CY - 5} width={3} height={5} fill={stroke} />
      <Rect x={CX + 3.5} y={CY - 5} width={3} height={5} fill={stroke} />
      <Rect
        x={CX - 6}
        y={CY + 3}
        width={12}
        height={5}
        fill="none"
        stroke={stroke}
        strokeWidth={1.3}
      />
      <Path
        d={`M ${CX - 2} ${CY + 3} V ${CY + 8} M ${CX + 2} ${CY + 3} V ${CY + 8} M ${CX - 6} ${CY + 5.5} H ${CX + 6}`}
        stroke={stroke}
        strokeWidth={1}
      />
    </>
  ),

  // One eye, one patch, and the strap that holds it.
  pirate: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <Circle cx={CX + 4.6} cy={CY - 2.4} r={1.5} fill={stroke} />
      <Rect x={CX - 8} y={CY - 5} width={6.4} height={5} rx={1.4} fill={stroke} />
      <Line
        x1={CX - 11.5}
        y1={CY - 6.5}
        x2={CX + 10}
        y2={CY - 8.5}
        stroke={stroke}
        strokeWidth={1.4}
      />
      <FlatMouth stroke={stroke} />
    </>
  ),

  // A visor instead of a face. Police do not have expressions.
  spacePolice: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <Rect x={CX - 10} y={CY - 5.5} width={20} height={5.5} rx={2} fill={stroke} opacity={0.9} />
      <FlatMouth stroke={stroke} />
    </>
  ),

  // Hat with a brim, and a salesman's smile.
  merchant: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <DotEyes stroke={stroke} />
      <Path
        d={`M ${CX - 5} ${CY + 4} Q ${CX} ${CY + 8.5} ${CX + 5} ${CY + 4}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Line x1={CX - 13} y1={CY - 8} x2={CX + 13} y2={CY - 8} stroke={stroke} strokeWidth={1.7} />
      <Path
        d={`M ${CX - 7} ${CY - 8} V ${CY - 13} H ${CX + 7} V ${CY - 8}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </>
  ),

  // The same trade, hooded. Eyes narrowed to slits.
  illegalMerchant: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <Line x1={CX - 7} y1={CY - 2.4} x2={CX - 2.5} y2={CY - 2.4} stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
      <Line x1={CX + 2.5} y1={CY - 2.4} x2={CX + 7} y2={CY - 2.4} stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
      <FlatMouth stroke={stroke} />
      <Path
        d={`M ${CX - 13.5} ${CY + 6} A 13.5 14 0 0 1 ${CX + 13.5} ${CY + 6}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </>
  ),

  // Long hauler: headset on, still talking.
  spaceTrucker: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <DotEyes stroke={stroke} />
      <FlatMouth stroke={stroke} />
      <Path
        d={`M ${CX - 13} ${CY - 1} A 13 13 0 0 1 ${CX + 13} ${CY - 1}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.7}
      />
      <Rect x={CX - 15.5} y={CY - 3} width={5} height={7} rx={2} fill={stroke} />
      <Rect x={CX + 10.5} y={CY - 3} width={5} height={7} rx={2} fill={stroke} />
      <Path
        d={`M ${CX - 13} ${CY + 4} Q ${CX - 9} ${CY + 9} ${CX - 4} ${CY + 7}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.3}
      />
    </>
  ),

  // Another drifter. Nothing on the head — that is the point of them.
  unmoored: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <DotEyes stroke={stroke} />
      <FlatMouth stroke={stroke} />
    </>
  ),

  // Nobody aboard: a dead screen with the lights out.
  abandonedShip: ({ stroke }) => (
    <>
      <SquareHead stroke={stroke} />
      <Path
        d={`M ${CX - 7} ${CY - 6} l 4.5 4.5 M ${CX - 2.5} ${CY - 6} l -4.5 4.5`}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d={`M ${CX + 2.5} ${CY - 6} l 4.5 4.5 M ${CX + 7} ${CY - 6} l -4.5 4.5`}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Line x1={CX - 5} y1={CY + 5} x2={CX + 5} y2={CY + 5} stroke={stroke} strokeWidth={1.4} opacity={0.5} />
    </>
  ),

  // Running from something, seen through the bars they got out of.
  convict: ({ stroke }) => (
    <>
      <RoundHead stroke={stroke} />
      <DotEyes stroke={stroke} />
      <FlatMouth stroke={stroke} />
      <Path
        d={`M ${CX - 6} ${CY - 13} V ${CY + 13} M ${CX + 1} ${CY - 13} V ${CY + 13}`}
        stroke={stroke}
        strokeWidth={1.5}
        opacity={0.75}
      />
    </>
  ),
};

/** One speaker's face, at whatever size the box has room for. */
export function PortraitArt({
  entity,
  size,
  stroke = palette.player,
}: {
  entity: EntityId;
  size: number;
  stroke?: string;
}) {
  const Face = FACES[entity] ?? FACES.unmoored;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <G>
        <Face stroke={stroke} />
      </G>
    </Svg>
  );
}
