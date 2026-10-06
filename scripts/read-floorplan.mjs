/**
 * Read the authored floorplan into data the page can draw.
 *
 *   node scripts/read-floorplan.mjs > src/data/floorplan.ts
 *
 * `src/data/floorplan.svg` is drawn by hand and is the source of truth for the
 * building's geometry. It replaced a trace of the space's old CAD drawing, and
 * replaced the whole pipeline with it - the tracer, the normaliser and their
 * tests - because every problem those solved is one a hand-drawn plan does not
 * have. Walls are already two weights, already on shared lines, already meeting
 * at the corners, and the doorways are already pen-ups rather than something to
 * be inferred from a gap and a threshold.
 *
 * So this is an extractor, not a cleanup. It copies the path data verbatim and
 * works out three things the SVG states only implicitly:
 *
 *   1. The floorplate, for the fill under everything. The exterior is drawn as
 *      one outline with the pen lifted at each door, so joining its points in
 *      order and closing the loop gives the building's shape back - the pen-ups
 *      are exactly the doors and nothing else.
 *   2. Each floor's extents, so the two can be framed at one scale.
 *   3. The viewBoxes, with a gutter on the left for the compass.
 *
 * It parses only M/L/H/V/Z absolute, and throws on anything else. A future
 * export that introduces a curve should fail loudly here rather than quietly
 * dropping a wall.
 *
 * THE DRAWING ALSO NAMES THE ROOMS, as of 2026-10-05, and that changed what
 * data/rooms.ts is for. Rooms and zones arrive as `#room-U5` / `#zone-U15.2`
 * with a label layer beside them, so the drawing is now the source of truth for
 * what a room is called and what shape it is. rooms.ts keeps only what the
 * drawing cannot know: which studios are in a room, and the open questions.
 *
 * A zone is a named area INSIDE a room - "Laser Cutting Studio" within the Fab
 * Lab, "Big CNC" within the Garage. That is the relationship the old tape
 * colours were reaching for and never quite had: the building divides into
 * rooms, and a room divides into zones that have no walls between them.
 */
import { readFileSync } from 'node:fs';

const svg = readFileSync('src/data/floorplan.svg', 'utf8');

const pathOf = (id) => {
  const m = svg.match(new RegExp(`<path[^>]*id="${id}"[^>]*\\sd="([^"]+)"`));
  if (!m) throw new Error(`floorplan.svg: no path with id "${id}"`);
  return m[1].trim();
};

const offsetOf = (id) => {
  const g = svg.match(new RegExp(`<g[^>]*id="${id}"[^>]*>`));
  if (!g) throw new Error(`floorplan.svg: no group with id "${id}"`);
  const t = g[0].match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  if (!t) return 0;
  if (Number(t[1]) !== 0) throw new Error(`floorplan.svg: "${id}" is shifted sideways; only a vertical offset is handled`);
  return Number(t[2]);
};

/** Points along a path, in order, with each subpath's start marked. */
function points(d) {
  const out = [];
  const tokens = d.match(/[A-Za-z]|-?[\d.]+/g) ?? [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`floorplan.svg: bad number near "${tokens[i - 1]}"`);
    return v;
  };

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case 'M':
        x = num(); y = num(); startX = x; startY = y;
        out.push({ x, y, move: true });
        cmd = 'L'; // a second pair after M is an implicit lineto
        break;
      case 'L': x = num(); y = num(); out.push({ x, y, move: false }); break;
      case 'H': x = num(); out.push({ x, y, move: false }); break;
      case 'V': y = num(); out.push({ x, y, move: false }); break;
      case 'Z': case 'z': x = startX; y = startY; out.push({ x, y, move: false }); break;
      default: throw new Error(`floorplan.svg: unsupported path command "${cmd}" - only M/L/H/V/Z are handled`);
    }
  }
  return out;
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * The building's shape, from the exterior outline with its doorways closed up.
 * The pen-ups in that path are doors, so ignoring them - joining every point in
 * the order it was drawn - traces the floorplate exactly.
 */
