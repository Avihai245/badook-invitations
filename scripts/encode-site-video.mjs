#!/usr/bin/env node
/**
 * The site's own videos for the web (the home page's demo and the narrated tour — video/, Remotion):
 * from a rendered master to what a visitor downloads, written to public/video/ under a content hash
 * (<name>.<hash>.<ext>, cached for good — next.config.ts) and listed in
 * src/features/site/site-video.generated.json, which the pages read.
 *
 *   node scripts/encode-site-video.mjs <entry> <master-file>
 *
 * Entries:
 *   demo.landscape / demo.portrait   the muted 45-second loop: H.264 High, ≤720p, 24 fps, no audio,
 *                                    CRF 34 — under 800 KB each
 *   tour.landscape / tour.portrait   the narrated tour: H.264 ≤720p, 30 fps, CRF 30, AAC 96 kb/s mono
 *   seating.landscape / .portrait    the seating screen's narrated tutorial: H.264 ≤720p, 30 fps,
 *                                    CRF 32, AAC 96 kb/s mono
 *   demo.poster / tour.poster /
 *   seating.poster                   a still (an image) → 1280 px JPEG; the pages serve it through
 *                                    the image optimizer (AVIF / WebP, the width the screen needs)
 *
 * Every mp4 gets `+faststart` (playable while it downloads). Needs ffmpeg with libx264.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'video');
const manifestFile = join(root, 'src', 'features', 'site', 'site-video.generated.json');

const H264 = ['-c:v', 'libx264', '-preset', 'veryslow', '-profile:v', 'high', '-pix_fmt', 'yuv420p'];
const ENTRIES = {
  'demo.landscape': {
    name: 'badook-demo',
    ext: 'mp4',
    args: ['-an', '-vf', 'scale=-2:min(720\\,ih):flags=lanczos,fps=24', ...H264, '-crf', '34'],
  },
  'demo.portrait': {
    name: 'badook-demo-portrait',
    ext: 'mp4',
    args: ['-an', '-vf', 'scale=min(720\\,iw):-2:flags=lanczos,fps=24', ...H264, '-crf', '34'],
  },
  'tour.landscape': {
    name: 'badook-tour',
    ext: 'mp4',
    args: [
      '-vf',
      'scale=-2:min(720\\,ih):flags=lanczos',
      ...H264,
      '-crf',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '1',
    ],
  },
  'tour.portrait': {
    name: 'badook-tour-portrait',
    ext: 'mp4',
    args: [
      '-vf',
      'scale=min(720\\,iw):-2:flags=lanczos',
      ...H264,
      '-crf',
      '30',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '1',
    ],
  },
  'seating.landscape': {
    name: 'badook-seating',
    ext: 'mp4',
    args: [
      '-vf',
      'scale=-2:min(720\\,ih):flags=lanczos',
      ...H264,
      '-crf',
      '32',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '1',
    ],
  },
  'seating.portrait': {
    name: 'badook-seating-portrait',
    ext: 'mp4',
    args: [
      '-vf',
      'scale=min(720\\,iw):-2:flags=lanczos',
      ...H264,
      '-crf',
      '32',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '1',
    ],
  },
  'seating.poster': {
    name: 'seating-poster',
    ext: 'jpg',
    args: ['-frames:v', '1', '-vf', 'scale=min(1280\\,iw):-2:flags=lanczos', '-q:v', '3'],
  },
  'demo.poster': {
    name: 'demo-poster',
    ext: 'jpg',
    args: ['-frames:v', '1', '-vf', 'scale=min(1280\\,iw):-2:flags=lanczos', '-q:v', '3'],
  },
  'tour.poster': {
    name: 'tour-poster',
    ext: 'jpg',
    args: ['-frames:v', '1', '-vf', 'scale=min(1280\\,iw):-2:flags=lanczos', '-q:v', '3'],
  },
};

const [entryKey, master] = process.argv.slice(2);
const entry = ENTRIES[entryKey];
if (!entry || !master || !existsSync(master)) {
  console.error(`usage: encode-site-video.mjs <${Object.keys(ENTRIES).join('|')}> <master-file>`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const tmp = join(outDir, `.${entry.name}.tmp.${entry.ext}`);
if (entry.args) {
  const faststart = entry.ext === 'mp4' ? ['-movflags', '+faststart'] : [];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', master, ...entry.args, ...faststart, tmp], {
    stdio: 'inherit',
  });
} else {
  copyFileSync(master, tmp);
}
const hash = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 10);
const file = `${entry.name}.${hash}.${entry.ext}`;
// the previous versions of this file (same name, another hash) go
const stale = new RegExp(
  `^${entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.[0-9a-f]{10})?\\.${entry.ext}$`,
);
for (const old of readdirSync(outDir)) if (stale.test(old) && old !== file) rmSync(join(outDir, old));
copyFileSync(tmp, join(outDir, file));
rmSync(tmp);

const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const [group, key] = entryKey.split('.');
manifest[group] = { ...manifest[group], [key]: `/video/${file}` };
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
const kb = Math.round(readFileSync(join(outDir, file)).length / 1024);
console.log(`✓ ${entryKey}: ${basename(master)} → public/video/${file} (${kb} KB)`);
