import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PlanId } from '@/features/billing/plans';
import {
  packageFor,
  planForPackage,
  whyOff,
  type FeatureInput,
  type Package,
} from '@/features/flags/features';
import type { InvitationDocument, Locale, Palette } from '@/features/invitations/contracts/types';
import type { FaceRequest } from '@/features/invitations/fonts';
import { hostsLine } from '@/features/invitations/lib/text';
import { GALLERY, ORIGINAL_TYPES, PREVIEW_TYPES } from '@/features/live-gallery/config';
import type { ApiResult } from '@/features/live-gallery/server/guest-api';
import type { GalleryDb, ItemRow, ReserveItem } from '@/features/live-gallery/server/db';
import type { HintKind } from '@/features/live-gallery/server/realtime';
import { BUCKETS, type Bucket, type GalleryStorage } from '@/features/live-gallery/server/storage';
import type { PartTicket, ReservedItem } from '@/features/live-gallery/types';
import { FILM } from '../config';
import type { Box } from '../select';

/**
 * The highlights film's server side (feature auto_reel) as plain functions over injected
 * dependencies (tests in tests/unit/film-api.test.ts). The film itself is made in the host's browser;
 * the server only hands it the gallery's photos and clips to choose from — what the choice weighs and
 * short-lived signed URLs, never a file through the server — with the invitation's names, date,
 * palette, fonts and song, and then takes the finished film into the gallery as the host's own item:
 * reserved and signed like a guest's upload, checked in storage when it arrives, and shown to guests
 * (the feed and the venue screen) only if the host says so.
 */

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface FilmInvitation {
  slug: string;
  doc: InvitationDocument;
  palette: Palette;
  fonts: FilmFonts;
  /** the invitation's song (null: it has none) */
  musicUrl: string | null;
}

export interface FilmDeps {
  db: Pick<GalleryDb, 'ownerGet' | 'ownerFilm' | 'ownerAdd' | 'ownerAddDone'>;
  storage: GalleryStorage;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** the host's invitation as the film shows it (null: not theirs) */
  invitation(id: string, userId: string): Promise<FilmInvitation | null>;
  broadcast(channel: string, kind: HintKind): Promise<unknown>;
  now(): number;
}

export interface FeatureState {
  on: boolean;
  why: ReturnType<typeof whyOff>;
  package: Package;
  plan: PlanId;
}

/**
 * The cards' fonts, the invitation's own: per card language, a CSS font stack for the names (the
 * display face) and one for the date and the end card's line (the heading face) — the face of that
 * language's script first (a Cyrillic stand-in, the Arabic or Ethiopic face of the design's style
 * where the pair doesn't write it), then the pair's and the other languages' faces (a name in another
 * script keeps a designed face) — and the faces they use, for the page's @font-face rules.
 */
export interface FilmFonts {
  display: Partial<Record<Locale, string>>;
  heading: Partial<Record<Locale, string>>;
  faces: FaceRequest[];
}

export interface FilmItem {
  id: string;
  kind: 'image' | 'video';
  thumb: string | null;
  /** the display version (a clip's still) */
  display: string | null;
  /** a clip's file */
  video: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  at: string;
  sharpness: number | null;
  brightness: number | null;
  aiQuality: number | null;
  phash: string | null;
  faces: Box[] | null;
}

export interface FilmView {
  id: string;
  slug: string;
  feature: FeatureState;
  /** the gallery is on (there is something to take photos from, and to add the film to) */
  gallery: boolean;
  items: FilmItem[];
  /** when the signed URLs expire (ms) */
  expiresAt: number;
  event: {
    /** the invitation's languages: the cards can be in any of them */
    locales: Locale[];
    defaultLocale: Locale;
    names: Partial<Record<Locale, string>>;
    date: string;
    palette: Pick<Palette, 'bg' | 'surface' | 'ink' | 'inkMuted' | 'accent' | 'accentInk' | 'line'>;
    fonts: FilmFonts;
  };
  music: { url: string | null; startAt: number };
}

