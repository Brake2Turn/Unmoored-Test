import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette, tracking } from '@/lib/theme';

/** The wordmark, a hairline rule, and the tagline beneath it. */
export function TitleBlock({ size, ruleWidth }: { size: number; ruleWidth: number }) {
  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontSize: size, lineHeight: size * 1.12 }]}
      >
        UNMOORED
      </Text>
      <View style={[styles.rule, { width: ruleWidth }]} />
      <Text style={styles.subtitle}>A DRIFT THROUGH THE QUIET DARK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontWeight: '700',
    color: palette.textPrimary,
    // letterSpacing adds trailing space after the last glyph; a matching
    // negative margin keeps the word optically centred.
    letterSpacing: tracking.display,
    marginRight: -tracking.display,
    textAlign: 'center',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.accent,
    opacity: 0.45,
    marginTop: 14,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
    marginTop: 14,
    textAlign: 'center',
  },
});
