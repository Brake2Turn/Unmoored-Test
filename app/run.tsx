import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import {
  REACTOR_CONTROLS_WIDTH,
  REACTOR_TAB_HEIGHT,
  REACTOR_TAB_WIDTH,
  ReactorControls,
  ReactorTab,
} from '@/components/ReactorPanel';
import { FadeInView } from '@/components/FadeInView';
import { STATUS_BAR_HEIGHT, StatusBar } from '@/components/StatusBar';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { SYSTEMS_SPAN, ShipSystems } from '@/components/ships/ShipSystems';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking, useMenuWidth } from '@/lib/theme';
import {
  chargeFractions,
  jumpBlocker,
  loadRun,
  reactorOf,
  saveRun,
  shiftEnergy,
  takeHit,
  tickRun,
  type RunState,
} from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import { encounterAt } from '@/lib/sectorMap';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { chargeRate, shieldLevel, type Subsystem } from '@/lib/energy';

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

/**
 * The jump is a compact control beside the reactor tab now, not a menu row.
 * It is still the full width of what is left and the tallest thing a thumb
 * needs to find, just no longer a panel in its own right.
 */
const JUMP_HEIGHT = 46;

/** The bottom row: the reactor tab sets its height. */
const CONTROL_ROW_HEIGHT = REACTOR_TAB_HEIGHT;

/**
 * How often the helm advances the hold timer and the shield charge.
 *
 * Four times a second is smooth enough for a countdown and a fade without
 * writing to storage on every frame — the save is throttled separately below.
 */
