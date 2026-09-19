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
  delay: number;
  period: number;
};

/**
 * Depth bands: far stars are small, dim and slow; near stars are larger,
 * brighter and drift noticeably faster. `speed` is points per second.
 */
const BANDS = [
  { count: 70, min: 1.0, max: 2.0, minA: 0.25, maxA: 0.5, speed: 4, twinkle: 0.1 },
  { count: 40, min: 1.8, max: 3.2, minA: 0.45, maxA: 0.75, speed: 9, twinkle: 0.25 },
  { count: 18, min: 3.0, max: 5.0, minA: 0.7, maxA: 1.0, speed: 17, twinkle: 0.45 },
] as const;

function tint() {
  const roll = Math.random();
  if (roll < 0.1) return palette.starCool;
  if (roll < 0.2) return palette.starWarm;
  return palette.star;
}

function makeStars(band: (typeof BANDS)[number], width: number, height: number): Star[] {
  return Array.from({ length: band.count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: band.min + Math.random() * (band.max - band.min),
    opacity: band.minA + Math.random() * (band.maxA - band.minA),
    color: tint(),
    twinkle: Math.random() < band.twinkle,
    delay: Math.random() * 2500,
    period: 1400 + Math.random() * 2200,
  }));
}

function TwinklingStar({ star }: { star: Star }) {
  const opacity = useSharedValue(star.opacity);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(withTiming(star.opacity * 0.35, { duration: star.period }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, star.delay, star.opacity, star.period]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
        },
        style,
      ]}
    />
  );
}

function Tile({ stars, offsetY }: { stars: Star[]; offsetY: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { transform: [{ translateY: offsetY }] }]}>
      {stars.map((star, index) =>
        star.twinkle ? (
          <TwinklingStar key={index} star={star} />
        ) : (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              backgroundColor: star.color,
              opacity: star.opacity,
            }}
          />
        ),
      )}
    </View>
  );
}

/**
 * One depth band. The tile of stars is drawn twice — once at y=0 and once a
 * full screen above — and the pair slides down together. When it has travelled
 * exactly one screen height the animation restarts, and because the upper tile
 * is now where the lower one began, the loop is seamless.
 */
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
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || height <= 0) {
      cancelAnimation(translateY);
      translateY.value = 0;
      return;
    }
    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(height, {
        duration: (height / band.speed) * 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(translateY);
  }, [translateY, height, band.speed, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Tile stars={stars} offsetY={0} />
      <Tile stars={stars} offsetY={-height} />
    </Animated.View>
  );
}

export function StarField({
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
}
