import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, tracking } from '@/lib/theme';

type Props = {
  remaining: number;
  capacity: number;
  /** Tints a healthy tank; a low one goes red regardless. */
  accent: string;
  width?: number;
  /** 'full' shows the label and the count; 'compact' is just the bar. */
  variant?: 'full' | 'compact';
};

/** Below this share of a tank the gauge turns red. */
const LOW_MARK = 0.25;

export function FuelGauge({
  remaining,
  capacity,
  accent,
  width = 160,
  variant = 'full',
}: Props) {
  const safeCapacity = Math.max(capacity, 1);
  const clamped = Math.min(Math.max(remaining, 0), safeCapacity);
  const fraction = clamped / safeCapacity;
  const low = fraction <= LOW_MARK;
  const colour = clamped === 0 || low ? palette.danger : accent;

  return (
    <View style={[styles.container, { width }]}>
      {variant === 'full' ? (
        <View style={styles.header}>
          <Text style={styles.label}>FUEL</Text>
          <Text style={[styles.count, { color: colour }]}>
            {clamped} / {safeCapacity}
          </Text>
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Fuel: ${clamped} of ${safeCapacity} jumps remaining`}
        style={styles.track}
      >
        <View
          style={[
            styles.fill,
            { width: `${fraction * 100}%`, backgroundColor: colour },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  count: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
});
