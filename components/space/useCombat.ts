import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';

import { EXPLOSION_MS } from '@/components/Explosion';
import { FLIGHT_MS, type Point } from '@/components/LaserShot';
import { WEAPON_UNITS, shieldLevel } from '@/lib/energy';
import { MOUNTS } from '@/components/ships/ShipArt';
import { SYSTEMS_SPAN } from '@/components/ships/ShipSystems';
import { foeMuzzle } from '@/components/ships/EncounterShip';
import { sidewaysPoint } from '@/components/ships/Sideways';
import { DODGE_FOE, DODGE_HULL, DODGE_MARGIN, DODGE_SHIELD, type Drift } from '@/components/space/useDrift';
import type { LiveRun } from '@/components/space/useLiveRun';
import { weaponTip } from '@/components/WeaponArt';
import {
  fireWeapon,
  foeArmed,
  foeDestroyed,
  foeFires,
  foeHull,
  hitFoe,
  pendingMeeting,
  shotMisses,
  takeHit,
} from '@/lib/run';
import { encounterAt } from '@/lib/sectorMap';
import { useHaptics } from '@/lib/settings';

/** One bolt in flight: where from, where to, and the star it was fired at. */
export type Shot = {
  id: number;
  /** Who fired it, which decides what its arrival does. */
  by: 'player' | 'foe';
  node: number;
  from: Point;
  to: Point;
  hits: boolean;
};

/** One explosion on screen: where, and how big the ship was. */
export type Blast = { id: number; at: Point; size: number };

/** A MISS pop-up, over the ship a bolt just went past. */
export type Miss = { id: number; at: Point };

/** How long a MISS stays up. */
export const MISS_MS = 900;

/**
 * When a bolt flying from `from` to `to` in one flight passes `x`: how far
 * into its flight, for the MISS pop-up.
 */
