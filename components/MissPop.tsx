import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Point } from '@/components/LaserShot';
import { fonts, palette, tracking } from '@/lib/theme';

const WIDTH = 64;
const HEIGHT = 22;

/**
 * MISS, over a ship a bolt has just gone past: it rises a little and fades.
 *
 * Its first frame is already the whole word at full strength, and the screen
 * takes it down on a timer (`MISS_MS`) — so it reads even where the animation
 * never plays, and never lingers if it does not.
 */
export function MissPop({ at, animate, duration }: { at: Point; animate: boolean; duration: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (animate) t.value = withTiming(1, { duration, easing: Easing.out(Easing.quad) });
  }, [animate, duration, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.6 ? 1 : 1 - (t.value - 0.6) / 0.4,
    transform: [{ translateY: -18 * t.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="Miss"
      style={[styles.pop, { left: at.x - WIDTH / 2, top: at.y - HEIGHT / 2 }, style]}
    >
      <Text style={styles.label}>MISS</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pop: {
    position: 'absolute',
    width: WIDTH,
    height: HEIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(9,13,26,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
});
