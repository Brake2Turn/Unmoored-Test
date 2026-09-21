import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HULL_MAX } from '@/lib/hull';
import { fonts, palette, tracking } from '@/lib/theme';

type Props = {
  /** Plates left, 0 to `HULL_MAX`. */
  hull: number;
  width: number;
};

/** Fixed, so the helm can lay itself out around it. */
export const STATUS_BAR_HEIGHT = 20;

/**
 * The ship's condition: one white line, the full width of the helm's chrome.
 *
 * Fuel used to sit at the end of it and has moved into the jump button, which
 * is the only place it is ever consulted — leaving this line to be a line,
 * long enough that losing a plate is visible rather than a rounding error.
 */
export function StatusBar({ hull, width }: Props) {
  const left = Math.max(0, Math.min(HULL_MAX, hull));
  const fraction = HULL_MAX > 0 ? left / HULL_MAX : 0;

  return (
    <View style={[styles.row, { width }]}>
      <Text
        accessibilityRole="text"
        accessibilityLabel={`Hull ${Math.round(left)} of ${HULL_MAX}`}
        numberOfLines={1}
        style={styles.label}
      >
        HULL
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STATUS_BAR_HEIGHT,
    gap: 10,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
});