function outline(d) {
  const pts = points(d).map((p) => [round(p.x), round(p.y)]);
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // A closed outline repeats its first point at the end; drop it.
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

/** Every `<path id="room-X" fill d>` or `<path id="zone-X" data-room d>`. */
function shapes(kind) {
  const out = [];
  const re = new RegExp(`<path id="${kind}-([^"]+)"([^>]*)>`, 'g');
  for (const m of svg.matchAll(re)) {
    const attrs = m[2];
    const d = attrs.match(/\sd="([^"]+)"/);
    if (!d) throw new Error(`floorplan.svg: ${kind} "${m[1]}" has no path data`);
    out.push({
      id: m[1],
      fill: attrs.match(/fill="([^"]+)"/)?.[1] ?? null,
      room: attrs.match(/data-room="([^"]+)"/)?.[1] ?? null,
      points: outline(d[1]),
    });
  }
  return out;
}

/**
 * The label layer, which is where the names live.
 *
 * Joined with a space across tspans, because a two-line label is two of them -
 * without it "U2: Compressor" and "Room" come back as "CompressorRoom". The
 * `U2: ` prefix is the drawing's own cross-reference and comes off; the id is
 * already on the element.
 *
 * The x/y is the author's chosen anchor and is kept. A centroid would be the
 * obvious alternative and is worse: on an L-shaped room it lands in the wall,
 * and these have been placed by somebody looking at the plan.
 */
