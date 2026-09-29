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
