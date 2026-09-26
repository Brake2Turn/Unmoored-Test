import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { palette } from '@/lib/theme';

type Star = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  /** Twinkles while the field is flowing past. */
  twinkle: boolean;
  /** Twinkles while the field holds still — far more of them do. */
  twinkleStill: boolean;
  /** Drifts a little way about its own spot and back, while the field is still. */
  wander: { dx: number; dy: number; period: number } | null;
  delay: number;
  period: number;
};

/**
 * Depth bands: far stars are small, dim and slow; near ones larger, brighter
 * and faster.
 *
 * The field has two moods. **Flowing** — the player alone, travelling — every
 * band slides from right to left at its own `speed` (points a second), and a
 * few stars twinkle. **Still** — another ship has come alongside — the field
 * stops, most stars twinkle hard and some wander a point or two about their
 * spot. Each band says how many stars do which.
 */
const BANDS = [
  { count: 70, min: 1.0, max: 2.0, minA: 0.25, maxA: 0.5, speed: 6, twinkle: 0.15, still: 0.75, wander: 0.15, reach: 1 },
  { count: 40, min: 1.8, max: 3.2, minA: 0.45, maxA: 0.75, speed: 13, twinkle: 0.25, still: 0.85, wander: 0.3, reach: 1.8 },
  { count: 18, min: 3.0, max: 5.0, minA: 0.7, maxA: 1.0, speed: 24, twinkle: 0.35, still: 0.9, wander: 0.45, reach: 2.6 },
] as const;

/** How dim a twinkle gets, and how quick it is, in each mood. */
const TWINKLE_FLOW = { floor: 0.35, min: 1400, spread: 2200 };
const TWINKLE_STILL = { floor: 0.08, min: 700, spread: 1600 };

function tint() {
  const roll = Math.random();
  if (roll < 0.1) return palette.starCool;
  if (roll < 0.2) return palette.starWarm;
  return palette.star;
}

function makeStars(band: (typeof BANDS)[number], width: number, height: number): Star[] {
  return Array.from({ length: band.count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const reach = band.reach * (0.5 + Math.random() * 0.5);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: band.min + Math.random() * (band.max - band.min),
      opacity: band.minA + Math.random() * (band.maxA - band.minA),
      color: tint(),
      twinkle: Math.random() < band.twinkle,
      twinkleStill: Math.random() < band.still,
      wander:
        Math.random() < band.wander
          ? { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach, period: 2600 + Math.random() * 3400 }
          : null,
      delay: Math.random() * 2000,
      period: Math.random(),
    };
  });
}

function dotStyle(star: Star) {
  return {
    position: 'absolute' as const,
    left: star.x,
    top: star.y,
    width: star.size,
    height: star.size,
    borderRadius: star.size / 2,
    backgroundColor: star.color,
    opacity: star.opacity,
  };
}

/**
 * A star that twinkles, wanders about its spot, or both — whichever its mood
 * calls for. Each runs on its own loop out and back, restarted when the mood
 * changes.
 */
function LivelyStar({ star, still }: { star: Star; still: boolean }) {
  const opacity = useSharedValue(star.opacity);
  const drift = useSharedValue(0);

  useEffect(() => {
    const twinkles = still ? star.twinkleStill : star.twinkle;
    const look = still ? TWINKLE_STILL : TWINKLE_FLOW;
    cancelAnimation(opacity);
    cancelAnimation(drift);
    opacity.value = star.opacity;
    if (twinkles) {
      opacity.value = withDelay(
        star.delay,
        withRepeat(
          withTiming(star.opacity * look.floor, { duration: look.min + star.period * look.spread }),
          -1,
          true,
        ),
      );
    }
    if (still && star.wander) {
      drift.value = withDelay(
        star.delay,
        withRepeat(
          withTiming(1, { duration: star.wander.period, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
    } else {
      drift.value = withTiming(0, { duration: 400 });
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(drift);
    };
  }, [drift, opacity, star, still]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: (star.wander?.dx ?? 0) * drift.value },
      { translateY: (star.wander?.dy ?? 0) * drift.value },
    ],
  }));

  // Opacity comes from the animation, not the base style.
  return <Animated.View style={[dotStyle(star), { opacity: undefined }, style]} />;
}

/** Static dot. Also the resting look of every star when motion is off. */
function StaticStar({ star }: { star: Star }) {
  return <View style={dotStyle(star)} />;
}

const Tile = React.memo(function Tile({
  stars,
  offsetX,
  still,
  reduceMotion,
}: {
  stars: Star[];
  offsetX: number;
  still: boolean;
  reduceMotion: boolean;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: offsetX }] }]}>
      {stars.map((star, index) =>
        reduceMotion ? (
          <StaticStar key={index} star={star} />
        ) : (
          <LivelyStar key={index} star={star} still={still} />
        ),
      )}
    </View>
  );
});

/**
 * One depth band. Its stars are drawn twice, side by side — once on screen and
 * once a full width to the right — and the pair slides left together. After
 * exactly one screen width the right-hand copy is where the left one began,
 * so the loop is seamless.
 *
 * Holding still simply stops the slide wherever it is: both copies between
 * them still cover the screen at any offset. Setting off again runs on from
 * that point to the end of the width, then loops from the start.
 */
function Layer({
  band,
  width,
  height,
  flowing,
  reduceMotion,
}: {
  band: (typeof BANDS)[number];
  width: number;
  height: number;
  flowing: boolean;
  reduceMotion: boolean;
}) {
  const stars = useMemo(() => makeStars(band, width, height), [band, width, height]);
  const offset = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(offset);
    if (reduceMotion || width <= 0) {
      offset.value = 0;
      return;
    }
    if (!flowing) return;

    const full = (width / band.speed) * 1000;
    const from = Math.max(-width, Math.min(0, offset.value));
    const remaining = ((width + from) / width) * full;
    offset.value = withSequence(
      withTiming(-width, { duration: remaining, easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-width, { duration: full, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(offset);
  }, [offset, width, band.speed, flowing, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Tile stars={stars} offsetX={0} still={!flowing} reduceMotion={reduceMotion} />
      <Tile stars={stars} offsetX={width} still={!flowing} reduceMotion={reduceMotion} />
    </Animated.View>
  );
}

export const StarField = React.memo(function StarField({
  width,
  height,
  reduceMotion,
  flowing = false,
}: {
  width: number;
  height: number;
  reduceMotion: boolean;
  /** Slide right to left (travelling alone), or hold still and twinkle. */
  flowing?: boolean;
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BANDS.map((band, index) => (
        <Layer
          key={index}
          band={band}
          width={width}
          height={height}
          flowing={flowing}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
});
