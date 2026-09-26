import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Mode } from '@/lib/runStore';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * Which mode the run is in, top right of the space screen: EXPLORING most of
 * the time, COMBAT while a hostile ship is fighting. Combat is red, the same
 * red as the ships that start it; exploring is the quiet muted grey the rest
 * of the corner furniture uses.
 */
export function ModeBadge({ mode }: { mode: Mode }) {
  const combat = mode === 'combat';
  return (
    <View
      accessibilityLabel={combat ? 'Mode: combat' : 'Mode: exploring'}
      style={styles.row}
    >
      <View style={[styles.dot, { backgroundColor: combat ? palette.danger : palette.textMuted }]} />
      <Text style={[styles.label, { color: combat ? palette.danger : palette.textMuted }]}>
        {combat ? 'COMBAT' : 'EXPLORING'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
});
