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
  /**
   * Overrides the menu height. The helm's JUMP is a compact control beside
   * the reactor tab rather than a full menu row, so it asks for less.
   */
  height?: number;
  /**
   * A gauge pinned inside the right of the button, drawn in the button's own
   * text colour and boxed off from the label by its own outline. The helm's
   * fuel lives here rather than in a strip of its own: it is only ever
   * consulted when deciding whether to jump.
   *
   * It takes the name and the reading apart rather than one string, so the
   * word can be set small and tracked against a large figure — `F 10` fitted
   * a corner but had to be learned before it said anything.
   */
  gauge?: { label: string; value: string };
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
  height = layout.buttonHeight,
  gauge,
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
          height,
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
      {gauge ? (
        <View pointerEvents="none" style={styles.trailing}>
          <View style={[styles.gauge, { borderColor: scheme.label }]}>
            <Text style={[styles.gaugeLabel, { color: scheme.label }]}>{gauge.label}</Text>
            <Text style={[styles.gaugeValue, { color: scheme.label }]}>{gauge.value}</Text>
          </View>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.stack}>
        <Text
          style={[
            styles.label,
            { color: scheme.label },
            height < layout.buttonHeight ? styles.labelCompact : null,
          ]}
        >
          {label}
        </Text>
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
  labelCompact: { fontSize: 14, letterSpacing: tracking.caption },
  trailing: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  gauge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1.1,
    borderRadius: 7,
    borderCurve: 'continuous',
    // The outline is the button's own ink, held back so the box frames the
    // reading without competing with the label beside it.
    opacity: 0.8,
  },
  gaugeLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginRight: -1.1,
  },
  gaugeValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
