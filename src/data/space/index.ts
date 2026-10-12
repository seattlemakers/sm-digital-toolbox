/**
 * The building: studios, spaces, who may use them, and which studios work where.
 *
 * This is the one place the rest of the site - and other Seattle Makers web
 * projects, through /data/space.json - asks about the space. It replaced the
 * pair of files that grew apart (`rooms.ts` and `space-studios.ts`) on
 * 2026-10-10, and it deliberately does NOT replace `calendar-studios.ts`: that
 * one is the calendar's own, with its own slugs and its own calendar-shaped
 * fields, and the calendar is being retired. See the note at the top of it.
 *
 * ROWS ARE JSON, RULES ARE HERE, and the split is the whole design.
 *
 * The rows - studio names and colours, which studios are in which space, the
 * taglines, who may use a space - live in studios.json, mappings.json and
 * access.json so that a form, a script or an agent can write one. The
 * reasoning, the derivation and the validation live in this file, where an
 * editor round-tripping those files cannot touch them. That is the real reason,
 * more than "JSON is easy to write": any editor that rewrites a file destroys
 * its comments, and the explanations below are worth more than the convenience
 * of having them beside the ids they talk about.
 *
 * The cost of JSON rows is that nothing type-checks them as you type, so the
 * validation at the bottom of this file checks SHAPE as well as references -
 * every row has its keys, every colour is a hex triple, no slug appears twice.
 * All of it throws at module load, which fails the build.
 *
 * THE DRAWING OWNS NAMES AND SHAPES, and as of 2026-10-11 it names ZONES. A
 * room is an unnamed container; every named space is a zone inside one. The
 * rows here hold no names at all: `floorplan.ts` is the single place a space
 * is named, and a name can only be changed there. An editing UI can add a
 * *tagline* or flag a resource; it cannot rename a zone.
 */
import studioRows from './studios.json';
import mappingRows from './mappings.json';
import accessRows from './access.json';
import { FLOORPLAN, FLOORS, type Floor, type Room, type Zone } from '../floorplan';

export { FLOORS, type Floor };

/**
 * A discipline, with the two marks the brand draws for it.
 *
 * `icon` is a PATH, not a convention, and this matters: the mono vectors are
 * hand-extracted from the brand's Illustrator master and are named for what
 * they are on that sheet, not for our slugs. `printmaking` points at
 * `screen-printing.svg` and `jewelry` at `lapidary.svg`, because renaming the
 * artwork would make it disagree with the master - and with `public/studios/`,
 * whose photo folders are keyed to the calendar's slugs and would then be a
 * third vocabulary.
 *
 * One studio has no vector at all and omits the key. Nothing may rebuild
 * either path from a slug: `unknown`'s badge is an `.svg` where the other
 * fourteen are `.png`.
 */
export type Studio = {
  slug: string;
  name: string;
  colour: string;
  badge: string;
  icon?: string;
};

export const STUDIOS: Studio[] = studioRows.studios;
export const STUDIO_BY_SLUG = new Map(STUDIOS.map((s) => [s.slug, s]));

/**
 * A RESOURCE is a space with a studio's descriptors and none of its standing.
 *
 * The sanding room, the fume room, the computer lab, A/V, the mini makerspace.
 * The same things are true of one that are true of a studio - somebody
 * maintains it, classes run in it, the calendar tags it - but it is not a
 * discipline you would buy a membership to, and **single-studio membership is
 * the whole reason the distinction has to exist in the data**. A member with
 * one studio should not find that the sanding room counts as their studio, nor
 * that it is barred to them as somebody else's.
 *
 * IT IS A FLAG ON THE SPACE, NOT A THING OF ITS OWN, and that was the second
 * answer. The first gave each one a record beside the studios - slug, name,
 * colour, badge - and it read wrong immediately: a named, badged row in the
 * Studio column is a studio however the column is labelled, and three of the
 * five names only restated the room's own ("Sanding" in the Sanding Room).
 * Those studios do not exist, so nothing should name them.
 *
 * What a resource has instead is the zone. A resource IS the Computer Lab,
 * which is already named, already drawn and already in the list. When
 * maintenance staff or calendar tags arrive they hang off the space, which is
 * the thing that actually has them.
 */
type Mapping = { studios?: string[]; tagline?: string; resource?: boolean; circulation?: boolean };
const MAPPINGS = mappingRows.spaces as Record<string, Mapping>;

/**
 * WHO MAY USE A SPACE, which is what the plan now colours by.
 *
 * Three answers and no more: `public` (the kitchen, the lounge, the lobby -
 * anyone who has walked in), `members` (the default, and so never written
 * down), and `staff` (the office, the staff desk, the closets). A zone takes
 * its room's answer unless it states its own: the Staff Desk is a staff zone
 * in a members room, and the Storage corner of D1 is staff where the Event
 * Space beside it is not.
 *
 * It is its own file rather than a field in mappings.json because it is a
 * different kind of fact, kept by a different person: "which studio works
 * here" is the floor manager's, "who may walk in" is policy.
 */
