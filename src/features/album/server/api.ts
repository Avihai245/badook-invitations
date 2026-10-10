import 'server-only';
import { z } from 'zod';
import {
  packageFor,
  planForPackage,
  whyOff,
  type Feature,
  type FeatureInput,
} from '@/features/flags/features';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import { LOCALES, type InvitationDocument, type Locale } from '@/features/invitations/contracts/types';
import { hostsLine } from '@/features/invitations/lib/text';
import { BUCKETS, type GalleryStorage } from '@/features/live-gallery/server/storage';
import { TOKEN_RE, linkToken, newLink, rateKey, sha256Hex } from '@/features/live-gallery/server/tokens';
import { ALBUM } from '../config';
import {
  albumChapters,
  albumOpensAt,
  albumState,
  pickCover,
  pickHighlights,
  timelineOf,
  type AlbumEntry,
  type AlbumState,
} from '../model';
import { albumEventPhrase } from '../phrases';
import type {
  AlbumEvent,
  AlbumFeatureState,
  AlbumLayout,
  AlbumPageData,
  AlbumPhoto,
  HostAlbumView,
  StudioItem,
} from '../types';
import type { AlbumDb, AlbumItemRow, AlbumSettings, OwnerAlbum } from './db';

/**
 * The album's server side as plain functions over injected dependencies (the route files wire Supabase
 * in; tests in tests/unit/album-api.test.ts): the hosts' view — the album made with its link as soon as
 * the gallery exists and the event has the feature — their settings, a new link and their studio's
 * items; the guests' page behind the link (the morning after, or when the hosts opened it) with
 * short-lived signed URLs, and fresh URLs for a page left open. Every host call checks the owner (the
 * database functions do too).
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface AlbumDesign {
  palette: AlbumEvent['palette'];
  fonts: AlbumEvent['fonts'];
  /** the @font-face rules for those fonts */
  fontCss?: string;
}

export interface AlbumDeps {
  db: Pick<
    AlbumDb,
    | 'ownerGet'
    | 'ownerEnsure'
    | 'ownerUpdate'
    | 'ownerRotate'
    | 'ownerItems'
    | 'items'
    | 'byToken'
    | 'rateHit'
  >;
  storage: Pick<GalleryStorage, 'signRead'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** what the event may use (guests' pages) */
  features(invitationId: string): Promise<Set<Feature>>;
  qr(url: string): Promise<{ svg: string; png: string }>;
  /** the design's palette and fonts for a document (null: its template is gone) */
  design(doc: InvitationDocument): AlbumDesign | null;
  /** the invitation's cached page links to the album after the event (its gallery section) */
  revalidateInvitation?(slug: string): void;
  now(): number;
  brand: string;
}

// ─── shared ─────────────────────────────────────────────────────────────────────────────────────

function featureState(input: FeatureInput): AlbumFeatureState {
  const why = whyOff('album', input);
  const pkg = packageFor('album');
  return { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
}

const docOf = (raw: unknown): InvitationDocument | null => {
  const r = safeMigrateDocument(raw);
  return r.success ? r.data : null;
};

/** The hosts' words per language, only the invitation's languages, empty ones left out. */
function words(
  raw: Record<string, string> | null,
  locales: readonly Locale[],
): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  for (const l of locales) {
    const v = raw?.[l]?.trim();
    if (v) out[l] = v;
  }
  return out;
}

function eventOf(
  doc: InvitationDocument,
): Pick<AlbumEvent, 'eventType' | 'date' | 'timezone' | 'locales' | 'defaultLocale' | 'names' | 'phrase'> {
  const locales = doc.locales.length ? [...doc.locales] : [doc.defaultLocale];
  const names: Partial<Record<Locale, string>> = {};
  const phrase: Partial<Record<Locale, string>> = {};
  for (const l of locales) {
    const line = hostsLine(doc.hosts, l);
    if (line) names[l] = line;
    phrase[l] = albumEventPhrase(doc, l);
  }
  return {
    eventType: doc.eventType,
    date: doc.event.date,
    timezone: doc.timezone,
    locales,
    defaultLocale: locales.includes(doc.defaultLocale) ? doc.defaultLocale : locales[0]!,
    names,
    phrase,
  };
}

const entryOf = (r: AlbumItemRow): AlbumEntry => ({
  id: r.id,
  kind: r.kind,
  width: r.width,
  height: r.height,
  durationMs: r.durationMs,
  at: r.takenAt ?? r.publishedAt ?? r.createdAt,
  sharpness: r.sharpness,
  brightness: r.brightness,
  aiQuality: r.aiQuality,
  phash: r.phash,
});

async function sign(rows: readonly AlbumItemRow[], deps: Pick<AlbumDeps, 'storage' | 'now'>) {
  const ttl = ALBUM.urls.signedTtlSeconds;
  const media = rows.flatMap((r) => [r.thumbPath, r.displayPath]).filter((p): p is string => !!p);
  const videos = rows.filter((r) => r.kind === 'video').map((r) => r.originalPath);
  const [m, v] = await Promise.all([
    media.length ? deps.storage.signRead(BUCKETS.media, media, ttl) : new Map<string, string>(),
    videos.length ? deps.storage.signRead(BUCKETS.originals, videos, ttl) : new Map<string, string>(),
  ]);
  const photos: AlbumPhoto[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    thumb: r.thumbPath ? (m.get(r.thumbPath) ?? null) : null,
    display: r.displayPath ? (m.get(r.displayPath) ?? null) : null,
    video: r.kind === 'video' ? (v.get(r.originalPath) ?? null) : null,
    width: r.width,
    height: r.height,
    durationMs: r.durationMs,
    at: r.takenAt ?? r.publishedAt ?? r.createdAt,
    name: r.name,
    ...(r.ai ? { ai: true } : {}),
  }));
  return { photos: photos.filter((p) => p.display || p.video), expiresAt: deps.now() + ttl * 1000 };
}

