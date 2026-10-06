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
 *
 * TAPE COLOURS are read off the drawing's key, in its own order. They stand for
 * real tape on real door frames, so they are wayfinding rather than decoration -
 * "the room with the yellow tape" is a direction somebody can follow.
 */
import { STUDIO_BY_SLUG, type Studio } from './studios';
import type { Floor, Pt } from './floorplan';

export type { Floor, Pt };

export type Room = {
  slug: string;
  /** What the room is called. The old CAD drawing's wording until told otherwise. */
  name: string;
  /** The code from the drawing's key. Null for rooms the key does not list. */
  code: string | null;
  floor: Floor;
  /** Tape colour on the door frame, as the key draws it. Null = beige/white. */
  tape: string | null;
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
  /** Code-chip anchor, for a shape whose top-left corner is in another room. */
  chip?: Pt;
  /** Anything the drawing says about the room that the name does not. */
  note?: string;
};

export const TAPE = {
  orange: '#ff9d01',
  red: '#ff0100',
  green: '#22ca22',
  yellow: '#f5fc01',
  blue: '#292ad0',
  purple: '#bf5ad1',
  pink: '#fe9dee',
  brown: '#98640f',
  cyan: '#06c7ff',
  /** The key's "can be beige or white" bracket - most of the building. */
  beige: '#f5d29c',
} as const;

