/**
 * What the drawing cannot know about each space.
 *
 * The floorplan names and shapes every room and zone itself, so this file is
 * one mapping and nothing else: the drawing's own id, and the studios that work
 * in that space. Everything that was duplicated - the name, the outline, which
 * floor it is on - is gone, because the drawing is the one place it is stated
 * and a second copy is a second copy.
 *
 * It carried prose notes about particular spaces until 2026-10-05 and does not
 * any more. What a space is for is a studio slug; everything else about it was
 * a caption, and a caption on a plan is a thing to keep current forever.
 *
 * ROOMS AND ZONES BOTH TAKE A KEY, and which one gets the studio is the whole
 * point of having both. "Laser Cutting Studio" is a zone inside the Fab Lab, so
 * laser-cutting is pinned to `U15.2` and not to `U15` - the map can then say
 * "the Fab Lab, laser end" rather than just "the Fab Lab". Where a room has no
 * zones, the studio goes on the room.
 *
 * STUDIO SLUGS POINT INTO space-studios.ts, which is the map's own list and
 * not the calendar's - see the note at the top of that file. A slug that does
 * not
 * resolve throws at module load, which fails the build - a typo would otherwise
 * render as a space with a missing icon and no name beside it, which looks like
 * a styling bug and is not one. An id that is not in the drawing throws too, so
 * a room renamed or removed in a redraw cannot leave an orphaned note behind.
 */
import { SPACE_STUDIOS, SPACE_STUDIO_BY_SLUG } from './space-studios';
import { FLOORPLAN, FLOORS, type Floor, type Room, type Zone } from './floorplan';

/** Which studios work in a space, keyed by the drawing's own id. */
export const STUDIOS_IN: Record<string, string[]> = {
  // --- upstairs ------------------------------------------------------------
  'U1.1': ['metalworking'],
  'U1.2': ['cnc-routing'],
  // Metal Studios is the container; both halves are zones, so the parent
  // carries nothing - the same as the Garage, the Fab Lab and the Megastudio.
  // A room that is entirely subdivided is named for what it holds rather than
  // for any one of the things it holds.
  'U3.1': ['jewelry'],
  'U3.2': ['metalworking'],
  'U5': ['woodshop'],
  'U5.1': ['cnc-routing'],
  'U6': ['woodshop'],
  'U10.1': ['electronics'],
  'U10.2': ['screen-printing'],
  'U15.1': ['3d-printing'],
  'U15.2': ['laser-cutting'],
  'U16': ['computer-lab'],

  // --- downstairs ----------------------------------------------------------
  // D1.1 is the Builder Studios, which are rented rather than taught in, so no
  // slug: studios.ts is the list of things the calendar tags classes with.
  'D1.2': ['leather-studio'],
  'D1.5': ['arts-crafts'],
  'D3': ['av-studio'],
  'D10': ['sewing'],
  'D12': ['ceramics'],
  'D14': ['ceramics'],
  'D15': ['ceramics'],
  'D16': ['ceramics'],
};

/**
 * What a space is FOR, which is the one thing worth colouring it by.
 *
 * The drawing's own fills are a map-colouring rather than a key - adjacent
 * spaces are given different colours so they can be told apart, which is why
 * the two woodshops do not share one and neither do the two ceramics rooms.
 * Useful while drawing, unreadable on a finished map: every room shouts and
 * nothing means anything.
 *
 * So the plan is coloured by use instead. Three kinds is the most a plan can
 * carry before the colours stop being a key again:
 *
 *   studio       - somebody's discipline works here. The thing people come to
 *                  this map to find, so it is the only tinted thing on it.
 *   circulation  - how you get between the others. Takes the floorplate's own
 *                  colour, because a corridor IS the leftover floor.
 *   room         - everything else, from the kitchen to a broom closet.
 *
 * Circulation is matched by name against a short list rather than inferred.
 * The drawing corroborates it exactly: the author gave all four staircases one
 * fill and all five hallways-and-landings another, without being asked to. The
 * Lobby is deliberately NOT in the list, and the drawing agrees - it is a place
 * you wait rather than a place you pass through.
 */
export type Kind = 'studio' | 'circulation' | 'room';

const CIRCULATION = /^(Stairs|Hallway|Landing|Check-in)$/;

