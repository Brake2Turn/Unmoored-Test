import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { DialogueOverlay } from '@/components/DialogueOverlay';
import { Explosion } from '@/components/Explosion';
import { GameOver } from '@/components/GameOver';
import { LaserShot } from '@/components/LaserShot';
import { MissPop } from '@/components/MissPop';
import { ModeBadge } from '@/components/ModeBadge';
import { ShipDetail } from '@/components/ShipPanel';
import { StarField } from '@/components/StarField';
import { useScreenBox } from '@/components/useScreenBox';
import { Arena } from '@/components/space/Arena';
import { Controls } from '@/components/space/Controls';
import { DevControls } from '@/components/space/DevControls';
import {
  CONTROL_ROW_HEIGHT,
  DEV_ROW_TOP,
  HUD_BOTTOM,
  HUD_TOP,
  STACK_GAP,
  artScaleFor,
} from '@/components/space/layout';
import { MISS_MS, useCombat } from '@/components/space/useCombat';
import { useDrift } from '@/components/space/useDrift';
import { useLiveRun } from '@/components/space/useLiveRun';
import { useRunClock } from '@/components/space/useRunClock';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import type { Subsystem } from '@/lib/energy';
import type { Place } from '@/lib/hold';
import { isWrecked } from '@/lib/hull';
import {
  jumpBlocker,
  markSpoken,
  modeOf,
  moveGear,
  pendingMeeting,
  shiftEnergy,
  shipHere,
  wrenBars,
} from '@/lib/run';
import { clearRun } from '@/lib/runStore';
import { encounterAt } from '@/lib/sectorMap';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking, useMenuWidth } from '@/lib/theme';

/**
 * The space screen (the "helm" in the code): the ship against the stars, the
 * reactor to divide up, and one place to go.
 *
 * This file only puts the pieces together; each lives in `components/space/`:
 * the live run and its saving (`useLiveRun`), the charging clock
 * (`useRunClock`), everything fired and blown up (`useCombat`), the two ships
 * (`Arena`), the controls at the bottom (`Controls`), the dev buttons
 * (`DevControls`) and the measurements they share (`layout`).
 *
 * The quiet LEAVE at the top exists so a player is never stuck here with no
 * way back to the title — until the ship is destroyed, when Game Over is the
 * way out. JUMP opens star select, which carries none of the reactor, because
 * choosing where to go is a different decision from deciding what to power.
 */
