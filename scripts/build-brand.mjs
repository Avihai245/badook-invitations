#!/usr/bin/env node
/**
 * The logo's files (public/brand): AVIF and WebP at 240 and 360 px wide (2x and 3x of the ~115 px it is
 * shown at) from badook-logo[-light].png, named by content hash (cached for good: next.config.ts). Prints
 * the `FILES` table for components/app/BrandLogo.tsx. Run when the logo changes:
 *   node scripts/build-brand.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const dir = 'public/brand';
for (const f of readdirSync(dir)) if (/-\d+\.[0-9a-f]{10}\.(avif|webp)$/.test(f)) rmSync(`${dir}/${f}`);
const out = {};
for (const look of ['badook-logo', 'badook-logo-light']) {
  const source = readFileSync(`${dir}/${look}.png`);
  for (const width of [240, 360]) {
    for (const [ext, options] of [
      ['avif', { quality: 40, effort: 9, chromaSubsampling: '4:2:0' }],
      ['webp', { quality: 60, effort: 6, alphaQuality: 70 }],
    ]) {
      const buffer = await sharp(source).resize({ width })[ext](options).toBuffer();
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10);
      const name = `${look}-${width}.${hash}.${ext}`;
      writeFileSync(`${dir}/${name}`, buffer);
      (out[look] ??= {})[`${ext}${width}`] = { name, bytes: buffer.length };
    }
  }
}
console.log(JSON.stringify(out, null, 2));
