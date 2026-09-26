import type { AssetRef, TemplateManifest } from '../contracts/types';
import mediaManifest from '../templates/media-manifest.json';
import placeholderManifest from '../templates/placeholder-media.json';

/**
 * Template media lives in Supabase Storage (public bucket `template-media/<templateId>/<file>`),
 * never in the build (MASTER_PROMPT §1.1 rule 6). `media-manifest.json` is generated from the bucket
 * listing (with a content hash per file for cache-busting); a file missing from it is "not produced
 * yet" and the renderer falls back to placeholders (§5 missing media).
 *
 * A photographic design needs pictures to be itself: until its real files are in the bucket it may
 * ship small generated placeholders in the build (public/templates/<id>/<file>, listed with a hash in
 * `placeholder-media.json` by scripts/make-template-placeholders.mjs — §1.1: public/templates keeps
 * only placeholders). The bucket's file always wins once media:sync lists it.
 */
interface MediaEntry {
  hash: string;
  bytes?: number;
}
type MediaList = { templates: Record<string, Record<string, MediaEntry>> };
const MEDIA = (mediaManifest as MediaList).templates;
const PLACEHOLDERS = (placeholderManifest as MediaList).templates;

export interface AssetBases {
  /** e.g. https://<ref>.supabase.co/storage/v1/object/public/template-media — '' when not configured */
  templateMedia: string;
  /** e.g. https://<ref>.supabase.co/storage/v1/object/public/invitation-media — '' when not configured */
  uploads: string;
}

export function assetBasesFromEnv(env: { supabaseUrl?: string; templateMediaBaseUrl?: string }): AssetBases {
  const supabase = (env.supabaseUrl ?? '').replace(/\/+$/, '');
  return {
    templateMedia:
      (env.templateMediaBaseUrl ?? '').replace(/\/+$/, '') ||
      (supabase ? `${supabase}/storage/v1/object/public/template-media` : ''),
    uploads: supabase ? `${supabase}/storage/v1/object/public/invitation-media` : '',
  };
}

/**
 * '/templates/<id>/<file>' (manifest path) → public URL: the bucket's file, else a placeholder shipped
 * with the app, else null (not produced yet → the renderer's placeholder art).
 */
export function templateFileUrl(
  templateId: string,
  path: string | null | undefined,
  bases: AssetBases,
): string | null {
  if (!path) return null;
  const file = path.split('/').pop() ?? '';
  const entry = bases.templateMedia ? MEDIA[templateId]?.[file] : undefined;
  if (entry) return `${bases.templateMedia}/${templateId}/${encodeURIComponent(file)}?v=${entry.hash}`;
  const local = PLACEHOLDERS[templateId]?.[file];
  return local ? `/templates/${templateId}/${encodeURIComponent(file)}?v=${local.hash}` : null;
}

/** The template ships a placeholder for this file (and the bucket has no real one yet). */
export function isPlaceholderFile(templateId: string, path: string | null | undefined): boolean {
  const file = path?.split('/').pop() ?? '';
  return !!file && !MEDIA[templateId]?.[file] && !!PLACEHOLDERS[templateId]?.[file];
}

/** §5 resolveAsset: 'template:<key>' | 'upload:<path>' | https URL → URL or null (→ placeholder). */
export function resolveAsset(
  ref: AssetRef | null | undefined,
  template: Pick<TemplateManifest, 'id' | 'assets'>,
  bases: AssetBases,
): string | null {
  if (!ref) return null;
  if (ref.startsWith('template:')) return templateFileUrl(template.id, template.assets[ref.slice(9)], bases);
  if (ref.startsWith('upload:')) return bases.uploads ? `${bases.uploads}/${ref.slice(7)}` : null;
  if (ref.startsWith('https://')) return ref;
  return null;
}

/**
 * A track's URL that starts playing at `startAtSec` (a media fragment, `#t=`): every browser seeks
 * there by itself once the file loads — no `currentTime` before the metadata is in (Safari ignores
 * that), and the file stays one cache entry (the fragment never reaches the server).
 */
export function withStartAt(url: string, startAtSec: number): string {
  const base = url.split('#')[0]!;
  return startAtSec > 0 ? `${base}#t=${Math.round(startAtSec)}` : base;
}
