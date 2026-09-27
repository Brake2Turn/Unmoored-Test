import { FOE_STATUS_HEIGHT } from '@/components/FoeStatus';
import { REACTOR_PANEL_HEIGHT } from '@/components/ReactorPanel';
import { STATUS_BAR_HEIGHT } from '@/components/StatusBar';
import { SYSTEMS_SPAN } from '@/components/ships/ShipSystems';
import { DODGE_FOE, DODGE_MARGIN, DODGE_SHIELD, SWAY } from '@/components/space/useDrift';

/**
 * The space screen's measurements, in one place, because several of its
 * pieces have to agree on them: the controls are laid out with them, and the
 * ships are sized from whatever room they leave.
 */

/** The player's ship at full size, before the screen decides it has no room. */
export const SHIP_WIDTH = 132;
export const SHIP_HEIGHT = 172;

/**
 * What the ship actually occupies once its shield and exhaust are drawn.
 *
 * The budget below has to reserve the whole systems box, not just the hull,
 * or a wide shield would run into whatever is waiting beside it.
 */
const SHIP_SLOT_HEIGHT = SHIP_HEIGHT * SYSTEMS_SPAN;

/** Space between the stacked pieces of the screen. */
export const STACK_GAP = 16;

/**
 * The row under the reactor panel — FIRE, the SHIP square and JUMP — is this
 * tall: compact controls rather than menu rows, but still the tallest things
 * a thumb needs to find.
 */
export const JUMP_HEIGHT = 52;

/** Between the reactor panel and the buttons under it, and between buttons. */
export const CONTROL_GAP = 10;

/**
 * What the screen holds back above the topmost art and below the jump button.
 *
 * Both used to be larger, and the slack came out of the middle — the one part
 * of this screen worth giving room to, since the ship and whatever is waiting
 * for it are the only things on it. The top only has to clear LEAVE and the
 * mode badge, a single line of ten-point type; the bottom only has to keep the
 * jump button off the edge of the phone, on top of whatever safe area the
 * hardware already asks for.
 *
 * They are named because two places need to agree on them: the padding that
 * positions the stack, and the budget that sizes the art inside it. When they
 * were written out twice, changing one silently mis-scaled the ships.
 */
export const HUD_TOP = 44;
export const HUD_BOTTOM = 20;

/** FIRE sits left of JUMP on the bottom row, this wide. */
export const FIRE_WIDTH = 84;

/** The SHIP square between FIRE and JUMP. */
export const SHIP_BUTTON_WIDTH = 52;

/** The dev buttons start a line below the mode badge, top right. */
export const DEV_ROW_TOP = 30;

/** How wide the other ship's name may run before it wraps. */
export const FOE_STATUS_WIDTH = 150;

/** Kept clear at each side of the ships, and between the two of them. */
export const ARENA_MARGIN = 12;
export const ARENA_GAP = 36;

/** How much smaller both ships are drawn when there are two of them. */
const PAIR_SHRINK = 0.84;

/** The bottom of the screen: the reactor panel, with the row of buttons under it. */
export const CONTROL_ROW_HEIGHT = REACTOR_PANEL_HEIGHT + CONTROL_GAP + JUMP_HEIGHT;

/**
 * How big to draw the ships, as a share of their full size.
 *
 * The two lie on their sides, side by side: the player on the left facing
 * right, whatever is waiting on the right facing left. Alone, the player sits
 * in the middle. Both are scaled together from whichever runs out first — the
 * width they share, or the height the controls leave. Laid on its side a
 * ship's length runs across the screen, so it is the width that usually
 * decides; the Elder Shrike beside the player's shield is the widest pair.
 */
export function artScaleFor({
  width,
  height,
  insetTop,
  insetBottom,
  other,
}: {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** The other ship's drawn size, or null when the player is alone. */
  other: { width: number; height: number } | null;
}): number {
  const chrome =
    insetTop + HUD_TOP + insetBottom + HUD_BOTTOM + STATUS_BAR_HEIGHT + CONTROL_ROW_HEIGHT + STACK_GAP * 3;
  const room = height - chrome;
  const across = width - ARENA_MARGIN * 2 - (other ? ARENA_GAP : 0);
  // Down: the taller of the player's turned box and the other ship with its
  // name above it.
  const tall = Math.max(SHIP_WIDTH * SYSTEMS_SPAN, (other?.width ?? 0) + FOE_STATUS_HEIGHT / 0.8);
  // Room is kept above and below for the ships to move into. Alone, that is
  // only the gentle sway. With another ship here a fight may start, and a
  // dodge moves a ship its own half-width out of a bolt's way — which grows
  // with the ships, so it is solved for together with them: a ship `s` of full
  // size needs `tall·s` plus `dodge·s + margin` above and below.
  const dodge = other ? Math.max(DODGE_SHIELD * (SHIP_WIDTH / 200), DODGE_FOE * other.width) : 0;
  const down = other ? (room - DODGE_MARGIN * 2) / (tall + dodge * 2) : (room - SWAY * 2) / tall;
  return Math.max(
    0.4,
    // Two ships share the screen a size down from what would just fit, so
    // there is clear space between them rather than shield touching wing.
    (other ? PAIR_SHRINK : 1) *
      Math.min(
        1,
        // Across: the player's turned systems box plus the other ship's length.
        across / (SHIP_SLOT_HEIGHT + (other?.height ?? 0)),
        down,
      ),
  );
}