export type Access = 'public' | 'members' | 'staff';
const PUBLIC = new Set<string>(accessRows.public);
const STAFF = new Set<string>(accessRows.staff);

const ownAccessOf = (id: string): Access | null =>
  PUBLIC.has(id) ? 'public' : STAFF.has(id) ? 'staff' : null;

/** When the rows last changed, for the published file. Not the build clock. */
export const UPDATED = [mappingRows.updated, studioRows.updated, accessRows.updated].sort().at(-1)!;

/**
 * What each floor is called. Page-local in map.astro until 2026-10-10, which
 * made `floor: "upstairs"` a word every consumer had to translate for itself -
 * and an unsortable one, which is what `level` is for.
 */
export const FLOOR_NAME: Record<Floor, { name: string; sub: string; level: number }> = {
  upstairs: { name: 'Upstairs', sub: '2nd floor', level: 2 },
  downstairs: { name: 'Downstairs', sub: '1st floor', level: 1 },
};

/** Every room and zone the drawing carries, joined to what we know about it. */
export type Space = {
  id: string;
  floor: Floor;
  shape: 'room' | 'zone';
  /** Null on every room, and on the ten unnamed zones. */
  name: string | null;
  /** The label, where there is one - see `Zone` in floorplan.ts. */
  lines: string[];
  at?: Zone['at'];
  size?: number;
  rotate?: number;
  points: Room['points'];
  /**
   * A second line for the plan, where a space has one.
   *
   * The name says which room it is and the tagline says what happens in it -
   * "Ceramics 1" over "Hand Building & Glazing". Two fields rather than one
   * "Ceramics 1: Hand Building & Glazing", because a renderer that wants to set
   * the two differently should not have to find a colon to do it, and because
   * nothing then rests on an author remembering to type one.
   */
  tagline?: string;
  /** For a zone, the room it sits in. */
  room?: string;
  /** Studios working in this space itself. */
  studios: string[];
  /** For a room, studios working in its zones. Empty on a zone. */
  studiosWithin: string[];
  /** Shared rather than a studio - see the note above `Mapping`. */
  resource: boolean;
  /** A corridor, a stair, a landing. */
  circulation: boolean;
  /** Who may use it, resolved: the zone's own entry, else its room's. */
  access: Access;
  /** True when this space states its own access rather than inheriting it. */
  ownAccess: boolean;
};

/**
 * Codes sort numerically, and a zone sorts under its room.
 *
 * The drawing's own order is the order the author drew in - U15 between U9 and
 * U10, D20 between D7 and D8 - which is nothing to do with how the building
 * reads. Sorting as text is no better: U10 lands between U1 and U2. And the
 * single most checkable fact here is "Jewelry is inside U3", which only reads
 * if the two are adjacent.
 *
 * This is part of the published contract, not a page's preference, which is why
 * it lives here rather than in map.astro where it started.
 */
export const codeAt = (id: string): [number, number] => {
  const [, major, minor = '0'] = id.match(/^[A-Z](\d+)(?:\.(\d+))?$/) ?? [];
  return [Number(major), Number(minor)];
};

export const byCode = (a: { id: string }, b: { id: string }) =>
  codeAt(a.id)[0] - codeAt(b.id)[0] || codeAt(a.id)[1] - codeAt(b.id)[1];

/**
 * A room counts as a studio space when one of its ZONES has one - it cannot
 * have one itself any more, since nothing maps to a room. U15 carries no
 * studio; laser cutting and 3D printing are zones inside it. `studiosWithin`
 * is kept apart from `studios` because the two are different claims: a studio
 * is IN the Laser Cutting zone, and it is SOMEWHERE IN U15.
 */
export const SPACES: Space[] = FLOORS.flatMap((floor) => {
  const zonesOf = (roomId: string) => FLOORPLAN[floor].zones.filter((z) => z.room === roomId);

  const join = (s: Room | Zone, shape: 'room' | 'zone'): Space => {
    const zone = shape === 'zone' ? (s as Zone) : null;
    const own = ownAccessOf(s.id);
    const inherited = zone ? ownAccessOf(zone.room) : null;
    return {
      id: s.id,
      floor,
      shape,
      name: zone?.name ?? null,
      lines: zone?.lines ?? [],
      ...(zone ? { at: zone.at, size: zone.size } : {}),
      ...(zone?.rotate ? { rotate: zone.rotate } : {}),
      points: s.points,
      tagline: MAPPINGS[s.id]?.tagline,
      ...(zone ? { room: zone.room } : {}),
      studios: MAPPINGS[s.id]?.studios ?? [],
      studiosWithin: zone ? [] : zonesOf(s.id).flatMap((z) => MAPPINGS[z.id]?.studios ?? []),
      resource: MAPPINGS[s.id]?.resource ?? false,
      circulation: MAPPINGS[s.id]?.circulation ?? false,
      access: own ?? inherited ?? 'members',
      ownAccess: own !== null,
    };
  };

  const rooms = FLOORPLAN[floor].rooms.map((r) => join(r, 'room'));
  const zones = FLOORPLAN[floor].zones.map((z) => join(z, 'zone'));

  // Reading order: each room, then its own zones directly under it.
  return rooms
    .sort(byCode)
    .flatMap((room) => [room, ...zones.filter((z) => z.room === room.id).sort(byCode)]);
});

