/**
 * The event's own picture, for the board's thumbnails.
 *
 * Like summarise.mjs, this reads one event page - and it is called from the
 * same fetch, so a thumbnail costs nothing beyond what the description already
 * cost, plus a request or two against the image itself. Pure string-handling
 * and `fetch`; no fs, no Node built-ins, because the Workers runtime has none.
 *
 * **Where the picture is stated changed on 2026-11-04**, when seattlemakers.org
 * moved off WordPress. There is no `og:image` any more. The page's own data -
 * `<script id="site-data">`, the same payload the calendar is parsed from -
 * carries `data.event.image`, a site-relative path. `og:image` is still read
 * as a fallback in case it comes back.
 *
 * **And what that path points at is usually a 300px thumbnail**, named the
 * WordPress way: `silkscreen-printing-300x199.jpg`. The migration carried
 * only some of the files across. Measured on 2026-11-04 over every picture on
 * the calendar: four originals still exist, the rest 404, and *no* 768 or 1024
 * variant survived at all. So the 300px file is often the only copy, and the
 * old rule - at least 600px wide - would have rejected almost every photograph.
 *
 * What it hands back is still not always a photograph:
 *
 *   1. Real class photos, now mostly as 300px thumbnails.
 *   2. Studio badges, `laser_logo.jpg` and `woodshop_saw_logo.jpg` - 300x300
 *      *originals*, with no size suffix.
 *   3. Flat artwork: `Website-black-icons-20` (its 1219px original survives,
 *      at 0.018 bytes/px) and `tour_icon` (only its 300px thumbnail survives,
 *      at 0.047).
 *
 * Density cannot separate these at 300px on its own - the badges land at
 * 0.108-0.129 and one real photo at 0.119 - so the rule is structural:
 *
 *   - **The original still exists:** the old, calibrated test. At least
 *     MIN_IMAGE_WIDTH wide and MIN_BYTES_PER_PIXEL dense. This is what
 *     rejects the badges (they *are* originals, at 300px) and the icon sheet.
 *     Rejected here means rejected - the thumbnail of a rejected original is
 *     the same artwork, smaller.
 *   - **Only the `-WxH` thumbnail is left:** its size is in its name, and the
 *     density floor still holds - every photograph measured 0.119 or more,
 *     `tour_icon` 0.047.
 *
 * A badge cannot reach the second branch, because a badge is an original.
 */

/** Where this site keeps its uploads. Anything else is chrome or off-site. */
const UPLOADS = /^https:\/\/seattlemakers\.org\/wp-content\/uploads\//;

const ORIGIN = 'https://seattlemakers.org';

/** Site chrome and Yoast's old fallbacks, never the event's own picture. */
const JUNK = /Logo-final|cropped-|s\.w\.org|\/emoji\/|favicon/i;

/**
 * Below this an *original* is a studio badge rather than a photograph. The two
 * on the calendar are both 300x300.
 */
export const MIN_IMAGE_WIDTH = 600;

/**
 * Below this a surviving thumbnail is too small to put on a plate. WordPress's
 * thumbnails are 300 on the long side, so this lets those through - the board
 * shows them at about 380px on a 1080p screen, slightly upscaled, which beats
 * the icon - and keeps out anything smaller.
 */
export const MIN_THUMB_WIDTH = 250;

/**
 * Minimum compressed bytes per pixel for an image to count as a photograph.
 *
 * Flat artwork with big even areas squeezes to a fraction of what a photo
 * needs. Measured on the WordPress calendar: `Website-black-icons-20.png`
 * 0.018, `tour_icon.jpg` 0.028, against 0.080-0.492 for every photograph; and
 * on the new site's 300px thumbnails, 0.119-0.564 for photographs against
 * `tour_icon-300x300.jpg` at 0.047.
 */
export const MIN_BYTES_PER_PIXEL = 0.06;

/** Enough of a file to reach its dimensions, past any EXIF block. */
const HEAD_BYTES = 131072;

const UA = 'sm-digital-toolbox/0.1';

/** WordPress writes "name-800x600.jpg" beside "name.jpg". */
const SIZED = /-(\d+)x(\d+)(\.[a-z]+)$/i;
export const stripSize = (url) => url.replace(SIZED, '$3');

