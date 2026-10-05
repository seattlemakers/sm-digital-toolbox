/**
 * Turn the traced wall rectangles into a drawn plan.
 *
 * The trace (scripts/trace-floorplan.mjs) reports what is actually inked on the
 * source drawing, which is the right thing for it to do and the wrong thing to
 * render. The drawing is not consistent: a wall is 1px here and 9px there, two
 * stretches of the same wall sit a pixel apart, a junction leaves a notch, and
 * a run breaks for reasons that are antialiasing rather than architecture. Drawn
 * literally that reads as a hundred unrelated marks.
 *
 * This is the pass that makes it a diagram. Walls come in exactly two weights -
 * the outside of the building, and everything else - every wall lies on a shared
 * line with its neighbours, collinear fragments are stitched back into one wall,
 * and corners actually meet. What is deliberately NOT cleaned up is the gaps:
 * a hole in a wall is a doorway, and the whole reason for tracing rather than
 * drawing was to get them for free.
 *
 * Pure, and takes the floorplate as an argument rather than importing it, so
 * `npm test` can run it on three rectangles instead of on the building.
 */

export type Rect = readonly [x: number, y: number, w: number, h: number];
export type Pt = readonly [number, number];
export type Kind = 'ext' | 'int';

export type Seg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: Kind;
};

/** A wall reduced to its centre line: which way it runs, and where. */
type Lin = {
  axis: 'h' | 'v';
  /** The coordinate the wall does NOT vary along - y for horizontal walls. */
  pos: number;
  a: number;
  b: number;
  kind: Kind;
};

/**
 * Every threshold here is in the drawing's own pixels, and the one that matters
 * is STITCH. A doorway on this drawing measures about 46px - the gap in the top
 * wall where it is marked "door to outside" is 1451 to 1497 - so the distance
 * that closes a crack has to sit well under that or it eats the doors. 14 is
 * comfortably below a door and comfortably above the two or three pixels that
 * antialiasing and junctions actually cost.
 */
const SHELL_TOL = 11; // how near the floorplate's edge counts as being on it

/**
 * ALIGN is 22, and it is measured rather than chosen. A partition between two
 * tape zones is drawn as the edge of each zone, so one wall arrives as two or
 * three parallel lines up to 18px apart - the kitchen's wall came through as
 * three, at x 562, 572 and 580, which on the plan is a wall with a stripe in
 * it. Tried at 7, 12, 18 and 22: the plan is identical at 18 and 22 except that
 * 22 takes the last two pairs, and once merged the closest any two distinct
 * walls come is 25px. So the window sits in a real gap, with nothing of the
 * building inside it.
 */
const ALIGN = 22;
const JOIN = 10;      // an end this close to a crossing wall is pulled onto it
const STITCH = 14;    // a gap this small is a crack; anything bigger is a door
const MIN_SEG = 16;   // shorter than this, after stitching, is not a wall

const edgesOf = (poly: readonly Pt[]): [Pt, Pt][] =>
  poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);

const isH = ([p, q]: [Pt, Pt]) => Math.abs(p[1] - q[1]) <= 2;
const isV = ([p, q]: [Pt, Pt]) => Math.abs(p[0] - q[0]) <= 2;

/** The long axis wins; a square fragment is treated as horizontal. */
function toLin(r: Rect): Lin {
  const [x, y, w, h] = r;
  return w >= h
    ? { axis: 'h', pos: y + h / 2, a: x, b: x + w, kind: 'int' }
    : { axis: 'v', pos: x + w / 2, a: y, b: y + h, kind: 'int' };
}

/**
 * A wall is exterior when it runs along the floorplate's own edge.
 *
 * Deliberately geometric rather than reading the traced thickness. The drawing's
 * exterior walls ARE drawn heavier, so thickness nearly works - but "nearly" is
 * how a thick interior wall ends up as heavy as the outside of the building,
 * and the point of the two weights is that one of them means "this is the
 * building" rather than "this line was drawn boldly".
 */
function classify(l: Lin, poly: readonly Pt[]): Kind {
  for (const e of edgesOf(poly)) {
    const horiz = isH(e);
    if (horiz !== (l.axis === 'h')) continue;
    if (!horiz && !isV(e)) continue;

    const pos = horiz ? (e[0][1] + e[1][1]) / 2 : (e[0][0] + e[1][0]) / 2;
    const lo = horiz ? Math.min(e[0][0], e[1][0]) : Math.min(e[0][1], e[1][1]);
    const hi = horiz ? Math.max(e[0][0], e[1][0]) : Math.max(e[0][1], e[1][1]);

    // Near the edge's line, and actually overlapping the stretch of it.
    if (Math.abs(l.pos - pos) <= SHELL_TOL && l.b > lo + 4 && l.a < hi - 4) return 'ext';
  }
  return 'int';
}

