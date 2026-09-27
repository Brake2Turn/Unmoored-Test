import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SubsystemGlyph } from '@/components/SubsystemGlyph';
import { SUBSYSTEMS, SUBSYSTEM_CAPACITY, type EnergyState, type Subsystem } from '@/lib/energy';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';
import { palette } from '@/lib/theme';

/** Where each subsystem sits on a hull, in the upright 200×260 drawing. */
export type SystemSpots = Record<Subsystem, { x: number; y: number }>;

/** A mark's size on screen, and its size while the player is choosing a target. */
const MARK = 16;
const MARK_CHOOSING = 22;
/** How far the target brackets stand out from the mark they frame. */
const RETICLE_PAD = 5;

/**
 * The three subsystems where they physically are on a ship: each one's mark
 * — the same mark as its row in the reactor panel — on a small dark disc,
 * laid over the ship at its place in the hull.
 *
 * The drawing is upright and `Sideways` turns it, so each spot is turned the
 * same way on paper here, (dx, dy) → (−dy, dx), while the marks themselves
 * stay the right way up to be read.
 *
 * A mark says the state of its system at a glance: its colour while powered,
 * grey when it holds no bars, a red rim once hits have destroyed some of it,
 * and red and struck through once they have destroyed all of it. The one the
 * player's weapon is aimed at is framed in red brackets; while the player is
 * choosing (`choosing`), every mark grows and can be tapped.
 */
export function SystemMarks({
  width,
  height,
  unit,
  spots,
  systems,
  capacity,
  owner,
  target = null,
  choosing = false,
  onChoose,
}: {
  /** The outer, turned box the ship sits in. */
  width: number;
  height: number;
  /** Points on screen per unit of the upright drawing. */
  unit: number;
  spots: SystemSpots;
  /** Bars powering each system. */
  systems: EnergyState;
  /** Bars each can still hold. */
  capacity: EnergyState;
  /** Whose ship, for what the marks are read out as. */
  owner: 'your' | 'their';
  target?: Subsystem | null;
  choosing?: boolean;
  onChoose?: (subsystem: Subsystem) => void;
}) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {SUBSYSTEMS.map((subsystem) => {
        const spot = spots[subsystem];
        const dx = (spot.x - 100) * unit;
        const dy = (spot.y - 130) * unit;
        const cx = width / 2 - dy;
        const cy = height / 2 + dx;
        const size = choosing ? MARK_CHOOSING : MARK;
        const style = SUBSYSTEM_STYLE[subsystem];
        const left = capacity[subsystem];
        const destroyed = left <= 0;
        const damaged = left < SUBSYSTEM_CAPACITY;
        const powered = systems[subsystem] > 0;
        const tint = destroyed ? palette.danger : powered ? style.accent : palette.textDisabled;
        const aimed = target === subsystem;
        const readout =
          `${owner === 'your' ? 'Your' : 'Their'} ${style.label.toLowerCase()}: ` +
          `${systems[subsystem]} bars in it, ${left} of ${SUBSYSTEM_CAPACITY} left` +
          (aimed ? ', targeted' : '');

        const mark = (
          <View
            style={[
              styles.mark,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: choosing ? '#FFFFFF' : damaged ? palette.danger : tint,
                borderWidth: choosing ? 1.5 : 1,
              },
            ]}
          >
            <SubsystemGlyph subsystem={subsystem} color={tint} size={size * 0.56} />
            {destroyed ? <View style={[styles.strike, { width: size * 0.9 }]} /> : null}
          </View>
        );

        return (
          <View
            key={subsystem}
            pointerEvents="box-none"
            style={[styles.spot, { left: cx - size / 2, top: cy - size / 2, width: size, height: size }]}
          >
            {aimed ? <Reticle size={size + RETICLE_PAD * 2} /> : null}
            {choosing && onChoose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Target ${readout}`}
                hitSlop={8}
                onPress={() => onChoose(subsystem)}
              >
                {mark}
              </Pressable>
            ) : (
              <View accessibilityLabel={readout} pointerEvents="none">
                {mark}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Four red corner brackets round the targeted system. */
function Reticle({ size }: { size: number }) {
  const arm = Math.max(5, size * 0.3);
  const corner = { position: 'absolute' as const, width: arm, height: arm, borderColor: palette.danger };
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, left: -RETICLE_PAD, top: -RETICLE_PAD }}
    >
      <View style={[corner, { left: 0, top: 0, borderLeftWidth: 2, borderTopWidth: 2 }]} />
      <View style={[corner, { right: 0, top: 0, borderRightWidth: 2, borderTopWidth: 2 }]} />
      <View style={[corner, { left: 0, bottom: 0, borderLeftWidth: 2, borderBottomWidth: 2 }]} />
      <View style={[corner, { right: 0, bottom: 0, borderRightWidth: 2, borderBottomWidth: 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  spot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,7,15,0.82)',
  },
  strike: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: palette.danger,
    transform: [{ rotate: '-45deg' }],
  },
});
