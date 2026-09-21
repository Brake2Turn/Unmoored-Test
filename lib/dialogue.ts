/**
 * Who is out at a star, and what is said on arriving there.
 *
 * **This table is provisional.** It is a first pass, written to get dialogue
 * working end to end, and the author expects to rewrite entries, add new ones
 * and drop others. Editing this list is therefore the whole job: nothing
 * anywhere counts the rows, assumes a particular id, or hard-codes how many
 * of each kind there are. The sector deals whatever it finds here (see
 * `assignMeetings` in `sectorMap.ts`), and `verify:map` checks that deal
 * against this table's own length rather than against a number written down
 * somewhere else. Add an eleventh encounter and everything follows.
 *
 * Transcribed from the author's spreadsheet rather than typed out, so the
 * lines are exactly as written. Two things were normalised: the first line of
 * encounter 5 spelled the speaker "Illeagal Merchant" where its later lines
 * spell it "Illegal Merchant", and that is one speaker; and the spoken name
 * is kept as written even where it differs from the entity it belongs to —
 * "Unmoored" speaks for the Fellow Unmoored, "Convict" for the Escaped
 * Convict. The spoken name is what the box shows; `entity` only picks the
 * face beside it.
 *
 * Imports nothing, like the other rule tables, so it runs under bare node in
 * the verify script.
 */

/** What the encounter is for. Only `combat` costs a hostile jump charge. */
export type MeetingKind = 'combat' | 'trader' | 'conversation';

/** Which of the two ships we already draw turns up. */
export type HullClass = 'red' | 'yellow';

/**
 * Who the player is talking to, and so which placeholder face is shown.
 *
 * `pilot` is the player and never appears as an encounter's `entity`; it is
 * in the union because the portrait table has to cover the speaker of every
 * line, and half the lines are the player's own.
 */
export type EntityId =
  | 'pilot'
  | 'abandonedShip'
  | 'ai'
  | 'convict'
  | 'illegalMerchant'
  | 'merchant'
  | 'pirate'
  | 'spacePolice'
  | 'spaceTrucker'
  | 'unmoored';

/** One thing said by one speaker. */
export type Line = {
  /** Shown above the text, exactly as the author wrote it. */
  speaker: string;
  text: string;
};

export type Meeting = {
  id: number;
  kind: MeetingKind;
  /** The other party. Picks the face; the spoken name comes off each line. */
  entity: EntityId;
  hull: HullClass;
  lines: Line[];
};

/** Everything a star can hold. Order is the spreadsheet's. */
export const MEETINGS: Meeting[] = [
  {
    id: 1,
    kind: 'combat',
    entity: 'ai',
    hull: 'red',
    lines: [
      { speaker: 'AI', text: '*prepare for assimilation*' },
      { speaker: 'Pilot', text: 'Fucking clanker' },
    ],
  },
  {
    id: 2,
    kind: 'combat',
    entity: 'pirate',
    hull: 'red',
    lines: [
      { speaker: 'Pirate', text: 'Hey buddy, you got anything good in that cargo bay?' },
      { speaker: 'Pilot', text: 'Who wants to know?' },
      { speaker: 'Pirate', text: 'Okay lets cut to the chase…' },
    ],
  },
  {
    id: 3,
    kind: 'combat',
    entity: 'spacePolice',
    hull: 'red',
    lines: [
      { speaker: 'Space Police', text: 'You match the description of someone we\'re searching for. Prepare to be boarded.' },
      { speaker: 'Pilot', text: 'Board this pig…' },
    ],
  },
  {
    id: 4,
    kind: 'trader',
    entity: 'merchant',
    hull: 'yellow',
    lines: [
      { speaker: 'Merchant', text: 'Hey traveller, I got some wares if you need.' },
      { speaker: 'Pilot', text: 'Yeah I\'ll take a look.' },
    ],
  },
  {
    id: 5,
    kind: 'trader',
    entity: 'illegalMerchant',
    hull: 'yellow',
    lines: [
      { speaker: 'Illegal Merchant', text: 'Hey champ, move along if you know what\'s good for you.' },
      { speaker: 'Pilot', text: 'I heard you got some good stuff.' },
      { speaker: 'Illegal Merchant', text: 'I don\'t know what you\'re talking about.' },
      { speaker: 'Pilot', text: 'I got the creds.' },
      { speaker: 'Illegal Merchant', text: 'Okay fine…' },
    ],
  },
  {
    id: 6,
    kind: 'conversation',
    entity: 'spaceTrucker',
    hull: 'yellow',
    lines: [
      { speaker: 'Space Trucker', text: 'Long hauling today!' },
    ],
  },
  {
    id: 7,
    kind: 'conversation',
    entity: 'unmoored',
    hull: 'yellow',
    lines: [
      { speaker: 'Unmoored', text: 'There are some Space Police in the area. Watch out!' },
      { speaker: 'Pilot', text: 'Thanks man.' },
    ],
  },
  {
    id: 8,
    kind: 'conversation',
    entity: 'spacePolice',
    hull: 'yellow',
    lines: [
      { speaker: 'Space Police', text: 'We\'re looking for an escaped convict, have you seen them at all?' },
      { speaker: 'Pilot', text: 'Nah haven\'t seen a thing.' },
      { speaker: 'Space Police', text: 'Hmmmm okay.' },
    ],
  },
  {
    id: 9,
    kind: 'conversation',
    entity: 'abandonedShip',
    hull: 'yellow',
    lines: [
      { speaker: 'Pilot', text: 'Hello? Anyone there?' },
      { speaker: 'Abandoned Ship', text: '…' },
    ],
  },
  {
    id: 10,
    kind: 'conversation',
    entity: 'convict',
    hull: 'yellow',
    lines: [
      { speaker: 'Convict', text: 'Fuck off, we\'re trying to get away from some pigs.' },
    ],
  },
];

/** The player's own speaker name, as the lines spell it. */
export const PILOT = 'Pilot';

/** A meeting by id, or undefined if the table no longer carries that one. */
export function meetingById(id: number): Meeting | undefined {
  return MEETINGS.find((meeting) => meeting.id === id);
}

/**
 * Which face a line wears.
 *
 * The player is recognised by the speaker name rather than by position, so a
 * rewritten encounter that opens with the pilot — encounter 9 does — still
 * puts the right face on the right line.
 */
export function faceFor(meeting: Meeting, line: Line): EntityId {
  return line.speaker === PILOT ? 'pilot' : meeting.entity;
}
