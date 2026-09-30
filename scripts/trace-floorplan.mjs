/**
 * Trace the walls out of the space's floorplan drawing.
 *
 *   node scripts/trace-floorplan.mjs <plan.png> > src/data/walls.ts
 *
 * The first version of /map modelled the building as a list of ROOMS, each a
 * polygon with a stroke. That is a zone model, and it cannot express a
 * building: two rooms sharing a wall draw it twice, a wall that bounds a
 * corridor rather than a room does not exist at all, and a door is a gap in a
 * wall - so with no walls there is nowhere to put one.
 *
 * This extracts the walls themselves. A wall on the drawing is a long thin dark
 * rectangle, so:
 *
 *   1. Mark every dark pixel that sits in a horizontal dark run of at least
 *      MIN_LEN. That is the horizontal-wall mask; do the same vertically.
 *   2. Run-length encode each row of the mask and merge a run with the run
 *      below it when their ends line up, which turns the mask back into
 *      rectangles.
 *   3. Keep the rectangles whose short side is a plausible wall thickness.
 *
 * The thickness filter is what separates walls from everything else that is
 * dark: text glyphs never make a run long enough to enter the mask, and the
 * solid black furniture (the extractor hoods) is far too thick to leave it.
 *
 * MIN_THICK is 1, and that is not slack - it is the whole reason this works on
 * this drawing. The exterior walls are 7-9px of solid black, but the interior
 * partitions are a SINGLE dark pixel, drawn between two tape-coloured zone
 * boxes and anti-aliased into both. At MIN_THICK 3 and DARK 120 the trace came
 * back with the shell, the bathrooms and the stairs and almost nothing else,
 * which reads as "this drawing has no interior walls" and is wrong.
 *
 * DOORS COME OUT FOR FREE, and that is the main reason for doing it this way.
 * Runs are deliberately not merged across gaps, so a wall with a doorway in it
 * arrives as two rectangles with a hole between them. A junction where another
 * wall crosses does not break a run - the crossing wall is dark too - so the
 * holes that survive are openings rather than artefacts.
 */
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

const MIN_LEN = 22;      // shorter than this is lettering, not a wall
const MIN_THICK = 1;     // interior partitions are a single dark pixel wide
const MAX_THICK = 18;    // thicker than this is a filled object, not a wall
const DARK = 145;

/** Minimal PNG reader: 8-bit, non-interlaced, colour type 2 or 6. */
function readPng(path) {
  const buf = readFileSync(path);
  let off = 8, w = 0, h = 0, colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error('unsupported png');
      if (data[12] !== 0) throw new Error('interlaced png');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, bpp, data: out };
}

const img = readPng(process.argv[2]);
const { w, h, bpp, data } = img;

const dark = new Uint8Array(w * h);
for (let n = 0, o = 0; n < w * h; n++, o += bpp) {
  if (data[o] < DARK && data[o + 1] < DARK && data[o + 2] < DARK) dark[n] = 1;
}

/** Pixels sitting in a dark run of at least MIN_LEN along one axis. */
function runMask(horizontal) {
  const m = new Uint8Array(w * h);
  const outer = horizontal ? h : w;
  const inner = horizontal ? w : h;
  const at = horizontal ? (a, b) => a * w + b : (a, b) => b * w + a;
  for (let a = 0; a < outer; a++) {
    let start = 0;
    for (let b = 0; b <= inner; b++) {
      const on = b < inner && dark[at(a, b)];
      if (!on) {
        if (b - start >= MIN_LEN) for (let k = start; k < b; k++) m[at(a, k)] = 1;
        start = b + 1;
      }
    }
  }
  return m;
}

/**
 * Rectangles out of a mask. Rows of the mask are run-length encoded and a run
 * is merged with the one below when both ends agree within TOL - walls are not
 * pixel-exact at junctions, and an exact match splits one wall into a stack of
 * one-pixel slivers.
 */
function rectify(mask, horizontal) {
  const TOL = 2;
  const outer = horizontal ? h : w;
  const inner = horizontal ? w : h;
  const at = horizontal ? (a, b) => a * w + b : (a, b) => b * w + a;

  let open = [];
  const done = [];
  for (let a = 0; a < outer; a++) {
    const runs = [];
    let start = -1;
    for (let b = 0; b <= inner; b++) {
      const on = b < inner && mask[at(a, b)];
      if (on && start < 0) start = b;
      if (!on && start >= 0) { runs.push([start, b - 1]); start = -1; }
    }
    const next = [];
    const used = new Set();
    for (const r of open) {
      const i = runs.findIndex(
        (q, k) => !used.has(k) && Math.abs(q[0] - r.b0) <= TOL && Math.abs(q[1] - r.b1) <= TOL,
      );
      if (i >= 0) { used.add(i); r.a1 = a; r.b0 = Math.min(r.b0, runs[i][0]); r.b1 = Math.max(r.b1, runs[i][1]); next.push(r); }
      else done.push(r);
    }
    runs.forEach((q, k) => { if (!used.has(k)) next.push({ a0: a, a1: a, b0: q[0], b1: q[1] }); });
    open = next;
  }
  done.push(...open);

  return done
    .map((r) => {
      const thick = r.a1 - r.a0 + 1;
      const len = r.b1 - r.b0 + 1;
      if (thick < MIN_THICK || thick > MAX_THICK || len < MIN_LEN) return null;
      return horizontal
        ? { x: r.b0, y: r.a0, w: len, h: thick }
        : { x: r.a0, y: r.b0, w: thick, h: len };
    })
    .filter(Boolean);
}

