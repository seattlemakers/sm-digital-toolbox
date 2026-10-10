/**
 * The two things about the building that are DERIVED rather than authored.
 *
 * Both of these used to be computed by scripts/read-floorplan.mjs and written
 * into floorplan.ts, back when that file was generated. They moved here on
 * 2026-10-10 when the data became the source of truth: a value that can be
 * worked out from the walls should never be a row somebody has to keep in step
 * by hand, because the day it drifts is the day the floorplate stops matching
 * the building it is drawn under.
 *
 * Nothing in here imports data. It takes path strings and extents and gives
 * back shapes and numbers, which is what makes it testable without the
 * building - see scripts/test-floorplan-frame.mjs.
 */
export type Pt = readonly [number, number];

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Points along a path, in order, with each subpath's start marked.
 *
 * Only M/L/H/V/Z absolute, and it throws on anything else. That is deliberate:
 * a curve would be silently mis-traced into a straight line, and a wall that
 * quietly changes shape is worse than a build that stops.
 */
export function points(d: string): { x: number; y: number; move: boolean }[] {
  const out: { x: number; y: number; move: boolean }[] = [];
  const tokens = d.match(/[A-Za-z]|-?[\d.]+/g) ?? [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const num = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`floorplan: bad number near "${tokens[i - 1]}"`);
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
      default: throw new Error(`floorplan: unsupported path command "${cmd}" - only M/L/H/V/Z are handled`);
    }
  }
  return out;
}

/**
 * The building's shape, from the exterior outline with its doorways closed up.
 *
 * The exterior is one outline with the pen lifted at each door, so ignoring the
 * pen-ups - joining every point in the order it was drawn - traces the
 * floorplate exactly. The pen-ups are the doors and nothing else, which is what
 * makes that right rather than lucky.
 */
export function outline(d: string): Pt[] {
  const pts = points(d).map((p) => [round(p.x), round(p.y)] as Pt);
  const out: Pt[] = [];
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

/** A floor's extents, in the drawing's units, including its own vertical shift. */
export type Box = { x0: number; x1: number; y0: number; y1: number };

export function extents(paths: string[], offsetY: number): Box {
  const all = paths.flatMap((d) => points(d));
  return {
    x0: Math.min(...all.map((p) => p.x)),
    x1: Math.max(...all.map((p) => p.x)),
    y0: Math.min(...all.map((p) => p.y)) + offsetY,
    y1: Math.max(...all.map((p) => p.y)) + offsetY,
  };
}

/**
 * GUTTER is the room the compass stands in, outside the building; MARGIN is
 * breathing space on the other three sides.
 *
 * Drawn at the viewBox origin the compass landed inside whichever room owns the
 * top-left corner and was painted over, which is where the gutter comes from.
 */
export const GUTTER = 46;
export const MARGIN = 12;

/**
 * One frame for both floors, so they render at one scale and the building lines
 * up between them. Each floor's own content is then centred vertically in the
 * shared height, so a shorter floor is not stretched to fill its box.
 *
 * The upstairs plate runs further left than the downstairs one, so given its
 * own extents each floor would fill its frame and the building would appear to
 * change shape between them. The empty strip is the point.
 */
export function frames(boxes: Box[]): string[] {
  const x = Math.min(...boxes.map((b) => b.x0)) - GUTTER;
  const w = Math.max(...boxes.map((b) => b.x1)) + MARGIN - x;
  const h = Math.max(...boxes.map((b) => b.y1 - b.y0)) + MARGIN * 2;
  return boxes.map((b) => {
    const slack = (h - (b.y1 - b.y0)) / 2;
    return `${round(x)} ${round(b.y0 - slack)} ${round(w)} ${round(h)}`;
  });
}
