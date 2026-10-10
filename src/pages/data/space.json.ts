import type { APIRoute } from 'astro';
import { STUDIOS, SPACES, FLOORS, FLOOR_NAME, UPDATED } from '../../data/space';

/**
 * The building, published for anything that wants it.
 *
 * This is a contract, not a dump of what /map happens to render, and the
 * difference shows in what is NOT here: no geometry, no `kind`, nothing about
 * which names our drawing prints. Those describe one picture of the building.
 *
 * It replaced /map/{rooms,zones,studios}.json on 2026-10-10, which were three
 * fetches and 52% redundant - `display` repeated `name` on 56 of 57 spaces, a
 * zone's floor always matched its parent's, and `studios[].where` was 23
 * entries of a join the consumer can do.
 *
 * RULES THIS FILE KEEPS, because a consumer will rely on each one:
 *
 *   absent, not empty   No `display` when it equals `name`, no `studios` when
 *                       there are none, no `in` on a room. Most of that 52%.
 *   stable order        Studios in list order; spaces by floor, then numeric
 *                       code, each zone directly after its room. Set in
 *                       data/space, not here, because it is a contract.
 *   `updated` is data   It comes from the rows, not the build clock. A
 *                       per-build timestamp makes every diff non-empty and
 *                       every cache entry new, which defeats the point.
 *   paths, not patterns Never rebuild an asset path from a slug: `unknown`'s
 *                       badge is a .svg where the others are .png, and
 *                       `printmaking`'s icon is screen-printing.svg.
 *
 * ROOMS AND ZONES ARE ONE LIST. A zone is a space inside another space, which
 * `in` says; it needed no second array and no second fetch.
 *
 * CORS comes from public/_headers, not from here. `output: 'static'` means this
 * is prerendered to a file and served by the Worker's ASSETS binding, so a
 * header set on this Response never reaches anybody.
 */
export const GET: APIRoute = () => {
  const studios = STUDIOS.map((s) => ({
    slug: s.slug,
    name: s.name,
    colour: s.colour,
    badge: s.badge,
    ...(s.icon ? { icon: s.icon } : {}),
  }));

  const spaces = SPACES.map((s) => ({
    code: s.id,
    floor: s.floor,
    name: s.name,
    ...(s.display !== s.name ? { display: s.display } : {}),
    ...(s.room ? { in: s.room } : {}),
    ...(s.studios.length ? { studios: s.studios } : {}),
  }));

  return new Response(
    JSON.stringify(
      {
        version: 1,
        what: 'Studios and spaces at Seattle Makers, Interbay',
        building: 'Seattle Makers, Interbay',
        updated: UPDATED,
        assetBase: '/',
        source: 'https://github.com/seattlemakers/sm-digital-toolbox',
        licence: 'MIT',
        notes: [
          'A space with `in` is a zone: a named area inside that room, with no wall between them.',
          'Asset paths are root-relative; resolve them against assetBase. Never rebuild one from a slug.',
          'Names come from the hand-drawn floorplan and can only be changed there; `display` is a second, longer name.',
          'Drawing data - outlines, walls, label positions - is deliberately not here. It would be a separate /data/plan.json.',
        ],
        floors: FLOORS.map((id) => ({ id, ...FLOOR_NAME[id] })),
        studios,
        spaces,
      },
      null,
      2,
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