/** The album's layout: its cover, its best moments and its chapters. */
export function albumLayout(
  rows: readonly AlbumItemRow[],
  doc: InvitationDocument,
  settings: Pick<AlbumSettings, 'coverItemId' | 'chapters'>,
): AlbumLayout {
  const entries = rows.map(entryOf);
  const cover = pickCover(entries, settings.coverItemId);
  return {
    cover,
    highlights: pickHighlights(entries, cover),
    chapters: albumChapters(entries, {
      on: settings.chapters,
      timeline: timelineOf(doc),
      date: doc.event.date,
      timeZone: doc.timezone,
    }),
  };
}

// ─── the hosts ──────────────────────────────────────────────────────────────────────────────────

async function ownerGate(userId: string, id: string, deps: Pick<AlbumDeps, 'featureInput'>) {
  if (!isUuid(id)) return null;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return null;
  return input;
}

async function viewOf(
  id: string,
  owned: OwnerAlbum,
  feature: AlbumFeatureState,
  base: string,
  deps: Pick<AlbumDeps, 'qr' | 'now'>,
): Promise<HostAlbumView | null> {
  const doc = docOf(owned.document);
  if (!doc) return null;
  const event = eventOf(doc);
  const a = owned.album;
  let album: HostAlbumView['album'] = null;
  if (a) {
    const token = linkToken('album', id, a.tokenNonce, a.tokenHash);
    const url = token ? `${base}/e/${owned.slug}/album?a=${token}` : null;
    const opensAt = albumOpensAt(a.opensAt, doc);
    album = {
      enabled: a.enabled,
      state: albumState({
        feature: feature.on,
        enabled: a.enabled,
        galleryEnabled: owned.gallery?.enabled ?? false,
        opensAt,
        now: deps.now(),
      }),
      opensAt: opensAt?.toISOString() ?? null,
      custom: !!a.opensAt,
      title: words(a.title, event.locales),
      message: words(a.message, event.locales),
      coverItemId: a.coverItemId,
      hiddenItems: a.hiddenItems ?? [],
      showVideos: a.showVideos,
      chapters: a.chapters,
      url,
      qr: url ? await deps.qr(url) : null,
    };
  }
  return {
    id,
    slug: owned.slug,
    feature,
    gallery: !!owned.gallery,
    album,
    counts: owned.counts,
    event: {
      eventType: event.eventType,
      date: event.date,
      locales: event.locales,
      defaultLocale: event.defaultLocale,
      names: event.names,
      phrase: event.phrase,
    },
  };
}

