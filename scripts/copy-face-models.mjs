#!/usr/bin/env node
/**
 * The face search's model, served from this app's own origin (runs in `predev` / `prebuild`, like the
 * fonts). "The photos I'm in" (feature face_albums) finds faces and turns each into a descriptor in the
 * browser — the guest's phone, the host's computer — with the open-source face detector and face
 * descriptor models that ship inside the @vladmandic/face-api npm package (MIT). This copies the
 * library's browser build and the three models it needs to public/face-models/<version>/:
 *
 *   face-api.esm.js                       the library (TensorFlow.js bundled in)        ~1.3 MB
 *   ssd_mobilenetv1_model.*               face detector (SSD MobileNet v1)              ~5.6 MB
 *   face_landmark_68_model.*              68 face landmarks (aligns a face)             ~0.4 MB
 *   face_recognition_model.*              128-number face descriptor (ResNet-34 like)   ~6.4 MB
 *
 * Nothing is downloaded: the files come from node_modules (npm install). The browser loads them only
 * when someone uses face search, and keeps them (the versioned path is cached for a year —
 * next.config.ts). The folder is gitignored and rebuilt on every build.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'node_modules', '@vladmandic', 'face-api');
const outRoot = join(root, 'public', 'face-models');

const MODELS = ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'];

if (!existsSync(join(pkgDir, 'package.json'))) {
  console.error('copy-face-models: @vladmandic/face-api is not installed (npm ci)');
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const outDir = join(outRoot, version);
mkdirSync(outDir, { recursive: true });

/** Copies a file unless the same size is already there. */
function copy(from, name) {
  const to = join(outDir, name);
  if (existsSync(to) && statSync(to).size === statSync(from).size) return 0;
  copyFileSync(from, to);
  return statSync(to).size;
}

let copied = 0;
copied += copy(join(pkgDir, 'dist', 'face-api.esm.js'), 'face-api.esm.js');
for (const model of MODELS) {
  const manifestName = `${model}-weights_manifest.json`;
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'model', manifestName), 'utf8'));
  copied += copy(join(pkgDir, 'model', manifestName), manifestName);
  for (const group of manifest)
    for (const shard of group.paths) copied += copy(join(pkgDir, 'model', shard), shard);
}

// an older version's folder (after an upgrade) goes
for (const entry of readdirSync(outRoot))
  if (entry !== version) rmSync(join(outRoot, entry), { recursive: true, force: true });

console.log(
  `copy-face-models: public/face-models/${version}/ ready${copied ? ` (${(copied / 1e6).toFixed(1)} MB copied)` : ''}`,
);