export const ROOMS: Room[] = [
  // ------------------------------------------------------------- upstairs ---
  {
    slug: 'classroom-2', name: 'Classroom 2', code: 'C2', floor: 'upstairs',
    tape: TAPE.beige, studios: [], note: 'Small classes and work area.',
  },
  {
    // The drawing's "Storage?" box is a callout with leader lines, not a room -
    // the stair hatch runs on underneath it - so it is a note here rather than
    // a rectangle. Drawn as one, it sat on top of the stairs.
    slug: 'stairs-2-west', name: 'Stairs', code: null, floor: 'upstairs',
    tape: null, studios: [],
    note: 'Down to the lounge and the front desk. The drawing marks storage under them.',
  },
  {
    slug: 'megastudio', name: 'The MegaStudio', code: 'MS', floor: 'upstairs',
    tape: TAPE.blue, studios: ['screen-printing'],
    note: 'The drawing puts screen printing in the corner. What else lives here?',
  },
  {
    slug: '3d-printing', name: '3D Printing', code: '3', floor: 'upstairs',
    tape: TAPE.orange, studios: ['3d-printing'],
  },
  {
    // An L: the room wraps under the 3D printing bay and up its right-hand side.
    slug: 'laser', name: 'Laser', code: 'L', floor: 'upstairs',
    tape: TAPE.red, studios: ['laser-cutting'],
  },
  {
    slug: 'bathroom-2-west', name: 'Bathroom', code: null, floor: 'upstairs',
    tape: null, studios: [],
  },
  {
    slug: 'bathroom-2-east', name: 'Bathroom', code: null, floor: 'upstairs',
    tape: null, studios: [],
  },
  {
    slug: 'electronics', name: 'Electronics', code: 'E', floor: 'upstairs',
    tape: TAPE.green, studios: ['electronics'],
  },
  {
    slug: 'high-voc', name: 'High VOC', code: 'VOC', floor: 'upstairs',
    tape: TAPE.beige, studios: [], note: 'Painting booth.',
  },
  {
    slug: 'low-voc', name: 'Low VOC', code: 'VOC', floor: 'upstairs',
    tape: TAPE.beige, studios: [], note: 'Staining and finishing.',
  },
  {
    slug: 'cnc', name: 'CNC', code: 'CNC', floor: 'upstairs',
    tape: TAPE.beige, studios: ['cnc'], note: 'The 4x4 router.',
  },
  {
    slug: 'woodshop-1', name: 'Woodshop 1', code: 'W1', floor: 'upstairs',
    tape: TAPE.yellow, studios: ['woodshop'], note: 'The dusty half - saws and benches.',
  },
  {
    slug: 'woodshop-2', name: 'Woodshop 2', code: 'W2', floor: 'upstairs',
    tape: TAPE.yellow, studios: ['woodshop'], note: 'Clean area and glue-ups.',
  },
  {
    slug: 'foyer-2', name: 'Foyer 2', code: 'F2', floor: 'upstairs',
    tape: TAPE.beige, studios: [],
  },
  {
    slug: 'stairs-2-east', name: 'Stairs', code: null, floor: 'upstairs',
    tape: null, studios: [], note: 'Down to the crafts end of the ground floor.',
  },
  {
    slug: 'metal', name: 'Metal Shop', code: 'M', floor: 'upstairs',
    tape: TAPE.beige, studios: ['metalworking'], note: 'Lathe, CNC mill, and the dusty end.',
  },
  {
    slug: 'garage', name: 'Garage', code: 'G', floor: 'upstairs',
    tape: TAPE.beige, studios: [],
    note: 'Welding and semi-protected project storage. Which studio owns it?',
  },

  // ----------------------------------------------------------- downstairs ---
  {
    slug: 'kitchen', name: 'Kitchen', code: 'K', floor: 'downstairs',
    tape: TAPE.pink, studios: [],
  },
  {
    slug: 'av-studio', name: 'A/V Studio', code: 'A', floor: 'downstairs',
    tape: TAPE.beige, studios: ['av-studio'], note: 'Green screen.',
  },
  {
    slug: 'bathroom-1-west', name: "Women's Bathroom", code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'With a shower.',
  },
  {
    slug: 'bathroom-1-east', name: "Men's Bathroom", code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'With a shower.',
  },
  {
    slug: 'sewing', name: 'Sewing', code: 'S', floor: 'downstairs',
    tape: TAPE.purple, studios: ['sewing'],
    note: 'Leatherworking too? It shares a calendar tag with sewing.',
  },
  {
    slug: 'crafts', name: 'Crafts', code: 'CR', floor: 'downstairs',
    tape: TAPE.beige, studios: ['arts-crafts'], note: 'Kits and general craft supplies.',
  },
  {
    slug: 'stairs-1-east', name: 'Stairs', code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'Up to Foyer 2, the metal shop and the garage.',
  },
  {
    slug: 'stairs-1-west', name: 'Stairs', code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'Up to Classroom 2 and the MegaStudio.',
  },
  {
    // The entrance is a re-entrant notch in the building's bottom-left corner;
    // the foyer wraps round the inside of it. Simplified to the two walls that
    // matter for finding the door.
    slug: 'foyer-1', name: 'Foyer 1', code: 'F1', floor: 'downstairs',
    tape: TAPE.beige, studios: [],
    note: 'The door to the street, and the project feature area.',
  },
  {
    slug: 'front-desk', name: 'Front Desk', code: 'FD', floor: 'downstairs',
    tape: TAPE.beige, studios: [], note: 'Reception. Sign in here.',
  },
  {
    slug: 'lounge', name: 'Lounge', code: 'LO', floor: 'downstairs',
    tape: TAPE.beige, studios: [],
  },
  {
    slug: 'office', name: 'Office', code: 'OF', floor: 'downstairs',
    tape: TAPE.brown, studios: [],
  },
  {
    slug: 'darkroom', name: 'Darkroom', code: 'D', floor: 'downstairs',
    tape: TAPE.beige, studios: [],
  },
  {
    slug: 'storage-1', name: 'Storage 1', code: 'ST', floor: 'downstairs',
    tape: TAPE.beige, studios: [], note: 'Makerspace storage.',
  },
  {
    slug: 'utilities', name: 'Utilities', code: 'U', floor: 'downstairs',
    tape: TAPE.beige, studios: [],
  },
  {
    slug: 'classroom-1', name: 'Classroom 1', code: 'C1', floor: 'downstairs',
    tape: TAPE.cyan, studios: [],
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
