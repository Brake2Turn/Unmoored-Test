import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg';

import { palette } from '@/lib/theme';

type Props = {
  width: number;
  height: number;
  /**
   * 'title' is the view from the home system, planet and all. 'deep' is open
   * space during a run: same sky, no planet, fainter nebulae.
   */
  variant?: 'title' | 'deep';
};

/**
 * Surface markings, in planet-local units: 1 is one radius, the origin is the
 * planet's centre, and negative y is up.
 *
 * Only the crown above y ≈ -0.34 is ever on screen — the rest of the sphere is
 * below the bottom edge — so every feature lives up there. `tone` picks the
 * colour: 'mare' for a dark basin, 'highland' for a lit plateau.
 *
 * These are fixed rather than random. The title screen is the first thing seen
 * every launch, and a planet that reshuffled its continents each time would
 * read as a glitch.
 */
const SURFACE: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotate: number;
  tone: 'mare' | 'highland';
  opacity: number;
}[] = [
  { x: -0.33, y: -0.58, rx: 0.37, ry: 0.19, rotate: -16, tone: 'mare', opacity: 0.5 },
  { x: 0.31, y: -0.69, rx: 0.27, ry: 0.13, rotate: 13, tone: 'mare', opacity: 0.42 },
  { x: 0.03, y: -0.43, rx: 0.47, ry: 0.15, rotate: -5, tone: 'mare', opacity: 0.34 },
  { x: -0.67, y: -0.43, rx: 0.2, ry: 0.1, rotate: 27, tone: 'mare', opacity: 0.32 },
  { x: 0.63, y: -0.46, rx: 0.22, ry: 0.11, rotate: -23, tone: 'mare', opacity: 0.28 },
  { x: -0.06, y: -0.88, rx: 0.21, ry: 0.07, rotate: 7, tone: 'mare', opacity: 0.26 },
  { x: -0.31, y: -0.83, rx: 0.23, ry: 0.1, rotate: -11, tone: 'highland', opacity: 0.3 },
  { x: 0.41, y: -0.86, rx: 0.15, ry: 0.06, rotate: 17, tone: 'highland', opacity: 0.22 },
  { x: -0.55, y: -0.7, rx: 0.13, ry: 0.06, rotate: 34, tone: 'highland', opacity: 0.18 },
];

/**
 * Impact craters, in the same planet-local units. Each is drawn twice: a lit
 * rim offset toward the light source, then the floor on top of it, which is
 * what reads as a dished hollow rather than a flat spot.
 */
const CRATERS: { x: number; y: number; r: number }[] = [
  { x: -0.13, y: -0.69, r: 0.085 },
  { x: 0.45, y: -0.59, r: 0.058 },
  { x: -0.5, y: -0.61, r: 0.044 },
  { x: 0.16, y: -0.79, r: 0.05 },
  { x: -0.74, y: -0.52, r: 0.036 },
];

/**
 * How far a crater's lit rim is pushed toward the light, as a share of its own
 * radius. Small values leave the rim showing as a complete ring all the way
 * round, which reads as a bubble rather than a hollow; this is far enough that
 * the floor covers everything but a crescent on the lit side.
 */
const RIM_OFFSET = 0.26;

/**
 * Everything behind the starfield: the gradient sky, two nebula blooms, and a
 * lit planet rising from the lower edge.
 *
 * The blooms and the planet are SVG radial gradients — React Native views can
 * only do linear ones, and the soft falloff is what sells the depth. The
 * surface is built the same way, from flat shapes at low opacity: React Native
 * SVG has no dependable blur or noise filter, so texture has to be drawn.
 */
