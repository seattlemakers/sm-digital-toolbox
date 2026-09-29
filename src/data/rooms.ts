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
 * WHERE THE GEOMETRY CAME FROM
 *   Traced off the space's own floorplan drawing (the one with the tape-colour
 *   key), not drawn by eye. The coloured room outlines were extracted from the
 *   raster by connected-component analysis - each room's tape colour forms one
 *   closed stroke, so its bounding box IS the room - and the black-walled rooms
 *   were read off a dark-pixel occupancy map of the same image. Coordinates are
 *   that drawing's own pixels, so the two floors share one frame and line up
 *   vertically. See *The floorplan* in CLAUDE.md.
 *
 *   It is a SCHEMATIC, deliberately: rooms are rectangles (or, where the wall
 *   genuinely turns, a polygon), not a traced reproduction of every jog and
 *   doorway. This drawing exists to answer "which room, and how do I get
 *   there", and a simplified plan answers that better on a screen than a
 *   faithful CAD trace does.
 *
 * TAPE COLOURS are read off the drawing's key, in its own order. They stand for
 * real tape on real door frames, so they are wayfinding rather than decoration -
 * "the room with the yellow tape" is a direction somebody can follow.
 */
import { STUDIO_BY_SLUG, type Studio } from './studios';

export type Floor = 'upstairs' | 'downstairs';
export type Pt = [number, number];

export type Room = {
  slug: string;
  /** What the room is called. The drawing's own wording until told otherwise. */
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
  /** Outline in the drawing's coordinates, clockwise. */
  shape: Pt[];
  /** Label anchor, when the shape's centre is the wrong place for it. */
  label?: Pt;
  /**
   * Code-chip anchor. The chip goes at the shape's top-left corner, which is
   * only inside the shape when the shape is a rectangle - on the L-shaped laser
   * room and the angled lounge that corner is in the room next door, so those
   * two say where it goes.
   */
  chip?: Pt;
  /** Anything the drawing says about the room that the name does not. */
  note?: string;
};

