// The tour's poster: a still of the landscape tour inside the "home" scene (the frame depends on the
// narration's timing, so it is computed from the schedule).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { OUT_DIR, loadTour } from './tour-lib.mjs';

const { buildSchedule } = await loadTour();
const home = buildSchedule().segments.find((s) => s.id === 'home');
const frame = home.start + Math.round(home.dur * 0.82);
const out = path.join(OUT_DIR, 'tour-poster.jpg');
const r = spawnSync(
  'npx',
  [
    'remotion',
    'still',
    'src/index.ts',
    'TourLandscape',
    out,
    `--frame=${frame}`,
    '--image-format=jpeg',
    '--jpeg-quality=85',
  ],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
