/**
 * The calendar parser, and mostly one question: which day is an event on.
 *
 * The anchors and their tooltips below are copied byte for byte off
 * seattlemakers.org/events, so this file doubles as the record of the markup
 * the parser is written against. Only the surrounding grid is trimmed - the
 * real page is five month grids of thirty-odd day cells each.
 *
 * The case that matters is the series. One post, one tooltip stating the whole
 * span, and one anchor per session sitting in the cell of the day that session
 * runs. Reading the date off the tooltip instead of the cell collapsed all
 * three CNC sessions onto 23 September and lost the other two.
 */
import assert from 'node:assert/strict';
import { parse } from '../src/lib/parse-calendar.mjs';

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed++;
};

/** A series: three sessions, Wednesday / Monday / Wednesday. Not weekly. */
const CNC =
  '<a title="<div class=pe-hover-title>CNC Certification Series (3 part series) (2 avail)</div>' +
  '<div class=pe-hover-date>September 23, 2026 6:00 pm</div>' +
  '<div class=pe-hover-date>September 30, 2026 8:00 pm*1790798400*</div>" ' +
  'href="https://seattlemakers.org/events/cnc-certification-series-3-part-series-19/" ' +
  'rel="164625" class="pp-tip certification cnc cnc-routing pp-tip">' +
  '<span class="dashicons dashicons-calendar"></span> CNC Certification Series (3 part series) 6:00 pm (2 avail)</a>';

/** A one-off, whose cell and tooltip agree. 177 of the calendar's rows are these. */
const SINGLE =
  '<a title="<div class=pe-hover-title>Jointer, Planer &#8211; Certification (0 avail)</div>' +
  '<div class=pe-hover-date>September 27, 2026 2:00 pm</div>' +
  '<div class=pe-hover-date>September 27, 2026 5:00 pm*1790528400*</div>" ' +
  'href="https://seattlemakers.org/events/jointer-planer-certification-10/" ' +
  'rel="167809" class="pp-tip certification woodworking pe-inv-out pp-tip">' +
  '<span class="dashicons dashicons-calendar"></span> Jointer, Planer &#8211; Certification 2:00 pm (0 avail)</a>';

const cell = (weekday, day, ...anchors) =>
  `<li class="event-day ${weekday}"><div class="head"><span class="inline-day">${weekday}</span>${day}</div>` +
  `<div class="day"><ul>${anchors.map((a) => `<li class="wposting">${a}</li>`).join('')}</ul></div></li>`;

const month = (label, ...cells) =>
  `<h3 class="pe-month-header">Showing: ${label}</h3><ol class="month">${cells.join('')}</ol>`;

const PAGE = month(
  'September 2026',
  cell('wed', 23, CNC),
  cell('sun', 27, SINGLE),
  cell('mon', 28, CNC),
  cell('wed', 30, CNC),
);

const events = parse(PAGE);

ok('every anchor becomes an event', () => {
  assert.equal(events.length, 4);
});

ok('the series is three events, one per session', () => {
  const cnc = events.filter((e) => e.id === 164625);
  assert.equal(cnc.length, 3);
  assert.deepEqual(
    cnc.map((e) => e.start),
    ['2026-09-23T18:00', '2026-09-28T18:00', '2026-09-30T18:00'],
  );
});

ok('the session count matches the part count the title states', () => {
  const cnc = events.filter((e) => e.id === 164625);
  const parts = /\((\d+)\s*part/i.exec(cnc[0].title);
  assert.equal(Number(parts[1]), cnc.length);
});

ok('the middle session is a Monday, which weekly arithmetic would have missed', () => {
  // 7 days from 23 September is the 30th, so "expand the span weekly" gives
  // two sessions and skips the 28th. The grid says otherwise and the grid is
  // the source. This assertion is the whole reason the parser reads cells.
  const starts = events.filter((e) => e.id === 164625).map((e) => e.start.slice(0, 10));
  assert.ok(starts.includes('2026-09-28'));
  assert.equal(new Date('2026-09-28T00:00:00').getDay(), 1);
});

ok("each session carries the session's own clock times, not the span's", () => {
  for (const e of events.filter((x) => x.id === 164625)) {
    assert.equal(e.start.slice(11), '18:00');
    assert.equal(e.end, `${e.start.slice(0, 10)}T20:00`);
  }
});

ok('endTs belongs to the last session only', () => {
  const cnc = events.filter((e) => e.id === 164625);
  assert.deepEqual(
    cnc.map((e) => e.endTs),
    [null, null, 1790798400],
  );
});

ok('a one-off is dated from its cell, which agrees with its tooltip', () => {
  const j = events.find((e) => e.id === 167809);
  assert.equal(j.start, '2026-09-27T14:00');
  assert.equal(j.end, '2026-09-27T17:00');
  assert.equal(j.title, 'Jointer, Planer - Certification');
  assert.equal(j.soldOut, true);
  assert.equal(j.available, 0);
});

ok('kinds and categories still split', () => {
  const cnc = events.find((e) => e.id === 164625);
  assert.deepEqual(cnc.kinds, ['certification']);
  assert.deepEqual(cnc.categories, ['cnc', 'cnc-routing']);
});

ok('a repeat inside one cell is still one event', () => {
  const doubled = parse(month('September 2026', cell('wed', 23, CNC, CNC)));
  assert.equal(doubled.length, 1);
});

ok('the month header moves the year on', () => {
  const across = parse(
    month('December 2026', cell('thu', 31, CNC)) + month('January 2027', cell('fri', 1, CNC)),
  );
  assert.deepEqual(
    across.map((e) => e.start.slice(0, 10)),
    ['2026-12-31', '2027-01-01'],
  );
});

ok('an anchor with no grid around it falls back to its tooltip', () => {
  // A markup change should cost the session dates, not the whole calendar.
  const loose = parse(SINGLE);
  assert.equal(loose.length, 1);
  assert.equal(loose[0].start, '2026-09-27T14:00');
});

ok('events come back in date order', () => {
  const starts = events.map((e) => e.start);
  assert.deepEqual(starts, [...starts].sort());
});

console.log(`\n  ${passed} passed, 0 failed\n`);
