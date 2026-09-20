import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { SHIP_BOX_H, SHIP_BOX_W, ShipArt, enginesFor, type Engine } from '@/components/ships/ShipArt';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';

type Props = {
  shipId: string;
  accent: string;
  /** The ship art's own size. The systems box around it is larger — see below. */
  width: number;
  height: number;
  /** Bars in shields: 0 draws nothing, and each one widens the bubble. */
  shields: number;
  /** Bars in piloting: 0 means cold engines, and each one lengthens the flame. */
  piloting: number;
  /** False holds the flame at a steady length instead of pulsing. */
  animate?: boolean;
};

/**
 * How much bigger the systems box is than the ship art inside it.
 *
 * The shield stands off the hull and the exhaust runs past the tail, so both
 * need room outside the ship's own 200×260 box. The helm has to know this
 * number to lay itself out, so it is exported rather than buried.
 */
export const SYSTEMS_SPAN = 1.4;

/**
 * The overlay box, in ship coordinates: the ship's box grown by `SYSTEMS_SPAN`
 * about its centre.
 *
 * Keeping the *same aspect ratio* as the ship box is what makes this work.
 * Both this and `ShipArt` letterbox their viewBox the same way, so ship
 * coordinates in an overlay land exactly where they land in the art — a
 * nozzle at y=232 is drawn on the ship's engine bar with no arithmetic.
 */
const VIEW_W = SHIP_BOX_W * SYSTEMS_SPAN;
const VIEW_H = SHIP_BOX_H * SYSTEMS_SPAN;
const VIEW_X = -(VIEW_W - SHIP_BOX_W) / 2;
const VIEW_Y = -(VIEW_H - SHIP_BOX_H) / 2;
const VIEW_BOX = `${VIEW_X} ${VIEW_Y} ${VIEW_W} ${VIEW_H}`;

/** Roughly the centre of mass of every hull, which is what a bubble sits on. */
const SHIELD_CX = 100;
const SHIELD_CY = 130;

/**
 * Bubble radii per bar. One bar already clears the widest ship (the Vesper's
 * sail spans 144 of the 200), so the smallest shield reads as a skin on the
 * hull rather than as nothing at all.
 */
const SHIELD_RX = (level: number) => 64 + 10 * level;
const SHIELD_RY = (level: number) => 108 + 10 * level;

/** Exhaust length per bar, in ship units. Four bars runs to 60 of the 260. */
const FLAME_BASE = 16;
const FLAME_PER_LEVEL = 11;

/** How far the flame stretches at the top of its pulse. */
const FLICKER_SCALE = 1.16;
const FLICKER_MS = 420;

/**
 * The player's ship with its powered systems drawn on it.
 *
 * Both are read straight off the reactor allocation, and both use their
 * subsystem's colour from `SUBSYSTEM_STYLE` — a cyan bubble is the shields
 * row, a violet flame is the piloting row. Moving a bar in the panel is meant
 * to be visible on the ship without reading a number.
 *
 * Only the helm uses this. The ship cards on the select screen show a bare
 * hull, because a ship you have not launched has no reactor running.
 */
export function ShipSystems({
  shipId,
  accent,
  width,
  height,
  shields,
  piloting,
  animate = true,
}: Props) {
  const engines = enginesFor(shipId);

  return (
    <View
      style={[styles.box, { width: width * SYSTEMS_SPAN, height: height * SYSTEMS_SPAN }]}
      pointerEvents="none"
    >
      <Thruster
        engines={engines}
        level={piloting}
        width={width * SYSTEMS_SPAN}
        height={height * SYSTEMS_SPAN}
        animate={animate}
      />

      <ShipArt shipId={shipId} accent={accent} width={width} height={height} />

      <Shield level={shields} width={width * SYSTEMS_SPAN} height={height * SYSTEMS_SPAN} />
    </View>
  );
}

/** The bubble, drawn over the hull so the ship shows through it. */
function Shield({ level, width, height }: { level: number; width: number; height: number }) {
  if (level <= 0) return null;

  const tint = SUBSYSTEM_STYLE.shields.accent;

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox={VIEW_BOX}>
      <Ellipse
        cx={SHIELD_CX}
        cy={SHIELD_CY}
        rx={SHIELD_RX(level)}
        ry={SHIELD_RY(level)}
        fill={tint}
        fillOpacity={0.035 + 0.022 * level}
        stroke={tint}
        strokeOpacity={0.26 + 0.15 * level}
        strokeWidth={1.3 + 0.5 * level}
      />
      {/* A second, tighter arc once there is real charge in it. */}
      {level >= 2 ? (
        <Ellipse
          cx={SHIELD_CX}
          cy={SHIELD_CY}
          rx={SHIELD_RX(level) - 7}
          ry={SHIELD_RY(level) - 7}
          fill="none"
          stroke={tint}
          strokeOpacity={0.06 * level}
          strokeWidth={1}
        />
      ) : null}
    </Svg>
  );
}

/**
 * The exhaust, drawn under the hull so it reads as coming out of the tail.
 *
 * The pulse is a `scaleY` anchored on the nozzle rather than on the middle of
 * the box, so the flame stretches away from the ship instead of sliding up
 * into it. Every hull's engines share one `y`, so one anchor does for all of
 * them, including the Bulwark's pair.
 */
function Thruster({
  engines,
  level,
  width,
  height,
  animate,
}: {
  engines: Engine[];
  level: number;
  width: number;
  height: number;
  animate: boolean;
}) {
  const flicker = useSharedValue(1);
  const lit = level > 0;

  useEffect(() => {
    if (!lit || !animate) {
      cancelAnimation(flicker);
      flicker.value = 1;
      return;
    }

    flicker.value = 1;
    flicker.value = withRepeat(
      withTiming(FLICKER_SCALE, { duration: FLICKER_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    return () => cancelAnimation(flicker);
  }, [animate, flicker, lit]);

  // Where the nozzle sits inside this box, so the stretch can be pinned to it.
  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  const nozzleY = (height - VIEW_H * scale) / 2 + (engines[0].y - VIEW_Y) * scale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flicker.value }],
    // Brightest at full stretch, which is what makes it read as burning.
    opacity: 0.72 + (flicker.value - 1) * 1.4,
  }));

  if (!lit) return null;

  const tint = SUBSYSTEM_STYLE.piloting.accent;
  const length = FLAME_BASE + FLAME_PER_LEVEL * level;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: ['50%', nozzleY, 0] },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox={VIEW_BOX}>
        {engines.map((engine, i) => (
          <React.Fragment key={i}>
            <Path
              d={flamePath(engine.x, engine.y, engine.width * 1.05, length)}
              fill={tint}
              fillOpacity={0.55}
            />
            {/* The hot core, shorter and narrower than the plume around it. */}
            <Path
              d={flamePath(engine.x, engine.y, engine.width * 0.5, length * 0.62)}
              fill="#FFFFFF"
              fillOpacity={0.5}
            />
          </React.Fragment>
        ))}
      </Svg>
    </Animated.View>
  );
}

/** A plume: full width at the nozzle, tapering to a point at its tip. */
function flamePath(x: number, y: number, width: number, length: number): string {
  const half = width / 2;
  return [
    `M ${x - half} ${y}`,
    `C ${x - half} ${y + length * 0.5}, ${x - half * 0.5} ${y + length * 0.78}, ${x} ${y + length}`,
    `C ${x + half * 0.5} ${y + length * 0.78}, ${x + half} ${y + length * 0.5}, ${x + half} ${y}`,
    'Z',
  ].join(' ');
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