function featureState(input: FeatureInput): FeatureState {
  const why = whyOff('auto_reel', input);
  const pkg = packageFor('auto_reel');
  return { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
}

async function ownerGate(
  userId: string,
  id: string,
  deps: Pick<FilmDeps, 'featureInput'>,
): Promise<{ refused: ApiResult } | { input: FeatureInput & { ownerId: string } }> {
  if (!isUuid(id)) return { refused: notFound };
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return { refused: notFound };
  return { input };
}

const featureOff = (f: FeatureState) =>
  fail(403, 'feature_off', { feature: 'auto_reel', reason: f.why, package: f.package });

type FilmRow = ItemRow & { faces: [number, number, number, number][] | null };

async function signFilmItems(rows: FilmRow[], deps: FilmDeps) {
  const ttl = GALLERY.urls.signedTtlSeconds;
  const media = rows.flatMap((r) => [r.thumbPath, r.displayPath]).filter((p): p is string => !!p);
  const videos = rows.filter((r) => r.kind === 'video').map((r) => r.originalPath);
  const [m, v] = await Promise.all([
    media.length ? deps.storage.signRead(BUCKETS.media, media, ttl) : new Map<string, string>(),
    videos.length ? deps.storage.signRead(BUCKETS.originals, videos, ttl) : new Map<string, string>(),
  ]);
  const items: FilmItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    thumb: r.thumbPath ? (m.get(r.thumbPath) ?? null) : null,
    display: r.displayPath ? (m.get(r.displayPath) ?? null) : null,
    video: r.kind === 'video' ? (v.get(r.originalPath) ?? null) : null,
    width: r.width,
    height: r.height,
    durationMs: r.durationMs,
    at: r.takenAt ?? r.publishedAt ?? r.createdAt,
    sharpness: r.sharpness,
    brightness: r.brightness,
    aiQuality: r.aiQuality,
    phash: r.phash,
    faces: r.faces,
  }));
  return { items: items.filter((i) => i.display || i.video), expiresAt: deps.now() + ttl * 1000 };
}

/** The studio's view (null: not the host's invitation). Photos only while the feature is on. */
export async function filmView(userId: string, id: string, deps: FilmDeps): Promise<FilmView | null> {
  const g = await ownerGate(userId, id, deps);
  if ('refused' in g) return null;
  const [owned, inv] = await Promise.all([deps.db.ownerGet(id, userId), deps.invitation(id, userId)]);
  if (!owned || !inv) return null;
  const feature = featureState(g.input);
  const gallery = !!owned.gallery;
  const signed =
    feature.on && gallery
      ? await signFilmItems((await deps.db.ownerFilm(id, userId, FILM.select.maxCandidates)) ?? [], deps)
      : { items: [], expiresAt: deps.now() };
  const doc = inv.doc;
  const locales = doc.locales.length ? [...doc.locales] : [doc.defaultLocale];
  const defaultLocale = locales.includes(doc.defaultLocale) ? doc.defaultLocale : locales[0]!;
  const names: Partial<Record<Locale, string>> = {};
  for (const l of locales) {
    const line = hostsLine(doc.hosts, l);
    if (line) names[l] = line;
  }
  const p = inv.palette;
  return {
    id,
    slug: inv.slug,
    feature,
    gallery,
    items: signed.items,
    expiresAt: signed.expiresAt,
    event: {
      locales,
      defaultLocale,
      names,
      date: doc.event.date,
      palette: {
        bg: p.bg,
        surface: p.surface,
        ink: p.ink,
        inkMuted: p.inkMuted,
        accent: p.accent,
        accentInk: p.accentInk,
        line: p.line,
      },
      fonts: inv.fonts,
    },
    music: { url: inv.musicUrl, startAt: Math.max(0, doc.music.startAtSec || 0) },
  };
}

/** GET /api/invitations/:id/gallery/film — the studio's view (fresh signed URLs). */
export async function getFilm(userId: string, id: string, deps: FilmDeps): Promise<ApiResult> {
  const view = await filmView(userId, id, deps);
  return view ? ok({ view }) : notFound;
}

// ─── the finished film into the gallery ─────────────────────────────────────────────────────────

const FileSpec = z.strictObject({ type: z.string().max(60), size: z.number().int().positive() });

export const ReserveFilmSchema = z.strictObject({
  step: z.literal('reserve'),
  original: FileSpec,
  display: FileSpec,
  thumb: FileSpec,
  width: z.number().int().min(16).max(4096),
  height: z.number().int().min(16).max(4096),
  durationMs: z
    .number()
    .int()
    .min(1000)
    .max((FILM.lengths.at(-1)! + 30) * 1000),
});

export const FinishFilmSchema = z.strictObject({
  step: z.literal('done'),
  id: z.uuid(),
  /** in the guests' feed and on the venue screen (else kept for the host, shown later with "show") */
  show: z.boolean(),
});

const FilmStepSchema = z.discriminatedUnion('step', [ReserveFilmSchema, FinishFilmSchema]);

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

async function ticket(bucket: Bucket, path: string, size: number, deps: FilmDeps): Promise<PartTicket> {
  const signed = await deps.storage.signUpload(bucket, path);
  return {
    bucket,
    path,
    token: signed.token,
    url: signed.url,
    resumable: size >= GALLERY.limits.resumableFrom ? deps.storage.resumable() : null,
  };
}

