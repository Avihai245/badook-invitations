/**
 * Template media sync: lists what's in the Supabase Storage bucket `template-media` (one folder per
 * template: `<template id>/<file>`, the file names of the template's manifest `assets`) and writes
 * src/features/invitations/templates/media-manifest.json — the renderer only uses a template file
 * that this manifest lists, with its hash in the URL so a replaced file is fetched again.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… npx tsx scripts/media-sync.ts [--check]
 *
 * --check: exit 1 when the manifest on disk doesn't match the bucket (nothing is written).
 * Then commit the manifest and deploy (docs/template-media.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMPLATE_IDS } from '../src/features/invitations/templates/registry';

const BUCKET = 'template-media';
const OUT = resolve('src/features/invitations/templates/media-manifest.json');

interface StorageObject {
  name: string;
  id: string | null;
  metadata: { eTag?: string; size?: number; lastModified?: string } | null;
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SECRET_KEY ?? '';
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (the project’s secret key).');
  process.exit(2);
}

async function list(prefix: string): Promise<StorageObject[]> {
  const out: StorageObject[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`listing ${BUCKET}/${prefix}: ${res.status} ${await res.text()}`);
    const page = (await res.json()) as StorageObject[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** A short, stable content hash: the object's ETag (an MD5 of its bytes) — else its size and date. */
function hashOf(o: StorageObject): string {
  const etag = (o.metadata?.eTag ?? '').replace(/"/g, '');
  if (etag) return etag.slice(0, 10);
  return Buffer.from(`${o.metadata?.size ?? 0}:${o.metadata?.lastModified ?? ''}`)
    .toString('base64url')
    .slice(0, 10);
}

const templates: Record<string, Record<string, { hash: string; bytes?: number }>> = {};
const unknown: string[] = [];
for (const folder of await list('')) {
  if (folder.id !== null) continue; // a file at the top level: not a template's
  if (!TEMPLATE_IDS.includes(folder.name)) {
    unknown.push(folder.name);
    continue;
  }
  const files = (await list(`${folder.name}/`)).filter((f) => f.id !== null && !f.name.startsWith('.'));
  if (!files.length) continue;
  templates[folder.name] = Object.fromEntries(
    files.map((f) => [f.name, { hash: hashOf(f), ...(f.metadata?.size ? { bytes: f.metadata.size } : {}) }]),
  );
}

const manifest = {
  generatedBy:
    'scripts/media-sync.ts — template media present in the Supabase Storage bucket `template-media`',
  templates: Object.fromEntries(Object.entries(templates).sort(([a], [b]) => a.localeCompare(b))),
};
const next = `${JSON.stringify(manifest, null, 2)}\n`;
const current = readFileSync(OUT, 'utf8');
const count = Object.values(templates).reduce((n, files) => n + Object.keys(files).length, 0);
if (unknown.length) console.warn(`folders that are no template id (ignored): ${unknown.join(', ')}`);
if (process.argv.includes('--check')) {
  if (current !== next) {
    console.error(`media-manifest.json is out of date (${count} files in the bucket) — run without --check`);
    process.exit(1);
  }
  console.log(`media-manifest.json matches the bucket (${count} files)`);
} else {
  writeFileSync(OUT, next);
  console.log(`media-manifest.json: ${count} files in ${Object.keys(templates).length} templates`);
}
