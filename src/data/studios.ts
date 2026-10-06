/**
 * The studio list. Single source of truth for the reel.
 *
 * ADDING A STUDIO
 *   1. drop photos in  public/studios/<slug>/*.jpg   (1920px+ wide, landscape)
 *   2. drop an icon at public/brand/icons/<slug>.svg
 *   3. add an entry below
 * Nothing else needs to change.
 *
 * `eventCategories` maps the raw category slugs the calendar puts on each event
 * anchor onto this studio. The mapping is deliberately many-to-one: the site
 * emits both `cnc` and `cnc-routing` for one studio, and tags some leatherwork
 * classes `leatherworking-sewing`, which is not a studio of its own.
 *
 * The slugs `cosplay` and `design` appear on events but are topical tags rather
 * than studios, so they are absent here on purpose - an event carrying only
 * those resolves to no studio, and on /today falls through to the generic
 * calendar icon.
 *
 * `crafts` used to be in that list and is not any more: the brand's own studio
 * icon sheet has an Arts & Crafts mark, so it is a room rather than a topic.
 * Checked before adding it - `/events/types/crafts/` comes back titled "Crafts
 * Archives - Seattle Makers" against the bare "Seattle Makers" a soft-404
 * gives, so the taxonomy is real. 11 events carry it.
 *
 * Icons are all SVG as of 2026-09-22, extracted from the Illustrator master
 * rather than re-cut from a raster - see *The studio icons* in CLAUDE.md.
 */
export type Studio = {
  slug: string;
  /** Display name. Lowercase throughout, matching the brand deck's chips. */
  name: string;
  /**
   * The mono vector mark, dark line art in a white disc. Still what /today,
   * /calendar and the reel use: it is a vector, so it stays sharp on a 4K wall
   * panel and prints cleanly on a door sign.
   */
  icon: string;
  /**
   * The colour badge, cut from the brand's icon sheet by
   * scripts/crop-studio-badges.mjs. A placeholder raster, and the only mark
   * there is for computer lab and leatherworking - the vector set has neither,
   * which is why leatherworking's `icon` is still a spool of thread.
   */
  badge: string;
  /**
   * The studio's own colour, read off the sheet's GLYPH rather than its ring -
   * the rings are drawn pale and the glyph carries the brand colour. See
   * *The studio badges* in CLAUDE.md.
   */
  colour: string;
  /** Raw calendar category slugs that resolve to this studio. */
  eventCategories: string[];
  /**
   * Editorial override: case-insensitive substring of the event title to
   * feature for this studio when it is upcoming. Use it when the automatic
   * pick is defensible but a different class sells the studio better - the
   * ranking cannot know that "Programmable LEDs" is a more enticing shop
   * window than "Soldering 101" when both are classes.
   */
  preferEvent?: string;
};

export const STUDIOS: Studio[] = [
  { slug: 'laser-cutting',   name: 'laser cutting',   icon: '/brand/icons/laser-cutting.svg', badge: '/brand/studios/laser-cutting.png', colour: '#ef1c26',   eventCategories: ['laser-cutting'] },
  { slug: '3d-printing',     name: '3d printing',     icon: '/brand/icons/3d-printing.svg', badge: '/brand/studios/3d-printing.png', colour: '#ea5300',     eventCategories: ['3d-printing'] },
  { slug: 'woodshop',        name: 'woodshop',        icon: '/brand/icons/woodshop.svg', badge: '/brand/studios/woodshop.png', colour: '#ffb61b',        eventCategories: ['woodworking'] },
  { slug: 'sewing',          name: 'sewing',          icon: '/brand/icons/sewing.svg', badge: '/brand/studios/sewing.png', colour: '#92318c',          eventCategories: ['sewing'] },
  { slug: 'electronics',     name: 'electronics',     icon: '/brand/icons/electronics.svg', badge: '/brand/studios/electronics.png', colour: '#29a641',     eventCategories: ['electronics'], preferEvent: 'Programmable LEDs' },
  { slug: 'cnc',             name: 'cnc',             icon: '/brand/icons/cnc.svg', badge: '/brand/studios/cnc.png', colour: '#945612',             eventCategories: ['cnc', 'cnc-routing'] },
  { slug: 'ceramics',        name: 'ceramics',        icon: '/brand/icons/ceramics.svg', badge: '/brand/studios/ceramics.png', colour: '#e85579',        eventCategories: ['ceramics'] },
  { slug: 'screen-printing', name: 'screen printing', icon: '/brand/icons/screen-printing.svg', badge: '/brand/studios/screen-printing.png', colour: '#43b0a5', eventCategories: ['print-making'] },
  { slug: 'arts-crafts',     name: 'arts & crafts',   icon: '/brand/icons/arts-crafts.svg', badge: '/brand/studios/arts-crafts.png', colour: '#9cc001',     eventCategories: ['crafts'] },
  // The icon sheet has no leatherworking mark, so it borrows sewing's for now.
  // The two share a calendar tag already (`leatherworking-sewing`), which makes
  // it the least wrong thing to point at - but it is a placeholder, and a row
  // tagged only `leatherworking` currently shows a spool of thread.
  { slug: 'leatherworking',  name: 'leatherworking',  icon: '/brand/icons/sewing.svg', badge: '/brand/studios/leatherworking.png', colour: '#853321',          eventCategories: ['leatherworking', 'leatherworking-sewing'] },
  { slug: 'metalworking',    name: 'metalworking',    icon: '/brand/icons/metalworking.svg', badge: '/brand/studios/metalworking.png', colour: '#8e7479',    eventCategories: [] },
  // On the brand sheet and on the plan (room U16), and on no calendar tag -
  // so it has nothing to show on /calendar yet, exactly like metalworking.
  { slug: 'computer-lab',    name: 'computer lab',    icon: '/brand/icons/event.svg', badge: '/brand/studios/computer-lab.png', colour: '#5a41ab', eventCategories: [] },
  { slug: 'av-studio',       name: 'a/v studio',      icon: '/brand/icons/av-studio.svg', badge: '/brand/studios/av-studio.png', colour: '#3563a6',       eventCategories: [] },
  // The sheet draws this one as "Jewelry". Kept as lapidary until somebody
  // confirms they are the same studio rather than two.
  { slug: 'lapidary',        name: 'lapidary',        icon: '/brand/icons/lapidary.svg', badge: '/brand/studios/lapidary.png', colour: '#a90c5c',        eventCategories: [] },
];

export const STUDIO_BY_SLUG = new Map(STUDIOS.map((s) => [s.slug, s]));

/** Raw calendar category slug -> studio slug. */
const CATEGORY_TO_STUDIO = new Map<string, string>(
  STUDIOS.flatMap((s) => s.eventCategories.map((c) => [c, s.slug] as [string, string])),
);

/** Studios an event belongs to. Empty when it carries only topical tags. */
export function studiosForCategories(categories: string[]): Studio[] {
  const slugs = new Set<string>();
  for (const c of categories) {
    const slug = CATEGORY_TO_STUDIO.get(c);
    if (slug) slugs.add(slug);
  }
  return [...slugs].map((s) => STUDIO_BY_SLUG.get(s)!).filter(Boolean);
}
