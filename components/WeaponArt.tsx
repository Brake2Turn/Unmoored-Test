import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/**
 * What each weapon looks like — placeholders, one silhouette per weapon so
 * the three can be told apart at a glance.
 *
 * Drawn once, used twice: `WeaponShape` goes onto a ship's nose inside the
 * ship's own SVG, and `WeaponIcon` draws the same shape on its own for the
 * hardpoint and the hold. The shape a player drags into cargo is the shape
 * that disappears off the ship.
 *
 * Coordinates are the ship art's units, with the origin at the mount point
 * and the barrel pointing up (toward the ship's nose). Everything sits inside
 * x ±13, y −34…+4, which is what the icon's box is cut to.
 */

type ShapeProps = {
  weaponId: string;
  line: string;
  /** The hull colour on a ship; nothing on an icon, which is an outline. */
  fill: string;
  strokeWidth?: number;
};

export function WeaponShape({ weaponId, line, fill, strokeWidth = 2 }: ShapeProps) {
  const common = {
    stroke: line,
    strokeWidth,
    strokeLinejoin: 'round' as const,
    fill,
  };

  if (weaponId === 'weapon2') {
    // Twin barrels on a wide base.
    return (
      <>
        <Rect x={-9} y={-27} width={4} height={21} rx={1.5} {...common} />
        <Rect x={5} y={-27} width={4} height={21} rx={1.5} {...common} />
        <Rect x={-13} y={-8} width={26} height={12} rx={4} {...common} />
      </>
    );
  }

  if (weaponId === 'weapon3') {
    // A single spike off a round turret, with two short prongs.
    return (
      <>
        <Path d="M-4 -8 L0 -34 L4 -8 Z" {...common} />
        <Path d="M-7 -6 L-11 -18 M7 -6 L11 -18" stroke={line} strokeWidth={strokeWidth} strokeLinecap="round" />
        <Circle cx={0} cy={-2} r={8} {...common} />
        <Circle cx={0} cy={-2} r={3} fill={line} opacity={0.8} />
      </>
    );
  }

  // weapon1, and anything unknown: one long barrel on a square base.
  return (
    <>
      <Rect x={-2.5} y={-30} width={5} height={24} rx={1.5} {...common} />
      <Rect x={-4} y={-33} width={8} height={4} rx={1} {...common} />
      <Rect x={-9} y={-8} width={18} height={12} rx={3} {...common} />
    </>
  );
}

/** A weapon drawn on a ship, at the ship's mount point. */
export function MountedWeapon({
  weaponId,
  x,
  y,
  line,
  fill,
}: {
  weaponId: string;
  x: number;
  y: number;
  line: string;
  fill: string;
}) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <WeaponShape weaponId={weaponId} line={line} fill={fill} />
    </G>
  );
}

/** The icon's box: the shapes' extent, squared up with a little air. */
const ICON_BOX = 44;
const ICON_VIEW = `-22 -37 ${ICON_BOX} ${ICON_BOX}`;

/** A weapon on its own, for the hardpoint and the cargo slots. */
export function WeaponIcon({
  weaponId,
  size,
  color,
}: {
  weaponId: string;
  size: number;
  color: string;
}) {
  // Keeps the line about a pixel and a quarter wide at any size, so the icon
  // neither vanishes in a tab nor turns heavy in the panel.
  const strokeWidth = Math.max(2, (ICON_BOX / size) * 1.25);
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEW}>
      <WeaponShape weaponId={weaponId} line={color} fill="none" strokeWidth={strokeWidth} />
    </Svg>
  );
}
