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

import { ReactorGlyph, SubsystemGlyph } from '@/components/SubsystemGlyph';
import {
  SUBSYSTEMS,
  SUBSYSTEM_CAPACITY,
  canAdd,
  canRemove,
  freeEnergy,
  shieldLevel,
  shieldProgress,
  type EnergyState,
  type Subsystem,
} from '@/lib/energy';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * The reactor, in two states.
 *
 * Collapsed it is a thumb-sized tab: one row per subsystem showing its icon
 * and what is in it, then the power nothing has claimed. That is everything
 * needed to *read* the reactor at a glance, and it is all that is on screen
 * while the player is flying.
 *
 * Tapping it opens the controls over the top. They only take the room while
 * the player is actually moving energy about, which is the whole idea — the
 * panel used to hold a third of the helm permanently for controls that are
 * untouched most of the time.
 *
 * Neither state carries a word. The icons are shared between them
 * (`SubsystemGlyph`) so what is learned from the controls reads the tab.
 */

/** Both are fixed, so the helm can lay itself out around them. */
export const REACTOR_TAB_WIDTH = 66;
export const REACTOR_TAB_HEIGHT = 76;
export const REACTOR_CONTROLS_WIDTH = 252;

const TAB_ROW_HEIGHT = 13;
const TAB_PIP = 5;

/** Columns in the expanded controls, so the bars line up under the cells. */
const GLYPH_W = 13;
const STEP_W = 24;
const ROW_GAP = 8;
const ROW_HEIGHT = 26;
const SUB_ROW_HEIGHT = 13;
const PIP_HEIGHT = 9;

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

/* ------------------------------------------------------------------ tab -- */

export function ReactorTab({
  energy,
  reactor,
  onPress,
}: {
  energy: EnergyState;
  reactor: number;
  onPress: () => void;
}) {
  const free = freeEnergy(energy, reactor);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `Reactor: shields ${energy.shields}, weapons ${energy.weapons}, ` +
        `engines ${energy.engines}, ${free} free. Open the reactor controls`
      }
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      {SUBSYSTEMS.map((subsystem) => (
        <View key={subsystem} style={styles.tabRow}>
          <SubsystemGlyph
            subsystem={subsystem}
            color={energy[subsystem] > 0 ? SUBSYSTEM_STYLE[subsystem].accent : palette.textDisabled}
            size={11}
          />
          <View style={styles.tabPips}>
            {Array.from({ length: SUBSYSTEM_CAPACITY }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.tabPip,
                  i < energy[subsystem]
                    ? { backgroundColor: SUBSYSTEM_STYLE[subsystem].accent }
                    : null,
                ]}
              />
            ))}
          </View>
        </View>
      ))}

      {/* What the reactor is making that nothing has claimed. */}
      <View style={styles.tabRow}>
        <ReactorGlyph color={free > 0 ? palette.accent : palette.textDisabled} size={11} />
        <Text
          style={[styles.tabFree, { color: free > 0 ? palette.accent : palette.textDisabled }]}
        >
          {free}
        </Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------- controls -- */

