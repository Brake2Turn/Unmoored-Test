import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PortraitArt, hasPortrait } from '@/components/PortraitArt';
import { EncounterShip } from '@/components/ships/EncounterShip';
import { MEETINGS, nameOf, type Meeting } from '@/lib/dialogue';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { devStageEncounter, loadRun, saveRun } from '@/lib/runStore';
import { useHaptics } from '@/lib/settings';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * Dev mode only, reached from star select: every encounter in the table as a
 * button, and one for the boss. Pressing one puts the ship in front of it,
 * fresh — dialogue and all — and goes straight back to the space screen.
 *
 * Built off `MEETINGS` itself, so an encounter added to the table turns up
 * here with nobody remembering to add a button.
 */

const GAP = 12;
const FACE = 76;

/** What each kind of meeting is called on its card. */
const KIND_LABEL: Record<Meeting['kind'], string> = {
  combat: 'COMBAT',
  trader: 'TRADER',
  conversation: 'CONVERSATION',
};

export default function EncountersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [busy, setBusy] = useState(false);


  const onPick = useCallback(
    async (target: number | 'boss') => {
      if (busy) return;
      setBusy(true);
      haptics.confirm();
      const run = await loadRun();
      if (run) await saveRun(devStageEncounter(run, target));
      // Back past star select to the space screen, where the encounter waits.
      router.dismissTo('/run');
    },
    [busy, haptics, router],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backLabel}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>ENCOUNTERS</Text>
        <View style={styles.back} />
      </View>
      <Text style={styles.hint}>DEV · TAP ONE TO TEST IT</Text>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
      >
        {MEETINGS.map((meeting) => {
          const red = meeting.hull === 'red';
          const name = nameOf(meeting) ?? meeting.entity;
          return (
            <Pressable
              key={meeting.id}
              accessibilityRole="button"
              accessibilityLabel={`Test encounter ${meeting.id}: ${name}`}
              onPress={() => void onPick(meeting.id)}
              style={({ pressed }) => [
                styles.card,
                { borderColor: red ? 'rgba(255,93,107,0.35)' : 'rgba(242,201,76,0.3)' },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.face}>
                {hasPortrait(meeting.entity) ? (
                  <PortraitArt entity={meeting.entity} size={FACE} />
                ) : (
                  // No face (the abandoned ship): show the ship it arrives in.
                  <EncounterShip encounter={red ? 'enemy' : 'merchant'} width={FACE * 0.62} height={FACE * 0.8} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.name}>
                {name.toUpperCase()}
              </Text>
              <Text style={[styles.kind, { color: red ? palette.danger : palette.trade }]}>
                {KIND_LABEL[meeting.kind]} · #{meeting.id}
              </Text>
            </Pressable>
          );
        })}

        {/* The boss holds no meeting, so it gets a card of its own. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Test encounter: the boss"
          onPress={() => void onPick('boss')}
          style={({ pressed }) => [
            styles.card,
            { borderColor: 'rgba(255,93,107,0.55)' },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.face}>
            <EncounterShip encounter="boss" width={FACE * 0.62} height={FACE * 0.8} />
          </View>
          <Text numberOfLines={1} style={styles.name}>
            {ENCOUNTER_STYLE.boss.label}
          </Text>
          <Text style={[styles.kind, { color: palette.danger }]}>BOSS</Text>
        </Pressable>
      </ScrollView>
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
    height: 32,
  },
  back: { width: 52 },
  backLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: tracking.label,
    marginRight: -tracking.label,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  // Two across, as shares of the list's own width rather than the window's:
  // on web a scrollbar takes part of the window, and cards sized off the
  // window no longer fit two to a row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GAP,
    paddingHorizontal: 20,
  },
  card: {
    width: '48%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.09)' },
  face: { width: FACE, height: FACE, alignItems: 'center', justifyContent: 'center' },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: 0.8,
    marginTop: 8,
  },
  kind: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 4,
  },
});
