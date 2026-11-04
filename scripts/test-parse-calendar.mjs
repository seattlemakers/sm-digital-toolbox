/**
 * The calendar parser, and mostly one question: which day is an event on.
 *
 * The entries below are copied off seattlemakers.org/events on 2026-11-04,
 * out of the `<script id="site-data">` JSON the new site renders its calendar
 * from - so this file doubles as the record of the payload the parser is
 * written against. Only the surrounding grid is trimmed: the real page is
 * three month grids of thirty-odd day cells each.
 *
 * The case that matters is still the series. One post, `starts`/`ends` stating
 * the whole span, and one entry per session sitting in the cell of the day
 * that session runs. Reading the date off the span instead of the cell would
 * collapse all three CNC sessions onto 4 November.
 */
import assert from 'node:assert/strict';
import { parse, siteData } from '../src/lib/parse-calendar.mjs';

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
};

/** A series: three sessions, Wednesday / Monday / Wednesday. Not weekly. */
const CNC = {
  id: 4874, title: 'CNC Certification Series (3 part series)',
  href: '/events/cnc-certification-series-3-part-series-21/',
  time: '6:00 pm', end_time: '8:00 pm',
  starts: 'November 4, 2026 6:00 pm', ends: 'November 11, 2026 8:00 pm',
  avail: 0, sold_out: true, classes: ['certification', 'cnc', 'cnc-routing'],
  timing: 'wpost', minute: 0, duration: 120, hour: 18,
};

/** A one-off with seats left, an en dash in its title and the old noise class. */
const GAME = {
  id: 4869, title: 'Free – Game Night!', href: '/events/free-game-night-17/',
  time: '6:00 pm', end_time: '11:55 pm',
  starts: 'November 14, 2026 6:00 pm', ends: 'November 14, 2026 11:55 pm',
  avail: 15, sold_out: false, classes: ['meetup'], timing: 'wposted',
  minute: 0, duration: 355, hour: 18,
};

/** Whole-building closure: no seats, no tags. Its span is four days. */
const CLOSED = {
  id: 4923, title: 'CLOSED', href: '/events/closed-189/',
  time: '2:00 pm', end_time: '10:00 pm',
  starts: 'November 26, 2026 2:00 pm', ends: 'November 29, 2026 10:00 pm',
  avail: null, sold_out: false, classes: [], timing: 'wpost',
  minute: 0, duration: 4800, hour: 14,
};

const day = (n, ...entries) => ({ day: n, dow: '', today: false, in_range: true, entries });
const month = (title, year, m, ...days) => ({ title, year, month: m, lead: 0, days });
const page = (...months) =>
  `<!doctype html><html><head><title>Events Archive · Seattle Makers</title></head><body>` +
  `<main id="site-content"></main>` +
  `<script id="site-data" type="application/json">${JSON.stringify({
    page: 'events',
    data: { range: { type: 'upcoming' }, months, type: 'calendar' },
  })}</script>` +
  `<script type="module" src="/ui-assets/admin-ui/assets/site.js"></script></body></html>`;

const PAGE = page(
  month('November 2026', 2026, 11,
    day(4, CNC), day(9, CNC), day(11, CNC), day(14, GAME), day(26, CLOSED), day(27, CLOSED)),
);

const events = parse(PAGE);

ok('the payload is found', () => {
  assert.equal(siteData(PAGE).page, 'events');
});

ok('every entry becomes an event', () => {
  assert.equal(events.length, 6);
});

ok('the series is three events, one per session', () => {
  const cnc = events.filter((e) => e.id === 4874);
  assert.deepEqual(
    cnc.map((e) => e.start),
    ['2026-11-04T18:00', '2026-11-09T18:00', '2026-11-11T18:00'],
  );
});

ok('the session count matches the part count the title states', () => {
  const cnc = events.filter((e) => e.id === 4874);
  const parts = /\((\d+)\s*part/i.exec(cnc[0].title);
  assert.equal(Number(parts[1]), cnc.length);
});

ok('the middle session is a Monday, which weekly arithmetic would have missed', () => {
  const starts = events.filter((e) => e.id === 4874).map((e) => e.start.slice(0, 10));
  assert.ok(starts.includes('2026-11-09'));
  assert.equal(new Date('2026-11-09T00:00:00').getDay(), 1);
});

ok("each session carries the session's own clock times, not the span's", () => {
  for (const e of events.filter((x) => x.id === 4874)) {
    assert.equal(e.end, `${e.start.slice(0, 10)}T20:00`);
  }
});

ok('a multi-day closure is one row per day, each with that day\'s hours', () => {
  const closed = events.filter((e) => e.id === 4923);
  assert.deepEqual(closed.map((e) => [e.start, e.end]), [
    ['2026-11-26T14:00', '2026-11-26T22:00'],
    ['2026-11-27T14:00', '2026-11-27T22:00'],
  ]);
  assert.equal(closed[0].available, null);
  assert.deepEqual(closed[0].kinds, []);
});

ok('a one-off keeps the shape the board reads', () => {
  const g = events.find((e) => e.id === 4869);
  assert.equal(g.title, 'Free - Game Night!');
  assert.equal(g.url, 'https://seattlemakers.org/events/free-game-night-17/');
  assert.equal(g.start, '2026-11-14T18:00');
  assert.equal(g.end, '2026-11-14T23:55');
  assert.equal(g.available, 15);
  assert.equal(g.soldOut, false);
  assert.equal(g.endTs, null);
});

ok('sold out comes from the flag and from zero seats', () => {
  assert.equal(events.find((e) => e.id === 4874).soldOut, true);
  const zero = parse(page(month('November 2026', 2026, 11, day(4, { ...GAME, avail: 0, sold_out: false }))));
  assert.equal(zero[0].soldOut, true);
});

ok('kinds and categories still split, and noise classes are dropped', () => {
  const cnc = events.find((e) => e.id === 4874);
  assert.deepEqual(cnc.kinds, ['certification']);
  assert.deepEqual(cnc.categories, ['cnc', 'cnc-routing']);
  const noisy = parse(page(month('November 2026', 2026, 11, day(4, { ...GAME, classes: ['meetup', 'wposted'] }))));
  assert.deepEqual(noisy[0].categories, []);
});

ok('a repeat inside one cell is still one event', () => {
  // The live page lists the Ceramics Wheel series twice on 9 November.
  const doubled = parse(page(month('November 2026', 2026, 11, day(9, CNC, CNC))));
  assert.equal(doubled.length, 1);
});

ok('each month grid carries its own year', () => {
  const across = parse(page(
    month('December 2026', 2026, 12, day(31, CLOSED)),
    month('January 2027', 2027, 1, day(1, CLOSED)),
  ));
  assert.deepEqual(across.map((e) => e.start.slice(0, 10)), ['2026-12-31', '2027-01-01']);
});

ok('cells outside the month are skipped', () => {
  const pad = parse(page(month('November 2026', 2026, 11, { ...day(30, GAME), in_range: false })));
  assert.equal(pad.length, 0);
});

ok('the old WordPress markup, or no payload at all, parses to nothing', () => {
  // Zero is what calendar-api.mjs turns into an honest failure.
  assert.deepEqual(parse('<h3 class="pe-month-header">Showing: September 2026</h3>'), []);
  assert.deepEqual(parse('<script id="site-data" type="application/json">{not json</script>'), []);
});

ok('events come back in date order', () => {
  const starts = events.map((e) => e.start);
  assert.deepEqual(starts, [...starts].sort());
});

console.log(`\n  ${passed} passed, 0 failed\n`);
