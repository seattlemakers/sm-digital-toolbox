/**
 * Render each floor to a big JPG, for marking up by hand.
 *
 *   node --experimental-strip-types scripts/export-floorplan.mjs <out-dir>
 *
 * The rooms have to be named by somebody who has stood in them, and the fastest
 * way to collect that is a picture to write on. This is how those pictures are
 * made.
 *
 * Deliberately NOT a screenshot of /map. The preview pane scales unpredictably,
 * so the plan would arrive at whatever size the pane felt like and a mark on it
 * would mean nothing. Laying the same path data out at an exact pixel size
 * makes the reverse mapping arithmetic: the script prints the
 * pixels-per-drawing-unit and the origin, so a name written at a known pixel
 * lands at a known point in the building.
 *
 * Both floors go out in the same frame at the same scale, so a measurement
 * taken off one holds on the other.
 *
 * Paper-ish colours rather than the page's: the floor is pure white because it
 * is about to be drawn on, and the ground outside is grey so there is somewhere
 * obvious to write that is plainly not a room. Chrome renders it and `sips`
 * makes the JPG - both are already on the machine, and the alternative was a
 * rasteriser dependency for two pictures.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FLOORPLAN, FLOORS, STROKE, BUILDING } from '../src/data/floorplan.ts';

const OUT = process.argv[2];

/**
 * `--svg` writes the whole building back out as one drawing.
 *
 *   node --experimental-strip-types scripts/export-floorplan.mjs out --svg
 *
 * This is the other half of the flip of 2026-10-10. The data is the source of
 * truth now, so the SVG is something we produce - to look at, to open in a
 * design tool, or to hand to somebody who wants the plan rather than the
 * repository.
 *
 * It is a ROUND TRIP, not a picture: the layers, ids and attributes are the
 * ones scripts/read-floorplan.mjs reads, so an export can be imported back and
 * must come out the same. test-floorplan-frame.mjs does not check that - the
 * check is to export, import with --write, and see an empty `git diff`.
 *
 * Two things are rebuilt rather than copied, because the data does not keep
 * them and the importer does not read them:
 *
 *   a room's `d`     stored as `points`, so it goes back out as a closed
 *                    polygon. Same points in, same points out.
 *   a label's `dy`   the page computes its own line spacing from `size`, so
 *                    this only decides how the SVG looks in a design tool.
 *                    1.1x the size is what the drawing already used.
 *   a label's prefix the importer strips the drawing's own `U5: `
 *                    cross-reference, so it is put back on the way out - on the
 *                    first line for a room, on a line of its own for a zone.
 */
const AS_SVG = process.argv.includes('--svg');

