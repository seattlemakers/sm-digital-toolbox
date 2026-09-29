/**
 * Turn the calendar page's HTML into event records.
 *
 * Lifted out of fetch-events.mjs so the Cloudflare function can use it too:
 * the scraper runs this in Node and writes a file, the function runs it on
 * every request and returns JSON. One parser, so a calendar redesign cannot
 * break one of them while the other keeps working.
 *
 * Deliberately pure - string in, array out. No fs, no fetch, no Node built-ins,
 * because a Workers runtime has none of them. Everything in fetch-events.mjs
 * that touches disk (the per-event summary and picture enrichment) stays there.
 *
 * SOURCE is the page this expects; both callers fetch it themselves.
 */
export const SOURCE = 'https://seattlemakers.org/events';

/** Slugs on the anchor that describe the kind of event, not the studio. */
const KINDS = ['class', 'certification', 'guided-studio', 'meetup', 'orientation', 'tour'];
/** Bookkeeping classes emitted by the calendar plugin, never taxonomy. */
const NOISE = new Set(['pp-tip', 'pe-inv-out', 'wposted', 'dashicons']);

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const pad = (n) => String(n).padStart(2, '0');

/** "August 5, 2026 6:00 pm" -> "18:00". The clock half of a tooltip date. */
function clockOf(iso) {
  return iso.slice(11);
}

/** "August 5, 2026 6:00 pm" -> "2026-08-05T18:00" (floating local time). */
function parseWhen(text) {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(text.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toLowerCase() === 'pm') hour += 12;
  return `${m[3]}-${pad(month)}-${pad(Number(m[2]))}T${pad(hour)}:${m[5]}`;
}

function decode(s) {
  return s
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The three things worth finding, in document order.
 *
 * Read as one alternation rather than three passes, because what an anchor
 * *means* depends on the month header and day cell above it - see the note on
 * `parse()`. `matchAll` walks the document once and the groups say which of
 * the three matched.
 */
const TOKEN = new RegExp(
  [
    // <h3 class="pe-month-header">Showing: September 2026</h3>
    '<h3 class="pe-month-header"[^>]*>\\s*Showing:\\s*([A-Za-z]+)\\s+(\\d{4})\\s*</h3>',
    // <li class="event-day mon"><div class="head"><span class="inline-day">Mon</span>21</div>
    '<li class="event-day[^"]*"><div class="head"><span class="inline-day">[^<]*</span>(\\d{1,2})</div>',
    // the event link itself
    '<a\\s+title="([^"]*)"\\s+href="([^"]+)"\\s+rel="(\\d+)"\\s+class="([^"]*)"',
  ].join('|'),
  'g',
);

/**
 * The day an event is **on** comes from the grid cell it sits in, not from its
 * own tooltip, and that distinction is the whole of the multi-session bug.
 *
 * A series is one post with one tooltip, and that tooltip states the *span*:
 * "Ceramics Wheel (4 Part Series)" reads September 21 7:00 pm - October 12
 * 9:00 pm. Read literally that is a three-week class. What the page actually
 * does is render the anchor once per session, in the cell of the day that
 * session runs - four anchors, all carrying the same span - so the sessions
 * were there all along and the parser was throwing them away: it dated every
 * anchor from the tooltip and then deduplicated on `id@start`, which collapsed
 * all four back into one row on the first day. Weekly sessions two and three
 * vanished, and any session in a later month vanished with the month.
 *
 * So the cell gives the date and the tooltip gives the clock times. The clock
 * times are right on every session - that was already established for
 * `sessionEnd()`, which was the workaround for reading the span as a session -
 * and the cell is the source stating, per day, that this thing is on.
 *
 * Nothing is inferred. The dates were tried as arithmetic first - weekly from
 * the span - and the calendar refutes it: "CNC Certification Series (3 part
 * series)" runs Wednesday, **Monday**, Wednesday, and "Woodshop Basics (4 Part
 * Series) [Weekends]" is two Saturday/Sunday pairs. Reading them out of the
 * description prose was the other option and is worse still: five different
 * phrasings across thirteen series, one of them ("Sunday, October 5" on a
 * Monday) already wrong at the source, and one series with no list at all.
 */
export function parse(html) {
  const events = [];
  const seen = new Set();

  let year = null;
  let month = null;
  let day = null;

  for (const m of html.matchAll(TOKEN)) {
    const [, headMonth, headYear, cellDay, titleAttr, href, rel, classAttr] = m;

    if (headMonth) {
      month = MONTHS[headMonth.toLowerCase()] ?? null;
      year = Number(headYear);
      day = null;
      continue;
    }
    if (cellDay) {
      day = Number(cellDay);
      continue;
    }
    if (!classAttr.includes('pp-tip')) continue;

    const titleMatch = /pe-hover-title[^>]*>(.*?)<\/div>/s.exec(titleAttr);
    if (!titleMatch) continue;

    const dates = [...titleAttr.matchAll(/pe-hover-date[^>]*>(.*?)<\/div>/gs)].map((d) => d[1]);
    if (dates.length < 1) continue;

    // Availability is appended to the title as "(N avail)".
    let name = decode(titleMatch[1].replace(/<[^>]+>/g, ''));
    let available = null;
    const avail = /\((\d+)\s*avail\)\s*$/i.exec(name);
    if (avail) {
      available = Number(avail[1]);
      name = name.slice(0, avail.index).trim();
    }

    const endRaw = dates[dates.length - 1];
    const tsMatch = /\*(\d{9,11})\*/.exec(endRaw);
    const spanStart = parseWhen(decode(dates[0].replace(/<[^>]+>/g, '')));
    const spanEnd = parseWhen(decode(endRaw.replace(/\*\d+\*/, '').replace(/<[^>]+>/g, '')));
    if (!spanStart) continue;

    // The cell's date with the tooltip's clock times. Falling back to the span
    // keeps an anchor that somehow sits outside a grid - a markup change here
    // should cost the session dates, not the event.
    const on = year && month && day ? `${year}-${pad(month)}-${pad(day)}` : spanStart.slice(0, 10);
    const start = `${on}T${clockOf(spanStart)}`;
    const end = spanEnd ? `${on}T${clockOf(spanEnd)}` : null;

    const categories = classAttr
      .split(/\s+/)
      .filter((c) => c && !NOISE.has(c));

    // One row per cell the event appears in, so a series' sessions are separate
    // events. `id@start` still catches a genuine duplicate inside one cell.
    const key = `${rel}@${start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    events.push({
      id: Number(rel),
      title: name,
      url: href,
      start,
      end,
      // The span's final end, so it belongs to the last session only. Kept
      // because the shape is public; nothing on the site reads it.
      endTs: tsMatch && end === spanEnd ? Number(tsMatch[1]) : null,
      available,
      soldOut: classAttr.includes('pe-inv-out') || available === 0,
      kinds: categories.filter((c) => KINDS.includes(c)),
      categories: categories.filter((c) => !KINDS.includes(c)),
    });
  }

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
  return events;
}
