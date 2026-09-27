import { useSyncExternalStore } from 'react';

/**
 * Dev mode's combat demos, started from the encounter tester and played on
 * the space screen. Screen-side only — nothing here is a rule, and nothing is
 * saved: a demo lasts until the ship leaves its star or it is stopped.
 *
 * **Dodge and fire** stages the moment the author wanted to watch: the other
 * ship fires and always misses, the player's ship dodges, and while it is
 * still jinked out of the way its own weapon fires back — so it has to turn
 * its nose to aim. Round after round, a few seconds apart, with the other
 * ship patched up each time so the demo never runs out.
 *
 * `slow` stretches every part of it that moves — the line-up, the dodge, the
 * turn, the bolt's flight — by `SLOW_FACTOR`, since the real thing is over
 * in about half a second.
 */
export type Demo = { kind: 'dodge-fire'; node: number; slow: boolean };

/** How much slower the slow-motion demo runs. */
export const SLOW_FACTOR = 4;

let current: Demo | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function startDemo(demo: Demo) {
  current = demo;
  emit();
}

export function stopDemo() {
  if (!current) return;
  current = null;
  emit();
}

/** The demo running now, if any, read outside React. */
export function demoNow(): Demo | null {
  return current;
}

/** The demo running now, if any, for a component to follow. */
export function useDemo(): Demo | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}

/**
 * A duration as the combat's motion should play it: itself, or stretched
 * while a slow-motion demo is running. Everything that moves in a shot —
 * `useDrift`'s line-up, dodge and turn, `LaserShot`'s flight — goes through
 * this, so they stay in step with each other at any speed.
 */
export function paced(ms: number): number {
  return current?.slow ? ms * SLOW_FACTOR : ms;
}
