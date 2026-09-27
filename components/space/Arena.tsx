import React, { useEffect, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { FadeInView } from '@/components/FadeInView';
import { FOE_STATUS_HEIGHT, FoeStatus } from '@/components/FoeStatus';
import { EncounterShip, systemSpots } from '@/components/ships/EncounterShip';
import { MOUNTS, SYSTEM_SPOTS } from '@/components/ships/ShipArt';
import { SystemMarks } from '@/components/ships/SystemMarks';
import { Sideways } from '@/components/ships/Sideways';
import { SYSTEMS_SPAN, ShipSystems } from '@/components/ships/ShipSystems';
import {
  ARENA_GAP,
  ARENA_MARGIN,
  FOE_STATUS_WIDTH,
  SHIP_HEIGHT,
  SHIP_WIDTH,
} from '@/components/space/layout';
import type { Drift } from '@/components/space/useDrift';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { WEAPON_UNITS, shieldLevel, type Subsystem } from '@/lib/energy';
import { isWrecked } from '@/lib/hull';
import {
  foeCapacity,
  foeHull,
  foeHullMax,
  foeLooksHostile,
  foeName,
  foeSystems,
  shipHere,
  systemCapacity,
  wrenBars,
  type RunState,
} from '@/lib/run';
import { fonts, palette, tracking } from '@/lib/theme';
import { encounterAt, type Encounter } from '@/lib/sectorMap';
import { shipById } from '@/lib/ships';

/**
 * The two ships, side by side: the player on the left facing right, whatever
 * is waiting on the right facing left. Alone, the player holds the middle.
 *
 * A destroyed ship keeps its place while it explodes — only made invisible —
 * so nothing else moves mid-explosion and its measured box is still there to
 * place the explosion on. `laidOut` is what the row is sized for: the screen
 * turns it to `empty` once the explosion is over, which lets the player's
 * ship take the middle.
 *
 * With power in its Wren Drive a ship bobs up and down (`useDrift`). The drift moves only the
 * drawing inside each measured box, so the boxes stay where the layout put
 * them and a shot is aimed from those plus the drift's known height.
 */
export function Arena({
  run,
  laidOut,
  artScale,
  animate,
  shipRef,
  foeRef,
  drift,
  onTarget,
}: {
  run: RunState | null;
  laidOut: Encounter;
  artScale: number;
  animate: boolean;
  shipRef: RefObject<View | null>;
  foeRef: RefObject<View | null>;
  drift: Drift;
  /** The player picked a subsystem on the other ship to aim at. */
  onTarget: (target: Subsystem | null) => void;
}) {
  const playerDrift = useAnimatedStyle(() => ({ transform: [{ translateY: drift.player.value }] }));
  const foeDrift = useAnimatedStyle(() => ({ transform: [{ translateY: drift.foe.value }] }));
  const ship = shipById(run?.shipId);
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const present = run ? shipHere(run) : 'empty';
  const waiting = ENCOUNTER_STYLE[laidOut];
  const wrecked = !!run && isWrecked(run.hull);

  // Aiming: tapping the weapon on the player's ship opens the other ship's
  // systems to be picked, and picking one (or tapping the weapon again)
  // closes it. Only while there is a live ship here to aim at.
  const canAim = !!run && !!run.mounted && present !== 'empty' && !wrecked;
  const [aiming, setAiming] = useState(false);
  useEffect(() => {
    if (!canAim) setAiming(false);
  }, [canAim]);
  const choose = (target: Subsystem) => {
    // Picking a system — even the one already aimed at — is an order to fire
    // at it once the weapon is charged.
    onTarget(target);
    setAiming(false);
  };

  // Where the ships' parts land on screen: the player's box is its systems
  // box turned on its side, with the ship art a `SYSTEMS_SPAN` share of it.
  const shipBoxW = SHIP_HEIGHT * artScale * SYSTEMS_SPAN;
  const shipBoxH = SHIP_WIDTH * artScale * SYSTEMS_SPAN;
  const shipUnit = (SHIP_WIDTH * artScale) / 200;
  const mount = MOUNTS[ship.id] ?? MOUNTS.drifter;
  // The weapon stands forward of its mount; the tap target sits over its middle.
  const gunX = shipBoxW / 2 + (130 - (mount.y - 14)) * shipUnit;
  const gunY = shipBoxH / 2 + (mount.x - 100) * shipUnit;
  const foeBoxW = waiting.height * artScale;
  const foeBoxH = waiting.width * artScale;
  const foeUnit = (waiting.width * artScale) / 200;
  const foeShield = run ? shieldLevel(run.foeShieldCharge) : 0;

  return (
    <View style={styles.arena}>
      {aiming ? (
        <Text pointerEvents="none" style={styles.hint}>
          TAP ONE OF THEIR SYSTEMS TO TARGET
        </Text>
      ) : null}
      {/* The reactor allocation, drawn on the ship: a bubble for shields, a
          brighter engine for the Wren Drive. */}
      <FadeInView enabled={animate} duration={700}>
        <View ref={shipRef} collapsable={false} style={wrecked ? styles.gone : null}>
          <Animated.View style={playerDrift}>
            <Sideways
              width={SHIP_WIDTH * artScale * SYSTEMS_SPAN}
              height={SHIP_HEIGHT * artScale * SYSTEMS_SPAN}
            >
              <ShipSystems
                shipId={ship.id}
                width={SHIP_WIDTH * artScale}
                height={SHIP_HEIGHT * artScale}
                shields={shieldLevel(run?.shieldCharge ?? 0)}
                shieldHits={run?.shieldHits ?? 0}
                engines={run?.energy.engines ?? 0}
                weapon={run?.mounted ?? null}
                animate={animate}
              />
            </Sideways>
            {run ? (
              <SystemMarks
                width={shipBoxW}
                height={shipBoxH}
                unit={shipUnit}
                spots={SYSTEM_SPOTS[ship.id] ?? SYSTEM_SPOTS.drifter}
                systems={run.energy}
                capacity={systemCapacity(run)}
                owner="your"
              />
            ) : null}
            {/* The weapon on the nose: tap it to choose what to aim at. */}
            {canAim ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={aiming ? 'Stop aiming' : 'Aim the weapon: choose a system on their ship'}
                onPress={() => setAiming((now) => !now)}
                style={[
                  styles.gun,
                  { left: gunX - GUN_TAP / 2, top: gunY - GUN_TAP / 2 },
                  aiming && styles.gunAiming,
                ]}
              />
            ) : null}
          </Animated.View>
        </View>
      </FadeInView>

      {laidOut === 'empty' ? null : (
        <FadeInView enabled={animate} duration={520} delay={160}>
          <View style={styles.foeColumn}>
            {/* Who is out here and their hull, over their own ship. Gone with
                it once it is destroyed, but its room is kept. */}
            <Animated.View style={[styles.foeStatus, present === 'empty' && styles.gone, foeDrift]}>
              {run ? (
                <FoeStatus
                  name={foeName(run) ?? waiting.label}
                  hull={foeHull(run)}
                  max={foeHullMax(run)}
                  width={FOE_STATUS_WIDTH}
                  readout={{
                    systems: foeSystems(run),
                    capacity: foeCapacity(run),
                    shield: run.foeShieldCharge,
                    weapon: Math.max(0, run.foeCharge) / WEAPON_UNITS,
                  }}
                />
              ) : (
                <View style={{ height: FOE_STATUS_HEIGHT }} />
              )}
            </Animated.View>
            <View ref={foeRef} collapsable={false} style={present === 'empty' ? styles.gone : null}>
              <Animated.View style={foeDrift}>
                <Sideways width={waiting.width * artScale} height={waiting.height * artScale}>
                  <EncounterShip
                    encounter={encounter}
                    angry={!!run && foeLooksHostile(run)}
                    engines={run ? wrenBars(run, 'foe') : 0}
                    width={waiting.width * artScale}
                    height={waiting.height * artScale}
                  />
                </Sideways>
                {/* Their shield, by the player's rules: a ring round the ship
                    that brightens with each layer standing. */}
                {foeShield > 0 ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.foeShield,
                      {
                        width: foeBoxW * 1.18,
                        height: foeBoxH * 1.18,
                        left: -foeBoxW * 0.09,
                        top: -foeBoxH * 0.09,
                        borderRadius: foeBoxW,
                        opacity: 0.35 + 0.15 * foeShield,
                      },
                    ]}
                  />
                ) : null}
                {run && present !== 'empty' ? (
                  <SystemMarks
                    width={foeBoxW}
                    height={foeBoxH}
                    unit={foeUnit}
                    spots={systemSpots(encounter)}
                    systems={foeSystems(run)}
                    capacity={foeCapacity(run)}
                    owner="their"
                    // A destroyed ship aims at nothing: its marker goes too.
                    target={wrecked ? null : run.target}
                    choosing={aiming}
                    onChoose={choose}
                  />
                ) : null}
              </Animated.View>
            </View>
          </View>
        </FadeInView>
      )}
    </View>
  );
}

/** The tap target over the player's weapon: a thumb's width, whatever the ship's size. */
const GUN_TAP = 40;

const styles = StyleSheet.create({
  gun: { position: 'absolute', width: GUN_TAP, height: GUN_TAP, borderRadius: GUN_TAP / 2 },
  /** While aiming, the weapon is ringed so it is clear what the tap did. */
  gunAiming: { borderWidth: 1.5, borderColor: '#FFFFFF', borderStyle: 'dashed' },
  foeShield: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: palette.shields,
    backgroundColor: 'rgba(90,200,255,0.06)',
  },
  hint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: tracking.caption,
    color: palette.textPrimary,
  },
  /** Takes the slack between the top and the controls; the ships sit mid-way. */
  arena: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: ARENA_MARGIN,
    gap: ARENA_GAP,
  },
  /**
   * The other ship's name floats above it rather than stacking on it, so the
   * two ships' centres stay level and a bolt flies straight between them.
   */
  foeColumn: { alignItems: 'center' },
  foeStatus: { position: 'absolute', bottom: '100%', marginBottom: 10 },
  /** A destroyed ship: still holding its place, no longer drawn. */
  gone: { opacity: 0 },
});
