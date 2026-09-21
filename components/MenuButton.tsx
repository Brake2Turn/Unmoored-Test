import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fonts, layout, palette, tracking } from '@/lib/theme';

/**
 * A gauge tucked into the right of a button — the fuel tank on JUMP.
 *
 * It is passed as data rather than as a rendered node so the button can colour
 * it from its own scheme: the same gauge has to read as dark-on-accent inside
 * a primary button and light-on-dark inside a plain one.
 */
export type Readout = {
  /** Spelled out in full, e.g. FUEL. */
  label: string;
  value: string;
  /** Turns the gauge red — the tank is nearly dry. */
  alert?: boolean;
};

type Props = {
  label: string;
  caption?: string;
  readout?: Readout;
  onPress: () => void;
  /** The one action we want the player's thumb to find first. */
  primary?: boolean;
  disabled?: boolean;
  width: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A start-screen menu entry: a translucent capsule with a tracked label, an
 * optional caption, an optional outlined gauge, a pressed state and a disabled
 * state.
 *
 * `Pressable` handles drag-off cancelling for us — sliding a thumb off the
 * button fires `onPressOut` without `onPress`, matching the native feel.
 */
export function MenuButton({
  label,
  caption,
  readout,
  onPress,
  primary = false,
  disabled = false,
  width,
}: Props) {
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: 90 });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 90 });
  }, [pressed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.028 }],
  }));

  const bloomStyle = useAnimatedStyle(() => ({ opacity: pressed.value * 0.35 }));

  const scheme = disabled
    ? {
        fill: 'rgba(255,255,255,0.02)',
        border: 'rgba(255,255,255,0.07)',
        label: palette.textDisabled,
        caption: palette.textDisabled,
        gaugeBorder: 'rgba(255,255,255,0.12)',
      }
    : primary
      ? {
          fill: palette.accent,
          border: palette.accent,
          label: palette.void,
          caption: palette.void,
          // The gauge sits on the accent fill, so its outline is drawn in the
          // dark ink of the label rather than in white.
          gaugeBorder: 'rgba(5,7,15,0.45)',
        }
      : {
          fill: 'rgba(255,255,255,0.05)',
          border: palette.accentDim,
          label: palette.textPrimary,
          caption: palette.textMuted,
          gaugeBorder: palette.accentDim,
        };

  // Red on cyan is barely legible, so a warning inside a primary button turns
  // the gauge into a solid red block instead of red text on the accent fill.
  const gauge = !readout?.alert
    ? { border: scheme.gaugeBorder, fill: 'transparent', ink: scheme.label }
    : primary && !disabled
      ? { border: palette.danger, fill: palette.danger, ink: palette.void }
      : { border: palette.danger, fill: 'transparent', ink: palette.danger };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={
        [label, caption, readout && `${readout.label} ${readout.value}`]
          .filter(Boolean)
          .join('. ') || label
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        {
          width,
          height: layout.buttonHeight,
          borderRadius: layout.buttonRadius,
          backgroundColor: scheme.fill,
          borderColor: scheme.border,
          opacity: disabled ? 0.55 : 1,
        },
        animatedStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: layout.buttonRadius, backgroundColor: palette.accent },
          bloomStyle,
        ]}
      />
      <View pointerEvents="none" style={styles.row}>
        <View style={styles.stack}>
          <Text numberOfLines={1} style={[styles.label, { color: scheme.label }]}>
            {label}
          </Text>
          {caption ? (
            <Text numberOfLines={1} style={[styles.caption, { color: scheme.caption }]}>
              {caption}
            </Text>
          ) : null}
        </View>

        {readout ? (
          <View
            style={[
              styles.gauge,
              { borderColor: gauge.border, backgroundColor: gauge.fill },
            ]}
          >
            <Text style={[styles.gaugeLabel, { color: gauge.ink }]}>{readout.label}</Text>
            <Text style={[styles.gaugeValue, { color: gauge.ink }]}>{readout.value}</Text>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 14,
  },
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: tracking.label,
    // Tracking is added after the last glyph too; this pulls the phantom gap
    // back so the label sits optically centred.
    marginRight: -tracking.label,
    textAlign: 'center',
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
    textAlign: 'center',
    marginTop: 5,
  },

  gauge: {
    minWidth: 48,
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.1,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.6,
    marginRight: -1.6,
  },
  gaugeValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
});
