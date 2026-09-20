import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ENERGY_PANEL_HEIGHT, EnergyPanel } from '@/components/EnergyPanel';
import { FadeInView } from '@/components/FadeInView';
import { FuelBadge } from '@/components/FuelBadge';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { SYSTEMS_SPAN, ShipSystems } from '@/components/ships/ShipSystems';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking, useMenuWidth } from '@/lib/theme';
import { loadRun, reactorOf, saveRun, shiftEnergy, type RunState } from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import { encounterAt } from '@/lib/sectorMap';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import type { Subsystem } from '@/lib/energy';

/** The player's ship at full size, before the screen decides it has no room. */
const SHIP_WIDTH = 132;
const SHIP_HEIGHT = 172;

/**
 * What the ship actually occupies once its shield and exhaust are drawn.
 *
 * The budget below has to reserve the whole systems box, not just the hull,
 * or a wide shield would run into whatever is waiting above.
 */
const SHIP_SLOT_HEIGHT = SHIP_HEIGHT * SYSTEMS_SPAN;

/** Space between the stacked pieces of the helm. */
const STACK_GAP = 16;

/** Roughly what the fuel badge stands up in. */
const FUEL_ROW_HEIGHT = 22;

/**
 * The helm: the ship in front of you, with the reactor to divide up and one
 * place to go.
 *
 * The quiet LEAVE at the top exists so a player is never stuck here with no
 * way back to the title. JUMP opens the sector map — which carries none of
 * the reactor panel, because choosing where to go is a different decision
 * from deciding what to power.
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

  /**
   * The two pieces of ship art share whatever the controls leave over.
   *
   * Worked out rather than guessed: the controls now take a fixed, known
   * amount of the screen, and fixed art sizes would have dropped the Elder
   * Shrike straight through the player's ship on a short phone.
   */
  const chromeHeight =
    insets.top +
    58 +
    insets.bottom +
    40 +
    ENERGY_PANEL_HEIGHT +
    FUEL_ROW_HEIGHT +
    layout.buttonHeight +
    STACK_GAP * 4;
  const artBudget = height - chromeHeight;
  const artScale = Math.max(0.55, Math.min(1, artBudget / (waiting.height + SHIP_SLOT_HEIGHT)));

  const onJump = useCallback(() => {
    if (dry) return;
    haptics.confirm();
    router.push('/sector');
  }, [dry, haptics, router]);

  const onLeave = useCallback(() => {
    haptics.tap();
    router.back();
  }, [haptics, router]);

  /**
   * Moving a bar of energy.
   *
   * `shiftEnergy` hands back the same run when the move is not legal, so a
   * press on a greyed-out control costs nothing: no write, no buzz, no render.
   */
  const onShift = useCallback(
    (subsystem: Subsystem, delta: number) => {
      if (!run) return;
      const next = shiftEnergy(run, subsystem, delta);
      if (next === run) return;
      setRun(next);
      haptics.tap();
      void saveRun(next);
    },
    [haptics, run],
  );

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

      <View
        style={[
          styles.stack,
          { paddingTop: insets.top + 58, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Whatever is waiting here holds the upper half, facing down. */}
        <View style={styles.encounterSlot}>
          {encounter === 'empty' ? null : (
            <FadeInView enabled={!settings.reduceMotion} duration={520} delay={160}>
              <EncounterShip
                encounter={encounter}
                width={waiting.width * artScale}
                height={waiting.height * artScale}
              />
            </FadeInView>
          )}
        </View>

        {/* The reactor allocation, drawn on the ship: a bubble for shields, a
            longer exhaust for piloting. */}
        <FadeInView enabled={!settings.reduceMotion} duration={700}>
          <ShipSystems
            shipId={ship.id}
            accent={ship.accent}
            width={SHIP_WIDTH * artScale}
            height={SHIP_HEIGHT * artScale}
            shields={run?.energy.shields ?? 0}
            piloting={run?.energy.piloting ?? 0}
            animate={!settings.reduceMotion}
          />
        </FadeInView>

        {/* Only here, with the ship in front of you — never on the sector map. */}
        {run ? (
          <EnergyPanel
            energy={run.energy}
            reactor={reactorOf(run)}
            width={buttonWidth}
            onShift={onShift}
          />
        ) : (
          <View style={{ height: ENERGY_PANEL_HEIGHT }} />
        )}

        <FuelBadge remaining={fuel} accent={ship.accent} />
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

  stack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: STACK_GAP,
  },
  /** Takes the slack, so everything below it sits at a fixed height. */
  encounterSlot: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'flex-start' },
});