/**
 * Spaces the plan does not draw or label, though it still knows about them.
 *
 * Fourteen of the forty-three spaces are a hallway, a staircase or a closet.
 * Drawn and named they are most of the ink on the plan and none of the answer:
 * nobody opens a map to find the hallway, and a cupboard labelled CLOSET tells
 * you only that somebody drew a cupboard.
 *
 * They stay in the data, and the walls are drawn from the wall layer rather
 * than from these shapes - so a closet is still a walled box on the plan and a
 * staircase still has its treads, both exactly where they are. What goes is the
 * fill and the name. A staircase drawn with treads and no label is still
 * obviously a staircase, which is the test this passes and the label failed.
 *
 * The Landing and the Check-in desk are circulation too and are NOT in here.
 * Check-in is somewhere you are sent; a landing is where you come out of the
 * stairs, which is the one thing about the stairs worth naming.
 */
const UNDRAWN = /^(Stairs|Hallway|.*\bCloset)$/;

/** Every room and zone the drawing carries, with its floor and its studios. */
export type Spot = (Room | Zone) & {
  floor: Floor;
  shape: 'room' | 'zone';
  kind: Kind;
  /** False for the hallways, stairs and closets - see UNDRAWN. */
  drawn: boolean;
  /** For a zone, the room it sits in. */
  room?: string;
  studios: string[];
};

/**
 * A room counts as a studio when one of its ZONES has one, not only when it
 * does itself. The Fab Lab carries no studio of its own - laser cutting and 3D
 * printing are zones inside it - and a map that left it the same colour as a
 * broom cupboard would be wrong about the most useful room on the floor.
 */
export const SPOTS: Spot[] = FLOORS.flatMap((floor) => {
  const zoneStudios = (roomId: string) =>
    FLOORPLAN[floor].zones.filter((z) => z.room === roomId).flatMap((z) => STUDIOS_IN[z.id] ?? []);

  const kindOf = (name: string, studios: string[]): Kind =>
    studios.length > 0 ? 'studio' : CIRCULATION.test(name) ? 'circulation' : 'room';

  return [
    ...FLOORPLAN[floor].rooms.map((r) => {
      const studios = STUDIOS_IN[r.id] ?? [];
      return {
        ...r,
        floor,
        shape: 'room' as const,
        kind: kindOf(r.name, [...studios, ...zoneStudios(r.id)]),
        drawn: !UNDRAWN.test(r.name),
        studios,
      };
    }),
    ...FLOORPLAN[floor].zones.map((z) => {
      const studios = STUDIOS_IN[z.id] ?? [];
      return {
        ...z,
        floor,
        shape: 'zone' as const,
        kind: kindOf(z.name, studios),
        drawn: true,
        studios,
      };
    }),
  ];
});

export const SPOT_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

/** Where a studio works. A zone answers with the room it is in, too. */
export function spotsForStudio(slug: string): Spot[] {
  return SPOTS.filter((s) => s.studios.includes(slug));
}

/** "Fab Lab, laser cutting studio" - a zone says which room it is in. */
export function placeOf(spot: Spot): string {
  if (spot.shape === 'room') return spot.name;
  const room = SPOT_BY_ID.get(spot.room!);
  return room ? `${room.name}, ${spot.name.toLowerCase()}` : spot.name;
}

/**
 * Studios that no space claims. Rendered rather than swallowed: the whole point
 * of keeping the drawing and the studio list apart is that the distance between
 * them is visible, and a studio with nowhere to send somebody is the one thing
 * this map cannot do its job without.
 */
export function studiosWithoutSpot() {
  const placed = new Set(SPOTS.flatMap((s) => s.studios));
  return SPACE_STUDIOS.filter((s) => !placed.has(s.slug));
}

/** "3 hallways, 2 staircases and a closet" - what the plan leaves unlabelled. */
export function undrawnOn(floor: Floor): string {
  const names = SPOTS.filter((s) => s.floor === floor && !s.drawn).map((s) =>
    s.name.replace(/.*\bCloset$/, 'closet').replace('Hallway', 'hallway').replace('Stairs', 'staircase'),
  );
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  // Words rather than numerals, because this is a sentence rather than a
  // count - "one closet, 2 staircases" reads as two different kinds of fact.
  const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const parts = [...counts].map(([n, c]) =>
    c === 1 ? `one ${n}` : `${WORDS[c] ?? c} ${n}${n.endsWith('s') ? 'es' : 's'}`,
  );
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// A studio pinned to a space the drawing does not have is a studio in a
// building that no longer exists - far more likely after a redraw than a typo.
for (const id of Object.keys(STUDIOS_IN)) {
  if (!SPOT_BY_ID.has(id)) {
    throw new Error(`rooms.ts: "${id}" is not a room or zone in floorplan.svg`);
  }
}

for (const spot of SPOTS) {
  for (const slug of spot.studios) {
    if (!SPACE_STUDIO_BY_SLUG.has(slug)) {
      throw new Error(`rooms.ts: "${spot.id}" names studio "${slug}", which is not in space-studios.ts`);
    }
  }
}
