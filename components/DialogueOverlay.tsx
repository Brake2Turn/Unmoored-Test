import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PortraitArt, hasPortrait } from '@/components/PortraitArt';
import { PILOT, faceFor, type Meeting } from '@/lib/dialogue';
import { fonts, palette, tracking } from '@/lib/theme';

/**
 * What is said on arriving at a star, over the top of the helm.
 *
 * The whole screen is the control: a pale wash over everything, a box near
 * the thumb, and a tap anywhere to move on. There is nothing to aim at,
 * because there is nothing to choose — the lines simply run out and the helm
 * comes back.
 *
 * **Which side the face sits on says who is speaking** before a word is read.
 * Each face sits on the same side as its ship on the space screen: the
 * player's pilot on the left, the other party on the right. (It was the other
 * way round while the ships were stacked, the other ship above; laying them
 * side by side put the player's ship on the left, and the faces followed.) The
 * name sits inside the box on the same side as the face it belongs to. That is
 * carried by `faceFor`, which recognises the player by name rather than by
 * position — encounter 9 opens with the pilot, and still puts the right face
 * on the right side.
 *
 * **A speaker without art has no face and keeps no room for one.** The
 * abandoned ship is the standing case, and the box closes up around it rather
 * than holding a portrait-shaped gap. The side still speaks: the name stays
 * left or right as it would have, so even a faceless line says who is talking.
 */

/** The wash. Light and thin: the ship underneath should still be readable. */
const VEIL = 'rgba(214, 224, 244, 0.13)';

/**
 * The portrait's square, inside the box on the speaker's side.
 *
 * The busts used to stand on top of the box, frameless and large, with the box
 * drawn over their foot to hide where each one is cut off. The author moved
 * them into the box, each in a square of its own: the cut at the bottom of
 * every bust now simply meets the bottom edge of its square.
 */
const FACE = 76;

/** Margin from the screen edge to the box. */
const GUTTER = 18;

/** The box's own inner margin. */
const BOX_PAD = 18;

const CARD: ViewStyle = {
  borderRadius: 16,
  borderWidth: 1.2,
  borderCurve: 'continuous',
  borderColor: 'rgba(255,255,255,0.22)',
  // Near-opaque: this sits over the ship, and the words have to win.
  backgroundColor: 'rgba(9,13,26,0.96)',
};

export function DialogueOverlay({
  meeting,
  bottom,
  onDone,
}: {
  meeting: Meeting;
  /** Clears the helm's own controls, which are still underneath. */
  bottom: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);

  const line = meeting.lines[step];
  const last = step >= meeting.lines.length - 1;

  const onTap = useCallback(() => {
    if (last) {
      onDone();
      return;
    }
    setStep((current) => current + 1);
  }, [last, onDone]);

  // `pendingMeeting` will not hand over an encounter with no lines, so this is
  // only reachable if the table shrank under a run in progress. Nothing to
  // say, nothing to draw — and never a call to `onDone` from inside a render.
  if (!line) return null;

  const isPilot = line.speaker === PILOT;
  const face = faceFor(meeting, line);

  // A speaker with no art gets no portrait and no room kept for one — see
  // `PortraitArt`. The abandoned ship is the standing case: nobody is aboard.
  const faced = hasPortrait(face);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `${line.speaker} says: ${line.text}. ` +
        `Line ${step + 1} of ${meeting.lines.length}. ` +
        `Tap to ${last ? 'finish' : 'continue'}`
      }
      onPress={onTap}
      style={[StyleSheet.absoluteFill, styles.veil]}
    >
      <View style={[styles.holder, { paddingBottom: bottom }]} pointerEvents="none">
        {/* The face on the speaker's own side — the pilot's on the left, the
            other party's on the right — and the words beside it. */}
        <View style={[styles.box, !isPilot && styles.boxOther]}>
          {faced ? (
            <View style={styles.face}>
              <PortraitArt entity={face} size={FACE} />
            </View>
          ) : null}

          <View style={styles.words}>
            <Text style={[styles.name, !isPilot && styles.nameOther]}>{line.speaker}</Text>
            <Text style={styles.text}>{line.text}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: VEIL, zIndex: 40, justifyContent: 'flex-end' },

  holder: { paddingHorizontal: GUTTER },

  box: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: BOX_PAD,
    minHeight: 112,
  },
  /** The other party's face sits on the right, so the row runs the other way. */
  boxOther: { flexDirection: 'row-reverse' },

  face: {
    width: FACE,
    height: FACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },

  words: { flex: 1 },

  /**
   * The name sits at the top of the words, on the speaker's side. It is never
   * cut short: a long one wraps.
   */
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.player,
    letterSpacing: tracking.caption,
    marginBottom: 8,
  },
  nameOther: { textAlign: 'right' },

  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: palette.textPrimary,
  },
});
