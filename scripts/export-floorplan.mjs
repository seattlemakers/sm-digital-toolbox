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
import { FLOORPLAN, FLOORS, STROKE } from '../src/data/floorplan.ts';

const OUT = process.argv[2];
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

  const page = `${OUT}/${floor}.html`;
  writeFileSync(page, html);
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
