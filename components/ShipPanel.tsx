import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { CargoGlyph, CrewGlyph, ShipGlyph, SubsystemGlyph } from '@/components/SubsystemGlyph';
import { CARD, PanelHeader, TabHeader } from '@/components/PanelChrome';
import { WeaponIcon } from '@/components/WeaponArt';
import { CREW_SLOTS, firstEmptySlot, type Loadout, type Place } from '@/lib/hold';
import { weaponById } from '@/lib/weapons';
import { fonts, layout, palette, tracking } from '@/lib/theme';

/**
 * The ship section: the weapon on the hardpoint, the cargo hold and the crew
 * berths, in the same two states as the reactor — a tab that shows what is
 * where, and a panel that opens over the helm where things can be moved.
 *
 * Cargo and crew used to be two tabs of their own. They became one because
 * the weapon has to travel between the hardpoint and the hold, and a drag
 * cannot cross from one panel into another when only one is ever open.
 *
 * Crew holds nobody yet — there is no roster — so the berths are always drawn
 * empty. The hold takes weapons.
 */

/** A slot that has something in it is white; an empty one is an outline. */
const SLOT_EMPTY_BORDER = 'rgba(255,255,255,0.20)';
const SLOT_FILLED = '#FFFFFF';

/** Web-only CSS that `ViewStyle` has no names for; nothing on native. */
const webOnly = (rule: Record<string, string>): ViewStyle | null =>
  Platform.OS === 'web' ? (rule as unknown as ViewStyle) : null;

/**
 * A draggable weapon must not scroll or zoom the page under a finger, select
 * text, or start the browser's own image drag — any of those steals the
 * gesture halfway through.
 */
const DRAGGABLE_WEB = webOnly({ touchAction: 'none', userSelect: 'none', cursor: 'grab' });

/** Under this many pixels of travel a press is a tap, not a drag. */
const TAP_SLOP = 6;

/** Drop targets are this much more generous than the slot drawn. */
const DROP_SLOP = 8;

/* ------------------------------------------------------------------- tab -- */

export function ShipTab({
  loadout,
  width,
  onPress,
}: {
  loadout: Loadout;
  width: number;
  onPress: () => void;
}) {
  const weapon = weaponById(loadout.mounted);
  const stowed = loadout.hold.filter((item) => item !== null).length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `Ship: ${weapon ? `${titleCase(weapon.name)} mounted` : 'no weapon mounted'}, ` +
        `${stowed} of ${loadout.hold.length} cargo slots used, ` +
        `0 of ${CREW_SLOTS} berths filled. Open the ship`
      }
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.tab, { width }, pressed && styles.tabPressed]}
    >
      <TabHeader icon={<ShipGlyph color={palette.textMuted} size={11} />} name="SHIP" />
      <View style={styles.tabBody}>
        {/* The hardpoint, with whatever is on it. */}
        <View style={[styles.slot, styles.tabMount, weapon && styles.mountArmed]}>
          {weapon ? <WeaponIcon weaponId={weapon.id} size={24} color={palette.player} /> : null}
        </View>

        <View style={styles.tabHold}>
          <SlotGrid items={loadout.hold} perRow={4} size={11} gap={4} />
          <SlotGrid items={Array.from({ length: CREW_SLOTS }, () => null)} perRow={3} size={9} gap={5} rounded />
        </View>
      </View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- panel -- */

/** A rectangle on screen, in window coordinates. */
type Box = { x: number; y: number; w: number; h: number };

/** What is being dragged, from where, and where the pointer is now. */
type Drag = { from: Place; item: string; x: number; y: number; moved: boolean };

const MOUNT_SIZE = 56;
const CARGO_SIZE = 40;
const CARGO_GAP = 8;
const GHOST_SIZE = 44;

