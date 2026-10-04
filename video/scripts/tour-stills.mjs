// PNG previews of the tour: a few moments of each scene (by its share of the scene), both layouts.
// Usage: node scripts/tour-stills.mjs <outDir> [scene,scene,...] [fraction,fraction,...]
//   e.g. node scripts/tour-stills.mjs out/tour home,budget 0.3,0.9
// env: COMPS=TourLandscape,TourPortrait  SCALE=0.5
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { loadTour } from './tour-lib.mjs';

const outDir = path.resolve(process.argv[2] ?? 'out/tour-stills');
const { buildSchedule } = await loadTour();
const schedule = buildSchedule();
const ids = process.argv[3] ? process.argv[3].split(',') : schedule.segments.map((s) => s.id);
const fractions = (process.argv[4] ?? '0.35,0.9').split(',').map(Number);
const comps = (process.env.COMPS ?? 'TourLandscape,TourPortrait').split(',');
const scale = Number(process.env.SCALE ?? 0.5);
fs.mkdirSync(outDir, { recursive: true });

function browser() {
  const root = '/opt/pw-browsers';
  if (!fs.existsSync(root)) return undefined;
  const d = fs
    .readdirSync(root)
    .filter((x) => x.startsWith('chromium_headless_shell'))
    .sort()
    .reverse()[0];
  const p = d && path.join(root, d, 'chrome-linux', 'headless_shell');
  return p && fs.existsSync(p) ? p : undefined;
}

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
for (const id of comps) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable: browser() });
  for (const sid of ids) {
    const seg = schedule.segments.find((s) => s.id === sid);
    if (!seg) throw new Error(`no scene "${sid}"`);
    for (const f of fractions) {
      const frame = Math.min(schedule.total - 1, seg.start + Math.round(seg.dur * f));
      const output = path.join(outDir, `${id}-${sid}-${String(Math.round(f * 100)).padStart(3, '0')}.png`);
      await renderStill({ serveUrl, composition, frame, output, browserExecutable: browser(), scale });
      console.log(output);
    }
  }
}
