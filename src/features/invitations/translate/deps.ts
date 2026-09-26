import 'server-only';
import { featuresFor } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import { serviceDb } from '@/lib/supabase/server';
import type { Locale } from '../contracts/types';
import type { HostDeps } from '../server/host-api';
import { hostDb } from '../server/host-db';
import type { TranslationRow } from './fields';
import type { NewRow, TranslateDeps, TranslationsDb } from './server';

/** The translations' database functions (supabase/migrations/*_translations.sql). */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const translationsDb: TranslationsDb = {
  list: (id, ownerId) =>
    rpc<{ rows: TranslationRow[]; glossary: string[] } | null>('translations_list', {
      p_id: id,
      p_owner_id: ownerId,
    }),
  save: (id, ownerId, rows: NewRow[]) =>
    rpc<number | null>('translations_save', { p_id: id, p_owner_id: ownerId, p_rows: rows }),
  markStale: (id, ownerId, ids) =>
    rpc<number | null>('translations_mark_stale', { p_id: id, p_owner_id: ownerId, p_ids: ids }),
  discard: (id, ownerId, locale: Locale, paths) =>
    rpc<number | null>('translations_discard', {
      p_id: id,
      p_owner_id: ownerId,
      p_locale: locale,
      p_paths: paths,
    }),
  glossary: (id, ownerId, terms) =>
    rpc<string[] | null>('translation_glossary_set', { p_id: id, p_owner_id: ownerId, p_terms: terms }),
  runBegin: (id, ownerId, locale, limit, windowSeconds) =>
    rpc<boolean | null>('translation_run_begin', {
      p_id: id,
      p_owner_id: ownerId,
      p_locale: locale,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
};

/**
 * What the privacy policy promises about the machine translation's run records (part of the daily
 * run, features/jobs): erased two days after the run.
 */
export const translationHousekeeping = () => rpc<number>('translation_runs_purge', {});

/** The translations of an invitation, for the publish check (host-api publish). */
export async function translationRows(id: string, ownerId: string): Promise<TranslationRow[]> {
  return (await translationsDb.list(id, ownerId))?.rows ?? [];
}

/** The AI model set up here (ANTHROPIC_API_KEY + INVITES_AI_MODEL), or null. */
export function translateAi() {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY || !env.INVITES_AI_MODEL) return null;
  return { apiKey: env.ANTHROPIC_API_KEY, model: env.INVITES_AI_MODEL, apiBase: env.INVITES_AI_API_BASE };
}

/** A request's dependencies: its host deps' features (read once per request), the saved draft, the model. */
export function translateDeps(host: Pick<HostDeps, 'features'>): TranslateDeps {
  return {
    db: translationsDb,
    draft: async (id, ownerId) => (await hostDb.get(id, ownerId))?.draft ?? null,
    features: (id) => (host.features ? host.features(id) : featuresFor(id)),
    ai: translateAi(),
  };
}
