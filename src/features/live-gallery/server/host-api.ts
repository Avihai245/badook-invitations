import 'server-only';
import { z } from 'zod';
import {
  packageFor,
  planForPackage,
  whyOff,
  type Feature,
  type FeatureInput,
  type Package,
} from '@/features/flags/features';
import type { PlanId } from '@/features/billing/plans';
import { GALLERY, ORIGINAL_TYPES } from '../config';
import type { ItemStatus } from '../moderation';
import { galleryState } from '../state';
import type { GalleryState, HostItem, RealtimeInfo } from '../types';
import type { GalleryCounts, GalleryDb, GallerySettings, ItemRow } from './db';
import { feedItem, type ApiResult } from './guest-api';
import type { HintKind } from './realtime';
import { BUCKETS, type GalleryStorage } from './storage';
import { codeHash, linkToken, newLink, normalizeCode, randomId } from './tokens';

/**
 * The host's side of the gallery (the "Gallery" tab of an invitation) as plain functions over
 * injected dependencies: its state with the links and QR code, turning it on, the settings, new
 * links, the review queue and every item, approving / hiding / rejecting / deleting, the originals
 * for the zip download, and deleting the whole gallery. Every call checks the owner (the database
 * functions do too). Photos the host already has stay reachable even if the plan changes later:
 * only turning the gallery on for guests needs live_gallery.
 */

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface HostGalleryDeps {
  db: Pick<
    GalleryDb,
    | 'ownerGet'
    | 'ownerCreate'
    | 'ownerUpdate'
    | 'ownerRotate'
    | 'ownerDelete'
    | 'ownerItems'
    | 'ownerModerate'
    | 'ownerOriginals'
  >;
  storage: GalleryStorage;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  broadcast(channel: string, kind: HintKind): Promise<unknown>;
  realtime(channel: string): RealtimeInfo | null;
  /** files were deleted: remove them from storage now (bounded) */
  sweep(): Promise<void>;
  qr(url: string): Promise<{ svg: string; png: string }>;
  now(): number;
}

export interface FeatureState {
  on: boolean;
  why: ReturnType<typeof whyOff>;
  package: Package;
  plan: PlanId;
}

export interface HostGalleryView {
  id: string;
  slug: string;
  timezone: string;
  features: Record<'live_gallery' | 'projector' | 'gallery_ai', FeatureState>;
  gallery: {
    enabled: boolean;
    mode: 'instant' | 'approval';
    paused: boolean;
    opensAt: string | null;
    closesAt: string | null;
    hasCode: boolean;
    state: GalleryState;
    /** null: the server's key changed since the link was made — offer a new one */
    uploadUrl: string | null;
    qr: { svg: string; png: string } | null;
    /** only when the event has the projector */
    projectorUrl: string | null;
    realtime: RealtimeInfo | null;
  } | null;
  counts: GalleryCounts | null;
}

const FEATURES = ['live_gallery', 'projector', 'gallery_ai'] as const satisfies readonly Feature[];

