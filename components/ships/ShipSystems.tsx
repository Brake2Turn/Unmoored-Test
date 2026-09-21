import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { SHIP_BOX_H, SHIP_BOX_W, ShipArt, enginesFor, type Engine } from '@/components/ships/ShipArt';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';

type Props = {
  shipId: string;
  /** The ship art's own size. The systems box around it is larger — see below. */
  width: number;
  height: number;
  /**
   * The shield's *charge*, not its power setting — a float, because the
   * envelope fades up to the level the reactor is holding rather than
   * snapping to it. Nothing is drawn below a whisker of charge.
   */
  shields: number;
  /**
   * The run's running count of hits taken. Only ever compared against its own
   * last value: a change means something struck the shield, which is how a
   * break is told apart from the player pulling the power.
   */
  shieldHits: number;
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

/**
 * Each bar does more than lengthen the plume — it burns harder.
 *
 * Length alone made four bars read as "longer", not "hotter". These ramp the
 * whole flame together: the plume widens a little, the plume and its core both
 * brighten, a heat haze builds around it, and the pulse itself gets deeper.
 */
const FLAME_OPACITY = (level: number) => 0.6 + 0.1 * level;
const PLUME_WIDTH = (level: number) => 0.98 + 0.05 * level;
const PLUME_FILL = (level: number) => 0.36 + 0.1 * level;
const CORE_FILL = (level: number) => 0.3 + 0.14 * level;
const HAZE_FILL = (level: number) => 0.04 + 0.05 * level;

/** How far the flame stretches at the top of its pulse. */
const FLICKER_SCALE = (level: number) => 1.1 + 0.025 * level;
const FLICKER_MS = 420;

/**
 * Geometry for the two things a shield does when it is hit.
 *
 * Both are animated with **plain view transforms only** — translate, scale,
 * rotate and opacity — never animated SVG attributes. That is a deliberate
 * limit: view transforms behave identically on both platforms, and motion
 * cannot be checked from a headless capture, so the parts that cannot be
 * verified here are kept to the ones least able to surprise.
 */

/**
 * The sweep: a vertical blade of light that crosses the whole face of the
 * shield, not just its edge.
 *
 * The trick that makes it stay inside the envelope without any clipping is
 * that the blade is squashed as it travels. A vertical chord of an ellipse at
 * horizontal position `x` (in units of `SHIELD_RX`) has half-height
 * `SHIELD_RY * sqrt(1 - x²)` — so scaling the blade by exactly that factor
 * traces the inside of the ellipse precisely, edge to edge, while a plain
 * `translateX` carries it across. Both come off one progress value.
 */
const SWEEP_LAYERS = [
  { id: 'sheenA', lag: 0, rx: 26, opacity: 0.26 },
  { id: 'sheenB', lag: 0.05, rx: 46, opacity: 0.17 },
  { id: 'sheenC', lag: 0.11, rx: 70, opacity: 0.11 },
  { id: 'sheenD', lag: 0.19, rx: 94, opacity: 0.06 },
];

/**
 * The debris: fine slivers scattered across the whole field, not wedges cut
 * from the rim.
 *
 * Positions come from a fixed seed so the scatter is irregular but identical
 * every time, and computed once. They sit at radii from a third of the way out
 * to just past the rim, so the field comes apart everywhere at once rather
 * than peeling off the edge. Scaling the group about the centre throws each
 * sliver out along its own radius, and the ones that start furthest out travel
 * furthest — which is what gives the spray its shape for the cost of a single
 * animated view.
 */
const DEBRIS = (() => {
  // A tiny deterministic generator: the scatter should look random but never
  // change between runs, and never cost anything at render time.
  let seed = 20260920;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const point = (t: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${round(SHIELD_CX + SHIELD_RX * t * Math.cos(a))} ${round(
      SHIELD_CY + SHIELD_RY * t * Math.sin(a),
    )}`;
  };

  return Array.from({ length: 34 }, () => {
    const angle = rnd() * 360;
    const at = 0.32 + rnd() * 0.72;
    const length = 0.05 + rnd() * 0.14;
    const spread = 0.8 + rnd() * 2.4;
    const half = spread / 2;

    return {
      opacity: 0.45 + rnd() * 0.55,
      d: [
        `M ${point(at, angle - half)}`,
        `L ${point(at + length, angle - half * 0.45)}`,
        `L ${point(at + length, angle + half * 0.45)}`,
        `L ${point(at, angle + half)}`,
        'Z',
      ].join(' '),
    };
  });
})();

/** Quick enough to feel like a hit rather than a transition. */
const SHIMMER_MS = 900;
const DISSIPATE_MS = 460;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

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
  width,
  height,
  shields,
  shieldHits,
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

      <ShipArt shipId={shipId} width={width} height={height} />

      <Shield level={shields} width={width * SYSTEMS_SPAN} height={height * SYSTEMS_SPAN} />

      <ShieldBreak
        level={shields}
        hits={shieldHits}
        width={width * SYSTEMS_SPAN}
        height={height * SYSTEMS_SPAN}
        animate={animate}
      />
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
  // A charge this small is a shield on its way up or down, not one worth
  // drawing — without the floor it would flicker on at a hundredth of a bar.
  if (level < 0.05) return null;

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
 * What the shield does when it is hit.
 *
 * A layer breaking sends a blade of light across the whole face; the last
 * layer going makes the field tear itself apart. Which one plays is decided by
 * the level *before* the hit against the level after, and it fires on a change
 * in the run's hit count rather than on the level dropping — pulling the power
 * lowers the level too, and that must stay silent.
 *
 * Each effect is mounted fresh, keyed on the hit that caused it, so a second
 * hit restarts it cleanly rather than joining one already in flight. Nothing
 * here is load-bearing: if none of it ever plays, the shield still reads
 * correctly from its own bar and bubble.
 */
function ShieldBreak({
  level,
  hits,
  width,
  height,
  animate,
}: {
  level: number;
  hits: number;
  width: number;
  height: number;
  animate: boolean;
}) {
  const [effect, setEffect] = useState<{ id: number; kind: 'shimmer' | 'dissipate' } | null>(null);
  const lastHits = useRef(hits);
  const lastLevel = useRef(level);

  useEffect(() => {
    const struck = hits !== lastHits.current;
    const before = lastLevel.current;
    lastHits.current = hits;
    lastLevel.current = level;

    if (!struck || !animate) return;
    // Nothing was standing, so nothing broke.
    if (before <= 0) return;
    setEffect({ id: hits, kind: level <= 0 ? 'dissipate' : 'shimmer' });
  }, [animate, hits, level]);

  // Off the screen once it has played, rather than leaving a spent overlay
  // mounted over the ship.
  useEffect(() => {
    if (!effect) return;
    const timer = setTimeout(
      () => setEffect(null),
      (effect.kind === 'shimmer' ? SHIMMER_MS : DISSIPATE_MS) + 90,
    );
    return () => clearTimeout(timer);
  }, [effect]);

  if (!effect) return null;

  return effect.kind === 'shimmer' ? (
    <ShieldSweep key={effect.id} width={width} height={height} />
  ) : (
    <ShieldDissipate key={effect.id} width={width} height={height} />
  );
}

/**
 * A layer breaks: the field rings, and light washes across it.
 *
 * Four broad, translucent sheens rather than one bright line — each a little
 * wider, a little dimmer and a little later than the one in front, so what
 * crosses the face is a soft wash with depth to it instead of a blade. None
 * of them is opaque and none has a hard edge; the gradient inside each falls
 * away gently on both sides.
 */
function ShieldSweep({ width, height }: { width: number; height: number }) {
  const tint = SUBSYSTEM_STYLE.shields.accent;
  const progress = useSharedValue(0);
  const ring = useSharedValue(0);

  // Ship units to pixels, so a sheen can be moved in the units it was drawn
  // in. Matches how the overlay letterboxes its viewBox.
  const unit = Math.min(width / VIEW_W, height / VIEW_H);

  useEffect(() => {
    progress.value = withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.sin) });
    ring.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [progress, ring]);

  /** The impact: the rim lifts and settles, softly. */
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.3, 1], [0.55, 0.34, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.09], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Ellipse
            cx={SHIELD_CX}
            cy={SHIELD_CY}
            rx={SHIELD_RX}
            ry={SHIELD_RY}
            fill="none"
            stroke={tint}
            strokeOpacity={0.85}
            strokeWidth={1.8}
          />
        </Svg>
      </Animated.View>

      {SWEEP_LAYERS.map((layer) => (
        <SweepSheen
          key={layer.id}
          layer={layer}
          progress={progress}
          unit={unit}
          tint={tint}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

/**
 * One sheen of the wash.
 *
 * The squash is what keeps it inside the envelope with no clipping: a vertical
 * chord of an ellipse at horizontal position `x` (in units of `SHIELD_RX`) has
 * half-height `SHIELD_RY * sqrt(1 - x²)`, so scaling by exactly that traces
 * the inside of the shield edge to edge while `translateX` carries it across.
 */
function SweepSheen({
  layer,
  progress,
  unit,
  tint,
  width,
  height,
}: {
  layer: (typeof SWEEP_LAYERS)[number];
  progress: SharedValue<number>;
  unit: number;
  tint: string;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    // Trailing layers start later and so sit behind the ones in front.
    const t = Math.max(0, (progress.value - layer.lag) / (1 - layer.lag));
    const x = t * 2 - 1;
    const chord = Math.sqrt(Math.max(0, 1 - x * x));

    return {
      opacity: interpolate(progress.value, [0, 0.14, 0.72, 1], [0, 1, 0.85, 0], Extrapolation.CLAMP),
      transform: [{ translateX: x * SHIELD_RX * unit }, { scaleY: chord }],
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height} viewBox={VIEW_BOX}>
        <Defs>
          {/* Five stops rather than three: the extra pair round the shoulders
              off, so the band has no visible edge anywhere. */}
          <LinearGradient id={layer.id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tint} stopOpacity={0} />
            <Stop offset="0.28" stopColor={tint} stopOpacity={layer.opacity * 0.22} />
            <Stop offset="0.5" stopColor={tint} stopOpacity={layer.opacity} />
            <Stop offset="0.72" stopColor={tint} stopOpacity={layer.opacity * 0.22} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Ellipse
          cx={SHIELD_CX}
          cy={SHIELD_CY}
          rx={layer.rx}
          ry={SHIELD_RY}
          fill={`url(#${layer.id})`}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The last layer goes: the field fails all at once.
 *
 * Three layers on one clock, each on its own slice of it — a white-out that is
 * gone almost before it registers, a shockwave that overruns the envelope, and
 * three dozen slivers thrown out of the whole face. The debris implodes for four
 * hundredths of a second before it flies, which is the snap that makes it read
 * as violent rather than as an expansion.
 */
function ShieldDissipate({ width, height }: { width: number; height: number }) {
  const tint = SUBSYSTEM_STYLE.shields.accent;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: DISSIPATE_MS, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.3], [1, 0.75, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 0.3], [0.97, 1.2], Extrapolation.CLAMP) },
    ],
  }));

  const shockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.8], [0, 0.95, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.98, 1.8], Extrapolation.CLAMP) }],
  }));

  /** A second front, out ahead of the first and gone sooner. */
  const leadStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.45], [0, 0.7, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 0.45], [1, 2.3], Extrapolation.CLAMP) }],
  }));

  const debrisStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [1, 0.95, 0], Extrapolation.CLAMP),
    transform: [
      // The dip is the wind-up: in, then hard out.
      { scale: interpolate(progress.value, [0, 0.09, 1], [1, 0.93, 1.52], Extrapolation.CLAMP) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, 7], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, flashStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Defs>
            <RadialGradient id="failFlash" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.12} />
              <Stop offset="0.66" stopColor={tint} stopOpacity={0.4} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.95} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={SHIELD_CX}
            cy={SHIELD_CY}
            rx={SHIELD_RX}
            ry={SHIELD_RY}
            fill="url(#failFlash)"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, leadStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Ellipse
            cx={SHIELD_CX}
            cy={SHIELD_CY}
            rx={SHIELD_RX}
            ry={SHIELD_RY}
            fill="none"
            stroke={tint}
            strokeOpacity={0.55}
            strokeWidth={1.4}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, shockStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          <Ellipse
            cx={SHIELD_CX}
            cy={SHIELD_CY}
            rx={SHIELD_RX}
            ry={SHIELD_RY}
            fill="none"
            stroke={tint}
            strokeOpacity={0.85}
            strokeWidth={3}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, debrisStyle]}>
        <Svg width={width} height={height} viewBox={VIEW_BOX}>
          {DEBRIS.map((piece, i) => (
            <Path
              key={i}
              d={piece.d}
              fill={tint}
              fillOpacity={piece.opacity * 0.5}
              stroke={tint}
              strokeOpacity={piece.opacity}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
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
      withTiming(FLICKER_SCALE(level), {
        duration: FLICKER_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(flicker);
  }, [animate, flicker, level, lit]);

  // Where the nozzle sits inside this box, so the stretch can be pinned to it.
  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  const nozzleY = (height - VIEW_H * scale) / 2 + (nozzles[0].y - VIEW_Y) * scale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flicker.value }],
    // Brightest at full stretch, which is what makes it read as burning.
    opacity: FLAME_OPACITY(level) + (flicker.value - 1) * 1.4,
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
            {/* Heat haze: wider and shorter than the plume, barely there at one
                bar and a real glow at four. */}
            <Path
              d={flamePath(engine.x, engine.y, engine.width * 2, length * 0.86)}
              fill={tint}
              fillOpacity={HAZE_FILL(level)}
            />
            <Path
              d={flamePath(engine.x, engine.y, engine.width * PLUME_WIDTH(level), length)}
              fill={tint}
              fillOpacity={PLUME_FILL(level)}
            />
            {/* The hot core, shorter and narrower than the plume around it. */}
            <Path
              d={flamePath(engine.x, engine.y, engine.width * 0.5, length * 0.62)}
              fill="#FFFFFF"
              fillOpacity={CORE_FILL(level)}
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
