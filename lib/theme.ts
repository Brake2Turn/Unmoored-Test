import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Central palette and type scale. Every colour and font in the app comes from
 * here so the look can be retuned in one place.
 */
export const palette = {
  /** Bottom of the background gradient — the deep, empty dark. */
  void: '#05070F',
  /** Top of the background gradient — a slightly lifted midnight blue. */
  horizon: '#0A1024',

  nebulaViolet: '#6145A9',
  nebulaTeal: '#1E768C',

  star: '#E8EEFF',
  starWarm: '#FFE2C8',
  starCool: '#BADBFF',

  accent: '#5FD9E8',
  accentDim: '#387E8A',

  /** Hostile red — enemy ships, the boss star, anything that means trouble. */
  danger: '#FF5D6B',

  /** Merchant gold — someone willing to trade rather than shoot. */
  trade: '#E8C15F',

  textPrimary: '#DCE6FF',
  textMuted: '#7A87A8',
  textDisabled: '#525C75',

  planetLight: '#3E3460',
  planetDark: '#100E21',
} as const;

/**
 * iOS gets Avenir Next, which is what the design was drawn in. Android and web
 * fall back to their own condensed faces. Swap in a custom font later by
 * loading it with `expo-font` and changing these two values.
 */
export const fonts = {
  display: Platform.select({
    ios: 'AvenirNextCondensed-Bold',
    android: 'sans-serif-condensed',
    default: 'system-ui',
  }) as string,
  body: Platform.select({
    ios: 'AvenirNext-Medium',
    android: 'sans-serif',
    default: 'system-ui',
  }) as string,
  bodyBold: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'system-ui',
  }) as string,
};

/** Space games live or die on generous letter spacing. */
export const tracking = {
  display: 14,
  label: 4,
  caption: 2.5,
} as const;

export const layout = {
  buttonWidth: 300,
  buttonHeight: 64,
  buttonSpacing: 16,
  buttonRadius: 14,
  screenMargin: 24,
  /** Gap between the lowest button and the bottom safe area. */
  menuBottomOffset: 96,
} as const;

/**
 * Width of a full-bleed menu button on this screen.
 *
 * Every screen that shows a MenuButton had its own copy of this clamp, which
 * meant four places to change the gutter rule and four chances to miss one.
 */
export function useMenuWidth(): number {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );
}

/** Title size for the wordmark, which scales with the screen but has bounds. */
export function titleSizeFor(width: number): number {
  return Math.min(Math.max(width * 0.155, 40), 72);
}
