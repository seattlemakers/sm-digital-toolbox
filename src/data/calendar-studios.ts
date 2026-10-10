/**
 * The CALENDAR's studio list, and the reel's. A one-off.
 *
 * Renamed from studios.ts on 2026-10-10, when data/space became the central
 * list for the building. This one is kept, frozen, because it serves tools that
 * are being retired and carries three fields that are about a booking system
 * rather than a space: `eventCategories`, `preferEvent`, and an `icon` that
 * /calendar requires to be a non-null string.
 *
 * Its slugs still differ from data/space's where only the *word* differs -
 * `lapidary` here is `jewelry` there, `computer-lab` is `software`. What is NOT
 * allowed to differ is whether a studio exists at all: cnc collapsed into the
 * woodshop in the building on 2026-10-10, so it collapsed here too, and screen
 * printing became printmaking in both.
 *
 * `public/studios/<slug>/` photo folders are keyed to THESE slugs, so a rename
 * here is also a folder rename or the reel silently loses those slides.
 * scripts/test-space.mjs checks every folder against this list.
 *
 * ADDING A STUDIO
 *   1. drop photos in  public/studios/<slug>/*.jpg   (1920px+ wide, landscape)
 *   2. point `icon` at a file in public/brand/icons/ - the field is a PATH and
 *      not a convention, so the filename need not match the slug, and for
 *      several studios it does not
 *   3. add an entry below
 * Nothing else needs to change.
 *
 * `eventCategories` maps the raw category slugs the calendar puts on each event
 * anchor onto this studio. The mapping is deliberately many-to-one: the site
 * emits both `cnc` and `cnc-routing` for the woodshop, and tags some leatherwork
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
   *
   * Nothing in here renders it: /map does, off data/space/studios.json. The
   * files are named by THAT list's slugs, which differ from this one's where
   * only the word does - `lapidary` here is `jewelry` there, `leatherworking`
   * is `leather-studio`, `computer-lab` is `software`. Same marks, two names
   * for them, on purpose. Where a studio stopped existing or was genuinely
   * renamed, both lists moved together: cnc into the woodshop, screen printing
   * to printmaking.
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
  // cnc folded into the woodshop on 2026-10-10 - it stopped being a studio in
  // the building, so it stops being one here. Its two tags come with it, which
  // is what keeps CNC classes resolving to a studio at all.
  { slug: 'woodshop',        name: 'woodshop',        icon: '/brand/icons/woodshop.svg', badge: '/brand/studios/woodshop.png', colour: '#ffb61b',        eventCategories: ['woodworking', 'cnc', 'cnc-routing'] },
  { slug: 'sewing',          name: 'sewing',          icon: '/brand/icons/sewing.svg', badge: '/brand/studios/sewing.png', colour: '#92318c',          eventCategories: ['sewing'] },
  { slug: 'electronics',     name: 'electronics',     icon: '/brand/icons/electronics.svg', badge: '/brand/studios/electronics.png', colour: '#29a641',     eventCategories: ['electronics'], preferEvent: 'Programmable LEDs' },
  { slug: 'ceramics',        name: 'ceramics',        icon: '/brand/icons/ceramics.svg', badge: '/brand/studios/ceramics.png', colour: '#e85579',        eventCategories: ['ceramics'] },
  { slug: 'printmaking',     name: 'printmaking',     icon: '/brand/icons/screen-printing.svg', badge: '/brand/studios/printmaking.png', colour: '#43b0a5', eventCategories: ['print-making'] },
  { slug: 'arts-crafts',     name: 'arts & crafts',   icon: '/brand/icons/arts-crafts.svg', badge: '/brand/studios/arts-crafts.png', colour: '#9cc001',     eventCategories: ['crafts'] },
  // The icon sheet has no leatherworking mark, so it borrows sewing's for now.
  // The two share a calendar tag already (`leatherworking-sewing`), which makes
  // it the least wrong thing to point at - but it is a placeholder, and a row
  // tagged only `leatherworking` currently shows a spool of thread.
  { slug: 'leatherworking',  name: 'leatherworking',  icon: '/brand/icons/sewing.svg', badge: '/brand/studios/leather-studio.png', colour: '#853321',          eventCategories: ['leatherworking', 'leatherworking-sewing'] },
  { slug: 'metalworking',    name: 'metalworking',    icon: '/brand/icons/metalworking.svg', badge: '/brand/studios/metalworking.png', colour: '#8e7479',    eventCategories: [] },
  // On the brand sheet and on the plan (room U16), and on no calendar tag -
  // so it has nothing to show on /calendar yet, exactly like metalworking.
  { slug: 'computer-lab',    name: 'computer lab',    icon: '/brand/icons/event.svg', badge: '/brand/studios/software.png', colour: '#5a41ab', eventCategories: [] },
  { slug: 'av-studio',       name: 'a/v studio',      icon: '/brand/icons/av-studio.svg', badge: '/brand/studios/av-studio.png', colour: '#3563a6',       eventCategories: [] },
  // The sheet draws this one as "Jewelry". Kept as lapidary until somebody
  // confirms they are the same studio rather than two.
  { slug: 'lapidary',        name: 'lapidary',        icon: '/brand/icons/lapidary.svg', badge: '/brand/studios/jewelry.png', colour: '#a90c5c',        eventCategories: [] },
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
