import type { APIRoute } from 'astro';
import { SPOTS, SPOT_BY_ID } from '../../data/rooms';

/**
 * Every zone, with the room it sits in.
 *
 * A zone is a named area inside a room with no wall between them, so its
 * parent is the thing most worth checking about it - "the Jewelry Studio is
 * inside Metal Studios" is a claim somebody can be wrong about, and it is not
 * visible on the plan, where a zone is just a dashed outline. So `room` names
 * it rather than only coding it.
 *
 * See rooms.json.ts for why `name` and `display` are both always present.
 */
export const GET: APIRoute = () => {
  const zones = SPOTS.filter((s) => s.shape === 'zone').map((s) => ({
    code: s.id,
    floor: s.floor,
    name: s.name,
    display: s.display,
    room: { code: s.room, name: SPOT_BY_ID.get(s.room!)?.name },
    labelledOnPlan: s.drawn,
    kind: s.kind,
    studios: s.studios,
  }));

  return new Response(
    JSON.stringify(
      {
        what: 'Zones on the Seattle Makers space map - named areas inside a room',
        source: 'src/data/floorplan.svg (names, shapes) + src/data/rooms.ts (studios, display names)',
        generated: new Date().toISOString(),
        count: zones.length,
        zones,
      },
      null,
      2,
    ),
    { headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
