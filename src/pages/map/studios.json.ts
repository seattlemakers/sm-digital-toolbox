import type { APIRoute } from 'astro';
import { SPACE_STUDIOS } from '../../data/space-studios';
import { spotsForStudio, placeOf } from '../../data/rooms';

/**
 * Every studio, and where each one works.
 *
 * This is the map's own list, not the calendar's - see space-studios.ts. The
 * two are expected to differ, so anyone comparing this against a booking
 * system's categories should expect to, and the slug is the only thing the two
 * still share.
 *
 * `where` is the answer the map exists to give, so it is spelled out rather
 * than left as a list of codes: "Fab Lab, laser cutting studio" is checkable
 * by somebody who knows the building, and "U15.2" is not.
 */
export const GET: APIRoute = () => {
  const studios = SPACE_STUDIOS.map((st) => ({
    slug: st.slug,
    name: st.name,
    colour: st.colour,
    where: spotsForStudio(st.slug).map((sp) => ({
      code: sp.id,
      floor: sp.floor,
      place: placeOf(sp),
    })),
  }));

  return new Response(
    JSON.stringify(
      {
        what: "Studios on the Seattle Makers space map, and the spaces each one works in",
        source: 'src/data/space-studios.ts (names, colours) + src/data/rooms.ts (which spaces)',
        note: 'The map keeps its own studio list; src/data/studios.ts is the calendar’s and differs on purpose.',
        generated: new Date().toISOString(),
        count: studios.length,
        studios,
      },
      null,
      2,
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