const TICK_MS = 250;
const SAVE_EVERY_TICKS = 8;

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
  // The reactor controls are only on screen while the player is using them.
  const [managing, setManaging] = useState(false);

  // The ticker reads the live run without being rebuilt on every tick.
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  // Re-read on focus so returning from a jump shows the new position, and
  // write back on the way out so the clocks do not rewind.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRun().then((value) => {
        if (!cancelled && value) setRun(value);
      });
      return () => {
        cancelled = true;
        if (runRef.current) void saveRun(runRef.current);
      };
    }, []),
  );

  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? 0;
  // Until the run has loaded there is nothing to jump with, so the button
  // stays closed rather than briefly offering a jump it cannot make.
  const blocked = run ? jumpBlocker(run) : 'fuel';

  // What is here is only learned by arriving — the sector map shows plain dots.
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const waiting = ENCOUNTER_STYLE[encounter];

  const buttonWidth = useMenuWidth();

  const canTakeHit = !!run && (shieldLevel(run.shieldCharge) > 0 || run.hull > 0);
  const charge = run ? chargeFractions(run) : { jump: 0, weapon: 0 };
  // Each clock is worth ticking only while it has somewhere to go and the
  // power to get there — a row with nothing in it does not creep along.
  const driveBuilding = !!run && charge.jump < 1 && chargeRate(run.energy.engines) > 0;
  const weaponBuilding = !!run && charge.weapon < 1 && chargeRate(run.energy.weapons) > 0;
  const shieldBuilding = !!run && run.shieldCharge < run.energy.shields;

  /**
   * The helm's clocks.
   *
   * It is the only screen that sits still, so it is the only one that
   * advances them. The interval is rebuilt only when there is something new
   * to count, not on every tick.
   */
  useEffect(() => {
    if (!driveBuilding && !weaponBuilding && !shieldBuilding) return;

    let ticks = 0;
    const timer = setInterval(() => {
      const current = runRef.current;
      if (!current) return;

      const next = tickRun(current, TICK_MS / 1000);
      if (next === current) return;

      setRun(next);
      ticks += 1;
      // Persist when a clock finishes, and occasionally along the way, rather
      // than writing to storage four times a second.
      if (ticks % SAVE_EVERY_TICKS === 0) void saveRun(next);
    }, TICK_MS);

    // The last tick of a clock is the one worth keeping, so write on the way
    // out as well as periodically.
    return () => {
      clearInterval(timer);
      if (runRef.current) void saveRun(runRef.current);
    };
  }, [driveBuilding, shieldBuilding, weaponBuilding]);

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
    STATUS_BAR_HEIGHT +
    CONTROL_ROW_HEIGHT +
    STACK_GAP * 3;
  const artBudget = height - chromeHeight;
  const artScale = Math.max(0.55, Math.min(1, artBudget / (waiting.height + SHIP_SLOT_HEIGHT)));

  const onJump = useCallback(() => {
    if (blocked) return;
    haptics.confirm();
    router.push('/sector');
  }, [blocked, haptics, router]);

  const onManage = useCallback(() => {
    haptics.tap();
    setManaging(true);
  }, [haptics]);

  const onDoneManaging = useCallback(() => {
    haptics.tap();
    setManaging(false);
  }, [haptics]);

  const onLeave = useCallback(() => {
    haptics.tap();
    router.back();
  }, [haptics, router]);

  /**
   * The button says what it does and nothing more.
   *
   * While the drive is still building it is simply closed — the slider under
   * the engines row is the readout now, rather than a countdown printed over
   * the button. Cold engines still get their own words, because that is a
   * different problem and the slider would just sit there unexplained.
   */
  const jumpLabel =
    blocked === 'fuel' ? 'OUT OF FUEL' : blocked === 'engines' ? 'ENGINES OFFLINE' : 'JUMP';
  const jumpCaption = blocked === 'engines' ? 'PUT A BAR INTO ENGINES' : undefined;

  /**
   * Dev only: put a hit on the ship so the shield, its effects and the hull
   * can be watched without any combat to do it. Delete this with the button.
   */
  const onTakeHit = useCallback(() => {
    if (!run) return;
    const next = takeHit(run);
    if (next === run) return;
    setRun(next);
    haptics.tap();
    void saveRun(next);
  }, [haptics, run]);

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

      {/* Dev only, opposite LEAVE: there is nothing to shoot the shield yet. */}
      <View style={[styles.devRow, { top: insets.top + 6 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Developer: put a hit on the ship"
          accessibilityState={{ disabled: !canTakeHit }}
          disabled={!canTakeHit}
          onPress={onTakeHit}
          hitSlop={16}
          style={styles.leave}
        >
          <Text style={[styles.leaveLabel, canTakeHit && { color: palette.danger }]}>
            DEV · TAKE A HIT
          </Text>
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
            longer exhaust for engines. */}
        <FadeInView enabled={!settings.reduceMotion} duration={700}>
          <ShipSystems
            shipId={ship.id}
            accent={ship.accent}
            width={SHIP_WIDTH * artScale}
            height={SHIP_HEIGHT * artScale}
            shields={shieldLevel(run?.shieldCharge ?? 0)}
            shieldHits={run?.shieldHits ?? 0}
            engines={run?.energy.engines ?? 0}
            animate={!settings.reduceMotion}
          />
        </FadeInView>

        {/* What this ship has left, on one line. */}
        <StatusBar
          hull={run?.hull ?? 0}
          fuel={fuel}
          accent={ship.accent}
          width={buttonWidth}
        />

        {/* The reactor at a glance, and the one place to go. */}
        <View style={[styles.controlRow, { width: buttonWidth }]}>
          {run ? (
            <ReactorTab
              energy={run.energy}
              reactor={reactorOf(run)}
              onPress={onManage}
            />
          ) : (
            <View style={{ width: REACTOR_TAB_WIDTH }} />
          )}

          <View style={styles.jumpHolder}>
            <MenuButton
              label={jumpLabel}
              caption={jumpCaption}
              onPress={onJump}
              primary={!blocked}
              disabled={!!blocked}
              width={buttonWidth - REACTOR_TAB_WIDTH - STACK_GAP}
              height={JUMP_HEIGHT}
            />
          </View>
        </View>
      </View>

      {/* The controls open over the helm rather than living in it, so the
          room they need is only taken while they are being used. */}
      {managing && run ? (
        <>
          {/* Dims the helm behind the controls, and catches the tap that
              closes them. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the reactor controls"
            onPress={onDoneManaging}
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
          <View
            style={[
              styles.controlsHolder,
              {
                bottom: insets.bottom + 40 + CONTROL_ROW_HEIGHT + 12,
                left: Math.max(16, (width - REACTOR_CONTROLS_WIDTH) / 2),
              },
            ]}
          >
            <ReactorControls
              energy={run.energy}
              reactor={reactorOf(run)}
              charges={{
                shield: run.shieldCharge,
                weapon: charge.weapon,
                engine: charge.jump,
              }}
              onShift={onShift}
              animate={!settings.reduceMotion}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  leaveRow: { position: 'absolute', left: 20, zIndex: 5 },
  devRow: { position: 'absolute', right: 20, zIndex: 5 },
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

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CONTROL_ROW_HEIGHT,
    gap: STACK_GAP,
  },
  jumpHolder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(5,7,15,0.62)', zIndex: 9 },
  controlsHolder: { position: 'absolute', zIndex: 10 },
});