export const SPACE_BY_ID = new Map(SPACES.map((s) => [s.id, s]));

/** Where a studio works. */
export function spacesForStudio(slug: string): Space[] {
  return SPACES.filter((s) => s.studios.includes(slug));
}

/**
 * What to call a space in a sentence. Rooms have no name, so a zone is named
 * alone - "Laser Cutting" rather than "U15, laser cutting". Kept because it is
 * what a studio list will be built from when one comes back.
 */
export function placeOf(space: Space): string {
  return space.name ?? space.id;
}

/**
 * Studios that no space claims. Rendered rather than swallowed: the whole point
 * of keeping the drawing and the studio list apart is that the distance between
 * them is visible, and a studio with nowhere to send somebody is the one thing
 * a map cannot do its job without.
 */
export function studiosWithoutSpace(): Studio[] {
  const placed = new Set(SPACES.flatMap((s) => s.studios));
  return STUDIOS.filter((s) => !placed.has(s.slug));
}


// --- validation ------------------------------------------------------------
//
// All of it throws at module load, so a bad row fails the build rather than
// rendering as a space with no name beside it, which looks like a styling bug
// and is not one.

const HEX = /^#[0-9a-f]{6}$/;
const seen = new Set<string>();
for (const s of STUDIOS) {
  const where = `studios.json: "${s.slug ?? '(no slug)'}"`;
  if (!s.slug || !s.name || !s.colour || !s.badge) throw new Error(`${where} is missing slug, name, colour or badge`);
  if (!HEX.test(s.colour)) throw new Error(`${where} has colour "${s.colour}", which is not a #rrggbb triple`);
  if (seen.has(s.slug)) throw new Error(`${where} appears twice; the later one would silently win`);
  seen.add(s.slug);
}

// A row for a space the drawing does not have is a row for a building that no
// longer exists - far more likely after a redraw than a typo. It fails silently
// otherwise: a row nothing looks up simply never appears.
for (const id of Object.keys(MAPPINGS)) {
  if (!SPACE_BY_ID.has(id)) {
    throw new Error(`mappings.json: "${id}" is not a room or zone in floorplan.ts`);
  }
}
for (const id of [...PUBLIC, ...STAFF]) {
  if (!SPACE_BY_ID.has(id)) {
    throw new Error(`access.json: "${id}" is not a room or zone in floorplan.ts`);
  }
  if (PUBLIC.has(id) && STAFF.has(id)) {
    throw new Error(`access.json: "${id}" is both public and staff only; it is one or the other`);
  }
}

for (const space of SPACES) {
  for (const slug of space.studios) {
    if (!STUDIO_BY_SLUG.has(slug)) {
      throw new Error(`mappings.json: "${space.id}" names studio "${slug}", which is not in studios.json`);
    }
  }
  // A space is one or the other. Both would make "is this a studio" a question
  // with two answers, which is exactly what the distinction exists to prevent.
  if (space.studios.length && space.resource) {
    throw new Error(`mappings.json: "${space.id}" is marked a resource and names a studio; it is one or the other`);
  }
  // Nothing maps to a room any more: a room is a container, and a studio, a
  // tagline or a resource flag on one is a row that was never moved to its zone.
  if (space.shape === 'room' && MAPPINGS[space.id]) {
    throw new Error(`mappings.json: "${space.id}" is a room; rows belong to its zones`);
  }
  if (space.shape === 'zone') {
    // A label and a name come together or not at all - a named zone with no
    // lines would silently print nothing, and lines on an unnamed zone would
    // print a name the list does not have.
    if ((space.name === null) !== (space.lines.length === 0)) {
      throw new Error(`floorplan.ts: zone "${space.id}" has a name without lines, or lines without a name`);
    }
    if (space.rotate && space.name === null) {
      throw new Error(`floorplan.ts: zone "${space.id}" is rotated and has no label to rotate`);
    }
    if (space.tagline && space.name === null) {
      throw new Error(`mappings.json: "${space.id}" has a tagline and no name to put it under`);
    }
  }
}
