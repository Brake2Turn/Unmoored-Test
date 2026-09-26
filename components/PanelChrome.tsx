import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fonts, palette } from '@/lib/theme';

/**
 * The chrome the HUD sections share: the card they are drawn on, and the
 * header line an opened panel carries.
 */

/**
 * The card the reactor and the ship panel are drawn on.
 *
 * Near-opaque on purpose. A translucent card let the hull and the starfield
 * read through the controls, which made both harder to parse.
 */
export const CARD: ViewStyle = {
  borderRadius: 12,
  borderWidth: 1,
  borderCurve: 'continuous',
  borderColor: 'rgba(255,255,255,0.09)',
  backgroundColor: 'rgba(11,15,30,0.97)',
};

/**
 * The top line of an opened panel: the section's mark and name, then a rule,
 * then whatever the section counts.
 *
 * The name is repeated rather than dropped because the panel opens *over* the
 * helm on a scrim — the SHIP button that was tapped is dimmed behind it, so
 * the panel has to say what it is on its own.
 */
export function PanelHeader({
  icon,
  name,
  count,
}: {
  icon: React.ReactNode;
  name: string;
  count?: string;
}) {
  return (
    <View style={styles.panelHeader}>
      {icon}
      <Text numberOfLines={1} style={styles.panelName}>
        {name}
      </Text>
      <View style={styles.rule} />
      {count ? <Text style={styles.panelCount}>{count}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panelHeader: { flexDirection: 'row', alignItems: 'center', height: 16, gap: 8 },
  panelName: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    color: palette.textMuted,
    letterSpacing: 1.4,
    marginRight: -1.4,
  },
  panelCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
});
