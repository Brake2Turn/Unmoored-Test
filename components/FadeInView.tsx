import React, { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** When false the content is simply shown, with no fade. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Grace period before the fallback declares the fade over. */
const SETTLE_BUFFER = 250;

/**
 * Fades its children in on mount, and guarantees they end up visible.
 *
 * Content must never be hostage to an animation. Two things can strand an
 * opacity-0 view: Reanimated's `entering` prop does not run on React Native
 * Web for a view mounted after navigation, and any animation stalls where
 * requestAnimationFrame is throttled. Either one left the player's ship
 * invisible on the helm.
 *
 * So the fade runs, but a timer independently switches to a plain opacity of 1
 * once it should have finished. If the animation played, that switch is
 * invisible; if it never started, the content appears anyway.
 */
export function FadeInView({ children, delay = 0, duration = 500, enabled = true, style }: Props) {
  const opacity = useSharedValue(enabled ? 0 : 1);
  const [settled, setSettled] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setSettled(true);
      return;
    }

    opacity.value = withDelay(delay, withTiming(1, { duration }));
    const timer = setTimeout(() => setSettled(true), delay + duration + SETTLE_BUFFER);
    return () => clearTimeout(timer);
  }, [delay, duration, enabled, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[style, settled ? FULLY_VISIBLE : animated]}>{children}</Animated.View>;
}

const FULLY_VISIBLE: ViewStyle = { opacity: 1 };
