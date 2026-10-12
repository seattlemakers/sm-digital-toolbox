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
const access = read('src/data/space/access.json');

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
ok(/^\d{4}-\d{2}-\d{2}$/.test(access.updated), `access.json "updated" should be a plain date, got "${access.updated}"`);

const byId = new Map();
for (const floor of FLOORS) {
  for (const r of FLOORPLAN[floor].rooms) byId.set(r.id, { ...r, floor, shape: 'room' });
  for (const z of FLOORPLAN[floor].zones) byId.set(z.id, { ...z, floor, shape: 'zone' });
}
const rooms = [...byId.values()].filter((s) => s.shape === 'room');
const zones = [...byId.values()].filter((s) => s.shape === 'zone');

for (const [id, m] of Object.entries(mappings)) {
  ok(byId.has(id), `mappings.json: "${id}" is not in the drawing`);
  ok(byId.get(id)?.shape === 'zone', `mappings.json: "${id}" is a room; rows belong to zones`);
  for (const slug of m.studios ?? []) ok(slugs.has(slug), `mappings.json: "${id}" names unknown studio "${slug}"`);
}

// A zone always sits on its parent's floor. Worth pinning because the
// published file omits a zone's floor on the strength of it.
for (const z of zones) {
  ok(byId.has(z.room), `zone ${z.id} has parent "${z.room}", which is not in the drawing`);
  ok(byId.get(z.room)?.floor === z.floor, `zone ${z.id} is not on its parent's floor`);
}

// --- 5. everything named is a zone, as of 2026-10-11 -----------------------
//
// Rooms are unnamed containers; every name in the building is on a zone. The
// counts are the handoff's: 43 rooms, 53 zones, ten of them unnamed.
ok(rooms.length === 43, `expected 43 rooms, found ${rooms.length}`);
ok(zones.length === 53, `expected 53 zones, found ${zones.length}`);
for (const r of rooms) ok(!('name' in r) && !('lines' in r) && !('at' in r), `room ${r.id} still carries label fields`);
for (const r of rooms) ok(zones.some((z) => z.room === r.id), `room ${r.id} holds no zone, so nothing can name it`);

const UNNAMED = ['U4.2', 'U13.1', 'U18.1', 'U20.1', 'U21.1', 'U22.1', 'U23.1', 'D18.1', 'D22.1', 'D23.1'];
for (const id of UNNAMED) ok(byId.get(id)?.name === null, `${id} should be an unnamed zone`);
ok(zones.filter((z) => z.name === null).length === UNNAMED.length, `exactly ${UNNAMED.length} zones should be unnamed`);
for (const z of zones) ok((z.name === null) === (z.lines.length === 0), `${z.id}: name and lines must come together`);

// The renames, by id - a name is the thing most often edited here.
for (const [id, name] of [
  ['U1.2', 'Big Wood CNC'], ['U5.1', 'Wood CNC'], ['U5.2', 'Woodshop 2'], ['U6.1', 'Woodshop 1'],
  ['U10.1', 'Electronics'], ['U10.2', 'Printmaking'], ['U15.1', '3D Printing'], ['U15.2', 'Laser Cutting'],
  ['U3.1', 'Jewelry'], ['U3.2', 'Metal Shop 2'], ['U11.1', 'Restroom'], ['U12.1', 'Restroom'],
  ['U19.1', 'Member Check-In'], ['U4.1', 'Staff Desk'], ['D1.2', 'Leather'], ['D1.3', 'Storage'],
  ['D2.1', 'Utility Room'], ['D3.1', 'A/V'], ['D10.1', 'Sewing'], ['D14.1', 'Ceramics Storage'],
]) ok(byId.get(id)?.name === name, `${id} should be "${name}", is "${byId.get(id)?.name}"`);