/** The floorplate's own axis-aligned lines, which exterior walls snap onto. */
function shellLines(poly: readonly Pt[], axis: 'h' | 'v'): number[] {
  const out: number[] = [];
  for (const e of edgesOf(poly)) {
    if (axis === 'h' && isH(e)) out.push((e[0][1] + e[1][1]) / 2);
    if (axis === 'v' && isV(e)) out.push((e[0][0] + e[1][0]) / 2);
  }
  return out;
}

/**
 * Pull walls that are nearly collinear onto one line.
 *
 * Grouped against the first member rather than the previous one: chaining lets a
 * long row of walls each 6px from the last drift fifty pixels from where it
 * started, which is how a straight corridor comes out as a shallow staircase.
 *
 * An exterior wall takes the floorplate's line rather than the group's average,
 * so the outside of the building is exactly where the floor says it is. Everyone
 * else takes the mean weighted by length, so a long wall sets the line and the
 * stub beside it moves, not the other way round.
 */
function alignPositions(lins: Lin[], poly: readonly Pt[], axis: 'h' | 'v'): void {
  const mine = lins.filter((l) => l.axis === axis).sort((p, q) => p.pos - q.pos);
  const shell = shellLines(poly, axis);

  let i = 0;
  while (i < mine.length) {
    const group = [mine[i]];
    let j = i + 1;
    while (j < mine.length && mine[j].pos - mine[i].pos <= ALIGN) group.push(mine[j++]);

    let target: number;
    const onShell = group.find((l) => l.kind === 'ext');
    if (onShell && shell.length) {
      target = shell.reduce((best, s) =>
        Math.abs(s - onShell.pos) < Math.abs(best - onShell.pos) ? s : best,
      );
    } else {
      const total = group.reduce((n, l) => n + (l.b - l.a), 0);
      target = group.reduce((n, l) => n + l.pos * (l.b - l.a), 0) / (total || 1);
    }

    for (const l of group) l.pos = Math.round(target);
    i = j;
  }
}

/**
 * Pull wall ends onto the walls they nearly meet, so corners close.
 *
 * Without it every junction leaves a notch the width of the wall, which at this
 * scale reads as a building whose corners do not quite touch - the single thing
 * that made the first render look hand-drawn. The crossing wall has to actually
 * reach this one, or a door jamb gets stretched sideways to a wall that stops
 * short of it.
 */
function joinEnds(lins: Lin[]): void {
  const cross = (axis: 'h' | 'v') => lins.filter((l) => l.axis === axis);

  for (const l of lins) {
    const others = cross(l.axis === 'h' ? 'v' : 'h');
    for (const end of ['a', 'b'] as const) {
      let best: number | null = null;
      for (const o of others) {
        if (l.pos < o.a - 6 || l.pos > o.b + 6) continue;
        const d = Math.abs(o.pos - l[end]);
        if (d <= JOIN && (best === null || d < Math.abs(best - l[end]))) best = o.pos;
      }
      if (best !== null) l[end] = best;
    }
  }
}

/**
 * Stitch collinear fragments, and leave the doors alone.
 *
 * This is the step the whole module exists for. Walls arrive broken wherever the
 * drawing's line thinned out or another wall crossed it, and those breaks are
 * two or three pixels; a doorway is forty-odd. Closing everything under STITCH
 * puts the wall back together and leaves every opening exactly where it was.
 */
function stitch(lins: Lin[]): Lin[] {
  const byLine = new Map<string, Lin[]>();
  for (const l of lins) {
    const key = `${l.axis}:${l.pos}:${l.kind}`;
    (byLine.get(key) ?? byLine.set(key, []).get(key)!).push(l);
  }

  const out: Lin[] = [];
  for (const run of byLine.values()) {
    run.sort((p, q) => p.a - q.a);
    let cur = { ...run[0] };
    for (const l of run.slice(1)) {
      if (l.a - cur.b <= STITCH) cur.b = Math.max(cur.b, l.b);
      else { out.push(cur); cur = { ...l }; }
    }
    out.push(cur);
  }
  return out;
}

/**
 * The floorplate's diagonal edges, which an axis-aligned trace cannot see.
 *
 * The only ones are the two walls of the recessed entrance. A trace that reports
 * rectangles renders a 45-degree wall as a staircase of fragments or, once the
 * orphan filter has been past, as nothing at all - and the building came out
 * with its corner missing. These are taken from the floorplate directly.
 */
function diagonals(poly: readonly Pt[]): Seg[] {
  return edgesOf(poly)
    .filter((e) => !isH(e) && !isV(e))
    .map(([p, q]) => ({ x1: p[0], y1: p[1], x2: q[0], y2: q[1], kind: 'ext' as const }));
}

