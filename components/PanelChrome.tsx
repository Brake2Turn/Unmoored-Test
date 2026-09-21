import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fonts, palette } from '@/lib/theme';

/**
 * The chrome the three HUD sections share: the card they are drawn on, the
 * header line a collapsed tab carries, and the header line the panel it opens
 * carries. One file, because a tab and its panel have to look like the same
 * section — the tab is what gets tapped and the panel is what answers.
 */

/**
 * The card both a tab and the panel it opens are drawn on.
 *
 * Near-opaque on purpose. These sit over the ship rather than in a strip of
 * their own, and a translucent card let the hull and the starfield read
 * through the controls, which made both harder to parse.
 */
export const CARD: ViewStyle = {
  borderRadius: 12,
  borderWidth: 1,
  borderCurve: 'continuous',
  borderColor: 'rgba(255,255,255,0.09)',
  backgroundColor: 'rgba(11,15,30,0.97)',
};

/** Reserved for the header, so each tab can size the body below it. */
export const TAB_HEADER_HEIGHT = 14;

/**
 * The top line of a collapsed tab: the section's mark, then its name.
 *
 * The three sections are the one place a word earns its keep. Inside the
 * reactor the icons carry the subsystems on their own, because the player
 * meets them in the controls where there is room to learn them — but a tab is
 * what gets tapped first, and nothing teaches it beforehand.
 */
export function TabHeader({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <View style={styles.tabHeader}>
      {icon}
      <Text numberOfLines={1} style={styles.tabName}>
        {name}
      </Text>
    </View>
  );
}

/**
 * The top line of an opened panel: the same mark and name as the tab it came
 * from, then a rule, then whatever the section counts.
 *
 * The name is repeated rather than dropped because the panel opens *over* the
 * helm on a scrim — the tab that was tapped is dimmed behind it, so the panel
 * has to say what it is on its own.
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
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_HEADER_HEIGHT,
    gap: 5,
  },
  tabName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    color: palette.textMuted,
    letterSpacing: 1.1,
    // Tracking is added after the last letter too; this takes the gap back so
    // a long name has the full width of the tab to sit in.
    marginRight: -1.1,
  },

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
