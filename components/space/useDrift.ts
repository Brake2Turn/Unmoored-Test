import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withTiming,
  type EasingFunction,
  type SharedValue,
} from 'react-native-reanimated';

import { EXPLOSION_MS } from '@/components/Explosion';
import type { Side } from '@/lib/run';

/**
 * How far a ship bobs above or below its resting line, in points, while there
 * is anything in its Wren Drive. One bar or four, it is the same gentle bob —
 * the bars show in the engine's brightness, not in the motion. No bars, and
 * the ship holds still. The ships are sized with at least this much room kept
 * above and below (`artScaleFor`).
 */
export const SWAY = 10;

/**
 * How long one bob takes, from one height to the next. The same for every
 * ship and every setting; the spread only keeps two ships out of step.
 */
const SWAY_MS = 2400;
const SWAY_SPREAD_MS = 800;

/**
 * A dodge: the target jinks out of a missing bolt's line and back. It starts
 * `DODGE_LEAD_MS` before the bolt leaves — the bolt crosses the whole screen
 * in a fifth of a second, far too quickly to get out of the way of otherwise —
 * is fully clear after `DODGE_MS`, holds while the bolt goes by, then glides
 * back to where it was.
 */
export const DODGE_LEAD_MS = 90;
const DODGE_MS = 170;
const DODGE_HOLD_MS = 220;
const DODGE_RETURN_MS = 380;

/**
 * How far a ship dodges to clear a bolt aimed at its middle. The player's, in
 * its own upright units: out past the shield's side (`SHIELD_RX` is 96), or
 * past the hull's widest pods with no shield up. The other ship's, as a share
 * of its drawn height, which is its upright width — past its wingtips. Both
 * plus a few points, so the bolt goes by with a visible gap.
 *
 * `artScaleFor` keeps this much room above and below a pair of ships, so a
 * dodge never runs into the controls or off the top of the screen.
 */
export const DODGE_SHIELD = 100;
export const DODGE_HULL = 74;
export const DODGE_FOE = 0.45;
export const DODGE_MARGIN = 6;

/** How long the shooter takes to come level with its target before a shot. */
const ALIGN_MS = 320;

/** How long both hold that line after a shot: the bolt's flight and a beat. */
const HOLD_MS = 480;

/** Coming back to the resting line when the swaying stops. */
const SETTLE_MS = 600;

export type Drift = {
  /** How far each ship is drawn above (−) or below (+) its resting line. */
  player: SharedValue<number>;
  foe: SharedValue<number>;
  /**
   * Brings `shooter` level with the part of the other ship it is aiming at —
   * `aim` points below (+) or above (−) that ship's centre — then calls
   * `fire` with where each now is: the shooter's height and the target's.
   * Both hold there until the bolt has landed.
   *
   * It waits its turn: a ship still dodging finishes the dodge first, and a
   * line already being held for another shot is let go first, so two shots
   * never pull the ships two ways at once.
   */
  lineUp: (shooter: Side, aim: number, fire: (shooterDy: number, targetDy: number) => void) => void;
  /**
   * Jinks `side` far enough that a bolt flying `line` points off its centre
   * misses it by `clear` — whichever way is the shorter trip from where it
   * is — and back again. Returns how long to wait before letting the bolt go.
   */
  dodge: (side: Side, clear: number, line: number) => number;
  /** Where a ship is, or is heading: its height as the rules know it. */
  offset: (side: Side) => number;
};

/**
 * The ships' sway: each rises and falls gently on its own course while its
 * Wren Drive has any power; before either fires, the shooter glides level
 * with the part of the other ship it is aiming at, so the bolt flies straight
 * across and lands on that part.
 *
 * **Heights are decided here, not read back off the screen.** Each ship's
 * next height is chosen in advance and kept in a ref; the animation only
 * carries the drawing there. So a shot is aimed from the height the ship is
 * known to be at once it has lined up — the same on a phone as in a browser,
 * where measuring a moving view is not the same on both. A line-up is timed
 * by a timer rather than by the animation ending, so a shot never waits on a
 * frame that is not drawn.
 */
