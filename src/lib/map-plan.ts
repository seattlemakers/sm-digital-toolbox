/**
 * How /map paints the plan. Not facts about the building.
 *
 * Split out of the data on 2026-10-10. "Which studios work in here" is a fact
 * and belongs in data/space; "we do not print this room's name on our drawing"
 * is a decision about one picture, and leaving it in the data made the shared
 * file describe a drawing rather than a building.
 *
 * The line between them is not where it first looks. `kind` reads like
 * rendering because it only ever becomes a fill colour - but "is this a
 * workshop, a corridor, or neither" is a question about the building, so its
 * inputs (`studios`, `studiosWithin`, `circulation`) are data and only the
 * folding-into-three-buckets is here.
 */
import { SPACE_BY_ID, type Space } from '../data/space';

export type Kind = 'studio' | 'resource' | 'circulation' | 'room';

/**
 * What a space is FOR, which is the one thing worth colouring it by.
 *
 * The drawing's own fills are a map-colouring rather than a key - adjacent
 * spaces are given different colours so they can be told apart, which is why
 * the two woodshops do not share one and neither do the two ceramics rooms.
 * Useful while drawing, unreadable on a finished map: every room shouts and
 * nothing means anything.
 *
 * Three kinds is the most a plan can carry before the colours stop being a key
 * again:
 *
 *   studio       - somebody's discipline works here, in the space itself or in
 *                  one of its zones.
 *   resource     - the sanding room, the computer lab: maintained, taught in
 *                  and tagged like a studio, but not one you hold a membership
 *                  to. Added 2026-10-10 - see `Resource` in data/space.
 *   circulation  - how you get between the others. Takes the floorplate's own
 *                  colour, because a corridor IS the leftover floor.
 *   room         - everything else, from the kitchen to a broom closet.
 *
 * Studio wins over resource where a room has one of each - which cannot happen
 * in a space itself, because data/space throws on it, but can happen to a room
 * whose zones differ. The Lower Commons is the case: leather and arts & crafts
 * sit in it, and it is a studio room that also holds a resource.
 */
export const kindOf = (space: Space): Kind =>
  space.studios.length > 0 || space.studiosWithin.length > 0
    ? 'studio'
    : space.resource
      ? 'resource'
      : space.circulation
        ? 'circulation'
        : 'room';

/**
 * Spaces the plan knows about and does not name.
 *
 * Sixteen of the fifty-seven are a hallway, a staircase, a closet or the Big
 * Room's storage corner. Named, they are most of the ink on the plan and none
 * of the answer: nobody opens a map to find the hallway, and a cupboard
 * labelled CLOSET tells you only that somebody drew a cupboard.
 *
 * It costs nothing because **the walls come from the wall layer, not from these
 * shapes** - a closet is still a walled box exactly where it is and a staircase
 * still has its treads. What goes is the fill and the name, and a staircase
 * drawn with treads and no label is still obviously a staircase, which is the
 * test the label was failing. The name comes back on hover.
 *
 * The Landing joined them on 2026-10-06. The argument for keeping it was that a
 * landing is where you come OUT of the stairs, which is the one thing about a
 * staircase worth naming - true in the abstract, and wrong here: it is a
 * 49-unit slot between a restroom and a stair, in the corner of the floor that
 * already carries the most ink, with the name wedged in. The stairs beside it
 * say what it is.
 *
 * The Check-in desk is circulation too and is deliberately NOT in here: it is
 * somewhere you get sent, so it has to be findable by name.
 *
 * IDS, NOT A NAME PATTERN, as of 2026-10-10. This was
 * `/^(Stairs|Hallway|Landing|Storage|.*\bCloset)$/` matched against the name -
 * and the name comes from `floorplan.svg`, which has been hand-edited four
 * times, twice to rename a space. A rename would silently erase a room's label
 * or hand one back, with nothing failing and nobody looking. Ids are checked
 * against the drawing by the loop at the bottom of this file, so a redraw that
 * drops one of these fails the build instead.
 */
export const UNLABELLED_IDS: readonly string[] = [
  // upstairs
  'U13', // Hallway
  'U14', // Closet
  'U18', // Stairs
  'U20', // Hallway
  'U21', // Hallway
  'U22', // Landing
  'U23', // Stairs
  // downstairs
  'D1.3', // Storage, a zone of the Lower Commons - a zone keeps its dashed
  // boundary either way, so only the name goes
  'D2', // Utility Room
  'D8', // Closet
  'D9', // Closet
  'D18', // Stairs
  'D19', // Closet
  'D20', // Closet
  'D22', // Hallway
  'D23', // Stairs
];

const UNLABELLED = new Set(UNLABELLED_IDS);

/** Whether the plan prints this space's name. The hover shows it either way. */
export const isLabelled = (space: Space): boolean => !UNLABELLED.has(space.id);

// The check the name pattern could never do: an id here that the drawing has
// dropped means a redraw renamed or removed a space, and the list above is now
// quietly wrong about a different one.
for (const id of UNLABELLED_IDS) {
  if (!SPACE_BY_ID.has(id)) {
    throw new Error(`map-plan.ts: UNLABELLED_IDS has "${id}", which is not a room or zone in floorplan.svg`);
  }
}
