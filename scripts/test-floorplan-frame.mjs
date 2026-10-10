/**
 * The derivation that used to be frozen in a generated file.
 *
 * `outline` and `viewBox` were written into floorplan.ts by the extractor until
 * 2026-10-10 and are computed at module load now. That is the right place for
 * them - they come from the walls, so they cannot drift from the walls - but it
 * does mean two values the page depends on are produced by code on every build
 * rather than reviewed once in a diff. Hence this.
 *
 * The numbers below are the ones the extractor wrote, taken from the last
 * generated copy of floorplan.ts. So this file doubles as the record of what
 * the flip had to preserve: if the frame ever moves, it moves against these.
 */
import { outline, points, extents, frames, GUTTER, MARGIN } from '../src/lib/floorplan-frame.ts';
import { FLOORPLAN, FLOORS, BUILDING } from '../src/data/floorplan.ts';

let pass = 0;
const fails = [];
const ok = (cond, what) => (cond ? pass++ : fails.push(what));
const eq = (got, want, what) =>
  ok(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// --- the two frames, exactly as the generator wrote them --------------------
eq(FLOORPLAN.upstairs.viewBox, '135 15.7 731.7 338.2', 'upstairs viewBox');
eq(FLOORPLAN.downstairs.viewBox, '135 417 731.7 338.2', 'downstairs viewBox');

// Both floors share a width and a height, which is what puts them at one scale.
const [, , uw, uh] = FLOORPLAN.upstairs.viewBox.split(' ');
const [, , dw, dh] = FLOORPLAN.downstairs.viewBox.split(' ');
ok(uw === dw && uh === dh, 'the two floors must share a width and a height');

// --- the floorplate ---------------------------------------------------------
eq(FLOORPLAN.upstairs.outline.length, 8, 'upstairs outline points');
eq(FLOORPLAN.downstairs.outline.length, 9, 'downstairs outline points');

// A doorway is a pen-up, so the closed plate must NOT reproduce it: the two
// points either side of the upstairs south door are adjacent in the outline.
const up = FLOORPLAN.upstairs.outline.map((p) => p.join(','));
ok(
  Math.abs(up.indexOf('333.5,340') - up.indexOf('285,340')) === 1,
  'the upstairs south doorway should be closed up in the floorplate',
);

// --- the parser is strict, and that is the point ----------------------------
ok(points('M0 0 H10 V10 Z').length === 4, 'M/H/V/Z should parse');
ok(points('M0 0 10 10').length === 2, 'a second pair after M is an implicit lineto');
let threw = false;
try { points('M0 0 C1 1 2 2 3 3'); } catch { threw = true; }
ok(threw, 'a curve must throw rather than be mis-traced into a straight line');

// A closed outline repeats its first point; it must not come back twice.
eq(outline('M0 0 H10 V10 H0 Z'), [[0, 0], [10, 0], [10, 10], [0, 10]], 'closing point dropped');

// --- framing arithmetic, away from the building -----------------------------
const box = (x0, x1, y0, y1) => ({ x0, x1, y0, y1 });
const two = frames([box(100, 200, 0, 50), box(120, 180, 500, 600)]);
ok(two[0].split(' ')[0] === String(100 - GUTTER), 'the gutter comes off the leftmost edge of EITHER floor');
ok(two[0].split(' ')[2] === String(200 + MARGIN - (100 - GUTTER)), 'the width spans the widest floor');
ok(two[0].split(' ')[3] === String(100 + MARGIN * 2), 'the height is the tallest floor plus both margins');
// A shorter floor is centred in the shared height rather than stretched.
eq(two[0].split(' ')[1], String(0 - (100 + MARGIN * 2 - 50) / 2), 'the shorter floor is centred');

// --- extents include the floor's own shift ----------------------------------
eq(extents(['M0 0 H10 V10'], 50), { x0: 0, x1: 10, y0: 50, y1: 60 }, 'extents carry offsetY');

// --- authored and derived stay distinct -------------------------------------
for (const f of FLOORS) {
  ok(!('outline' in BUILDING[f]), `${f}: outline must not be written down beside the walls it comes from`);
  ok(!('viewBox' in BUILDING[f]), `${f}: viewBox must not be written down`);
}

for (const f of fails) console.error(`  ✗ ${f}`);
console.log(`  ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