/**
 * Furniture, not wall.
 *
 * The drawing fills its benches, tables and machines with a flat mid-grey and
 * outlines them, so their outlines are long thin dark rectangles and the trace
 * cannot tell them from partitions by shape - the rolling tables in Woodshop 2
 * came out as four convincing walls.
 *
 * What does tell them apart is what is beside them: a wall has room on both
 * sides, a furniture edge has the object's own grey fill on one. So each
 * candidate is sampled along both flanks, a few pixels clear of its own
 * anti-aliasing, and dropped when either flank is mostly solid grey.
 *
 * The threshold is 0.72 rather than a half, because a bench pushed up against
 * a wall gives that wall a grey flank too and those walls are real. It is the
 * furniture's own outline that is grey for nearly its whole length.
 */
function isFurniture(r, horizontal) {
  const GAP = 3, DEPTH = 3;
  const grey = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const o = (y * w + x) * bpp;
    const R = data[o], G = data[o + 1], B = data[o + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    return mx - mn < 26 && mn > 125 && mx < 215;
  };

  const len = horizontal ? r.w : r.h;
  const step = Math.max(1, Math.floor(len / 60));

  for (const side of [-1, 1]) {
    let hit = 0, seen = 0;
    for (let t = 0; t < len; t += step) {
      for (let d = 0; d < DEPTH; d++) {
        const off = side < 0 ? -(GAP + d) : (horizontal ? r.h : r.w) + GAP + d;
        const x = horizontal ? r.x + t : r.x + off;
        const y = horizontal ? r.y + off : r.y + t;
        seen++;
        if (grey(x, y)) hit++;
      }
    }
    if (seen && hit / seen > 0.72) return true;
  }
  return false;
}

const raw = [
  ...rectify(runMask(true), true).filter((r) => !isFurniture(r, true)),
  ...rectify(runMask(false), false).filter((r) => !isFurniture(r, false)),
];

/**
 * Drop the orphans.
 *
 * What survives the furniture test is mostly walls plus a scatter of short stubs -
 * a dimension leader, the edge of a callout box, a line of a drawn symbol.
 * They are indistinguishable from a door jamb by shape, but not by company: a
 * real wall meets another wall, because that is what makes a room. A stub in
 * the middle of the floor meets nothing.
 *
 * So a rectangle is kept when it touches another one, or when it is long
 * enough to be a wall on its own account regardless. One pass, not a transitive
 * closure - two stubs that happen to touch each other are rare, and chasing the
 * closure would let one long wall drag a chain of leaders in behind it.
 */
function prune(list) {
  const PAD = 5, LONE_OK = 60;
  const touches = (a, b) =>
    a.x - PAD < b.x + b.w && b.x - PAD < a.x + a.w &&
    a.y - PAD < b.y + b.h && b.y - PAD < a.y + a.h;

  return list.filter((r, i) => {
    if (Math.max(r.w, r.h) >= LONE_OK) return true;
    return list.some((q, j) => i !== j && touches(r, q));
  });
}

const walls = prune(raw).sort((a, b) => a.y - b.y || a.x - b.x);

/**
 * The drawing is a sheet, not a floorplate: it carries a key box down the
 * left, a north arrow above that, and the tape-colour table down the right.
 * All three are line art, so all three trace as convincingly as a wall - the
 * first render put the drawing's own compass on the page at ten times the size
 * of ours, and the key's border across the bottom-left corner.
 *
 * Clipping by floor is what separates the two plans anyway, so the same step
 * clips the sheet furniture off both.
 */
const BOUNDS = {
  up: { x0: 300, x1: 1862, y0: 18, y1: 750 },
  down: { x0: 300, x1: 1618, y0: 755, y1: 1486 },
};
const inside = (r, b) => r.x >= b.x0 && r.x + r.w <= b.x1 && r.y >= b.y0 && r.y + r.h <= b.y1;

const up = walls.filter((r) => inside(r, BOUNDS.up));
const down = walls.filter((r) => inside(r, BOUNDS.down));
const fmt = (list) =>
  list.map((r) => `  [${r.x}, ${r.y}, ${r.w}, ${r.h}],`).join('\n');

process.stdout.write(`/**
 * The building's walls, traced from the floorplan drawing.
 *
 * GENERATED by scripts/trace-floorplan.mjs - do not hand-edit. That script
 * carries the method and the reasoning; the short version is that a wall on
 * the drawing is a long thin dark rectangle, so the walls are what you get by
 * masking the dark pixels that sit in a long run and turning the mask back
 * into rectangles.
 *
 * Each entry is [x, y, width, height] in the drawing's own pixels, the same
 * frame data/rooms.ts uses. They are rectangles rather than centre lines
 * because a wall has a thickness and the drawing states it; a centre line
 * would throw that away and then need it back to look like a wall.
 *
 * The gaps between them are the doorways. Nothing here marks a door - the
 * absence IS the door, which is also how the building works.
 */
export type Wall = readonly [x: number, y: number, w: number, h: number];

export const WALLS_UPSTAIRS: Wall[] = [
${fmt(up)}
];

export const WALLS_DOWNSTAIRS: Wall[] = [
${fmt(down)}
];
`);

process.stderr.write(`upstairs ${up.length} walls, downstairs ${down.length} walls\n`);
