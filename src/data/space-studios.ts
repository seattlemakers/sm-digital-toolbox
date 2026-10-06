/**
 * The studios, as the building knows them.
 *
 * A fork of data/studios.ts taken on 2026-10-06, and the fork is the point.
 * That file exists to feed the calendar, and three of its five fields are
 * bridges to one:
 *
 *   eventCategories  the raw category slugs seattlemakers.org puts on an event
 *                    anchor, mapped many-to-one onto a studio
 *   preferEvent      an editorial override for which class to advertise
 *   icon             the mono vector mark, for the reel and the door posters
 *
 * None of those is a fact about the building, and the calendar behind them is
 * being replaced - so several of that file's names were settled against needs
 * that are about to stop existing. A studio in here is a discipline with a
 * name, a colour and a mark, and the only question ever asked of it is which
 * rooms it works in. data/rooms.ts answers that, keyed by the slugs below.
 *
 * The two lists are expected to drift, and that is allowed. What a class is
 * tagged on a booking system and what the people in the building call the room
 * are different questions, and forcing one answer onto both is what produced
 * the names flagged below.
 *
 * SLUGS ARE LOAD-BEARING in two places beyond this file: they are the keys of
 * STUDIOS_IN in data/rooms.ts, and they name the badge PNGs, which
 * scripts/crop-studio-badges.mjs cuts from the brand sheet against its own
 * hardcoded list. Renaming one is three edits and a re-run of that script.
 *
 * NAMES ARE LOWERCASE, which is the brand deck's own styling for these chips
 * and saves owning a list of exceptions - "3D", "A/V", "CNC" - anywhere a
 * studio is printed.
 *
 * OPEN, as of 2026-10-06. Each is one line here once somebody decides:
 *
 *   lapidary     The brand sheet draws this mark as "Jewelry" and the room it
 *                sits in is the Jewelry Studio. Nothing but this file says
 *                "lapidary". It is almost certainly a rename to jewelry, held
 *                only in case they are two studios rather than one.
 *   cnc          The calendar tags it `cnc` and `cnc-routing`, the second being
 *                the superset. Whether the studio is *called* CNC routing is a
 *                separate question from either tag - and note that one studio
 *                currently covers two zones, the Big CNC in the Garage and the
 *                CNC in Woodshop 2. If those are different things it is a
 *                split, not a rename.
 *   computer lab On the plan and on the brand sheet; has never had a class.
 */
export type SpaceStudio = {
  slug: string;
  /** Display name, lowercase. The only name the map ever prints. */
  name: string;
  /**
   * The colour badge at public/brand/studios/<slug>.png, cut from the brand
   * sheet. A placeholder raster: it is the only mark that exists at all for
   * computer lab and leatherworking, which the vector set has neither of.
   */
  badge: string;
  /**
   * Read off the sheet's GLYPH rather than its ring - the rings are drawn pale
   * and the glyph carries the brand colour. Eight of the fourteen fail 4.5:1 on
   * white, so this is for marks and rules, never for type. See *The studio
   * badges* in CLAUDE.md.
   */
  colour: string;
};

export const SPACE_STUDIOS: SpaceStudio[] = [
  { slug: 'laser-cutting',   name: 'laser cutting',   badge: '/brand/studios/laser-cutting.png',   colour: '#ef1c26' },
  { slug: '3d-printing',     name: '3d printing',     badge: '/brand/studios/3d-printing.png',     colour: '#ea5300' },
  { slug: 'woodshop',        name: 'woodshop',        badge: '/brand/studios/woodshop.png',        colour: '#ffb61b' },
  { slug: 'sewing',          name: 'sewing',          badge: '/brand/studios/sewing.png',          colour: '#92318c' },
  { slug: 'electronics',     name: 'electronics',     badge: '/brand/studios/electronics.png',     colour: '#29a641' },
  { slug: 'cnc',             name: 'cnc',             badge: '/brand/studios/cnc.png',             colour: '#945612' },
  { slug: 'ceramics',        name: 'ceramics',        badge: '/brand/studios/ceramics.png',        colour: '#e85579' },
  { slug: 'screen-printing', name: 'screen printing', badge: '/brand/studios/screen-printing.png', colour: '#43b0a5' },
  { slug: 'arts-crafts',     name: 'arts & crafts',   badge: '/brand/studios/arts-crafts.png',     colour: '#9cc001' },
  { slug: 'leatherworking',  name: 'leatherworking',  badge: '/brand/studios/leatherworking.png',  colour: '#853321' },
  { slug: 'metalworking',    name: 'metalworking',    badge: '/brand/studios/metalworking.png',    colour: '#8e7479' },
  { slug: 'computer-lab',    name: 'computer lab',    badge: '/brand/studios/computer-lab.png',    colour: '#5a41ab' },
  { slug: 'av-studio',       name: 'a/v studio',      badge: '/brand/studios/av-studio.png',       colour: '#3563a6' },
  { slug: 'lapidary',        name: 'lapidary',        badge: '/brand/studios/lapidary.png',        colour: '#a90c5c' },
];

export const SPACE_STUDIO_BY_SLUG = new Map(SPACE_STUDIOS.map((s) => [s.slug, s]));

// Two studios with one slug would make STUDIOS_IN ambiguous and the duplicate
// would simply win in the Map above, silently.
if (SPACE_STUDIO_BY_SLUG.size !== SPACE_STUDIOS.length) {
  throw new Error('space-studios.ts: two studios share a slug');
}
