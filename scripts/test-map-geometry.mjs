/**
 * lib/map-geometry.ts: the shared frame and the merged zone edges.
 *
 * Both are pure, so they are tested away from the building first and then
 * pinned against it - the frame's numbers are what the viewer depends on for
 * the two floors to line up when switching.
 */
import { alignOf, sharedFrame, zoneEdges } from '../src/lib/map-geometry.ts';
import { BUILDING } from '../src/data/floorplan.ts';

let pass = 0;
const fails = [];
const ok = (cond, what) => (cond ? pass++ : fails.push(what));
const segs = (d) => (d.match(/M/g) ?? []).length;

// --- edges: two rectangles sharing a wall draw it once ----------------------
const A = [[0, 0], [10, 0], [10, 10], [0, 10]];
const B = [[10, 0], [20, 0], [20, 10], [10, 10]];
ok(segs(zoneEdges([A])) === 4, 'a rectangle alone is four segments');
// Left, shared, right, and the top and bottom each merged into one run: five.
ok(segs(zoneEdges([A, B])) === 5, `two rectangles sharing an edge are five segments, got ${segs(zoneEdges([A, B]))}`);

// A shared line with edges of different lengths merges to their union.
const C = [[10, 0], [20, 0], [20, 25], [10, 25]];
const d = zoneEdges([A, C]);
ok(segs(d) === 6, `a longer neighbour still shares the one line, got ${segs(d)}`);
ok(d.includes('M10 0 L10 25'), `the shared line should run the union 0..25, got ${d}`);

// Edges drawn in opposite directions land on the same key.
const Brev = [...B].reverse();
ok(segs(zoneEdges([A, Brev])) === 5, 'winding direction must not split a shared edge');

// Two collinear edges that do not touch stay apart (tolerance 0.5).
const D = [[11, 0], [20, 0], [20, 10], [11, 10]];
ok(zoneEdges([A, D]).includes('M10 0 L10 10') && zoneEdges([A, D]).includes('M11 0 L11 10'), 'a 1-unit gap is two segments');

// --- the building ------------------------------------------------------------
const ALIGN = alignOf(BUILDING, 'upstairs');
ok(ALIGN.upstairs === 0, 'upstairs aligns to itself');
ok(ALIGN.downstairs === -349.4, `downstairs should align by -349.4, got ${ALIGN.downstairs}`);

const frame = sharedFrame(BUILDING, ALIGN).split(' ').map(Number);
ok(frame[1] === 29.6 - 3, `the frame's top should be 3 above the north wall, got ${frame[1]}`);
ok(frame[0] === 181 - 12 && frame[0] + frame[2] === 854.7 + 12, 'the frame spans the widest floor plus 12 each side');

// On the real floors, drawing edges once saves segments against one-per-edge.
for (const f of ['upstairs', 'downstairs']) {
  const named = BUILDING[f].zones.filter((z) => z.name !== null).map((z) => z.points);
  const naive = named.reduce((n, p) => n + p.length, 0);
  const merged = segs(zoneEdges(named));
  ok(merged < naive, `${f}: merged edges (${merged}) should be fewer than per-zone edges (${naive})`);
}

for (const f of fails) console.error(`  ✗ ${f}`);
console.log(`  ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