function featureStates(input: FeatureInput): HostGalleryView['features'] {
  const out = {} as HostGalleryView['features'];
  for (const f of FEATURES) {
    const why = whyOff(f, input);
    const pkg = packageFor(f);
    out[f] = { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
  }
  return out;
}

/** The whole state of the tab (null when the invitation isn't the host's). */
export async function hostView(
  userId: string,
  id: string,
  base: string,
  deps: HostGalleryDeps,
): Promise<HostGalleryView | null> {
  if (!isUuid(id)) return null;
  const [owned, input] = await Promise.all([deps.db.ownerGet(id, userId), deps.featureInput(id)]);
  if (!owned || !input || input.ownerId !== userId) return null;
  const features = featureStates(input);
  const g = owned.gallery;
  let gallery: HostGalleryView['gallery'] = null;
  if (g) {
    const upload = linkToken('upload', id, g.uploadTokenNonce, g.uploadTokenHash);
    const projector = linkToken('projector', id, g.projectorTokenNonce, g.projectorTokenHash);
    const uploadUrl = upload ? `${base}/e/${owned.slug}/upload?t=${upload}` : null;
    gallery = {
      enabled: g.enabled,
      mode: g.mode,
      paused: g.paused,
      opensAt: g.opensAt,
      closesAt: g.closesAt,
      hasCode: g.hasCode,
      state: features.live_gallery.on ? galleryState(g, owned.status, deps.now()) : 'off',
      uploadUrl,
      qr: uploadUrl ? await deps.qr(uploadUrl) : null,
      projectorUrl:
        features.projector.on && projector ? `${base}/e/${owned.slug}/projector?t=${projector}` : null,
      realtime: deps.realtime(g.channel),
    };
  }
  return {
    id,
    slug: owned.slug,
    timezone: owned.timezone ?? 'Asia/Jerusalem',
    features,
    gallery,
    counts: owned.counts,
  };
}

/** GET /api/invitations/:id/gallery */
export async function getGallery(
  userId: string,
  id: string,
  base: string,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  const view = await hostView(userId, id, base, deps);
  return view ? ok({ view }) : notFound;
}

/** POST /api/invitations/:id/gallery — turns the gallery on (a new one gets its links). */
export async function turnOn(
  userId: string,
  id: string,
  base: string,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return notFound;
  const why = whyOff('live_gallery', input);
  if (why) return fail(402, why === 'plan' ? 'plan' : 'unavailable', { package: packageFor('live_gallery') });
  const upload = newLink('upload', id);
  const projector = newLink('projector', id);
  const created = await deps.db.ownerCreate(
    id,
    userId,
    {
      uploadHash: upload.hash,
      uploadNonce: upload.nonce,
      projectorHash: projector.hash,
      projectorNonce: projector.nonce,
    },
    randomId(),
  );
  if (!created) return notFound;
  if (created.gallery) await deps.broadcast(created.gallery.channel, 'settings');
  return getGallery(userId, id, base, deps);
}

export const SettingsSchema = z
  .strictObject({
    enabled: z.boolean().optional(),
    mode: z.enum(['instant', 'approval']).optional(),
    paused: z.boolean().optional(),
    opensAt: z.iso.datetime({ offset: true }).nullable().optional(),
    closesAt: z.iso.datetime({ offset: true }).nullable().optional(),
    accessCode: z.string().max(64).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0);

/** PATCH /api/invitations/:id/gallery — the settings (only what is sent changes). */
export async function updateSettings(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const current = await deps.db.ownerGet(id, userId);
  if (!current?.gallery) return notFound;
  if (q.enabled === true && !current.gallery.enabled) {
    const input = await deps.featureInput(id);
    if (!input || whyOff('live_gallery', input))
      return fail(402, 'plan', { package: packageFor('live_gallery') });
  }
  const opensAt = q.opensAt === undefined ? current.gallery.opensAt : q.opensAt;
  const closesAt = q.closesAt === undefined ? current.gallery.closesAt : q.closesAt;
  if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt))
    return fail(400, 'invalid', { field: 'closesAt' });
  const patch: Record<string, unknown> = {};
  for (const key of ['enabled', 'mode', 'paused', 'opensAt', 'closesAt'] as const)
    if (q[key] !== undefined) patch[key] = q[key];
  if (q.accessCode !== undefined) {
    if (q.accessCode === null || !normalizeCode(q.accessCode)) patch.accessCode = null;
    else {
      const code = normalizeCode(q.accessCode);
      const { min, max } = GALLERY.limits.codeLength;
      if (code.length < min || code.length > max) return fail(400, 'invalid', { field: 'accessCode' });
      const salt = randomId();
      patch.accessCode = { hash: codeHash(code, salt), salt };
    }
  }
  const updated = await deps.db.ownerUpdate(id, userId, patch);
  if (!updated?.gallery) return notFound;
  await deps.broadcast(updated.gallery.channel, 'settings');
  return getGallery(userId, id, base, deps);
}

