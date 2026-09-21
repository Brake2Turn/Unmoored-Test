import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HULL_MAX } from '@/lib/hull';
import { fonts, palette, tracking } from '@/lib/theme';

type Props = {
  /** Plates left, 0 to `HULL_MAX`. */
  hull: number;
  width: number;
};

/**
 * Fixed, so the helm can lay itself out around it the same way it does the
 * reactor panel.
 */
export const HULL_BAR_HEIGHT = 16;

/**
 * The hull: a plain white line under everything else.
 *
 * Deliberately outside the reactor panel and unlike anything in it. The panel
 * is a set of choices — rows the player moves energy between — and the hull is
 * not one of those: nothing allocates it, nothing charges it, it only ever
 * gets shorter. Giving it the panel's card and cell treatment would have
 * filed it as another thing to fiddle with.
 */
export function HullBar({ hull, width }: Props) {
  const left = Math.max(0, Math.min(HULL_MAX, hull));
  const fraction = HULL_MAX > 0 ? left / HULL_MAX : 0;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Hull ${Math.round(left)} of ${HULL_MAX}`}
      style={[styles.row, { width }]}
    >
      <Text numberOfLines={1} style={styles.label}>
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
    height: HULL_BAR_HEIGHT,
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
