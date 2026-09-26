import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop } from '@/components/Backdrop';
import { REACTOR_PANEL_HEIGHT, ReactorPanel } from '@/components/ReactorPanel';
import { ShipButton, ShipDetail } from '@/components/ShipPanel';
import { FireButton } from '@/components/FireButton';
import { FOE_STATUS_HEIGHT, FoeStatus } from '@/components/FoeStatus';
import { LaserShot, type Point } from '@/components/LaserShot';
import { EXPLOSION_MS, Explosion } from '@/components/Explosion';
import { MOUNTS } from '@/components/ships/ShipArt';
import { weaponTip } from '@/components/WeaponArt';
import { DialogueOverlay } from '@/components/DialogueOverlay';
import { FadeInView } from '@/components/FadeInView';
import { STATUS_BAR_HEIGHT, StatusBar } from '@/components/StatusBar';
import { MenuButton } from '@/components/MenuButton';
import { StarField } from '@/components/StarField';
import { EncounterShip, foeMuzzle } from '@/components/ships/EncounterShip';
import { Sideways, sidewaysPoint } from '@/components/ships/Sideways';
import { GameOver } from '@/components/GameOver';
import { ModeBadge } from '@/components/ModeBadge';
import { SYSTEMS_SPAN, ShipSystems } from '@/components/ships/ShipSystems';
import { useHaptics, useSettings } from '@/lib/settings';
import { fonts, layout, palette, tracking, useMenuWidth } from '@/lib/theme';
import {
  chargeFractions,
  clearRun,
  devRefillCharges,
  foeLooksHostile,
  modeOf,
  fireBlocker,
  fireWeapon,
  foeArmed,
  foeDestroyed,
  foeFires,
  foeHull,
  foeHullMax,
  foeName,
  hitFoe,
  jumpBlocker,
  loadRun,
  markSpoken,
  moveGear,
  pendingMeeting,
  reactorOf,
  saveRun,
  shiftEnergy,
  shipHere,
  takeHit,
  tickRun,
  type RunState,
} from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import { encounterAt } from '@/lib/sectorMap';
import { ENCOUNTER_STYLE } from '@/lib/encounters';
import { WEAPON_UNITS, chargeRate, shieldLevel, type Subsystem } from '@/lib/energy';
import { isWrecked } from '@/lib/hull';
import { BUTTON_TONE } from '@/lib/subsystems';
import type { Place } from '@/lib/hold';
import { weaponById } from '@/lib/weapons';

/** The player's ship at full size, before the screen decides it has no room. */
const SHIP_WIDTH = 132;
const SHIP_HEIGHT = 172;

/**
 * What the ship actually occupies once its shield and exhaust are drawn.
 *
 * The budget below has to reserve the whole systems box, not just the hull,
 * or a wide shield would run into whatever is waiting above.
 */
const SHIP_SLOT_HEIGHT = SHIP_HEIGHT * SYSTEMS_SPAN;

/** Space between the stacked pieces of the helm. */
const STACK_GAP = 16;

/**
 * The jump is a compact control under the tabs now, not a menu row. It is
 * still the full width of the chrome and the tallest thing a thumb needs to
 * find, just no longer a panel in its own right.
 */
const JUMP_HEIGHT = 52;

/** Between the two tabs, and between the row of them and the jump. */
const TAB_GAP = 10;

/**
 * What the helm holds back above the topmost art and below the jump button.
 *
 * Both used to be larger, and the slack came out of the middle — the one part
 * of this screen worth giving room to, since the ship and whatever is waiting
 * for it are the only things on it. The top only has to clear LEAVE and the
 * dev control, which are a single line of ten-point type; the bottom only has
 * to keep the jump button off the edge of the phone, on top of whatever safe
 * area the hardware already asks for.
 *
 * They are named because two places need to agree on them: the padding that
 * positions the stack, and the budget that sizes the art inside it. When they
 * were written out twice, changing one silently mis-scaled the ships.
 */
const HUD_TOP = 44;
const HUD_BOTTOM = 20;

