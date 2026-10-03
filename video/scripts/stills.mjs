// Renders preview stills (PNG) of both compositions at a few frames, bundling once.
// Usage: node scripts/stills.mjs <outDir> [frame,frame,...]
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const outDir = path.resolve(process.argv[2] ?? 'out/stills');
const frames = (process.argv[3] ?? '60,200,360,520,680,810,970,1110,1230,1330').split(',').map(Number);
const comps = (process.env.COMPS ?? 'DemoLandscape,DemoPortrait').split(',');
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
  for (const frame of frames) {
    const output = path.join(outDir, `${id}-${String(frame).padStart(4, '0')}.png`);
    await renderStill({ serveUrl, composition, frame, output, browserExecutable: browser(), scale: 0.5 });
    console.log(output);
  }
}
