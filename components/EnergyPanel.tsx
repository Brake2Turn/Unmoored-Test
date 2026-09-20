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
import Svg, { Circle, Line, Path } from 'react-native-svg';

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

type Props = {
  energy: EnergyState;
  /** Bars this ship's reactor makes. Always fewer than the rows can hold. */
  reactor: number;
  width: number;
  /**
   * The shield's live strength. Separate from `energy.shields`, which only
   * sets the ceiling — this is how much of it is actually standing.
   */
  shieldCharge: number;
  onShift: (subsystem: Subsystem, delta: number) => void;
  /** False fills and empties the cells instantly, with no surge. */
  animate?: boolean;
};

/**
 * Fixed so the helm can lay itself out around it.
 *
 * The helm has two pieces of ship art competing for whatever vertical space
 * the controls leave, and it can only size them if it knows this number up
 * front. So the panel is given an explicit height and its rows divide it,
 * rather than the height being whatever the content happens to add up to.
 */
export const ENERGY_PANEL_HEIGHT = 150;

const ROW_HEIGHT = 26;
const PIP_HEIGHT = 9;

/**
 * Column widths, shared so the shield's level strip lines up exactly under
 * the cells of the row it belongs to rather than by eye.
 */
const GLYPH_W = 13;
const STEP_W = 24;
const ROW_GAP = 8;
const STRENGTH_ROW_HEIGHT = 15;

/** An unlit cell. Every powered one animates up from this and back down to it. */
const EMPTY_CELL = 'rgba(255,255,255,0.13)';

/** How long a cell takes to come up to full, and the kick as the current lands. */
const CHARGE_MS = 240;
const SURGE_UP_MS = 110;
const SURGE_DOWN_MS = 300;

/**
 * When a cell stops waiting for its animation and simply shows the truth.
 *
 * The panel reports an allocation the player just changed, so it must never be
 * hostage to a frame that may not arrive — the same reason `FadeInView` exists.
 * Reanimated drives these off `requestAnimationFrame` on web, and a starved
 * tab would otherwise leave a cell stranded showing the old level. Once the
 * animation should have finished, the value is set outright; if it did finish,
 * setting the same value again is invisible.
 */
const SETTLE_MS = SURGE_UP_MS + SURGE_DOWN_MS + 120;

/**
 * The reactor panel: a pool of energy and three subsystems to spread it over.
 *
 * Every bar is somewhere it is not somewhere else — the reactor cannot fill
 * all three rows, so this is a set of trade-offs rather than a set of sliders.
 * It draws only what is true today: the allocation is stored on the run and
 * survives a reload, and nothing in the game reads it yet.
 *
 * It lives on the helm, where the ship is in front of you. The sector map is
 * for choosing where to go and deliberately carries none of this.
 */
export function EnergyPanel({
  energy,
  reactor,
  width,
  shieldCharge,
  onShift,
  animate = true,
}: Props) {
  const free = freeEnergy(energy, reactor);

  return (
    <View style={[styles.panel, { width, height: ENERGY_PANEL_HEIGHT }]}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.reactorLabel}>
          REACTOR
        </Text>

        {/* Total output, lit for the bars nothing has claimed yet. */}
        <View style={styles.reactorPips}>
          {Array.from({ length: reactor }, (_, i) => (
            <EnergyCell
              key={i}
              lit={i < free}
              accent={palette.accent}
              animate={animate}
              style={styles.reactorPip}
            />
          ))}
        </View>

        <Text
          numberOfLines={1}
          style={[styles.freeCount, { color: free > 0 ? palette.accent : palette.textDisabled }]}
        >
          {free} FREE
        </Text>
      </View>

      <View style={styles.rows}>
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
            {/* What is actually standing, under the power that caps it. */}
            {subsystem === 'shields' ? (
              <ShieldStrength charge={shieldCharge} cap={energy.shields} />
            ) : null}
          </React.Fragment>
        ))}
      </View>
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

  return (
    <View style={styles.row}>
      <SubsystemGlyph subsystem={subsystem} color={level > 0 ? style.accent : palette.textDisabled} />
      <Text numberOfLines={1} style={styles.rowLabel}>
        {style.label}
      </Text>

      {/* Take on the left, add on the right, with the bar between them: the
          two controls were side by side, which invited the wrong one. */}
      <StepButton
        symbol="−"
        enabled={canTakeAway}
        accent={style.accent}
        label={`Take one bar of energy out of ${style.label.toLowerCase()}, now ${level} of ${SUBSYSTEM_CAPACITY}`}
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
        label={`Put one bar of energy into ${style.label.toLowerCase()}, now ${level} of ${SUBSYSTEM_CAPACITY}`}
        onPress={() => onShift(subsystem, 1)}
      />
    </View>
  );
}

