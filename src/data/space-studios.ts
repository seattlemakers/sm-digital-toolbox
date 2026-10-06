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
 * SETTLED on 2026-10-06, and this is the first place the two lists part:
 *
 *   jewelry      Was "lapidary", which nothing but the studio list ever said -
 *                the brand sheet draws the mark as "Jewelry" and the room it
 *                sits in is the Jewelry Studio. studios.ts still says lapidary,
 *                because that is the word its calendar would use if the studio
 *                ever got a tag.
 *   cnc routing  Was "cnc". The calendar emits both `cnc` and `cnc-routing`,
 *                the second being the superset; this is the name the building
 *                uses.
 *   leather      Was "leatherworking". studios.ts keeps that, because it is
 *   studio       also the calendar tag; the room it is in is still called the
 *                Leatherworking Studio in the drawing.
 *
 * CONFIRMED on 2026-10-06: cnc routing covers BOTH its zones - the Big CNC in
 * the Garage (U1.2) and the CNC in Woodshop 2 (U5.1). It is one studio working
 * in two places, not two studios, so it stays one entry. Worth having written
 * down, because a studio in two rooms on two sides of a floor is the shape that
 * invites somebody to "fix" it by splitting it.
 *
 * STILL OPEN:
 *
 *   computer lab On the plan and on the brand sheet; has never had a class.
 */
export type SpaceStudio = {
  slug: string;
  /** Display name, lowercase. The only name the map ever prints. */
  name: string;
  /**
   * The colour badge at public/brand/studios/<slug>.png, cut from the brand
   * sheet. A placeholder raster: it is the only mark that exists at all for
   * computer lab and the leather studio, which the vector set has neither of.
   * `unknown` is the exception and is a drawn SVG - it is not on the sheet.
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
  { slug: 'cnc-routing',     name: 'cnc routing',     badge: '/brand/studios/cnc-routing.png',     colour: '#945612' },
  { slug: 'ceramics',        name: 'ceramics',        badge: '/brand/studios/ceramics.png',        colour: '#e85579' },
  { slug: 'screen-printing', name: 'screen printing', badge: '/brand/studios/screen-printing.png', colour: '#43b0a5' },
  { slug: 'arts-crafts',     name: 'arts & crafts',   badge: '/brand/studios/arts-crafts.png',     colour: '#9cc001' },
  { slug: 'leather-studio',  name: 'leather studio',  badge: '/brand/studios/leather-studio.png',  colour: '#853321' },
  { slug: 'metalworking',    name: 'metalworking',    badge: '/brand/studios/metalworking.png',    colour: '#8e7479' },
  { slug: 'computer-lab',    name: 'computer lab',    badge: '/brand/studios/computer-lab.png',    colour: '#5a41ab' },
  { slug: 'av-studio',       name: 'a/v studio',      badge: '/brand/studios/av-studio.png',       colour: '#3563a6' },
  { slug: 'jewelry',         name: 'jewelry',         badge: '/brand/studios/jewelry.png',         colour: '#a90c5c' },
  // A space whose studio nobody has named yet. It is an entry rather than an
  // empty one so the plan and the list can still say "something works in here"
  // - a different claim from the blank a room with no studio gets, and the
  // only one that is true of the Fume Room.
  //
  // Its badge is DRAWN, at /brand/studios/unknown.svg, because it is not on
  // the brand sheet. Do not add this slug to crop-studio-badges.mjs: that
  // script zips its list against the fourteen rings it finds on the sheet and
  // throws if the counts differ.
  { slug: 'unknown',         name: '???',             badge: '/brand/studios/unknown.svg',         colour: '#1a1a1a' },
];

export const SPACE_STUDIO_BY_SLUG = new Map(SPACE_STUDIOS.map((s) => [s.slug, s]));

// Two studios with one slug would make STUDIOS_IN ambiguous and the duplicate
// would simply win in the Map above, silently.
if (SPACE_STUDIO_BY_SLUG.size !== SPACE_STUDIOS.length) {
  throw new Error('space-studios.ts: two studios share a slug');
}