export function ShipDetail({
  loadout,
  onMove,
}: {
  loadout: Loadout;
  /** Asked to move whatever is at `from` into `to`; the run decides if it may. */
  onMove: (from: Place, to: Place) => void;
}) {
  const weapon = weaponById(loadout.mounted);
  const stowed = loadout.hold.filter((item) => item !== null).length;

  const [drag, setDrag] = useState<Drag | null>(null);

  // Where the panel and every drop target sit on screen, measured when a drag
  // starts. Refs rather than state: nothing is drawn from them.
  const rootRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const targets = useRef(new Map<string, View | null>());
  const boxes = useRef(new Map<string, Box>());

  const register = useCallback(
    (key: string) => (view: View | null) => {
      targets.current.set(key, view);
    },
    [],
  );

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
    targets.current.forEach((view, key) => {
      view?.measureInWindow((x, y, w, h) => boxes.current.set(key, { x, y, w, h }));
    });
  }, []);

  /** The place under a point, or null. The hold as a whole counts as its first empty slot. */
  const placeAt = useCallback(
    (px: number, py: number): Place | null => {
      const inside = (box: Box | undefined) =>
        !!box &&
        px >= box.x - DROP_SLOP &&
        px <= box.x + box.w + DROP_SLOP &&
        py >= box.y - DROP_SLOP &&
        py <= box.y + box.h + DROP_SLOP;

      if (inside(boxes.current.get('mount'))) return 'mount';
      for (let i = 0; i < loadout.hold.length; i++) {
        if (inside(boxes.current.get(`slot${i}`)) && loadout.hold[i] === null) return i;
      }
      // Dropped on the hold but not on an empty slot: it still goes in, into
      // the first slot with room, so "drag it into cargo" never needs aiming.
      if (inside(boxes.current.get('hold'))) return firstEmptySlot(loadout);
      return null;
    },
    [loadout],
  );

  const onStart = useCallback(
    (from: Place, item: string, x: number, y: number) => {
      measure();
      setDrag({ from, item, x, y, moved: false });
    },
    [measure],
  );

  const onDrag = useCallback((x: number, y: number, moved: boolean) => {
    setDrag((current) => (current ? { ...current, x, y, moved: current.moved || moved } : null));
  }, []);

  const onEnd = useCallback(
    (from: Place, x: number, y: number, travelled: number) => {
      setDrag(null);
      if (travelled < TAP_SLOP) {
        // A tap moves it the obvious way: off the hardpoint into the hold, or
        // out of the hold back onto an empty hardpoint.
        const to = from === 'mount' ? firstEmptySlot(loadout) : 'mount';
        if (to !== null) onMove(from, to);
        return;
      }
      const to = placeAt(x, y);
      if (to !== null && to !== from) onMove(from, to);
    },
    [loadout, onMove, placeAt],
  );

  const dragging = drag?.moved ? drag : null;

  return (
    <View ref={rootRef} style={styles.detail}>
      <PanelHeader icon={<ShipGlyph color={palette.textMuted} size={14} />} name="SHIP" />

      {/* The hardpoint. */}
      <SectionLabel
        icon={<SubsystemGlyph subsystem="weapons" color={palette.textMuted} size={11} />}
        name="WEAPON"
      />
      <View style={styles.mountRow}>
        <View
          ref={register('mount')}
          collapsable={false}
          accessibilityLabel={weapon ? undefined : 'Empty hardpoint'}
          style={[
            styles.slot,
            styles.mount,
            weapon && styles.mountArmed,
            dragging && !weapon && styles.slotReady,
          ]}
        >
          {weapon ? (
            <Draggable
              place="mount"
              item={weapon.id}
              size={MOUNT_SIZE}
              iconSize={42}
              hidden={dragging?.from === 'mount'}
              label={`${titleCase(weapon.name)} on the hardpoint. Drag it into the cargo`}
              onStart={onStart}
              onDrag={onDrag}
              onEnd={onEnd}
            />
          ) : null}
        </View>
        <View style={styles.mountText}>
          <Text style={[styles.weaponName, !weapon && styles.weaponNone]}>
            {weapon ? weapon.name : 'NO WEAPON'}
          </Text>
          <Text style={styles.hint}>
            {weapon ? 'DRAG INTO CARGO TO STOW' : 'DRAG ONE UP FROM CARGO'}
          </Text>
        </View>
      </View>

      {/* The hold. */}
      <SectionLabel
        icon={<CargoGlyph color={palette.textMuted} size={11} />}
        name="CARGO"
        count={`${stowed}/${loadout.hold.length}`}
      />
      <View style={styles.holdWrap}>
        <View ref={register('hold')} collapsable={false} style={styles.hold}>
          {loadout.hold.map((item, i) => (
            <View
              key={i}
              ref={register(`slot${i}`)}
              collapsable={false}
              accessibilityLabel={item === null ? `Empty cargo slot ${i + 1}` : undefined}
              style={[
                styles.slot,
                { width: CARGO_SIZE, height: CARGO_SIZE, borderRadius: 6 },
                item !== null && styles.slotHolding,
                dragging && item === null && styles.slotReady,
              ]}
            >
              {item !== null ? (
                <Draggable
                  place={i}
                  item={item}
                  size={CARGO_SIZE}
                  iconSize={30}
                  hidden={dragging?.from === i}
                  label={`${titleCase(weaponById(item)?.name ?? 'Weapon')} in cargo slot ${i + 1}. Drag it onto the hardpoint`}
                  onStart={onStart}
                  onDrag={onDrag}
                  onEnd={onEnd}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* The berths. */}
      <SectionLabel
        icon={<CrewGlyph color={palette.textMuted} size={11} />}
        name="CREW"
        count={`0/${CREW_SLOTS}`}
      />
      <View style={styles.crewWrap}>
        <SlotGrid items={Array.from({ length: CREW_SLOTS }, () => null)} perRow={3} size={30} gap={10} rounded />
      </View>

      {/* What is being carried, under the finger. Drawn at the panel's top
          level so it passes over every slot rather than under the later ones. */}
      {dragging ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: dragging.x - origin.current.x - GHOST_SIZE / 2,
              top: dragging.y - origin.current.y - GHOST_SIZE / 2,
            },
          ]}
        >
          <WeaponIcon weaponId={dragging.item} size={GHOST_SIZE - 6} color={palette.player} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One weapon that can be picked up.
 *
 * PanResponder rather than a gesture library: it ships with React Native,
 * works the same with a mouse on web as with a finger on a phone, and this is
 * one drag in one panel. The handlers read their props through a ref because
 * the responder is built once and would otherwise hold the first render's.
 */
function Draggable({
  place,
  item,
  size,
  iconSize,
  hidden,
  label,
  onStart,
  onDrag,
  onEnd,
}: {
  place: Place;
  item: string;
  size: number;
  iconSize: number;
  hidden: boolean;
  label: string;
  onStart: (from: Place, item: string, x: number, y: number) => void;
  onDrag: (x: number, y: number, moved: boolean) => void;
  onEnd: (from: Place, x: number, y: number, travelled: number) => void;
}) {
  const latest = useRef({ place, item, onStart, onDrag, onEnd });
  latest.current = { place, item, onStart, onDrag, onEnd };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Once a weapon is picked up, nothing else gets to take the gesture.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => {
        const { place: from, item: what } = latest.current;
        latest.current.onStart(from, what, g.x0, g.y0);
      },
      // `moveX` is only filled in once something moves, so the pointer is
      // always worked out from where it started plus how far it has gone.
      onPanResponderMove: (_, g) => {
        latest.current.onDrag(g.x0 + g.dx, g.y0 + g.dy, Math.hypot(g.dx, g.dy) >= TAP_SLOP);
      },
      onPanResponderRelease: (_, g) => {
        latest.current.onEnd(latest.current.place, g.x0 + g.dx, g.y0 + g.dy, Math.hypot(g.dx, g.dy));
      },
      // Taken away by the system: put it back where it was.
      onPanResponderTerminate: (_, g) => {
        latest.current.onEnd(latest.current.place, Number.NaN, Number.NaN, TAP_SLOP);
      },
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel={label}
      style={[styles.draggable, { width: size, height: size }, DRAGGABLE_WEB, hidden && styles.lifted]}
    >
      <WeaponIcon weaponId={item} size={iconSize} color={palette.player} />
    </View>
  );
}

/** A small heading inside the panel: a mark, a name and, if it counts, a count. */
function SectionLabel({ icon, name, count }: { icon: React.ReactNode; name: string; count?: string }) {
  return (
    <View style={styles.sectionLabel}>
      {icon}
      <Text style={styles.sectionName}>{name}</Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ slot -- */

/**
 * A plain grid of slots, wrapping at `perRow`. A slot holding something is
 * white — at tab size there is no room for the thing itself.
 */
function SlotGrid({
  items,
  perRow,
  size,
  gap,
  rounded = false,
}: {
  items: (string | null)[];
  perRow: number;
  size: number;
  gap: number;
  rounded?: boolean;
}) {
  const rows: number[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, items.length - i) }, (_, k) => i + k));
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
                items[index] !== null && styles.slotFilled,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** "WEAPON 1" → "Weapon 1", for a screen reader rather than for the eye. */
function titleCase(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
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
  /** Whatever the header leaves: the hardpoint beside the hold and berths. */
  tabBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  tabMount: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabHold: { gap: 8, alignItems: 'flex-start' },

  detail: {
    ...CARD,
    borderColor: 'rgba(255,255,255,0.14)',
    width: layout.panelWidth,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 14,
  },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8 },
  sectionName: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    color: palette.textMuted,
    letterSpacing: 1.1,
  },
  sectionCount: {
    marginLeft: 'auto',
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },

  mountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mount: {
    width: MOUNT_SIZE,
    height: MOUNT_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mountArmed: { borderColor: 'rgba(255,255,255,0.55)' },
  mountText: { flex: 1, gap: 4 },
  weaponName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: tracking.caption,
  },
  weaponNone: { color: palette.textDisabled },
  hint: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: 1.1,
  },

  holdWrap: { alignItems: 'center' },
  hold: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARGO_GAP,
    // Four across, so the hold wraps the same way the tab's does.
    width: CARGO_SIZE * 4 + CARGO_GAP * 3,
  },
  crewWrap: { alignItems: 'center' },

  slot: {
    borderWidth: 1,
    borderColor: SLOT_EMPTY_BORDER,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  slotFilled: { backgroundColor: SLOT_FILLED, borderColor: SLOT_FILLED },
  /** A cargo slot holding a weapon shows the weapon, not a white square. */
  slotHolding: { borderColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  /** An empty place a dragged weapon could land in. */
  slotReady: { borderColor: palette.player, borderStyle: 'dashed' },

  draggable: { alignItems: 'center', justifyContent: 'center' },
  /** The weapon's own spot while it is being carried: a faint trace of it. */
  lifted: { opacity: 0.18 },
  ghost: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.player,
    backgroundColor: 'rgba(11,15,30,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
