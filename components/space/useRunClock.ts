import { useEffect } from 'react';

import type { LiveRun } from '@/components/space/useLiveRun';
import { WEAPON_UNITS, chargeRate } from '@/lib/energy';
import { chargeFractions, foeArmed, tickRun } from '@/lib/run';
import { saveRun } from '@/lib/runStore';

/**
 * How often the clock advances the charges: the drive, the weapons, the
 * shield and the other ship's gun.
 *
 * Four times a second is smooth enough for a filling bar without writing to
 * storage on every frame — the save is throttled separately below.
 */
const TICK_MS = 250;
const SAVE_EVERY_TICKS = 8;

/**
 * The run's clock. The space screen is the only screen that sits still, so it
 * is the only one that runs it, and only while it is in front.
 *
 * The interval is rebuilt only when there is something new to count, not on
 * every tick: each charge is worth ticking only while it has somewhere to go
 * and the power to get there — a row with nothing in it does not creep along.
 */
export function useRunClock({ run, runRef, commit, focused }: LiveRun): void {
  const charge = run ? chargeFractions(run) : { jump: 0, weapon: 0 };
  const driveBuilding = !!run && charge.jump < 1 && chargeRate(run.energy.engines) > 0;
  const weaponBuilding = !!run && charge.weapon < 1 && chargeRate(run.energy.weapons) > 0;
  const shieldBuilding = !!run && run.shieldCharge < run.energy.shields;
  const foeBuilding = !!run && foeArmed(run) && run.foeCharge < WEAPON_UNITS;

  useEffect(() => {
    if (!focused) return;
    if (!driveBuilding && !weaponBuilding && !shieldBuilding && !foeBuilding) return;

    let ticks = 0;
    const timer = setInterval(() => {
      const current = runRef.current;
      if (!current) return;

      const next = tickRun(current, TICK_MS / 1000);
      if (next === current) return;

      ticks += 1;
      // Persisted every few ticks rather than four times a second.
      commit(next, ticks % SAVE_EVERY_TICKS === 0);
    }, TICK_MS);

    // The last tick of a clock is the one worth keeping, so write on the way
    // out as well as periodically.
    return () => {
      clearInterval(timer);
      if (runRef.current) void saveRun(runRef.current);
    };
  }, [commit, driveBuilding, focused, foeBuilding, runRef, shieldBuilding, weaponBuilding]);
}
