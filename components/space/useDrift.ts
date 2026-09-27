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

/**
 * How long a ship caught mid-dodge takes to turn its nose onto the target,
 * and to turn back level once the shot has landed.
 */
const TURN_MS = 140;

/** Where both ships stand for a shot, as `lineUp` hands it over. */
export type Stance = {
  /** The shooter's height off its resting line. */
  shooterDy: number;
  /** The target's. */
  targetDy: number;
  /** The shooter is caught mid-dodge: it will turn to aim rather than move. */
  pinned: boolean;
};

/**
 * What the shooter does with its stance: the angle to turn its nose through
 * before firing (radians, clockwise on screen; 0 to fire straight), and the
 * bolt itself.
 */
export type Shot = { turn: number; launch: () => void };

export type Drift = {
  /** How far each ship is drawn above (−) or below (+) its resting line. */
  player: SharedValue<number>;
  foe: SharedValue<number>;
  /** How far each ship is turned off level, in degrees, clockwise. */
  playerTurn: SharedValue<number>;
  foeTurn: SharedValue<number>;
  /**
   * Gets `shooter` ready to hit the part of the other ship it is aiming at —
   * `aim` points below (+) or above (−) that ship's centre — then asks `plan`
   * for the shot and lets it go. Both hold still until the bolt has landed.
   *
   * A free shooter glides until level with that part and fires straight. A
   * shooter **caught mid-dodge fires anyway**: it finishes jinking out, stays
   * there instead of gliding back, and turns its nose onto the target
   * (`Shot.turn`), so the bolt flies at a slant; afterwards it turns level
   * and returns. A target caught mid-dodge is likewise held where it has
   * jinked to until the bolt lands. A line already held for another shot is
   * let go first, so two shots never pull the ships two ways at once.
   */
  lineUp: (shooter: Side, aim: number, plan: (stance: Stance) => Shot | null) => void;
  /**
   * Jinks `side` far enough that a bolt flying `line` points off its centre
   * misses it by `clear` — whichever way is the shorter trip from where it
   * is — and back again. Returns how long to wait before letting the bolt go.
   */
  dodge: (side: Side, clear: number, line: number) => number;
  /** Where a ship is, or is heading: its height as the rules know it. */
  offset: (side: Side) => number;
};

/** A dodge in progress: where it came from and went to, and its timings. */
type Jink = {
  from: number;
  to: number;
  /** When it is fully out, and when it will be back. */
  outAt: number;
  backAt: number;
  /** Held out for a shot: its return waits for that shot to land. */
  pinned: boolean;
  /** Already on its way back: a free ship again, as far as aiming goes. */
  returning: boolean;
  timers: ReturnType<typeof setTimeout>[];
};

