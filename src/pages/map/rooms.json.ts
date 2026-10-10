import type { APIRoute } from 'astro';
import { SPOTS } from '../../data/rooms';

/**
 * Every room, as the map understands it.
 *
 * This is for reading, not for feeding anything: the page is the thing to
 * review, and this is the same facts in a form somebody can diff, paste into a
 * message, or hand to whoever keeps the building's own list. Nothing in the
 * repo consumes it.
 *
 * `name` is the drawing's and `display` is the longer one where there is one -
 * both, always, even when they are the same string. A reviewer checking names
 * needs to see which spaces have a second one, and a file that collapsed them
 * when they matched would hide exactly that.
 *
 * It is an endpoint rather than a file in public/ for the reason the dummy
 * calendar is: it is generated from data that changes, and a copy in public/
 * is a copy that goes stale without anything saying so.
 */
export const GET: APIRoute = () => {
  const rooms = SPOTS.filter((s) => s.shape === 'room').map((s) => ({
    code: s.id,
    floor: s.floor,
    name: s.name,
    display: s.display,
    labelledOnPlan: s.drawn,
    kind: s.kind,
    studios: s.studios,
  }));

  return new Response(
    JSON.stringify(
      {
        what: 'Rooms on the Seattle Makers space map',
        source: 'src/data/floorplan.svg (names, shapes) + src/data/rooms.ts (studios, display names)',
        generated: new Date().toISOString(),
        count: rooms.length,
        rooms,
      },
      null,
      2,
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
