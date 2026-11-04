/**
 * Turn the calendar page's HTML into event records.
 *
 * Lifted out of fetch-events.mjs so the Cloudflare function can use it too:
 * the scraper runs this in Node and writes a file, the function runs it on
 * every request and returns JSON. One parser, so a calendar redesign cannot
 * break one of them while the other keeps working.
 *
 * Deliberately pure - string in, array out. No fs, no fetch, no Node built-ins,
 * because a Workers runtime has none of them.
 *
 * **What it reads changed on 2026-11-04, when seattlemakers.org moved off
 * WordPress.** The new site renders the calendar in the browser, so the HTML
 * carries an empty `<main>` and no event anchors at all - the old regex over
 * `pe-month-header` / `pp-tip` markup found zero and every board went to
 * "Cannot reach the calendar". What the page does carry is the data the
 * browser renders from, as JSON in `<script id="site-data">`:
 *
 *     data.months[] -> { year, month, days[] }
 *     days[]        -> { day, in_range, entries[] }
 *     entries[]     -> { id, title, href, time, end_time, starts, ends,
 *                        avail, sold_out, classes[], ... }
 *
 * That is a better source than the markup ever was - no tooltips to pick
 * apart, no "(N avail)" to strip off a title - and the output shape below is
 * unchanged, so nothing downstream had to move.
 *
 * SOURCE is the page this expects; both callers fetch it themselves. Its
 * default "upcoming" view runs from the first of this month to the end of the
 * month after next - three month grids, where the WordPress page gave five.
 */
export const SOURCE = 'https://seattlemakers.org/events/';

const ORIGIN = 'https://seattlemakers.org';

/** Slugs on the anchor that describe the kind of event, not the studio. */
const KINDS = ['class', 'certification', 'guided-studio', 'meetup', 'orientation', 'tour'];
/** Bookkeeping classes the old calendar plugin emitted. Kept in case they return. */
const NOISE = new Set(['pp-tip', 'pe-inv-out', 'wposted', 'wpost', 'dashicons']);

const pad = (n) => String(n).padStart(2, '0');

/** "6:30 pm" -> "18:30". Null for anything else. */
function clock(text) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*$/i.exec(String(text ?? ''));
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') hour += 12;
  return `${pad(hour)}:${m[2]}`;
}

/**
 * Normalise a title. The JSON is already decoded, but entities may still turn
 * up in text an organiser pasted, and the old feed's typographic dashes and
 * quotes were flattened - so are these, to keep titles the same as before.
 */
function tidy(s) {
  return String(s ?? '')
    .replace(/&#8217;|&#039;|&apos;|&#8216;|[‘’]/g, "'")
    .replace(/&#8220;|&#8221;|&quot;|[“”]/g, '"')
    .replace(/&#8211;|&#8212;|[–—]/g, '-')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** The `<script id="site-data">` payload, or null when the page has none. */
export function siteData(html) {
  const m = /<script[^>]*\bid=["']site-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * The day an event is **on** comes from the day cell it sits in, not from its
 * own `starts`/`ends`, and that distinction is the whole of the multi-session
 * bug this parser was rewritten for once already.
 *
 * A series is one post, and its `starts`/`ends` state the *span*: "CNC
 * Certification Series (3 part series)" reads November 4 6:00 pm - November 11
 * 8:00 pm. What the page does is list the entry once per session, in the cell
 * of the day that session runs - Wednesday, **Monday**, Wednesday, which no
 * weekly arithmetic produces. So the cell gives the date, and `time` /
 * `end_time` give the session's own clock times. Nothing is inferred.
 */
export function parse(html) {
  const data = siteData(html);
  const months = data?.data?.months;
  if (!Array.isArray(months)) return [];

  const events = [];
  const seen = new Set();

  for (const mo of months) {
    const year = Number(mo?.year);
    const month = Number(mo?.month);
    if (!year || !month) continue;

    for (const d of mo.days ?? []) {
      // Cells padding a grid out to whole weeks belong to another month, which
      // has its own grid; reading them here would date events twice.
      if (d?.in_range === false || !d?.day) continue;
      const on = `${year}-${pad(month)}-${pad(Number(d.day))}`;

      for (const e of d.entries ?? []) {
        const id = Number(e?.id);
        const startClock = clock(e?.time);
        if (!id || !startClock || !e?.href) continue;

        const start = `${on}T${startClock}`;
        const endClock = clock(e.end_time);
        const end = endClock ? `${on}T${endClock}` : null;

        // A repeat inside one cell is a genuine duplicate - the new site lists
        // the Ceramics Wheel series twice on one Monday - and was deduplicated
        // on the same key before.
        const key = `${id}@${start}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const categories = (Array.isArray(e.classes) ? e.classes : [])
          .map(String)
          .filter((c) => c && !NOISE.has(c));
        const available = typeof e.avail === 'number' ? e.avail : null;

        events.push({
          id,
          title: tidy(e.title),
          url: new URL(e.href, ORIGIN).href,
          start,
          end,
          // The old feed carried the span's end as a timestamp on the last
          // session. The new one does not, and nothing on the site reads it;
          // kept as null because the shape is public.
          endTs: null,
          available,
          soldOut: e.sold_out === true || available === 0,
          kinds: categories.filter((c) => KINDS.includes(c)),
          categories: categories.filter((c) => !KINDS.includes(c)),
        });
      }
    }
  }

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
  return events;
}