/**
 * The hosts' view of the album (null when the invitation isn't theirs). The album is made — with its
 * link — the first time it is asked for once the gallery exists and the event has the feature.
 */
export async function albumHostView(
  userId: string,
  id: string,
  base: string,
  deps: AlbumDeps,
): Promise<HostAlbumView | null> {
  const input = await ownerGate(userId, id, deps);
  if (!input) return null;
  const feature = featureState(input);
  let owned = await deps.db.ownerGet(id, userId);
  if (!owned) return null;
  if (!owned.album && owned.gallery && feature.on) {
    const link = newLink('album', id);
    owned = (await deps.db.ownerEnsure(id, userId, link.hash, link.nonce)) ?? owned;
  }
  return viewOf(id, owned, feature, base, deps);
}

/** GET /api/invitations/:id/album */
export async function getAlbum(
  userId: string,
  id: string,
  base: string,
  deps: AlbumDeps,
): Promise<ApiResult> {
  const view = await albumHostView(userId, id, base, deps);
  return view ? ok({ view }) : notFound;
}

const Words = (max: number) =>
  z
    .partialRecord(z.enum(LOCALES), z.string().max(max))
    .nullable()
    .transform((o) => {
      if (!o) return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) {
        const t = v?.trim();
        if (t) out[k] = t;
      }
      return Object.keys(out).length ? out : null;
    });

export const AlbumPatchSchema = z
  .strictObject({
    enabled: z.boolean().optional(),
    /** null: the morning after; a moment: from then on (now: open it) */
    opensAt: z.iso.datetime({ offset: true }).nullable().optional(),
    title: Words(ALBUM.text.title).optional(),
    message: Words(ALBUM.text.message).optional(),
    coverItemId: z.uuid().nullable().optional(),
    hiddenItems: z.array(z.uuid()).max(ALBUM.maxItems).optional(),
    showVideos: z.boolean().optional(),
    chapters: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0);

/** PATCH /api/invitations/:id/album — the hosts' settings (only what is sent changes). */
export async function updateAlbum(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: AlbumDeps,
): Promise<ApiResult> {
  const parsed = AlbumPatchSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const input = await ownerGate(userId, id, deps);
  if (!input) return notFound;
  const feature = featureState(input);
  if (!feature.on)
    return fail(403, 'feature_off', { feature: 'album', reason: feature.why, package: feature.package });
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) patch[key] = value;
  const before = await deps.db.ownerGet(id, userId);
  if (!before?.album) return fail(409, 'no_album');
  const owned = await deps.db.ownerUpdate(id, userId, patch);
  if (!owned) return notFound;
  if ('enabled' in patch || 'opensAt' in patch) deps.revalidateInvitation?.(owned.slug);
  const view = await viewOf(id, owned, feature, base, deps);
  return view ? ok({ view }) : notFound;
}

/** POST /api/invitations/:id/album/rotate — a new link; the old one stops at once. */
export async function rotateAlbum(
  userId: string,
  id: string,
  base: string,
  deps: AlbumDeps,
): Promise<ApiResult> {
  const input = await ownerGate(userId, id, deps);
  if (!input) return notFound;
  const link = newLink('album', id);
  const owned = await deps.db.ownerRotate(id, userId, link.hash, link.nonce);
  if (!owned) return notFound;
  deps.revalidateInvitation?.(owned.slug);
  const view = await viewOf(id, owned, featureState(input), base, deps);
  return view ? ok({ view }) : notFound;
}

/**
 * GET /api/invitations/:id/album/items — the studio: every published photo and video with whether it
 * is left out, and the layout as the album would make it now (its cover, best moments, chapters).
 */
