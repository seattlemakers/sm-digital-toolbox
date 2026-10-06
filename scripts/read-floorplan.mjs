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

const FLOORS = [
  { key: 'upstairs', group: 'upstairs', prefix: 'up' },
  { key: 'downstairs', group: 'downstairs', prefix: 'down' },
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

export type FloorPlan = {
  /** The drawing stacks the floors; this is the second one's own shift. */
  offsetY: number;
  /** The floorplate, with the doorways closed up, for the fill underneath. */
  outline: Pt[];
  /** Both floors share a width and a height, so they render at one scale. */
  viewBox: string;
  d: Record<Layer, string>;
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
  },`,
  )
  .join('\n')}
};

export const FLOORS: Floor[] = ['upstairs', 'downstairs'];
`);

for (const f of floors) {
  process.stderr.write(
    `${f.key}: outline ${f.outline.length} points, box ${round(f.box.x0)},${round(f.box.y0)} -> ${round(f.box.x1)},${round(f.box.y1)}\n`,
  );
}