export const RotateSchema = z.strictObject({ which: z.enum(['upload', 'projector']) });

/** POST /api/invitations/:id/gallery/rotate — a new link; the old one stops working at once. */
export async function rotateLink(
  userId: string,
  id: string,
  raw: unknown,
  base: string,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = RotateSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const current = await deps.db.ownerGet(id, userId);
  if (!current?.gallery) return notFound;
  const link = newLink(parsed.data.which, id);
  const rotated = await deps.db.ownerRotate(id, userId, parsed.data.which, link.hash, link.nonce, randomId());
  if (!rotated) return notFound;
  // pages on the old link learn that it is gone (the new channel is for the new link)
  await deps.broadcast(current.gallery.channel, 'settings');
  return getGallery(userId, id, base, deps);
}

/** DELETE /api/invitations/:id/gallery — the gallery, every photo and video in it, and their files. */
export async function deleteGallery(userId: string, id: string, deps: HostGalleryDeps): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const current = await deps.db.ownerGet(id, userId);
  if (!current?.gallery) return notFound;
  if (!(await deps.db.ownerDelete(id, userId))) return notFound;
  await Promise.all([deps.broadcast(current.gallery.channel, 'settings'), deps.sweep()]);
  return ok({});
}

// ─── items ──────────────────────────────────────────────────────────────────────────────────────

const STATUSES = ['all', 'pending', 'published', 'hidden', 'rejected'] as const;
export const ItemsQuery = z.strictObject({
  status: z.enum(STATUSES).default('all'),
  beforeAt: z.iso.datetime({ offset: true }).optional(),
  beforeId: z.uuid().optional(),
});

export function hostItem(
  r: ItemRow,
  urls: { media: Map<string, string>; videos: Map<string, string> },
): HostItem {
  return {
    ...feedItem(r, urls),
    at: r.createdAt,
    status: r.status,
    reason: r.reason,
    createdAt: r.createdAt,
    originalDone: r.originalDone,
    originalSize: r.originalSize,
    originalType: r.originalType,
    sharpness: r.sharpness,
    brightness: r.brightness,
    aiNsfw: r.aiNsfw,
    aiQuality: r.aiQuality,
    enhanced: r.enhanced,
    guestName: r.guestName ?? null,
  };
}

async function signHost(rows: ItemRow[], deps: HostGalleryDeps) {
  const ttl = GALLERY.urls.signedTtlSeconds;
  const media = rows.flatMap((r) => [r.thumbPath, r.displayPath]).filter((p): p is string => !!p);
  const videos = rows.filter((r) => r.kind === 'video').map((r) => r.originalPath);
  const [m, v] = await Promise.all([
    media.length ? deps.storage.signRead(BUCKETS.media, media, ttl) : new Map<string, string>(),
    videos.length ? deps.storage.signRead(BUCKETS.originals, videos, ttl) : new Map<string, string>(),
  ]);
  return { media: m, videos: v, expiresAt: deps.now() + ttl * 1000 };
}

/** GET /api/invitations/:id/gallery/items?status=&beforeAt=&beforeId= — the host's list, newest first. */
export async function listItems(
  userId: string,
  id: string,
  query: unknown,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = ItemsQuery.safeParse(query);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const before = q.beforeAt && q.beforeId ? { at: q.beforeAt, id: q.beforeId } : null;
  const size = GALLERY.feed.hostPageSize;
  const rows = await deps.db.ownerItems(id, userId, q.status as ItemStatus | 'all', before, size);
  if (!rows) return notFound;
  const urls = await signHost(rows, deps);
  const last = rows.at(-1);
  return ok({
    items: rows.map((r) => hostItem(r, urls)),
    next: rows.length === size && last ? { at: last.createdAt, id: last.id } : null,
    expiresAt: urls.expiresAt,
  });
}

export const ModerateSchema = z.strictObject({
  action: z.enum(['publish', 'hide', 'reject', 'delete']),
  ids: z.array(z.uuid()).min(1).max(200),
});

