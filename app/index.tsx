import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { TitleBlock } from '@/components/TitleBlock';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking } from '@/lib/theme';
import { loadRun, startNewRun, summarize, type RunState } from '@/lib/runStore';

const VERSION = 'V0.1.0 (1)';

export default function StartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { settings } = useSettings();
  const haptics = useHaptics();

  const [run, setRun] = useState<RunState | null>(null);
  const [loaded, setLoaded] = useState(false);
  /** The entrance plays on first mount only — returning from a run should feel
      like a return, not a fresh launch. */
  const [entranceDone, setEntranceDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEntranceDone(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Re-read the save every time this screen comes back to the front.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadRun().then((value) => {
        if (cancelled) return;
        setRun(value);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const buttonWidth = Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );
  const titleSize = Math.min(Math.max(width * 0.155, 40), 72);

  const animate = !settings.reduceMotion && !entranceDone;

  const onNewRun = useCallback(async () => {
    haptics.confirm();
    const fresh = await startNewRun();
    setRun(fresh);
    router.push('/run');
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
              disabled={!loaded || !run}
              width={buttonWidth}
            />
          </Animated.View>

          <Animated.View entering={animate ? FadeInDown.duration(500).delay(1070) : undefined}>
            <MenuButton label="SETTINGS" onPress={onSettings} width={buttonWidth} />
          </Animated.View>
        </View>
      </View>

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
