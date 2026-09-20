import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FuelBadge } from '@/components/FuelBadge';
import { MenuButton } from '@/components/MenuButton';
import { useHaptics, useSettings } from '@/lib/settings';
import { StarField } from '@/components/StarField';
import { fonts, palette, tracking, useMenuWidth } from '@/lib/theme';
import {
  applyJump,
  jumpBlocker,
  loadRun,
  saveRun,
  sectorOf,
  type RunState,
} from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import {
  JUMP_RANGE,
  MAP_H,
  MAP_W,
  bossIndex,
  distance,
  reachableFrom,
  type SectorMap,
} from '@/lib/sectorMap';

/** Touch target around each star, independent of how small the dot is drawn. */
const HIT_SIZE = 46;

/**
 * Extra map units reserved below the board so the range ring around the
 * starting star — which sits at the very bottom — is not sliced flat by the
 * edge of the drawing.
 */
const VERT_PAD = 24;

export default function SectorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const { settings } = useSettings();

  const [run, setRun] = useState<RunState | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [jumping, setJumping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRun().then((value) => {
      if (cancelled || !value) return;
      setRun(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const map: SectorMap | undefined = run?.map;
  const position = run?.position ?? 0;
  const visited = useMemo(() => new Set(run?.visited ?? []), [run?.visited]);
  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? 0;
  const dry = fuel <= 0;
  // The helm will not open this screen with the engines cold, but a run
  // loaded straight into the map still has to be told why it cannot move.
  const blocked = run ? jumpBlocker(run) : 'fuel';

  const inRange = useMemo(
    () => (map && !dry ? new Set(reachableFrom(map, position)) : new Set<number>()),
    [dry, map, position],
  );

  // The map box keeps its 100×160 proportions and is centred in whatever
  // space is left between the header and the footer.
  const boardTop = insets.top + 62;
  const boardBottom = insets.bottom + 132;
  const boardW = width - 32;
  const boardH = Math.max(height - boardTop - boardBottom, 120);
  const scale = Math.min(boardW / MAP_W, boardH / (MAP_H + VERT_PAD));
  const offsetX = (boardW - MAP_W * scale) / 2;
  const offsetY = (boardH - (MAP_H + VERT_PAD) * scale) / 2;

  const toPixels = useCallback(
    (node: { x: number; y: number }) => ({
      x: offsetX + node.x * scale,
      y: offsetY + node.y * scale,
    }),
    [offsetX, offsetY, scale],
  );

  const onPickNode = useCallback(
    (index: number) => {
      if (!inRange.has(index)) return;
      haptics.tap();
      setTarget((current) => (current === index ? null : index));
    },
    [haptics, inRange],
  );

  const onConfirmJump = useCallback(async () => {
    if (target === null || !run || jumping) return;

    // `applyJump` refuses a jump the run cannot make and hands back the same
    // object, so an unchanged run means nothing happened — do not spend the
    // press or navigate away on it.
    const jumped = applyJump(run, target);
    if (jumped === run) return;

    setJumping(true);
    haptics.confirm();

    await saveRun(jumped);
    router.back();
  }, [haptics, jumping, router, run, target]);

  const buttonWidth = useMenuWidth();

  if (!map) {
    return <View style={styles.container} />;
  }

  const current = map.nodes[position];
  const currentPx = toPixels(current);
  const boss = bossIndex(map);

  return (
    <View style={styles.container}>
      <StarField width={width} height={height} reduceMotion={settings.reduceMotion} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the helm"
          onPress={() => router.back()}
          hitSlop={14}
          style={styles.back}
        >
          <Text style={styles.backLabel}>BACK</Text>
        </Pressable>
        <Text style={styles.heading}>SECTOR {run ? sectorOf(run) : 1}</Text>
        <View style={[styles.back, styles.fuelSlot]}>
          <FuelBadge remaining={fuel} accent={ship.accent} size="compact" />
        </View>
      </View>

      <View style={[styles.board, { top: boardTop, height: boardH }]}>
        <Svg width={boardW} height={boardH}>
          {/* How far this ship can jump — meaningless with an empty tank. */}
          <Circle
            cx={currentPx.x}
            cy={currentPx.y}
            r={JUMP_RANGE * scale}
            fill={ship.accent}
            fillOpacity={dry ? 0 : 0.035}
            stroke={ship.accent}
            strokeOpacity={dry ? 0.07 : 0.22}
            strokeWidth={1}
            strokeDasharray="3 5"
          />

          {/* Candidate routes out of here. */}
          {[...inRange].map((index) => {
            const to = toPixels(map.nodes[index]);
            const chosen = target === index;
            return (
              <Line
                key={`edge-${index}`}
                x1={currentPx.x}
                y1={currentPx.y}
                x2={to.x}
                y2={to.y}
                stroke={index === boss ? palette.danger : ship.accent}
                strokeOpacity={chosen ? 0.85 : 0.2}
                strokeWidth={chosen ? 1.8 : 1}
                strokeDasharray={chosen ? undefined : '2 6'}
              />
            );
          })}

          {map.nodes.map((node, index) => {
            const px = toPixels(node);
            const isBoss = index === boss;
            const isHere = index === position;
            const isChosen = target === index;
            const isReachable = inRange.has(index);

            // One ordered kind rather than four conditionals with their own
            // precedence. A boss out of reach and unselected is drawn faintest.
            const kind: StarKind = isBoss
              ? 'boss'
              : isHere
                ? 'here'
                : isChosen
                  ? 'chosen'
                  : isReachable
                    ? 'reachable'
                    : visited.has(index)
                      ? 'visited'
                      : 'far';
            const star = STAR[kind];
            const dim = isBoss && !isReachable && !isChosen;

            return (
              <React.Fragment key={`node-${index}`}>
                {star.halo ? (
                  <Circle
                    cx={px.x}
                    cy={px.y}
                    r={star.radius + (isBoss ? 11 : 7)}
                    fill={isBoss ? palette.danger : ship.accent}
                    fillOpacity={dim ? 0.1 : 0.16}
                  />
                ) : null}
                <Circle
                  cx={px.x}
                  cy={px.y}
                  r={star.radius}
                  fill={star.fill === 'accent' ? ship.accent : star.fill}
                  fillOpacity={star.solid ? 1 : 0.5}
                />
                {/* A ring means "we have stood here". It is keyed off the
                    visited set rather than off `kind`, so a star already
                    walked keeps its ring even while it is in range, chosen,
                    or under the ship — which is the point of it. */}
                {visited.has(index) ? (
                  <Circle
                    cx={px.x}
                    cy={px.y}
                    r={star.radius + 4}
                    fill="none"
                    stroke={palette.textMuted}
                    strokeOpacity={0.6}
                    strokeWidth={1}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Touch targets sit above the drawing so small dots stay tappable. */}
        {map.nodes.map((node, index) => {
          if (!inRange.has(index)) return null;
          const px = toPixels(node);
          return (
            <Pressable
              key={`hit-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Jump target ${index + 1}`}
              accessibilityState={{ selected: target === index }}
              onPress={() => onPickNode(index)}
              style={[
                styles.hit,
                { left: px.x - HIT_SIZE / 2, top: px.y - HIT_SIZE / 2 },
              ]}
            />
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 34 }]}>
        <Text
          style={[
            styles.prompt,
            (target === boss || !!blocked) && { color: palette.danger },
          ]}
        >
          {dry
            ? 'NO FUEL — THE SHIP IS ADRIFT'
            : blocked === 'charging'
            ? 'THE DRIVE IS STILL BUILDING'
            : blocked === 'engines'
            ? 'ENGINES COLD — POWER THEM AT THE HELM'
            : target === null
            ? `${inRange.size} STARS IN RANGE`
            : `${target === boss ? 'BOSS · ' : ''}RANGE ${Math.round(
                distance(map.nodes[position], map.nodes[target]),
              )} OF ${JUMP_RANGE}`}
        </Text>
        <MenuButton
          label={
            blocked === 'fuel'
              ? 'OUT OF FUEL'
              : blocked === 'charging'
                ? 'DRIVE CHARGING'
                : blocked
                  ? 'ENGINES OFFLINE'
                  : target === null
                  ? 'SELECT A STAR'
                  : 'JUMP'
          }
          onPress={onConfirmJump}
          primary={!blocked && target !== null}
          disabled={!!blocked || target === null}
          width={buttonWidth}
        />
      </View>
    </View>
  );
}

type StarKind = 'boss' | 'here' | 'chosen' | 'reachable' | 'visited' | 'far';

/** How each kind of star is drawn. 'accent' means the player ship's colour. */
const STAR: Record<StarKind, { radius: number; fill: string; solid: boolean; halo: boolean }> = {
  boss: { radius: 8, fill: palette.danger, solid: true, halo: false },
  here: { radius: 7, fill: 'accent', solid: true, halo: true },
  chosen: { radius: 5.5, fill: 'accent', solid: true, halo: true },
  reachable: { radius: 5.5, fill: palette.textPrimary, solid: true, halo: false },
  visited: { radius: 3.5, fill: palette.textMuted, solid: true, halo: false },
  far: { radius: 3.5, fill: palette.textDisabled, solid: false, halo: false },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.void },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 5,
  },
  back: { width: 52 },
  fuelSlot: { alignItems: 'flex-end' },
  backLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
    letterSpacing: tracking.label,
    marginRight: -tracking.label,
  },
  board: { position: 'absolute', left: 16, right: 16 },
  hit: { position: 'absolute', width: HIT_SIZE, height: HIT_SIZE, borderRadius: HIT_SIZE / 2 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
  },
  prompt: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },
});
