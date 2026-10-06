/**
 * The rooms of the building, and which studios live in each.
 *
 * WHY THIS IS A SEPARATE LIST FROM data/studios.ts
 *   A studio is a discipline the calendar tags events with. A room is a place
 *   with walls, a door and a colour of tape on its frame. They are not the same
 *   list and they never line up one-to-one: the woodshop is two rooms, the
 *   MegaStudio holds several disciplines at once, and the kitchen, darkroom and
 *   utilities are rooms that host no studio at all. Flattening the two into one
 *   list would force a lie in one direction or the other.
 *
 *   So `studios` here is an array of slugs pointing INTO studios.ts, which stays
 *   the single source of truth for what a studio is called and what icon it
 *   carries. Nothing about a studio is repeated here.
 *
 * WHERE THE GEOMETRY IS
 *   Not here. The building is drawn by hand in data/floorplan.svg and read by
 *   data/floorplan.ts; this file carries only what a room IS. That split is new
 *   as of 2026-10-05 and it is the right way round - the walls were previously
 *   recovered from a raster and the rooms were rectangles fitted to the same
 *   raster, so the two were tangled together and both were approximations.
 * */
import { STUDIO_BY_SLUG, type Studio } from './studios';
import type { Floor, Pt } from './floorplan';

export type { Floor, Pt };

export type Room = {
  slug: string;
  /** What the room is called. The old CAD drawing's wording until told otherwise. */
  name: string;
  floor: Floor;
  /**
   * Studio slugs housed here, pointing into studios.ts. Many-to-many on both
   * sides: the woodshop is in two rooms, and one room can hold several studios.
   * An empty array means "no studio in here", which is true of the kitchen and
   * the bathrooms - it is NOT the same as "not filled in yet", so a room whose
   * assignment is still unknown says so in `note`.
   */
  studios: string[];
  /**
   * The room's ZONE - its tape-marked area on the floor, clockwise.
   *
   * EVERY ROOM IS MISSING THIS as of 2026-10-05, and that is deliberate rather
   * than unfinished. The shapes were derived from the old CAD drawing and were
   * expressed in its pixels; the building is now drawn by hand in
   * data/floorplan.svg, in a coordinate system that shares nothing with it and
   * a layout that is not the same shape. Keeping the old numbers would have
   * rendered every zone somewhere plausible-looking and wrong, which is worse
   * than rendering none.
   *
   * A zone is still not a room and not a wall - Woodshop 1 and Woodshop 2 have
   * no wall between them, they are one room with tape on the floor - so these
   * come back by being drawn against the new plan, not by being inferred from
   * it. Until then a room is a row in the list and nothing on the drawing.
   */
  shape?: Pt[];
  /** Label anchor, when the shape's centre is the wrong place for it. */
  label?: Pt;
  /** Anything the drawing says about the room that the name does not. */
  note?: string;
};

