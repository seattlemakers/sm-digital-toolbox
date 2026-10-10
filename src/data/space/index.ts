/**
 * The building: studios, spaces, and which studios work where.
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
 * longer display names - live in studios.json and mappings.json so that a form,
 * a script or an agent can write one. The reasoning, the derivation and the
 * validation live in this file, where an editor round-tripping those files
 * cannot touch them. That is the real reason, more than "JSON is easy to
 * write": any editor that rewrites a file destroys its comments, and the thirty
 * lines below explaining why the Landing has no label are worth more than the
 * convenience of having them beside the ids they talk about.
 *
 * The cost of JSON rows is that nothing type-checks them as you type, so the
 * validation at the bottom of this file checks SHAPE as well as references -
 * every row has its keys, every colour is a hex triple, no slug appears twice.
 * All of it throws at module load, which fails the build.
 *
 * THE DRAWING OWNS NAMES AND SHAPES. mappings.json holds no room names at all:
 * `floorplan.svg` is the single place a space is named, and a name can only be
 * changed there. An editing UI can add a *display* name; it cannot rename a
 * room.
 */
import studioRows from './studios.json';
import mappingRows from './mappings.json';
import { FLOORPLAN, FLOORS, type Floor, type Room, type Zone } from '../floorplan';

export { FLOORS, type Floor };

/**
 * A discipline, with the two marks the brand draws for it.
 *
 * `icon` is a PATH, not a convention, and this matters: the mono vectors are
 * hand-extracted from the brand's Illustrator master and are named for what
 * they are on that sheet, not for our slugs. `printmaking` points at
 * `screen-printing.svg` and `jewelry` at `lapidary.svg`, because renaming the
 * artwork would make it
 * disagree with the master - and with `public/studios/`, whose photo folders
 * are keyed to the calendar's slugs and would then be a third vocabulary.
 *
 * Three studios have no vector at all and omit the key. Nothing may rebuild
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

type Mapping = { studios?: string[]; display?: string; circulation?: boolean };
const MAPPINGS = mappingRows.spaces as Record<string, Mapping>;

/** When the rows last changed, for the published file. Not the build clock. */
export const UPDATED = mappingRows.updated > studioRows.updated ? mappingRows.updated : studioRows.updated;

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
export type Space = (Room | Zone) & {
  floor: Floor;
  shape: 'room' | 'zone';
  /** The longer name where there is one, else the drawing's. */
  display: string;
  /** For a zone, the room it sits in. */
  room?: string;
  /** Studios working in this space itself. */
  studios: string[];
  /** For a room, studios working in its zones. Empty on a zone. */
  studiosWithin: string[];
  /** A corridor, a stair, a landing, the check-in desk. */
  circulation: boolean;
};

/**
 * Codes sort numerically, and a zone sorts under its room.
 *
 * The drawing's own order is the order the author drew in - U15 between U9 and
 * U10, D20 between D7 and D8 - which is nothing to do with how the building
 * reads. Sorting as text is no better: U10 lands between U1 and U2. And the
 * single most checkable fact here is "the Jewelry Studio is inside Metal
 * Studios", which only reads if the two are adjacent.
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
 * A room counts as a studio space when one of its ZONES has one, not only when
 * it does itself. The Fab Lab carries no studio of its own - laser cutting and
 * 3D printing are zones inside it - and anything treating it like a broom
 * cupboard would be wrong about the most useful room on the floor.
 *
 * It is `studiosWithin` rather than folded into `studios`, because the two are
 * different claims: a studio is IN the Laser Cutting Studio, and it is
 * SOMEWHERE IN the Fab Lab.
 */
export const SPACES: Space[] = FLOORS.flatMap((floor) => {
  const zoneStudios = (roomId: string) =>
    FLOORPLAN[floor].zones.filter((z) => z.room === roomId).flatMap((z) => MAPPINGS[z.id]?.studios ?? []);

  const join = <T extends Room | Zone>(s: T, shape: 'room' | 'zone', within: string[]) => ({
    ...s,
    floor,
    shape,
    display: MAPPINGS[s.id]?.display ?? s.name,
    studios: MAPPINGS[s.id]?.studios ?? [],
    studiosWithin: within,
    circulation: MAPPINGS[s.id]?.circulation ?? false,
  });

  const rooms = FLOORPLAN[floor].rooms.map((r) => join(r, 'room', zoneStudios(r.id)));
  const zones = FLOORPLAN[floor].zones.map((z) => join(z, 'zone', []));

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

/** "Fab Lab, laser cutting studio" - a zone says which room it is in. */
export function placeOf(space: Space): string {
  if (space.shape === 'room') return space.name;
  const room = SPACE_BY_ID.get(space.room!);
  return room ? `${room.name}, ${space.name.toLowerCase()}` : space.name;
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

// A mapping for a space the drawing does not have is a mapping for a building
// that no longer exists - far more likely after a redraw than a typo. It fails
// silently otherwise: a row nothing looks up simply never appears.
for (const id of Object.keys(MAPPINGS)) {
  if (!SPACE_BY_ID.has(id)) {
    throw new Error(`mappings.json: "${id}" is not a room or zone in floorplan.svg`);
  }
}

for (const space of SPACES) {
  for (const slug of space.studios) {
    if (!STUDIO_BY_SLUG.has(slug)) {
      throw new Error(`mappings.json: "${space.id}" names studio "${slug}", which is not in studios.json`);
    }
  }
}