/** Rectangles are the common case; this keeps the shape list one type. */
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

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
    shape: rect(317, 31, 529, 271),
  },
  {
    // The drawing's "Storage?" box is a callout with leader lines, not a room -
    // the stair hatch runs on underneath it - so it is a note here rather than
    // a rectangle. Drawn as one, it sat on top of the stairs.
    slug: 'stairs-2-west', name: 'Stairs', code: null, floor: 'upstairs',
    tape: null, studios: [],
    note: 'Down to the lounge and the front desk. The drawing marks storage under them.',
    shape: rect(316, 277, 445, 448),
  },
  {
    slug: 'megastudio', name: 'The MegaStudio', code: 'MS', floor: 'upstairs',
    tape: TAPE.blue, studios: ['screen-printing'],
    note: 'The drawing puts screen printing in the corner. What else lives here?',
    shape: rect(316, 450, 829, 735),
  },
  {
    slug: '3d-printing', name: '3D Printing', code: '3', floor: 'upstairs',
    tape: TAPE.orange, studios: ['3d-printing'],
    shape: rect(534, 91, 733, 164),
  },
  {
    // An L: the room wraps under the 3D printing bay and up its right-hand side.
    slug: 'laser', name: 'Laser', code: 'L', floor: 'upstairs',
    tape: TAPE.red, studios: ['laser-cutting'], label: [680, 300], chip: [740, 98],
    shape: [[733, 91], [827, 91], [827, 346], [533, 346], [533, 165], [733, 165]],
  },
  {
    slug: 'bathroom-2-west', name: 'Bathroom', code: null, floor: 'upstairs',
    tape: null, studios: [], shape: rect(555, 355, 700, 445),
  },
  {
    slug: 'bathroom-2-east', name: 'Bathroom', code: null, floor: 'upstairs',
    tape: null, studios: [], shape: rect(705, 355, 830, 445),
  },
  {
    slug: 'electronics', name: 'Electronics', code: 'E', floor: 'upstairs',
    tape: TAPE.green, studios: ['electronics'], shape: rect(831, 91, 1013, 252),
  },
  {
    slug: 'high-voc', name: 'High VOC', code: 'VOC', floor: 'upstairs',
    tape: TAPE.beige, studios: [], note: 'Painting booth.',
    shape: rect(834, 255, 1013, 387),
  },
  {
    slug: 'low-voc', name: 'Low VOC', code: 'VOC', floor: 'upstairs',
    tape: TAPE.beige, studios: [], note: 'Staining and finishing.',
    shape: rect(834, 391, 1013, 543),
  },
  {
    slug: 'cnc', name: 'CNC', code: 'CNC', floor: 'upstairs',
    tape: TAPE.beige, studios: ['cnc'], note: 'The 4x4 router.',
    shape: rect(834, 613, 1012, 735),
  },
  {
    slug: 'woodshop-1', name: 'Woodshop 1', code: 'W1', floor: 'upstairs',
    tape: TAPE.yellow, studios: ['woodshop'], note: 'The dusty half - saws and benches.',
    shape: rect(1018, 92, 1363, 387),
  },
  {
    slug: 'woodshop-2', name: 'Woodshop 2', code: 'W2', floor: 'upstairs',
    tape: TAPE.yellow, studios: ['woodshop'], note: 'Clean area and glue-ups.',
    shape: rect(1018, 394, 1363, 736),
  },
  {
    slug: 'foyer-2', name: 'Foyer 2', code: 'F2', floor: 'upstairs',
    tape: TAPE.beige, studios: [], shape: rect(1369, 86, 1601, 396),
  },
  {
    slug: 'stairs-2-east', name: 'Stairs', code: null, floor: 'upstairs',
    tape: null, studios: [], note: 'Down to the crafts end of the ground floor.',
    shape: rect(1536, 71, 1604, 243),
  },
  {
    slug: 'metal', name: 'Metal Shop', code: 'M', floor: 'upstairs',
    tape: TAPE.beige, studios: ['metalworking'], note: 'Lathe, CNC mill, and the dusty end.',
    shape: rect(1365, 399, 1603, 735),
  },
  {
    slug: 'garage', name: 'Garage', code: 'G', floor: 'upstairs',
    tape: TAPE.beige, studios: [],
    note: 'Welding and semi-protected project storage. Which studio owns it?',
    shape: rect(1609, 29, 1848, 734),
  },

  // ----------------------------------------------------------- downstairs ---
  {
    slug: 'kitchen', name: 'Kitchen', code: 'K', floor: 'downstairs',
    tape: TAPE.pink, studios: [], shape: rect(315, 768, 570, 1012),
  },
  {
    slug: 'av-studio', name: 'A/V Studio', code: 'A', floor: 'downstairs',
    tape: TAPE.beige, studios: ['av-studio'], note: 'Green screen.',
    shape: rect(574, 768, 776, 1010),
  },
  {
    slug: 'bathroom-1-west', name: "Women's Bathroom", code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'With a shower.', shape: rect(779, 768, 975, 1010),
  },
  {
    slug: 'bathroom-1-east', name: "Men's Bathroom", code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'With a shower.', shape: rect(979, 768, 1180, 1010),
  },
  {
    slug: 'sewing', name: 'Sewing', code: 'S', floor: 'downstairs',
    tape: TAPE.purple, studios: ['sewing'],
    note: 'Leatherworking too? It shares a calendar tag with sewing.',
    shape: rect(1190, 768, 1361, 1009),
  },
  {
    slug: 'crafts', name: 'Crafts', code: 'CR', floor: 'downstairs',
    tape: TAPE.beige, studios: ['arts-crafts'], note: 'Kits and general craft supplies.',
    shape: rect(1367, 769, 1540, 1009),
  },
  {
    slug: 'stairs-1-east', name: 'Stairs', code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'Up to Foyer 2, the metal shop and the garage.',
    shape: rect(1545, 860, 1604, 1010),
  },
  {
    slug: 'stairs-1-west', name: 'Stairs', code: null, floor: 'downstairs',
    tape: null, studios: [], note: 'Up to Classroom 2 and the MegaStudio.',
    shape: rect(318, 1012, 443, 1159),
  },
  {
    // The entrance is a re-entrant notch in the building's bottom-left corner;
    // the foyer wraps round the inside of it. Simplified to the two walls that
    // matter for finding the door.
    slug: 'foyer-1', name: 'Foyer 1', code: 'F1', floor: 'downstairs',
    tape: TAPE.beige, studios: [], label: [440, 1225],
    note: 'The door to the street, and the project feature area.',
    shape: [[312, 1163], [560, 1163], [560, 1306], [378, 1306], [312, 1240]],
  },
  {
    slug: 'front-desk', name: 'Front Desk', code: 'FD', floor: 'downstairs',
    tape: TAPE.beige, studios: [], note: 'Reception. Sign in here.',
    shape: rect(564, 1108, 728, 1229),
  },
  {
    slug: 'lounge', name: 'Lounge', code: 'LO', floor: 'downstairs',
    tape: TAPE.beige, studios: [], label: [575, 1395], chip: [567, 1313],
    shape: [[484, 1306], [730, 1306], [730, 1471], [316, 1471]],
  },
  {
    slug: 'office', name: 'Office', code: 'OF', floor: 'downstairs',
    tape: TAPE.brown, studios: [], shape: rect(738, 1068, 901, 1203),
  },
  {
    slug: 'darkroom', name: 'Darkroom', code: 'D', floor: 'downstairs',
    tape: TAPE.beige, studios: [], shape: rect(738, 1208, 901, 1306),
  },
  {
    slug: 'storage-1', name: 'Storage 1', code: 'ST', floor: 'downstairs',
    tape: TAPE.beige, studios: [], note: 'Makerspace storage.',
    shape: rect(738, 1311, 901, 1471),
  },
  {
    slug: 'utilities', name: 'Utilities', code: 'U', floor: 'downstairs',
    tape: TAPE.beige, studios: [], shape: rect(907, 1068, 1016, 1470),
  },
  {
    slug: 'classroom-1', name: 'Classroom 1', code: 'C1', floor: 'downstairs',
    tape: TAPE.cyan, studios: [], label: [1250, 1180],
    note: 'Event space, classroom and rentable space. Member storage at the back.',
    shape: rect(1020, 1069, 1602, 1471),
  },
];

