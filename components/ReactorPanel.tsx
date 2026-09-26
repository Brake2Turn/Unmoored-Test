import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ReactorGlyph, SubstationGlyph, SubsystemGlyph } from '@/components/SubsystemGlyph';
import { CARD } from '@/components/PanelChrome';
import {
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  canAdd,
  canRemove,
  freeEnergy,
  type EnergyState,
  type Subsystem,
} from '@/lib/energy';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';
import { fonts, palette } from '@/lib/theme';

/**
 * The reactor, always open.
 *
 * One row per subsystem: its mark and name, the bars in it with the charge it
 * is building underneath, a count, and − and + right there. Energy is moved
 * without opening anything — the panel used to be a tab that opened a set of
 * controls over the helm, and every change cost a tap in and a tap out.
 *
 * Laid out after a mock-up the author supplied ("minimal list view"): short
 * rows, big buttons. The rows are kept squat so the whole panel costs little
 * more height than the tab did, and the buttons are the biggest thing in each
 * row because they are the part that gets pressed.
 */

/** Each row's height, and the − / + buttons in it. */
const ROW_HEIGHT = 40;
const STEP_W = 44;
const STEP_H = 34;

/** The whole panel's height, so the helm can lay itself out around it. */
export const REACTOR_PANEL_HEIGHT = 7 + 20 + 3 * (ROW_HEIGHT + 6) + 3 + 2;

/** The bars in a subsystem, and the charge track under them. */
const PIP_HEIGHT = 6;
const TRACK_HEIGHT = 3;

const EMPTY_CELL = 'rgba(255,255,255,0.13)';

const CHARGE_MS = 240;
const SURGE_UP_MS = 110;
const SURGE_DOWN_MS = 300;
const SETTLE_MS = SURGE_UP_MS + SURGE_DOWN_MS + 120;

type Charges = {
  /** The shield's live strength, a float — see `shieldLevel`. */
  shield: number;
  /** How far the weapons and the drive have built since arriving, 0 to 1. */
  weapon: number;
  engine: number;
};

/**
 * How full a subsystem's own business is, 0 to 1.
 *
 * The shield is measured against the ceiling it is powered for rather than
 * against four, so a shield at its cap reads full — the bars beside it already
 * say how high that cap is.
 */
function chargeOf(subsystem: Subsystem, energy: EnergyState, charges: Charges): number {
  if (subsystem === 'shields') {
    return energy.shields > 0 ? Math.min(1, charges.shield / energy.shields) : 0;
  }
  return Math.max(0, Math.min(1, subsystem === 'weapons' ? charges.weapon : charges.engine));
}

/** Everything a row needs to spell out what it would do, in its label. */
const NAME: Record<Subsystem, string> = {
  shields: 'shields',
  weapons: 'weapons',
  engines: 'engines',
};

export function ReactorPanel({
  energy,
  reactor,
  charges,
  width,
  onShift,
  animate = true,
}: {
  energy: EnergyState;
  reactor: number;
  charges: Charges;
  width: number;
  onShift: (subsystem: Subsystem, delta: number) => void;
  animate?: boolean;
}) {
  const free = freeEnergy(energy, reactor);

  return (
    <View
      accessibilityLabel={
        `Reactor: shields ${energy.shields}, weapons ${energy.weapons}, ` +
        `engines ${energy.engines}, ${free} free`
      }
      style={[styles.panel, { width, height: REACTOR_PANEL_HEIGHT }]}
    >
      {/* The section's name, and the power nothing has claimed yet — yellow,
          the one reading that is not a subsystem. */}
      <View style={styles.header}>
        <SubstationGlyph color={palette.textMuted} size={12} />
        <Text style={styles.title}>REACTOR</Text>
        <View style={styles.headerRule} />
        <ReactorGlyph color={free > 0 ? palette.power : palette.textDisabled} size={12} />
        <Text style={[styles.free, { color: free > 0 ? palette.power : palette.textDisabled }]}>
          {free}
        </Text>
      </View>

      {SUBSYSTEMS.map((subsystem, index) => (
        <SubsystemRow
          key={subsystem}
          subsystem={subsystem}
          level={energy[subsystem]}
          charge={chargeOf(subsystem, energy, charges)}
          canAddMore={canAdd(energy, reactor, subsystem)}
          canTakeAway={canRemove(energy, subsystem)}
          onShift={onShift}
          animate={animate}
          last={index === SUBSYSTEMS.length - 1}
        />
      ))}
    </View>
  );
}

