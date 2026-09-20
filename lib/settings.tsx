import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'unmoored.settings';

export type Settings = {
  musicVolume: number;
  effectsVolume: number;
  hapticsEnabled: boolean;
  /** Calms the drifting starfield and the entrance animation. */
  reduceMotion: boolean;
};

const DEFAULTS: Settings = {
  musicVolume: 0.7,
  effectsVolume: 0.85,
  hapticsEnabled: true,
  reduceMotion: false,
};

type SettingsContextValue = {
  settings: Settings;
  /** True until the stored settings have been read back from disk. */
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  ready: false,
  update: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!cancelled && raw) {
          setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
        }
      } catch {
        // Fall back to defaults.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/**
 * Haptics that respect the player's preference. Every tap in the app goes
 * through here rather than calling expo-haptics directly.
 */
export function useHaptics() {
  const { settings } = useSettings();

  const tap = useCallback(() => {
    if (!settings.hapticsEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [settings.hapticsEnabled]);

  const confirm = useCallback(() => {
    if (!settings.hapticsEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [settings.hapticsEnabled]);

  // Memoised: a fresh object here makes `haptics` a changing dependency, which
  // silently defeats every useCallback that lists it.
  return useMemo(() => ({ tap, confirm }), [tap, confirm]);
}