export function useDrift(
  active: boolean,
  position: number | null,
  /** Bars in each ship's Wren Drive: any at all and it sways. */
  wren: Record<Side, number>,
): Drift {
  const player = useSharedValue(0);
  const foe = useSharedValue(0);
  const values = { player, foe };

  // The height each ship is at or heading to.
  const target = useRef<Record<Side, number>>({ player: 0, foe: 0 });
  // While lined up for a shot (or dodging one): until when both hold still.
  const line = useRef<{ holdUntil: number } | null>(null);
  // Until when each ship is busy dodging, and may not line up to fire.
  const busy = useRef<Record<Side, number>>({ player: 0, foe: 0 });
  const activeRef = useRef(active);
  activeRef.current = active;
  // Read on every sway, so emptying the Wren Drive stills the next one.
  const wrenRef = useRef(wren);
  wrenRef.current = wren;

  // Dodges' return trips and line-ups waiting their turn, all cancelled if
  // the ship leaves the star first.
  const dodgeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const moveTo = useCallback(
    (side: Side, dy: number, duration: number, easing: EasingFunction = Easing.inOut(Easing.sin)) => {
      target.current[side] = dy;
      values[side].value = withTiming(dy, { duration, easing });
    },
    // The shared values are stable for the life of the screen.
    [],
  );

  // A new star starts both ships on the resting line, with no animation —
  // the old star's drift has nothing to do with this one.
  useEffect(() => {
    line.current = null;
    busy.current = { player: 0, foe: 0 };
    dodgeTimers.current.forEach(clearTimeout);
    dodgeTimers.current = [];
    for (const side of ['player', 'foe'] as const) {
      cancelAnimation(values[side]);
      values[side].value = 0;
      target.current[side] = 0;
    }
  }, [position]);

  // The drift itself: each ship picks a new height on its own clock, pausing
  // while the two are lined up for a shot. When swaying stops they settle
  // back to the resting line — after an explosion has had its moment, since
  // a ship blowing up should blow up where it was.
  useEffect(() => {
    if (!active) {
      const settle = setTimeout(() => {
        line.current = null;
        moveTo('player', 0, SETTLE_MS);
        moveTo('foe', 0, SETTLE_MS);
      }, EXPLOSION_MS);
      return () => clearTimeout(settle);
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const wander = (side: Side) => {
      const held = line.current && Date.now() < line.current.holdUntil;
      if (held) {
        timers.push(setTimeout(() => wander(side), line.current!.holdUntil - Date.now() + 20));
        return;
      }
      line.current = null;
      // Somewhere else on its band, never just a twitch from where it is. A
      // ship with nothing in its Wren Drive has no band, and holds the line.
      const reach = wrenRef.current[side] > 0 ? SWAY : 0;
      const from = target.current[side];
      let next = (Math.random() * 2 - 1) * reach;
      if (Math.abs(next - from) < reach * 0.5) next = from > 0 ? -Math.abs(next) : Math.abs(next);
      const duration = SWAY_MS + Math.random() * SWAY_SPREAD_MS;
      moveTo(side, next, duration);
      timers.push(setTimeout(() => wander(side), duration));
    };
    // Out of step with each other from the start, so they never bob in time.
    timers.push(setTimeout(() => wander('player'), 150));
    timers.push(setTimeout(() => wander('foe'), 150 + SWAY_MS / 3));
    return () => timers.forEach(clearTimeout);
  }, [active, moveTo]);

  const lineUp = useCallback(
    (shooter: Side, aim: number, fire: (shooterDy: number, targetDy: number) => void) => {
      const other: Side = shooter === 'player' ? 'foe' : 'player';
      const go = () => {
        const now = Date.now();
        // A ship mid-dodge finishes it, and a line held for another shot is
        // let go, before this one starts: then try again.
        const clearAt = Math.max(busy.current.player, busy.current.foe, line.current?.holdUntil ?? 0);
        if (now < clearAt) {
          dodgeTimers.current.push(setTimeout(go, clearAt - now + 10));
          return;
        }
        // The target finishes the move it was making and stops there; the
        // shooter comes level with the part of it being aimed at.
        const targetDy = target.current[other];
        const shooterDy = targetDy + aim;
        moveTo(other, targetDy, ALIGN_MS);
        moveTo(shooter, shooterDy, ALIGN_MS);
        line.current = { holdUntil: now + ALIGN_MS + HOLD_MS };
        dodgeTimers.current.push(setTimeout(() => fire(shooterDy, targetDy), ALIGN_MS));
        // With nobody swaying (Reduce Motion, or the fight over), nothing
        // else will take them back to rest once the shot is done.
        dodgeTimers.current.push(
          setTimeout(() => {
            if (activeRef.current || Date.now() < (line.current?.holdUntil ?? 0)) return;
            moveTo('player', 0, SETTLE_MS);
            moveTo('foe', 0, SETTLE_MS);
          }, ALIGN_MS + HOLD_MS + 20),
        );
      };
      go();
    },
    [moveTo],
  );

  const dodge = useCallback(
    (side: Side, clear: number, lineAt: number) => {
      const from = target.current[side];
      // Out of the bolt's line either way — above it or below it — whichever
      // leaves the ship nearer its resting line, so a jink never takes it
      // much further from rest than `clear`.
      const up = lineAt - clear;
      const down = lineAt + clear;
      const step = Math.abs(from + up) <= Math.abs(from + down) ? up : down;
      const now = Date.now();
      moveTo(side, from + step, DODGE_MS, Easing.out(Easing.cubic));
      dodgeTimers.current.push(setTimeout(() => moveTo(side, from, DODGE_RETURN_MS), DODGE_MS + DODGE_HOLD_MS));
      // Nobody wanders off while this plays out, and this ship does not line
      // up a shot of its own until it is back.
      const until = now + DODGE_MS + DODGE_HOLD_MS + DODGE_RETURN_MS;
      busy.current[side] = until;
      line.current = { holdUntil: Math.max(line.current?.holdUntil ?? 0, until) };
      return DODGE_LEAD_MS;
    },
    [moveTo],
  );

  const offset = useCallback((side: Side) => target.current[side], []);

  return useMemo(() => ({ player, foe, lineUp, dodge, offset }), [player, foe, lineUp, dodge, offset]);
}
