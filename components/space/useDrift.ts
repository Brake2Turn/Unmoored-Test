import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Easing, cancelAnimation, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { EXPLOSION_MS } from '@/components/Explosion';
import { SUBSYSTEM_CAPACITY } from '@/lib/energy';
import type { Side } from '@/lib/run';

/**
 * How far a ship sways above or below its resting line in combat, per bar in
 * its Wren Drive, in points. No bars, no sway.
 */
const DRIFT_PER_BAR = 8;

/**
 * The furthest any ship sways: a full Wren Drive. The ships are sized with
 * this much room kept free above and below (`artScaleFor`), so a swaying
 * shield never runs into the controls or the name.
 */
export const DRIFT = DRIFT_PER_BAR * SUBSYSTEM_CAPACITY;

/**
 * How long one sway takes, from one height to the next: quicker with every
 * bar, so a hot Wren Drive jinks rather than bobs.
 */
const DRIFT_SLOW_MS = 2600;
const DRIFT_FASTER_PER_BAR_MS = 300;
const DRIFT_SPREAD_MS = 900;

/** How long the shooter takes to come level with its target before a shot. */
const ALIGN_MS = 320;

/** How long both hold that line after a shot: the bolt's flight and a beat. */
const HOLD_MS = 480;

/** Coming back to the resting line when the fight is over. */
const SETTLE_MS = 600;

export type Drift = {
  /** How far each ship is drawn above (−) or below (+) its resting line. */
  player: SharedValue<number>;
  foe: SharedValue<number>;
  /**
   * Brings `shooter` level with the other ship's centre, then calls `fire`
   * with the height they now share. Both hold that line until the bolt has
   * landed. Outside a fight nobody is drifting, so it fires at once, level at
   * the resting line.
   */
  lineUp: (shooter: Side, fire: (dy: number) => void) => void;
  /** Where a ship is, or is heading: its height as the rules know it. */
  offset: (side: Side) => number;
};

/**
 * The ships' sway in combat: each rises and falls on its own course, harder and
 * quicker the more is in its Wren Drive, and
 * before either fires, the shooter glides level with the other ship's centre
 * so the bolt flies straight across and lands in the middle of it.
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
  /** Bars in each ship's Wren Drive, which set how hard it sways. */
  wren: Record<Side, number>,
): Drift {
  const player = useSharedValue(0);
  const foe = useSharedValue(0);
  const values = { player, foe };

  // The height each ship is at or heading to.
  const target = useRef<Record<Side, number>>({ player: 0, foe: 0 });
  // While lined up for a shot: the shared height, when both reach it, and
  // until when they hold it.
  const line = useRef<{ dy: number; readyAt: number; holdUntil: number } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Read on every sway, so moving a bar mid-fight changes the next one.
  const wrenRef = useRef(wren);
  wrenRef.current = wren;

  const moveTo = useCallback(
    (side: Side, dy: number, duration: number) => {
      target.current[side] = dy;
      values[side].value = withTiming(dy, { duration, easing: Easing.inOut(Easing.sin) });
    },
    // The shared values are stable for the life of the screen.
    [],
  );

  // A new star starts both ships on the resting line, with no animation —
  // the old star's drift has nothing to do with this one.
  useEffect(() => {
    line.current = null;
    for (const side of ['player', 'foe'] as const) {
      cancelAnimation(values[side]);
      values[side].value = 0;
      target.current[side] = 0;
    }
  }, [position]);

  // The drift itself: each ship picks a new height on its own clock, pausing
  // while the two are lined up for a shot. When the fight ends they settle
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
      const bars = Math.max(0, Math.min(SUBSYSTEM_CAPACITY, wrenRef.current[side]));
      const reach = bars * DRIFT_PER_BAR;
      const from = target.current[side];
      let next = (Math.random() * 2 - 1) * reach;
      if (Math.abs(next - from) < reach * 0.5) next = from > 0 ? -Math.abs(next) : Math.abs(next);
      const duration = DRIFT_SLOW_MS - bars * DRIFT_FASTER_PER_BAR_MS + Math.random() * DRIFT_SPREAD_MS;
      moveTo(side, next, duration);
      timers.push(setTimeout(() => wander(side), duration));
    };
    // Out of step with each other from the start, so they never bob in time.
    timers.push(setTimeout(() => wander('player'), 150));
    timers.push(setTimeout(() => wander('foe'), 150 + DRIFT_SLOW_MS / 3));
    return () => timers.forEach(clearTimeout);
  }, [active, moveTo]);

  const lineUp = useCallback(
    (shooter: Side, fire: (dy: number) => void) => {
      if (!activeRef.current) {
        fire(target.current[shooter]);
        return;
      }
      const now = Date.now();
      const current = line.current;
      if (current && now < current.holdUntil) {
        // Already lined up, or on the way: fire along the same line.
        const wait = Math.max(0, current.readyAt - now);
        current.holdUntil = Math.max(current.holdUntil, now + wait + HOLD_MS);
        setTimeout(() => fire(current.dy), wait);
        return;
      }
      // The shooter comes to the target; the target finishes the move it was
      // making and stops there, so the line is where the target already is.
      const other: Side = shooter === 'player' ? 'foe' : 'player';
      const dy = target.current[other];
      moveTo(other, dy, ALIGN_MS);
      moveTo(shooter, dy, ALIGN_MS);
      line.current = { dy, readyAt: now + ALIGN_MS, holdUntil: now + ALIGN_MS + HOLD_MS };
      setTimeout(() => fire(dy), ALIGN_MS);
    },
    [moveTo],
  );

  const offset = useCallback((side: Side) => target.current[side], []);

  return useMemo(() => ({ player, foe, lineUp, offset }), [player, foe, lineUp, offset]);
}