/** FIRE sits left of JUMP on the bottom row, this wide. */
const FIRE_WIDTH = 84;

/** The white SHIP square between FIRE and JUMP. */
const SHIP_BUTTON_WIDTH = 52;

/** Room under LEAVE for the other ship's name and hull, when one is here. */
const FOE_STATUS_TOP = 30;
const FOE_STATUS_WIDTH = 132;

/** Kept clear at each side of the ships, and between the two of them. */
const ARENA_MARGIN = 12;
const ARENA_GAP = 36;

/** How much smaller both ships are drawn when there are two of them. */
const PAIR_SHRINK = 0.84;

/** The bottom of the helm: a row of tabs with the jump beneath it. */
const CONTROL_ROW_HEIGHT = REACTOR_PANEL_HEIGHT + TAB_GAP + JUMP_HEIGHT;

/**
 * Which panel is open over the helm, if any. Only the ship's opens now: the
 * reactor's controls sit on the helm itself, always open.
 */
type OpenPanel = 'ship';

/** What the scrim says it will close, so the label matches what is on top. */
const PANEL_LABEL: Record<OpenPanel, string> = {
  ship: 'the ship',
};

/**
 * How often the helm advances the hold timer and the shield charge.
 *
 * Four times a second is smooth enough for a countdown and a fade without
 * writing to storage on every frame — the save is throttled separately below.
 */
const TICK_MS = 250;
const SAVE_EVERY_TICKS = 8;

/**
 * The helm: the ship in front of you, with the reactor to divide up and one
 * place to go.
 *
 * The quiet LEAVE at the top exists so a player is never stuck here with no
 * way back to the title. JUMP opens the sector map — which carries none of
 * the reactor panel, because choosing where to go is a different decision
 * from deciding what to power.
 */
