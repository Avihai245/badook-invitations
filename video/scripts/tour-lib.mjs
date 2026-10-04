// Shared by the tour's node scripts: loads src/tour/schedule.ts (and through it narration.ts and
// durations.json) with esbuild, which @remotion/bundler already pins, so the scripts run the exact
// timing code the composition runs. Also: paths, and an MP3 duration reader with no ffmpeg needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DURATIONS_FILE = path.join(ROOT, 'src/tour/durations.json');
export const NARRATION_DIR = path.join(ROOT, 'public/narration');
// rendered masters; ../scripts/encode-site-video.mjs makes the web files in public/video/
export const OUT_DIR = path.resolve(ROOT, 'out');

/** The schedule module, freshly bundled (reads durations.json as it is on disk now). */
export async function loadTour() {
  const result = await build({
    entryPoints: [path.join(ROOT, 'src/tour/schedule.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules/.tour-'));
  const file = path.join(dir, 'schedule.mjs');
  fs.writeFileSync(file, result.outputFiles[0].text);
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const BITRATES = {
  // [version 1 | 2][layer I | II | III]
  1: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  },
  2: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  },
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Seconds of audio in an MP3 (CBR or VBR): walks the MPEG frame headers. 0 when none were found. */
export function mp3Seconds(buf) {
  let i = 0;
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  let seconds = 0;
  let first = true;
  while (i + 4 <= buf.length) {
    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    if (buf[i] !== 0xff || (b1 & 0xe0) !== 0xe0) {
      i++;
      continue;
    }
    const ver = (b1 >> 3) & 3; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5
    const layerBits = (b1 >> 1) & 3; // 3: I, 2: II, 1: III
    const brIdx = (b2 >> 4) & 15;
    const srIdx = (b2 >> 2) & 3;
    if (ver === 1 || layerBits === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
      i++;
      continue;
    }
    const layer = 4 - layerBits;
    const bitrate = BITRATES[ver === 3 ? 1 : 2][layer][brIdx] * 1000;
    const rate = RATES[ver][srIdx];
    const pad = (b2 >> 1) & 1;
    const samples = layer === 1 ? 384 : layer === 2 || ver === 3 ? 1152 : 576;
    const len =
      layer === 1
        ? (Math.floor((12 * bitrate) / rate) + pad) * 4
        : Math.floor(((samples / 8) * bitrate) / rate) + pad;
    if (len < 4) {
      i++;
      continue;
    }
    // a Xing/Info header frame carries no audio
    const tag = buf.toString('latin1', i + 4, Math.min(buf.length, i + 4 + 40));
    if (!(first && (tag.includes('Xing') || tag.includes('Info')))) seconds += samples / rate;
    first = false;
    i += len;
  }
  return seconds;
}
