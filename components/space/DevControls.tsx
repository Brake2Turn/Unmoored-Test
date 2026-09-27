import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shieldLevel } from '@/lib/energy';
import { isWrecked } from '@/lib/hull';
import { devRefillCharges, foeHull, hitFoe, takeHit, type RunState } from '@/lib/run';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * Dev mode only, top right under the mode badge: a hit on either ship, and
 * every charge filled, on demand — so the shield, its effects, the hull and a
 * ship's destruction can be watched without waiting on a fight.
 *
 * Every one goes through the same rule the game uses (`takeHit`, `hitFoe`,
 * `devRefillCharges`). HIT THEM does not provoke a yellow ship: that only
 * comes from actually firing on it.
 */
export function DevControls({
  run,
  top,
  apply,
}: {
  run: RunState | null;
  top: number;
  apply: (rule: (current: RunState) => RunState) => void;
}) {
  const wrecked = !!run && isWrecked(run.hull);
  const canTakeHit = !!run && (shieldLevel(run.shieldCharge) > 0 || run.hull > 0);
  const canHitThem = !!run && !wrecked && foeHull(run) > 0;

  return (
    <View style={[styles.row, { top }]}>
      <DevButton
        label="DEV · TAKE A HIT"
        description="Developer: put a hit on the ship"
        enabled={canTakeHit}
        color={palette.danger}
        onPress={() => apply(takeHit)}
      />
      <DevButton
        label="DEV · HIT THEM"
        description="Developer: put a hit on the other ship"
        enabled={canHitThem}
        color={palette.danger}
        onPress={() => apply((current) => hitFoe(current, current.position))}
      />
      <DevButton
        label="DEV · REFILL CHARGES"
        description="Developer: fill every charge"
        enabled={!wrecked}
        color={palette.power}
        onPress={() => apply(devRefillCharges)}
      />
    </View>
  );
}

function DevButton({
  label,
  description,
  enabled,
  color,
  onPress,
}: {
  label: string;
  description: string;
  enabled: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.button}
    >
      <Text style={[styles.label, enabled && { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', right: 20, zIndex: 5, alignItems: 'flex-end' },
  button: { paddingVertical: 6, paddingHorizontal: 4 },
  label: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
  },
});
