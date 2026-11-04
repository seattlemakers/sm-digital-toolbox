/**
 * Tests for lib/event-image.mjs - finding the event's own picture.
 *
 * Every fixture below is a picture a real seattlemakers.org event page states,
 * and every size and byte count was measured against the live site on
 * 2026-11-04, after the move off WordPress. Which files still exist is also
 * measured: the migration kept some originals and dropped the rest, so a 404
 * here is a fact about the site, not a made-up failure.
 *
 * No network: `fetch` is stubbed with that table, which is also how the
 * numbers stay meaningful as a record of what was measured.
 */
import { pageImage, eventImage, imageSize, stripSize } from '../src/lib/event-image.mjs';

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  if (got === want) pass++;
  else { fail++; console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
};

const UP = 'https://seattlemakers.org/wp-content/uploads';

/** One event page, reduced to the part this module reads. */
const page = (image) =>
  `<html><head></head><body><main id="site-content"></main>` +
  `<script id="site-data" type="application/json">${JSON.stringify({
    page: 'event', data: { event: { id: 1, title: 'x', image } },
  })}</script></body></html>`;

/** The first bytes of a JPEG or PNG of a given size - enough for imageSize(). */
const jpeg = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0]);
const png = (w, h) => {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  b.set([w >>> 24, (w >> 16) & 255, (w >> 8) & 255, w & 255, h >>> 24, (h >> 16) & 255, (h >> 8) & 255, h & 255], 16);
  return b;
};

/** path -> [width, height, bytes]. Anything absent is a 404, as on the site. */
const LIVE = {
  '2023/09/silkscreen-printing-300x199.jpg': [300, 199, 17825],
  '2024/04/laser_logo.jpg': [300, 300, 9690],
  '2024/04/woodshop_saw_logo.jpg': [300, 300, 11610],
  '2024/04/tour_icon-300x300.jpg': [300, 300, 4195],
  '2020/10/Website-black-icons-20-300x300.png': [300, 300, 9880],
  '2020/10/Website-black-icons-20.png': [1219, 1220, 26568],
  '2024/07/Member-at-pottery-wheel-300x169.jpg': [300, 169, 12154],
  '2024/07/Member-at-pottery-wheel.jpg': [1220, 686, 137983],
  '2026/08/prusa-xl-2-heads-300x225.jpg': [300, 225, 8106],
};

const headers = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });

/** A fetch answering Range GETs with header bytes and HEADs with a length. */
const site = (table = LIVE, { noLength = false } = {}) => async (url, init = {}) => {
  const hit = table[url.replace(`${UP}/`, '')];
  if (!hit) return { ok: false, status: 404, headers: headers({}) };
  const [w, h, bytes] = hit;
  if (init.method === 'HEAD') {
    return { ok: true, status: 200, headers: headers(noLength ? {} : { 'content-length': String(bytes) }) };
  }
  const body = url.endsWith('.png') ? png(w, h) : jpeg(w, h);
  return {
    ok: true, status: 206,
    headers: headers({ 'content-length': String(body.length), 'content-range': `bytes 0-${body.length - 1}/${noLength ? '*' : bytes}` }),
    arrayBuffer: async () => body.buffer,
  };
};

/* ------------------------------------------------------------ the source --- */

eq(pageImage(page('/wp-content/uploads/2024/04/laser_logo.jpg')), `${UP}/2024/04/laser_logo.jpg`,
   'site-data image, made absolute');
eq(pageImage(page(null)), null, 'an event with no picture - about half of them');
eq(pageImage('<meta property="og:image" content="https://seattlemakers.org/wp-content/uploads/a.jpg">'),
   `${UP}/a.jpg`, 'og:image is still read if it comes back');
eq(pageImage('<html></html>'), null, 'nothing at all');

eq(stripSize(`${UP}/2025/09/cnc-e1733994669351-600x600-2-300x300.jpg`),
   `${UP}/2025/09/cnc-e1733994669351-600x600-2.jpg`, 'only the trailing size is the variant');

eq(JSON.stringify(imageSize(jpeg(1220, 686))), '{"height":686,"width":1220}', 'JPEG header');
eq(JSON.stringify(imageSize(png(1219, 1220))), '{"width":1219,"height":1220}', 'PNG header');

/* ------------------------------------------------------------ the picture --- */

eq(await eventImage(page('/wp-content/uploads/2023/09/silkscreen-printing-300x199.jpg'), site()),
   `${UP}/2023/09/silkscreen-printing-300x199.jpg`,
   'original gone: the 300px thumbnail is kept (0.299)');

eq(await eventImage(page('/wp-content/uploads/2026/08/prusa-xl-2-heads-300x225.jpg'), site()),
   `${UP}/2026/08/prusa-xl-2-heads-300x225.jpg`,
   'the least dense real photo on the calendar (0.120)');

eq(await eventImage(page('/wp-content/uploads/2024/07/Member-at-pottery-wheel-300x169.jpg'), site()),
   `${UP}/2024/07/Member-at-pottery-wheel.jpg`,
   'original survives: served whole instead of the thumbnail');

// Badges are originals at 300px - density cannot catch them at that size
// (0.108, 0.129), width does.
eq(await eventImage(page('/wp-content/uploads/2024/04/laser_logo.jpg'), site()), null, 'laser badge');
eq(await eventImage(page('/wp-content/uploads/2024/04/woodshop_saw_logo.jpg'), site()), null, 'woodshop badge');

// The icon sheet's 300px thumbnail is 0.110 - photo-dense. Its surviving
// original is what gives it away, and a rejected original takes its thumbnail
// with it.
eq(await eventImage(page('/wp-content/uploads/2020/10/Website-black-icons-20-300x300.png'), site()),
   null, 'icon sheet, caught on its original (0.018)');

eq(await eventImage(page('/wp-content/uploads/2024/04/tour_icon-300x300.jpg'), site()),
   null, 'tour icon, original gone, caught on its thumbnail (0.047)');

eq(await eventImage(page('/wp-content/uploads/2024/01/never-migrated.jpg'), site()),
   null, 'an unsized file that 404s');
eq(await eventImage(page('/wp-content/uploads/2024/01/never-migrated-300x200.jpg'), site()),
   null, 'a thumbnail that 404s too');
eq(await eventImage(page('/wp-content/uploads/2024/01/tiny-150x150.jpg'), site({ '2024/01/tiny-150x150.jpg': [150, 150, 9000] })),
   null, 'a thumbnail too small for a plate');

eq(await eventImage(page('https://example.com/photo-300x200.jpg'), site()), null, 'off-site images are never ours');
eq(await eventImage(page('/wp-content/uploads/2018/05/Logo-final-white-03.png'), site()), null, 'site chrome');
eq(await eventImage(page('/wp-content/uploads/2024/01/a.svg'), site()), null, 'not a raster');

// The deliberate leniency: unweighable is kept, gone is not.
eq(await eventImage(page('/wp-content/uploads/2023/09/silkscreen-printing-300x199.jpg'), site(LIVE, { noLength: true })),
   `${UP}/2023/09/silkscreen-printing-300x199.jpg`, 'no size sent: kept');
eq(await eventImage(page('/wp-content/uploads/2023/09/silkscreen-printing-300x199.jpg'),
                    async () => { throw new Error('network'); }),
   `${UP}/2023/09/silkscreen-printing-300x199.jpg`, 'network down: kept');

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
