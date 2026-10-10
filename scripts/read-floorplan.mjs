/**
 * Import a hand-drawn SVG into src/data/floorplan.ts. A ONE-OFF, not a build step.
 *
 *   node scripts/read-floorplan.mjs [svg]            # print the rows it would write
 *   node scripts/read-floorplan.mjs [svg] --write    # overwrite them in floorplan.ts
 *
 * The SVG defaults to src/data/floorplan.svg, which is itself an EXPORT - see
 * scripts/export-floorplan.mjs --svg. Pass a path to import a different one.
 *
 * THIS OVERWRITES AUTHORED DATA. Until 2026-10-10 the drawing was the source of
 * truth and this ran on every change; now floorplan.ts is, and this is for
 * starting again from a redrawn building rather than for editing one. Every
 * name, anchor and line break in that file is replaced by whatever the SVG
 * says. Read the note at the top of floorplan.ts before running it.
 *
 * It is an extractor, not a cleanup: it copies the wall path data verbatim and
 * reads three things out of the drawing's own layers.
 *
 *   #room-U5 / #zone-U15.2   shape, fill, and which room a zone sits in
 *   #label-U5                the name, the author's line breaks, the anchor
 *   the floor groups         each floor's own vertical shift
 *
 * What it no longer does is compute the floorplate or the frame. Those are
 * derived from the walls at module load - see lib/floorplan-frame.ts - so there
 * is nothing for an import to get out of step with.
 *
 * A zone is a named area INSIDE a room - "Laser Cutting Studio" within the Fab
 * Lab, "Big CNC" within the Garage. The building divides into rooms, and a room
 * divides into zones that have no walls between them.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'src/data/floorplan.svg';
const svg = readFileSync(SOURCE, 'utf8');

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

/**
 * The entrance layer: names for the ways in, placed outside the walls.
 *
 * Scoped to one floor's group rather than scanned across the document, because
 * an entrance id is a bare word - "main", "member" - with none of the U/D
 * prefix that tells a room which floor it is on.
 */
function entrancesOf(prefix) {
  const open = svg.indexOf(`<g id="${prefix}-entrances"`);
  if (open < 0) return [];
  const block = svg.slice(open, svg.indexOf('</g>', open));
  return [...block.matchAll(/<text id="entrance-([^"]+)"([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({
    id: m[1],
    lines: [...m[3].matchAll(/<tspan[^>]*>([\s\S]*?)<\/tspan>/g)]
      .map((t) => t[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    at: [Number(m[2].match(/\sx="([-\d.]+)"/)[1]), Number(m[2].match(/\sy="([-\d.]+)"/)[1])],
    size: Number(m[2].match(/font-size="([\d.]+)"/)?.[1] ?? 7),
  }));
}

const floors = FLOORS.map((f) => ({
  ...f,
  offsetY: offsetOf(f.group),
  d: {
    exterior: pathOf(`${f.prefix}-exterior`),
    interior: pathOf(`${f.prefix}-interior`),
    stairs: pathOf(`${f.prefix}-stairs`),
  },
  rooms: ROOMS.filter((r) => r.id.startsWith(f.side)),
  zones: ZONES.filter((z) => z.id.startsWith(f.side)),
  entrances: entrancesOf(f.prefix),
}));

const q = (s) => JSON.stringify(s);

const shape = (s) =>
  `      { id: ${q(s.id)}, name: ${q(s.name)},${s.room ? ` room: ${q(s.room)},` : ''} fill: ${q(s.fill)},\n        lines: ${q(s.lines)}, at: [${s.at.join(', ')}], size: ${s.size},\n        points: [${s.points.map((p) => `[${p.join(', ')}]`).join(', ')}] },`;

const rows = floors
  .map(
    (f) => `  ${f.key}: {
    offsetY: ${f.offsetY},
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
    entrances: [
${f.entrances.map((e) => `      { id: ${q(e.id)}, lines: ${q(e.lines)}, at: [${e.at.join(', ')}], size: ${e.size} },`).join('\n')}
    ],
  },`,
  )
  .join('\n');

/**
 * Splice the rows into floorplan.ts rather than printing a whole file.
 *
 * That file is now hand-written and most of it is prose - the note explaining
 * why the data is the source of truth, and the types. Regenerating the lot
 * would delete all of it, which is exactly the kind of silent loss the flip was
 * meant to end. The two markers are the only thing an import is allowed to
 * touch.
 */
const TARGET = 'src/data/floorplan.ts';
const OPEN = 'export const BUILDING: Record<Floor, FloorRows> = {';
const CLOSE = '\n};\n\n// --- derived';

if (process.argv.includes('--write')) {
  const cur = readFileSync(TARGET, 'utf8');
  const a = cur.indexOf(OPEN);
  const b = cur.indexOf(CLOSE, a);
  if (a < 0 || b < 0) throw new Error(`${TARGET}: cannot find the BUILDING block to replace`);
  writeFileSync(TARGET, `${cur.slice(0, a + OPEN.length)}\n${rows}${cur.slice(b)}`);
  process.stderr.write(`${TARGET}: BUILDING replaced from the drawing\n`);
} else {
  process.stdout.write(`${OPEN}\n${rows}\n};\n`);
  process.stderr.write('\nNothing written. Re-run with --write to overwrite the rows in src/data/floorplan.ts.\n');
}

for (const f of floors) {
  process.stderr.write(`${f.key}: ${f.rooms.length} rooms, ${f.zones.length} zones\n`);
}
