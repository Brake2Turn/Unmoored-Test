import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, tracking } from '@/lib/theme';

/** Fixed, so the space screen can keep the other ship clear of it. */
export const FOE_STATUS_HEIGHT = 26;

/**
 * Who the player is facing, top left of the space screen: their name, and
 * their hull as a white line underneath it — the same white line the player's
 * own hull is drawn as, so the two read as the same kind of thing.
 */
export function FoeStatus({ name, hull, max, width }: { name: string; hull: number; max: number; width: number }) {
  const left = Math.max(0, Math.min(max, hull));
  const fraction = max > 0 ? left / max : 0;

  return (
    <View
      accessibilityLabel={`${name}: hull ${left} of ${max}`}
      style={[styles.box, { width }]}
    >
      <Text numberOfLines={1} style={styles.name}>
        {name.toUpperCase()}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: FOE_STATUS_HEIGHT, justifyContent: 'center', gap: 6 },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: tracking.caption,
  },
  track: {
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