/**
 * The shield's live strength: four squares under the shields row.
 *
 * Filled squares are levels standing. The next one fills across as it charges,
 * so the wait is visible rather than a number that jumps every five seconds.
 * Squares past what the reactor is paying for are drawn as bare outlines —
 * that is the ceiling, and no amount of waiting will light them.
 */
function ShieldStrength({ charge, cap }: { charge: number; cap: number }) {
  const level = shieldLevel(charge);
  const progress = shieldProgress(charge);
  const tint = SUBSYSTEM_STYLE.shields.accent;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Shield strength ${level} of ${cap} levels`}
      style={styles.strengthRow}
    >
      <View style={{ width: GLYPH_W }} />
      <Text numberOfLines={1} style={styles.strengthLabel}>
        LEVEL
      </Text>
      <View style={{ width: STEP_W }} />

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

/**
 * One cell of energy, which powers up and down rather than just changing
 * colour.
 *
 * Two things happen at once: the cell fades between unlit and its subsystem's
 * colour, and it kicks — a quick stretch and a white flash as the current
 * arrives or leaves, settling back afterwards. That makes a bar moving between
 * two rows read as something travelling rather than two independent redraws.
 *
 * The very first render is deliberately silent: mounting the helm should not
 * set the whole panel flashing.
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

/**
 * One − or + control.
 *
 * Drawn small to fit three rows above the jump button, but `hitSlop` gives it
 * a thumb-sized target — the tappable area is half again as wide as the box
 * you can see.
 */
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

/** Small drawn marks, so the rows read at a glance rather than by label. */
function SubsystemGlyph({ subsystem, color }: { subsystem: Subsystem; color: string }) {
  if (subsystem === 'shields') {
    return (
      <Svg width={13} height={14} viewBox="0 0 16 17">
        <Path
          d="M8 1 L14.5 3.6 V8.6 C14.5 12.4 11.7 15.2 8 16 C4.3 15.2 1.5 12.4 1.5 8.6 V3.6 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (subsystem === 'weapons') {
    return (
      <Svg width={13} height={14} viewBox="0 0 16 17">
        <Circle cx={8} cy={8.5} r={4.6} fill="none" stroke={color} strokeWidth={1.6} />
        <Line x1={8} y1={0.6} x2={8} y2={3.2} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={8} y1={13.8} x2={8} y2={16.4} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={0.6} y1={8.5} x2={3.2} y2={8.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={12.8} y1={8.5} x2={15.4} y2={8.5} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  // Engines: a dart, nose up, the same silhouette the ships are built from.
  return (
    <Svg width={13} height={14} viewBox="0 0 16 17">
      <Path
        d="M8 0.8 L14.2 15.6 L8 12.4 L1.8 15.6 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    borderCurve: 'continuous',
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.028)',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },

  header: { flexDirection: 'row', alignItems: 'center', height: 15, gap: 9 },
  reactorLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  reactorPips: { flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 },
  reactorPip: {
    flex: 1,
    maxWidth: 12,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: EMPTY_CELL,
    overflow: 'hidden',
  },
  freeCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: tracking.caption,
    fontVariant: ['tabular-nums'],
  },

  rows: { flex: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, gap: ROW_GAP },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STRENGTH_ROW_HEIGHT,
    gap: ROW_GAP,
  },
  strengthLabel: {
    fontFamily: fonts.body,
    fontSize: 7.5,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
    width: 70,
    textAlign: 'right',
  },
  squares: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  square: {
    flex: 1,
    height: 8,
    borderRadius: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  /** Past the ceiling the reactor is paying for: an outline and nothing more. */
  squareCapped: { borderColor: 'rgba(255,255,255,0.07)' },
  squareCharge: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.5 },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    // ENGINES is eight tracked capitals: at 58 it wrapped to "PILOTIN G".
    width: 70,
  },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  pip: {
    flex: 1,
    height: PIP_HEIGHT,
    borderRadius: 2,
    backgroundColor: EMPTY_CELL,
    overflow: 'hidden',
  },
  flash: { backgroundColor: '#FFFFFF' },

  step: {
    width: 24,
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
