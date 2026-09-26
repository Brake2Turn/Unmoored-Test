import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { FireBlock } from '@/lib/runStore';
import { BUTTON_TONE } from '@/lib/subsystems';
import { fonts, layout, palette, tracking } from '@/lib/theme';

/**
 * Fires the weapon. Three looks, one per state, so the button says whether it
 * will do anything before it is pressed:
 *
 * - **grey** — nothing on the hardpoint, so nothing to fire;
 * - **dark red** — a weapon is mounted and still charging;
 * - **bright red** — charged and ready. One press spends the whole charge.
 */
const TONE = BUTTON_TONE.weapons;
const LOOK: Record<'weapon' | 'charging' | 'ready', { fill: string; border: string; text: string }> = {
  weapon: { fill: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.12)', text: palette.textDisabled },
  charging: { fill: TONE.dark.fill, border: TONE.dark.border, text: TONE.dark.label },
  ready: { fill: TONE.bright, border: TONE.bright, text: TONE.ink },
};

export function FireButton({
  blocked,
  weaponName,
  width,
  height,
  onPress,
}: {
  blocked: FireBlock;
  weaponName: string | null;
  width: number;
  height: number;
  onPress: () => void;
}) {
  // A destroyed ship has nothing to fire with, which looks the same as having
  // no weapon mounted.
  const state = blocked === 'wrecked' ? 'weapon' : (blocked ?? 'ready');
  const look = LOOK[state];
  const label =
    blocked === 'wrecked'
      ? 'Fire: the ship is destroyed'
      : state === 'weapon'
      ? 'Fire: no weapon mounted'
      : state === 'charging'
        ? `Fire: ${weaponName ?? 'weapon'} is charging`
        : `Fire ${weaponName ?? 'the weapon'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!blocked }}
      disabled={!!blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width, height, backgroundColor: look.fill, borderColor: look.border },
        state === 'ready' && styles.glow,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: look.text }]}>FIRE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: layout.buttonRadius,
    borderWidth: 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    shadowColor: palette.weapons,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: { opacity: 0.8 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: tracking.label,
    marginRight: -tracking.label,
  },
});
