import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { palette } from '@/lib/theme';

/** A point on screen, in window coordinates. */
export type Point = { x: number; y: number };

/**
 * One shot from a weapon, the player's or a red ship's: a bolt that flies from the weapon's tip
 * to the other ship, and a burst of sparks where it lands.
 *
 * **The timing is kept by timers, not by the animation.** The bolt's flight
 * and the sparks are Reanimated view transforms, but when the bolt arrives,
 * when the hull drops and when the shot is gone are all `setTimeout`s. That
 * matters twice over: animations do not advance in headless at all, and even
 * on a phone the rule — a plate off the other ship — must not wait on a frame
 * that may never be drawn. If the motion never plays, the hit still lands.
 *
 * Every phase's first frame is already worth seeing, for the same reason: the
 * bolt starts at full brightness at the tip, and the sparks start at full
 * brightness already spread.
 *
 * Only view transforms are animated, never SVG attributes, as with the shield
 * effects — they behave the same on web and on a phone.
 */

/** How long the bolt takes to cross, in ms. Fast: this is a laser. */
const FLIGHT_MS = 200;
/** How long the sparks hang in the air. */
const SPARK_MS = 480;

const BOLT_W = 3;
const BOLT_LEN = 22;

/** Slivers in the burst, placed once from a fixed pattern so every hit matches. */
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.21;
  return {
    angle,
    radius: 9 + ((i * 7) % 5) * 3,
    length: 5 + ((i * 5) % 4) * 2,
    color: i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? '#FFD27A' : palette.weapons,
  };
});
const SPARK_BOX = 90;

export function LaserShot({
  from,
  to,
  hits,
  animate,
  onImpact,
  onDone,
}: {
  from: Point;
  to: Point;
  /** False when there is nothing to hit: the bolt flies on and no sparks show. */
  hits: boolean;
  animate: boolean;
  /** When the bolt arrives — which is when the hull should drop. */
  onImpact: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'flying' | 'sparks'>('flying');

  useEffect(() => {
    const impact = setTimeout(() => {
      if (hits) {
        onImpact();
        setPhase('sparks');
      }
    }, FLIGHT_MS);
    const done = setTimeout(onDone, FLIGHT_MS + (hits ? SPARK_MS : 0) + 20);
    return () => {
      clearTimeout(impact);
      clearTimeout(done);
    };
    // A shot runs once, from where it was fired to where it was aimed.
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {phase === 'flying' ? <Bolt from={from} to={to} animate={animate} /> : <Sparks at={to} animate={animate} />}
    </View>
  );
}

function Bolt({ from, to, animate }: { from: Point; to: Point; animate: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animate) progress.value = withTiming(1, { duration: FLIGHT_MS, easing: Easing.linear });
  }, [animate, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (to.x - from.x) * progress.value },
      { translateY: (to.y - from.y) * progress.value },
    ],
  }));

  // The bolt lies along its line of flight: across for a shot between ships
  // side by side, upright for one fired up or down. Its front end starts at
  // the tip, on whichever side the target is.
  const across = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const place = across
    ? {
        width: BOLT_LEN,
        height: BOLT_W,
        left: to.x > from.x ? from.x : from.x - BOLT_LEN,
        top: from.y - BOLT_W / 2,
      }
    : {
        width: BOLT_W,
        height: BOLT_LEN,
        left: from.x - BOLT_W / 2,
        top: to.y < from.y ? from.y - BOLT_LEN : from.y,
      };

  return (
    <Animated.View style={[styles.bolt, place, across && styles.boltAcross, style]}>
      <View style={across ? styles.boltCoreAcross : styles.boltCore} />
    </Animated.View>
  );
}

function Sparks({ at, animate }: { at: Point; animate: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (animate) t.value = withTiming(1, { duration: SPARK_MS, easing: Easing.out(Easing.cubic) });
  }, [animate, t]);

  // Scaling the whole burst about its centre throws every sliver outward
  // along its own line, for the cost of one animated view.
  const burst = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 1 + t.value * 1.3 }],
  }));
  const flash = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 3),
    transform: [{ scale: 1 + t.value * 1.5 }],
  }));

  return (
    <View style={[styles.sparkBox, { left: at.x - SPARK_BOX / 2, top: at.y - SPARK_BOX / 2 }]}>
      <Animated.View style={[styles.flash, flash]} />
      <Animated.View style={[StyleSheet.absoluteFill, burst]}>
        {SPARKS.map((spark, i) => (
          <View
            key={i}
            style={[
              styles.spark,
              {
                height: spark.length,
                backgroundColor: spark.color,
                transform: [
                  { translateX: Math.cos(spark.angle) * spark.radius },
                  { translateY: Math.sin(spark.angle) * spark.radius },
                  // Each sliver lies along its own direction of travel.
                  { rotate: `${spark.angle + Math.PI / 2}rad` },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bolt: {
    position: 'absolute',
    borderRadius: BOLT_W / 2,
    backgroundColor: palette.weapons,
    shadowColor: palette.weapons,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    alignItems: 'center',
  },
  boltCore: { width: 1, height: BOLT_LEN - 4, marginTop: 2, borderRadius: 0.5, backgroundColor: '#FFFFFF' },
  boltAcross: { justifyContent: 'center' },
  boltCoreAcross: { height: 1, width: BOLT_LEN - 4, borderRadius: 0.5, backgroundColor: '#FFFFFF' },

  sparkBox: { position: 'absolute', width: SPARK_BOX, height: SPARK_BOX },
  flash: {
    position: 'absolute',
    left: SPARK_BOX / 2 - 10,
    top: SPARK_BOX / 2 - 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF1D6',
    shadowColor: palette.weapons,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  spark: {
    position: 'absolute',
    left: SPARK_BOX / 2 - 1,
    top: SPARK_BOX / 2 - 3,
    width: 2,
    borderRadius: 1,
  },
});
