/**
 * Host-app API logic (§4 routes: create, autosave, publish, restore, versions, slug, uploads, duplicate,
 * archive) as plain functions over injected dependencies — the route files only parse the request,
 * resolve the signed-in user and send the result. Tested in tests/unit/host-api.test.ts.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeMigrateDocument } from '../contracts/migrate';
import {
  EventTypeSchema,
  HHmmSchema,
  ISODateSchema,
  L10nSchema,
  LocaleSchema,
  SLUG_RE,
  TimezoneSchema,
} from '../contracts/schemas';
import type { L10n, Locale } from '../contracts/types';
import { validateDocument } from '../contracts/validate';
import { findFontPair } from '../fonts/library';
import { graphemes } from '../lib/text';
import { followUpDocument, followUpSlug, saveTheDateSlug } from '../templates/follow-up';
import { COUPLE_EVENTS } from '../templates/seed-copy';
import type { TemplateEntry } from '../templates/registry';
import { seedDocument } from '../templates/seed-document';
import { isPremiumTemplate } from '../templates/tier';

export { isPremiumTemplate };
import type { HostDb } from './host-db';
import { NOTIFY_MODES } from '../lib/responses';

export type ApiResult<T = unknown> = { status: number; body: T };
const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

/** What the signed-in host's plan allows right now (features/billing/plans.ts). */
export interface Entitlements {
  /** invitations that may be active at once; null = unlimited */
  activeInvitations: number | null;
  /** active now (not archived; a save-the-date's full invitation doesn't count) */
  used: number;
  premiumTemplates: boolean;
  /** the "made with" credit may be turned off */
  removeBranding: boolean;
}

export interface HostDeps {
  db: HostDb;
  template(id: string): TemplateEntry | undefined;
  /** refreshes the cached public page /i/<slug> (all languages) */
  revalidate(slug: string): void;
  now(): number;
  /** the host's plan limits (absent: nothing is limited) */
  entitlements?(): Promise<Entitlements>;
}

/** 402 when the plan has no room for one more active invitation. */
async function noRoom(deps: HostDeps): Promise<ApiResult | null> {
  const e = await deps.entitlements?.();
  if (e && e.activeInvitations !== null && e.used >= e.activeInvitations)
    return fail(402, 'plan_limit', { limit: e.activeInvitations });
  return null;
}

/**
 * The database's own check refused one more active invitation — two made at the same moment (it counts
 * under a lock per owner; the check above can't see the other one): the same 402. Anything else is
 * thrown on.
 */
async function refusedOverLimit(err: unknown, deps: HostDeps): Promise<ApiResult> {
  const { code, message } = (err ?? {}) as { code?: string; message?: string };
  if (code !== 'P0001' || !/\bplan_limit\b/.test(message ?? '')) throw err;
  const e = await deps.entitlements?.().catch(() => undefined);
  return fail(402, 'plan_limit', { limit: e?.activeInvitations ?? null });
}

// ─── create (wizard) ─────────────────────────────────────────────────────────────────────────────