/**
 * The ships' sway: each rises and falls gently on its own course while its
 * Wren Drive has any power; before either fires, the shooter glides level
 * with the part of the other ship it is aiming at, so the bolt flies straight
 * across and lands on that part — or, caught mid-dodge, turns to aim at it.
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
  const playerTurn = useSharedValue(0);
  const foeTurn = useSharedValue(0);
  const values = { player, foe };
  const turns = { player: playerTurn, foe: foeTurn };

  // The height each ship is at or heading to.
  const target = useRef<Record<Side, number>>({ player: 0, foe: 0 });
  // While lined up for a shot: until when both hold still.
  const line = useRef<{ holdUntil: number } | null>(null);
  // Each ship's dodge in progress, if any.
  const jinks = useRef<Record<Side, Jink | null>>({ player: null, foe: null });
  const activeRef = useRef(active);
  activeRef.current = active;
  // Read on every sway, so emptying the Wren Drive stills the next one.
  const wrenRef = useRef(wren);
  wrenRef.current = wren;

  // Line-ups waiting their turn and shots on their way, all cancelled if the
  // ship leaves the star first.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, Math.max(0, ms)));
  };

  const moveTo = useCallback(
    (side: Side, dy: number, duration: number, easing: EasingFunction = Easing.inOut(Easing.sin)) => {
      target.current[side] = dy;
      values[side].value = withTiming(dy, { duration, easing });
    },
    // The shared values are stable for the life of the screen.
    [],
  );

  const turnTo = useCallback((side: Side, radians: number) => {
    turns[side].value = withTiming((radians * 180) / Math.PI, { duration: TURN_MS, easing: Easing.out(Easing.quad) });
  }, []);

  /** Ends a dodge: back to where it came from, and forgotten once there. */
  const release = useCallback(
    (side: Side, jink: Jink) => {
      if (jinks.current[side] !== jink) return;
      jink.returning = true;
      moveTo(side, jink.from, DODGE_RETURN_MS);
      jink.backAt = Date.now() + DODGE_RETURN_MS;
      jink.timers.push(
        setTimeout(() => {
          if (jinks.current[side] === jink) jinks.current[side] = null;
        }, DODGE_RETURN_MS),
      );
    },
    [moveTo],
  );

  // A new star starts both ships on the resting line, level, with no
  // animation — the old star's drift has nothing to do with this one.
  useEffect(() => {
    line.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const side of ['player', 'foe'] as const) {
      jinks.current[side]?.timers.forEach(clearTimeout);
      jinks.current[side] = null;
      cancelAnimation(values[side]);
      cancelAnimation(turns[side]);
      values[side].value = 0;
      turns[side].value = 0;
      target.current[side] = 0;
    }
  }, [position]);

  // The drift itself: each ship picks a new height on its own clock, pausing
  // while the two are lined up for a shot or it is dodging. When swaying
  // stops they settle back to the resting line — after an explosion has had
  // its moment, since a ship blowing up should blow up where it was.
  useEffect(() => {
    if (!active) {
      const settle = setTimeout(() => {
        line.current = null;
        moveTo('player', 0, SETTLE_MS);
        moveTo('foe', 0, SETTLE_MS);
      }, EXPLOSION_MS);
      return () => clearTimeout(settle);
    }

    const own: ReturnType<typeof setTimeout>[] = [];
    const wander = (side: Side) => {
      const now = Date.now();
      const until = Math.max(line.current?.holdUntil ?? 0, jinks.current[side] ? now + 200 : 0);
      if (now < until) {
        own.push(setTimeout(() => wander(side), until - now + 20));
        return;
      }
      // Somewhere else on its band, never just a twitch from where it is. A
      // ship with nothing in its Wren Drive has no band, and holds the line.
      const reach = wrenRef.current[side] > 0 ? SWAY : 0;
      const from = target.current[side];
      let next = (Math.random() * 2 - 1) * reach;
      if (Math.abs(next - from) < reach * 0.5) next = from > 0 ? -Math.abs(next) : Math.abs(next);
      const duration = SWAY_MS + Math.random() * SWAY_SPREAD_MS;
      moveTo(side, next, duration);
      own.push(setTimeout(() => wander(side), duration));
    };
    // Out of step with each other from the start, so they never bob in time.
    own.push(setTimeout(() => wander('player'), 150));
    own.push(setTimeout(() => wander('foe'), 150 + SWAY_MS / 3));
    return () => own.forEach(clearTimeout);
  }, [active, moveTo]);

  const lineUp = useCallback(
    (shooter: Side, aim: number, plan: (stance: Stance) => Shot | null) => {
      const other: Side = shooter === 'player' ? 'foe' : 'player';
      const go = () => {
        const now = Date.now();
        // A line held for another shot is let go first; a ship still jinking
        // out finishes that — a fifth of a second at most — before anything
        // is decided about where it is.
        const outAt = Math.max(jinks.current.player?.outAt ?? 0, jinks.current.foe?.outAt ?? 0);
        const clearAt = Math.max(line.current?.holdUntil ?? 0, outAt);
        if (now < clearAt) {
          later(go, clearAt - now + 10);
          return;
        }
        // Anyone mid-dodge stays where it has jinked to until this shot lands.
        const pinned: Side[] = [];
        for (const side of [shooter, other]) {
          const jink = jinks.current[side];
          // One already heading home counts as free: it is simply steered
          // to the new line from wherever it has got to.
          if (!jink || jink.returning) continue;
          jink.timers.forEach(clearTimeout);
          jink.timers = [];
          jink.pinned = true;
          pinned.push(side);
        }
        const shooterPinned = pinned.includes(shooter);
        const targetDy = target.current[other];
        const shooterDy = shooterPinned ? target.current[shooter] : targetDy + aim;
        let settleIn = 0;
        if (!shooterPinned) {
          // Free: glide level with the part aimed at; the target stops where
          // it is going.
          moveTo(other, targetDy, ALIGN_MS);
          moveTo(shooter, shooterDy, ALIGN_MS);
          settleIn = ALIGN_MS;
        }
        line.current = { holdUntil: now + settleIn + TURN_MS + HOLD_MS };
        later(() => {
          const shot = plan({ shooterDy, targetDy, pinned: shooterPinned });
          if (!shot) return;
          // Caught mid-dodge: turn the nose onto the target, then fire.
          const turning = Math.abs(shot.turn) > 0.002;
          if (turning) turnTo(shooter, shot.turn);
          later(shot.launch, turning ? TURN_MS : 0);
          line.current = { holdUntil: Date.now() + (turning ? TURN_MS : 0) + HOLD_MS };
          later(() => {
            if (turning) turnTo(shooter, 0);
            // The dodges held for this shot can go home now — unless one has
            // been dodged again since, which has its own way back.
            for (const side of pinned) {
              const jink = jinks.current[side];
              if (jink && jink.pinned) release(side, jink);
            }
            // With nobody swaying (Reduce Motion, or the fight over), nothing
            // else will take them back to rest once the shot is done.
            later(() => {
              if (activeRef.current || Date.now() < (line.current?.holdUntil ?? 0)) return;
              if (jinks.current.player || jinks.current.foe) return;
              moveTo('player', 0, SETTLE_MS);
              moveTo('foe', 0, SETTLE_MS);
            }, DODGE_RETURN_MS + 20);
          }, (turning ? TURN_MS : 0) + HOLD_MS);
        }, settleIn);
      };
      go();
    },
    [moveTo, release, turnTo],
  );

  const dodge = useCallback(
    (side: Side, clear: number, lineAt: number) => {
      const was = jinks.current[side];
      was?.timers.forEach(clearTimeout);
      // Home is where it was before any dodge, not where the last one left it.
      const from = was ? was.from : target.current[side];
      const at = target.current[side];
      // Out of the bolt's line either way — above it or below it — whichever
      // leaves the ship nearer its resting line, so a jink never takes it
      // much further from rest than `clear`.
      const up = lineAt - clear;
      const down = lineAt + clear;
      const step = Math.abs(at + up) <= Math.abs(at + down) ? up : down;
      const now = Date.now();
      const jink: Jink = {
        from,
        to: at + step,
        outAt: now + DODGE_MS,
        backAt: now + DODGE_MS + DODGE_HOLD_MS + DODGE_RETURN_MS,
        pinned: false,
        returning: false,
        timers: [],
      };
      jinks.current[side] = jink;
      moveTo(side, jink.to, DODGE_MS, Easing.out(Easing.cubic));
      jink.timers.push(setTimeout(() => release(side, jink), DODGE_MS + DODGE_HOLD_MS));
      return DODGE_LEAD_MS;
    },
    [moveTo, release],
  );

  const offset = useCallback((side: Side) => target.current[side], []);

  return useMemo(
    () => ({ player, foe, playerTurn, foeTurn, lineUp, dodge, offset }),
    [player, foe, playerTurn, foeTurn, lineUp, dodge, offset],
  );
}
