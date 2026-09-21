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
   * A gauge in a section of its own at the right end of the button. The helm's
   * fuel lives here rather than in a strip of its own: it is only ever
   * consulted when deciding whether to jump.
   *
   * It takes the name and the reading apart rather than one string, so the
   * word can be set small and tracked against a large figure — `F 10` fitted
   * a corner but had to be learned before it said anything.
   */
  gauge?: { label: string; value: string };
};

/**
 * How much of the button's width the gauge takes.
 *
 * It is a fixed number because the fill has to stop exactly where the gauge
 * starts: the section is cut out of the button rather than laid on top of it,
 * so the sky shows through and the reading can be drawn in the accent instead
 * of in the button's own dark ink.
 */
const GAUGE_W = 56;

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

  /** Everything that is *not* the gauge stops here. */
  const gaugeWidth = gauge ? GAUGE_W : 0;

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
      accessibilityLabel={
        [label, caption, gauge && `${gauge.label} ${gauge.value}`].filter(Boolean).join('. ')
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
          height,
          borderRadius: layout.buttonRadius,
          borderColor: scheme.border,
          opacity: disabled ? 0.55 : 1,
        },
        animatedStyle,
      ]}
    >
      {/* The fill is a layer rather than the button's own background, so it
          can stop short of the gauge and leave that section unpainted. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { right: gaugeWidth, backgroundColor: scheme.fill }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { right: gaugeWidth, backgroundColor: palette.accent },
          bloomStyle,
        ]}
      />

      {gauge ? (
        <View
          pointerEvents="none"
          style={[styles.gauge, { width: GAUGE_W, borderLeftColor: scheme.border }]}
        >
          <Text style={styles.gaugeLabel}>{gauge.label}</Text>
          <Text style={styles.gaugeValue}>{gauge.value}</Text>
        </View>
      ) : null}

      <View pointerEvents="none" style={[styles.stack, { right: gaugeWidth }]}>
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
  /** Centred in what the gauge leaves, not in the whole button. */
  stack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
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
  /**
   * Its own section, the full height of the button and divided off by a rule
   * rather than boxed inside one. Nothing paints behind it, so what shows is
   * the sky — which is what lets the reading be drawn in the accent rather
   * than in the dark ink the label needs against a filled button.
   */
  gauge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1.2,
  },
  gaugeLabel: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    color: palette.accent,
    letterSpacing: 1.1,
    marginRight: -1.1,
  },
  gaugeValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: palette.accent,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
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
