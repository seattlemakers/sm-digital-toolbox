/**
 * Cut the studio badges out of the brand's icon sheet.
 *
 * Equal squares, because a set of badges that are each a slightly different
 * size reads as a set of mistakes - the sheet's rings measure 165 to 173px and
 * nothing but a common box fixes that. Each is centred on its own ring, so the
 * artwork sits in the same place in every square.
 *
 * Outside the ring goes transparent rather than white. The badges sit on tinted
 * room fills on the map, and a white square round a circular mark reads as a
 * sticker that did not get trimmed. The disc INSIDE the ring stays white -
 * that is the badge, and it is what makes these legible on a photograph.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';
import { readPng } from './lib-png.mjs';

const SLUGS = [
  'electronics', 'laser-cutting', 'ceramics', 'computer-lab', 'metalworking',
  'screen-printing', 'sewing', 'lapidary', 'leatherworking', '3d-printing',
  'av-studio', 'arts-crafts', 'woodshop', 'cnc',
];
const SIZE = 184;   // comfortably over the widest ring (173) with a little air
const OUT = process.argv[2];

const img = readPng('sheet.png');
const at = (x, y) => {
  const o = (y * img.w + x) * img.bpp;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
};

/** Rings are the only big near-square components of non-white pixels. */
function rings() {
  const ink = new Uint8Array(img.w * img.h);
  for (let n = 0, o = 0; n < img.w * img.h; n++, o += img.bpp) {
    if (img.data[o] < 235 || img.data[o + 1] < 235 || img.data[o + 2] < 235) ink[n] = 1;
  }
  const lab = new Int32Array(img.w * img.h).fill(-1);
  const st = new Int32Array(img.w * img.h);
  const out = [];
  for (let s = 0; s < img.w * img.h; s++) {
    if (!ink[s] || lab[s] >= 0) continue;
    let sp = 0; st[sp++] = s; lab[s] = out.length;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    const px = [];
    while (sp) {
      const q = st[--sp], qx = q % img.w, qy = (q / img.w) | 0;
      px.push([qx, qy]);
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
        const t = ny * img.w + nx;
        if (ink[t] && lab[t] < 0) { lab[t] = out.length; st[sp++] = t; }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w > 120 && h > 120 && Math.abs(w - h) < 14) out.push({ x0, y0, w, h, px });
  }
  return out.sort((a, b) => (a.y0 - b.y0 > 60 ? 1 : b.y0 - a.y0 > 60 ? -1 : a.x0 - b.x0));
}

/**
 * The studio's colour, taken from the GLYPH rather than the ring.
 *
 * Two wrong answers came first and both are worth recording. Averaging the
 * ring's own pixels returned a muddy #5d976a for a green that is plainly
 * vivid - a ring is a four-pixel outline and most of those pixels are its
 * antialiased edge, so any mean over them lands halfway to white. Scoring for
 * darkness as well as saturation made it worse, pulling into the shadow side.
 *
 * The real cause was neither: on this sheet the ring is drawn PALE and the
 * glyph inside it carries the brand colour. Electronics rings at about #8fc79b
 * and draws its chip at #23a93c. Sampling the ring was answering a different
 * question accurately.
 *
 * So this reads inside the ring, at 80% of its radius, which is glyph and white
 * disc and nothing else. Top 3% by saturation, median rather than mean - a
 * median cannot be dragged by the few near-black pixels where a glyph is
 * outlined.
 */
function colourOf(ring) {
  const cx = ring.x0 + ring.w / 2, cy = ring.y0 + ring.h / 2;
  const r = ((ring.w + ring.h) / 4) * 0.8;
  const sat = ([a, b, c]) => Math.max(a, b, c) - Math.min(a, b, c);
  const px = [];
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const c = at(x, y);
      if (sat(c) > 25) px.push(c);
    }
  }
  px.sort((a, b) => sat(b) - sat(a));
  const core = px.slice(0, Math.max(1, Math.round(px.length * 0.03)));
  const mid = (k) => {
    const v = core.map((c) => c[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return '#' + [mid(0), mid(1), mid(2)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Minimal RGBA PNG writer: no filtering, one zlib stream. */
function writePng(path, w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

mkdirSync(OUT, { recursive: true });
const found = rings();
if (found.length !== SLUGS.length) throw new Error(`found ${found.length} rings, expected ${SLUGS.length}`);

const colours = {};
found.forEach((ring, i) => {
  const cx = ring.x0 + ring.w / 2, cy = ring.y0 + ring.h / 2;
  const r = (ring.w + ring.h) / 4 + 1.5;
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const sx = Math.round(cx - SIZE / 2 + x), sy = Math.round(cy - SIZE / 2 + y);
      const d = Math.hypot(x - SIZE / 2 + 0.5, y - SIZE / 2 + 0.5);
      // A 1.5px ramp at the edge, so the badge does not come out with a
      // staircase round it at the sizes it actually renders at.
      const alpha = d > r + 0.75 ? 0 : d < r - 0.75 ? 255 : Math.round(255 * (r + 0.75 - d) / 1.5);
      const o = (y * SIZE + x) * 4;
      const c = sx >= 0 && sy >= 0 && sx < img.w && sy < img.h ? at(sx, sy) : [255, 255, 255];
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = alpha;
    }
  }
  writePng(`${OUT}/${SLUGS[i]}.png`, SIZE, SIZE, px);
  colours[SLUGS[i]] = colourOf(ring);
});

for (const [slug, hex] of Object.entries(colours)) console.log(`${slug.padEnd(16)} ${hex}`);