// U5.2 is the room minus the Wood CNC corner, not the whole room: eight
// points, the notch at (440.1, 75.5), and U5.1's own centre outside it.
const inPoly = (P, [x, y]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
ok(byId.get('U5.2')?.points.length === 8, 'U5.2 should be the room minus a corner (8 points)');
ok(byId.get('U5.2')?.points.some(([x, y]) => x === 440.1 && y === 75.5), 'U5.2 should turn the Wood CNC corner');
ok(!inPoly(byId.get('U5.2').points, [417, 52]), 'the Wood CNC corner must not be inside U5.2');
ok(inPoly(byId.get('U5.1').points, [417, 52]), 'the Wood CNC corner should be inside U5.1');
ok(inPoly(byId.get('U4.1').points, [370, 276]) && !inPoly(byId.get('U4.2').points, [370, 276]), 'the Staff Desk is cut out of the U4 hallway');

// --- the stairs were standardised on 2026-10-11 (handoff v2 §5) ----------------
//
// A deliberate deviation from the original plan of up to 3.5 units: the
// upstairs west stair and its hallway are 26.8 wide, the downstairs main
// flight 25.2, and the check-in door stays 18.4 wide, centred in the hall.
const xs = (id) => byId.get(id).points.map((p) => p[0]);
const ys = (id) => byId.get(id).points.map((p) => p[1]);
ok(Math.abs(Math.max(...xs('U18.1')) - Math.min(...xs('U18.1')) - 26.8) < 0.01, 'the upstairs west stair should be 26.8 wide');
ok(Math.min(...xs('U19.1')) === 316.8 && Math.min(...xs('U4.1')) === 343.6, 'the check-in hall should run 316.8 to 343.6');
ok(FLOORPLAN.upstairs.d.interior.includes('M316.8 301 H321 M339.4 301 H394.2'), 'the check-in door should be 18.4 wide and centred at 330.2');
ok(Math.abs((321 + 339.4) / 2 - (316.8 + 343.6) / 2) < 0.01, 'the door centre should equal the hall centre');
ok(Math.min(...xs('D23.1')) === 791.6 && byId.get('D23.1').points.some(([x, y]) => x === 829.2 && y === 561), 'the main stair flight should start at 829.2 with the landing top at 561');
ok(Math.max(...ys('D8.1')) === 561, 'the closet under the stair should end at 561');


// The one rotated label.
ok(byId.get('U3.1')?.rotate === -90, 'Jewelry should run up the wall at -90');
ok(zones.filter((z) => z.rotate).length === 1, 'exactly one label should be rotated');

// --- 6. the cases that have actually caught us -----------------------------
const studiosOf = (id) => mappings[id]?.studios ?? [];
const within = (roomId) => zones.filter((s) => s.room === roomId).flatMap((z) => studiosOf(z.id));

ok(studiosOf('U15').length === 0 && within('U15').length === 2, 'U15 should be a studio only through its zones');
ok(!mappings['U19.1'], 'Member Check-In should carry no row at all - not circulation, not a studio');
ok(byId.get('D1.3')?.room === 'D1', 'Storage should still be a zone of D1');
// --- resources, moved to zone ids 2026-10-11 ---------------------------------
//
// Five spaces that were studios and are not any more. The flag is what makes
// single-studio membership mean anything, so each one is pinned by id - and
// each must name NO studio, which is the half a careless edit would undo.
for (const [id, what] of [
  ['U8.1', 'the Sanding Room'],
  ['U9.1', 'the Fume Room'],
  ['U16.1', 'the Computer Lab'],
  ['D3.1', 'A/V'],
  ['D1.5', 'the Mini Makerspace'],
]) {
  ok(mappings[id]?.resource === true, `${what} should be flagged a resource`);
  ok(!studiosOf(id).length, `${what} should name no studio`);
}
ok(
  Object.values(mappings).filter((m) => m.resource).length === 5,
  'there should be exactly 5 resources',
);

// The woodshop is two rooms and three zones.
ok(studiosOf('U5.2')[0] === 'woodshop' && studiosOf('U6.1')[0] === 'woodshop', 'the woodshop should still hold both woodshops');
ok(studiosOf('U1.2')[0] === 'woodshop', 'Big Wood CNC should belong to the woodshop');
ok(studiosOf('U5.1')[0] === 'woodshop', 'Wood CNC should belong to the woodshop');

// The studios those spaces used to carry are gone from the list entirely.
for (const slug of ['software', 'av-studio', 'arts-crafts', 'unknown', 'sanding']) {
  ok(!slugs.has(slug), `"${slug}" should no longer be a studio`);
}
ok(!studios.some((s) => s.slug.startsWith('cnc')), 'cnc should no longer be a studio of its own');

// A space is one or the other. data/space throws on this too; here it is
// checked against the rows themselves, which is what an editor would write.
for (const [id, m] of Object.entries(mappings)) {
  ok(!(m.studios?.length && m.resource), `${id} is a resource and names a studio`);
}

// Taglines, on the zones that carry them.
ok(mappings['U5.2']?.tagline === 'Machine Room', 'Woodshop 2 should carry its tagline');
ok(mappings['U6.1']?.tagline === 'Bench Room', 'Woodshop 1 should carry its tagline');
ok(mappings['D15.1']?.tagline === 'Hand Building & Glazing', 'Ceramics 1 should carry its tagline');
ok(mappings['D16.1']?.tagline === 'Throwing Wheels', 'Ceramics 2 should carry its tagline');
ok(mappings['U1.1']?.tagline === 'Machine Shop', 'Metal Shop 1 should carry its tagline');
ok(mappings['U3.2']?.tagline === 'Welding & Fabrication', 'Metal Shop 2 should carry its tagline');

// --- 7. access ---------------------------------------------------------------
//
// Who may use a space. A zone takes its room's answer unless it states its own.
for (const id of [...access.public, ...access.staff]) ok(byId.has(id), `access.json: "${id}" is not in the drawing`);
for (const id of access.public) ok(!access.staff.includes(id), `access.json: "${id}" is both public and staff`);
ok(access.public.length === 3 && ['D4', 'D6', 'D7'].every((id) => access.public.includes(id)), 'the kitchen, lounge and lobby are public');
ok(access.staff.length === 9, `9 spaces are staff only, found ${access.staff.length}`);
ok(access.staff.includes('U4.1') && !access.staff.includes('U4') && !access.public.includes('U4'), 'the Staff Desk is a staff zone in a members room');
ok(access.staff.includes('D1.3') && !access.staff.includes('D1'), 'Storage is a staff corner of a members room');

// --- 8. the ways in ------------------------------------------------------------
//
// Re-placed by the 2026-10-11 handoff. The handoff's own data file still
// carried the OLD rows; these are the README's, which the prototype rendered.
const ent = Object.fromEntries(FLOORS.flatMap((f) => FLOORPLAN[f].entrances.map((e) => [e.id, e])));
ok(JSON.stringify(ent.member?.arrow) === '[[347.2,358],[347.2,335]]', 'the member arrow runs north through the south door');
ok(JSON.stringify(ent.member?.at) === '[355,357.4]' && ent.member?.anchor === 'start', 'the member label hangs off the arrow tail');
ok(JSON.stringify(ent.main?.arrow) === '[[831.2,443.8],[817,458]]', 'the main arrow crosses the lower porch face');
ok(JSON.stringify(ent.main?.at) === '[841,432.6]' && !ent.main?.anchor, 'the main label is centred in the porch');
// The shaft is perpendicular to the lower face (x - y = 366) and crosses it at
// the doorway's midpoint, which is the one thing about it that must not move.
{
  const [[tx, ty], [hx, hy]] = ent.main.arrow;
  ok(Math.abs(tx + ty - 1275) < 0.01 && Math.abs(hx + hy - 1275) < 0.01, 'the main arrow should lie on x+y=1275, through (820.5, 454.5)');
  ok(tx - ty > 366 && hx - hy < 366, 'the main arrow tail should be outside the lower face and the head inside');
}

for (const f of fails) console.error(`  ✗ ${f}`);
console.log(`  ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
