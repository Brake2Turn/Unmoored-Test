import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';

import type { EntityId } from '@/lib/dialogue';
import { PORTRAIT_URIS } from '@/lib/portraits';

/**
 * One speaker's face: the supplied art, cut out, and nothing else.
 *
 * **No frame.** The portrait used to sit in a rounded card with a border and a
 * near-opaque backing, which was there to make a drawn placeholder glyph look
 * deliberate. The art is cut out against transparency, so a box around it only
 * put a window between the speaker and the scene — the bust reads better
 * standing straight on the sky.
 *
 * **No art means no portrait.** Every entity that should have a face now has
 * one; `abandonedShip` deliberately does not, because nobody is aboard to have
 * a face. So the lookup failing is not an error case to paper over with a
 * stand-in — it *is* the way an entity says it has nothing to show, and the
 * box simply runs its name and its line with the space given back.
 *
 * There used to be a table of drawn placeholders here for exactly that miss:
 * a head and one distinguishing mark per entity, square for a machine and
 * round for a person. It has gone with the frame. It was scaffolding for a
 * half-finished cast, and once the cast was finished nothing could render it —
 * a table of faces that cannot appear is a table that quietly rots. A new
 * entity added to `MEETINGS` now speaks faceless until its art arrives, which
 * is the same rule `abandonedShip` lives under.
 */
function photoFor(entity: EntityId): ImageSourcePropType | undefined {
  const uri = PORTRAIT_URIS[entity];
  return uri ? { uri } : undefined;
}

/**
 * Whether this speaker has a face at all.
 *
 * The overlay asks before it lays the box out, because a portrait is not only
 * drawn — it is also cleared for, above the box and beside the name. Without
 * this the faceless speakers would keep a portrait's worth of empty room.
 */
export function hasPortrait(entity: EntityId): boolean {
  return photoFor(entity) !== undefined;
}

export function PortraitArt({ entity, size }: { entity: EntityId; size: number }) {
  const photo = photoFor(entity);
  if (!photo) return null;

  // `contain` rather than `cover`: with no frame to fill there is nothing to
  // crop against, and a bust that has lost its shoulders looks like a mistake.
  return <Image source={photo} style={{ width: size, height: size }} resizeMode="contain" />;
}
