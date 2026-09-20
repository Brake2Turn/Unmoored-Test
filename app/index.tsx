import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { TitleBlock } from '@/components/TitleBlock';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, titleSizeFor, tracking, useMenuWidth } from '@/lib/theme';
import { loadRun, summarize, type RunState } from '@/lib/runStore';
import { SHIPS } from '@/lib/ships';
import { loadUnlocked, unlockAll } from '@/lib/unlocks';

const VERSION = 'V0.1.0 (1)';

export default function StartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { settings } = useSettings();
  const haptics = useHaptics();

  const [run, setRun] = useState<RunState | null>(null);
  const [allUnlocked, setAllUnlocked] = useState(false);

  // Re-read the save every time this screen comes back to the front. The
  // unlocks are re-read with it, so the dev button tells the truth again after
  // Reset Progress has wiped them.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRun().then((value) => {
        if (!cancelled) setRun(value);
      });
      loadUnlocked().then((ids) => {
        if (!cancelled) setAllUnlocked(ids.length >= SHIPS.length);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const buttonWidth = useMenuWidth();
  const titleSize = titleSizeFor(width);
  const animate = !settings.reduceMotion;

  const onNewRun = useCallback(() => {
    haptics.confirm();
    // The run is not created until a ship is chosen, so backing out of ship
    // select leaves any existing save untouched.
    router.push('/select-ship');
  }, [haptics, router]);

  const onContinue = useCallback(() => {
    if (!run) return;
    haptics.confirm();
    router.push('/run');
  }, [haptics, router, run]);

  const onSettings = useCallback(() => {
    haptics.tap();
    router.push('/settings');
  }, [haptics, router]);

  /**
   * Nothing in the game unlocks a ship yet, so the locked half of the roster
   * is otherwise impossible to fly. This opens all of it. It writes through
   * the normal unlock store, so Reset Progress in Settings puts it back.
   */
  const onUnlockAll = useCallback(async () => {
    if (allUnlocked) return;
    haptics.confirm();
    await unlockAll();
    setAllUnlocked(true);
  }, [allUnlocked, haptics]);

  return (
    <View style={styles.container}>
      <Backdrop width={width} height={height} />
      <StarField width={width} height={height} reduceMotion={settings.reduceMotion} />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + layout.menuBottomOffset },
        ]}
      >
        <View style={styles.titleArea}>
          <Animated.View entering={animate ? FadeIn.duration(1100).delay(250) : undefined}>
            <TitleBlock size={titleSize} ruleWidth={buttonWidth * 0.62} />
          </Animated.View>
        </View>

        <View style={styles.menu}>
          <Animated.View entering={animate ? FadeInDown.duration(500).delay(850) : undefined}>
            <MenuButton label="NEW RUN" onPress={onNewRun} primary width={buttonWidth} />
          </Animated.View>

          <Animated.View entering={animate ? FadeInDown.duration(500).delay(960) : undefined}>
            <MenuButton
              label="CONTINUE RUN"
              caption={run ? summarize(run) : 'NO RUN IN PROGRESS'}
              onPress={onContinue}
              disabled={!run}
              width={buttonWidth}
            />
          </Animated.View>

          <Animated.View entering={animate ? FadeInDown.duration(500).delay(1070) : undefined}>
            <MenuButton label="SETTINGS" onPress={onSettings} width={buttonWidth} />
          </Animated.View>
        </View>
      </View>

      {/* Dev only, and dressed like it: quiet, out of the way of the menu. */}
      <Animated.View
        entering={animate ? FadeIn.duration(600).delay(1400) : undefined}
        style={[styles.devRow, { bottom: insets.bottom + 58 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            allUnlocked ? 'All ships already unlocked' : 'Developer: unlock every ship'
          }
          accessibilityState={{ disabled: allUnlocked }}
          onPress={onUnlockAll}
          hitSlop={14}
          style={styles.dev}
        >
          <Text style={[styles.devLabel, allUnlocked && { color: palette.accentDim }]}>
            {allUnlocked ? 'ALL SHIPS UNLOCKED' : 'DEV · UNLOCK ALL SHIPS'}
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.Text
        entering={animate ? FadeIn.duration(600).delay(1400) : undefined}
        style={[styles.version, { bottom: insets.bottom + 34 }]}
      >
        {VERSION}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  content: { flex: 1, justifyContent: 'flex-end' },
  titleArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menu: { alignItems: 'center', gap: layout.buttonSpacing },
  devRow: { position: 'absolute', alignSelf: 'center' },
  dev: { paddingVertical: 4, paddingHorizontal: 10 },
  devLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
  version: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
});