/** How near two walls have to come before they count as meeting. */
const TOUCH = 8;

/** Shortest distance between two segments, for the "does this meet anything" test. */
function gapBetween(s: Seg, t: Seg): number {
  const toSeg = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const u = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(ax + u * dx - px, ay + u * dy - py);
  };
  return Math.min(
    toSeg(s.x1, s.y1, s.x2, s.y2, t.x1, t.y1),
    toSeg(s.x1, s.y1, s.x2, s.y2, t.x2, t.y2),
    toSeg(t.x1, t.y1, t.x2, t.y2, s.x1, s.y1),
    toSeg(t.x1, t.y1, t.x2, t.y2, s.x2, s.y2),
  );
}

/**
 * Stairs are not walls.
 *
 * A staircase on the source drawing is a ladder of treads, and the trace cannot
 * tell a tread from a partition - they are both short parallel lines. Rendered
 * at a wall's weight they claim to be something you cannot walk through, which
 * on this plan is the one thing a black line means. They come out, and the
 * stairs get said in words instead.
 *
 * The test is tight on purpose, because a row of small rooms down a corridor
 * looks like a ladder from a distance: three or more parallels, evenly and
 * closely spaced, spanning the same stretch, and all about the same length. The
 * last of those is what rules out real walls - the four parallels beside the
 * kitchen measure 131, 30, 192 and 23, and no staircase is built like that.
 */
function dropTreads(segs: Seg[]): Seg[] {
  const doomed = new Set<Seg>();

  for (const axis of ['h', 'v'] as const) {
    const horiz = axis === 'h';
    const pos = (s: Seg) => (horiz ? s.y1 : s.x1);
    const lo = (s: Seg) => (horiz ? Math.min(s.x1, s.x2) : Math.min(s.y1, s.y2));
    const hi = (s: Seg) => (horiz ? Math.max(s.x1, s.x2) : Math.max(s.y1, s.y2));
    const len = (s: Seg) => hi(s) - lo(s);

    const line = segs.filter(
      (s) => s.kind === 'int' && (horiz ? s.y1 === s.y2 : s.x1 === s.x2),
    );

    for (const seed of line) {
      if (doomed.has(seed)) continue;

      // Gather the seed's peers FIRST, then look at their spacing. Walking a
      // globally sorted list instead lets any unrelated wall that happens to
      // lie between two treads break the run - which is exactly what hid the
      // east staircase, whose three treads have other walls at intervening y.
      const peers = line
        .filter((s) => {
          const overlap = Math.min(hi(s), hi(seed)) - Math.max(lo(s), lo(seed));
          return (
            overlap >= 0.7 * Math.max(len(s), len(seed)) &&
            Math.abs(len(s) - len(seed)) <= 0.25 * len(seed)
          );
        })
        .sort((p, q) => pos(p) - pos(q));

      let run: Seg[] = [];
      let best: Seg[] = [];
      for (const s of peers) {
        const step = run.length ? pos(s) - pos(run[run.length - 1]) : 0;
        if (run.length && (step < 4 || step > 26)) run = [];
        run.push(s);
        if (run.length > best.length) best = [...run];
      }
      if (best.length >= 3) for (const s of best) doomed.add(s);
    }
  }

  return segs.filter((s) => !doomed.has(s));
}

/**
 * A wall that meets nothing is not a wall.
 *
 * What is left at this point is almost all building, plus a handful of marks
 * that traced like a partition and are not one: the edge of a machine, a zone
 * box drawn on the floor, the top of the Material Storage bay. Every real wall
 * runs into another wall or into the outside of the building, because that is
 * what makes a room; these run into nothing.
 *
 * Exterior walls are exempt. A stretch of the building's own edge is the
 * building whether or not anything else reaches it - and the top wall's
 * doorway, for example, leaves a stub with a partition at only one end.
 */
function dropOrphans(segs: Seg[]): Seg[] {
  return segs.filter(
    (s, i) => s.kind === 'ext' || segs.some((t, j) => i !== j && gapBetween(s, t) <= TOUCH),
  );
}

/**
 * A hole in the outside of the building that is too big to be a door is a hole
 * in the trace.
 *
 * The garage's wall is drawn in beige on the source, not black, so the trace
 * never saw it and the upstairs plan came out open across 247px of its top
 * right - which reads as a building with a side missing rather than as a wide
 * doorway. The entrance's own notch had a smaller version of the same thing.
 *
 * So the floorplate's edge is checked for stretches no traced wall covers, and
 * anything longer than an opening could plausibly be is filled in. The number
 * matters: a door here is about 46px, and the widest real opening on either
 * floor is the recessed entrance at 106. At 120 the garage closes and both of
 * those stay open, which is the whole distinction.
 */
const OPENING_MAX = 120;

