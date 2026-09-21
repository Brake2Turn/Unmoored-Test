import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { FadeInView } from '@/components/FadeInView';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { ShipArt } from '@/components/ships/ShipArt';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, palette, tracking, useMenuWidth } from '@/lib/theme';
import { fuelIsLow, loadRun, type RunState } from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import { encounterAt } from '@/lib/sectorMap';
import { ENCOUNTER_STYLE } from '@/lib/encounters';

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
        if (!cancelled && value) setRun(value);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? 0;
  const dry = fuel <= 0;

  // What is here is only learned by arriving — the sector map shows plain dots.
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const waiting = ENCOUNTER_STYLE[encounter];

  const buttonWidth = useMenuWidth();

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
        <FadeInView
          enabled={!settings.reduceMotion}
          duration={520}
          delay={160}
          style={[styles.encounterHolder, { paddingTop: insets.top + 74 }]}
        >
          <EncounterShip encounter={encounter} width={waiting.width} height={waiting.height} />
        </FadeInView>
      )}

      {/* The ship sits low, with the emptiness above it doing the work. */}
      <FadeInView
        enabled={!settings.reduceMotion}
        duration={700}
        // Clears the footer button. The gauge moved inside it, so the ship
        // sits lower than it did when a separate badge stood above it.
        style={[styles.shipHolder, { paddingBottom: insets.bottom + 150 }]}
      >
        <ShipArt shipId={ship.id} accent={ship.accent} width={132} height={172} />
      </FadeInView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 44 }]}>
        <MenuButton
          label={dry ? 'OUT OF FUEL' : 'JUMP'}
          // An empty tank is already the whole label; a FUEL 0 gauge beside it
          // would only say it twice.
          readout={dry ? undefined : { label: 'FUEL', value: String(fuel), alert: fuelIsLow(fuel) }}
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
