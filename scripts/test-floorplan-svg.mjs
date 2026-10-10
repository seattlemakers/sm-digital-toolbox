/**
 * The drawing is an EXPORT now, and these are the two things that keeps honest.
 *
 * Until 2026-10-10 src/data/floorplan.svg was the source of truth and
 * floorplan.ts was generated from it. The flip put the data in charge, which
 * leaves the SVG as something we produce - and a produced file checked into a
 * repository goes stale the first time somebody edits the data and does not
 * re-export it. That is the same hazard as before, pointing the other way, so
 * it gets a test instead of a convention.
 *
 *   1. FRESH      Re-exporting the data reproduces the committed SVG byte for
 *                 byte. If this fails, run the export and commit the result.
 *   2. FAITHFUL   Importing that SVG reproduces the authored rows exactly. The
 *                 round trip is what makes the drawing a real second
 *                 representation rather than a picture that happens to look
 *                 right, and it is what makes a redraw safe to import.
 *
 * (2) has already earned its place: it caught the exporter writing fill="none"
 * on zone paths, which came back as the string "none" where the data holds
 * null. Nothing else would have noticed - the page does not read a zone's fill.
 *
 * Both run the real scripts in a temp directory rather than importing their
 * internals, because what matters is what the commands do.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SVG = 'src/data/floorplan.svg';
const TS = 'src/data/floorplan.ts';

let pass = 0;
const fails = [];
const ok = (cond, what) => (cond ? pass++ : fails.push(what));

const run = (script, args) =>
  execFileSync('node', ['--experimental-strip-types', '--no-warnings', script, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const dir = mkdtempSync(join(tmpdir(), 'floorplan-'));
try {
  // --- 1. the committed drawing is what the data exports -------------------
  run('scripts/export-floorplan.mjs', [dir, '--svg']);
  const fresh = readFileSync(join(dir, 'floorplan.svg'), 'utf8');
  const committed = readFileSync(SVG, 'utf8');
  ok(
    fresh === committed,
    `${SVG} is stale - re-export it: node --experimental-strip-types scripts/export-floorplan.mjs src/data --svg`,
  );

  // --- 2. importing it back reproduces the authored rows -------------------
  const rows = run('scripts/read-floorplan.mjs', [join(dir, 'floorplan.svg')]);
  const file = readFileSync(TS, 'utf8');
  const open = 'export const BUILDING: Record<Floor, FloorRows> = {';
  const a = file.indexOf(open);
  const b = file.indexOf('\n};\n\n// --- derived', a);
  ok(a >= 0 && b >= 0, `${TS}: the BUILDING block markers the importer writes between are gone`);
  if (a >= 0 && b >= 0) {
    // The importer prints the block with its own closing brace and newline.
    ok(rows.trim() === `${file.slice(a, b)}\n};`.trim(), 'a full export -> import round trip must reproduce the rows exactly');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

for (const f of fails) console.error(`  ✗ ${f}`);
console.log(`  ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