/** The picture the page states, as an absolute URL, or null. */
export function pageImage(html) {
  const data = /<script[^>]*\bid=["']site-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (data) {
    try {
      const img = JSON.parse(data[1])?.data?.event?.image;
      if (typeof img === 'string' && img) return new URL(img, ORIGIN).href;
    } catch {
      /* fall through to og:image */
    }
  }
  const og =
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i.exec(html) ||
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i.exec(html);
  if (og && og[1].trim()) {
    try {
      return new URL(og[1].trim(), ORIGIN).href;
    } catch {
      return null;
    }
  }
  return null;
}

/** Our own uploads, a raster format, and not site chrome. */
function acceptable(url) {
  return UPLOADS.test(url) && !JUNK.test(url) && /\.(jpe?g|png|webp)$/i.test(url.split('?')[0]);
}

const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** Width and height from a file's first bytes - PNG, JPEG or WebP. */
export function imageSize(b) {
  if (b.length > 24 && u32(b, 0) === 0x89504e47) {
    return { width: u32(b, 16), height: u32(b, 20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: u16(b, i + 5), width: u16(b, i + 7) };
      }
      i += 2 + u16(b, i + 2);
    }
    return null;
  }
  if (b.length > 30 && u32(b, 0) === 0x52494646 && u32(b, 8) === 0x57454250) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (chunk === 'VP8 ') return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/**
 * What the server says about one file.
 *
 *   { state: 'missing' }                      - a definite 404 (or other 4xx)
 *   { state: 'unknown' }                      - network failure, 5xx
 *   { state: 'ok', bytes, width?, height? }   - bytes may be null
 *
 * `dims` asks for the first HEAD_BYTES with a Range GET, which the new host
 * honours (206); otherwise a HEAD, which is all a thumbnail needs, since its
 * size is in its name.
 */
async function probe(url, fetchImpl, dims) {
  try {
    const res = await fetchImpl(url, dims
      ? { headers: { 'user-agent': UA, range: `bytes=0-${HEAD_BYTES - 1}` } }
      : { method: 'HEAD', headers: { 'user-agent': UA } });
    if (!res.ok) return { state: res.status >= 400 && res.status < 500 ? 'missing' : 'unknown' };

    const range = /\/(\d+)\s*$/.exec(res.headers.get('content-range') ?? '');
    const len = Number(res.headers.get('content-length'));
    let bytes = range ? Number(range[1]) : null;

    let size = null;
    if (dims && typeof res.arrayBuffer === 'function') {
      const buf = new Uint8Array(await res.arrayBuffer());
      size = imageSize(buf);
      // A server ignoring Range sends the whole file with a 200.
      if (bytes === null && res.status === 200) bytes = buf.length;
    }
    if (bytes === null && Number.isFinite(len) && len > 0 && !(dims && res.status === 206)) bytes = len;

    return { state: 'ok', bytes, ...(size ?? {}) };
  } catch {
    return { state: 'unknown' };
  }
}

const dense = (bytes, w, h) => bytes === null || bytes / (w * h) >= MIN_BYTES_PER_PIXEL;

/**
 * The thumbnail for one event page's HTML, as an absolute URL, or null.
 *
 * An image that cannot be weighed is kept, as before: losing every thumbnail
 * because a host stopped sending sizes is a worse failure than the occasional
 * icon getting through. A file that is definitely gone is not.
 */
export async function eventImage(html, fetchImpl = fetch) {
  const given = pageImage(html);
  if (!given || !acceptable(given)) return null;

  const original = stripSize(given);
  const o = await probe(original, fetchImpl, true);

  if (o.state === 'ok' && o.width && o.height) {
    if (o.width < MIN_IMAGE_WIDTH) return null;
    return dense(o.bytes, o.width, o.height) ? original : null;
  }

  // From here the original is gone, or could not be read. If the page named
  // the original itself there is nothing smaller to fall back on.
  const sized = SIZED.exec(given);
  if (!sized) return o.state === 'unknown' ? given : null;

  const w = Number(sized[1]);
  const h = Number(sized[2]);
  if (Math.max(w, h) < MIN_THUMB_WIDTH || !h) return null;

  const v = await probe(given, fetchImpl, false);
  if (v.state === 'missing') return null;
  if (v.state === 'unknown') return given;
  return dense(v.bytes, w, h) ? given : null;
}