function SubsystemRow({
  subsystem,
  level,
  charge,
  canAddMore,
  canTakeAway,
  onShift,
  animate,
  last,
}: {
  subsystem: Subsystem;
  level: number;
  charge: number;
  canAddMore: boolean;
  canTakeAway: boolean;
  onShift: (subsystem: Subsystem, delta: number) => void;
  animate: boolean;
  last: boolean;
}) {
  const style = SUBSYSTEM_STYLE[subsystem];
  const lit = level > 0;
  const name = NAME[subsystem];

  return (
    <View style={[styles.row, !last && styles.rowRule]}>
      <SubsystemGlyph
        subsystem={subsystem}
        color={lit ? style.accent : palette.textDisabled}
        size={17}
      />

      <View style={styles.middle}>
        <Text style={[styles.label, { color: lit ? style.accent : palette.textDisabled }]}>
          {style.label}
        </Text>

        {/* What is in it: one cell per bar. */}
        <View style={styles.pips}>
          {Array.from({ length: SUBSYSTEM_CAPACITY }, (_, i) => (
            <EnergyCell key={i} lit={i < level} accent={style.accent} animate={animate} style={styles.pip} />
          ))}
        </View>

        {/* How far what it is building has got. */}
        <View style={[styles.track, !lit && styles.trackStalled]}>
          <View
            style={[
              styles.trackFill,
              { width: `${charge * 100}%`, backgroundColor: style.accent, opacity: charge >= 1 ? 1 : 0.6 },
            ]}
          />
        </View>
      </View>

      <Text style={[styles.count, { color: lit ? palette.textPrimary : palette.textDisabled }]}>
        {level}/{SUBSYSTEM_CAPACITY}
      </Text>

      <StepButton
        symbol="−"
        enabled={canTakeAway}
        accent={style.accent}
        label={`Take one bar of energy out of ${name}, now ${level} of ${SUBSYSTEM_CAPACITY}`}
        onPress={() => onShift(subsystem, -1)}
      />
      <StepButton
        symbol="+"
        enabled={canAddMore}
        accent={style.accent}
        label={`Put one bar of energy into ${name}, now ${level} of ${SUBSYSTEM_CAPACITY}`}
        onPress={() => onShift(subsystem, 1)}
      />
    </View>
  );
}

/**
 * One bar of a subsystem. It fades between unlit and its colour with a kick
 * and a white flash as the current lands, so a bar moving between rows reads
 * as something travelling.
 *
 * **It also settles by timer.** Reanimated drives it off
 * `requestAnimationFrame` on web, and a starved tab must never strand a cell
 * showing the old level — a screenshot once showed 2/2/2 while the save held
 * 0/2/4. Content is never hostage to an animation.
 */
function EnergyCell({
  lit,
  accent,
  animate,
  style,
}: {
  lit: boolean;
  accent: string;
  animate: boolean;
  style: ViewStyle;
}) {
  const charge = useSharedValue(lit ? 1 : 0);
  const surge = useSharedValue(0);
  const settled = useRef(false);

  useEffect(() => {
    if (!settled.current || !animate) {
      settled.current = true;
      charge.value = lit ? 1 : 0;
      surge.value = 0;
      return;
    }

    charge.value = withTiming(lit ? 1 : 0, {
      duration: CHARGE_MS,
      easing: Easing.out(Easing.quad),
    });
    surge.value = withSequence(
      withTiming(1, { duration: SURGE_UP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: SURGE_DOWN_MS, easing: Easing.out(Easing.quad) }),
    );

    const settle = setTimeout(() => {
      charge.value = lit ? 1 : 0;
      surge.value = 0;
    }, SETTLE_MS);
    return () => clearTimeout(settle);
  }, [animate, charge, lit, surge]);

  const cellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(charge.value, [0, 1], [EMPTY_CELL, accent]),
    transform: [{ scaleY: 1 + surge.value * 0.7 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: surge.value * 0.55 }));

  return (
    <Animated.View style={[style, cellStyle]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </Animated.View>
  );
}

/** One − or + control: the biggest thing in the row, since it is the thing pressed. */
function StepButton({
  symbol,
  enabled,
  accent,
  label,
  onPress,
}: {
  symbol: string;
  enabled: boolean;
  accent: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      hitSlop={3}
      style={({ pressed }) => [
        styles.step,
        { borderColor: enabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)' },
        pressed && enabled ? { backgroundColor: 'rgba(255,255,255,0.12)' } : null,
      ]}
    >
      <Text style={[styles.stepSymbol, { color: enabled ? accent : palette.textDisabled }]}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...CARD,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 3,
  },

  header: { flexDirection: 'row', alignItems: 'center', height: 20, gap: 7 },
  title: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    color: palette.textMuted,
    letterSpacing: 1.6,
  },
  headerRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  free: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT + 6, gap: 8 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },

  middle: { flex: 1, gap: 4, justifyContent: 'center' },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { flex: 1, height: PIP_HEIGHT, borderRadius: 1.5, overflow: 'hidden' },
  flash: { backgroundColor: '#FFFFFF' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: EMPTY_CELL,
    overflow: 'hidden',
  },
  trackStalled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_HEIGHT / 2 },

  count: {
    width: 26,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  step: {
    width: STEP_W,
    height: STEP_H,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  stepSymbol: { fontFamily: fonts.bodyBold, fontSize: 20, fontWeight: '600', lineHeight: 22 },
});
