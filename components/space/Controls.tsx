import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FireButton } from '@/components/FireButton';
import { MenuButton } from '@/components/MenuButton';
import { REACTOR_PANEL_HEIGHT, ReactorPanel } from '@/components/ReactorPanel';
import { ShipButton } from '@/components/ShipPanel';
import { StatusBar } from '@/components/StatusBar';
import {
  CONTROL_GAP,
  FIRE_WIDTH,
  JUMP_HEIGHT,
  SHIP_BUTTON_WIDTH,
  STACK_GAP,
} from '@/components/space/layout';
import type { Subsystem } from '@/lib/energy';
import { isWrecked } from '@/lib/hull';
import { chargeFractions, fireBlocker, jumpBlocker, reactorOf, type RunState } from '@/lib/run';
import { BUTTON_TONE } from '@/lib/subsystems';
import { weaponById } from '@/lib/weapons';

/**
 * The bottom of the space screen: the hull on one line, the reactor across
 * the full width with its controls right on it, and under it FIRE, the SHIP
 * square and JUMP. Greyed out and dead to touch once the ship is destroyed.
 */
export function Controls({
  run,
  width,
  animate,
  onShift,
  onFire,
  onOpenShip,
  onJump,
}: {
  run: RunState | null;
  width: number;
  animate: boolean;
  onShift: (subsystem: Subsystem, delta: number) => void;
  onFire: () => void;
  onOpenShip: () => void;
  onJump: () => void;
}) {
  const wrecked = !!run && isWrecked(run.hull);
  const charge = run ? chargeFractions(run) : { jump: 0, weapon: 0 };
  // Until the run has loaded there is nothing to jump with, so the button
  // stays closed rather than briefly offering a jump it cannot make.
  const blocked = run ? jumpBlocker(run) : 'fuel';

  /**
   * The button says what it does and nothing more.
   *
   * While the drive is still building it is simply closed — the track under
   * the Wren Drive row is the readout, rather than a countdown printed over the
   * button. A cold Wren Drive still gets its own words, because that is a
   * different problem and the track would just sit there unexplained.
   */
  const jumpLabel = blocked === 'fuel' ? 'OUT OF FUEL' : blocked === 'engines' ? 'NO WREN DRIVE' : 'JUMP';
  const jumpCaption = blocked === 'engines' ? 'POWER THE WREN DRIVE' : undefined;
  /**
   * Fuel rides on the button rather than in a strip of its own, since the only
   * question it answers is whether to jump. It is left off when the label is
   * already saying the tank is empty.
   */
  const jumpFuel = blocked === 'fuel' ? undefined : { label: 'FUEL', value: String(run?.fuel ?? 0) };

  return (
    <View pointerEvents={wrecked ? 'none' : 'auto'} style={[styles.hud, wrecked && styles.dead]}>
      <StatusBar hull={run?.hull ?? 0} width={width} />

      <View style={{ width, gap: CONTROL_GAP }}>
        {run ? (
          <ReactorPanel
            energy={run.energy}
            reactor={reactorOf(run)}
            charges={{ shield: run.shieldCharge, weapon: charge.weapon, engine: charge.jump }}
            width={width}
            onShift={onShift}
            animate={animate}
          />
        ) : (
          <View style={{ height: REACTOR_PANEL_HEIGHT }} />
        )}

        <View style={styles.actionRow}>
          <FireButton
            blocked={run ? fireBlocker(run) : 'weapon'}
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
            width={width - FIRE_WIDTH - SHIP_BUTTON_WIDTH - CONTROL_GAP * 2}
            height={JUMP_HEIGHT}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { alignItems: 'center', gap: STACK_GAP },
  dead: { opacity: 0.3 },
  actionRow: { flexDirection: 'row', gap: CONTROL_GAP },
});
