/**
 * lib/wall-plan.ts, checked without a browser.
 *
 * No framework, matching test-month.mjs: Node strips the types, `assert` does
 * the rest. Run by `npm test`.
 *
 * What is worth pinning here is every threshold that decides whether two marks
 * are one wall. They are all a few pixels apart from each other and all of them
 * are invisible when wrong - a STITCH that creeps past a door's width silently
 * bricks up the door, and nothing on the plan says so. The synthetic fixtures
 * are a 1000x1000 room so the numbers can be read; the last block runs the real
 * building, because a cleanup pass that quietly deletes half of it would pass
 * every test above.
 */
import assert from 'node:assert/strict';
import { wallPlan } from '../src/lib/wall-plan.ts';
import { WALLS_UPSTAIRS, WALLS_DOWNSTAIRS } from '../src/data/walls.ts';

let checks = 0;
const is = (actual, expected, what) => {
  checks++;
  assert.deepEqual(actual, expected, what);
};
const ok = (cond, what) => {
  checks++;
  assert.ok(cond, what);
};

const BOX = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
/** The four exterior walls, as the trace would report them. */
const SHELL = [[0, 0, 1000, 8], [0, 0, 8, 1000], [992, 0, 8, 1000], [0, 992, 1000, 8]];

/**
 * Horizontal walls near a y, in order. A band rather than an exact value,
 * because the alignment pass rounds a wall onto a shared line and a centre line
 * that lands on .5 rounds up - asserting the exact pixel tests Math.round
 * rather than the thing the pass is for.
 */
const horiz = (segs, y, band = 6) =>
  segs.filter((s) => s.y1 === s.y2 && Math.abs(s.y1 - y) <= band).sort((a, b) => a.x1 - b.x1);

// --- a crack is closed, a doorway is not -----------------------------------
{
  // Two fragments six pixels apart are one wall the drawing failed to ink.
  const plan = wallPlan([...SHELL, [0, 499, 300, 3], [306, 499, 194, 3]], BOX);
  const run = horiz(plan, 500);
  is(run.length, 1, 'a six-pixel crack stitches into one wall');
  is([run[0].x1, run[0].x2], [0, 500], 'and keeps the full extent of both');
}
{
  // Forty-six is what a door measures on this drawing. It has to survive.
  const plan = wallPlan([...SHELL, [0, 299, 200, 3], [246, 299, 754, 3]], BOX);
  const run = horiz(plan, 300);
  is(run.length, 2, 'a door-width gap is left alone');
  is(run[1].x1 - run[0].x2, 46, 'and is exactly as wide as it was traced');
}

// --- walls that nearly share a line are made to share it -------------------
{
  const plan = wallPlan([...SHELL, [0, 199, 300, 3], [700, 203, 300, 3]], BOX);
  const run = plan.filter((s) => s.y1 === s.y2 && s.y1 > 100 && s.y1 < 300);
  is(run.length, 2, 'two walls four pixels apart stay two walls');
  is(run[0].y1, run[1].y1, 'but are drawn on one line');
}

// --- corners meet ----------------------------------------------------------
{
  // The vertical stops three pixels short of the horizontal it runs into.
  const plan = wallPlan([...SHELL, [399, 300, 3, 297], [400, 599, 600, 3]], BOX);
  const down = plan.filter((s) => s.x1 === s.x2 && s.x1 > 300 && s.x1 < 500)[0];
  const across = plan.filter((s) => s.y1 === s.y2 && s.y1 > 500 && s.y1 < 700)[0];
  ok(down && across, 'both walls survive');
  is(down.y2, across.y1, 'and the corner closes');
}

// --- a wall that meets nothing is not a wall -------------------------------
{
  const plan = wallPlan([...SHELL, [400, 400, 100, 3]], BOX);
  is(
    plan.filter((s) => s.y1 === s.y2 && s.y1 > 350 && s.y1 < 450).length,
    0,
    'a wall floating in the middle of the room is dropped',
  );
}

// --- stairs are not walls --------------------------------------------------
{
  // Three equal parallels, evenly spaced, over the same stretch: a staircase.
  const treads = [[100, 700, 80, 3], [100, 715, 80, 3], [100, 730, 80, 3]];
  const plan = wallPlan([...SHELL, ...treads], BOX);
  is(
    plan.filter((s) => s.y1 === s.y2 && s.y1 > 650 && s.y1 < 780).length,
    0,
    'a tread ladder is dropped',
  );
}
{
  // Same spacing, wildly different lengths - four rooms off a corridor, not a
  // staircase. This is the real arrangement beside the kitchen.
  const walls = [[0, 700, 131, 3], [0, 715, 30, 3], [0, 730, 192, 3], [0, 745, 23, 3]];
  const plan = wallPlan([...SHELL, ...walls], BOX);
  ok(
    plan.filter((s) => s.y1 === s.y2 && s.y1 > 650 && s.y1 < 780).length >= 3,
    'parallels of unequal length are kept',
  );
}

// --- a hole too big to be a door is a hole in the trace --------------------
{
  // Only the first 400px of the top wall was inked.
  const plan = wallPlan([[0, 0, 400, 8], ...SHELL.slice(1)], BOX);
  const top = horiz(plan, 0);
  is(top.length, 1, 'a 600px hole in the outside wall is filled in');
  is([top[0].x1, top[0].x2], [0, 1000], 'across the whole edge');
}
{
  const plan = wallPlan([[0, 0, 400, 8], [450, 0, 550, 8], ...SHELL.slice(1)], BOX);
  is(horiz(plan, 0).length, 2, 'a 50px opening in the outside wall is left open');
}

// --- the floorplate's diagonals are drawn ----------------------------------
{
  const notched = [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [200, 800]];
  const plan = wallPlan(SHELL, notched);
  const slopes = plan.filter((s) => s.x1 !== s.x2 && s.y1 !== s.y2);
  is(slopes.length, 2, 'both diagonal edges are drawn');
  is([...new Set(slopes.map((s) => s.kind))], ['ext'], 'and they are exterior');
}

// --- the real building -----------------------------------------------------
{
  const UP = [[312, 25], [1852, 25], [1852, 739], [312, 739]];
  const DOWN = [
    [312, 763], [1607, 763], [1607, 1477], [314, 1477],
    [484, 1306], [378, 1306], [312, 1240],
  ];

  for (const [name, rects, poly] of [
    ['upstairs', WALLS_UPSTAIRS, UP],
    ['downstairs', WALLS_DOWNSTAIRS, DOWN],
  ]) {
    const plan = wallPlan(rects, poly);

    ok(plan.length > 40, `${name}: the cleanup leaves a building, not a sketch`);
    ok(plan.length < rects.length * 0.6, `${name}: and it is a real simplification`);
    is(
      [...new Set(plan.map((s) => s.kind))].sort(),
      ['ext', 'int'],
      `${name}: exactly two weights`,
    );

    // Every wall sits on a line some other wall is on, or is exterior. This is
    // the property that stops the plan looking hand-drawn.
    const xs = new Set(plan.filter((s) => s.x1 === s.x2).map((s) => s.x1));
    const ys = new Set(plan.filter((s) => s.y1 === s.y2).map((s) => s.y1));
    ok(xs.size <= 24 && ys.size <= 24, `${name}: walls share a small set of lines`);

    // The outside of the building is closed but for its doors.
    const len = (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    let perimeter = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    const drawn = plan.filter((s) => s.kind === 'ext').reduce((n, s) => n + len(s), 0);
    ok(drawn / perimeter > 0.95, `${name}: the shell is closed but for its doors`);
  }
}

console.log(`\n  ${checks} passed, 0 failed\n`);
