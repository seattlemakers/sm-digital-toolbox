/**
 * Label sheet runtime.
 *
 * One design, repeated onto whichever die-cut positions are still on the sheet -
 * or, in per-label mode, a design per position, each fitted on its own.
 * Everything is placed in absolute inches from the page corner - see
 * labelSheets.ts for why the numbers are not rounded.
 */
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { SHEETS, byId, perSheet, type LabelSheet } from '../data/labelSheets';
import {
  encode,
  encodeError,
  mmPerModule,
  modulesFrom,
  normalizeUrl,
  tooSmall,
} from '../lib/print-qr';

const PX_PER_IN = 96;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`labels: #${id} missing`);
  return el as T;
};

const fStock = $('f-stock');
const fDir = $('f-dir');
const fDirWrap = $('f-dir-wrap');
const fTitle = $<HTMLInputElement>('f-title');
/* Built before Quill is constructed, because its toolbar module scans the
   container exactly once at that moment - buttons added afterwards get no
   handlers, and every format silently does nothing. Built in script rather
   than markup so the button set and the format list cannot drift apart. */
const TOOLBAR = [
  ['bold', 'Bold'],
  ['italic', 'Italic'],
  ['code', 'Code'],
  ['list', 'Numbered list', 'ordered'],
  ['list', 'Bullet list', 'bullet'],
] as const;
const toolbarHost = $('f-sub-toolbar');
toolbarHost.append(
  ...TOOLBAR.map(([fmt, label, value]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ql-${fmt}`;
    if (value) b.value = value;
    b.title = label;
    b.setAttribute('aria-label', label);
    return b;
  }),
);

/**
 * Quill rather than a hand-rolled contenteditable. The old one worked, but its
 * whole UI was five 1.5rem buttons labelled B / I / <> / bullet / 1., which told
 * you nothing about what state the caret was in. Quill brings a real toolbar
 * with active states, and takes the deprecated execCommand plumbing - selection
 * handling, list nesting, paste - with it.
 *
 * Formats are restricted to exactly what a label can carry, so the editor
 * cannot offer anything clean() would strip back out.
 */
const quill = new Quill('#f-sub', {
  theme: 'snow',
  placeholder: 'Certification required',
  formats: ['bold', 'italic', 'code', 'list'],
  modules: {
    toolbar: {
      container: '#f-sub-toolbar',
      handlers: {},
    },
  },
});
const fUrl = $<HTMLInputElement>('f-url');
const fUrlNote = $('f-url-note');
const fAlign = $('f-align');
const fMode = $('f-mode');
const fEditing = $('f-editing');
const fEditingNum = $('f-editing-num');
const fPickNote = $('f-pick-note');
const fAll = $('f-all');
const fNone = $('f-none');
const fCount = $('f-count');
const fPrint = $<HTMLButtonElement>('f-print');
const warn = $('warn');
const host = $('preview-host');
const page = $('page');
const grid = $('grid');
const tpl = $<HTMLTemplateElement>('label-tpl');
const pvSheet = $('pv-sheet');
const pvLabel = $('pv-label');

/* @page cannot be selected by class, so orientation is swapped by rewriting it. */
const pageRule = document.createElement('style');
document.head.append(pageRule);

let stock = '4x2.5';
let direction: 'horizontal' | 'vertical' = 'horizontal';
/**
 * Alignment is derived, not chosen. Center reads best in every case except one:
 * a code sitting *beside* the words, where a centered column drifts away from
 * the code and the label stops looking like one thing. That is exactly the
 * row-flow-with-a-code case, so it is the only one that goes left.
 */
const autoAlign = (flow: 'row' | 'column', hasQr: boolean) =>
  flow === 'row' && hasQr ? 'left' : 'center';

/**
 * Auto is the default and gets it right for a title-and-subtitle label, but it
 * cannot know when the copy is a checklist - which wants a left edge whatever
 * the code is doing. So auto is a default, not a verdict.
 */
let alignMode: 'auto' | 'left' | 'center' = 'auto';

/**
 * A code takes about a third of a wide label's width, or a good part of a tall
 * one's height. Type calibrated for the whole label is too assertive for what
 * is left, so it starts smaller when there is a code to share with.
 */
const QR_TYPE_SCALE = 0.85;

/**
 * The sheet is ALWAYS the portrait one, because the paper always is - the
 * die-cut does not move when you change what you print on it. Rotating the
 * landscape template 90 degrees clockwise lands on exactly the same rectangles
 * (checked against all three: 8x5 to the thousandth, the others within 0.009in,
 * which is the template author's own rounding).
 *
 * So "Upright" no longer means a landscape page. It means the same portrait
 * sheet with the content turned inside each label - which is what the physical
 * sheet actually looks like, and leaves one feed orientation instead of two.
 */
let gridSheet: LabelSheet = byId('4x2.5-h');
/** The sheet whose proportions the *content* is laid out in. */
let contentSheet: LabelSheet = byId('4x2.5-h');
let upright = false;
/**
 * Which die-cut positions get printed, by index.
 *
 * Starts as a single label, because that is what people actually come here to
 * do - one tool tag, one bench label. Filling the sheet is the exception, and
 * it is one click away.
 */
const FIRST_ONLY = () => new Set([0]);
let on = FIRST_ONLY();

/* ------------------------------------------------------------ rich text */

/** The only markup a label may carry. Everything else is unwrapped. */
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'CODE', 'UL', 'OL', 'LI']);

/**
 * Elements whose *contents* go too. Unwrapping these would keep their text -
 * a pasted <script> would quietly turn into label copy reading "bad()".
 */
const DROP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'HEAD']);

/**
 * contenteditable will happily accept a pasted table, a font tag or a styled
 * span. Strip it back to bold, italic and line breaks - both so the label
 * renders predictably and so nothing unexpected reaches innerHTML.
 */
function clean(root: Node): string {
  const doc = document.implementation.createHTMLDocument('');
  const box = doc.body;
  box.append(doc.importNode(root, true));

  // Quill's semantic HTML uses non-breaking spaces between words. Left in, a
  // subtitle would refuse to wrap and just overflow the label.
  const denbsp = (n: Node) => {
    if (n.nodeType === 3) n.nodeValue = n.nodeValue!.replace(/\u00a0/g, ' ');
    else n.childNodes.forEach(denbsp);
  };
  denbsp(box);

  const walk = (node: Element) => {
    if (DROP.has(node.tagName)) {
      node.remove();
      return;
    }
    for (const child of [...node.children]) walk(child);
    if (KEEP.has(node.tagName)) {
      for (const a of [...node.attributes]) node.removeAttribute(a.name);
      return;
    }
    // A block element ends a line; unwrapping it would run text together.
    const block = getComputedStyle(node).display !== 'inline';
    const parent = node.parentNode!;
    if (block && node.previousSibling) parent.insertBefore(doc.createElement('br'), node);
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  };
  for (const child of [...box.children]) walk(child);
  return box.innerHTML;
}

/** Text with no characters in it, even if it carries <br> or empty tags. */
/** Parse a string of HTML in a detached element - never runs scripts. */
function htmlToNode(html: string): Node {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

function isBlank(html: string): boolean {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent!.trim() === '';
}

/* ------------------------------------------------------------------ type */

/**
 * 0.1in is the registration floor - the allowance for the sheet feeding
 * slightly out of true, which is the same physical error on a 4x1 strip as on
 * an 8x5 board, so it must never scale below this.
 *
 * Above the floor it is an optical margin, and that one does scale: 0.1in on an
 * 8x5 board looks like the words are falling off the edge. So the rule is a
 * floor, not a constant - the small stock is protected, the large stock breathes.
 */
const PAD_MIN = 0.1;

/**
 * Per axis, not one value off the short side.
 *
 * Driving both margins from `min(w, h)` gave a wide label narrow *side* margins
 * - 0.15in on a 4in-wide 4x2.5 - which is what made the code and the words look
 * jammed against the edges. A margin should be proportional to the dimension it
 * sits on: side margins from the width, top and bottom from the height. The
 * 0.1in registration floor still applies to both.
 */
const padFor = (s: LabelSheet) => ({
  x: Math.max(PAD_MIN, s.size.w * 0.06),
  y: Math.max(PAD_MIN, s.size.h * 0.06),
});

/**
 * One ratio between title and copy, everywhere.
 *
 * This used to clamp the two sizes independently - title to 12..60pt, subtitle
 * to 7..22pt - which meant the clamps, not the design, decided the
 * relationship: it came out at 2.7x on the 8x5 board and 2.1x on the 4x1 strip,
 * so the same words looked differently balanced on every stock.
 *
 * Now only the title is clamped and the subtitle is always derived from it, so
 * the ratio is fixed no matter what the auto-fit does afterwards - it scales
 * both together. 1.8 keeps the title clearly dominant without the copy dropping
 * to a size nobody reads.
 */
const TITLE_TO_SUB = 1.8;

/**
 * How far ahead of the copy the title must stay once the fit has been at it.
 * Without this a title shrunk hard enough would end up level with - or under -
 * its own subtitle.
 */
const MIN_LEAD = 1.2;

/**
 * How much of a label's usable height the content may occupy.
 *
 * Fitting exactly is not the same as looking right: content that reaches the
 * padding on both sides reads as crammed even though nothing is clipped, which
 * is how the 2.5x1.56 ended up looking heavy while technically fitting. The
 * remainder is breathing room, and only labels that are genuinely full ever
 * feel it - an 8x5 with the same copy sits near 45% and does not move.
 */
const FILL_MAX = 0.88;

/**
 * Title size follows the label's short side. The clamps stop an 8x5 board
 * becoming a billboard and a 4x1 strip becoming unreadable; between them the
 * size is proportional.
 *
 * The gap between code and words does still scale - unlike the padding it is a
 * composition choice, and a big label wants more air there than a small one.
 */
/**
 * The floor is what the 4x1 strip actually prints at - it is the only stock
 * whose proportional size lands under it. 14pt left that label using a quarter
 * of its usable height with a title alone, because the size follows the short
 * side and a 4x1's short side is 1in, ignoring the 4in of width sitting there.
 * 20pt fills it properly and still leaves room for a subtitle and a code.
 */
const TITLE_MIN = 20;
const TITLE_MAX = 54;

function scaleFor(s: LabelSheet) {
  const short = Math.min(s.size.w, s.size.h);
  const title = Math.min(TITLE_MAX, Math.max(TITLE_MIN, short * 72 * 0.17));
  const gap = Math.max(0.06, short * 0.07);
  return { pad: padFor(s), title, sub: title / TITLE_TO_SUB, gap };
}

/** Wide labels put the code beside the words; tall ones stack it above. */
const flowFor = (s: LabelSheet) => (s.size.w / s.size.h >= 1.35 ? 'row' : 'column');

function qrInchesFor(s: LabelSheet, hasText: boolean) {
  const pad = padFor(s);
  if (flowFor(s) === 'row') {
    // beside the words: height-bound
    const box = s.size.h - pad.y * 2;
    return hasText ? Math.min(box, s.size.w * 0.34) : Math.min(box, s.size.w - pad.x * 2);
  }
  // above the words: width-bound
  const box = s.size.w - pad.x * 2;
  return hasText ? Math.min(box, s.size.h * 0.46) : Math.min(box, s.size.h - pad.y * 2);
}

/* --------------------------------------------------------------- preview */

function fit(): void {
  const scale = Math.min(1, host.clientWidth / (gridSheet.page.w * PX_PER_IN));
  host.style.setProperty('--preview-scale', String(scale));
  host.style.height = `${gridSheet.page.h * PX_PER_IN * scale}px`;
}

function setWarning(msg: string, level: 'warn' | 'error' | null): void {
  if (!level) {
    warn.hidden = true;
    warn.textContent = '';
    return;
  }
  warn.hidden = false;
  warn.dataset.level = level;
  warn.textContent = msg;
}

/** Variants of the current stock, and whether an upright option even exists. */
function variants(): LabelSheet[] {
  return SHEETS.filter((s) => s.stock === stock);
}

function selectSheet(): void {
  const vs = variants();
  const horiz = vs.find((s) => s.direction === 'horizontal') ?? vs[0]!;
  const vert = vs.find((s) => s.direction === 'vertical');
  // Stock with no upright variant does not just *display* as Across, it
  // *becomes* Across - so switching on to a stock that does offer it does not
  // silently spring back to a setting the last sheet could not honour.
  if (!vert) direction = 'horizontal';
  upright = direction === 'vertical';
  contentSheet = upright ? vert! : horiz;

  if (horiz !== gridSheet) {
    gridSheet = horiz;
    // Positions do not carry across stock - a 20-up sheet's index 14 means
    // nothing on a 2-up sheet. Start over at one label, and the per-label
    // content goes for the same reason. In 'each' mode the editor is still
    // showing the old position, so it is put back on what position 1 now says.
    on = FIRST_ONLY();
    per = [];
    cur = 0;
    if (mode === 'each') loadEditor(shared);
  }
  for (const b of fDir.querySelectorAll('button')) {
    const d = b.dataset.dir as 'horizontal' | 'vertical';
    const exists = d === 'horizontal' || Boolean(vert);
    b.disabled = !exists;
    b.setAttribute('aria-pressed', String(exists && d === direction));
  }
  // Shown always, greyed when the stock has no upright variant. Hiding it made
  // the control vanish and reappear as you moved between stocks.
  fDirWrap.classList.toggle('is-limited', !vert);
}

/* --------------------------------------------------------- per-label text */

/** What one label says. `sub` has been through clean(); `url` is as typed. */
interface Content {
  title: string;
  sub: string;
  url: string;
}

/**
 * 'same' is the old behaviour and the default: one design on every position.
 * 'each' lets a position carry its own words and link - a row of drawer labels,
 * a bench label per machine.
 *
 * A position with nothing of its own shows `shared`, so switching modes changes
 * nothing on the sheet until something is typed, and the usual move - type it
 * once, then change the one word that differs - needs no copying. `per` is kept
 * when switching back to 'same', so a mis-click on the mode costs nothing.
 */
let mode: 'same' | 'each' = 'same';
let shared: Content = { title: '', sub: '', url: '' };
let per: (Content | undefined)[] = [];
/** The position the editor is showing, in 'each' mode. */
let cur = 0;

const contentAt = (i: number): Content => (mode === 'each' ? (per[i] ?? shared) : shared);

function readEditor(): Content {
  return {
    title: fTitle.value,
    // getSemanticHTML, not root.innerHTML: Quill marks bullet lists as
    // <ol data-list="bullet"> internally and leans on CSS to draw them, which
    // would print every bullet as a number. The semantic form gives real ul/ol.
    sub: clean(htmlToNode(quill.getSemanticHTML())),
    url: fUrl.value,
  };
}

/** Silent, so loading a label into the editor is not mistaken for editing it. */
function loadEditor(c: Content): void {
  fTitle.value = c.title;
  quill.setContents(quill.clipboard.convert({ html: c.sub }), 'silent');
  fUrl.value = c.url;
}

function edited(): void {
  if (mode === 'each') per[cur] = readEditor();
  else shared = readEditor();
  void render();
}

function syncModeUi(): void {
  for (const b of fMode.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
  fEditing.hidden = mode !== 'each';
  fEditingNum.textContent = String(cur + 1);
  fPickNote.textContent =
    mode === 'each'
      ? 'Click a position to edit it, and click it again to skip it. Skip any already peeled off.'
      : 'Click a position on the sheet to print it. Skip any already peeled off.';
}

/* -------------------------------------------------------------- layout */

type Problem = { msg: string; level: 'warn' | 'error' };

/** One design, laid out and fitted, ready to be cloned onto positions. */
interface Built {
  proto: HTMLElement;
  problem: Problem | null;
  /** Has anything on it at all - a blank design is not worth a sheet. */
  printable: boolean;
}

/**
 * Fitted designs, keyed by what they say. The fit is about sixty reflows per
 * design, so per-label mode on a 30-up sheet would otherwise re-fit thirty
 * labels on every keystroke to change one. Cleared whenever the geometry they
 * were fitted to changes, and when a font finishes loading, because a fit
 * measured in the fallback face is wrong in the real one.
 */
const built = new Map<string, Built>();
let builtFor = '';
document.fonts.addEventListener('loadingdone', () => {
  built.clear();
  void render();
});

/** Encodes are cached too - typing a title should not re-encode thirty links. */
const qrs = new Map<string, Promise<string>>();
function qrFor(url: string): Promise<string> {
  let p = qrs.get(url);
  if (!p) {
    p = encode(url);
    qrs.set(url, p);
  }
  return p;
}

const keyOf = (c: Content) => JSON.stringify([c.title.trim(), c.sub, normalizeUrl(c.url)]);

/**
 * Builds one label in the grid, fits its type, and hands it back detached.
 * Each design is fitted on its own, so a long title on one position cannot
 * shrink the type on its neighbours.
 */
function layout(c: Content, svg: string, encodeProblem: Problem | null): Built {
  const titleText = c.title.trim();
  const subHtml = c.sub;
  const titleBlank = titleText === '';
  const subBlank = isBlank(subHtml);
  const hasText = !titleBlank || !subBlank;

  // Type and composition follow the *reading* orientation, not the die-cut.
  const { pad, title: baseTitle, gap } = scaleFor(contentSheet);
  const qrIn = qrInchesFor(contentSheet, hasText);
  const flow = flowFor(contentSheet);

  const hasQr = Boolean(svg);
  // The readability floor still wins. Applying the reduction after the clamp
  // pushed the 4x1 strip to 11.9pt, under the 14pt the clamp exists to hold -
  // on the smallest stock there is nothing to give back.
  const tpt = hasQr ? Math.max(TITLE_MIN, baseTitle * QR_TYPE_SCALE) : baseTitle;
  const spt = tpt / TITLE_TO_SUB;

  const proto = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
  proto.dataset.flow = flow;
  proto.dataset.align = alignMode === 'auto' ? autoAlign(flow, hasQr) : alignMode;
  proto.dataset.rot = upright ? '1' : '0';
  proto.style.setProperty('--pad-x', `${pad.x}in`);
  proto.style.setProperty('--pad-y', `${pad.y}in`);
  proto.style.setProperty('--gap', `${gap}in`);
  proto.style.setProperty('--title', `${tpt}pt`);
  proto.style.setProperty('--sub', `${spt}pt`);
  proto.style.setProperty('--qr', `${qrIn}in`);
  // The cell is the die-cut rectangle; the content box inside it is the reading
  // orientation, turned 90 degrees when upright. A w x h box rotated a quarter
  // turn occupies h x w, which is exactly the rectangle it sits in.
  proto.style.width = `${gridSheet.size.w}in`;
  proto.style.height = `${gridSheet.size.h}in`;
  proto.style.setProperty('--rot-w', `${contentSheet.size.w}in`);
  proto.style.setProperty('--rot-h', `${contentSheet.size.h}in`);
  // Safe: the link reaches the output only as path geometry, and the colours
  // are our own literals. Title and subtitle go through textContent.
  if (svg) {
    const slot = proto.querySelector<HTMLElement>('.lb-qr')!;
    slot.innerHTML = svg;
    // The encoder bakes a 4-module quiet zone inside the image, so the code's
    // *ink* sits inset from its own box - 0.29in on an 8x5. Left as-is the
    // visible left margin is padding plus quiet zone, about twice the right,
    // and the gap to the words reads far wider than the one declared. Pulling
    // the box out by the quiet zone lines the ink up with the padding instead.
    //
    // Capped at the padding, because the quiet zone still has to be white: past
    // that the code would hang over the label edge. It stays satisfied either
    // way - the white it needs comes from the padding rather than the image.
    const modules = modulesFrom(svg);
    const quiet = modules ? (qrIn * 4) / modules : 0;
    // capped at the side margin, which is the edge the code sits against
    proto.style.setProperty('--quiet-pull', `${Math.min(quiet, pad.x)}in`);
  }
  const titleNode = proto.querySelector<HTMLElement>('.lb-title')!;
  const subNode = proto.querySelector<HTMLElement>('.lb-subtitle')!;
  titleNode.textContent = titleText;
  // Already through clean(): b / i / br only, no attributes.
  subNode.innerHTML = subHtml;
  titleNode.classList.toggle('is-empty', titleBlank);
  subNode.classList.toggle('is-empty', subBlank);

  // Fit the type to the box it actually has. Scaling off the label's short side
  // alone is not enough: a QR takes a third of the width, so "Woodshop" at the
  // nominal size would break mid-word on a 4x2.5.
  //
  // Title and copy are fitted SEPARATELY on width, then together on height.
  // One shared factor used to do both, which meant a long title dragged the
  // subtitle down with it - lengthening a title took "Certification required"
  // from 17pt to 12.6pt, though not a word of it had changed. How wide the
  // title runs says nothing about how big the copy should be; only the height
  // they share is a joint constraint.
  grid.replaceChildren(proto);
  const innerEl = proto.querySelector<HTMLElement>('.lb-inner')!;

  const setTitle = (k: number) => proto.style.setProperty('--title', `${tpt * k}pt`);
  const setSub = (k: number) => proto.style.setProperty('--sub', `${spt * k}pt`);

  // Width is measured on the text nodes themselves, because a wrapper that has
  // already wrapped reports no overflow - that mistake once printed
  // "Woodsho / p". Exactly equal, no tolerance either way: a `+ 1` slack
  // absorbed a real overflow (130 in a 129 box passed as "fits"), and a `- 1`
  // demand can never be met, because text that fits reports scrollWidth ===
  // clientWidth - that collapsed every label to the floor. Glyph side bearings
  // get their room from a layout inset on .lb-text instead.
  const titleWidthFits = () => titleNode.scrollWidth <= titleNode.clientWidth;
  const subWidthFits = () => subNode.scrollWidth <= subNode.clientWidth;

  /**
   * Content height against the height actually available, worked out from the
   * flex layout rather than read off scrollHeight.
   *
   * scrollHeight only reports overflow *downwards*. The content here is
   * vertically centered, so when it is too tall it spills equally above and
   * below and scrollHeight under-reports by half - a 2.5x1.56 sat at 102% of
   * its usable height, eating into the padding, and still passed.
   *
   * offset* rather than getBoundingClientRect, because upright labels are
   * rotated and the rect would be the axis-aligned box of the transform.
   */
  const textEl = proto.querySelector<HTMLElement>('.lb-text')!;
  const padY = parseFloat(getComputedStyle(innerEl).paddingTop);
  const usableH = innerEl.offsetHeight - padY * 2;
  const qrPx = svg ? qrIn * 96 : 0;
  const gapPx = gap * 96;

  /**
   * Height the words may occupy. Beside the code they get the whole label;
   * stacked under it they get what the code and the gap leave.
   */
  const textBudget = () => {
    if (flow === 'row') return usableH;
    const g = qrPx && textEl.offsetHeight ? gapPx : 0;
    return Math.max(0, usableH - qrPx - g);
  };

  /**
   * The fill target applies to the WORDS, not to the code.
   *
   * Measuring the two together was wrong: on a 4x1 the code is sized to exactly
   * the usable height, so a target below 100% could never be met no matter how
   * small the type went - the search ran to its floor and printed a 5pt title.
   * Shrinking text cannot shrink a fixed-size code, so the code has no business
   * being in the test.
   */
  const heightFits = () => textEl.offsetHeight <= textBudget() * FILL_MAX + 1;
  /** Does it fit at all - the question the clipping warning asks. */
  const heightClips = () => textEl.offsetHeight > textBudget() + 1;

  /**
   * How many lines the title is currently taking. Smaller type means more
   * characters per line, so this falls as the scale falls - which is what lets
   * it be searched on.
   */
  const titleLines = () => {
    const lh = parseFloat(getComputedStyle(titleNode).lineHeight);
    return lh > 0 ? Math.round(titleNode.scrollHeight / lh) : 1;
  };

  /**
   * Largest k in [floor, 1] satisfying ok(). Binary search rather than fixed
   * percentage steps: it lands within ~0.02% of the best fit in 12 reflows,
   * instead of overshooting by up to a whole step.
   */
  const search = (ok: (k: number) => boolean, floor: number) => {
    if (ok(1)) return 1;
    let lo = floor;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  // Never below 6pt - past that it is unreadable, and shrinking further only
  // hides the fact that the copy does not belong on this label.
  const floorFor = (pt: number) => Math.min(1, 6 / pt);

  // A title is plain text, so it always wants exactly one line. The search is
  // tiered: ask for one line first, and accept that unless it costs more than a
  // third of the size; otherwise allow a second line, then just fit the width.
  let kt = search((k) => (setTitle(k), titleWidthFits() && titleLines() <= 1), floorFor(tpt));
  if (kt < 0.66) {
    const relaxed = search(
      (k) => (setTitle(k), titleWidthFits() && titleLines() <= 2),
      floorFor(tpt),
    );
    kt = Math.max(
      kt,
      relaxed >= 0.5 ? relaxed : search((k) => (setTitle(k), titleWidthFits()), floorFor(tpt)),
    );
  }

  let ks = search((k) => (setSub(k), subWidthFits()), floorFor(spt));
  // The title still has to read as the title. If it shrank far enough that the
  // copy would rival it, the copy comes down too - the ratio is a floor here,
  // not the fixed relationship it is at nominal size.
  ks = Math.min(ks, (kt * TITLE_TO_SUB) / MIN_LEAD);

  setTitle(kt);
  setSub(ks);

  // Height is the one constraint the two share, but sharing it does not mean
  // splitting the cost. Running out of room is almost always the copy's doing,
  // so the copy gives way first and the title holds its size - scaling both
  // together dragged a 20pt title down to 13pt just because the subtitle ran
  // long, which is the width fault over again in the other direction.
  if (!heightFits()) {
    const shrinkSub = search((k) => (setSub(ks * k), heightFits()), Math.min(1, 6 / (spt * ks)));
    ks *= shrinkSub;
    setSub(ks);

    // Only when the copy has given all it can does the title come down, and it
    // comes down on its own. Scaling the pair together here would push the copy
    // under the 6pt floor to buy height the title could have given up instead.
    if (!heightFits()) {
      const shrinkTitle = search(
        (k) => (setTitle(kt * k), heightFits()),
        Math.min(1, 6 / tpt),
      );
      kt *= shrinkTitle;
      setTitle(kt);

      // The title may now be level with the copy, so restore its lead.
      const capped = Math.min(ks, (kt * TITLE_TO_SUB) / MIN_LEAD);
      if (capped < ks) {
        ks = capped;
        setSub(ks);
      }
    }
  }

  // The warning is about *clipping*, so it asks the real question - does this
  // fit at all - not the roomier one the fit aims for.
  const overflowing = !titleWidthFits() || !subWidthFits() || heightClips();
  proto.remove();

  /* ------------------------------------------------------------ warnings */

  let problem = encodeProblem;
  if (!problem && svg) {
    const modules = modulesFrom(svg);
    if (modules) {
      const mm = mmPerModule(qrIn, modules);
      const level = tooSmall(mm);
      if (level === 'error') {
        problem = {
          msg: `On this label the code prints at ${mm.toFixed(2)}mm per module - too small to scan. Use a bigger label or a shorter link.`,
          level,
        };
      } else if (level === 'warn') {
        problem = {
          msg: `The code prints at ${mm.toFixed(2)}mm per module on this label. That is tight - test one before running a sheet.`,
          level,
        };
      }
    }
  }

  // Only complain once the auto-fit has run out of room; shrinking on its own
  // is normal and not worth a warning.
  if (!problem && overflowing) {
    problem = {
      msg: 'Even at the smallest readable size this copy does not fit - it will be cut off.',
      level: 'warn',
    };
  }

  return { proto, problem, printable: hasText || hasQr };
}

/* --------------------------------------------------------------- render */

/**
 * render() awaits the encoder, so two renders can be in flight at once and the
 * slower one can land last - typing into three fields in quick succession was
 * enough to leave a stale QR on a label whose link had been cleared. Each run
 * takes a ticket and stands down if a newer one has started.
 */
let generation = 0;

/** Per position, from the last render: is there anything on it to print. */
let printableAt: boolean[] = [];

async function render(): Promise<void> {
  const mine = ++generation;
  selectSheet();
  const total = perSheet(gridSheet);
  if (cur >= total) cur = 0;

  const editorUrl = normalizeUrl(fUrl.value);
  if (editorUrl && editorUrl !== fUrl.value.trim()) {
    fUrlNote.hidden = false;
    fUrlNote.textContent = `Encodes as ${editorUrl}`;
  } else {
    fUrlNote.hidden = true;
  }

  // Always portrait: the paper is.
  pageRule.textContent = `@page { size: letter portrait; margin: 0; }`;
  page.dataset.orient = gridSheet.orient;
  page.style.setProperty('--page-w', `${gridSheet.page.w}in`);
  page.style.setProperty('--page-h', `${gridSheet.page.h}in`);

  // Positions grouped by what they say, so a sheet of thirty identical labels
  // is still one design, fitted once - which is all 'same' mode ever is.
  const groups = new Map<string, { c: Content; at: number[] }>();
  for (let i = 0; i < total; i++) {
    const c = contentAt(i);
    const k = keyOf(c);
    const g = groups.get(k);
    if (g) g.at.push(i);
    else groups.set(k, { c, at: [i] });
  }

  const svgs = new Map<string, string | Problem>();
  const urls = new Set([...groups.values()].map((g) => normalizeUrl(g.c.url)).filter(Boolean));
  await Promise.all(
    [...urls].map(async (u) => {
      try {
        svgs.set(u, await qrFor(u));
      } catch (err) {
        svgs.set(u, { msg: encodeError(err), level: 'error' });
      }
    }),
  );

  if (mine !== generation) return;

  const geometry = `${gridSheet.id}|${contentSheet.id}|${alignMode}`;
  if (geometry !== builtFor) {
    built.clear();
    builtFor = geometry;
  }

  const designs: { b: Built; at: number[] }[] = [];
  for (const [k, g] of groups) {
    let b = built.get(k);
    if (!b) {
      const s = svgs.get(normalizeUrl(g.c.url));
      b = typeof s === 'string' ? layout(g.c, s, null) : layout(g.c, '', s ?? null);
      built.set(k, b);
    }
    designs.push({ b, at: g.at });
  }

  grid.replaceChildren();
  printableAt = [];
  for (const { b, at } of designs) {
    for (const i of at) {
      const c = i % gridSheet.cols;
      const r = Math.floor(i / gridSheet.cols);
      const cell = b.proto.cloneNode(true) as HTMLElement;
      cell.style.left = `${gridSheet.origin.x + c * (gridSheet.size.w + gridSheet.gutter.x)}in`;
      cell.style.top = `${gridSheet.origin.y + r * (gridSheet.size.h + gridSheet.gutter.y)}in`;
      cell.dataset.on = on.has(i) ? '1' : '0';
      cell.dataset.i = String(i);
      cell.dataset.cur = mode === 'each' && i === cur ? '1' : '0';
      cell.querySelector<HTMLElement>('.lb-num')!.textContent = String(i + 1);
      grid.append(cell);
      printableAt[i] = b.printable;
    }
  }
  // Source order is not sheet order once positions are grouped. Nothing is
  // laid out by flow, but a screen reader and the print spooler both walk the
  // DOM, so keep it in position order.
  grid.append(
    ...[...grid.children].sort(
      (a, b) => Number((a as HTMLElement).dataset.i) - Number((b as HTMLElement).dataset.i),
    ),
  );

  /* A problem is reported for the labels that will actually print, and in
     'each' mode for the one being edited, which is the one being looked at.
     With one design there is nothing to name; with several, each line says
     which positions it is about. */
  const lines: string[] = [];
  let level: Problem['level'] | null = null;
  for (const { b, at } of designs) {
    if (!b.problem) continue;
    if (mode === 'same') {
      lines.push(b.problem.msg);
    } else {
      const which = at.filter((i) => on.has(i) || i === cur);
      if (!which.length) continue;
      const nums = which.map((i) => i + 1).join(', ');
      lines.push(`${which.length === 1 ? 'Label' : 'Labels'} ${nums}: ${b.problem.msg}`);
    }
    if (level !== 'error') level = b.problem.level;
  }
  setWarning(lines.join('\n'), level);

  syncModeUi();
  syncCounts();
  writeUrl();
  fit();
}

function syncCounts(): void {
  const total = perSheet(gridSheet);
  pvSheet.textContent = `${gridSheet.page.w} × ${gridSheet.page.h}in portrait`;
  pvLabel.textContent = `${contentSheet.label} · ${on.size} of ${total}`;
  fCount.textContent = on.size === 1 ? '1 label' : `${on.size} of ${total}`;
  fPrint.disabled = ![...on].some((i) => printableAt[i]);
}

/* ------------------------------------------------------------------- url */

/**
 * The URL is the label: reload it, bookmark it or send it and the same sheet
 * comes back. Only what differs from a fresh page is written, so the default
 * stays a bare /labels and every link written before this keeps meaning what
 * it meant - title, sub and url are still the shared design, and the per-label
 * fields are new names (t3, s3, u3, 1-based like ?on=) that an old link simply
 * does not carry.
 */
function writeUrl(): void {
  const p = new URLSearchParams();
  if (stock !== '4x2.5') p.set('stock', stock);
  if (direction !== 'horizontal') p.set('dir', direction);
  if (alignMode !== 'auto') p.set('align', alignMode);
  if (shared.title !== fTitle.defaultValue) p.set('title', shared.title);
  if (!isBlank(shared.sub)) p.set('sub', shared.sub);
  if (shared.url.trim()) p.set('url', shared.url.trim());
  const ons = [...on].sort((a, b) => a - b);
  if (ons.length && !(ons.length === 1 && ons[0] === 0)) {
    p.set('on', ons.map((i) => i + 1).join(','));
  }
  if (mode === 'each') {
    p.set('mode', 'each');
    per.forEach((c, i) => {
      if (!c) return;
      // t is always written, so its presence is what says "this position has
      // its own content" - an empty title is a real choice, not an absence.
      p.set(`t${i + 1}`, c.title);
      if (!isBlank(c.sub)) p.set(`s${i + 1}`, c.sub);
      if (c.url.trim()) p.set(`u${i + 1}`, c.url.trim());
    });
  }
  const qs = p.toString();
  try {
    // Safari throttles replaceState; losing one write while typing is harmless.
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  } catch {
    /* ignored */
  }
}

/* -------------------------------------------------------------- controls */

fStock.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-stock]');
  if (!b) return;
  stock = b.dataset.stock!;
  for (const o of fStock.querySelectorAll('button')) {
    o.setAttribute('aria-pressed', String(o === b));
  }
  void render();
});

fDir.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-dir]');
  if (!b || b.disabled) return;
  direction = b.dataset.dir as 'horizontal' | 'vertical';
  void render();
});

fMode.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
  if (!b) return;
  mode = b.dataset.mode as typeof mode;
  // Start on a position that is actually printing, so the first thing the
  // editor shows is a label on the sheet rather than a ghosted one.
  if (mode === 'each' && !on.has(cur) && on.size) cur = Math.min(...on);
  loadEditor(mode === 'each' ? contentAt(cur) : shared);
  void render();
});

/* The preview is the sheet map. With one design, a click takes a position in
   or out of the run. With a design per label it first picks the position to
   edit - switching it on, since you are about to put words on it - and only a
   second click on the same position skips it. */
grid.addEventListener('click', (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLElement>('.lb-cell');
  if (!cell) return;
  const i = Number(cell.dataset.i);
  if (mode === 'each' && i !== cur) {
    cur = i;
    on.add(i);
    loadEditor(contentAt(i));
  } else if (on.has(i)) {
    on.delete(i);
  } else {
    on.add(i);
  }
  void render();
});

fAll.addEventListener('click', () => {
  on = new Set(Array.from({ length: perSheet(gridSheet) }, (_, i) => i));
  void render();
});
fNone.addEventListener('click', () => {
  on = new Set();
  void render();
});

for (const el of [fTitle, fUrl]) {
  el.addEventListener('input', edited);
}
quill.on('text-change', edited);

fAlign.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-align]');
  if (!b) return;
  alignMode = b.dataset.align as typeof alignMode;
  for (const o of fAlign.querySelectorAll('button')) {
    o.setAttribute('aria-pressed', String(o === b));
  }
  void render();
});

fPrint.addEventListener('click', () => window.print());

/* Both, deliberately. The window listener is the one that always fires; the
   observer additionally catches the host changing width without the window
   doing so. fit() is idempotent, so double-firing is free. */
addEventListener('resize', fit);
new ResizeObserver(fit).observe(host);

/* ---------------------------------------------------------------- prefill */

const q = new URLSearchParams(location.search);
const qStock = q.get('stock');
if (qStock && SHEETS.some((s) => s.stock === qStock)) {
  stock = qStock;
  for (const o of fStock.querySelectorAll('button')) {
    o.setAttribute('aria-pressed', String(o.dataset.stock === stock));
  }
}
const qAlign = q.get('align');
if (qAlign === 'auto' || qAlign === 'left' || qAlign === 'center') {
  alignMode = qAlign;
  for (const o of fAlign.querySelectorAll('button')) {
    o.setAttribute('aria-pressed', String(o.dataset.align === alignMode));
  }
}
const qDir = q.get('dir');
if (qDir === 'horizontal' || qDir === 'vertical') direction = qDir;
const qTitle = q.get('title');
if (qTitle !== null) fTitle.value = qTitle;
const qSub = q.get('sub');
if (qSub !== null) {
  // Interpreted as markup so a bookmarked label keeps its bullets and code,
  // then put through the same clean() as anything typed - which allows only
  // b/i/br/code/ul/ol/li and deletes script and style outright. Parsed in a
  // detached element, which never runs scripts.
  //
  // Fed through Quill's clipboard rather than assigned to its DOM, so the
  // editor's own model is what ends up holding the content.
  quill.setContents(quill.clipboard.convert({ html: clean(htmlToNode(qSub)) }), 'silent');
}
const qUrl = q.get('url');
if (qUrl !== null) fUrl.value = qUrl;
shared = readEditor();
if (q.get('mode') === 'each') mode = 'each';

/* ?on=3,4,7 names the positions to print, 1-based to match the sheet map. It
   replaces the old ?off=, which only made sense back when the default was a
   full sheet. Applied after the first render, because the sheet - and so how
   many positions exist - is resolved there. The per-label fields wait for the
   same reason: a stock change resets them. */
const initialOn = (q.get('on') ?? '')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isInteger(v) && v >= 1);

void render().then(() => {
  const total = perSheet(gridSheet);
  if (initialOn.length) on = new Set(initialOn.filter((v) => v <= total).map((v) => v - 1));
  if (mode === 'each') {
    for (let n = 1; n <= total; n++) {
      const t = q.get(`t${n}`);
      if (t === null) continue;
      per[n - 1] = {
        title: t,
        sub: clean(htmlToNode(q.get(`s${n}`) ?? '')),
        url: q.get(`u${n}`) ?? '',
      };
    }
    if (on.size) cur = Math.min(...on);
    loadEditor(contentAt(cur));
  }
  if (initialOn.length || mode === 'each') return render();
});
