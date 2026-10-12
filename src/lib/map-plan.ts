/**
 * How /map paints the plan. Not facts about the building.
 *
 * Split out of the data on 2026-10-10. "Which studios work in here" and "who
 * may use it" are facts and belong in data/space; "this name is set small and
 * grey" is a decision about one picture, and leaving it in the data made the
 * shared file describe a drawing rather than a building.
 */
import { SPACE_BY_ID, type Space } from '../data/space';

/**
 * TWO LABEL STYLES, AND NO MORE. The 2026-10-11 handoff settled this after
 * trying four hierarchies: a label is either BOLD or QUIET, and an unnamed zone
 * has NONE.
 *
 *   bold    every named zone by default - the studios, the resources, the
 *           kitchen, the check-in desk. Ink, 650, at the size the data holds.
 *   quiet   the spaces you look for only when you need them: anything staff
 *           only, the restrooms, the compressor room. Grey, 450, smaller.
 *   none    hallways, stairs, the landing. The walls say what they are.
 *
 * "Staff only" comes from the access rows, so a closet that becomes a members
 * space turns bold by itself. The restrooms and the compressor room are listed
 * BY ID, not matched by name: a name is edited far more often than anything
 * else here, and a rename would silently move a label between styles with
 * nothing failing. The ids are checked against the drawing at module load.
 *
 * The old UNLABELLED_IDS list - sixteen spaces whose names the plan did not
 * print - went with this. Its job is done by `name === null`, which the
 * handoff made a property of the zone itself.
 */
export type LabelStyle = 'bold' | 'quiet' | 'none';

export const QUIET_IDS: readonly string[] = [
  'U2.1', // Compressor Room
  'U11.1', // Restroom
  'U12.1', // Restroom
  'D11.1', // Men's Restroom
  'D13.1', // Women's Restroom
];

const QUIET = new Set(QUIET_IDS);

export const labelStyle = (space: Space): LabelStyle =>
  space.name === null ? 'none' : space.access === 'staff' || QUIET.has(space.id) ? 'quiet' : 'bold';

/**
 * The type the plan sets, in drawing units where it is a size.
 *
 * Sizes for bold and quiet are NOT here: they are on each zone in floorplan.ts,
 * because the author's line breaks were wrapped at that size and the two have
 * to travel together. What is here is everything else the handoff fixed.
 *
 *   lh     line height, as a multiple of the size
 *   gap    the space between a name and its tagline: the name's own half-leading
 *          plus `gap` tagline-sizes
 *   adv    Figtree's average advance as a fraction of its size, used to wrap a
 *          tagline against its zone's width. It only has to be close; the cap
 *          at load measures the real shaped text.
 */
export const LABEL = {
  bold: { weight: 650, lh: 1.08 },
  quiet: { weight: 450, lh: 1.12 },
  tag: { size: 7, weight: 450, lh: 1.15, gap: 1.25, adv: 0.62 },
} as const;

// An id here that the drawing has dropped means a redraw renamed or removed a
// zone, and the list above is now quietly wrong about a different one.
for (const id of QUIET_IDS) {
  const sp = SPACE_BY_ID.get(id);
  if (!sp) throw new Error(`map-plan.ts: QUIET_IDS has "${id}", which is not a room or zone in floorplan.ts`);
  if (sp.name === null) throw new Error(`map-plan.ts: QUIET_IDS has "${id}", which has no name to set quietly`);
}
