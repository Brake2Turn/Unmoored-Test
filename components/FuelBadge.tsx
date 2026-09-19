import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '@/lib/theme';

type Props = {
  remaining: number;
  capacity: number;
  /** Tints a healthy tank; a low one goes red regardless. */
  accent: string;
  size?: 'regular' | 'compact';
};

/** Below this share of a tank the badge turns red. */
const LOW_MARK = 0.25;

const SIZES = {
  regular: { ring: 21, letter: 11, count: 17, gap: 9, border: 1.4 },
  compact: { ring: 17, letter: 9, count: 13, gap: 7, border: 1.2 },
} as const;

/** Jumps left in the tank, as an F badge and a count. */
export function FuelBadge({ remaining, capacity, accent, size = 'regular' }: Props) {
  const safeCapacity = Math.max(capacity, 1);
  const clamped = Math.min(Math.max(remaining, 0), safeCapacity);
  const low = clamped / safeCapacity <= LOW_MARK;
  const colour = low ? palette.danger : accent;
  const s = SIZES[size];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Fuel: ${clamped} of ${safeCapacity} jumps remaining`}
      style={[styles.row, { gap: s.gap }]}
    >
      <View
        style={[
          styles.ring,
          {
            width: s.ring,
            height: s.ring,
            borderRadius: s.ring / 2,
            borderWidth: s.border,
            borderColor: colour,
          },
        ]}
      >
        <Text style={[styles.letter, { fontSize: s.letter, color: colour }]}>F</Text>
      </View>
      <Text style={[styles.count, { fontSize: s.count, color: colour }]}>{clamped}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  letter: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    // The glyph sits fractionally high in the ring without this.
    lineHeight: undefined,
    textAlign: 'center',
  },
  count: {
    fontFamily: fonts.bodyBold,
    fontWeight: '600',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
