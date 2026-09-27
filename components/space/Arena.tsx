import React, { type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { FadeInView } from '@/components/FadeInView';
import { FOE_STATUS_HEIGHT, FoeStatus } from '@/components/FoeStatus';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { Sideways } from '@/components/ships/Sideways';
import { SYSTEMS_SPAN, ShipSystems } from '@/components/ships/ShipSystems';
import {
  ARENA_GAP,
  ARENA_MARGIN,
  FOE_STATUS_WIDTH,
  SHIP_HEIGHT,
  SHIP_WIDTH,
} from '@/components/space/layout';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { shieldLevel } from '@/lib/energy';
import { isWrecked } from '@/lib/hull';
import { foeHull, foeHullMax, foeLooksHostile, foeName, shipHere, type RunState } from '@/lib/run';
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
 */
export function Arena({
  run,
  laidOut,
  artScale,
  animate,
  shipRef,
  foeRef,
}: {
  run: RunState | null;
  laidOut: Encounter;
  artScale: number;
  animate: boolean;
  shipRef: RefObject<View | null>;
  foeRef: RefObject<View | null>;
}) {
  const ship = shipById(run?.shipId);
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const present = run ? shipHere(run) : 'empty';
  const waiting = ENCOUNTER_STYLE[laidOut];
  const wrecked = !!run && isWrecked(run.hull);

  return (
    <View style={styles.arena}>
      {/* The reactor allocation, drawn on the ship: a bubble for shields, a
          longer exhaust for engines. */}
      <FadeInView enabled={animate} duration={700}>
        <View ref={shipRef} collapsable={false} style={wrecked ? styles.gone : null}>
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
        </View>
      </FadeInView>

      {laidOut === 'empty' ? null : (
        <FadeInView enabled={animate} duration={520} delay={160}>
          <View style={styles.foeColumn}>
            {/* Who is out here and their hull, over their own ship. Gone with
                it once it is destroyed, but its room is kept. */}
            <View style={[styles.foeStatus, present === 'empty' && styles.gone]}>
              {run ? (
                <FoeStatus
                  name={foeName(run) ?? waiting.label}
                  hull={foeHull(run)}
                  max={foeHullMax(run)}
                  width={FOE_STATUS_WIDTH}
                />
              ) : (
                <View style={{ height: FOE_STATUS_HEIGHT }} />
              )}
            </View>
            <View ref={foeRef} collapsable={false} style={present === 'empty' ? styles.gone : null}>
              <Sideways width={waiting.width * artScale} height={waiting.height * artScale}>
                <EncounterShip
                  encounter={encounter}
                  angry={!!run && foeLooksHostile(run)}
                  width={waiting.width * artScale}
                  height={waiting.height * artScale}
                />
              </Sideways>
            </View>
          </View>
        </FadeInView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