export default function RunScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const { settings } = useSettings();

  const [run, setRun] = useState<RunState | null>(null);
  // A panel is only on screen while the player is actually looking at it, and
  // only ever one: they open in the same place, over the same scrim.
  const [open, setOpen] = useState<OpenPanel | null>(null);
  // Shots in flight. Each carries the star it was fired at, so a bolt still
  // flying when the ship jumps lands on nothing rather than the next ship.
  const [shots, setShots] = useState<Shot[]>([]);
  // Ships blowing apart, the player's or the other one's.
  const [blasts, setBlasts] = useState<Blast[]>([]);
  // The player's ship is gone and the Game Over box is up.
  const [over, setOver] = useState(false);
  const shipRef = useRef<View>(null);
  const foeRef = useRef<View>(null);

  // The ticker reads the live run without being rebuilt on every tick.
  const runRef = useRef<RunState | null>(null);
  runRef.current = run;

  // Re-read on focus so returning from a jump shows the new position, and
  // write back on the way out so the clocks do not rewind.
  //
  // `focused` stops the clocks while another screen is on top. This screen
  // stays mounted underneath star select and the encounter tester, and a clock
  // still ticking here would keep saving its own copy of the run over whatever
  // those screens wrote — a jump, or a staged encounter, undone seconds later.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setFocused(true);
      loadRun().then((value) => {
        if (!cancelled && value) setRun(value);
      });
      return () => {
        cancelled = true;
        setFocused(false);
        if (runRef.current) void saveRun(runRef.current);
      };
    }, []),
  );

  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? 0;
  // Until the run has loaded there is nothing to jump with, so the button
  // stays closed rather than briefly offering a jump it cannot make.
  const blocked = run ? jumpBlocker(run) : 'fuel';

  // What is here is only learned by arriving — the sector map shows plain dots.
  //
  // A destroyed ship keeps its place in the layout while it explodes, so the
  // player's ship does not jump mid-explosion; once the explosion is over the
  // star is `cleared` and the layout lets it go, which brings the player's
  // ship back to the middle. `laidOut` is what the layout is sized for.
  const encounter = run ? encounterAt(run.map, run.position) : 'empty';
  const present = run ? shipHere(run) : 'empty';
  const [cleared, setCleared] = useState<number | null>(null);
  const laidOut =
    run && present === 'empty' && cleared === run.position ? 'empty' : encounter;
  const waiting = ENCOUNTER_STYLE[laidOut];
  const wrecked = !!run && isWrecked(run.hull);

  const buttonWidth = useMenuWidth();

  /**
   * What this star still has to say, if anything.
   *
   * Derived rather than held in state: the run already records which stars
   * have spoken, so there is nothing here that could disagree with it. The
   * overlay simply stops rendering once the arrival is marked.
   */
  const talking = run ? pendingMeeting(run) : null;

  const onDialogueDone = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const next = markSpoken(current);
    setRun(next);
    void saveRun(next);
  }, []);

  const canTakeHit = !!run && (shieldLevel(run.shieldCharge) > 0 || run.hull > 0);
  const charge = run ? chargeFractions(run) : { jump: 0, weapon: 0 };
  // Each clock is worth ticking only while it has somewhere to go and the
  // power to get there — a row with nothing in it does not creep along.
  const driveBuilding = !!run && charge.jump < 1 && chargeRate(run.energy.engines) > 0;
  const weaponBuilding = !!run && charge.weapon < 1 && chargeRate(run.energy.weapons) > 0;
  const shieldBuilding = !!run && run.shieldCharge < run.energy.shields;
  const foeBuilding = !!run && foeArmed(run) && run.foeCharge < WEAPON_UNITS;

  /**
   * The helm's clocks.
   *
   * It is the only screen that sits still, so it is the only one that
   * advances them. The interval is rebuilt only when there is something new
   * to count, not on every tick.
   */
  useEffect(() => {
    if (!focused) return;
    if (!driveBuilding && !weaponBuilding && !shieldBuilding && !foeBuilding) return;

    let ticks = 0;
    const timer = setInterval(() => {
      const current = runRef.current;
      if (!current) return;

      const next = tickRun(current, TICK_MS / 1000);
      if (next === current) return;

      setRun(next);
      ticks += 1;
      // Persist when a clock finishes, and occasionally along the way, rather
      // than writing to storage four times a second.
      if (ticks % SAVE_EVERY_TICKS === 0) void saveRun(next);
    }, TICK_MS);

    // The last tick of a clock is the one worth keeping, so write on the way
    // out as well as periodically.
    return () => {
      clearInterval(timer);
      if (runRef.current) void saveRun(runRef.current);
    };
  }, [driveBuilding, focused, foeBuilding, shieldBuilding, weaponBuilding]);

  /**
   * The two ships lie on their sides, side by side: the player on the left
   * facing right, whatever is waiting on the right facing left. Alone, the
   * player sits in the middle.
   *
   * Both are scaled together from whichever runs out first — the width they
   * share, or the height the controls leave. Laid on its side a ship's length
   * runs across the screen, so it is the width that usually decides; the
   * Elder Shrike beside the player's shield is the widest pair.
   */
  const hudTop = HUD_TOP;
  const chromeHeight =
    insets.top +
    hudTop +
    insets.bottom +
    HUD_BOTTOM +
    STATUS_BAR_HEIGHT +
    CONTROL_ROW_HEIGHT +
    STACK_GAP * 3;
  const artBudget = height - chromeHeight;
  const paired = laidOut !== 'empty';
  const acrossBudget = width - ARENA_MARGIN * 2 - (paired ? ARENA_GAP : 0);
  const artScale = Math.max(
    0.4,
    // Two ships share the screen a size down from what would just fit, so
    // there is clear space between them rather than shield touching wing.
    (paired ? PAIR_SHRINK : 1) *
    Math.min(
      1,
      // Across: the player's turned systems box plus the other ship's length.
      acrossBudget / (SHIP_SLOT_HEIGHT + waiting.height),
      // Down: the taller of the player's turned box and the other ship with
      // its name above it.
      artBudget / Math.max(SHIP_WIDTH * SYSTEMS_SPAN, waiting.width + FOE_STATUS_HEIGHT / 0.8),
    ),
  );

  const onJump = useCallback(() => {
    if (blocked) return;
    haptics.confirm();
    router.push('/sector');
  }, [blocked, haptics, router]);

  const onOpenShip = useCallback(() => {
    haptics.tap();
    setOpen('ship');
  }, [haptics]);

  const onClosePanel = useCallback(() => {
    haptics.tap();
    setOpen(null);
  }, [haptics]);

  const onLeave = useCallback(() => {
    haptics.tap();
    router.back();
  }, [haptics, router]);

  /**
   * The button says what it does and nothing more.
   *
   * While the drive is still building it is simply closed — the slider under
   * the engines row is the readout now, rather than a countdown printed over
   * the button. Cold engines still get their own words, because that is a
   * different problem and the slider would just sit there unexplained.
   */
  const jumpLabel =
    blocked === 'fuel' ? 'OUT OF FUEL' : blocked === 'engines' ? 'NO ENGINES' : 'JUMP';
  const jumpCaption = blocked === 'engines' ? 'POWER THE ENGINES' : undefined;
  /**
   * Fuel rides on the button rather than in a strip of its own, since the only
   * question it answers is whether to jump. It is left off when the label is
   * already saying the tank is empty.
   */
  const jumpFuel = blocked === 'fuel' ? undefined : { label: 'FUEL', value: String(fuel) };

  const fireBlock = run ? fireBlocker(run) : 'weapon';

  /**
   * Firing. The charge is spent on the press, so a second press cannot fire
   * twice; the bolt is then aimed from the weapon's tip to the other ship,
   * both measured on screen, and the hull only drops when it arrives.
   */
  const onFire = useCallback(() => {
    if (!run) return;
    const next = fireWeapon(run);
    if (next === run || !run.mounted) return;
    setRun(next);
    haptics.confirm();
    void saveRun(next);

    const node = run.position;
    const weapon = run.mounted;
    const hits = foeHull(run, node) > 0;
    void Promise.all([measureHere(shipRef.current), measureHere(foeRef.current)]).then(([box, foe]) => {
      if (!box) return;
      // The systems box is the ship's 200×260 box grown about its centre and
      // then laid on its side, so its on-screen *height* is the upright width.
      // A point in ship units is its offset from the centre, turned.
      const scale = box.height / SYSTEMS_SPAN / 200;
      const mount = MOUNTS[ship.id] ?? MOUNTS.drifter;
      const tip = weaponTip(weapon);
      const from = sidewaysPoint(
        box,
        (mount.x + tip.x - 100) * scale,
        (mount.y + tip.y - 130) * scale,
      );
      // Straight across to the other ship's middle, or off the right edge.
      const to = foe && hits
        ? { x: foe.x + foe.width * 0.45, y: from.y }
        : { x: width + 40, y: from.y };
      setShots((current) => [
        ...current,
        { id: Date.now() + Math.random(), by: 'player', node, from, to, hits: hits && !!foe },
      ]);
    });
  }, [haptics, run, ship.id, width]);

  /**
   * A red ship's weapon has charged: it fires at the player. Nothing but the
   * clock decides this — no button, no hold, no cargo — so it watches the
   * charge and shoots the moment it is full, from the muzzle of the Weapon 1
   * on its nose to the player's ship.
   */
  const foeReady = !!run && foeArmed(run) && !talking && run.foeCharge >= WEAPON_UNITS;
  useEffect(() => {
    const current = runRef.current;
    if (!foeReady || !current) return;
    const next = foeFires(current);
    if (next === current) return;
    setRun(next);

    const node = current.position;
    // Aim at the shield's rim while there is a shield to hit, else the hull.
    const shielded = shieldLevel(current.shieldCharge) > 0;
    void Promise.all([measureHere(foeRef.current), measureHere(shipRef.current)]).then(([foe, box]) => {
      if (!foe || !box) return;
      // The other ship is on its side too; its on-screen height is its
      // upright width, 200 units across.
      const muzzle = foeMuzzle(encounterAt(current.map, node));
      const foeScale = foe.height / 200;
      const from = sidewaysPoint(foe, (muzzle.x - 100) * foeScale, (muzzle.y - 130) * foeScale);
      // The player's nose faces it. The shield's rim stands 140 units out
      // from the ship's centre along its length, the hull's nose about 92.
      const playerScale = box.height / SYSTEMS_SPAN / 200;
      const reach = (shielded ? 136 : 92) * playerScale;
      const to = { x: box.x + box.width / 2 + reach, y: from.y };
      setShots((shots) => [
        ...shots,
        { id: Date.now() + Math.random(), by: 'foe', node, from, to, hits: true },
      ]);
    });
  }, [foeReady]);

  /**
   * A bolt arrives. The player's takes a plate off the other ship; a red
   * ship's goes through `takeHit`, so the shields soak it before the hull
   * does. Either way it only lands if the ship is still at the star it was
   * fired at.
   */
  const onImpact = useCallback((shot: Shot) => {
    const current = runRef.current;
    if (!current) return;
    const next =
      shot.by === 'player'
        ? hitFoe(current, shot.node)
        : current.position === shot.node
          ? takeHit(current)
          : current;
    if (next === current) return;
    setRun(next);
    haptics.tap();
    void saveRun(next);
  }, [haptics]);

  /**
   * Explosions, played when a hull *reaches* nothing rather than when it is
   * nothing — so loading a save with a wreck in it does not blow it up again,
   * while every way of getting there (the player's bolts, a red ship's, the
   * dev hit) is caught by the one check.
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

    const blowUp = (view: View | null) =>
      void measureHere(view).then((box) => {
        if (!box) return;
        const id = Date.now() + Math.random();
        const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const size = Math.max(box.width, box.height) * 0.8;
        setBlasts((current) => [...current, { id, at, size }]);
        setTimeout(() => setBlasts((current) => current.filter((b) => b.id !== id)), EXPLOSION_MS + 50);
      });

    if (before.hull > 0 && now.hull <= 0) {
      blowUp(shipRef.current);
      // Game over comes up once the explosion has had its moment.
      setTimeout(() => setOver(true), EXPLOSION_MS + 150);
    }
    if (before.position === now.position && !before.foeGone && now.foeGone) {
      blowUp(foeRef.current);
      // Once it has finished blowing up, the player's ship takes the middle.
      const node = now.position;
      setTimeout(() => setCleared(node), EXPLOSION_MS);
    }
  }, [run]);

  /**
   * A view's box relative to this screen, which is what the shots and the
   * explosions are positioned against.
   *
   * Measuring against the browser window and drawing against the screen only
   * agrees while the two share a top-left corner. Where they did not — the
   * page shifted inside whatever is showing it — a bolt started away from the
   * gun. Measuring the screen too and taking the difference makes that offset
   * cancel out, whatever caused it.
   */
  const rootRef = useRef<View>(null);
  const measureHere = useCallback(async (view: View | null) => {
    const [root, box] = await Promise.all([measure(rootRef.current), measure(view)]);
    if (!box) return null;
    return root ? { ...box, x: box.x - root.x, y: box.y - root.y } : box;
  }, []);

  /**
   * Leaving a destroyed run, either way, ends it. The run is let go of here
   * first — this screen writes its run back to storage as it closes, and
   * would otherwise save the wreck again straight after it was cleared.
   */
  const endRun = useCallback(
    async (to: 'new' | 'menu') => {
      haptics.confirm();
      runRef.current = null;
      setRun(null);
      setOver(false);
      await clearRun();
      if (to === 'new') router.replace('/select-ship');
      else router.back();
    },
    [haptics, router],
  );

  /**
   * Dev only: take a plate off the other ship, as if a bolt had landed —
   * straight through `hitFoe`, so it can be destroyed this way too. It does
   * not provoke a yellow ship: that only comes from actually firing.
   */
  const canHitThem = !!run && !wrecked && foeHull(run) > 0;
  const onHitThem = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const next = hitFoe(current, current.position);
    if (next === current) return;
    setRun(next);
    haptics.tap();
    void saveRun(next);
  }, [haptics]);

  /**
   * Dev only: drive, weapon and shields all full this instant, so a jump or a
   * shot can be tried without waiting on the bars.
   */
  const onRefill = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const next = devRefillCharges(current);
    if (next === current) return;
    setRun(next);
    haptics.tap();
    void saveRun(next);
  }, [haptics]);

  /**
   * Dev only: put a hit on the ship so the shield, its effects and the hull
   * can be watched without any combat to do it. Delete this with the button.
   */

  const onShotDone = useCallback((id: number) => {
    setShots((current) => current.filter((shot) => shot.id !== id));
  }, []);

  const onTakeHit = useCallback(() => {
    if (!run) return;
    const next = takeHit(run);
    if (next === run) return;
    setRun(next);
    haptics.tap();
    void saveRun(next);
  }, [haptics, run]);

  /**
   * Moving a bar of energy.
   *
   * `shiftEnergy` hands back the same run when the move is not legal, so a
   * press on a greyed-out control costs nothing: no write, no buzz, no render.
   */
  const onShift = useCallback(
    (subsystem: Subsystem, delta: number) => {
      if (!run) return;
      const next = shiftEnergy(run, subsystem, delta);
      if (next === run) return;
      setRun(next);
      haptics.tap();
      void saveRun(next);
    },
    [haptics, run],
  );

  /**
   * Moving the weapon between the hardpoint and the hold. Same shape as
   * `onShift`: the run refuses an illegal move by handing itself back.
   */
  const onMoveGear = useCallback(
    (from: Place, to: Place) => {
      if (!run) return;
      const next = moveGear(run, from, to);
      if (next === run) return;
      setRun(next);
      haptics.tap();
      void saveRun(next);
    },
    [haptics, run],
  );

  return (
    <View ref={rootRef} collapsable={false} style={styles.container}>
      <Backdrop width={width} height={height} variant="deep" />
      <StarField width={width} height={height} reduceMotion={settings.reduceMotion} />

      <View style={[styles.leaveRow, { top: insets.top + 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave the run and return to the title screen"
          onPress={onLeave}
          hitSlop={16}
          style={styles.leave}
        >
          <Text style={styles.leaveLabel}>LEAVE</Text>
        </Pressable>
      </View>

      {/* Which mode the run is in, opposite LEAVE. */}
      {run ? (
        <View style={[styles.devRow, { top: insets.top + 2 }]}>
          <ModeBadge mode={modeOf(run)} />
        </View>
      ) : null}

      {/* Dev mode only, under the mode: a hit on either ship, on demand. */}
      {settings.devMode ? (
        <View style={[styles.devRow, styles.devStack, { top: insets.top + FOE_STATUS_TOP }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Developer: put a hit on the ship"
            accessibilityState={{ disabled: !canTakeHit }}
            disabled={!canTakeHit}
            onPress={onTakeHit}
            hitSlop={8}
            style={styles.leave}
          >
            <Text style={[styles.leaveLabel, canTakeHit && { color: palette.danger }]}>
              DEV · TAKE A HIT
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Developer: put a hit on the other ship"
            accessibilityState={{ disabled: !canHitThem }}
            disabled={!canHitThem}
            onPress={onHitThem}
            hitSlop={8}
            style={styles.leave}
          >
            <Text style={[styles.leaveLabel, canHitThem && { color: palette.danger }]}>
              DEV · HIT THEM
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Developer: fill every charge"
            accessibilityState={{ disabled: wrecked }}
            disabled={wrecked}
            onPress={onRefill}
            hitSlop={8}
            style={styles.leave}
          >
            <Text style={[styles.leaveLabel, !wrecked && { color: palette.power }]}>
              DEV · REFILL CHARGES
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.stack,
          { paddingTop: insets.top + hudTop, paddingBottom: insets.bottom + HUD_BOTTOM },
        ]}
      >
        {/* The two ships, side by side: the player on the left facing right,
            whatever is waiting on the right facing left. Alone, the player
            holds the middle. */}
        <View style={styles.arena}>
          {/* The reactor allocation, drawn on the ship: a bubble for shields,
              a longer exhaust for engines. */}
          <FadeInView enabled={!settings.reduceMotion} duration={700}>
            <View ref={shipRef} collapsable={false} style={wrecked ? styles.gone : null}>
              <Sideways
                width={SHIP_WIDTH * artScale * SYSTEMS_SPAN}
                height={SHIP_HEIGHT * artScale * SYSTEMS_SPAN}
              >
                <ShipSystems
                  shipId={ship.id}
                  width={SHIP_WIDTH * artScale}
                  height={SHIP_HEIGHT * artScale}
                  shields={shieldLevel(run?.shieldCharge ?? 0)}
                  shieldHits={run?.shieldHits ?? 0}
                  engines={run?.energy.engines ?? 0}
                  weapon={run?.mounted ?? null}
                  animate={!settings.reduceMotion}
                />
              </Sideways>
            </View>
          </FadeInView>

          {laidOut === 'empty' ? null : (
            <FadeInView enabled={!settings.reduceMotion} duration={520} delay={160}>
              <View style={styles.foeColumn}>
                {/* Who is out here and their hull, over their own ship. Gone
                    with it once it is destroyed, but its room is kept. */}
                <View style={[styles.foeStatus, present === 'empty' && styles.gone]}>
                  {run ? (
                    <FoeStatus
                      name={foeName(run) ?? waiting.label}
                      hull={foeHull(run)}
                      max={foeHullMax(run)}
                      width={Math.min(FOE_STATUS_WIDTH, waiting.height * artScale)}
                    />
                  ) : (
                    <View style={{ height: FOE_STATUS_HEIGHT }} />
                  )}
                </View>
                {/* Kept in the layout once destroyed, just not drawn, so
                    nothing else on the screen moves when it goes. */}
                <View
                  ref={foeRef}
                  collapsable={false}
                  style={present === 'empty' ? styles.gone : null}
                >
                  <Sideways width={waiting.width * artScale} height={waiting.height * artScale}>
                    <EncounterShip
                      encounter={encounter}
                      angry={!!run && foeLooksHostile(run)}
                      width={waiting.width * artScale}
                      height={waiting.height * artScale}
                    />
                  </Sideways>
                </View>
              </View>
            </FadeInView>
          )}
        </View>

        {/* The HUD: hull, tabs and the two buttons. Greyed out and dead to
            touch once the ship is destroyed. */}
        <View
          pointerEvents={wrecked ? 'none' : 'auto'}
          style={[styles.hud, wrecked && styles.hudDead]}
        >
          {/* What this ship has left, on one line. */}
          <StatusBar hull={run?.hull ?? 0} width={buttonWidth} />

          {/* The reactor across the full width, its controls right on it, and
              under it FIRE, the SHIP square and JUMP. */}
          <View style={{ width: buttonWidth, gap: TAB_GAP }}>
            {run ? (
              <ReactorPanel
                energy={run.energy}
                reactor={reactorOf(run)}
                charges={{
                  shield: run.shieldCharge,
                  weapon: charge.weapon,
                  engine: charge.jump,
                }}
                width={buttonWidth}
                onShift={onShift}
                animate={!settings.reduceMotion}
              />
            ) : (
              <View style={{ height: REACTOR_PANEL_HEIGHT }} />
            )}

            <View style={styles.actionRow}>
              <FireButton
                blocked={fireBlock}
                weaponName={weaponById(run?.mounted)?.name ?? null}
                width={FIRE_WIDTH}
                height={JUMP_HEIGHT}
                onPress={onFire}
              />
              <ShipButton
                loadout={{ mounted: run?.mounted ?? null, hold: run?.hold ?? [] }}
                width={SHIP_BUTTON_WIDTH}
                height={JUMP_HEIGHT}
                onPress={onOpenShip}
              />
              <MenuButton
                label={jumpLabel}
                caption={jumpCaption}
                onPress={onJump}
                primary={!blocked}
                disabled={!!blocked}
                gauge={jumpFuel}
                tone={BUTTON_TONE.engines}
                charging={blocked === 'charging'}
                width={buttonWidth - FIRE_WIDTH - SHIP_BUTTON_WIDTH - TAB_GAP * 2}
                height={JUMP_HEIGHT}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Bolts in flight and the sparks where they land, over both ships. */}
      {shots.map((shot) => (
        <LaserShot
          key={shot.id}
          from={shot.from}
          to={shot.to}
          hits={shot.hits}
          animate={!settings.reduceMotion}
          onImpact={() => onImpact(shot)}
          onDone={() => onShotDone(shot.id)}
        />
      ))}

      {over ? (
        <GameOver
          width={Math.min(300, width - 48)}
          onNewRun={() => void endRun('new')}
          onMenu={() => void endRun('menu')}
        />
      ) : null}

      {blasts.map((blast) => (
        <Explosion key={blast.id} at={blast.at} size={blast.size} animate={!settings.reduceMotion} />
      ))}

      {/* A panel opens over the helm rather than living in it, so the room it
          needs is only taken while it is being used. */}
      {open && run ? (
        <>
          {/* Dims the helm behind the panel, and catches the tap that closes
              it. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${PANEL_LABEL[open]}`}
            onPress={onClosePanel}
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
          <View
            style={[
              styles.panelHolder,
              {
                bottom: insets.bottom + HUD_BOTTOM + CONTROL_ROW_HEIGHT + 12,
                left: Math.max(16, (width - layout.panelWidth) / 2),
              },
            ]}
          >
            <ShipDetail loadout={{ mounted: run.mounted, hold: run.hold }} onMove={onMoveGear} />
          </View>
        </>
      ) : null}

      {/* Whatever is out here speaks first. Over everything, including an
          open panel, because nothing else can be done until it has. */}
      {talking ? (
        <DialogueOverlay
          meeting={talking}
          bottom={insets.bottom + HUD_BOTTOM + CONTROL_ROW_HEIGHT + STACK_GAP}
          onDone={onDialogueDone}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  leaveRow: { position: 'absolute', left: 20, zIndex: 5 },
  /** Takes the slack between the top and the HUD; the ships sit mid-way. */
  arena: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: ARENA_MARGIN,
    gap: ARENA_GAP,
  },
  /**
   * The other ship's name floats above it rather than stacking on it, so the
   * two ships' centres stay level and a bolt flies straight between them.
   */
  foeColumn: { alignItems: 'center' },
  foeStatus: { position: 'absolute', bottom: '100%', marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: TAB_GAP },
  hud: { alignItems: 'center', gap: STACK_GAP },
  hudDead: { opacity: 0.3 },
  /** A destroyed ship: still holding its place, no longer drawn. */
  gone: { opacity: 0 },
  devRow: { position: 'absolute', right: 20, zIndex: 5 },
  devStack: { alignItems: 'flex-end' },
  leave: { paddingVertical: 6, paddingHorizontal: 4 },
  leaveLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textDisabled,
    letterSpacing: tracking.caption,
  },

  stack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: STACK_GAP,
  },

  scrim: { backgroundColor: 'rgba(5,7,15,0.62)', zIndex: 9 },
  panelHolder: { position: 'absolute', zIndex: 10 },
});

/** One bolt in flight: where from, where to, and the star it was fired at. */
type Shot = {
  id: number;
  /** Who fired it, which decides what its arrival does. */
  by: 'player' | 'foe';
  node: number;
  from: Point;
  to: Point;
  hits: boolean;
};

/** One explosion on screen: where, and how big the ship was. */
type Blast = { id: number; at: Point; size: number };

/** A view's box on screen, or null when it is not mounted. */
function measure(
  view: View | null,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}