export const CreateInvitationSchema = z.strictObject({
  templateId: z.string().min(1),
  eventType: EventTypeSchema,
  locales: z.array(LocaleSchema).min(1).max(2),
  defaultLocale: LocaleSchema,
  hosts: z.strictObject({
    primary: L10nSchema,
    secondary: L10nSchema.nullable().optional(),
    parents: L10nSchema.nullable().optional(),
  }),
  /** birthday: shown with the name on a ticket-style cover ("DANA 30") */
  age: z.number().int().min(1).max(120).nullable().optional(),
  /** chosen in the gallery's preview dialog */
  paletteId: z.string().min(1).nullable().optional(),
  fontPairId: z.string().min(1).nullable().optional(),
  date: ISODateSchema,
  startTime: HHmmSchema,
  endTime: HHmmSchema.nullable().optional(),
  timezone: TimezoneSchema,
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

const filled = (value: L10n | null | undefined, locales: readonly Locale[]) =>
  !!value && locales.every((l) => !!value[l]?.trim());
const trimmed = (value: L10n | null | undefined): L10n | null => {
  if (!value) return null;
  const out: L10n = {};
  for (const [k, v] of Object.entries(value)) if (v?.trim()) out[k as Locale] = v.trim().slice(0, 40);
  return Object.keys(out).length ? out : null;
};

export async function createInvitation(userId: string, raw: unknown, deps: HostDeps): Promise<ApiResult> {
  const parsed = CreateInvitationSchema.safeParse(raw);
  if (!parsed.success)
    return fail(400, 'invalid', { issues: parsed.error.issues.map((i) => i.path.join('.')) });
  const input = parsed.data;
  const entry = deps.template(input.templateId);
  if (!entry) return fail(400, 'invalid', { issues: ['templateId'] });
  const { manifest, defaults } = entry;
  const locales = [...new Set(input.locales)];
  const bad: string[] = [];
  if (!manifest.categories.includes(input.eventType)) bad.push('eventType');
  if (!locales.every((l) => manifest.supportsLocales.includes(l))) bad.push('locales');
  if (!locales.includes(input.defaultLocale)) bad.push('defaultLocale');
  if (!filled(input.hosts.primary, locales)) bad.push('hosts.primary');
  const couple = COUPLE_EVENTS.includes(input.eventType);
  if (couple && !filled(input.hosts.secondary, locales)) bad.push('hosts.secondary');
  const preset = input.paletteId ? manifest.palettePresets.find((p) => p.id === input.paletteId) : null;
  if (input.paletteId && !preset) bad.push('paletteId');
  if (input.fontPairId && !findFontPair(manifest, input.fontPairId)) bad.push('fontPairId');
  if (bad.length) return fail(400, 'invalid', { issues: bad });
  const limited = await noRoom(deps);
  if (limited) return limited;

  const doc = seedDocument(manifest, defaults, {
    eventType: input.eventType,
    locales,
    defaultLocale: input.defaultLocale,
    hosts: {
      primary: trimmed(input.hosts.primary)!,
      secondary: couple ? trimmed(input.hosts.secondary) : null,
      parents: trimmed(input.hosts.parents),
    },
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime ?? null,
    timezone: input.timezone,
  });
  if (preset) {
    const editable = new Set<string>(manifest.tokens.editablePaletteKeys);
    doc.theme.palette = Object.fromEntries(Object.entries(preset.palette).filter(([k]) => editable.has(k)));
  }
  if (input.fontPairId) doc.theme.fontPairId = input.fontPairId;
  // Birthday age on the cover: a seal that fits it shows "30"; a ticket shows "DANA 30" / "דנה 30".
  const age = input.eventType === 'birthday' && input.age ? String(input.age) : null;
  if (
    age &&
    manifest.cover.overlay.kind !== 'ticket_text' &&
    age.length <= manifest.cover.overlay.text.maxGlyphs
  ) {
    doc.cover.monogram = Object.fromEntries(locales.map((l) => [l, age]));
  } else if (age && manifest.cover.overlay.kind === 'ticket_text') {
    const max = manifest.cover.overlay.text.maxGlyphs;
    doc.cover.monogram = Object.fromEntries(
      locales.map((l) => {
        const suffix = ` ${age}`;
        const name = graphemes((doc.hosts.primary[l] ?? '').toLocaleUpperCase(l))
          .slice(0, Math.max(1, max - suffix.length))
          .join('');
        return [l, `${name.trim()}${suffix}`];
      }),
    );
  }
  // No usable name for a slug ('invitation-new': emoji, other scripts…) → a random one.
  const base = usableSlug(doc.share.slug) ?? randomSlug();
  // a save-the-date leaves the plain slug to the full invitation that follows it
  const slug = input.eventType === 'save_the_date' ? saveTheDateSlug(base) : base;
  let created: { id: string; slug: string };
  try {
    created = await deps.db.create(userId, manifest.id, input.eventType, slug, {
      ...doc,
      share: { ...doc.share, slug },
    });
  } catch (err) {
    return refusedOverLimit(err, deps);
  }
  return ok({ ok: true, id: created.id, slug: created.slug }, 201);
}

const usableSlug = (slug: string | null) =>
  slug && SLUG_RE.test(slug) && slug !== 'invitation-new' ? slug : null;
const randomSlug = () => `invite-${randomBytes(3).toString('hex')}`;

// ─── save-the-date → the full invitation ─────────────────────────────────────────────────────────

export const FollowUpSchema = z.strictObject({ eventType: EventTypeSchema });

/**
 * POST /api/invitations/:id/follow-up — the full invitation for a save-the-date: a new draft in the
 * same template for `eventType`, with the save-the-date's names, date, design and cover
 * (`followUpDocument`). The save-the-date itself and its link stay as they are.
 */
export async function createFollowUp(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostDeps,
): Promise<ApiResult> {
  const parsed = FollowUpSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid', { issues: ['eventType'] });
  const source = await deps.db.get(id, userId);
  if (!source) return fail(404, 'not_found');
  if (source.eventType !== 'save_the_date') return fail(409, 'not_save_the_date');
  const entry = deps.template(source.templateId);
  const { eventType } = parsed.data;
  if (!entry) return fail(400, 'invalid', { issues: ['templateId'] });
  if (eventType === 'save_the_date' || !entry.manifest.categories.includes(eventType))
    return fail(400, 'invalid', { issues: ['eventType'] });
  const doc = followUpDocument(entry.manifest, entry.defaults, source.draft, eventType);
  // "noa-and-itay-save-the-date" → "noa-and-itay"; otherwise from the names (the RPC makes it unique)
  const slug = usableSlug(followUpSlug(source.slug)) ?? usableSlug(doc.share.slug) ?? randomSlug();
  const created = await deps.db.create(
    userId,
    entry.manifest.id,
    eventType,
    slug,
    { ...doc, share: { ...doc.share, slug } },
    source.id,
  );
  return ok({ ok: true, id: created.id, slug: created.slug }, 201);
}

// ─── autosave ────────────────────────────────────────────────────────────────────────────────────

export const SaveDraftSchema = z.strictObject({ draft: z.unknown(), updatedAt: z.string().min(1) });

export async function saveDraft(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostDeps,
): Promise<ApiResult> {
  const parsed = SaveDraftSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  // any known schema version (an editor still open on the previous release saves v1): stored as the latest
  const draft = safeMigrateDocument(parsed.data.draft);
  if (!draft.success) return fail(422, 'invalid', { issues: draft.issues.slice(0, 20).map((i) => i.path) });
  const result = await deps.db.saveDraft(id, userId, draft.data, parsed.data.updatedAt);
  if (!result) return fail(404, 'not_found');
  if (!result.ok) return fail(409, 'conflict', { updatedAt: result.updatedAt, draft: result.draft });
  return ok({ ok: true, updatedAt: result.updatedAt });
}

// ─── slug ────────────────────────────────────────────────────────────────────────────────────────

export async function checkSlug(slug: string, id: string | null, deps: HostDeps): Promise<ApiResult> {
  if (!SLUG_RE.test(slug)) return ok({ ok: true, valid: false, available: false });
  return ok({ ok: true, valid: true, available: await deps.db.slugAvailable(slug, id) });
}

// ─── publish ─────────────────────────────────────────────────────────────────────────────────────

export const PublishSchema = z.strictObject({ slug: z.string().optional() });

export async function publish(userId: string, id: string, raw: unknown, deps: HostDeps): Promise<ApiResult> {
  const parsed = PublishSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(400, 'invalid');
  const inv = await deps.db.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  const entry = deps.template(inv.templateId);
  if (!entry) return fail(500, 'template_missing');

  const previousSlug = inv.status === 'published' ? inv.slug : null;
  const slug = parsed.data.slug?.trim() || inv.slug;
  const draft = { ...inv.draft, share: { ...inv.draft.share, slug } };
  // Validate first, so a failed publish never leaves a half-applied slug change behind.
  // (share.slug is checked here too — the schema's slug format rule.)
  const { errors, warnings } = validateDocument(draft, entry.manifest, { mode: 'publish', now: deps.now() });
  if (errors.length) return fail(422, 'invalid', { issues: errors, warnings });
  if (deps.entitlements) {
    const e = await deps.entitlements();
    if (isPremiumTemplate(entry.manifest) && !e.premiumTemplates) return fail(402, 'premium_template');
    const creditOff = draft.sections.some((s) => s.type === 'footer' && s.enabled && !s.data.showCredit);
    if (creditOff && !e.removeBranding) return fail(402, 'branding');
  }
  if (slug !== inv.slug) {
    const res = await deps.db.setSlug(id, userId, slug);
    if (!res) return fail(404, 'not_found');
    if (!res.ok) return fail(409, res.code === 'taken' ? 'slug_taken' : 'slug_invalid');
  }
  const published = await deps.db.publish(id, userId);
  if (!published) return fail(404, 'not_found');
  deps.revalidate(published.slug);
  if (previousSlug && previousSlug !== published.slug) deps.revalidate(previousSlug);
  // the save-the-date it was created from links here now (and follows a new slug)
  if (inv.sourceSlug) deps.revalidate(inv.sourceSlug);
  return ok({ ok: true, ...published, warnings });
}

// ─── versions / restore ──────────────────────────────────────────────────────────────────────────

export async function listVersions(userId: string, id: string, deps: HostDeps): Promise<ApiResult> {
  const inv = await deps.db.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  return ok({ ok: true, versions: await deps.db.versions(id, userId) });
}

export async function getVersion(
  userId: string,
  id: string,
  version: number,
  deps: HostDeps,
): Promise<ApiResult> {
  if (!Number.isInteger(version) || version < 1) return fail(400, 'invalid');
  const doc = await deps.db.version(id, userId, version);
  return doc ? ok({ ok: true, version, document: doc }) : fail(404, 'not_found');
}

export async function restoreVersion(
  userId: string,
  id: string,
  version: number,
  deps: HostDeps,
): Promise<ApiResult> {
  if (!Number.isInteger(version) || version < 1) return fail(400, 'invalid');
  const restored = await deps.db.restore(id, userId, version);
  if (!restored) return fail(404, 'not_found');
  const inv = await deps.db.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  return ok({ ok: true, draft: inv.draft, updatedAt: inv.updatedAt });
}

// ─── duplicate / archive ─────────────────────────────────────────────────────────────────────────

export async function duplicate(userId: string, id: string, deps: HostDeps): Promise<ApiResult> {
  const limited = await noRoom(deps);
  if (limited) return limited;
  let copy: { id: string; slug: string } | null;
  try {
    copy = await deps.db.duplicate(id, userId);
  } catch (err) {
    return refusedOverLimit(err, deps);
  }
  return copy ? ok({ ok: true, ...copy }, 201) : fail(404, 'not_found');
}

export const ArchiveSchema = z.strictObject({ archived: z.boolean() });

export async function setArchived(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostDeps,
): Promise<ApiResult> {
  const parsed = ArchiveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  if (!parsed.data.archived) {
    // back from the archive: it counts again
    const inv = await deps.db.get(id, userId);
    if (inv?.status === 'archived' && !inv.sourceSlug) {
      const limited = await noRoom(deps);
      if (limited) return limited;
    }
  }
  let res: Awaited<ReturnType<HostDeps['db']['setArchived']>>;
  try {
    res = await deps.db.setArchived(id, userId, parsed.data.archived);
  } catch (err) {
    return refusedOverLimit(err, deps);
  }
  if (!res) return fail(404, 'not_found');
  deps.revalidate(res.slug);
  // a save-the-date links to its full invitation only while that one is published
  const sourceSlug = (await deps.db.get(id, userId))?.sourceSlug;
  if (sourceSlug) deps.revalidate(sourceSlug);
  return ok({ ok: true, ...res });
}

// ─── responses (§9B.3-G) ─────────────────────────────────────────────────────────────────────────

/** DELETE a guest's reply (and its attendees) from the dashboard. */
export async function deleteResponse(
  userId: string,
  id: string,
  responseId: string,
  deps: HostDeps,
): Promise<ApiResult> {
  if (!(await deps.db.deleteResponse(id, userId, responseId))) return fail(404, 'not_found');
  return ok({ ok: true });
}

const NotifySchema = z.strictObject({ mode: z.enum(NOTIFY_MODES) });

/** How the host hears about replies: every reply, a daily digest, or not at all. */
export async function setNotify(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostDeps,
): Promise<ApiResult> {
  const parsed = NotifySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  if (!(await deps.db.setNotify(id, userId, parsed.data.mode))) return fail(404, 'not_found');
  return ok({ ok: true, mode: parsed.data.mode });
}

// ─── uploads (§4 storage: signed upload URLs, MIME whitelist, size limits) ───────────────────────

export const UPLOAD_LIMITS: Record<string, { kind: 'image' | 'video' | 'audio'; ext: string; max: number }> =
  {
    'image/jpeg': { kind: 'image', ext: 'jpg', max: 8 * 1024 * 1024 },
    'image/png': { kind: 'image', ext: 'png', max: 8 * 1024 * 1024 },
    'image/webp': { kind: 'image', ext: 'webp', max: 8 * 1024 * 1024 },
    'image/avif': { kind: 'image', ext: 'avif', max: 8 * 1024 * 1024 },
    'video/mp4': { kind: 'video', ext: 'mp4', max: 15 * 1024 * 1024 },
    'audio/mpeg': { kind: 'audio', ext: 'mp3', max: 10 * 1024 * 1024 },
  };

export const UploadSchema = z.strictObject({
  contentType: z.string(),
  size: z.number().int().positive(),
});

export async function createUpload(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostDeps,
): Promise<ApiResult> {
  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const limit = UPLOAD_LIMITS[parsed.data.contentType];
  if (!limit) return fail(415, 'unsupported_type');
  if (parsed.data.size > limit.max) return fail(413, 'too_large', { max: limit.max });
  const inv = await deps.db.get(id, userId);
  if (!inv) return fail(404, 'not_found');
  const path = `${userId}/${id}/${randomUUID()}.${limit.ext}`;
  const signed = await deps.db.signedUpload(path);
  return ok({
    ok: true,
    path: signed.path,
    token: signed.token,
    /** PUT the file here (raw body, its content type) */
    url: signed.url,
    ref: `upload:${signed.path}`,
    kind: limit.kind,
  });
}
