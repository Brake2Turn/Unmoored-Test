import React from 'react';
import { View } from 'react-native';

/**
 * Lays a ship on its side: turned a quarter clockwise, so art drawn nose-up
 * faces right and art drawn nose-down faces left.
 *
 * Every ship is still drawn upright in its own 200×260 box — the art, the
 * shield, the exhaust and the gun are unchanged — and this turns the whole
 * of it at once. A rotation does not change how much room a view takes in
 * the layout, so the outer box here is given the turned size (`height` wide,
 * `width` tall) and the art is centred inside it before it is turned.
 *
 * Anything aimed at a turned ship goes through `sidewaysPoint`, which does
 * the same turn on paper. The outer box is what gets measured, never the
 * turned one: how a turned view measures differs between web and phones.
 */
export function Sideways({
  width,
  height,
  children,
}: {
  /** The upright art's width and height; the box on screen is these swapped. */
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ width: height, height: width, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width, height, transform: [{ rotate: '90deg' }] }}>{children}</View>
    </View>
  );
}

/**
 * Where a point on an upright drawing ends up once `Sideways` has turned it.
 *
 * `box` is the measured outer box. `dx` and `dy` are the point's offset from
 * the drawing's centre in on-screen pixels, as it would be upright. A quarter
 * turn clockwise sends up to right and right to down: (dx, dy) → (−dy, dx).
 */
export function sidewaysPoint(
  box: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
): { x: number; y: number } {
  return { x: box.x + box.width / 2 - dy, y: box.y + box.height / 2 + dx };
}
