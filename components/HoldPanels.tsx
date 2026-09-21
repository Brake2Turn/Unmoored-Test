import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CargoGlyph, CrewGlyph } from '@/components/SubsystemGlyph';
import { CARD, TabHeader } from '@/components/TabHeader';
import { CREW_SLOTS, cargoSlots } from '@/lib/hold';
import { fonts, layout, palette } from '@/lib/theme';

/**
 * The hold and the berths, in the same two states as the reactor: a tab that
 * says how much room there is and how much of it is spoken for, and a panel
 * that opens over the helm to show the room itself.
 *
 * Neither holds anything yet. `filled` is honoured all the way through so
 * that when trade and crew arrive there is nothing to change here, but the
 * helm passes nothing today and every slot reads empty.
 */

/** A slot that has something in it is white; an empty one is an outline. */
const SLOT_EMPTY_BORDER = 'rgba(255,255,255,0.20)';
const SLOT_FILLED = '#FFFFFF';

/* ----------------------------------------------------------------- cargo -- */

export function CargoTab({
  cargo,
  filled = 0,
  width,
  onPress,
}: {
  /** The ship's 0–1 cargo stat; the slot count comes off it. */
  cargo: number;
  filled?: number;
  width: number;
  onPress: () => void;
}) {
  const slots = cargoSlots(cargo);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Hold: ${filled} of ${slots} slots used. Open the hold`}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.tab, { width }, pressed && styles.tabPressed]}
    >
      <TabHeader icon={<CargoGlyph color={palette.textMuted} size={11} />} name="CARGO" />
      <View style={styles.tabBody}>
        <SlotGrid count={slots} filled={filled} perRow={4} size={11} gap={4} />
      </View>
    </Pressable>
  );
}

export function CargoDetail({ cargo, filled = 0 }: { cargo: number; filled?: number }) {
  const slots = cargoSlots(cargo);

  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <CargoGlyph color={palette.textMuted} size={14} />
        <Text style={styles.detailCount}>
          {filled}/{slots}
        </Text>
        <View style={styles.detailRule} />
      </View>

      <View style={styles.detailBody}>
        <SlotGrid count={slots} filled={filled} perRow={4} size={30} gap={9} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ crew -- */

export function CrewTab({
  filled = 0,
  width,
  onPress,
}: {
  filled?: number;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Crew: ${filled} of ${CREW_SLOTS} berths filled. Open the crew`}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.tab, { width }, pressed && styles.tabPressed]}
    >
      <TabHeader icon={<CrewGlyph color={palette.textMuted} size={11} />} name="CREW" />
      <View style={styles.tabBody}>
        <SlotGrid count={CREW_SLOTS} filled={filled} perRow={3} size={13} gap={5} />
      </View>
    </Pressable>
  );
}

export function CrewDetail({ filled = 0 }: { filled?: number }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <CrewGlyph color={palette.textMuted} size={14} />
        <Text style={styles.detailCount}>
          {filled}/{CREW_SLOTS}
        </Text>
        <View style={styles.detailRule} />
      </View>

      <View style={styles.detailBody}>
        <SlotGrid count={CREW_SLOTS} filled={filled} perRow={3} size={46} gap={12} rounded />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ slot -- */

/**
 * The slots themselves, wrapping at `perRow`.
 *
 * One component for both states and both holds, so a filled slot looks the
 * same everywhere it appears — the only thing that changes between the tab and
 * the panel is how big the squares are.
 */
function SlotGrid({
  count,
  filled,
  perRow,
  size,
  gap,
  rounded = false,
}: {
  count: number;
  filled: number;
  perRow: number;
  size: number;
  gap: number;
  rounded?: boolean;
}) {
  const rows: number[][] = [];
  for (let i = 0; i < count; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, count - i) }, (_, k) => i + k));
  }

  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((index) => (
            <View
              key={index}
              style={[
                styles.slot,
                {
                  width: size,
                  height: size,
                  borderRadius: rounded ? size / 2 : Math.max(1.5, size * 0.16),
                },
                index < filled && styles.slotFilled,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    ...CARD,
    height: layout.tabHeight,
    paddingHorizontal: 8,
    paddingVertical: 9,
    justifyContent: 'flex-start',
  },
  tabPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  /** Whatever the header leaves, with the slots centred in it. */
  tabBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  detail: {
    ...CARD,
    borderColor: 'rgba(255,255,255,0.14)',
    width: layout.panelWidth,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', height: 16, gap: 8 },
  detailCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  detailRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  detailBody: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },

  slot: {
    borderWidth: 1,
    borderColor: SLOT_EMPTY_BORDER,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  slotFilled: { backgroundColor: SLOT_FILLED, borderColor: SLOT_FILLED },
});