/** POST /api/invitations/:id/gallery/items { action, ids } — approve / show, hide, reject or delete. */
export async function moderateItems(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = ModerateSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const current = await deps.db.ownerGet(id, userId);
  if (!current?.gallery) return notFound;
  const done = await deps.db.ownerModerate(id, userId, [...new Set(parsed.data.ids)], parsed.data.action);
  if (!done) return notFound;
  await Promise.all([
    done.count ? deps.broadcast(current.gallery.channel, 'items') : null,
    parsed.data.action === 'delete' && done.count ? deps.sweep() : null,
  ]);
  return ok({ count: done.count, ids: done.ids });
}

// ─── download everything ────────────────────────────────────────────────────────────────────────

export const OriginalsSchema = z.strictObject({
  scope: z.enum(['all', 'published']).default('all'),
  after: z
    .strictObject({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
    .nullable()
    .optional(),
});

export interface DownloadFile {
  id: string;
  /** the name inside the archive */
  name: string;
  url: string;
  size: number;
  /** when it was taken (or uploaded) */
  date: string;
  /** the original hasn't arrived: this is the display version */
  partial: boolean;
}

/** "2027-06-17_21-04-33" in the event's time zone. */
export function stamp(iso: string, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso));
  } catch {
    return stamp(iso, 'UTC');
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
}

/** A file name for the archive: when, who (when they gave a name), and a bit of the id (unique). */
export function archiveName(r: ItemRow, timeZone: string, partial: boolean): string {
  const ext = partial ? 'jpg' : (ORIGINAL_TYPES[r.originalType]?.ext ?? 'bin');
  const who = (r.name ?? r.guestName ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${stamp(r.takenAt ?? r.createdAt, timeZone)}${who ? `_${who}` : ''}_${r.id.slice(0, 8)}${partial ? '_preview' : ''}.${ext}`;
}

/**
 * POST /api/invitations/:id/gallery/originals { scope, after } — the next files for the zip, oldest
 * first, each with a signed URL (the original; its display version when the original never arrived).
 */
export async function originalsPage(
  userId: string,
  id: string,
  raw: unknown,
  deps: HostGalleryDeps,
): Promise<ApiResult> {
  if (!isUuid(id)) return notFound;
  const parsed = OriginalsSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(400, 'invalid');
  const current = await deps.db.ownerGet(id, userId);
  if (!current) return notFound;
  const size = 100;
  const page = await deps.db.ownerOriginals(id, userId, parsed.data.scope, parsed.data.after ?? null, size);
  if (!page) return notFound;
  const ttl = GALLERY.urls.signedTtlSeconds;
  const originals = page.items.filter((r) => r.originalDone).map((r) => r.originalPath);
  const previews = page.items.filter((r) => !r.originalDone && r.displayPath).map((r) => r.displayPath!);
  const [o, p] = await Promise.all([
    originals.length ? deps.storage.signRead(BUCKETS.originals, originals, ttl) : new Map<string, string>(),
    previews.length ? deps.storage.signRead(BUCKETS.media, previews, ttl) : new Map<string, string>(),
  ]);
  const zone = current.timezone ?? 'Asia/Jerusalem';
  const files: DownloadFile[] = [];
  for (const r of page.items) {
    const partial = !r.originalDone;
    const url = partial ? (r.displayPath ? p.get(r.displayPath) : undefined) : o.get(r.originalPath);
    if (!url) continue;
    files.push({
      id: r.id,
      name: archiveName(r, zone, partial),
      url,
      size: partial ? (r.displaySize ?? 0) : r.originalSize,
      date: r.takenAt ?? r.createdAt,
      partial,
    });
  }
  const last = page.items.at(-1);
  return ok({
    files,
    next: page.items.length === size && last ? { at: last.createdAt, id: last.id } : null,
    total: page.total,
    bytes: page.bytes,
  });
}

export type { GallerySettings };
