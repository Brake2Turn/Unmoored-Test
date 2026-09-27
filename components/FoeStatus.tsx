import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SubsystemGlyph } from '@/components/SubsystemGlyph';
import { SUBSYSTEMS, SUBSYSTEM_CAPACITY, type EnergyState, type Subsystem } from '@/lib/energy';
import { SUBSYSTEM_STYLE } from '@/lib/subsystems';
import { fonts, hullColor, palette, tracking } from '@/lib/theme';

/** One thin row per subsystem under the hull line. */
const ROW_HEIGHT = 8;
const ROW_GAP = 3;
const READOUT_HEIGHT = SUBSYSTEMS.length * ROW_HEIGHT + (SUBSYSTEMS.length - 1) * ROW_GAP;

/** Fixed, so the space screen can keep the other ship clear of it. */
export const FOE_STATUS_HEIGHT = 26 + 6 + READOUT_HEIGHT;

/** The other ship's three systems, as `FoeStatus` shows them. */
export type FoeSystemsReadout = {
  /** Bars in each. */
  systems: EnergyState;
  /** Bars each can still hold. */
  capacity: EnergyState;
  /** How far its shield has charged, in layers, and its gun, 0 to 1. */
  shield: number;
  weapon: number;
};

/**
 * Who the player is facing, floating above their ship: their name, and their
 * hull as a line underneath it — the same line the player's own hull is drawn
 * as, turning the same colours (`hullColor`), so the two read as the same
 * kind of thing.
 */
export function FoeStatus({
  name,
  hull,
  max,
  width,
  readout,
}: {
  name: string;
  hull: number;
  max: number;
  width: number;
  readout?: FoeSystemsReadout;
}) {
  const left = Math.max(0, Math.min(max, hull));
  const fraction = max > 0 ? left / max : 0;

  return (
    <View
      accessibilityLabel={`${name}: hull ${left} of ${max}`}
      style={[styles.box, { width }]}
    >
      {/* Wraps onto a second line rather than being cut short: ILLEGAL
          MERCHANT does not fit on one at this size. */}
      <Text numberOfLines={2} style={styles.name}>
        {name.toUpperCase()}
      </Text>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: hullColor(fraction) }]}
        />
      </View>
      {readout ? (
        <View style={styles.readout}>
          {SUBSYSTEMS.map((subsystem) => (
            <SystemRow key={subsystem} subsystem={subsystem} readout={readout} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One of their systems, thinned right down: its mark, a cell per bar — lit
 * while powered, hollow while it could hold one, red once destroyed — and a
 * hairline under the cells for what it is building. The Wren Drive builds
 * nothing for them (they do not jump), so its hairline is left off.
 */
function SystemRow({ subsystem, readout }: { subsystem: Subsystem; readout: FoeSystemsReadout }) {
  const style = SUBSYSTEM_STYLE[subsystem];
  const bars = readout.systems[subsystem];
  const left = readout.capacity[subsystem];
  const tint = left <= 0 ? palette.danger : bars > 0 ? style.accent : palette.textDisabled;
  const built =
    subsystem === 'shields'
      ? bars > 0
        ? Math.min(1, readout.shield / bars)
        : 0
      : subsystem === 'weapons'
        ? readout.weapon
        : null;

  return (
    <View
      accessibilityLabel={`Their ${style.label.toLowerCase()}: ${bars} bars, ${left} of ${SUBSYSTEM_CAPACITY} left`}
      style={styles.row}
    >
      <SubsystemGlyph subsystem={subsystem} color={tint} size={8} />
      <View style={styles.meter}>
        <View style={styles.cells}>
          {Array.from({ length: SUBSYSTEM_CAPACITY }, (_, i) => (
            <View
              key={i}
              style={[
                styles.cell,
                i >= left
                  ? styles.cellBroken
                  : i < bars
                    ? { backgroundColor: style.accent }
                    : styles.cellEmpty,
              ]}
            />
          ))}
        </View>
        {built !== null ? (
          <View style={styles.hair}>
            <View
              style={[
                styles.hairFill,
                { width: `${Math.max(0, Math.min(1, built)) * 100}%`, backgroundColor: style.accent },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { gap: ROW_GAP, alignItems: 'center', marginTop: 0 },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 5 },
  meter: { width: 52, gap: 1.5 },
  cells: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, height: 3, borderRadius: 1 },
  cellEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  cellBroken: { backgroundColor: 'rgba(255,93,107,0.25)', borderWidth: 0.5, borderColor: palette.danger },
  hair: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  hairFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  box: { minHeight: FOE_STATUS_HEIGHT, justifyContent: 'flex-end', gap: 6 },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: tracking.caption,
    textAlign: 'center',
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
});
