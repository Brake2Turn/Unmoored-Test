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

  /**
   * Everything that is the player's own: every edge and light on the hull, the
   * card it sits in, the range it can reach, the routes out of here and the
   * star it is standing on.
   *
   * One colour for all of it on purpose. The six hulls used to carry a tint
   * each, which read as a property of the ship — as though the orange one were
   * the fast one — when nothing about a ship varies by colour. They differ in
   * silhouette, cargo and reactor, and those are the things worth looking at.
   * White also keeps the player distinct from the two things on screen that
   * *are* colour-coded and mean something by it: a red boss star and whatever
   * is waiting at a star.
   */
  player: '#FFFFFF',

  /**
   * The sector map's display, a shade lifted off the void around it.
   *
   * The map is the one screen the player is meant to read as an instrument
   * rather than as a window — a chart on a console, not open space — and the
   * difference between the glass and the housing is what sells it.
   */
  chartPanel: '#070D17',

  star: '#E8EEFF',
  starWarm: '#FFE2C8',
  starCool: '#BADBFF',

  accent: '#5FD9E8',
  accentDim: '#387E8A',

  /** Hostile red — enemy ships, the boss star, anything that means trouble. */
  danger: '#FF5D6B',

  /** Merchant gold — someone willing to trade rather than shoot. */
  trade: '#E8C15F',

  /**
   * Reactor energy nothing has claimed.
   *
   * The reactor's green: vivid, as saturated as the three subsystem colours
   * beside it, the author's choice. It was a pale pastel green, yellow before
   * that, and cyan before that; cyan was the shields row's colour, so the one
   * number that means "unspent" looked like another system reporting in.
   * Green is no subsystem's.
   */
  power: '#3FE07A',

  /**
   * The three reactor subsystems, each its own tint so a glance at the helm
   * panel says which row is which without reading the labels. These carry
   * beyond the panel: the shield bubble and the exhaust are drawn in them.
   */
  shields: '#5FD9E8',
  weapons: '#FF4A4A',
  engines: '#FF9A3C',

  textPrimary: '#DCE6FF',
  textMuted: '#7A87A8',
  textDisabled: '#525C75',

  planetLight: '#3E3460',
  planetDark: '#100E21',
  /** Sunlit highlands on the planet, and the bloom on its lit limb. */
  planetHighlight: '#6E5EA6',
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
  /** Every panel that opens over the helm is this wide. */
  panelWidth: 252,
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

/**
 * Advance width of one capital in the display face, as a fraction of the font
 * size. Measured in a browser rather than estimated — capitals are far wider
 * than a mixed-case guess suggests (0.83, not the 0.62 that first clipped the
 * wordmark to "NMOORE").
 *
 * iOS and Android resolve a genuinely condensed face, so they need less room;
 * the web fallback is not condensed at all.
 *
 * **Only the web number has actually been measured.** 0.83 was read off a
 * browser; 0.66 and 0.78 are reasoned from the condensed faces those platforms
 * resolve, and no one has yet seen the wordmark on a phone. The game is played
 * through a web build, so nothing has ever exercised them. If either is too
 * small the title overruns its margins, and if it is too large the title is
 * needlessly shrunk — neither crashes, so it will not announce itself. Measure
 * on a device the first time one is in hand, and delete this paragraph.
 */
const DISPLAY_ADVANCE = Platform.select({ ios: 0.66, android: 0.78, default: 0.83 }) as number;

/**
 * Size for the wordmark: it scales with the screen, but never past what
 * actually fits once `tracking.display` between each glyph is counted.
 */
export function titleSizeFor(width: number, word = 'UNMOORED'): number {
  const available = width - layout.screenMargin * 2;
  const trackingTotal = tracking.display * (word.length - 1);
  const fits = (available - trackingTotal) / (word.length * DISPLAY_ADVANCE);
  return Math.min(Math.max(Math.min(width * 0.155, fits), 28), 72);
}

/**
 * The colour of a hull line — the player's and any other ship's alike — for
 * how much of it is left, 0 to 1: white while it is at least half, a soft
 * yellow below half, and red below a quarter. One rule, so the two lines on
 * screen can never disagree about what "badly damaged" looks like.
 */
export function hullColor(fraction: number): string {
  if (fraction < 0.25) return palette.danger;
  if (fraction < 0.5) return '#F4D774';
  return '#FFFFFF';
}