const LAYER = {
  rooms: 'stroke="none" fill-rule="evenodd"',
  zones: 'fill="#1f2a24" fill-opacity="0.08" stroke="#1f2a24" stroke-width="1" stroke-dasharray="3 2" stroke-opacity="0.7"',
  walls: 'fill="none" stroke="#1f2a24" stroke-linecap="square"',
  'room-labels':
    'stroke="none" fill="#1f2a24" font-family="\'Archivo Narrow\', sans-serif" font-weight="600" text-anchor="middle" letter-spacing="0.03em" style="text-transform:uppercase"',
  'zone-labels':
    'stroke="none" fill="#1f2a24" font-family="\'Archivo Narrow\', sans-serif" font-weight="600" font-style="italic" text-anchor="middle" letter-spacing="0.03em" style="text-transform:uppercase"',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const poly = (pts) => `M${pts.map((p) => p.join(' ')).join(' L')} Z`;

const label = (s, kind) => {
  const head = kind === 'room' ? [`${s.id}: ${s.lines[0]}`, ...s.lines.slice(1)] : [s.id, ...s.lines];
  const dy = (s.size * 1.1).toFixed(2);
  const tspans = head
    .map((t, i) => `<tspan x="${s.at[0]}" dy="${i ? dy : 0}">${esc(t)}</tspan>`)
    .join('');
  return `<text id="${kind === 'room' ? 'label' : 'zlabel'}-${s.id}" x="${s.at[0]}" y="${s.at[1]}" font-size="${s.size}">${tspans}</text>`;
};

function drawing() {
  const pre = { upstairs: 'up', downstairs: 'down' };
  const body = FLOORS.map((floor) => {
    const p = pre[floor];
    const b = BUILDING[floor];
    const shift = b.offsetY ? ` transform="translate(0 ${b.offsetY})"` : '';
    const g = (name, inner) => `    <g id="${p}-${name}" ${LAYER[name]}>${inner}</g>`;
    return [
      `  <g id="${floor}"${shift}>`,
      g('rooms', b.rooms.map((r) => `<path id="room-${r.id}" fill="${r.fill}" d="${poly(r.points)}"></path>`).join('')),
      g('zones', b.zones.map((z) => `<path id="zone-${z.id}" data-room="${z.room}" d="${poly(z.points)}"></path>`).join('')),
      g('walls', ['exterior', 'interior', 'stairs']
        .map((l) => `<path id="${p}-${l}" stroke-width="${STROKE[l]}" d="${b.d[l]}"></path>`).join('')),
      g('room-labels', b.rooms.map((r) => label(r, 'room')).join('')),
      g('zone-labels', b.zones.map((z) => label(z, 'zone')).join('')),
      '  </g>',
    ].join('\n');
  }).join('\n');

  // One frame round both floors, which is how the drawing has always been set
  // up: the two are stacked, and downstairs carries its own shift.
  const [x, y, w] = FLOORPLAN.upstairs.viewBox.split(' ').map(Number);
  const d = FLOORPLAN.downstairs.viewBox.split(' ').map(Number);
  const h = d[1] + d[3] - y;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">\n${body}\n</svg>\n`;
}

if (AS_SVG) {
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/floorplan.svg`;
  writeFileSync(file, drawing());
  process.stderr.write(`${file}\n`);
  process.exit(0);
}
/**
 * `--spaces` numbers every enclosed space on the way out.
 *
 * Reading a name off a marked-up JPG means guessing which space the pen was
 * pointing at, and over a floor that guess is wrong somewhere. A number in each
 * space turns the reply into a list - "3 is the compressor room" - which cannot
 * be misread.
 *
 * The spaces come from the walls themselves: the plan is rasterised, the walls
 * are stroked wide enough to shut every doorway, and what is left is flood
 * filled. Closing the doors is the whole trick - left open, the floor is one
 * space, because that is exactly what a door makes it.
 */
const SPACES = process.argv.includes('--spaces');
const WIDTH = 3000;   // the long side of the exported image, in pixels
const PAD = 40;       // drawing units of white space round the plan, to write in
const NAME = { upstairs: ['Upstairs', '2nd floor'], downstairs: ['Downstairs', '1st floor'] };

mkdirSync(OUT, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

for (const floor of FLOORS) {
  const f = FLOORPLAN[floor];
  const [vx, vy, vw, vh] = f.viewBox.split(' ').map(Number);
  const box = [vx - PAD, vy - PAD, vw + PAD * 2, vh + PAD * 2];
  const scale = WIDTH / box[2];
  const height = Math.round(box[3] * scale);

  const html = `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: #eceeec; }
  svg { display: block; width: ${WIDTH}px; height: ${height}px; }
  .floor { fill: #ffffff; }
  .wall { fill: none; stroke: #1a1a1a; stroke-linecap: square; stroke-linejoin: miter; }
  .stairs { stroke: #4a524d; }
  .ink { fill: #1a1a1a; font-family: Helvetica, Arial, sans-serif; }
  .sub { fill: #5c6360; font-family: Helvetica, Arial, sans-serif; }
  .compass { fill: #5c6360; opacity: 0.6; }
</style>
<svg viewBox="${box.join(' ')}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0 ${f.offsetY})">
    <polygon class="floor" points="${f.outline.map((p) => p.join(',')).join(' ')}"/>
    ${['stairs', 'exterior', 'interior']
      .map(
        (layer) =>
          `<path class="wall${layer === 'stairs' ? ' stairs' : ''}" d="${f.d[layer]}" stroke-width="${STROKE[layer]}"/>`,
      )
      .join('\n    ')}
  </g>
  <g transform="translate(${box[0] + 12} ${box[1] + 16}) scale(0.3)">
    <path class="compass" d="M 18 58 L 30 18 L 42 58 L 30 48 Z"/>
    <text class="compass" x="30" y="82" font-size="26" text-anchor="middle" font-family="Helvetica">N</text>
  </g>
  <text class="ink" x="${box[0] + 12}" y="${box[1] + box[3] - 14}" font-size="15" font-weight="bold">${NAME[floor][0]}</text>
  <text class="sub" x="${box[0] + 12 + NAME[floor][0].length * 9}" y="${box[1] + box[3] - 14}" font-size="11">${NAME[floor][1]}</text>
</svg>`;

  const withSpaces = SPACES ? html.replace('</svg>', `</svg>
<script>
  const S = 2, CLOSE = 22;            // px per unit; stroke that shuts a doorway
  const svg = document.querySelector('svg');
  const shell = svg.querySelector('.floor');
  const walls = [...svg.querySelectorAll('.wall')].filter((p) => !p.classList.contains('stairs'));
  const pts = shell.getAttribute('points').split(' ').map((s) => s.split(',').map(Number));
  const bx0 = Math.min(...pts.map((p) => p[0])) - 2, bx1 = Math.max(...pts.map((p) => p[0])) + 2;
  const by0 = Math.min(...pts.map((p) => p[1])) - 2, by1 = Math.max(...pts.map((p) => p[1])) + 2;
  const W = Math.ceil((bx1 - bx0) * S), H = Math.ceil((by1 - by0) * S);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(S, 0, 0, S, -bx0 * S, -by0 * S);
  ctx.fillStyle = '#fff'; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = CLOSE;
  for (const p of walls) ctx.stroke(new Path2D(p.getAttribute('d')));
  const img = ctx.getImageData(0, 0, W, H).data;
  const free = new Uint8Array(W * H);
  for (let n = 0, j = 0; n < W * H; n++, j += 4) free[n] = img[j] > 200 && img[j + 1] > 200 ? 1 : 0;
  const lab = new Int32Array(W * H).fill(-1); const st = new Int32Array(W * H); const out = [];
  for (let s = 0; s < W * H; s++) {
    if (!free[s] || lab[s] >= 0) continue;
    const id = out.length; let sp = 0; st[sp++] = s; lab[s] = id;
    let n = 0, ax0 = 1e9, ay0 = 1e9, ax1 = -1e9, ay1 = -1e9; const px = [];
    while (sp) {
      const q = st[--sp], qx = q % W, qy = (q / W) | 0; n++; px.push(q);
      if (qx < ax0) ax0 = qx; if (qx > ax1) ax1 = qx;
      if (qy < ay0) ay0 = qy; if (qy > ay1) ay1 = qy;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const t = ny * W + nx;
        if (free[t] && lab[t] < 0) { lab[t] = id; st[sp++] = t; }
      }
    }
    // The number goes at the most interior pixel, not the centroid - an L-shaped
    // space has its centroid in the wall.
    let best = null, bd = -1;
    for (const q of px) {
      const qx = q % W, qy = (q / W) | 0;
      const d = Math.min(qx - ax0, ax1 - qx, qy - ay0, ay1 - qy);
      if (d > bd) { bd = d; best = [qx / S + bx0, qy / S + by0]; }
    }
    out.push({ area: n / (S * S), x: best[0], y: best[1] });
  }
  const spaces = out.filter((r) => r.area > 120)
    .sort((a, b) => (a.y - b.y > 40 ? 1 : b.y - a.y > 40 ? -1 : a.x - b.x));
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', svg.querySelector('g').getAttribute('transform'));
  spaces.forEach((r, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', r.x); c.setAttribute('cy', r.y); c.setAttribute('r', 9);
    c.setAttribute('fill', '#c8102e'); g.appendChild(c);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', r.x); t.setAttribute('y', r.y + 4.4);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '12');
    t.setAttribute('font-family', 'Helvetica'); t.setAttribute('font-weight', 'bold');
    t.setAttribute('fill', '#fff'); t.textContent = String(i + 1);
    g.appendChild(t);
  });
  svg.appendChild(g);
  document.title = spaces.length + ' spaces';
</script>`) : html;

  const page = `${OUT}/${floor}.html`;
  writeFileSync(page, withSpaces);
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    `--screenshot=${OUT}/${floor}.png`,
    `--window-size=${WIDTH},${height}`,
    `file://${page}`,
  ], { stdio: 'ignore' });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92',
    `${OUT}/${floor}.png`, '--out', `${OUT}/${floor}.jpg`], { stdio: 'ignore' });

  console.log(
    `${floor}: ${WIDTH}x${height}px  |  ${scale.toFixed(4)} px per drawing unit  |  ` +
    `pixel (px,py) -> drawing (${box[0]} + px/${scale.toFixed(4)}, ${box[1]} + py/${scale.toFixed(4)}${f.offsetY ? ` - ${f.offsetY}` : ''})`,
  );
}
