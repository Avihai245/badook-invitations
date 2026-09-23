import type { AssetRef, TemplateManifest } from '../contracts/types';
import mediaManifest from '../templates/media-manifest.json';

/**
 * Template media lives in Supabase Storage (public bucket `template-media/<templateId>/<file>`),
 * never in the build (MASTER_PROMPT §1.1 rule 6). `media-manifest.json` is generated from the bucket
 * listing (with a content hash per file for cache-busting); a file missing from it is "not produced
 * yet" and the renderer falls back to placeholders (§5 missing media).
 */
interface MediaEntry {
  hash: string;
  bytes?: number;
}
const MEDIA = (mediaManifest as { templates: Record<string, Record<string, MediaEntry>> }).templates;

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

/** '/templates/<id>/<file>' (manifest path) → public URL, or null when that file hasn't been produced. */
export function templateFileUrl(
  templateId: string,
  path: string | null | undefined,
  bases: AssetBases,
): string | null {
  if (!path || !bases.templateMedia) return null;
  const file = path.split('/').pop() ?? '';
  const entry = MEDIA[templateId]?.[file];
  return entry ? `${bases.templateMedia}/${templateId}/${encodeURIComponent(file)}?v=${entry.hash}` : null;
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
