import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, palette, tracking } from '@/lib/theme';
import { clearRun, loadRun } from '@/lib/runStore';
import { SHIPS, STARTER_SHIP_IDS } from '@/lib/ships';
import { loadUnlocked, resetUnlocks, unlockAll } from '@/lib/unlocks';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const haptics = useHaptics();
  const [hasRun, setHasRun] = useState(false);
  const [hasShips, setHasShips] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [allUnlocked, setAllUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRun().then((run) => {
      if (!cancelled) setHasRun(run !== null);
    });
    // Earned ships are progress too, and they outlive any single run — a
    // roster opened by the dev button has to be clearable with no run going.
    loadUnlocked().then((ids) => {
      if (!cancelled) {
        setHasShips(ids.length > STARTER_SHIP_IDS.length);
        setAllUnlocked(ids.length >= SHIPS.length);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canReset = hasRun || hasShips;

  // An armed confirmation lapses on its own, so a stray tap cannot leave the
  // next one primed to wipe a save.
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  /**
   * Reset asks twice, in the row itself.
   *
   * It used to raise a system alert, which `react-native-web` implements as an
   * empty function — on web the dialog never appeared and nothing was ever
   * reset. Confirming in place works the same on every platform, and looks
   * like the rest of the app rather than like the operating system.
   */
  const onReset = useCallback(async () => {
    if (!canReset) return;

    if (!confirming) {
      haptics.tap();
      setConfirming(true);
      return;
    }

    haptics.confirm();
    await Promise.all([clearRun(), resetUnlocks()]);
    setHasRun(false);
    setHasShips(false);
    setAllUnlocked(false);
    setConfirming(false);
  }, [canReset, confirming, haptics]);

  /**
   * Nothing in the game unlocks a ship yet, so the locked part of the roster
   * is otherwise impossible to fly. This opens all of it. It writes through
   * the normal unlock store, so Reset Progress below puts it back.
   */
  const onUnlockAll = useCallback(async () => {
    if (allUnlocked) return;
    haptics.confirm();
    await unlockAll();
    setAllUnlocked(true);
    setHasShips(true);
  }, [allUnlocked, haptics]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.done}
        >
          <Text style={styles.doneLabel}>DONE</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>AUDIO</Text>
        <View style={styles.card}>
          <SliderRow
            label="Music"
            value={settings.musicVolume}
            onChange={(musicVolume) => update({ musicVolume })}
          />
          <View style={styles.divider} />
          <SliderRow
            label="Sound Effects"
            value={settings.effectsVolume}
            onChange={(effectsVolume) => update({ effectsVolume })}
          />
        </View>

        <Text style={styles.section}>FEEL</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Haptics"
            value={settings.hapticsEnabled}
            onChange={(hapticsEnabled) => update({ hapticsEnabled })}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Reduce Motion"
            value={settings.reduceMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
        </View>
        <Text style={styles.footnote}>
          Reduce Motion holds the stars still: no twinkling, no drifting.
        </Text>

        <Text style={styles.section}>DEVELOPER</Text>
        <View style={styles.card}>
          <ToggleRow
            label="Dev Mode"
            value={settings.devMode}
            onChange={(devMode) => update({ devMode })}
          />
          {settings.devMode ? (
            <>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  allUnlocked ? 'All ships already unlocked' : 'Developer: unlock every ship'
                }
                accessibilityState={{ disabled: allUnlocked }}
                disabled={allUnlocked}
                onPress={onUnlockAll}
                style={[styles.row, styles.toggleRow]}
              >
                <Text style={[styles.rowLabel, allUnlocked && { color: palette.textMuted }]}>
                  Unlock All Ships
                </Text>
                <Text style={styles.rowValue}>{allUnlocked ? 'DONE' : 'UNLOCK'}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        <Text style={styles.footnote}>
          Dev Mode adds test tools: hit and refill buttons on the space screen,
          and an Encounters list on the star select screen.
        </Text>

        <Text style={styles.section}>PROGRESS</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            confirming ? 'Tap again to reset progress' : 'Reset progress'
          }
          onPress={onReset}
          disabled={!canReset}
          style={[styles.card, styles.resetRow, { opacity: canReset ? 1 : 0.45 }]}
        >
          <Text style={styles.resetLabel}>
            {confirming ? 'Tap again to confirm' : 'Reset Progress'}
          </Text>
        </Pressable>
        <Text style={styles.footnote}>
          {confirming
            ? 'Discards the run and every earned ship. This cannot be undone.'
            : canReset
              ? 'Discards the run in progress and any ships earned. This cannot be undone.'
              : 'There is no run in progress and no ships earned.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{Math.round(value * 100)}%</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor={palette.accent}
        maximumTrackTintColor="rgba(255,255,255,0.15)"
        thumbTintColor={palette.accent}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.row, styles.toggleRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.15)', true: palette.accent }}
        thumbColor="#FFFFFF"
      />
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
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: tracking.label,
  },
  done: { paddingVertical: 4, paddingHorizontal: 4 },
  doneLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '600',
    color: palette.accent,
    letterSpacing: tracking.caption,
  },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  section: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginTop: 26,
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  row: { paddingVertical: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textPrimary,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  resetRow: { paddingVertical: 15, alignItems: 'center' },
  resetLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.danger,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: palette.textMuted,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
