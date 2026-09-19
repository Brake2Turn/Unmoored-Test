import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
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
import { fonts, layout, palette, tracking } from '@/lib/theme';
import { SHIPS, type Ship } from '@/lib/ships';
import { startNewRun } from '@/lib/runStore';

const CARD_GAP = 16;

export default function SelectShipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const haptics = useHaptics();

  const [index, setIndex] = useState(0);
  const [launching, setLaunching] = useState(false);
  const scrollX = useSharedValue(0);
  // Tracked in a ref so the scroll handler can tell a real change from a
  // settle on the same card without re-rendering.
  const indexRef = useRef(0);

  // The card leaves a margin on both sides, so the neighbouring ships stay
  // visible at the screen edges — that peek is what invites the swipe.
  const cardWidth = Math.min(width * 0.78, 330);
  const snapInterval = cardWidth + CARD_GAP;
  const sidePadding = (width - cardWidth) / 2;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
      const clamped = Math.max(0, Math.min(SHIPS.length - 1, next));
      if (clamped !== indexRef.current) {
        indexRef.current = clamped;
        setIndex(clamped);
        haptics.tap();
      }
    },
    [haptics, snapInterval],
  );

  const selected = SHIPS[index];

  const onLaunch = useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    haptics.confirm();
    await startNewRun(selected.id);
    router.replace('/run');
  }, [haptics, launching, router, selected.id]);

  const buttonWidth = Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );

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
          onMomentumScrollEnd={onMomentumEnd}
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
            />
          ))}
        </Animated.ScrollView>
      </View>

      <View style={styles.info}>
        <Text style={[styles.className, { color: selected.accent }]}>{selected.className}</Text>
        <Text style={styles.name}>{selected.name}</Text>
        <Text style={styles.tagline}>{selected.tagline}</Text>

        <View style={styles.stats}>
          <StatBar label="HULL" value={selected.stats.hull} accent={selected.accent} />
          <StatBar label="SPEED" value={selected.stats.speed} accent={selected.accent} />
          <StatBar label="CARGO" value={selected.stats.cargo} accent={selected.accent} />
        </View>

        <View style={styles.dots}>
          {SHIPS.map((ship, i) => (
            <View
              key={ship.id}
              style={[
                styles.dot,
                i === index && { backgroundColor: selected.accent, width: 18 },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <MenuButton label="LAUNCH" onPress={onLaunch} primary width={buttonWidth} />
      </View>
    </View>
  );
}

/**
 * One ship in the strip. The centred card sits at full size and full opacity;
 * its neighbours shrink and dim as they slide toward the edges.
 */
function ShipCard({
  ship,
  position,
  scrollX,
  snapInterval,
  cardWidth,
}: {
  ship: Ship;
  position: number;
  scrollX: SharedValue<number>;
  snapInterval: number;
  cardWidth: number;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const range = [
      (position - 1) * snapInterval,
      position * snapInterval,
      (position + 1) * snapInterval,
    ];
    return {
      transform: [
        { scale: interpolate(scrollX.value, range, [0.86, 1, 0.86], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(scrollX.value, range, [0.4, 1, 0.4], Extrapolation.CLAMP),
    };
  });

  return (
    <Animated.View style={[styles.card, { width: cardWidth }, animatedStyle]}>
      <View style={[styles.cardInner, { borderColor: ship.accent }]}>
        <ShipArt
          shipId={ship.id}
          accent={ship.accent}
          width={cardWidth * 0.62}
          height={cardWidth * 0.81}
        />
      </View>
    </Animated.View>
  );
}

function StatBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  const filled = Math.round(value * 5);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.segments}>
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < filled ? { backgroundColor: accent } : null,
            ]}
          />
        ))}
      </View>
    </View>
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

  stats: { width: '100%', maxWidth: 260, gap: 7, marginTop: 18 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    width: 48,
  },
  segments: { flexDirection: 'row', gap: 4, flex: 1 },
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
