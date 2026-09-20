import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fonts, layout, palette, tracking } from '@/lib/theme';

type Props = {
  label: string;
  caption?: string;
  onPress: () => void;
  /** The one action we want the player's thumb to find first. */
  primary?: boolean;
  disabled?: boolean;
  width: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A start-screen menu entry: a translucent capsule with a tracked label, an
 * optional caption, a pressed state and a disabled state.
 *
 * `Pressable` handles drag-off cancelling for us — sliding a thumb off the
 * button fires `onPressOut` without `onPress`, matching the native feel.
 */
export function MenuButton({
  label,
  caption,
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
      }
    : primary
      ? {
          fill: palette.accent,
          border: palette.accent,
          label: palette.void,
          caption: palette.void,
        }
      : {
          fill: 'rgba(255,255,255,0.05)',
          border: palette.accentDim,
          label: palette.textPrimary,
          caption: palette.textMuted,
        };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
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
      <View pointerEvents="none" style={styles.stack}>
        <Text style={[styles.label, { color: scheme.label }]}>{label}</Text>
        {caption ? (
          <Text style={[styles.caption, { color: scheme.caption }]}>{caption}</Text>
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
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: tracking.label,
    textAlign: 'center',
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: tracking.caption,
    textAlign: 'center',
    marginTop: 5,
  },
});
