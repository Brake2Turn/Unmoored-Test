import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type RefObject } from 'react';

import type { RunState } from '@/lib/run';
import { loadRun, saveRun } from '@/lib/runStore';
import { useHaptics } from '@/lib/settings';

export type LiveRun = {
  /** The run as last drawn — for drawing, and for nothing else. */
  run: RunState | null;
  /**
   * The run as it is right now, for the clocks, the bolts and the buttons.
   *
   * Updated the moment a change is made, not when React next draws. Two
   * timers can fire back to back before a redraw — a bolt landing on the same
   * beat as a clock tick — and the second used to start from the run as it
   * was before the first, so its update quietly undid the other: a hit that
   * landed and did not count. So every change goes through `commit`, and
   * everything that changes the run starts from here, never from `run`.
   */
  runRef: RefObject<RunState | null>;
  /** Makes `next` the run: at once in `runRef`, then on screen, then on disk. */
  commit: (next: RunState | null, save?: boolean) => void;
  /**
   * One change the player asked for, made through a rule that hands the run
   * back unchanged when it is not allowed — so a press on a greyed-out control
   * costs nothing: no write, no buzz, no redraw.
   */
  apply: (rule: (current: RunState) => RunState) => void;
  /** Whether the space screen is the one in front. */
  focused: boolean;
};

/**
 * The run the space screen is playing, kept live.
 *
 * Re-read on focus, so returning from a jump shows the new position, and
 * written back on the way out, so the clocks do not rewind. `focused` is what
 * stops the clocks while another screen is on top: this one stays mounted
 * underneath star select and the encounter tester, and a clock still ticking
 * here would keep saving its own copy of the run over whatever those screens
 * wrote — a jump, or a staged encounter, undone seconds later.
 */
export function useLiveRun(): LiveRun {
  const haptics = useHaptics();
  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  const [focused, setFocused] = useState(false);

  const commit = useCallback((next: RunState | null, save = true) => {
    runRef.current = next;
    setRun(next);
    if (save && next) void saveRun(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setFocused(true);
      loadRun().then((value) => {
        if (!cancelled && value) commit(value, false);
      });
      return () => {
        cancelled = true;
        setFocused(false);
        if (runRef.current) void saveRun(runRef.current);
      };
    }, [commit]),
  );

  const apply = useCallback(
    (rule: (current: RunState) => RunState) => {
      const current = runRef.current;
      if (!current) return;
      const next = rule(current);
      if (next === current) return;
      commit(next);
      haptics.tap();
    },
    [commit, haptics],
  );

  return { run, runRef, commit, apply, focused };
}
