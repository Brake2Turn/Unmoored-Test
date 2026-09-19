import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/MenuButton';
import { useHaptics } from '@/lib/settings';
import { fonts, layout, palette, tracking } from '@/lib/theme';
import { loadRun, saveRun, type RunState } from '@/lib/runStore';
import { shipById } from '@/lib/ships';

/**
 * A stand-in for gameplay.
 *
 * This exists purely so the start screen's actions can be exercised end to end:
 * starting a run creates a save, time spent here accumulates, and leaving writes
 * it back so Continue Run has something real to resume. Replace this wholesale
 * when the actual game arrives.
 */
export default function RunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const haptics = useHaptics();

  const [run, setRun] = useState<RunState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const runRef = useRef<RunState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRun().then((value) => {
      if (cancelled || !value) return;
      runRef.current = value;
      setRun(value);
      setElapsed(value.elapsed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick the clock once a second while this screen is mounted.
  useEffect(() => {
    if (!run) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [run]);

  const onExit = useCallback(async () => {
    haptics.confirm();
    const current = runRef.current;
    if (current) await saveRun({ ...current, elapsed });
    router.back();
  }, [elapsed, haptics, router]);

  const buttonWidth = Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );

  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  const ship = shipById(run?.shipId);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + layout.menuBottomOffset }]}>
      <View style={styles.centre}>
        <Text style={[styles.ship, { color: ship.accent }]}>{ship.name}</Text>
        <Text style={styles.headline}>SECTOR {run?.sector ?? 1}</Text>
        <Text style={styles.clock}>
          {minutes}:{String(seconds).padStart(2, '0')}
        </Text>
        <Text style={styles.hint}>GAMEPLAY GOES HERE</Text>
      </View>

      <View style={styles.menu}>
        <MenuButton label="RETURN TO TITLE" onPress={onExit} width={buttonWidth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menu: { alignItems: 'center' },
  ship: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
    marginBottom: 10,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 44,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: tracking.display,
    marginRight: -tracking.display,
  },
  clock: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '500',
    color: palette.accent,
    letterSpacing: tracking.label,
    marginRight: -tracking.label,
    marginTop: 14,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
    marginTop: 18,
  },
});
