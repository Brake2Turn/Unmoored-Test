import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
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
  twinkle: boolean;
  /** Drifts a little way about its own spot and back, rather than across. */
  wander: { dx: number; dy: number; period: number } | null;
  delay: number;
  period: number;
};

/**
 * Depth bands: far stars are small and dim, near ones larger and brighter.
 *
 * Nothing flows across the screen any more. The field used to slide down
 * past the ship in three layers at different speeds; the author asked for
 * stars that stay where they are and twinkle or shift slightly in place. So
 * each band now says how many of its stars twinkle and how many wander, and
 * how far a wanderer strays (`reach`, in points) — the near band furthest,
 * which keeps a little of the depth the drift used to give.
 */
const BANDS = [
  { count: 70, min: 1.0, max: 2.0, minA: 0.25, maxA: 0.5, twinkle: 0.35, wander: 0.15, reach: 1 },
  { count: 40, min: 1.8, max: 3.2, minA: 0.45, maxA: 0.75, twinkle: 0.5, wander: 0.3, reach: 1.8 },
  { count: 18, min: 3.0, max: 5.0, minA: 0.7, maxA: 1.0, twinkle: 0.6, wander: 0.45, reach: 2.6 },
] as const;

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
      wander:
        Math.random() < band.wander
          ? { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach, period: 2600 + Math.random() * 3400 }
          : null,
      delay: Math.random() * 2500,
      period: 1400 + Math.random() * 2200,
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
 * A star that twinkles, wanders about its spot, or both. Each runs on its own
 * slow loop out and back, so nothing ever leaves where it was put.
 */
function LivelyStar({ star }: { star: Star }) {
  const opacity = useSharedValue(star.opacity);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (star.twinkle) {
      opacity.value = withDelay(
        star.delay,
        withRepeat(withTiming(star.opacity * 0.3, { duration: star.period }), -1, true),
      );
    }
    if (star.wander) {
      drift.value = withDelay(
        star.delay,
        withRepeat(
          withTiming(1, { duration: star.wander.period, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(drift);
    };
  }, [drift, opacity, star]);

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

/** One depth band, laid once across the screen and left there. */
function Layer({
  band,
  width,
  height,
  reduceMotion,
}: {
  band: (typeof BANDS)[number];
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  const stars = useMemo(() => makeStars(band, width, height), [band, width, height]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {stars.map((star, index) =>
        (star.twinkle || star.wander) && !reduceMotion ? (
          <LivelyStar key={index} star={star} />
        ) : (
          <StaticStar key={index} star={star} />
        ),
      )}
    </View>
  );
}

export const StarField = React.memo(function StarField({
  width,
  height,
  reduceMotion,
}: {
  width: number;
  height: number;
  reduceMotion: boolean;
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BANDS.map((band, index) => (
        <Layer key={index} band={band} width={width} height={height} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
});
