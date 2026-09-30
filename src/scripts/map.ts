/**
 * Cross-highlighting between the plans and the two lists under them.
 *
 * Every interactive thing on this page carries `data-room` or `data-studio`,
 * and highlighting is one function over those attributes rather than three
 * handlers that each know about the others. That is what makes the third
 * direction - hover a studio, light up the two rooms it is in, on both floors -
 * cost nothing beyond the selector.
 *
 * Delegated from the document, because there are over a hundred targets across
 * two plans and two lists, and because Astro renders them all at build time -
 * so a listener per node would be a hundred listeners bound at load for an
 * interaction most visitors never make.
 */

const hot = new Set<Element>();

function clear(): void {
  for (const el of hot) el.classList.remove('is-hot');
  hot.clear();
}

/** Light a set of CSS selectors, on the plan and in the lists at once. */
function light(selector: string): void {
  clear();
  for (const el of document.querySelectorAll(selector)) {
    el.classList.add('is-hot');
    hot.add(el);
  }
}

function targetFor(el: Element | null): string | null {
  const room = el?.closest<HTMLElement>('[data-room]');
  if (room) return `[data-room="${CSS.escape(room.dataset.room!)}"]`;

  const studio = el?.closest<HTMLElement>('[data-studio]');
  if (studio) {
    const slug = CSS.escape(studio.dataset.studio!);
    // The room rows and the plan's <g> both carry data-studios, so one
    // attribute-contains selector reaches every room holding this studio -
    // `~=` matches a whole word in a space-separated list, which is exactly
    // what `studios.join(' ')` writes.
    return `[data-studio="${slug}"], [data-studios~="${slug}"]`;
  }

  return null;
}

document.addEventListener('pointerover', (e) => {
  const selector = targetFor(e.target as Element);
  if (selector) light(selector);
  else clear();
});

// A pointer that leaves the window never fires `pointerover` on anything else,
// so without this the last thing hovered stays lit after the cursor is gone.
document.addEventListener('pointerleave', clear);

// Keyboard users get the same thing off focus. The list rows are the focusable
// half of this page - the plan is a picture of what the lists say.
document.addEventListener('focusin', (e) => {
  const selector = targetFor(e.target as Element);
  if (selector) light(selector);
});

document.addEventListener('focusout', clear);

/* ------------------------------------------------------------ labels --- */

/**
 * The labels switch. Off by default while the geometry is being checked -
 * names, codes, icons, tape and the studio tint all come off the drawing, and
 * what is left is walls.
 *
 * The state lives in the URL rather than only in the checkbox, so "here it is
 * with the labels on" is a link. `replaceState` rather than `pushState`:
 * flicking the switch four times should not put four entries in the back
 * button between you and the page you came from.
 */
const main = document.getElementById('mp-main');
const labels = document.getElementById('mp-labels') as HTMLInputElement | null;

if (main && labels) {
  const on = new URLSearchParams(location.search).get('labels') === '1';
  labels.checked = on;
  main.classList.toggle('labels-off', !on);

  labels.addEventListener('change', () => {
    main.classList.toggle('labels-off', !labels.checked);
    const url = new URL(location.href);
    if (labels.checked) url.searchParams.set('labels', '1');
    else url.searchParams.delete('labels');
    history.replaceState(null, '', url);
  });
}

/**
 * The zones switch, alongside the labels one. Zones and labels are separate
 * because they answer different questions - "where does the tape go" and "what
 * is this room called" - and while the geometry is being checked the honest
 * default for both is off.
 */
const zones = document.getElementById('mp-zones') as HTMLInputElement | null;

if (main && zones) {
  const on = new URLSearchParams(location.search).get('zones') === '1';
  zones.checked = on;
  main.classList.toggle('zones-on', on);

  zones.addEventListener('change', () => {
    main.classList.toggle('zones-on', zones.checked);
    const url = new URL(location.href);
    if (zones.checked) url.searchParams.set('zones', '1');
    else url.searchParams.delete('zones');
    history.replaceState(null, '', url);
  });
}
