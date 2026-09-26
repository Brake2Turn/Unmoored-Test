import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Point } from '@/components/LaserShot';

/**
 * A ship blowing apart when its hull reaches nothing — the player's or the
 * other one's.
 *
 * Four layers on one clock: a white flash that swallows the ship, an orange
 * fireball swelling and cooling behind it, a shock ring racing outward, and
 * debris thrown out in every direction. As with the shots, only view
 * transforms and opacity are animated, and the first frame is already the
 * brightest — so where frames are scarce (headless shows only frame zero) the
 * explosion still reads as one. The ship itself is removed by the screen, not
 * by this; if the animation never plays, the ship is still gone.
 */

/** How long the whole thing lasts, in ms. The screen removes it after this. */
export const EXPLOSION_MS = 1100;

/** Debris, placed once from a fixed pattern so every explosion is the same shape. */
const DEBRIS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2 + ((i * 7) % 5) * 0.09;
  return {
    angle,
    // Fractions of the explosion's size, so a boss throws debris further.
    radius: 0.16 + ((i * 11) % 7) * 0.035,
    length: 0.05 + ((i * 3) % 4) * 0.025,
    width: i % 4 === 0 ? 3 : 2,
    color: i % 4 === 0 ? '#FFFFFF' : i % 4 === 1 ? '#FFD27A' : i % 4 === 2 ? '#FF9A3C' : '#FF4A4A',
  };
});

export function Explosion({ at, size, animate }: { at: Point; size: number; animate: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (animate) t.value = withTiming(1, { duration: EXPLOSION_MS, easing: Easing.out(Easing.cubic) });
  }, [animate, t]);

  const flash = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 4),
    transform: [{ scale: 0.7 + t.value * 1.2 }],
  }));
  const fireball = useAnimatedStyle(() => ({
    opacity: Math.max(0, 0.95 - t.value * 1.1),
    transform: [{ scale: 0.45 + t.value * 0.9 }],
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: Math.max(0, 0.8 - t.value * 1.3),
    transform: [{ scale: 0.3 + t.value * 1.6 }],
  }));
  // One scaling view throws every piece out along its own line.
  const debris = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 1.05),
    transform: [{ scale: 1 + t.value * 2.4 }, { rotate: `${t.value * 0.35}rad` }],
  }));

  const half = size / 2;

  return (
    <View
      pointerEvents="none"
      style={[styles.box, { left: at.x - half, top: at.y - half, width: size, height: size }]}
    >
      <Animated.View
        style={[styles.round, { backgroundColor: '#FF7A2E', width: size, height: size, borderRadius: half }, fireball]}
      />
      <Animated.View
        style={[
          styles.round,
          { borderWidth: 3, borderColor: '#FFD9A8', width: size, height: size, borderRadius: half },
          ring,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, debris]}>
        {DEBRIS.map((piece, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: half - piece.width / 2,
              top: half - (piece.length * size) / 2,
              width: piece.width,
              height: piece.length * size,
              borderRadius: piece.width / 2,
              backgroundColor: piece.color,
              transform: [
                { translateX: Math.cos(piece.angle) * piece.radius * size },
                { translateY: Math.sin(piece.angle) * piece.radius * size },
                { rotate: `${piece.angle + Math.PI / 2}rad` },
              ],
            }}
          />
        ))}
      </Animated.View>
      <Animated.View
        style={[
          styles.round,
          {
            backgroundColor: '#FFF6E6',
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: size * 0.3,
            left: size * 0.2,
            top: size * 0.2,
          },
          flash,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  round: { position: 'absolute', left: 0, top: 0 },
});