function passesAt(from: Point, to: Point, x: number): number {
  return FLIGHT_MS * Math.max(0, Math.min(1, Math.abs((x - from.x) / (to.x - from.x || 1))));
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Everything that happens between the two ships: the player's shots, the
 * other ship's, the hits they land, and the explosions when a hull runs out.
 *
 * **The rule and the picture are two steps.** The rules (`fireWeapon`,
 * `foeFires`) only spend a charge; the bolt is then aimed on screen, and the
 * hit is taken when it arrives (`onImpact`), which `LaserShot` calls on a
 * timer so a hit never waits on a frame that may not be drawn. Each shot
 * carries the star it was fired at, so a bolt still flying when the ship
 * jumps lands on nothing rather than on the next star's ship.
 *
 * The screen hands the three views to measure — itself, the player's ship and
 * the other one — through the refs this returns.
 */
export function useCombat({ run, runRef, commit }: LiveRun, drift: Drift, width: number) {
  const haptics = useHaptics();
  const rootRef = useRef<View>(null);
  const shipRef = useRef<View>(null);
  const foeRef = useRef<View>(null);

  // Bolts in flight, and ships blowing apart, the player's or the other one's.
  const [shots, setShots] = useState<Shot[]>([]);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  // The player's ship is gone and the Game Over box is up.
  const [over, setOver] = useState(false);
  // The star whose destroyed ship has finished exploding, so the layout can
  // let it go and the player's ship can take the middle.
  const [cleared, setCleared] = useState<number | null>(null);

  /**
   * A view's box relative to the screen, which is what the shots and the
   * explosions are positioned against.
   *
   * Measuring against the browser window and drawing against the screen only
   * agrees while the two share a top-left corner. Where they did not — the
   * page shifted inside whatever is showing it — a bolt started away from the
   * gun. Measuring the screen too and taking the difference makes that offset
   * cancel out, whatever caused it.
   */
  /** Puts MISS up over a ship as the bolt goes by, and takes it down again. */
  const showMiss = useCallback((at: Point, after: number) => {
    const id = Date.now() + Math.random();
    setTimeout(() => {
      setMisses((current) => [...current, { id, at }]);
      setTimeout(() => setMisses((current) => current.filter((m) => m.id !== id)), MISS_MS);
    }, after);
  }, []);

  const measureHere = useCallback(async (view: View | null) => {
    const [root, box] = await Promise.all([measure(rootRef.current), measure(view)]);
    if (!box) return null;
    return root ? { ...box, x: box.x - root.x, y: box.y - root.y } : box;
  }, []);

  /**
   * Firing. The charge is spent on the press, so a second press cannot fire
   * twice; the bolt is then aimed from the weapon's tip to the other ship,
   * both measured on screen, and the hull only drops when it arrives.
   */
  const onFire = useCallback(() => {
    const current = runRef.current;
    if (!current?.mounted) return;
    const next = fireWeapon(current);
    if (next === current) return;
    commit(next);
    haptics.confirm();

    const node = current.position;
    const weapon = current.mounted;
    const mount = MOUNTS[current.shipId] ?? MOUNTS.drifter;
    const aim = async (dy: number) => {
      const now = runRef.current;
      const there = !!now && now.position === node && foeHull(now, node) > 0;
      // Whether it misses is rolled as it leaves, against the other ship's
      // Wren Drive: the harder a ship sways, the harder it is to hit.
      const misses = there && shotMisses(now, 'foe', Math.random());
      // The boxes measured are the ships' resting places; `dy` is how far
      // off that line both are drawn now.
      const [rest, foe] = await Promise.all([measureHere(shipRef.current), measureHere(foeRef.current)]);
      if (!rest) return;
      const box = { ...rest, y: rest.y + dy };
      // The systems box is the ship's 200×260 box grown about its centre and
      // then laid on its side, so its on-screen *height* is the upright width.
      // A point in ship units is its offset from the centre, turned.
      const scale = box.height / SYSTEMS_SPAN / 200;
      const tip = weaponTip(weapon);
      const from = sidewaysPoint(box, (mount.x + tip.x - 100) * scale, (mount.y + tip.y - 130) * scale);
      // Straight across to the other ship's middle; or, on a miss or with
      // nobody there, straight on off the right edge. The bolt's path never
      // changes: on a miss the other ship dodges out of it.
      const hits = there && !!foe && !misses;
      const to = foe && hits ? { x: foe.x + foe.width * 0.45, y: from.y } : { x: width + 40, y: from.y };
      const launch = () =>
        setShots((current) => [...current, { id: Date.now() + Math.random(), by: 'player', node, from, to, hits }]);
      if (foe && there && !hits) {
        // Clear of its widest part — the wings, across its upright width.
        const lead = drift.dodge('foe', foe.height * DODGE_FOE + DODGE_MARGIN);
        const pass = { x: foe.x + foe.width / 2, y: foe.y + dy + foe.height / 2 };
        showMiss(pass, lead + passesAt(from, to, pass.x));
        setTimeout(launch, lead);
      } else {
        launch();
      }
    };
    // Come level with the other ship's centre first, then let go.
    drift.lineUp('player', (dy) => void aim(dy));
  }, [commit, drift, haptics, measureHere, runRef, showMiss, width]);

  /**
   * A hostile ship's weapon has charged: it fires at the player. Nothing but
   * the clock decides this — no button, no hold, no cargo — so this watches
   * the charge and shoots the moment it is full, from the muzzle of the
   * Weapon 1 on its nose to the player's ship.
   */
  const foeReady = !!run && foeArmed(run) && !pendingMeeting(run) && run.foeCharge >= WEAPON_UNITS;
  useEffect(() => {
    const current = runRef.current;
    if (!foeReady || !current) return;
    const next = foeFires(current);
    if (next === current) return;
    // Only the charge resets; the next save along keeps it.
    commit(next, false);

    const node = current.position;
    const aim = async (dy: number) => {
      // Aim at the shield's rim while there is a shield to hit, else the hull.
      const now = runRef.current;
      const shielded = !!now && shieldLevel(now.shieldCharge) > 0;
      const [rest, box] = await Promise.all([measureHere(foeRef.current), measureHere(shipRef.current)]);
      if (!rest || !box) return;
      const foe = { ...rest, y: rest.y + dy };
      // The other ship is on its side too; its on-screen height is its
      // upright width, 200 units across.
      const muzzle = foeMuzzle(encounterAt(current.map, node));
      const foeScale = foe.height / 200;
      const from = sidewaysPoint(foe, (muzzle.x - 100) * foeScale, (muzzle.y - 130) * foeScale);
      // The player's nose faces it. The shield's rim stands 140 units out
      // from the ship's centre along its length (aimed a touch inside it), the
      // hull's nose about 92.
      const playerScale = box.height / SYSTEMS_SPAN / 200;
      const reach = (shielded ? 136 : 92) * playerScale;
      // Rolled against the player's own Wren Drive: the more in it, the more
      // often the player's ship dodges — out of the bolt's line far enough to
      // take the shield with it (or the hull, with no shield up) — and the
      // bolt flies on off the left edge.
      if (now && shotMisses(now, 'player', Math.random())) {
        const lead = drift.dodge('player', (shielded ? DODGE_SHIELD : DODGE_HULL) * playerScale + DODGE_MARGIN);
        const to = { x: -40, y: from.y };
        const pass = { x: box.x + box.width / 2, y: box.y + dy + box.height / 2 };
        showMiss(pass, lead + passesAt(from, to, pass.x));
        setTimeout(
          () => setShots((shots) => [...shots, { id: Date.now() + Math.random(), by: 'foe', node, from, to, hits: false }]),
          lead,
        );
        return;
      }
      const to = { x: box.x + box.width / 2 + reach, y: from.y };
      setShots((shots) => [...shots, { id: Date.now() + Math.random(), by: 'foe', node, from, to, hits: true }]);
    };
    drift.lineUp('foe', (dy) => void aim(dy));
  }, [commit, drift, foeReady, measureHere, runRef, showMiss]);

  /**
   * A bolt arrives. The player's takes a plate off the other ship; a hostile
   * ship's goes through `takeHit`, so the shields soak it before the hull
   * does. Either way it only lands if the ship is still at the star it was
   * fired at.
   */
  const onImpact = useCallback(
    (shot: Shot) => {
      const current = runRef.current;
      if (!current) return;
      const next =
        shot.by === 'player'
          ? hitFoe(current, shot.node)
          : current.position === shot.node
            ? takeHit(current)
            : current;
      if (next === current) return;
      commit(next);
      haptics.tap();
    },
    [commit, haptics, runRef],
  );

  const onShotDone = useCallback((id: number) => {
    setShots((current) => current.filter((shot) => shot.id !== id));
  }, []);

  /**
   * Explosions, played when a hull *reaches* nothing rather than when it is
   * nothing — so loading a save with a wreck in it does not blow it up again,
   * while every way of getting there (the player's bolts, a hostile ship's,
   * the dev hit) is caught by the one check.
   */
  const seen = useRef<{ id: string; position: number; hull: number; foeGone: boolean } | null>(null);
  useEffect(() => {
    if (!run) return;
    const before = seen.current;
    const now = { id: run.id, position: run.position, hull: run.hull, foeGone: foeDestroyed(run) };
    seen.current = now;
    if (!before || before.id !== now.id || before.position !== now.position) {
      // Opening a save, or arriving at a star, where a ship is already
      // destroyed: there is no explosion to wait for, so the player's ship
      // takes the middle straight away — and a wrecked save goes straight to
      // Game Over.
      if (now.foeGone) setCleared(now.position);
      if (!before || before.id !== now.id) {
        if (now.hull <= 0) setOver(true);
        return;
      }
    }

    // Blown up where the ship was drawn, off its resting line by its drift.
    const blowUp = (view: View | null, dy: number) =>
      void measureHere(view).then((box) => {
        if (!box) return;
        const id = Date.now() + Math.random();
        const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 + dy };
        const size = Math.max(box.width, box.height) * 0.8;
        setBlasts((current) => [...current, { id, at, size }]);
        setTimeout(() => setBlasts((current) => current.filter((b) => b.id !== id)), EXPLOSION_MS + 50);
      });

    if (before.hull > 0 && now.hull <= 0) {
      blowUp(shipRef.current, drift.offset('player'));
      // Game over comes up once the explosion has had its moment.
      setTimeout(() => setOver(true), EXPLOSION_MS + 150);
    }
    if (before.position === now.position && !before.foeGone && now.foeGone) {
      blowUp(foeRef.current, drift.offset('foe'));
      // Once it has finished blowing up, the player's ship takes the middle.
      const node = now.position;
      setTimeout(() => setCleared(node), EXPLOSION_MS);
    }
  }, [drift, measureHere, run]);

  return { rootRef, shipRef, foeRef, shots, blasts, misses, over, setOver, cleared, onFire, onImpact, onShotDone };
}

/** A view's box in window coordinates, or null when it is not mounted. */
function measure(view: View | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}
