import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

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
import { fonts, palette, tracking } from '@/lib/theme';

type Props = {
  energy: EnergyState;
  /** Bars this ship's reactor makes. Always fewer than the rows can hold. */
  reactor: number;
  width: number;
  onShift: (subsystem: Subsystem, delta: number) => void;
};

/**
 * Fixed so the helm can lay itself out around it.
 *
 * The helm has two pieces of ship art competing for whatever vertical space
 * the controls leave, and it can only size them if it knows this number up
 * front. So the panel is given an explicit height and its rows divide it,
 * rather than the height being whatever the content happens to add up to.
 */
export const ENERGY_PANEL_HEIGHT = 134;

const ROW_HEIGHT = 26;
const PIP_HEIGHT = 9;

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
export function EnergyPanel({ energy, reactor, width, onShift }: Props) {
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
            <View
              key={i}
              style={[
                styles.reactorPip,
                i < free ? { backgroundColor: palette.accent } : styles.reactorPipSpent,
              ]}
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
          <SubsystemRow
            key={subsystem}
            subsystem={subsystem}
            level={energy[subsystem]}
            canAddMore={canAdd(energy, reactor, subsystem)}
            canTakeAway={canRemove(energy, subsystem)}
            onShift={onShift}
          />
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
}: {
  subsystem: Subsystem;
  level: number;
  canAddMore: boolean;
  canTakeAway: boolean;
  onShift: (subsystem: Subsystem, delta: number) => void;
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
          <View
            key={i}
            style={[styles.pip, i < level ? { backgroundColor: style.accent } : null]}
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
  reactorPip: { flex: 1, maxWidth: 12, height: 6, borderRadius: 1.5 },
  reactorPipSpent: { backgroundColor: 'rgba(255,255,255,0.13)' },
  freeCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: tracking.caption,
    fontVariant: ['tabular-nums'],
  },

  rows: { flex: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, gap: 8 },
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
    backgroundColor: 'rgba(255,255,255,0.11)',
  },

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
