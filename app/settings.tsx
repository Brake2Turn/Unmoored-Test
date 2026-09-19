import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/lib/settings';
import { fonts, palette, tracking } from '@/lib/theme';
import { clearRun, loadRun } from '@/lib/runStore';
import { resetUnlocks } from '@/lib/unlocks';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRun().then((run) => {
      if (!cancelled) setHasRun(run !== null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onReset = useCallback(() => {
    Alert.alert('Reset progress?', 'Your current run and any earned ships will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset Progress',
        style: 'destructive',
        onPress: async () => {
          await Promise.all([clearRun(), resetUnlocks()]);
          setHasRun(false);
        },
      },
    ]);
  }, []);

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
          Reduce Motion calms the drifting starfield on the title screen.
        </Text>

        <Text style={styles.section}>PROGRESS</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onReset}
          disabled={!hasRun}
          style={[styles.card, styles.resetRow, { opacity: hasRun ? 1 : 0.45 }]}
        >
          <Text style={styles.resetLabel}>Reset Progress</Text>
        </Pressable>
        <Text style={styles.footnote}>
          {hasRun
            ? 'Discards the run currently in progress. This cannot be undone.'
            : 'There is no run in progress.'}
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
    color: '#FF6B6B',
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
