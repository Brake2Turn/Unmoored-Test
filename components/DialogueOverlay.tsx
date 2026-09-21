import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PortraitArt } from '@/components/PortraitArt';
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
 * The other party is on the left, the player's own pilot on the right, and the
 * name sits inside the box on the same side as the face it belongs to. That is
 * carried by `faceFor`, which recognises the player by name rather than by
 * position — encounter 9 opens with the pilot, and still puts the right face
 * on the right side.
 */

/** The wash. Light and thin: the ship underneath should still be readable. */
const VEIL = 'rgba(214, 224, 244, 0.13)';

/** Portrait size, and how much of it stands proud of the box's top edge. */
const FACE = 54;
const FACE_RISE = 22;

/**
 * Margin from the screen edge to the box, and from the box's edge to the face
 * inside it.
 *
 * The face is positioned against the *holder*, which carries the gutter, so
 * its offset has to include it — at a bare 14 the portrait hung off the left
 * of the card instead of sitting on its corner.
 */
const GUTTER = 18;
const FACE_INSET = GUTTER + 10;

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
        <View style={styles.box}>
          <View style={[styles.nameRow, isPilot && styles.nameRowPilot]}>
            <Text numberOfLines={1} style={styles.name}>
              {line.speaker}
            </Text>
          </View>

          <Text style={styles.text}>{line.text}</Text>

          {/* Which way out, and how far through. */}
          <View style={styles.footer}>
            {meeting.lines.map((_, index) => (
              <View
                key={index}
                style={[styles.pip, index === step && styles.pipHere]}
              />
            ))}
          </View>
        </View>

        {/* Sits proud of the box, on the speaker's own side. */}
        <View
          style={[
            styles.face,
            { top: -FACE_RISE },
            isPilot ? { right: FACE_INSET } : { left: FACE_INSET },
          ]}
        >
          <PortraitArt entity={face} size={FACE} />
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
    paddingTop: FACE_RISE + 12,
    paddingBottom: 14,
    paddingHorizontal: 18,
    minHeight: 128,
  },

  /** The name sits under the face, on the same side as it. */
  nameRow: { flexDirection: 'row', marginBottom: 8, paddingLeft: FACE - 4 },
  nameRowPilot: { justifyContent: 'flex-end', paddingLeft: 0, paddingRight: FACE - 4 },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: palette.player,
    letterSpacing: tracking.caption,
    marginRight: -tracking.caption,
  },

  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: palette.textPrimary,
  },

  footer: { flexDirection: 'row', alignSelf: 'flex-end', gap: 5, marginTop: 14 },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  pipHere: { backgroundColor: palette.player, width: 14 },

  face: { position: 'absolute' },
});