function closeShell(segs: Seg[], poly: readonly Pt[]): Seg[] {
  const added: Seg[] = [];

  for (const e of edgesOf(poly)) {
    const horiz = isH(e);
    if (!horiz && !isV(e)) continue; // diagonals are added whole, never gapped

    const pos = horiz ? (e[0][1] + e[1][1]) / 2 : (e[0][0] + e[1][0]) / 2;
    const lo = horiz ? Math.min(e[0][0], e[1][0]) : Math.min(e[0][1], e[1][1]);
    const hi = horiz ? Math.max(e[0][0], e[1][0]) : Math.max(e[0][1], e[1][1]);

    const covered = segs
      .filter(
        (s) =>
          s.kind === 'ext' &&
          (horiz
            ? s.y1 === s.y2 && Math.abs(s.y1 - pos) <= SHELL_TOL
            : s.x1 === s.x2 && Math.abs(s.x1 - pos) <= SHELL_TOL),
      )
      .map((s) =>
        horiz
          ? [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)]
          : [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)],
      )
      .sort((a, b) => a[0] - b[0]);

    const fill = (a: number, b: number) =>
      added.push(
        horiz
          ? { x1: a, y1: pos, x2: b, y2: pos, kind: 'ext' }
          : { x1: pos, y1: a, x2: pos, y2: b, kind: 'ext' },
      );

    let cursor = lo;
    for (const [a, b] of covered) {
      if (a - cursor > OPENING_MAX) fill(cursor, a);
      cursor = Math.max(cursor, b);
    }
    if (hi - cursor > OPENING_MAX) fill(cursor, hi);
  }

  return [...segs, ...added];
}

/**
 * One wall per run, after everything else has had its say.
 *
 * `stitch` runs before the shell is repaired, so a filled-in hole arrives as a
 * second segment butted against the traced one - the same wall, drawn twice,
 * which is exactly the kind of thing this module exists to stop. Diagonals are
 * passed through untouched; the only ones are the entrance's two walls and they
 * meet nothing collinear.
 */
function mergeCollinear(segs: Seg[]): Seg[] {
  const slopes = segs.filter((s) => s.x1 !== s.x2 && s.y1 !== s.y2);
  const straight = segs.filter((s) => s.x1 === s.x2 || s.y1 === s.y2);

  const byLine = new Map<string, Seg[]>();
  for (const s of straight) {
    const horiz = s.y1 === s.y2;
    const key = `${horiz ? 'h' : 'v'}:${horiz ? s.y1 : s.x1}:${s.kind}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key)!.push(s);
  }

  const out: Seg[] = [];
  for (const [key, run] of byLine) {
    const horiz = key.startsWith('h');
    const lo = (s: Seg) => (horiz ? Math.min(s.x1, s.x2) : Math.min(s.y1, s.y2));
    const hi = (s: Seg) => (horiz ? Math.max(s.x1, s.x2) : Math.max(s.y1, s.y2));
    run.sort((p, q) => lo(p) - lo(q));

    let a = lo(run[0]);
    let b = hi(run[0]);
    const push = () =>
      out.push(
        horiz
          ? { x1: a, y1: run[0].y1, x2: b, y2: run[0].y1, kind: run[0].kind }
          : { x1: run[0].x1, y1: a, x2: run[0].x1, y2: b, kind: run[0].kind },
      );

    for (const s of run.slice(1)) {
      if (lo(s) - b <= STITCH) b = Math.max(b, hi(s));
      else { push(); a = lo(s); b = hi(s); }
    }
    push();
  }

  return [...out, ...slopes];
}

/** The whole pass: traced rectangles in, a drawable plan out. */
export function wallPlan(rects: readonly Rect[], poly: readonly Pt[]): Seg[] {
  const lins = rects.map(toLin);
  for (const l of lins) l.kind = classify(l, poly);

  alignPositions(lins, poly, 'h');
  alignPositions(lins, poly, 'v');
  joinEnds(lins);

  const walls = stitch(lins).filter((l) => l.b - l.a >= MIN_SEG);

  const segs: Seg[] = [
    ...walls.map((l) =>
      l.axis === 'h'
        ? { x1: l.a, y1: l.pos, x2: l.b, y2: l.pos, kind: l.kind }
        : { x1: l.pos, y1: l.a, x2: l.pos, y2: l.b, kind: l.kind },
    ),
    // Added before the two drops, not after: the entrance diagonals are what
    // the walls either side of them meet, so leaving them out until the end
    // would orphan the very walls they anchor.
    ...diagonals(poly),
  ];

  // closeShell before dropOrphans, not after. An interior wall whose only
  // neighbour is a stretch of exterior wall the trace missed is a real wall,
  // and checked in the other order it has nothing to touch and is deleted.
  return mergeCollinear(dropOrphans(closeShell(dropTreads(segs), poly)));
}
