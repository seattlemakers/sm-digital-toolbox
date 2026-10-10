/**
 * What the build cannot check about the space data.
 *
 * data/space/index.ts already throws at module load for everything it can see
 * from inside the module graph - an id the drawing lacks, a slug that does not
 * resolve, a malformed colour - and the build runs that. So this file does not
 * repeat it. It checks the three couplings that live OUTSIDE the graph, every
 * one of which has broken silently at least once:
 *
 *   1. assets on disk     A badge or icon path is a string. Nothing notices it
 *                         pointing at a file that is not there until a page
 *                         renders a broken image.
 *   2. the badge cutter   crop-studio-badges.mjs zips its SLUGS array against
 *                         the rings it finds on the brand sheet, positionally.
 *                         It throws on a count mismatch AT RUN TIME, which is
 *                         months after somebody reorders the array.
 *   3. photo folders      public/studios/<slug>/ is keyed to the CALENDAR's
 *                         slugs, because lib/photos.ts calls photosFor(slug)
 *                         against that list. A rename there drops slides from
 *                         the reel and nothing says so.
 *
 * It reads the JSON rows with fs rather than importing data/space/index.ts,
 * which plain Node cannot resolve: that module imports '../floorplan' without
 * an extension, which Vite accepts and Node does not. floorplan.ts itself
 * imports nothing, so it comes in with an explicit extension - the same way
 * scripts/export-floorplan.mjs has always done it.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { FLOORPLAN, FLOORS } from '../src/data/floorplan.ts';
import { STUDIOS as CALENDAR_STUDIOS } from '../src/data/calendar-studios.ts';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const { studios } = read('src/data/space/studios.json');
const { spaces: mappings, updated } = read('src/data/space/mappings.json');

let pass = 0;
const fails = [];
const ok = (cond, what) => (cond ? pass++ : fails.push(what));

// --- 1. every asset path resolves -----------------------------------------
for (const s of studios) {
  ok(existsSync(`public${s.badge}`), `${s.slug}: badge ${s.badge} is not on disk`);
  if (s.icon) ok(existsSync(`public${s.icon}`), `${s.slug}: icon ${s.icon} is not on disk`);
}

// leather-studio is the one studio with no vector mark - the brand sheet has
// no leatherworking icon. If that count changes, something gained or lost an
// icon and the others are worth a look.
ok(
  studios.filter((s) => !s.icon).length === 1,
  `expected 1 studio with no icon, found ${studios.filter((s) => !s.icon).length}`,
);

for (const s of studios) ok(s.badge, `${s.slug}: a studio must have a badge`);

// Four marks on the sheet belong to no studio since 2026-10-10 - software,
// av-studio, arts-crafts and the drawn unknown.svg. The FILES must stay:
// crop-studio-badges.mjs zips SLUGS positionally against fourteen rings and
// throws on a count mismatch, so deleting one breaks the generator for the ten
// that are real. Checked below with the rest of SLUGS.
ok(existsSync('public/brand/studios/unknown.svg'), 'unknown.svg should survive the resource change');
ok(
  studios.find((s) => s.slug === 'printmaking')?.icon === '/brand/icons/screen-printing.svg',
  'printmaking’s icon should still point at the brand sheet’s own filename',
);

// --- 2. the badge cutter's positional array --------------------------------
const cutter = readFileSync('scripts/crop-studio-badges.mjs', 'utf8');
const SLUGS = cutter
  .slice(cutter.indexOf('const SLUGS = ['), cutter.indexOf('];', cutter.indexOf('const SLUGS = [')))
  .match(/'([^']+)'/g)
  .map((q) => q.slice(1, -1));

ok(SLUGS.length === 14, `crop-studio-badges.mjs SLUGS is ${SLUGS.length}, and the sheet has 14 rings`);
for (const slug of SLUGS) {
  ok(existsSync(`public/brand/studios/${slug}.png`), `SLUGS has "${slug}" with no badge PNG beside it`);
}

// --- 3. photo folders follow the calendar's slugs --------------------------
const calendarSlugs = new Set(CALENDAR_STUDIOS.map((s) => s.slug));
for (const dir of readdirSync('public/studios').filter((d) => statSync(`public/studios/${d}`).isDirectory())) {
  ok(calendarSlugs.has(dir), `public/studios/${dir}/ matches no calendar slug, so its photos are dead weight`);
}

// --- 4. the rows themselves ------------------------------------------------
const slugs = new Set(studios.map((s) => s.slug));
ok(slugs.size === studios.length, 'studios.json has a duplicate slug');
for (const s of studios) {
  ok(/^#[0-9a-f]{6}$/.test(s.colour), `${s.slug}: colour "${s.colour}" is not a #rrggbb triple`);
  ok(Boolean(s.name), `${s.slug}: no name`);
}
ok(/^\d{4}-\d{2}-\d{2}$/.test(updated), `mappings.json "updated" should be a plain date, got "${updated}"`);

const byId = new Map();
for (const floor of FLOORS) {
  for (const r of FLOORPLAN[floor].rooms) byId.set(r.id, { ...r, floor, shape: 'room' });
  for (const z of FLOORPLAN[floor].zones) byId.set(z.id, { ...z, floor, shape: 'zone' });
}

for (const [id, m] of Object.entries(mappings)) {
  ok(byId.has(id), `mappings.json: "${id}" is not in the drawing`);
  for (const slug of m.studios ?? []) ok(slugs.has(slug), `mappings.json: "${id}" names unknown studio "${slug}"`);
}

// A zone always sits on its parent's floor. Worth pinning because the
// published file omits a zone's floor on the strength of it.
for (const s of byId.values()) {
  if (s.shape !== 'zone') continue;
  ok(byId.has(s.room), `zone ${s.id} has parent "${s.room}", which is not in the drawing`);
  ok(byId.get(s.room)?.floor === s.floor, `zone ${s.id} is not on its parent's floor`);
}

// --- 5. the cases that have actually caught us -----------------------------
const studiosOf = (id) => mappings[id]?.studios ?? [];
const within = (roomId) =>
  [...byId.values()].filter((s) => s.room === roomId).flatMap((z) => studiosOf(z.id));

ok(studiosOf('U15').length === 0 && within('U15').length === 2, 'the Fab Lab should be a studio only through its zones');
ok(mappings['U19']?.circulation === true, 'Member Check-In should be circulation');
ok(!studiosOf('U19').length, 'Member Check-In should carry no studio');
ok(byId.get('U19')?.name === 'Member Check-In', 'U19 should be the Member Check-In');
ok(byId.get('D14')?.name === 'Ceramics Storage', '"Ceramics Storage" should still be a room of its own');
ok(byId.get('D1.3')?.shape === 'zone', 'Storage should still be a zone of the Lower Commons');
// --- resources, added 2026-10-10 ------------------------------------------
//
// Five spaces that were studios and are not any more. The flag is what makes
// single-studio membership mean anything, so each one is pinned by id - and
// each must name NO studio, which is the half a careless edit would undo.
for (const [id, what] of [
  ['U8', 'the Sanding Room'],
  ['U9', 'the Fume Room'],
  ['U16', 'the Computer Lab'],
  ['D3', 'the A/V Room'],
  ['D1.5', 'the Mini Makerspace'],
]) {
  ok(mappings[id]?.resource === true, `${what} should be flagged a resource`);
  ok(!studiosOf(id).length, `${what} should name no studio`);
}
ok(
  Object.values(mappings).filter((m) => m.resource).length === 5,
  'there should be exactly 5 resources',
);

// The woodshop kept its own rooms when the Sanding Room left it.
ok(studiosOf('U5')[0] === 'woodshop' && studiosOf('U6')[0] === 'woodshop', 'the woodshop should still hold both woodshops');

// The studios those spaces used to carry are gone from the list entirely.
for (const slug of ['software', 'av-studio', 'arts-crafts', 'unknown', 'sanding']) {
  ok(!slugs.has(slug), `"${slug}" should no longer be a studio`);
}

// A space is one or the other. data/space throws on this too; here it is
// checked against the rows themselves, which is what an editor would write.
for (const [id, m] of Object.entries(mappings)) {
  ok(!(m.studios?.length && m.resource), `${id} is a resource and names a studio`);
}
// CNC collapsed into the woodshop on 2026-10-10. Both of its zones are still
// zones - a machine still lives in each - they just belong to woodshop now.
ok(studiosOf('U1.2')[0] === 'woodshop', 'Big CNC should belong to the woodshop');
ok(studiosOf('U5.1')[0] === 'woodshop', 'the Woodshop 2 CNC zone should belong to the woodshop');
ok(!studios.some((s) => s.slug.startsWith('cnc')), 'cnc should no longer be a studio of its own');
ok(mappings['U5']?.tagline === 'Machine Room', 'Woodshop 2 should still carry its tagline');
ok(mappings['U6']?.tagline === 'Bench Room', 'Woodshop 1 should carry its tagline');
ok(mappings['D15']?.tagline === 'Hand Building & Glazing', 'Ceramics 1 should carry its tagline');
// The first taglines on ZONES rather than rooms. Worth pinning because the
// plan wraps a tagline against the space's own width, and a zone is small.
ok(mappings['U1.1']?.tagline === 'Machine Shop', 'Metal Shop 1 should carry its tagline');
ok(mappings['U3.2']?.tagline === 'Welding & Fabrication', 'Metal Shop 2 should carry its tagline');
ok(byId.get('D2')?.name === 'Utility Room', 'D2 should be the Utility Room');

for (const f of fails) console.error(`  ✗ ${f}`);
console.log(`  ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
