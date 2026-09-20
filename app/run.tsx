import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { FuelBadge } from '@/components/FuelBadge';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { ShipArt } from '@/components/ships/ShipArt';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking } from '@/lib/theme';
import { loadRun, saveRun, hydrateRun, type RunState } from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import { FUEL_PER_RUN, encounterAt } from '@/lib/sectorMap';

/**
 * The helm: the ship adrift in open space with a single thing to do.
 *
 * Deliberately close to empty. The only control is JUMP, which opens the
 * sector map; the quiet LEAVE at the top exists so a player is never stuck
 * here with no way back to the title.
 */
export default function RunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const { settings } = useSettings();

  const [run, setRun] = useState<RunState | null>(null);

  // Re-read on focus so returning from a jump shows the new position.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRun().then((value) => {
        if (cancelled || !value) return;
        const filled = hydrateRun(value);
        if (filled !== value) saveRun(filled);
        setRun(filled);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? FUEL_PER_RUN;
  const dry = fuel <= 0;

  // What is here is only learned by arriving — the sector map shows plain dots.
  const encounter =
    run?.map && typeof run.position === 'number' ? encounterAt(run.map, run.position) : 'empty';
  const isBossFight = encounter === 'boss';

  const buttonWidth = Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );

  const onJump = useCallback(() => {
    if (dry) return;
    haptics.confirm();
    router.push('/sector');
  }, [dry, haptics, router]);

  const onLeave = useCallback(() => {
    haptics.tap();
    router.back();
  }, [haptics, router]);

  return (
    <View style={styles.container}>
      <Backdrop width={width} height={height} variant="deep" />
      <StarField width={width} height={height} reduceMotion={settings.reduceMotion} />

      <View style={[styles.leaveRow, { top: insets.top + 6 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave the run and return to the title screen"
          onPress={onLeave}
          hitSlop={16}
          style={styles.leave}
        >
          <Text style={styles.leaveLabel}>LEAVE</Text>
        </Pressable>
      </View>

      {/* Whatever is waiting here holds the upper half, facing down. */}
      {encounter === 'empty' ? null : (
        <Animated.View
          entering={settings.reduceMotion ? undefined : FadeIn.duration(520).delay(160)}
          style={[styles.encounterHolder, { paddingTop: insets.top + 74 }]}
        >
          <EncounterShip
            encounter={encounter}
            width={isBossFight ? 188 : 132}
            height={isBossFight ? 244 : 172}
          />
        </Animated.View>
      )}

      {/* The ship sits low, with the emptiness above it doing the work. */}
      <Animated.View
        entering={settings.reduceMotion ? undefined : FadeIn.duration(700)}
        style={[styles.shipHolder, { paddingBottom: insets.bottom + 188 }]}
      >
        <ShipArt shipId={ship.id} accent={ship.accent} width={132} height={172} />
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 44 }]}>
        <FuelBadge remaining={fuel} capacity={FUEL_PER_RUN} accent={ship.accent} />
        <MenuButton
          label={dry ? 'OUT OF FUEL' : 'JUMP'}
          onPress={onJump}
          primary={!dry}
          disabled={dry}
          width={buttonWidth}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  leaveRow: { position: 'absolute', left: 20, zIndex: 5 },
  leave: { paddingVertical: 6, paddingHorizontal: 4 },
  leaveLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
  },
  encounterHolder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  shipHolder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 18,
  },
});
