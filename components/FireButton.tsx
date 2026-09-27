import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FireBlock } from '@/lib/run';
import { BUTTON_TONE } from '@/lib/subsystems';
import { fonts, layout, palette, tracking } from '@/lib/theme';

/**
 * AUTOFIRE: a switch, not a trigger. Choosing a target (tap the weapon on the
 * ship, then one of their systems) fires at it once, as soon as the weapon is
 * charged, and the target is spent. On, the target is kept and fired at on
 * every full charge. The second line says where things stand:
 *
 * - **OFF** — dark, outlined: one shot per target chosen;
 * - **ONE SHOT** — off, with a target chosen and its shot waiting on the charge;
 * - **ON** — red: firing on every full charge;
 * - **NO TARGET** / **NO WEAPON** — on, but with nothing to fire at or with.
 */
const TONE = BUTTON_TONE.weapons;

export function FireButton({
  on,
  blocked,
  targeted,
  weaponName,
  width,
  height,
  onPress,
}: {
  /** Autofire is switched on. */
  on: boolean;
  blocked: FireBlock;
  /** A subsystem on the other ship is targeted. */
  targeted: boolean;
  weaponName: string | null;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const noWeapon = blocked === 'weapon' || blocked === 'wrecked';
  const status = !on ? (targeted && !noWeapon ? 'ONE SHOT' : 'OFF') : noWeapon ? 'NO WEAPON' : !targeted ? 'NO TARGET' : 'ON';
  const live = status === 'ON';
  const look = live
    ? { fill: TONE.bright, border: TONE.bright, text: TONE.ink, status: TONE.ink }
    : on
      ? { fill: TONE.dark.fill, border: TONE.dark.border, text: TONE.dark.label, status: TONE.dark.label }
      : { fill: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.16)', text: palette.textMuted, status: palette.textDisabled };

  const label = on
    ? `Autofire is on${status === 'ON' ? `: ${weaponName ?? 'the weapon'} fires at the target every full charge` : `, but ${status.toLowerCase()}`}. Turn autofire off`
    : 'Autofire is off. Turn autofire on';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled: blocked === 'wrecked' }}
      disabled={blocked === 'wrecked'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width, height, backgroundColor: look.fill, borderColor: look.border },
        live && styles.glow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.stack}>
        <Text style={[styles.label, { color: look.text }]}>AUTOFIRE</Text>
        <Text numberOfLines={1} style={[styles.status, { color: look.status }]}>
          {status}
        </Text>
      </View>
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
  stack: { alignItems: 'center', gap: 3 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
  status: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginRight: -1.2,
  },
});
