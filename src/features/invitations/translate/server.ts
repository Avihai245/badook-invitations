import 'server-only';
import { z } from 'zod';
import type { Feature } from '@/features/flags/features';
import { LOCALES, type InvitationDocument, type Locale } from '../contracts/types';
import type { ApiResult } from '../server/host-api';
import { isUuid } from '../server/host-db';
import { translateTexts, type AiConfig, type SourceText } from './ai';
import {
  docPathOf,
  sourceHash,
  sourceLocaleOf,
  textFields,
  translationState,
  valueAt,
  type TranslationRow,
} from './fields';

/**
 * The reviewed machine translation of an invitation (feature translate_ai): "translate into <language>"
 * fills the language's missing texts in one call to the AI model; the editor writes them into the
 * draft and the host approves them (one or all) before the invitation can be published — or changes
 * them, which counts as approved. A change to a source text sends its translation back to review
 * (stale). Names and places are the host's to write; the glossary's words stay as they are. Without an
 * AI model everything but the machine run works: the review screen is where hosts translate by hand.
 */

/** A host's machine runs per day, and the most a run translates. */
export const TRANSLATE_LIMITS = { runsPerDay: 30, maxTexts: 200, maxChars: 40_000 } as const;

export interface TranslationsDb {
  list(id: string, ownerId: string): Promise<{ rows: TranslationRow[]; glossary: string[] } | null>;
  save(id: string, ownerId: string, rows: NewRow[]): Promise<number | null>;
  markStale(id: string, ownerId: string, ids: string[]): Promise<number | null>;
  discard(id: string, ownerId: string, locale: Locale, paths: string[] | null): Promise<number | null>;
  glossary(id: string, ownerId: string, terms: string[]): Promise<string[] | null>;
  runBegin(
    id: string,
    ownerId: string,
    locale: Locale,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean | null>;
}

export interface NewRow {
  locale: Locale;
  path: string;
  sourceLocale: Locale;
  sourceHash: string;
  text: string;
  status: 'auto' | 'approved';
}

export interface TranslateDeps {
  db: TranslationsDb;
  /** the invitation's saved draft, when it is the owner's */
  draft(id: string, ownerId: string): Promise<InvitationDocument | null>;
  features(id: string): Promise<ReadonlySet<Feature>>;
  /** the AI model (null: none set up here) */
  ai: AiConfig | null;
  fetch?: typeof fetch;
}

const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

const LocaleSchema = z.enum(LOCALES);
const TranslateSchema = z.strictObject({
  locale: LocaleSchema,
  /** translate these again (stale ones); absent: the language's missing texts */
  paths: z.array(z.string().min(1).max(200)).max(TRANSLATE_LIMITS.maxTexts).optional(),
});
const ApproveSchema = z.strictObject({
  locale: LocaleSchema,
  paths: z.array(z.string().min(1).max(200)).min(1).max(500),
});
const GlossarySchema = z.strictObject({
  terms: z.array(z.string().max(80)).max(100),
});

const trimmed = (v: string | undefined) => (v ?? '').trim();

/**
 * GET — the invitation's translations and glossary, and whether the machine translation is on. Rows
 * whose source changed are marked stale here; rows of a language or a text no longer in the draft
 * are dropped.
 */
export async function listTranslations(userId: string, id: string, deps: TranslateDeps): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const [doc, stored] = await Promise.all([deps.draft(id, userId), deps.db.list(id, userId)]);
  if (!doc || !stored) return fail(404, 'not_found');
  const stale: string[] = [];
  const gone = new Map<Locale, string[]>();
  const rows: TranslationRow[] = [];
  for (const row of stored.rows) {
    const state = translationState(doc, row);
    if (state === 'gone' && (!doc.locales.includes(row.locale) || !valueAt(doc, row.path))) {
      gone.set(row.locale, [...(gone.get(row.locale) ?? []), row.path]);
      continue;
    }
    if (state === 'stale' && row.status !== 'stale') {
      stale.push(row.id);
      rows.push({ ...row, status: 'stale' });
    } else rows.push(row);
  }
  if (stale.length) await deps.db.markStale(id, userId, stale);
  for (const [locale, paths] of gone) await deps.db.discard(id, userId, locale, paths);
  const features = await deps.features(id);
  return ok({
    ok: true,
    rows,
    glossary: stored.glossary,
    translate: features.has('translate_ai') && !!deps.ai,
  });
}

/**
 * POST { locale, paths? } — the machine translation of the language's missing texts (or of `paths`)
 * from the saved draft: { texts: [{ path, text }], rows, rejected } — the editor writes the texts into
 * the draft. Names are never sent; the glossary's words stay as they are.
 */