/**
 * POST /api/invitations/:id/gallery/film — { step: 'reserve', … }: the film's place in the gallery and
 * its signed upload URLs (the video, its still and its thumbnail); { step: 'done', id, show }: the
 * files are in storage — checked there — and the film joins the gallery.
 */
export async function postFilm(userId: string, id: string, raw: unknown, deps: FilmDeps): Promise<ApiResult> {
  const parsed = FilmStepSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await ownerGate(userId, id, deps);
  if ('refused' in g) return g.refused;
  const feature = featureState(g.input);
  if (!feature.on) return featureOff(feature);
  const q = parsed.data;
  return q.step === 'reserve' ? reserve(userId, id, q, deps) : finish(userId, id, q, deps);
}

async function reserve(
  userId: string,
  id: string,
  q: z.infer<typeof ReserveFilmSchema>,
  deps: FilmDeps,
): Promise<ApiResult> {
  const L = GALLERY.limits;
  const type = ORIGINAL_TYPES[q.original.type];
  if (!type || type.kind !== 'video') return fail(400, 'unsupported_type');
  if (q.original.size > L.videoBytes) return fail(400, 'too_large');
  for (const part of [q.display, q.thumb])
    if (!Object.prototype.hasOwnProperty.call(PREVIEW_TYPES, part.type)) return fail(400, 'unsupported_type');
  if (q.display.size > L.displayBytes || q.thumb.size > L.thumbBytes) return fail(400, 'too_large');

  const itemId = randomUUID();
  const folder = `${id}/${itemId}`;
  const item: ReserveItem = {
    id: itemId,
    kind: 'video',
    originalPath: `${folder}/original.${type.ext}`,
    originalType: q.original.type,
    originalSize: q.original.size,
    displayPath: `${folder}/display.${PREVIEW_TYPES[q.display.type]}`,
    displaySize: q.display.size,
    thumbPath: `${folder}/thumb.${PREVIEW_TYPES[q.thumb.type]}`,
    thumbSize: q.thumb.size,
    width: q.width,
    height: q.height,
    durationMs: q.durationMs,
    takenAt: new Date(deps.now()).toISOString(),
  };
  const added = await deps.db.ownerAdd(id, userId, item, L.itemsPerEvent);
  if (!added.ok)
    return added.code === 'full' ? fail(409, 'full', { left: added.left ?? 0 }) : fail(409, 'no_gallery');
  const [original, display, thumb] = await Promise.all([
    ticket(BUCKETS.originals, item.originalPath, q.original.size, deps),
    ticket(BUCKETS.media, item.displayPath!, q.display.size, deps),
    ticket(BUCKETS.media, item.thumbPath!, q.thumb.size, deps),
  ]);
  const reserved: ReservedItem = { key: 'film', id: itemId, parts: { original, display, thumb } };
  return ok({ item: reserved });
}

async function finish(
  userId: string,
  id: string,
  q: z.infer<typeof FinishFilmSchema>,
  deps: FilmDeps,
): Promise<ApiResult> {
  const owned = await deps.db.ownerGet(id, userId);
  if (!owned?.gallery) return fail(409, 'no_gallery');
  const folder = `${id}/${q.id}`;
  const L = GALLERY.limits;
  const [media, originals] = await Promise.all([
    deps.storage.list(BUCKETS.media, folder),
    deps.storage.list(BUCKETS.originals, folder),
  ]);
  const original = originals.find((f) => f.name.startsWith('original.'));
  const display = media.find((f) => f.name.startsWith('display.'));
  const thumb = media.find((f) => f.name.startsWith('thumb.'));
  if (!original || !display || !thumb) return fail(409, 'missing_files');
  const within = (size: number | null, cap: number) => size === null || size <= cap;
  if (
    !within(original.size, L.videoBytes) ||
    !within(display.size, L.displayBytes) ||
    !within(thumb.size, L.thumbBytes)
  )
    return fail(400, 'too_large');
  const done = await deps.db.ownerAddDone(id, userId, q.id, q.show, {
    ...(original.size !== null ? { original: original.size } : {}),
    ...(display.size !== null ? { display: display.size } : {}),
    ...(thumb.size !== null ? { thumb: thumb.size } : {}),
  });
  if (!done) return notFound;
  // the guests' feed, the venue screen and the host's tab refresh (hidden: only the host's tab)
  await deps.broadcast(owned.gallery.channel, 'items');
  return ok({ item: { id: done.id, status: done.status, file: fileName(done.originalPath) } });
}
