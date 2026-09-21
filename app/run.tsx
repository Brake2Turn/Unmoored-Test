import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { ReactorControls, ReactorTab } from '@/components/ReactorPanel';
import { CargoDetail, CargoTab, CrewDetail, CrewTab } from '@/components/HoldPanels';
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
 * The jump is a compact control under the tabs now, not a menu row. It is
 * still the full width of the chrome and the tallest thing a thumb needs to
 * find, just no longer a panel in its own right.
 */
const JUMP_HEIGHT = 46;

/** Between the three tabs, and between the row of them and the jump. */
const TAB_GAP = 10;

/**
 * What the helm holds back above the topmost art and below the jump button.
 *
 * Both used to be larger, and the slack came out of the middle — the one part
 * of this screen worth giving room to, since the ship and whatever is waiting
 * for it are the only things on it. The top only has to clear LEAVE and the
 * dev control, which are a single line of ten-point type; the bottom only has
 * to keep the jump button off the edge of the phone, on top of whatever safe
 * area the hardware already asks for.
 *
 * They are named because two places need to agree on them: the padding that
 * positions the stack, and the budget that sizes the art inside it. When they
 * were written out twice, changing one silently mis-scaled the ships.
 */
const HUD_TOP = 44;
const HUD_BOTTOM = 20;

/** The bottom of the helm: a row of tabs with the jump beneath it. */
const CONTROL_ROW_HEIGHT = layout.tabHeight + TAB_GAP + JUMP_HEIGHT;

/** Which panel is open over the helm, if any. */
type OpenPanel = 'reactor' | 'cargo' | 'crew';

/** What the scrim says it will close, so the label matches what is on top. */
const PANEL_LABEL: Record<OpenPanel, string> = {
  reactor: 'the reactor controls',
  cargo: 'the hold',
  crew: 'the crew',
};

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
  // A panel is only on screen while the player is actually looking at it, and
  // only ever one: they open in the same place, over the same scrim.
  const [open, setOpen] = useState<OpenPanel | null>(null);

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
  /** The three tabs are identical, and together they are the chrome's width. */
  const tabWidth = Math.floor((buttonWidth - TAB_GAP * 2) / 3);

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
    HUD_TOP +
    insets.bottom +
    HUD_BOTTOM +
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

  const onOpenReactor = useCallback(() => {
    haptics.tap();
    setOpen('reactor');
  }, [haptics]);

  const onOpenCargo = useCallback(() => {
    haptics.tap();
    setOpen('cargo');
  }, [haptics]);

  const onOpenCrew = useCallback(() => {
    haptics.tap();
    setOpen('crew');
  }, [haptics]);

  const onClosePanel = useCallback(() => {
    haptics.tap();
    setOpen(null);
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
    blocked === 'fuel' ? 'OUT OF FUEL' : blocked === 'engines' ? 'NO ENGINES' : 'JUMP';
  const jumpCaption = blocked === 'engines' ? 'POWER THE ENGINES' : undefined;
  /**
   * Fuel rides on the button rather than in a strip of its own, since the only
   * question it answers is whether to jump. It is left off when the label is
   * already saying the tank is empty.
   */
  const jumpFuel = blocked === 'fuel' ? undefined : { label: 'FUEL', value: String(fuel) };

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

      <View style={[styles.leaveRow, { top: insets.top + 2 }]}>
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
      <View style={[styles.devRow, { top: insets.top + 2 }]}>
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
          { paddingTop: insets.top + HUD_TOP, paddingBottom: insets.bottom + HUD_BOTTOM },
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
            width={SHIP_WIDTH * artScale}
            height={SHIP_HEIGHT * artScale}
            shields={shieldLevel(run?.shieldCharge ?? 0)}
            shieldHits={run?.shieldHits ?? 0}
            engines={run?.energy.engines ?? 0}
            animate={!settings.reduceMotion}
          />
        </FadeInView>

        {/* What this ship has left, on one line. */}
        <StatusBar hull={run?.hull ?? 0} width={buttonWidth} />

        {/* What the ship is, at a glance: its reactor, its hold, its berths.
            Each opens over the helm; the jump sits under all three. */}
        <View style={{ width: buttonWidth, gap: TAB_GAP }}>
          <View style={styles.tabRow}>
            {run ? (
              <>
                <ReactorTab
                  energy={run.energy}
                  reactor={reactorOf(run)}
                  charges={{
                    shield: run.shieldCharge,
                    weapon: charge.weapon,
                    engine: charge.jump,
                  }}
                  width={tabWidth}
                  onPress={onOpenReactor}
                />
                <CargoTab cargo={ship.cargo} width={tabWidth} onPress={onOpenCargo} />
                <CrewTab width={tabWidth} onPress={onOpenCrew} />
              </>
            ) : (
              <View style={{ height: layout.tabHeight }} />
            )}
          </View>

          <MenuButton
            label={jumpLabel}
            caption={jumpCaption}
            onPress={onJump}
            primary={!blocked}
            disabled={!!blocked}
            gauge={jumpFuel}
            width={buttonWidth}
            height={JUMP_HEIGHT}
          />
        </View>
      </View>

      {/* A panel opens over the helm rather than living in it, so the room it
          needs is only taken while it is being used. */}
      {open && run ? (
        <>
          {/* Dims the helm behind the panel, and catches the tap that closes
              it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${PANEL_LABEL[open]}`}
            onPress={onClosePanel}
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
          <View
            style={[
              styles.panelHolder,
              {
                bottom: insets.bottom + HUD_BOTTOM + CONTROL_ROW_HEIGHT + 12,
                left: Math.max(16, (width - layout.panelWidth) / 2),
              },
            ]}
          >
            {open === 'reactor' ? (
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
            ) : open === 'cargo' ? (
              <CargoDetail cargo={ship.cargo} />
            ) : (
              <CrewDetail />
            )}
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

  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.tabHeight,
  },
  scrim: { backgroundColor: 'rgba(5,7,15,0.62)', zIndex: 9 },
  panelHolder: { position: 'absolute', zIndex: 10 },
});