export async function translateLocale(
  userId: string,
  id: string,
  raw: unknown,
  deps: TranslateDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = TranslateSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { locale, paths } = parsed.data;
  const [doc, stored] = await Promise.all([deps.draft(id, userId), deps.db.list(id, userId)]);
  if (!doc || !stored) return fail(404, 'not_found');
  if (!(await deps.features(id)).has('translate_ai') || !deps.ai) return fail(402, 'translate_ai');
  if (!doc.locales.includes(locale) || doc.locales.length < 2) return fail(400, 'locale');

  const wanted = paths ? new Set(paths) : null;
  const sources: (SourceText & { path: string; hash: string })[] = [];
  for (const f of textFields(doc)) {
    if (f.name) continue;
    if (wanted ? !wanted.has(f.path) : trimmed(f.value[locale])) continue;
    const from = sourceLocaleOf(doc, f.value, locale);
    if (!from) continue;
    const text = trimmed(f.value[from]);
    sources.push({
      id: `t${sources.length + 1}`,
      path: f.path,
      from,
      field: f.field,
      text,
      hash: sourceHash(text),
      ...(f.cap ? { max: f.cap } : {}),
    });
  }
  if (!sources.length) return ok({ ok: true, locale, texts: [], rows: [], rejected: [] });
  const chars = sources.reduce((n, s) => n + s.text.length, 0);
  if (sources.length > TRANSLATE_LIMITS.maxTexts || chars > TRANSLATE_LIMITS.maxChars)
    return fail(413, 'too_much');
  const allowed = await deps.db.runBegin(id, userId, locale, TRANSLATE_LIMITS.runsPerDay, 24 * 3600);
  if (allowed === null) return fail(404, 'not_found');
  if (!allowed) return fail(429, 'rate_limited', { limit: TRANSLATE_LIMITS.runsPerDay });

  // the names as the invitation writes them, in every language: the model keeps them
  const names = textFields(doc)
    .filter((f) => f.name)
    .flatMap((f) => doc.locales.map((l) => trimmed(f.value[l])))
    .filter(Boolean);
  const result = await translateTexts(
    { to: locale, eventType: doc.eventType, texts: sources, glossary: stored.glossary, names },
    deps.ai,
    deps.fetch,
  );
  if (result.status !== 'ok')
    return fail(502, result.status === 'refused' ? 'translation_refused' : 'translation_failed');

  const rows: NewRow[] = [];
  const texts: { path: string; text: string }[] = [];
  for (const s of sources) {
    const text = result.texts.get(s.id);
    if (!text) continue;
    rows.push({ locale, path: s.path, sourceLocale: s.from, sourceHash: s.hash, text, status: 'auto' });
    texts.push({ path: s.path, text });
  }
  if (rows.length) await deps.db.save(id, userId, rows);
  const saved = (await deps.db.list(id, userId))?.rows.filter((r) => r.locale === locale) ?? [];
  return ok({
    ok: true,
    locale,
    texts,
    rows: saved,
    rejected: sources.filter((s) => result.rejected.includes(s.id)).map((s) => s.path),
  });
}

/**
 * PATCH { locale, paths } — the host approves the machine's texts as the saved draft has them now
 * (the editor saves first): each is recorded with the source it was approved against, so a later
 * change to the source sends it back to review.
 */
export async function approveTranslations(
  userId: string,
  id: string,
  raw: unknown,
  deps: TranslateDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = ApproveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const { locale, paths } = parsed.data;
  const [doc, stored] = await Promise.all([deps.draft(id, userId), deps.db.list(id, userId)]);
  if (!doc || !stored) return fail(404, 'not_found');
  const rows: NewRow[] = [];
  for (const row of stored.rows) {
    if (row.locale !== locale || !paths.includes(row.path)) continue;
    const value = valueAt(doc, row.path);
    const text = trimmed(value?.[locale]);
    const source = trimmed(value?.[row.sourceLocale]);
    if (!value || !text || docPathOf(doc, row.path) === null) continue;
    rows.push({
      locale,
      path: row.path,
      sourceLocale: row.sourceLocale,
      sourceHash: sourceHash(source),
      text,
      status: 'approved',
    });
  }
  if (rows.length) await deps.db.save(id, userId, rows);
  const saved = (await deps.db.list(id, userId))?.rows ?? [];
  return ok({ ok: true, approved: rows.length, rows: saved });
}

/** PUT { terms } — the invitation's glossary: words every translation keeps as they are. */
export async function saveGlossary(
  userId: string,
  id: string,
  raw: unknown,
  deps: TranslateDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return fail(404, 'not_found');
  const parsed = GlossarySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const terms = await deps.db.glossary(id, userId, parsed.data.terms);
  if (!terms) return fail(404, 'not_found');
  return ok({ ok: true, glossary: terms });
}