export function Backdrop({ width, height, variant = 'title' }: Props) {
  const deep = variant === 'deep';
  // The planet sits mostly below the lower edge, so only its lit crown shows.
  const planetRadius = (width * 0.86) / 2;
  const planetCentreY = height + planetRadius * 0.34;
  const planetCentreX = width / 2;
  const bloomAlpha = deep ? 0.45 : 1;

  /** Planet-local units to screen pixels. */
  const px = (units: number) => units * planetRadius;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[palette.horizon, palette.void]}
        style={StyleSheet.absoluteFill}
      />

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="violet" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.nebulaViolet} stopOpacity={0.55 * bloomAlpha} />
            <Stop offset="1" stopColor={palette.nebulaViolet} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="teal" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.nebulaTeal} stopOpacity={0.45 * bloomAlpha} />
            <Stop offset="1" stopColor={palette.nebulaTeal} stopOpacity={0} />
          </RadialGradient>
          {/* Offset centre puts the light source up and to the left. */}
          <RadialGradient id="planet" cx="31%" cy="19%" r="72%">
            <Stop offset="0" stopColor={palette.planetLight} />
            <Stop offset="1" stopColor={palette.planetDark} />
          </RadialGradient>
          {/* Limb darkening: clear through the middle, dusk at the edges. It
              is what stops the disc reading as a flat pasted circle. */}
          <RadialGradient id="planetLimb" cx="50%" cy="50%" r="50%">
            <Stop offset="0.5" stopColor={palette.planetDark} stopOpacity={0} />
            <Stop offset="0.86" stopColor={palette.planetDark} stopOpacity={0.45} />
            <Stop offset="1" stopColor={palette.planetDark} stopOpacity={0.92} />
          </RadialGradient>
          {/* A soft bloom where the sun actually strikes. */}
          <RadialGradient id="planetSun" cx="31%" cy="19%" r="40%">
            <Stop offset="0" stopColor={palette.planetHighlight} stopOpacity={0.4} />
            <Stop offset="1" stopColor={palette.planetHighlight} stopOpacity={0} />
          </RadialGradient>
          {/* Markings run past the edge of the sphere and have to be cut to it. */}
          <ClipPath id="planetEdge">
            <Circle cx={planetCentreX} cy={planetCentreY} r={planetRadius} />
          </ClipPath>
        </Defs>

        <Circle cx={width * 0.22} cy={height * 0.26} r={width * 0.59} fill="url(#violet)" />
        <Circle cx={width * 0.86} cy={height * 0.62} r={width * 0.47} fill="url(#teal)" />

        {deep ? null : (
          <>
            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius}
              fill="url(#planet)"
            />

            <G clipPath="url(#planetEdge)">
              {SURFACE.map((feature, i) => (
                <Ellipse
                  key={`surface-${i}`}
                  cx={planetCentreX + px(feature.x)}
                  cy={planetCentreY + px(feature.y)}
                  rx={px(feature.rx)}
                  ry={px(feature.ry)}
                  fill={feature.tone === 'mare' ? palette.planetDark : palette.planetHighlight}
                  fillOpacity={feature.opacity}
                  origin={`${planetCentreX + px(feature.x)}, ${planetCentreY + px(feature.y)}`}
                  rotation={feature.rotate}
                />
              ))}

              {CRATERS.map((crater, i) => {
                const cx = planetCentreX + px(crater.x);
                const cy = planetCentreY + px(crater.y);
                const r = px(crater.r);
                const shift = r * RIM_OFFSET;
                return (
                  <React.Fragment key={`crater-${i}`}>
                    {/* Rim first, nudged toward the light up and to the left,
                        then the floor laid over all but its lit crescent. */}
                    <Circle
                      cx={cx - shift}
                      cy={cy - shift}
                      r={r * 1.02}
                      fill={palette.planetHighlight}
                      fillOpacity={0.4}
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={palette.planetDark}
                      fillOpacity={0.52}
                    />
                    {/* The far wall catches the light the floor does not. */}
                    <Circle
                      cx={cx + shift * 0.5}
                      cy={cy + shift * 0.5}
                      r={r * 0.62}
                      fill={palette.planetHighlight}
                      fillOpacity={0.12}
                    />
                  </React.Fragment>
                );
              })}
            </G>

            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius}
              fill="url(#planetLimb)"
            />
            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius}
              fill="url(#planetSun)"
            />

            {/* Three fading strokes stand in for a blurred atmospheric rim —
                React Native SVG has no dependable blur filter. */}
            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius}
              fill="none"
              stroke={palette.accent}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius + 3}
              fill="none"
              stroke={palette.accent}
              strokeOpacity={0.16}
              strokeWidth={3}
            />
            <Circle
              cx={planetCentreX}
              cy={planetCentreY}
              r={planetRadius + 7}
              fill="none"
              stroke={palette.accent}
              strokeOpacity={0.07}
              strokeWidth={5}
            />
          </>
        )}
      </Svg>
    </View>
  );
}