/**
 * The drawing's own extents, per floor, as an SVG viewBox.
 *
 * Both are the same width and height on purpose, so the two plans render at one
 * scale and the building lines up between them. The downstairs plan is
 * genuinely narrower - the garage is an upstairs-only extension - so its right
 * quarter is empty ground, which is the correct thing for it to say.
 */
/**
 * The building's own outline, per floor - the thing the rooms sit inside.
 *
 * Traced the same way as the rooms but off a different signal: the exterior
 * walls are the only dark runs on the drawing longer than about 300px, so
 * scanning each row and column for its longest run finds them and finds
 * nothing else. Text never makes a run that long, which is what made the
 * earlier attempt (leftmost dark pixel per row) useless - it kept returning
 * the first letter of a room name.
 *
 * What came back: the top wall at y=25 and the bottom at y=738, both from
 * x=312; the left wall at x=312; and downstairs a right wall at x=1604 with a
 * 45-degree notch cut into the bottom-left corner, which is the recessed
 * entrance. The notch is two diagonals with a flat between them - (312,1240)
 * down-right to (378,1306), across, then (484,1306) down-left to (314,1478) -
 * rather than the single apex the foyer and the lounge were drawn against
 * first. Those two rooms follow the real walls now.
 *
 * Upstairs runs 240 units further right than downstairs because the garage is
 * an upstairs-only extension; its own wall is drawn in beige on the original,
 * which is why the long-run scan stops at the main block and the right-hand
 * extent comes from the garage room instead.
 */
export const FLOOR_SHELL: Record<Floor, Pt[]> = {
  upstairs: rect(312, 25, 1852, 739),
  downstairs: [
    [312, 763],
    [1607, 763],
    [1607, 1477],
    [314, 1477],
    [484, 1306],
    [378, 1306],
    [312, 1240],
  ],
};

export const FLOOR_VIEW: Record<Floor, { viewBox: string; title: string; sub: string }> = {
  upstairs: { viewBox: '225 15 1640 745', title: 'Upstairs', sub: '2nd floor' },
  downstairs: { viewBox: '225 750 1640 745', title: 'Downstairs', sub: '1st floor' },
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
