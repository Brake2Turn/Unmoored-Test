import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FuelBadge } from '@/components/FuelBadge';
import { MenuButton } from '@/components/MenuButton';
import { useHaptics, useSettings } from '@/lib/settings';
import { StarField } from '@/components/StarField';
import { fonts, layout, palette, tracking } from '@/lib/theme';
import { loadRun, saveRun, hydrateRun, type RunState } from '@/lib/runStore';
import { shipById } from '@/lib/ships';
import {
  FUEL_PER_RUN,
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
      setRun(hydrateRun(value));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const map: SectorMap | undefined = run?.map;
  const position = run?.position ?? map?.start ?? 0;
  const visited = useMemo(() => new Set(run?.visited ?? []), [run?.visited]);
  const ship = shipById(run?.shipId);
  const fuel = run?.fuel ?? FUEL_PER_RUN;
  const dry = fuel <= 0;

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
    setJumping(true);
    haptics.confirm();

    // Fuel is spent per jump, not per new star — doubling back costs the same.
    const seen = run.visited ?? [position];
    const nextVisited = seen.includes(target) ? seen : [...seen, target];
    const nextJumps = (run.jumps ?? Math.max(seen.length - 1, 0)) + 1;

    const updated: RunState = {
      ...run,
      position: target,
      visited: nextVisited,
      jumps: nextJumps,
      sector: nextJumps + 1,
      fuel: Math.max(fuel - 1, 0),
    };
    await saveRun(updated);
    router.back();
  }, [fuel, haptics, jumping, position, router, run, target]);

  const buttonWidth = Math.min(
    layout.buttonWidth,
    width - layout.screenMargin * 2 - insets.left - insets.right,
  );

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
        <Text style={styles.heading}>SECTOR {run?.sector ?? 1}</Text>
        <View style={[styles.back, styles.fuelSlot]}>
          <FuelBadge
            remaining={fuel}
            capacity={FUEL_PER_RUN}
            accent={ship.accent}
            size="compact"
          />
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
            const isHere = index === position;
            const isReachable = inRange.has(index);
            const isChosen = target === index;
            const wasVisited = visited.has(index);
            const isBoss = index === boss;

            // The boss star stays red at every distance — it is the one thing
            // on this map you should be able to find without looking for it.
            const radius = isBoss ? 8 : isHere ? 7 : isReachable ? 5.5 : 3.5;
            const fill = isBoss
              ? palette.danger
              : isHere || isChosen
                ? ship.accent
                : isReachable
                  ? palette.textPrimary
                  : wasVisited
                    ? palette.textMuted
                    : palette.textDisabled;

            const halo = isBoss ? palette.danger : ship.accent;

            return (
              <React.Fragment key={`node-${index}`}>
                {isHere || isChosen || isBoss ? (
                  <Circle
                    cx={px.x}
                    cy={px.y}
                    r={radius + (isBoss ? 11 : 7)}
                    fill={halo}
                    fillOpacity={isBoss && !isReachable && !isChosen ? 0.1 : 0.16}
                  />
                ) : null}
                <Circle
                  cx={px.x}
                  cy={px.y}
                  r={radius}
                  fill={fill}
                  fillOpacity={isBoss || isReachable || isHere || wasVisited ? 1 : 0.5}
                />
                {isBoss ? (
                  <Circle
                    cx={px.x}
                    cy={px.y}
                    r={radius + 6}
                    fill="none"
                    stroke={palette.danger}
                    strokeOpacity={isReachable || isChosen ? 0.9 : 0.5}
                    strokeWidth={1.4}
                  />
                ) : null}
                {wasVisited && !isHere && !isBoss ? (
                  <Circle
                    cx={px.x}
                    cy={px.y}
                    r={radius + 4}
                    fill="none"
                    stroke={palette.textMuted}
                    strokeOpacity={0.55}
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
            (target === boss || dry) && { color: palette.danger },
          ]}
        >
          {dry
            ? 'NO FUEL — THE SHIP IS ADRIFT'
            : target === null
            ? `${inRange.size} STARS IN RANGE`
            : `${target === boss ? 'BOSS · ' : ''}RANGE ${Math.round(
                distance(map.nodes[position], map.nodes[target]),
              )} OF ${JUMP_RANGE}`}
        </Text>
        <MenuButton
          label={dry ? 'OUT OF FUEL' : target === null ? 'SELECT A STAR' : 'JUMP'}
          onPress={onConfirmJump}
          primary={!dry && target !== null}
          disabled={dry || target === null}
          width={buttonWidth}
        />
      </View>
    </View>
  );
}

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
