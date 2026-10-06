/**
 * What the drawing cannot know about each space.
 *
 * The floorplan now names and shapes every room and zone itself, so this file
 * stopped being a list of rooms on 2026-10-05 and became a list of *notes* on
 * them, keyed by the drawing's own ids. Everything that was duplicated - the
 * name, the outline, which floor it is on - is gone, because the drawing is the
 * one place it is stated and a second copy is a second copy.
 *
 * What is left is the two things a floorplan genuinely cannot say: which
 * studios work in a space, and what we are still unsure about.
 *
 * ROOMS AND ZONES BOTH TAKE A KEY, and which one gets the studio is the whole
 * point of having both. "Laser Cutting Studio" is a zone inside the Fab Lab, so
 * laser-cutting is pinned to `U15.2` and not to `U15` - the map can then say
 * "the Fab Lab, laser end" rather than just "the Fab Lab". Where a room has no
 * zones, the studio goes on the room.
 *
 * STUDIO SLUGS POINT INTO studios.ts, which stays the single source of truth
 * for what a studio is called and which icon it carries. A slug that does not
 * resolve throws at module load, which fails the build - a typo would otherwise
 * render as a space with a missing icon and no name beside it, which looks like
 * a styling bug and is not one. An id that is not in the drawing throws too, so
 * a room renamed or removed in a redraw cannot leave an orphaned note behind.
 */
import { STUDIO_BY_SLUG } from './studios';
import { FLOORPLAN, FLOORS, type Floor, type Room, type Zone } from './floorplan';

export type Place = {
  /** Studio slugs working in this space. Empty is a fact, not a gap. */
  studios?: string[];
  /** Anything worth saying that the plan does not. A `?` marks it unresolved. */
  note?: string;
};

export const PLACES: Record<string, Place> = {
  // --- upstairs ------------------------------------------------------------
  'U1': { note: 'The big roll-up door. Metalshop 1 and the big CNC are zones inside it.' },
  'U1.1': { studios: ['metalworking'] },
  'U1.2': { studios: ['cnc'] },
  'U3': { studios: ['metalworking'], note: 'Jewelry bench is in here too — does lapidary belong on this room?' },
  'U4': { note: 'Open to the room rather than walled off; a landmark more than a space.' },
  'U5': { studios: ['woodshop'] },
  'U5.1': { studios: ['cnc'] },
  'U6': { studios: ['woodshop'] },
  'U10': { note: 'The big flexible room. Electronics and screen printing are zones in it.' },
  'U10.1': { studios: ['electronics'] },
  'U10.2': { studios: ['screen-printing'] },
  'U15': { note: '3D printing and laser cutting are zones in it.' },
  'U15.1': { studios: ['3d-printing'] },
  'U15.2': { studios: ['laser-cutting'] },
  'U16': {
    note: 'The brand icon sheet has a Computer Lab mark and studios.ts has no such studio — add one?',
  },
  'U11': { note: 'All genders.' },
  'U12': { note: 'All genders.' },

  // --- downstairs ----------------------------------------------------------
  'D1': { note: 'Five zones, including the event space and the mini makerspace.' },
  'D1.1': { note: 'Which studios are the maker studios? Nothing on the plan says.' },
  'D1.2': { studios: ['leatherworking'] },
  'D3': { studios: ['av-studio'] },
  'D10': { studios: ['sewing'], note: 'Does leatherworking also happen here? It shares a calendar tag with sewing.' },
  'D12': { studios: ['ceramics'] },
  'D14': { studios: ['ceramics'] },
  'D15': { studios: ['ceramics'] },
  'D16': { studios: ['ceramics'] },
  'D7': { note: 'The street door. Check in here.' },
};

/** Every room and zone the drawing carries, with its floor and its notes. */
export type Spot = (Room | Zone) & {
  floor: Floor;
  kind: 'room' | 'zone';
  /** For a zone, the room it sits in. */
  room?: string;
  studios: string[];
  note?: string;
};

export const SPOTS: Spot[] = FLOORS.flatMap((floor) => [
  ...FLOORPLAN[floor].rooms.map((r) => ({
    ...r,
    floor,
    kind: 'room' as const,
    studios: PLACES[r.id]?.studios ?? [],
    note: PLACES[r.id]?.note,
  })),
  ...FLOORPLAN[floor].zones.map((z) => ({
    ...z,
    floor,
    kind: 'zone' as const,
    studios: PLACES[z.id]?.studios ?? [],
    note: PLACES[z.id]?.note,
  })),
]);

export const SPOT_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

/** Where a studio works. A zone answers with the room it is in, too. */
export function spotsForStudio(slug: string): Spot[] {
  return SPOTS.filter((s) => s.studios.includes(slug));
}

/** "Fab Lab, laser cutting studio" - a zone says which room it is in. */
export function placeOf(spot: Spot): string {
  if (spot.kind === 'room') return spot.name;
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
  return [...STUDIO_BY_SLUG.values()].filter((s) => !placed.has(s.slug));
}

/** Spaces whose note asks a question, so the open ones stay visible. */
export const OPEN_QUESTIONS = SPOTS.filter((s) => s.note?.includes('?'));

// A note on a space the drawing does not have is a note about a building that
// no longer exists - far more likely after a redraw than a typo here.
for (const id of Object.keys(PLACES)) {
  if (!SPOT_BY_ID.has(id)) {
    throw new Error(`rooms.ts: "${id}" is not a room or zone in floorplan.svg`);
  }
}

for (const spot of SPOTS) {
  for (const slug of spot.studios) {
    if (!STUDIO_BY_SLUG.has(slug)) {
      throw new Error(`rooms.ts: "${spot.id}" names studio "${slug}", which is not in studios.ts`);
    }
  }
}