export function ReactorControls({
  energy,
  reactor,
  charges,
  onShift,
  animate = true,
}: {
  energy: EnergyState;
  reactor: number;
  charges: Charges;
  onShift: (subsystem: Subsystem, delta: number) => void;
  animate?: boolean;
}) {
  const free = freeEnergy(energy, reactor);

  return (
    <View style={styles.controls}>
      <View style={styles.controlsHeader}>
        <ReactorGlyph color={free > 0 ? palette.accent : palette.textDisabled} size={13} />
        <Text
          style={[styles.headerFree, { color: free > 0 ? palette.accent : palette.textDisabled }]}
        >
          {free}
        </Text>
        <View style={styles.headerRule} />
      </View>

      {SUBSYSTEMS.map((subsystem) => (
        <React.Fragment key={subsystem}>
          <SubsystemRow
            subsystem={subsystem}
            level={energy[subsystem]}
            canAddMore={canAdd(energy, reactor, subsystem)}
            canTakeAway={canRemove(energy, subsystem)}
            onShift={onShift}
            animate={animate}
          />

          {/* What the row has actually got, under the power driving it. */}
          {subsystem === 'shields' ? (
            <ShieldStrength charge={charges.shield} cap={energy.shields} />
          ) : (
            <ChargeSlider
              fraction={subsystem === 'weapons' ? charges.weapon : charges.engine}
              accent={SUBSYSTEM_STYLE[subsystem].accent}
              stalled={energy[subsystem] <= 0}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function SubsystemRow({
  subsystem,
  level,
  canAddMore,
  canTakeAway,
  onShift,
  animate,
}: {
  subsystem: Subsystem;
  level: number;
  canAddMore: boolean;
  canTakeAway: boolean;
  onShift: (subsystem: Subsystem, delta: number) => void;
  animate: boolean;
}) {
  const style = SUBSYSTEM_STYLE[subsystem];
  const name = style.label.toLowerCase();

  return (
    <View style={styles.row}>
      <SubsystemGlyph
        subsystem={subsystem}
        color={level > 0 ? style.accent : palette.textDisabled}
      />

      {/* Take on the left, add on the right, with the cells between them. */}
      <StepButton
        symbol="−"
        enabled={canTakeAway}
        accent={style.accent}
        label={`Take one bar of energy out of ${name}, now ${level} of ${SUBSYSTEM_CAPACITY}`}
        onPress={() => onShift(subsystem, -1)}
      />

      <View style={styles.pips}>
        {Array.from({ length: SUBSYSTEM_CAPACITY }, (_, i) => (
          <EnergyCell
            key={i}
            lit={i < level}
            accent={style.accent}
            animate={animate}
            style={styles.pip}
          />
        ))}
      </View>

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

/** The shield's live strength: four squares, one per level it holds. */
function ShieldStrength({ charge, cap }: { charge: number; cap: number }) {
  const level = shieldLevel(charge);
  const progress = shieldProgress(charge);
  const tint = SUBSYSTEM_STYLE.shields.accent;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Shield strength ${level} of ${cap} levels`}
      style={styles.subRow}
    >
      <View style={{ width: GLYPH_W + ROW_GAP + STEP_W }} />
      <View style={styles.squares}>
        {Array.from({ length: SUBSYSTEM_CAPACITY }, (_, i) => {
          const capped = i >= cap;
          const charging = i === level && !capped;
          return (
            <View key={i} style={[styles.square, capped && styles.squareCapped]}>
              {i < level ? (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
              ) : null}
              {charging ? (
                <View
                  style={[
                    styles.squareCharge,
                    { width: `${Math.round(progress * 100)}%`, backgroundColor: tint },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ width: STEP_W }} />
    </View>
  );
}

/** A charge building up: one continuous track, no number. */
function ChargeSlider({
  fraction,
  accent,
  stalled,
}: {
  fraction: number;
  accent: string;
  stalled: boolean;
}) {
  const filled = Math.max(0, Math.min(1, fraction));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Charge ${Math.round(filled * 100)} percent`}
      style={styles.subRow}
    >
      <View style={{ width: GLYPH_W + ROW_GAP + STEP_W }} />
      <View style={[styles.track, stalled && styles.trackStalled]}>
        <View
          style={[
            styles.trackFill,
            { width: `${filled * 100}%`, backgroundColor: accent, opacity: filled >= 1 ? 1 : 0.62 },
          ]}
        />
      </View>
      <View style={{ width: STEP_W }} />
    </View>
  );
}

/**
 * One cell of energy, which powers up and down rather than just changing
 * colour: it fades between unlit and its subsystem's tint, and kicks with a
 * white flash as the current lands.
 *
 * It settles by timer as well. Reanimated drives this off
 * `requestAnimationFrame` on web, and the cell reports an allocation the
 * player has just changed, so a starved tab must never strand one showing the
 * old level — the same reason `FadeInView` exists.
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
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
      />
    </Animated.View>
  );
}

/** One − or + control, small but with a thumb-sized `hitSlop`. */
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
      hitSlop={9}
      style={({ pressed }) => [
        styles.step,
        { borderColor: enabled ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)' },
        pressed && enabled ? { backgroundColor: 'rgba(255,255,255,0.10)' } : null,
      ]}
    >
      <Text style={[styles.stepSymbol, { color: enabled ? accent : palette.textDisabled }]}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const CARD: ViewStyle = {
  borderRadius: 12,
  borderWidth: 1,
  borderCurve: 'continuous',
  borderColor: 'rgba(255,255,255,0.09)',
  // Near-opaque on purpose. These sit over the ship rather than in a strip of
  // their own, and a translucent card let the hull and the starfield read
  // through the controls, which made both harder to parse.
  backgroundColor: 'rgba(11,15,30,0.97)',
};

const styles = StyleSheet.create({
  tab: {
    ...CARD,
    width: REACTOR_TAB_WIDTH,
    height: REACTOR_TAB_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'space-between',
  },
  tabPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  tabRow: { flexDirection: 'row', alignItems: 'center', height: TAB_ROW_HEIGHT, gap: 6 },
  tabPips: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  tabPip: {
    flex: 1,
    maxWidth: TAB_PIP,
    height: TAB_PIP,
    borderRadius: 1,
    backgroundColor: EMPTY_CELL,
  },
  tabFree: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  controls: {
    ...CARD,
    borderColor: 'rgba(255,255,255,0.14)',
    width: REACTOR_CONTROLS_WIDTH,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  controlsHeader: { flexDirection: 'row', alignItems: 'center', height: 15, gap: 7 },
  headerFree: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headerRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, gap: ROW_GAP },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  pip: {
    flex: 1,
    height: PIP_HEIGHT,
    borderRadius: 2,
    backgroundColor: EMPTY_CELL,
    overflow: 'hidden',
  },
  flash: { backgroundColor: '#FFFFFF' },

  subRow: { flexDirection: 'row', alignItems: 'center', height: SUB_ROW_HEIGHT, gap: ROW_GAP },
  squares: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  square: {
    flex: 1,
    height: 8,
    borderRadius: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  squareCapped: { borderColor: 'rgba(255,255,255,0.07)' },
  squareCharge: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.5 },

  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: EMPTY_CELL,
    overflow: 'hidden',
  },
  trackStalled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },

  step: {
    width: STEP_W,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSymbol: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
    textAlign: 'center',
  },
});
