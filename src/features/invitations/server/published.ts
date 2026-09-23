import 'server-only';
import { cache } from 'react';
import { publicDb } from '@/lib/supabase/server';
import { migrateDocument } from '../contracts/migrate';
import { SLUG_RE } from '../contracts/schemas';
import { LOCALES, type InvitationDocument, type Locale } from '../contracts/types';
import { getTemplate, type TemplateEntry } from '../templates/registry';

export interface PublishedInvitation {
  id: string;
  slug: string;
  doc: InvitationDocument;
  entry: TemplateEntry;
}

/**
 * The published document of `slug` through the public RPC (§4: never the draft or the owner), migrated
 * to the current schema and validated. null when unknown, unpublished or unreadable. Cached per request.
 */
export const getPublishedInvitation = cache(async (slug: string): Promise<PublishedInvitation | null> => {
  if (!SLUG_RE.test(slug)) return null;
  const { data, error } = await publicDb().rpc('get_published_invitation', { p_slug: slug });
  if (error) throw new Error(`get_published_invitation(${slug}) failed: ${error.message}`);
  if (!data) return null;
  let doc: InvitationDocument;
  try {
    doc = migrateDocument((data as { document: unknown }).document);
  } catch (err) {
    console.error(`published document of "${slug}" is invalid`, err);
    return null;
  }
  const entry = getTemplate(doc.templateId);
  if (!entry) return null;
  return { id: (data as { id: string }).id, slug, doc, entry };
});

/**
 * The locale to render for the path's `lang`: that locale when the document has it; `default` (no
 * ?lang) or a locale the document doesn't have → its default locale; anything else → null (404).
 */
export function resolveLocale(doc: InvitationDocument, lang: string): Locale | null {
  if (lang === 'default') return doc.defaultLocale;
  if (!(LOCALES as readonly string[]).includes(lang)) return null;
  return doc.locales.includes(lang as Locale) ? (lang as Locale) : doc.defaultLocale;
}