export default function RunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // What the screen was given, not the window — see `useScreenBox`.
  const { width, height, onLayout } = useScreenBox();
  const haptics = useHaptics();
  const { settings } = useSettings();
  const animate = !settings.reduceMotion;
  const buttonWidth = useMenuWidth();

  const live = useLiveRun();
  const { run, runRef, commit, apply } = live;
  useRunClock(live);
  // A ship with power in its Wren Drive bobs gently, and both line up before
  // each shot.
  const drifting = animate && !!run && !isWrecked(run.hull);
  const drift = useDrift(drifting, run?.position ?? null, {
    player: run ? wrenBars(run, 'player') : 0,
    foe: run ? wrenBars(run, 'foe') : 0,
  });
  const combat = useCombat(live, drift, width);

  // The ship panel is only on screen while the player is looking at it.
  const [shipOpen, setShipOpen] = useState(false);

  const wrecked = !!run && isWrecked(run.hull);
  // What is here is only learned by arriving — star select shows plain dots.
  // A destroyed ship's star counts as empty once its explosion is over.
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const laidOut =
    run && shipHere(run) === 'empty' && combat.cleared === run.position ? 'empty' : encounter;
  const artScale = artScaleFor({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    other: laidOut === 'empty' ? null : ENCOUNTER_STYLE[laidOut],
  });

  /**
   * What this star still has to say, if anything. Derived rather than held:
   * the run records which stars have spoken, so the overlay simply stops
   * rendering once the arrival is marked.
   */
  const talking = run ? pendingMeeting(run) : null;
  const onDialogueDone = useCallback(() => {
    const current = runRef.current;
    if (current) commit(markSpoken(current));
  }, [commit, runRef]);

  const onShift = useCallback(
    (subsystem: Subsystem, delta: number) => apply((current) => shiftEnergy(current, subsystem, delta)),
    [apply],
  );
  const onMoveGear = useCallback(
    (from: Place, to: Place) => apply((current) => moveGear(current, from, to)),
    [apply],
  );

  const onJump = useCallback(() => {
    const current = runRef.current;
    if (!current || jumpBlocker(current)) return;
    haptics.confirm();
    router.push('/sector');
  }, [haptics, router, runRef]);

  const onOpenShip = useCallback(() => {
    haptics.tap();
    setShipOpen(true);
  }, [haptics]);

  const onCloseShip = useCallback(() => {
    haptics.tap();
    setShipOpen(false);
  }, [haptics]);

  const onLeave = useCallback(() => {
    // A destroyed ship leaves through Game Over, which ends the run; leaving
    // here would slip past it and keep the wreck as a run to continue.
    if (runRef.current && isWrecked(runRef.current.hull)) return;
    haptics.tap();
    router.back();
  }, [haptics, router, runRef]);

  /**
   * Leaving a destroyed run, either way, ends it. The run is let go of here
   * first — this screen writes its run back to storage as it closes, and
   * would otherwise save the wreck again straight after it was cleared.
   */
  const { setOver } = combat;
  const endRun = useCallback(
    async (to: 'new' | 'menu') => {
      haptics.confirm();
      commit(null);
      setOver(false);
      await clearRun();
      if (to === 'new') router.replace('/select-ship');
      else router.back();
    },
    [commit, haptics, router, setOver],
  );

  return (
    <View ref={combat.rootRef} collapsable={false} onLayout={onLayout} style={styles.container}>
      <Backdrop width={width} height={height} variant="deep" />
      {/* Travelling alone the stars stream past, right to left; with another
          ship alongside they hold still and twinkle. */}
      <StarField width={width} height={height} reduceMotion={settings.reduceMotion} flowing={laidOut === 'empty'} />

      {/* Gone quiet once the ship is destroyed: Game Over is the way out. */}
      <View style={[styles.leaveRow, { top: insets.top + 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave the run and return to the title screen"
          accessibilityState={{ disabled: wrecked }}
          disabled={wrecked}
          onPress={onLeave}
          hitSlop={16}
          style={[styles.leave, wrecked && styles.leaveDead]}
        >
          <Text style={styles.leaveLabel}>LEAVE</Text>
        </Pressable>
      </View>

      {/* Which mode the run is in, opposite LEAVE. */}
      {run ? (
        <View style={[styles.modeRow, { top: insets.top + 2 }]}>
          <ModeBadge mode={modeOf(run)} />
        </View>
      ) : null}

      {settings.devMode ? <DevControls run={run} top={insets.top + DEV_ROW_TOP} apply={apply} /> : null}

      <View style={[styles.stack, { paddingTop: insets.top + HUD_TOP, paddingBottom: insets.bottom + HUD_BOTTOM }]}>
        <Arena
          run={run}
          laidOut={laidOut}
          artScale={artScale}
          animate={animate}
          shipRef={combat.shipRef}
          foeRef={combat.foeRef}
          drift={drift}
        />
        <Controls
          run={run}
          width={buttonWidth}
          animate={animate}
          onShift={onShift}
          onFire={combat.onFire}
          onOpenShip={onOpenShip}
          onJump={onJump}
        />
      </View>

      {/* Bolts in flight and the sparks where they land, over both ships. */}
      {combat.shots.map((shot) => (
        <LaserShot
          key={shot.id}
          from={shot.from}
          to={shot.to}
          hits={shot.hits}
          animate={animate}
          onImpact={() => combat.onImpact(shot)}
          onDone={() => combat.onShotDone(shot.id)}
        />
      ))}

      {/* MISS over whichever ship a bolt just went past. */}
      {combat.misses.map((miss) => (
        <MissPop key={miss.id} at={miss.at} animate={animate} duration={MISS_MS} />
      ))}

      {combat.over ? (
        <GameOver
          width={Math.min(300, width - 48)}
          onNewRun={() => void endRun('new')}
          onMenu={() => void endRun('menu')}
        />
      ) : null}

      {combat.blasts.map((blast) => (
        <Explosion key={blast.id} at={blast.at} size={blast.size} animate={animate} />
      ))}

      {/* The ship panel opens over the screen rather than living in it, so the
          room it needs is only taken while it is being used. */}
      {shipOpen && run ? (
        <>
          {/* Dims everything behind the panel, and catches the tap that
              closes it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the ship"
            onPress={onCloseShip}
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
            <ShipDetail loadout={{ mounted: run.mounted, hold: run.hold }} onMove={onMoveGear} />
          </View>
        </>
      ) : null}

      {/* Whatever is out here speaks first. Over everything, including an
          open panel, because nothing else can be done until it has. */}
      {talking ? (
        <DialogueOverlay
          meeting={talking}
          bottom={insets.bottom + HUD_BOTTOM + CONTROL_ROW_HEIGHT + STACK_GAP}
          onDone={onDialogueDone}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  leaveRow: { position: 'absolute', left: 20, zIndex: 5 },
  modeRow: { position: 'absolute', right: 20, zIndex: 5 },
  leave: { paddingVertical: 6, paddingHorizontal: 4 },
  leaveDead: { opacity: 0.3 },
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
  scrim: { backgroundColor: 'rgba(5,7,15,0.62)', zIndex: 9 },
  panelHolder: { position: 'absolute', zIndex: 10 },
});
