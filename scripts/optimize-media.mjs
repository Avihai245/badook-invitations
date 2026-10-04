#!/usr/bin/env node
/**
 * Media for the web before it goes into the `template-media` bucket (docs/template-media.md) — what the
 * editor does for a host's uploads, for the team's own files: every picture upright, at most 2560 px on
 * its long edge and WebP; every video H.264 at most 1280 px on its long edge (720p), 30 fps, faststart,
 * AAC audio — with a poster for each (a WebP still from a second in). Writes media-info.json with the
 * size of every file (pixels, seconds, bytes) and warns about anything still over its weight budget.
 *
 *   node scripts/optimize-media.mjs <folder or file …> [--out <folder>] [--max 2560] [--mute]
 *
 * Needs ffmpeg and ffprobe on the PATH for videos; the pictures use sharp (already a dependency of Next).
 * Originals are left as they are; the results go to <folder>/optimized (or --out).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const FLAGS_WITH_VALUE = new Set(['--out', '--max']);
const inputs = args.filter((a, i) => !a.startsWith('--') && !FLAGS_WITH_VALUE.has(args[i - 1] ?? ''));
if (!inputs.length) {
  console.error(
    'usage: node scripts/optimize-media.mjs <folder or file …> [--out <folder>] [--max 2560] [--mute]',
  );
  process.exit(2);
}
const MAX_EDGE = Number(value('max', '2560'));
const MUTE = args.includes('--mute');

const IMAGES = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);
const VIDEOS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);
/** What a file may weigh on a phone: bigger ones are reported. */
const BUDGET = { image: 450 * 1024, poster: 150 * 1024, videoPerSecond: 140 * 1024 };

function files(path) {
  if (statSync(path).isDirectory()) {
    if (basename(path) === 'optimized') return [];
    return readdirSync(path)
      .sort()
      .flatMap((name) => files(join(path, name)));
  }
  return [path];
}

const first = resolve(inputs[0]);
const out = resolve(
  value('out', join(statSync(first).isDirectory() ? first : join(first, '..'), 'optimized')),
);
mkdirSync(out, { recursive: true });

const report = [];
const warnings = [];
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

async function image(file) {
  const name = `${basename(file, extname(file))}.webp`;
  const to = join(out, name);
  const info = await sharp(file, { animated: false })
    .rotate() // upright, per its EXIF orientation
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(to);
  report.push({
    file: name,
    kind: 'image',
    width: info.width,
    height: info.height,
    bytes: info.size,
    source: basename(file),
    sourceBytes: statSync(file).size,
  });
  if (info.size > BUDGET.image)
    warnings.push(
      `${name}: ${kb(info.size)} — a picture should stay under ${kb(BUDGET.image)} (lower the size with --max, or crop it)`,
    );
  console.log(`✓ ${basename(file)} → ${name} (${info.width}×${info.height}, ${kb(info.size)})`);
}

function probe(file) {
  const raw = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate:format=duration',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  const json = JSON.parse(raw);
  const stream = json.streams?.[0] ?? {};
  const [num, den] = String(stream.r_frame_rate ?? '30/1')
    .split('/')
    .map(Number);
  return {
    width: stream.width,
    height: stream.height,
    fps: den ? num / den : 30,
    seconds: Number(json.format?.duration ?? 0),
  };
}

function video(file) {
  const base = basename(file, extname(file));
  const name = `${base}.mp4`;
  const to = join(out, name);
  const src = probe(file);
  // the long edge ≤ 1280 (720p), the short edge ≤ 720, both even (H.264 needs it)
  const scale = Math.min(1, 1280 / Math.max(src.width, src.height), 720 / Math.min(src.width, src.height));
  const width = Math.max(2, Math.round((src.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((src.height * scale) / 2) * 2);
  const fps = Math.min(30, Math.round(src.fps) || 30);
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      file,
      '-vf',
      `scale=${width}:${height}:flags=lanczos`,
      '-r',
      String(fps),
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '28',
      ...(MUTE ? ['-an'] : ['-c:a', 'aac', '-b:a', '96k', '-ac', '2']),
      '-movflags',
      '+faststart',
      to,
    ],
    { stdio: 'inherit' },
  );
  const bytes = statSync(to).size;
  report.push({
    file: name,
    kind: 'video',
    width,
    height,
    seconds: Math.round(src.seconds * 10) / 10,
    bytes,
    source: basename(file),
    sourceBytes: statSync(file).size,
  });
  if (bytes > BUDGET.videoPerSecond * Math.max(1, src.seconds))
    warnings.push(
      `${name}: ${kb(bytes)} for ${Math.round(src.seconds)} s — over ${kb(BUDGET.videoPerSecond)} a second; shorten it, or add --mute`,
    );
  console.log(
    `✓ ${basename(file)} → ${name} (${width}×${height}, ${Math.round(src.seconds)} s, ${kb(bytes)})`,
  );
  // its poster: a still from a second in (the first frame is often black), as WebP
  const posterName = `${base}-poster.webp`;
  const still = join(out, `.${base}-still.png`);
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-ss', String(Math.min(1, src.seconds / 2)), '-i', to, '-frames:v', '1', still],
    { stdio: 'inherit' },
  );
  return sharp(still)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 75, effort: 5 })
    .toFile(join(out, posterName))
    .then((info) => {
      rmSync(still, { force: true });
      report.push({
        file: posterName,
        kind: 'poster',
        width: info.width,
        height: info.height,
        bytes: info.size,
        source: basename(file),
      });
      if (info.size > BUDGET.poster)
        warnings.push(`${posterName}: ${kb(info.size)} — a poster should stay under ${kb(BUDGET.poster)}`);
      console.log(`  ${posterName} (${info.width}×${info.height}, ${kb(info.size)})`);
    });
}

for (const input of inputs.flatMap((p) => files(resolve(p)))) {
  const ext = extname(input).toLowerCase();
  try {
    if (IMAGES.has(ext)) await image(input);
    else if (VIDEOS.has(ext)) await video(input);
  } catch (err) {
    warnings.push(`${basename(input)}: not converted — ${String(err.message ?? err).split('\n')[0]}`);
  }
}

writeFileSync(join(out, 'media-info.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.length} file(s) in ${out} (sizes in media-info.json)`);
for (const w of warnings) console.warn(`⚠ ${w}`);
