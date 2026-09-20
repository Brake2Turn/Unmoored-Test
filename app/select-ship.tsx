import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/MenuButton';
import { ShipArt } from '@/components/ships/ShipArt';
import { useHaptics } from '@/lib/settings';
import { fonts, palette, tracking, useMenuWidth } from '@/lib/theme';
import { SHIPS, STARTER_SHIP_IDS, type Ship } from '@/lib/ships';
import { TOTAL_CAPACITY } from '@/lib/energy';
import { loadUnlocked } from '@/lib/unlocks';
import { startNewRun } from '@/lib/runStore';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';

const CARD_GAP = 16;

/** Cargo has no natural unit, so it reads as a five-segment impression. */
const CARGO_SEGMENTS = 5;

export default function SelectShipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const haptics = useHaptics();

  const [index, setIndex] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [unlocked, setUnlocked] = useState<string[]>(STARTER_SHIP_IDS);

  useEffect(() => {
    let cancelled = false;
    loadUnlocked().then((ids) => {
      if (!cancelled) setUnlocked(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const scrollX = useSharedValue(0);

  // The card leaves a margin on both sides, so the neighbouring ships stay
  // visible at the screen edges — that peek is what invites the swipe.
  const cardWidth = Math.min(width * 0.72, 320);
  const snapInterval = cardWidth + CARD_GAP;
  const sidePadding = (width - cardWidth) / 2;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const commitIndex = useCallback(
    (next: number) => {
      setIndex(next);
      haptics.tap();
    },
    [haptics],
  );

  // The selection follows whichever card is centred, recomputed from the
  // scroll offset itself.
  //
  // `onMomentumScrollEnd` is the obvious place to commit it, and it is what
  // this screen used to do — but react-native-web's ScrollView never calls
  // that prop (its only scroll callback is `onScroll`), so on web the index
  // stayed at 0 no matter how far you scrolled: the carousel moved and the
  // ship below it never changed. Native has a smaller version of the same
  // hole, where a slow drag released without any flick ends in
  // `onScrollEndDrag` and never reaches momentum at all.
  //
  // Reading the offset works on both, and owes nothing to an event firing.
  useAnimatedReaction(
    () => {
      if (snapInterval <= 0) return 0;
      const raw = Math.round(scrollX.value / snapInterval);
      return Math.min(SHIPS.length - 1, Math.max(0, raw));
    },
    (next, previous) => {
      // `previous` is null on the first run, which is the mount, not a move.
      if (previous !== null && next !== previous) {
        runOnJS(commitIndex)(next);
      }
    },
    [commitIndex, snapInterval],
  );

  const selected = SHIPS[index];
  const isLocked = !unlocked.includes(selected.id);

  const onLaunch = useCallback(async () => {
    // The button is disabled on a locked ship; this is belt-and-braces.
    if (launching || isLocked) return;
    setLaunching(true);
    haptics.confirm();
    await startNewRun(selected.id);
    router.replace('/run');
  }, [haptics, isLocked, launching, router, selected.id]);

  const buttonWidth = useMenuWidth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={14}
          style={styles.back}
        >
          <Text style={styles.backLabel}>BACK</Text>
        </Pressable>
        <Text style={styles.heading}>SELECT SHIP</Text>
        {/* Balances the back control so the heading stays centred. */}
        <View style={styles.back} />
      </View>

      <View style={styles.carousel}>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: sidePadding, gap: CARD_GAP }}
        >
          {SHIPS.map((ship, i) => (
            <ShipCard
              key={ship.id}
              ship={ship}
              position={i}
              scrollX={scrollX}
              snapInterval={snapInterval}
              cardWidth={cardWidth}
              locked={!unlocked.includes(ship.id)}
            />
          ))}
        </Animated.ScrollView>
      </View>

      <View style={styles.info}>
        <Text style={[styles.className, { color: isLocked ? palette.textDisabled : selected.accent }]}>
          {selected.className}
        </Text>
        <Text style={[styles.name, isLocked && { color: palette.textDisabled }]}>{selected.name}</Text>

        {isLocked ? (
          <View style={styles.hintRow}>
            <LockGlyph size={11} color={palette.textMuted} />
            <Text style={styles.unlockHint}>{selected.unlockHint}</Text>
          </View>
        ) : (
          <Text style={styles.tagline}>{selected.tagline}</Text>
        )}

        <View style={styles.stats}>
          <StatBar
            label="CARGO"
            filled={Math.round(selected.cargo * CARGO_SEGMENTS)}
            total={CARGO_SEGMENTS}
            accent={selected.accent}
            locked={isLocked}
          />
          {/* Out of what all three subsystems could hold, so the shortfall is
              part of the ship's description rather than a surprise at the helm. */}
          <StatBar
            label="REACTOR"
            filled={selected.reactor}
            total={TOTAL_CAPACITY}
            accent={selected.accent}
            locked={isLocked}
          />
        </View>

        <View style={styles.dots}>
          {SHIPS.map((ship, i) => (
            <View
              key={ship.id}
              style={[
                styles.dot,
                i === index && {
                  backgroundColor: isLocked ? palette.textDisabled : selected.accent,
                  width: 18,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <MenuButton
          label={isLocked ? 'LOCKED' : 'LAUNCH'}
          onPress={onLaunch}
          primary={!isLocked}
          disabled={isLocked}
          width={buttonWidth}
        />
      </View>
    </View>
  );
}

/**
 * One ship in the strip. The centred card sits at full size and full opacity;
 * its neighbours shrink and dim as they slide toward the edges.
 */
const ShipCard = React.memo(function ShipCard({
  ship,
  position,
  scrollX,
  snapInterval,
  cardWidth,
  locked,
}: {
  ship: Ship;
  position: number;
  scrollX: SharedValue<number>;
  snapInterval: number;
  cardWidth: number;
  locked: boolean;
}) {
  // Constant for this card's lifetime, so it is built once rather than on
  // every scroll frame inside the worklet.
  const range = useMemo(
    () => [(position - 1) * snapInterval, position * snapInterval, (position + 1) * snapInterval],
    [position, snapInterval],
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(scrollX.value, range, [0.9, 1, 0.9], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(scrollX.value, range, [0.5, 1, 0.5], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[styles.card, { width: cardWidth }, animatedStyle]}>
      <View
        style={[
          styles.cardInner,
          { borderColor: locked ? 'rgba(255,255,255,0.10)' : ship.accent },
          locked && styles.cardLocked,
        ]}
      >
        <ShipArt
          shipId={ship.id}
          accent={ship.accent}
          width={cardWidth * 0.74}
          height={cardWidth * 0.97}
          locked={locked}
        />
        {locked ? (
          <View style={styles.lockBadge}>
            <LockGlyph size={13} color={palette.textMuted} />
            <Text style={styles.lockLabel}>LOCKED</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
});

/**
 * One labelled bar.
 *
 * `total` varies by row: cargo is a rough five-segment impression, while the
 * reactor is counted in the same whole bars the helm panel spends, so the two
 * rows are honestly different units rather than a shared fiction.
 */
function StatBar({
  label,
  filled,
  total,
  accent,
  locked,
}: {
  label: string;
  filled: number;
  total: number;
  accent: string;
  locked: boolean;
}) {
  const fill = locked ? 'rgba(255,255,255,0.22)' : accent;
  return (
    <View style={styles.statRow}>
      <Text numberOfLines={1} style={styles.statLabel}>
        {label}
      </Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < filled ? { backgroundColor: fill } : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Small padlock, drawn rather than pulled from an icon font. */
function LockGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 16 20">
      <Path
        d="M4.5 8.5 V5.5 a3.5 3.5 0 0 1 7 0 V8.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <SvgRect x={2} y={8.5} width={12} height={9.5} rx={2.2} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 44,
  },
  back: { width: 52 },
  backLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: tracking.label,
    marginRight: -tracking.label,
  },

  carousel: { flex: 1, justifyContent: 'center' },
  card: { height: '100%', paddingVertical: 8 },
  cardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.028)',
  },

  cardLocked: { backgroundColor: 'rgba(255,255,255,0.012)' },
  lockBadge: {
    position: 'absolute',
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  lockLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },

  info: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 18 },
  className: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: 8,
    marginRight: -8,
    marginTop: 6,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  unlockHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },

  stats: { width: '100%', maxWidth: 260, gap: 7, marginTop: 18 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    // Wide enough for REACTOR's seven tracked capitals; at 48 it broke to
    // "REACT OR". Tracked caps are far wider than they look.
    width: 62,
  },
  segments: { flexDirection: 'row', gap: 3, flex: 1 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },

  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  footer: { alignItems: 'center', paddingTop: 18 },
});