function labels() {
  const out = {};
  for (const m of svg.matchAll(/<text id="z?label-([^"]+)"([^>]*)>([\s\S]*?)<\/text>/g)) {
    const id = m[1];
    const attrs = m[2];

    // The author broke each name into lines that fit its own room, so the
    // tspans are kept as lines rather than joined. Re-wrapping here would be
    // guessing at a decision somebody has already made while looking at the
    // plan - and the first version did join them, which is how "U2: Compressor"
    // and "Room" came back as "CompressorRoom".
    const lines = [...m[3].matchAll(/<tspan[^>]*>([\s\S]*?)<\/tspan>/g)]
      .map((t) => t[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    // Room labels read "U2: Compressor" on their first line; zone labels put
    // the id on a line of its own. Both lose it.
    const head = lines[0].replace(new RegExp(`^${id.replace('.', '\\.')}:?\\s*`), '').trim();
    if (head) lines[0] = head;
    else lines.shift();

    out[id] = {
      lines,
      name: lines.join(' '),
      at: [Number(attrs.match(/\sx="([-\d.]+)"/)[1]), Number(attrs.match(/\sy="([-\d.]+)"/)[1])],
      size: Number(attrs.match(/font-size="([\d.]+)"/)?.[1] ?? 11),
    };
  }
  return out;
}

const LABEL = labels();
const named = (s, what) => {
  const l = LABEL[s.id];
  if (!l) throw new Error(`floorplan.svg: ${what} "${s.id}" has no label`);
  return { ...s, name: l.name, lines: l.lines, at: l.at, size: l.size };
};

const ROOMS = shapes('room').map((s) => named(s, 'room'));
const ZONES = shapes('zone').map((s) => named(s, 'zone'));

for (const z of ZONES) {
  if (!ROOMS.some((r) => r.id === z.room)) {
    throw new Error(`floorplan.svg: zone "${z.id}" names room "${z.room}", which is not drawn`);
  }
}

const FLOORS = [
  { key: 'upstairs', group: 'upstairs', prefix: 'up', side: 'U' },
  { key: 'downstairs', group: 'downstairs', prefix: 'down', side: 'D' },
];

const floors = FLOORS.map((f) => {
  const d = {
    exterior: pathOf(`${f.prefix}-exterior`),
    interior: pathOf(`${f.prefix}-interior`),
    stairs: pathOf(`${f.prefix}-stairs`),
  };
  const offsetY = offsetOf(f.group);
  const all = [...points(d.exterior), ...points(d.interior), ...points(d.stairs)];
  return {
    ...f,
    d,
    offsetY,
    rooms: ROOMS.filter((r) => r.id.startsWith(f.side)),
    zones: ZONES.filter((z) => z.id.startsWith(f.side)),
    outline: outline(d.exterior),
    box: {
      x0: Math.min(...all.map((p) => p.x)),
      x1: Math.max(...all.map((p) => p.x)),
      y0: Math.min(...all.map((p) => p.y)) + offsetY,
      y1: Math.max(...all.map((p) => p.y)) + offsetY,
    },
  };
});

/**
 * One frame for both floors, so they render at one scale and the building lines
 * up between them. GUTTER is the room the compass stands in, outside the
 * building; MARGIN is breathing space on the other three sides. Each floor's
 * own content is then centred vertically in the shared height, so a shorter
 * floor is not stretched to fill its box.
 */
const GUTTER = 46;
const MARGIN = 12;
const vbX = Math.min(...floors.map((f) => f.box.x0)) - GUTTER;
const vbW = Math.max(...floors.map((f) => f.box.x1)) + MARGIN - vbX;
const vbH = Math.max(...floors.map((f) => f.box.y1 - f.box.y0)) + MARGIN * 2;

const view = (f) => {
  const slack = (vbH - (f.box.y1 - f.box.y0)) / 2;
  return `${round(vbX)} ${round(f.box.y0 - slack)} ${round(vbW)} ${round(vbH)}`;
};

const q = (s) => JSON.stringify(s);

const shape = (s) =>
  `      { id: ${q(s.id)}, name: ${q(s.name)},${s.room ? ` room: ${q(s.room)},` : ''} fill: ${q(s.fill)},\n        lines: ${q(s.lines)}, at: [${s.at.join(', ')}], size: ${s.size},\n        points: [${s.points.map((p) => `[${p.join(', ')}]`).join(', ')}] },`;

process.stdout.write(`/**
 * The building, drawn rather than traced.
 *
 * GENERATED by scripts/read-floorplan.mjs from src/data/floorplan.svg - do not
 * hand-edit. To take a new version of the drawing: replace that SVG and re-run
 * the script.
 *
 * The three layers are the drawing's own, and so are their weights: the outside
 * of the building, the partitions inside it, and the stairs, which are drawn
 * lightest because they are a thing you walk on rather than a thing you cannot
 * walk through. Doorways are pen-ups in the path data - the absence IS the
 * door, which is also how the building works.
 */
export type Floor = 'upstairs' | 'downstairs';
export type Layer = 'exterior' | 'interior' | 'stairs';
export type Pt = readonly [number, number];

/** Stroke weights, in the drawing's own units, exactly as it sets them. */
export const STROKE: Record<Layer, number> = {
  exterior: 6,
  interior: 3,
  stairs: 1.5,
};

/**
 * A room, as the drawing names and shapes it. The fill is the author's own
 * colour-coding of what kind of space it is, and "at" is where they put the
 * label - which beats a computed centroid, since on an L-shaped room that lands
 * in a wall.
 */
export type Room = {
  id: string;
  name: string;
  /** The author's own line breaks, which are fitted to this room's width. */
  lines: string[];
  fill: string | null;
  points: Pt[];
  at: Pt;
  size: number;
};

/**
 * A named area inside a room - "Laser Cutting Studio" within the Fab Lab, "Big
 * CNC" within the Garage. No wall divides a zone from its room or from its
 * siblings, and that is exactly what makes it a zone rather than a room.
 */
export type Zone = Room & { room: string };

export type FloorPlan = {
  /** The drawing stacks the floors; this is the second one's own shift. */
  offsetY: number;
  /** The floorplate, with the doorways closed up, for the fill underneath. */
  outline: Pt[];
  /** Both floors share a width and a height, so they render at one scale. */
  viewBox: string;
  d: Record<Layer, string>;
  rooms: Room[];
  zones: Zone[];
};

export const FLOORPLAN: Record<Floor, FloorPlan> = {
${floors
  .map(
    (f) => `  ${f.key}: {
    offsetY: ${f.offsetY},
    viewBox: ${q(view(f))},
    outline: [
${f.outline.map((p) => `      [${p[0]}, ${p[1]}],`).join('\n')}
    ],
    d: {
      exterior: ${q(f.d.exterior)},
      interior: ${q(f.d.interior)},
      stairs: ${q(f.d.stairs)},
    },
    rooms: [
${f.rooms.map(shape).join('\n')}
    ],
    zones: [
${f.zones.map(shape).join('\n')}
    ],
  },`,
  )
  .join('\n')}
};

export const FLOORS: Floor[] = ['upstairs', 'downstairs'];
`);

for (const f of floors) {
  process.stderr.write(
    `${f.key}: ${f.rooms.length} rooms, ${f.zones.length} zones, outline ${f.outline.length} points, box ${round(f.box.x0)},${round(f.box.y0)} -> ${round(f.box.x1)},${round(f.box.y1)}\n`,
  );
}
