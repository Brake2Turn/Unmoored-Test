import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fonts, palette } from '@/lib/theme';

/**
 * The card the tabs and the panels they open are both drawn on.
 *
 * Near-opaque on purpose. These sit over the ship rather than in a strip of
 * their own, and a translucent card let the hull and the starfield read
 * through the controls, which made both harder to parse.
 *
 * It lives here rather than being spelled out once per panel file, which is
 * what it was before — two copies of the same five properties.
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
 * The top line of a tab: the section's mark, then its name.
 *
 * The three tabs are the one place a word earns its keep. Inside the reactor
 * the icons carry the subsystems on their own, because the player meets them
 * in the controls where there is room to learn them — but the tabs are what
 * gets tapped first, and nothing teaches them beforehand.
 */
export function TabHeader({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <View style={styles.header}>
      {icon}
      <Text numberOfLines={1} style={styles.name}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_HEADER_HEIGHT,
    gap: 5,
  },
  name: {
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
});
