import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CARD } from '@/components/PanelChrome';
import { MenuButton } from '@/components/MenuButton';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * What comes up when the player's ship is destroyed: GAME OVER, and the two
 * ways on — straight into a new run (ship select), or back to the start
 * screen. Either one ends this run; the screen behind is greyed out and takes
 * no more input.
 */
export function GameOver({
  width,
  onNewRun,
  onMenu,
}: {
  width: number;
  onNewRun: () => void;
  onMenu: () => void;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim]}>
      <View style={[styles.card, { width }]} accessibilityRole="alert">
        <Text style={styles.title}>GAME OVER</Text>
        <Text style={styles.line}>Your ship was destroyed.</Text>
        <View style={styles.buttons}>
          <MenuButton label="NEW RUN" onPress={onNewRun} primary width={width - 40} height={52} />
          <MenuButton label="MAIN MENU" onPress={onMenu} width={width - 40} height={52} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(5,7,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  card: {
    ...CARD,
    borderColor: 'rgba(255,93,107,0.35)',
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: palette.danger,
    letterSpacing: 6,
    marginRight: -6,
  },
  line: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 10,
  },
  buttons: { gap: 12, marginTop: 24 },
});
