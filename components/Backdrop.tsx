import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

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
 * Everything behind the starfield: the gradient sky, two nebula blooms, and a
 * lit planet rising from the lower edge.
 *
 * The blooms and the planet are SVG radial gradients — React Native views can
 * only do linear ones, and the soft falloff is what sells the depth.
 */
export function Backdrop({ width, height, variant = 'title' }: Props) {
  const deep = variant === 'deep';
  // The planet sits mostly below the lower edge, so only its lit crown shows.
  const planetRadius = (width * 0.86) / 2;
  const planetCentreY = height + planetRadius * 0.34;
  const bloomAlpha = deep ? 0.45 : 1;

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
        </Defs>

        <Circle cx={width * 0.22} cy={height * 0.26} r={width * 0.59} fill="url(#violet)" />
        <Circle cx={width * 0.86} cy={height * 0.62} r={width * 0.47} fill="url(#teal)" />

        {deep ? null : (
          <>
            <Circle cx={width / 2} cy={planetCentreY} r={planetRadius} fill="url(#planet)" />
    
            {/* Three fading strokes stand in for a blurred atmospheric rim —
                React Native SVG has no dependable blur filter. */}
            <Circle
              cx={width / 2}
              cy={planetCentreY}
              r={planetRadius}
              fill="none"
              stroke={palette.accent}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
            <Circle
              cx={width / 2}
              cy={planetCentreY}
              r={planetRadius + 3}
              fill="none"
              stroke={palette.accent}
              strokeOpacity={0.16}
              strokeWidth={3}
            />
            <Circle
              cx={width / 2}
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