export async function albumStudio(userId: string, id: string, deps: AlbumDeps): Promise<ApiResult> {
  const input = await ownerGate(userId, id, deps);
  if (!input) return notFound;
  const [owned, rows] = await Promise.all([
    deps.db.ownerGet(id, userId),
    deps.db.ownerItems(id, userId, ALBUM.maxItems),
  ]);
  if (!owned?.album || !rows) return notFound;
  const doc = docOf(owned.document);
  if (!doc) return notFound;
  const { photos, expiresAt } = await sign(rows, deps);
  const hidden = new Set(rows.filter((r) => r.hidden).map((r) => r.id));
  const items: StudioItem[] = photos.map((p) => ({ ...p, hidden: hidden.has(p.id) }));
  const shown = rows.filter((r) => !r.hidden && (owned.album!.showVideos || r.kind === 'image'));
  return ok({ items, layout: albumLayout(shown, doc, owned.album), expiresAt });
}

// ─── guests ─────────────────────────────────────────────────────────────────────────────────────

interface Resolved {
  invitationId: string;
  slug: string;
  doc: InvitationDocument;
  settings: AlbumSettings;
  state: AlbumState;
  opensAt: Date | null;
}

/** The album behind a link (null: a link that opens nothing). */
export async function resolveAlbum(token: unknown, deps: AlbumDeps): Promise<Resolved | null> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const lookup = await deps.db.byToken(sha256Hex(token));
  if (!lookup) return null;
  const doc = docOf(lookup.invitation.document);
  if (!doc) return null;
  const features = await deps.features(lookup.invitation.id);
  const opensAt = albumOpensAt(lookup.album.opensAt, doc);
  return {
    invitationId: lookup.invitation.id,
    slug: lookup.invitation.slug,
    doc,
    settings: lookup.album,
    opensAt,
    state: albumState({
      feature: features.has('album'),
      enabled: lookup.album.enabled,
      galleryEnabled: lookup.gallery.enabled,
      opensAt,
      now: deps.now(),
    }),
  };
}

/** /e/<slug>/album?a= — the album's first render (null: a link that opens nothing). */
export async function albumPage(token: string, deps: AlbumDeps): Promise<AlbumPageData | null> {
  const r = await resolveAlbum(token, deps);
  if (!r) return null;
  const design = deps.design(r.doc);
  if (!design) return null;
  const event: AlbumEvent = { ...eventOf(r.doc), palette: design.palette, fonts: design.fonts };
  const rows = r.state === 'open' ? await deps.db.items(r.invitationId, ALBUM.maxItems) : [];
  const { photos, expiresAt } = await sign(rows, deps);
  const shown = new Set(photos.map((p) => p.id));
  return {
    slug: r.slug,
    state: r.state,
    opensAt: r.opensAt?.toISOString() ?? null,
    event,
    title: words(r.settings.title, event.locales),
    message: words(r.settings.message, event.locales),
    items: photos,
    layout: albumLayout(
      rows.filter((row) => shown.has(row.id)),
      r.doc,
      r.settings,
    ),
    expiresAt,
    brand: deps.brand,
    fontCss: design.fontCss ?? '',
  };
}

const RefreshSchema = z.strictObject({ a: z.string() });

/** POST /api/gallery/album { a } — fresh URLs for a page left open (the same photos, new links). */
export async function albumRefresh(raw: unknown, ip: string | null, deps: AlbumDeps): Promise<ApiResult> {
  const parsed = RefreshSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const r = await resolveAlbum(parsed.data.a, deps);
  if (!r) return notFound;
  if (r.state !== 'open') return fail(403, r.state, { state: r.state });
  const limit = ALBUM.rate.refreshPerAddress;
  if (
    !(await deps.db.rateHit(
      rateKey('album', `${r.invitationId}:${ip ?? 'unknown'}`),
      limit.count,
      limit.windowSeconds,
    ))
  )
    return fail(429, 'rate');
  const rows = await deps.db.items(r.invitationId, ALBUM.maxItems);
  const { photos, expiresAt } = await sign(rows, deps);
  return ok({ items: photos, expiresAt });
}