export const ROOMS: Room[] = [
  // --- upstairs ------------------------------------------------------------
  //
  // Confirmed against data/floorplan.svg on 2026-10-05, from a marked-up export
  // of it. This is the real building; everything upstairs before this described
  // the old CAD layout and has been replaced rather than edited - that plan had
  // the laser, 3D printing, electronics and the VOC booths up here, and this one
  // has none of them.
  //
  // NOT a room: the staff desk, which sits open beside the west stairs. It is a
  // landmark rather than a space - "past the staff desk" is a direction, and
  // forcing it into this list would make it a place with no walls.
  {
    slug: 'garage', name: 'Garage', floor: 'upstairs',
    studios: [],
    note: 'Metal is getting an area at the back, so some metalworking happens here too.',
  },
  {
    slug: 'compressor-room', name: 'Compressor Room', floor: 'upstairs',
    studios: [],
  },
  {
    // The jewellery bench and the metal machines share this one. Deliberately
    // not "Metal Shop": metal also has an area at the back of the garage, and
    // two rooms called metal something is the one thing a wayfinding map cannot
    // afford. See *Naming rooms* in CLAUDE.md.
    slug: 'machine-shop', name: 'Machine Shop', floor: 'upstairs',
    studios: ['metalworking', 'lapidary'],
    note: 'Jewelry bench and the metal machines. Welding is in the garage, not here.',
  },
  {
    slug: 'woodshop-2', name: 'Woodshop 2', floor: 'upstairs',
    studios: ['woodshop'],
  },
  {
    slug: 'woodshop-1', name: 'Woodshop 1', floor: 'upstairs',
    studios: ['woodshop'],
  },
  {
    slug: 'sanding-room', name: 'Sanding Room', floor: 'upstairs',
    studios: [],
  },
  {
    slug: 'fume-room', name: 'Fume Room', floor: 'upstairs',
    studios: [],
  },
  {
    slug: 'darkroom-2', name: 'Darkroom', floor: 'upstairs',
    studios: [],
    note: 'There is a darkroom on the downstairs list too. Is that still there, or did it move up here?',
  },
  {
    // Kept as drawn. A proper name is the best kind for a room that hosts
    // changing things, and in a building where every discipline area is called
    // a studio, a generic one would be ambiguous in a way this is not.
    slug: 'megastudio', name: 'Megastudio', floor: 'upstairs',
    studios: [],
    note: 'The big flexible room. What lives in here now?',
  },
  {
    slug: 'restroom-2-west', name: 'Restroom', floor: 'upstairs',
    studios: [], note: 'All genders.',
  },
  {
    slug: 'restroom-2-east', name: 'Restroom', floor: 'upstairs',
    studios: [], note: 'All genders.',
  },
  {
    slug: 'fab-lab', name: 'Fab Lab', floor: 'upstairs',
    studios: [],
  },
  {
    slug: 'computer-lab', name: 'Computer Lab', floor: 'upstairs',
    studios: [],
    note: 'The brand icon sheet has a Computer Lab mark; studios.ts has no such studio yet.',
  },
  {
    slug: 'closet-2', name: 'Closet', floor: 'upstairs',
    studios: [],
  },
  {
    slug: 'stairs-2-west', name: 'Stairs', floor: 'upstairs',
    studios: [],
  },
  {
    slug: 'stairs-2-east', name: 'Stairs', floor: 'upstairs',
    studios: [],
  },

  // --- downstairs ----------------------------------------------------------
  //
  // NOT yet confirmed against the new drawing. These came off the old CAD plan,
  // which this building's layout does not match - the names are probably mostly
  // right and the arrangement is probably not. They stay until the downstairs
  // export comes back marked up, because a wrong-but-close list is a better
  // starting point for that than an empty one.
  {
    slug: 'kitchen', name: 'Kitchen', floor: 'downstairs',
    studios: [],
  },
  {
    slug: 'av-studio', name: 'A/V Studio', floor: 'downstairs',
    studios: ['av-studio'], note: 'Green screen.',
  },
  {
    slug: 'bathroom-1-west', name: "Women's Bathroom", floor: 'downstairs',
    studios: [], note: 'With a shower.',
  },
  {
    slug: 'bathroom-1-east', name: "Men's Bathroom", floor: 'downstairs',
    studios: [], note: 'With a shower.',
  },
  {
    slug: 'sewing', name: 'Sewing', floor: 'downstairs',
    studios: ['sewing'],
    note: 'Leatherworking too? It shares a calendar tag with sewing.',
  },
  {
    slug: 'crafts', name: 'Crafts', floor: 'downstairs',
    studios: ['arts-crafts'], note: 'Kits and general craft supplies.',
  },
  {
    slug: 'stairs-1-east', name: 'Stairs', floor: 'downstairs',
    studios: [], note: 'Up to Foyer 2, the metal shop and the garage.',
  },
  {
    slug: 'stairs-1-west', name: 'Stairs', floor: 'downstairs',
    studios: [], note: 'Up to Classroom 2 and the MegaStudio.',
  },
  {
    // The entrance is a re-entrant notch in the building's bottom-left corner;
    // the foyer wraps round the inside of it. Simplified to the two walls that
    // matter for finding the door.
    slug: 'foyer-1', name: 'Foyer 1', floor: 'downstairs',
    studios: [],
    note: 'The door to the street, and the project feature area.',
  },
  {
    slug: 'front-desk', name: 'Front Desk', floor: 'downstairs',
    studios: [], note: 'Reception. Sign in here.',
  },
  {
    slug: 'lounge', name: 'Lounge', floor: 'downstairs',
    studios: [],
  },
  {
    slug: 'office', name: 'Office', floor: 'downstairs',
    studios: [],
  },
  {
    slug: 'darkroom', name: 'Darkroom', floor: 'downstairs',
    studios: [],
  },
  {
    slug: 'storage-1', name: 'Storage 1', floor: 'downstairs',
    studios: [], note: 'Makerspace storage.',
  },
  {
    slug: 'utilities', name: 'Utilities', floor: 'downstairs',
    studios: [],
  },
  {
    slug: 'classroom-1', name: 'Classroom 1', floor: 'downstairs',
    studios: [],
    note: 'Event space, classroom and rentable space. Member storage at the back.',
  },
];

/** What each floor is called on the page. The geometry is floorplan.ts's. */
export const FLOOR_NAME: Record<Floor, { title: string; sub: string }> = {
  upstairs: { title: 'Upstairs', sub: '2nd floor' },
  downstairs: { title: 'Downstairs', sub: '1st floor' },
};

export const ROOM_BY_SLUG = new Map(ROOMS.map((r) => [r.slug, r]));

export function roomsOnFloor(floor: Floor): Room[] {
  return ROOMS.filter((r) => r.floor === floor);
}

/** Rooms housing a studio, in plan order. Empty for a studio with no room. */
export function roomsForStudio(slug: string): Room[] {
  return ROOMS.filter((r) => r.studios.includes(slug));
}

/** The studios in a room, resolved against studios.ts. */
export function studiosInRoom(room: Room): Studio[] {
  return room.studios.map((s) => STUDIO_BY_SLUG.get(s)!);
}

/**
 * Studios that no room claims yet. Rendered on the page rather than swallowed:
 * the whole point of keeping these two lists apart is that the gap between them
 * is visible, and a studio with nowhere to send somebody is the one thing this
 * page cannot do its job without.
 */
export function studiosWithoutRoom(): Studio[] {
  const placed = new Set(ROOMS.flatMap((r) => r.studios));
  return [...STUDIO_BY_SLUG.values()].filter((s) => !placed.has(s.slug));
}

/**
 * Throws rather than rendering a room pointing at a studio that does not exist.
 * A slug typo here would otherwise show as a room with a missing icon and no
 * name beside it, which looks like a styling bug and is not one. Runs at module
 * load, so it fails the build.
 */
for (const room of ROOMS) {
  for (const slug of room.studios) {
    if (!STUDIO_BY_SLUG.has(slug)) {
      throw new Error(`rooms.ts: room "${room.slug}" names studio "${slug}", which is not in studios.ts`);
    }
  }
}

const seen = new Set<string>();
for (const room of ROOMS) {
  if (seen.has(room.slug)) throw new Error(`rooms.ts: duplicate room slug "${room.slug}"`);
  seen.add(room.slug);
}
