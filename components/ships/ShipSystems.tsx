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
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { SHIP_BOX_H, SHIP_BOX_W, ShipArt, enginesFor, type Engine } from '@/components/ships/ShipArt';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';

type Props = {
  shipId: string;
  accent: string;
  /** The ship art's own size. The systems box around it is larger — see below. */
  width: number;
  height: number;
  /** Bars in shields: 0 draws nothing, and each one makes the bubble stronger. */
  shields: number;
  /** Bars in engines: 0 means cold engines, and each one lengthens the flame. */
  engines: number;
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
 * The bubble is one size at every power level — a shield envelope is a fixed
 * shape, and only how hard it is running changes. It stands well clear of the
 * widest hull (the Vesper's sail spans 144 of the 200), so the rim never sits
 * on top of the ship.
 */
const SHIELD_RX = 96;
const SHIELD_RY = 140;

/**
 * Strength per bar. Both ramps start high enough that one bar reads as a
 * powered shield rather than a smudge, and end near solid at four.
 */
const SHIELD_FILL = (level: number) => 0.12 + 0.15 * level;
const SHIELD_STROKE = (level: number) => 0.16 + 0.17 * level;

/**
 * Where the envelope starts to show, as a fraction of the way out from the
 * centre. Everything inside it is fully transparent at every level.
 *
 * 0.82 is measured, not chosen: the furthest corner of any hull — the Lance's
 * nose and wingtips, the Halo's ring — sits at about 0.80 of these radii, so
 * the colour only begins once the ship has ended. That is what keeps the ship
 * as readable at four bars as at one; more power brightens the rim instead of
 * fogging the hull.
 */
const SHIELD_CLEAR = 0.82;

/**
 * The plating: dashed shells and radial ribs, drawn only in the band between
 * `SHIELD_CLEAR` and the rim.
 *
 * Each element carries its own opacity rather than sampling the gradient,
 * because a gradient in `objectBoundingBox` units is measured against *each
 * element's own* box — an inner ring would get its own little gradient
 * instead of the shield's. Spelling the weights out keeps the fade honest:
 * the outermost shell is solid-looking and densely dashed, and each one
 * further in is thinner, sparser and fainter, until nothing is drawn at all.
 */
const TEXTURE_RINGS = [
  { t: 0.975, dash: '14 7', weight: 1, width: 1.1 },
  { t: 0.93, dash: '7 11', weight: 0.66, width: 0.9 },
  { t: 0.87, dash: '3 14', weight: 0.4, width: 0.8 },
];

/** Ribs run inward from the rim, stopping short of the ship. */
const RIB_COUNT = 16;
const RIB_INNER = 0.88;
const RIB_WEIGHT = 0.5;

/** How strongly the plating shows, before each element's own weight. */
const TEXTURE_OPACITY = (level: number) => 0.1 + 0.16 * level;

/**
 * The ribs as a single path, built once: sixteen short spokes around the rim.
 */
const RIB_PATH = (() => {
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts: string[] = [];
  for (let i = 0; i < RIB_COUNT; i++) {
    const angle = (i / RIB_COUNT) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    parts.push(
      `M ${round(SHIELD_CX + SHIELD_RX * RIB_INNER * cos)} ${round(SHIELD_CY + SHIELD_RY * RIB_INNER * sin)}`,
      `L ${round(SHIELD_CX + SHIELD_RX * cos)} ${round(SHIELD_CY + SHIELD_RY * sin)}`,
    );
  }
  return parts.join(' ');
})();

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
 * row, a violet flame is the engines row. Moving a bar in the panel is meant
 * to be visible on the ship without reading a number: the shield holds its
 * shape and grows brighter, the exhaust grows longer.
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
  engines,
  animate = true,
}: Props) {
  // The hull's exhaust ports, as distinct from the bars powering them.
  const nozzles = enginesFor(shipId);

  return (
    <View
      style={[styles.box, { width: width * SYSTEMS_SPAN, height: height * SYSTEMS_SPAN }]}
      pointerEvents="none"
    >
      <Thruster
        nozzles={nozzles}
        level={engines}
        width={width * SYSTEMS_SPAN}
        height={height * SYSTEMS_SPAN}
        animate={animate}
      />

      <ShipArt shipId={shipId} accent={accent} width={width} height={height} />

      <Shield level={shields} width={width * SYSTEMS_SPAN} height={height * SYSTEMS_SPAN} />
    </View>
  );
}

/**
 * The bubble, drawn over the hull.
 *
 * Fixed size, and the power level is carried entirely by how strongly it
 * shows. The fill is a radial gradient that is clear through the middle and
 * gathers at the rim, so more power makes a brighter edge rather than a
 * cloudier ship — at four bars the hull is as legible as it is at one. The
 * plating over it follows the same rule: dashed shells and ribs in the outer
 * band only, nothing across the ship.
 *
 * The gradient runs in `objectBoundingBox` units (the default), so it takes
 * the ellipse's own proportions and needs no separate x and y radii.
 */
function Shield({ level, width, height }: { level: number; width: number; height: number }) {
  if (level <= 0) return null;

  const tint = SUBSYSTEM_STYLE.shields.accent;

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} viewBox={VIEW_BOX}>
      <Defs>
        <RadialGradient id="shieldEnvelope" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={tint} stopOpacity={0} />
          <Stop offset={String(SHIELD_CLEAR)} stopColor={tint} stopOpacity={0} />
          <Stop offset="0.92" stopColor={tint} stopOpacity={0.34} />
          <Stop offset="0.975" stopColor={tint} stopOpacity={0.8} />
          <Stop offset="1" stopColor={tint} stopOpacity={1} />
        </RadialGradient>
      </Defs>

      {/* The glow, clear through the middle and gathered on the rim. */}
      <Ellipse
        cx={SHIELD_CX}
        cy={SHIELD_CY}
        rx={SHIELD_RX}
        ry={SHIELD_RY}
        fill="url(#shieldEnvelope)"
        fillOpacity={SHIELD_FILL(level)}
        stroke={tint}
        strokeOpacity={SHIELD_STROKE(level)}
        strokeWidth={2}
      />

      {/* Plating, in the same outer band and fading the same way. */}
      {TEXTURE_RINGS.map((ring) => (
        <Ellipse
          key={ring.t}
          cx={SHIELD_CX}
          cy={SHIELD_CY}
          rx={SHIELD_RX * ring.t}
          ry={SHIELD_RY * ring.t}
          fill="none"
          stroke={tint}
          strokeOpacity={TEXTURE_OPACITY(level) * ring.weight}
          strokeWidth={ring.width}
          strokeDasharray={ring.dash}
        />
      ))}

      <Path
        d={RIB_PATH}
        fill="none"
        stroke={tint}
        strokeOpacity={TEXTURE_OPACITY(level) * RIB_WEIGHT}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
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
  nozzles,
  level,
  width,
  height,
  animate,
}: {
  nozzles: Engine[];
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
  const nozzleY = (height - VIEW_H * scale) / 2 + (nozzles[0].y - VIEW_Y) * scale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flicker.value }],
    // Brightest at full stretch, which is what makes it read as burning.
    opacity: 0.72 + (flicker.value - 1) * 1.4,
  }));

  if (!lit) return null;

  const tint = SUBSYSTEM_STYLE.engines.accent;
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
        {nozzles.map((engine, i) => (
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
