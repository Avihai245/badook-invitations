import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Feature } from '@/features/flags/features';
import { GALLERY, ORIGINAL_TYPES, PREVIEW_TYPES, isOriginalType } from '../config';
import { decide, type AiResult } from '../moderation';
import { galleryState } from '../state';
import type {
  FeedItem,
  FeedResponse,
  GalleryState,
  MineItem,
  PartTicket,
  RealtimeInfo,
  ReservedItem,
} from '../types';
import type { GalleryDb, ItemRow, TokenLookup } from './db';
import type { HintKind } from './realtime';
import { BUCKETS, type Bucket, type GalleryStorage } from './storage';
import { TOKEN_RE, UPLOADER_RE, codeMatches, rateKey, sha256Hex, uploaderHash } from './tokens';

/**
 * The guests' and the screen's gallery API as plain functions over injected dependencies (the route
 * files only parse the request): the feed, reserving uploads (type and size checked before any upload
 * URL is signed, rate-limited per link, per address and per device, capped per event), signing again
 * what expired, finishing an upload (the files are checked in storage, then the moderation decides),
 * a guest deleting their own upload, and the projector's feed. Tested in tests/unit/gallery-api.test.ts.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});

export interface GuestDeps {
  db: Pick<
    GalleryDb,
    | 'byToken'
    | 'reserve'
    | 'itemForUploader'
    | 'complete'
    | 'feed'
    | 'changes'
    | 'uploaderItems'
    | 'guestDelete'
    | 'rateHit'
    | 'guestByToken'
  >;
  storage: GalleryStorage;
  /** what the event may use (feature flags) */
  features(invitationId: string): Promise<Set<Feature>>;
  broadcast(channel: string, kind: HintKind): Promise<unknown>;
  /** the automatic check (null when this deployment has no AI model) */
  checkImage: ((jpeg: Uint8Array) => Promise<AiResult>) | null;
  realtime(channel: string): RealtimeInfo | null;
  /** files were deleted: remove them from storage now (bounded) */
  swept(): Promise<void>;
  now(): number;
}

// ─── the link ───────────────────────────────────────────────────────────────────────────────────

interface Resolved {
  lookup: TokenLookup;
  invitationId: string;
  features: Set<Feature>;
  state: GalleryState;
}

const notFound = fail(404, 'not_found');

/** The gallery behind a link, when its event may use it (live_gallery; the screen also needs projector). */
async function resolve(
  token: unknown,
  kind: 'upload' | 'projector',
  deps: GuestDeps,
): Promise<Resolved | null> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const lookup = await deps.db.byToken(sha256Hex(token), kind);
  if (!lookup) return null;
  const invitationId = lookup.invitation.id;
  const features = await deps.features(invitationId);
  const allowed = features.has('live_gallery') && (kind === 'upload' || features.has('projector'));
  const state = allowed ? galleryState(lookup.gallery, lookup.invitation.status, deps.now()) : 'off';
  return { lookup, invitationId, features, state };
}

/** The access code, when the host set one: missing or wrong → 401 (wrong ones are rate-limited per address). */
async function checkCode(
  r: Resolved,
  code: unknown,
  ip: string | null,
  deps: GuestDeps,
): Promise<ApiResult | null> {
  const { accessCodeHash: hash, accessCodeSalt: salt } = r.lookup.gallery;
  if (!hash || !salt) return null;
  if (typeof code === 'string' && code.length <= 64 && codeMatches(code, salt, hash)) return null;
  if (typeof code === 'string' && code) {
    const limit = GALLERY.rate.codePerAddress;
    const within = await deps.db.rateHit(
      rateKey('code', `${r.invitationId}:${ip ?? 'unknown'}`),
      limit.count,
      limit.windowSeconds,
    );
    if (!within) return fail(429, 'rate');
    return fail(401, 'access_code', { wrong: true });
  }
  return fail(401, 'access_code', { wrong: false });
}

async function rateOk(
  deps: GuestDeps,
  scope: string,
  value: string,
  limit: { count: number; windowSeconds: number },
) {
  return deps.db.rateHit(rateKey(scope, value), limit.count, limit.windowSeconds);
}

// ─── signed URLs ────────────────────────────────────────────────────────────────────────────────

/** Read URLs for items, one request per bucket. */
async function signItems(rows: ItemRow[], deps: GuestDeps, ttl = GALLERY.urls.signedTtlSeconds) {
  const media = rows.flatMap((r) => [r.thumbPath, r.displayPath]).filter((p): p is string => !!p);
  const videos = rows.filter((r) => r.kind === 'video').map((r) => r.originalPath);
  const [m, v] = await Promise.all([
    media.length ? deps.storage.signRead(BUCKETS.media, media, ttl) : new Map<string, string>(),
    videos.length ? deps.storage.signRead(BUCKETS.originals, videos, ttl) : new Map<string, string>(),
  ]);
  return {
    media: m,
    videos: v,
    expiresAt: deps.now() + ttl * 1000,
  };
}

export function feedItem(
  r: ItemRow,
  urls: { media: Map<string, string>; videos: Map<string, string> },
): FeedItem {
  return {
    id: r.id,
    kind: r.kind,
    thumb: r.thumbPath ? (urls.media.get(r.thumbPath) ?? null) : null,
    display: r.displayPath ? (urls.media.get(r.displayPath) ?? null) : null,
    video: r.kind === 'video' ? (urls.videos.get(r.originalPath) ?? null) : null,
    width: r.width,
    height: r.height,
    durationMs: r.durationMs,
    takenAt: r.takenAt,
    at: r.publishedAt ?? r.createdAt,
    name: r.name,
  };
}

// ─── the feed ───────────────────────────────────────────────────────────────────────────────────

const Cursor = z.strictObject({ at: z.iso.datetime({ offset: true }), id: z.uuid() });

export const FeedSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE).optional(),
  before: Cursor.optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  mine: z.boolean().optional(),
});

/** POST /api/gallery/feed — the published items (a page, or what changed since), and this device's own. */
export async function guestFeed(raw: unknown, ip: string | null, deps: GuestDeps): Promise<ApiResult> {
  const parsed = FeedSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, 'upload', deps);
  if (!r) return notFound;
  const g = r.lookup.gallery;
  if (r.state === 'off') return fail(403, 'off', { state: 'off' });
  const denied = await checkCode(r, q.code, ip, deps);
  if (denied) return denied;
  if (
    q.uploader &&
    !(await rateOk(deps, 'feed', `${r.invitationId}:${q.uploader}`, GALLERY.rate.feedPerDevice))
  )
    return fail(429, 'rate');

  let rows: ItemRow[];
  let removed: string[] = [];
  let now: string;
  let next: FeedResponse['next'] = null;
  if (q.since) {
    // a little overlap: an item committed while the last answer was being read still comes back
    const since = new Date(Date.parse(q.since) - 5_000).toISOString();
    const changes = await deps.db.changes(r.invitationId, since, 200);
    rows = changes.added;
    removed = changes.removed;
    now = changes.now;
  } else {
    const size = GALLERY.feed.pageSize;
    rows = await deps.db.feed(r.invitationId, q.before ?? null, size);
    now = new Date(deps.now()).toISOString();
    const last = rows.at(-1);
    next = rows.length === size && last?.publishedAt ? { at: last.publishedAt, id: last.id } : null;
  }
  const mineRows =
    q.mine && q.uploader
      ? await deps.db.uploaderItems(r.invitationId, uploaderHash(r.invitationId, q.uploader))
      : [];
  const urls = await signItems([...rows, ...mineRows], deps);
  const mine: MineItem[] = mineRows.map((m) => ({
    id: m.id,
    kind: m.kind,
    status: m.status,
    reason: m.reason,
    thumb: m.thumbPath ? (urls.media.get(m.thumbPath) ?? null) : null,
    createdAt: m.createdAt,
  }));
  const body: Omit<FeedResponse, 'ok'> = {
    state: r.state,
    mode: g.mode,
    opensAt: g.opensAt,
    closesAt: g.closesAt,
    now,
    items: rows.map((row) => feedItem(row, urls)),
    removed,
    next,
    ...(q.mine ? { mine } : {}),
    realtime: deps.realtime(g.channel),
    expiresAt: urls.expiresAt,
  };
  return ok(body);
}

// ─── reserving uploads ──────────────────────────────────────────────────────────────────────────

const FileSpec = z.strictObject({ type: z.string().max(60), size: z.number().int().positive() });

const ItemSpec = z.strictObject({
  key: z.string().min(1).max(64),
  kind: z.enum(['image', 'video']),
  original: FileSpec,
  display: FileSpec.optional(),
  thumb: FileSpec.optional(),
  width: z.number().int().min(1).max(100_000).nullable().optional(),
  height: z.number().int().min(1).max(100_000).nullable().optional(),
  durationMs: z.number().int().min(0).nullable().optional(),
  takenAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const ReserveSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
  name: z.string().max(200).optional(),
  g: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,64}$/)
    .optional(),
  items: z.array(ItemSpec).min(1).max(GALLERY.limits.itemsPerRequest),
});
type ItemSpecT = z.infer<typeof ItemSpec>;

/** Why an item can't be taken, before anything is signed: its type, its size, a video's length. */
export function checkItem(item: ItemSpecT): string | null {
  const L = GALLERY.limits;
  if (!isOriginalType(item.original.type) || ORIGINAL_TYPES[item.original.type]!.kind !== item.kind)
    return 'unsupported_type';
  if (item.original.size > (item.kind === 'video' ? L.videoBytes : L.imageBytes)) return 'too_large';
  if (item.kind === 'video' && item.durationMs && item.durationMs > L.videoMs) return 'too_long';
  // the display version and the thumbnail come together, both made in the browser
  if (!!item.display !== !!item.thumb) return 'invalid';
  for (const [part, spec, max] of [
    ['display', item.display, L.displayBytes],
    ['thumb', item.thumb, L.thumbBytes],
  ] as const) {
    if (!spec) continue;
    if (!Object.prototype.hasOwnProperty.call(PREVIEW_TYPES, spec.type)) return 'unsupported_type';
    if (spec.size > max) return part === 'display' ? 'too_large' : 'invalid';
  }
  return null;
}

/** A photo's time taken only when it is plausible (a phone's clock can be anything). */
function plausibleTime(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= Date.UTC(2000, 0, 1) && t <= now + 86_400_000
    ? new Date(t).toISOString()
    : null;
}

const cleanName = (name: string | undefined): string | null => {
  const v = (name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GALLERY.limits.nameLength);
  return v || null;
};

/** Runs `tasks` a few at a time. */
async function pooled<T>(tasks: (() => Promise<T>)[], size = 8): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]!();
      }
    }),
  );
  return out;
}

async function ticket(bucket: Bucket, path: string, size: number, deps: GuestDeps): Promise<PartTicket> {
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
 * POST /api/gallery/reserve — ids and signed upload URLs for up to 10 items, after checking their
 * types and sizes (the storage buckets check them again on upload).
 */
export async function guestReserve(raw: unknown, ip: string | null, deps: GuestDeps): Promise<ApiResult> {
  const parsed = ReserveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, 'upload', deps);
  if (!r) return notFound;
  if (r.state === 'off') return fail(403, 'off', { state: 'off' });
  const denied = await checkCode(r, q.code, ip, deps);
  if (denied) return denied;
  if (r.state !== 'open') return fail(403, r.state, { state: r.state });

  const inv = r.invitationId;
  const limits = await Promise.all([
    rateOk(deps, 'reserve-link', inv, GALLERY.rate.reservePerLink),
    rateOk(deps, 'reserve-ip', `${inv}:${ip ?? 'unknown'}`, GALLERY.rate.reservePerAddress),
    rateOk(deps, 'reserve-device', `${inv}:${q.uploader}`, GALLERY.rate.reservePerDevice),
  ]);
  if (limits.includes(false)) return fail(429, 'rate');

  const rejected: { key: string; code: string }[] = [];
  const accepted: { spec: ItemSpecT; id: string }[] = [];
  for (const spec of q.items) {
    const why = checkItem(spec);
    if (why) rejected.push({ key: spec.key, code: why });
    else accepted.push({ spec, id: randomUUID() });
  }
  if (!accepted.length) return ok({ items: [], rejected, issuedAt: deps.now() });

  const now = deps.now();
  const rows = accepted.map(({ spec, id }) => {
    const ext = ORIGINAL_TYPES[spec.original.type]!.ext;
    const folder = `${inv}/${id}`;
    return {
      id,
      kind: spec.kind,
      originalPath: `${folder}/original.${ext}`,
      originalType: spec.original.type,
      originalSize: spec.original.size,
      displayPath: spec.display ? `${folder}/display.${PREVIEW_TYPES[spec.display.type]}` : null,
      displaySize: spec.display?.size ?? null,
      thumbPath: spec.thumb ? `${folder}/thumb.${PREVIEW_TYPES[spec.thumb.type]}` : null,
      thumbSize: spec.thumb?.size ?? null,
      width: spec.width ?? null,
      height: spec.height ?? null,
      durationMs: spec.kind === 'video' ? (spec.durationMs ?? null) : null,
      takenAt: plausibleTime(spec.takenAt, now),
    };
  });
  const guestId = q.g ? await deps.db.guestByToken(inv, q.g) : null;
  const reserved = await deps.db.reserve(
    inv,
    uploaderHash(inv, q.uploader),
    guestId,
    cleanName(q.name),
    rows,
    GALLERY.limits.itemsPerEvent,
  );
  if (!reserved.ok) {
    if (reserved.code === 'full') return fail(409, 'full', { left: reserved.left ?? 0 });
    return notFound;
  }

  const tasks: (() => Promise<void>)[] = [];
  const items: ReservedItem[] = rows.map((row, i) => {
    const item: ReservedItem = { key: accepted[i]!.spec.key, id: row.id, parts: {} };
    tasks.push(async () => {
      item.parts.original = await ticket(BUCKETS.originals, row.originalPath, row.originalSize, deps);
    });
    if (row.displayPath)
      tasks.push(async () => {
        item.parts.display = await ticket(BUCKETS.media, row.displayPath!, row.displaySize ?? 0, deps);
      });
    if (row.thumbPath)
      tasks.push(async () => {
        item.parts.thumb = await ticket(BUCKETS.media, row.thumbPath!, row.thumbSize ?? 0, deps);
      });
    return item;
  });
  await pooled(tasks);
  return ok({ items, rejected, issuedAt: deps.now() });
}

// ─── signing again (a queue that waited past the upload URLs' two hours) ────────────────────────

const PART_NAMES = ['thumb', 'display', 'original'] as const;
type Part = (typeof PART_NAMES)[number];

export const ResignSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
  id: z.uuid(),
  parts: z.array(z.enum(PART_NAMES)).min(1).max(3),
});

const partPath = (row: ItemRow, part: Part) =>
  part === 'original' ? row.originalPath : part === 'display' ? row.displayPath : row.thumbPath;
const partBucket = (part: Part): Bucket => (part === 'original' ? BUCKETS.originals : BUCKETS.media);
const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** POST /api/gallery/resign — fresh upload URLs for an item's parts; a part already stored comes back done. */
export async function guestResign(raw: unknown, ip: string | null, deps: GuestDeps): Promise<ApiResult> {
  const parsed = ResignSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, 'upload', deps);
  if (!r) return notFound;
  if (r.state === 'off' || r.state === 'scheduled') return fail(403, r.state, { state: r.state });
  const denied = await checkCode(r, q.code, ip, deps);
  if (denied) return denied;
  const row = await deps.db.itemForUploader(
    r.invitationId,
    q.id,
    uploaderHash(r.invitationId, q.uploader),
    null,
  );
  if (!row) return notFound;
  const folder = `${r.invitationId}/${row.id}`;
  const stored = new Map<Bucket, Set<string>>();
  for (const bucket of new Set(q.parts.map(partBucket)))
    stored.set(bucket, new Set((await deps.storage.list(bucket, folder)).map((f) => f.name)));
  const parts: Record<string, PartTicket | { done: true }> = {};
  for (const part of q.parts) {
    const path = partPath(row, part);
    if (!path) continue;
    const bucket = partBucket(part);
    if (stored.get(bucket)?.has(fileName(path))) parts[part] = { done: true };
    else {
      const size = part === 'original' ? row.originalSize : part === 'display' ? (row.displaySize ?? 0) : 0;
      parts[part] = await ticket(bucket, path, size, deps);
    }
  }
  return ok({ parts, issuedAt: deps.now() });
}

// ─── finishing an upload ────────────────────────────────────────────────────────────────────────

export const CompleteSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
  id: z.uuid(),
  originalDone: z.boolean(),
  metrics: z
    .strictObject({
      sharpness: z.number().finite().min(0).max(1e7),
      brightness: z.number().finite().min(0).max(1),
      phash: z.string().regex(/^[0-9a-f]{16}$/),
      enhanced: z.boolean(),
    })
    .nullable()
    .optional(),
});

/**
 * POST /api/gallery/complete — the preview files (and maybe the original) are uploaded: check they
 * are really in storage and within their sizes, run the moderation, record the outcome and tell the
 * open pages. Later calls only record that the original arrived. Safe to call twice.
 */
export async function guestComplete(raw: unknown, ip: string | null, deps: GuestDeps): Promise<ApiResult> {
  const parsed = CompleteSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, 'upload', deps);
  if (!r) return notFound;
  if (r.state === 'off' || r.state === 'scheduled') return fail(403, r.state, { state: r.state });
  const denied = await checkCode(r, q.code, ip, deps);
  if (denied) return denied;
  const inv = r.invitationId;
  const uploader = uploaderHash(inv, q.uploader);
  const row = await deps.db.itemForUploader(inv, q.id, uploader, q.metrics?.phash ?? null);
  if (!row) return notFound;
  const folder = `${inv}/${row.id}`;
  const L = GALLERY.limits;

  // a video (the feed plays the file) and a photo without a preview need their original first
  const needsOriginal = row.kind === 'video' || !row.thumbPath;
  const [media, originals] = await Promise.all([
    row.thumbPath || row.displayPath ? deps.storage.list(BUCKETS.media, folder) : Promise.resolve([]),
    q.originalDone || needsOriginal ? deps.storage.list(BUCKETS.originals, folder) : Promise.resolve([]),
  ]);
  const found = (files: { name: string; size: number | null }[], path: string | null) =>
    path ? (files.find((f) => f.name === fileName(path)) ?? null) : null;
  const original = found(originals, row.originalPath);
  const originalCap = row.kind === 'video' ? L.videoBytes : L.imageBytes;
  const originalOk = !!original && (original.size === null || original.size <= originalCap);

  // already decided: only the original may be news
  if (row.status !== 'uploading') {
    if (q.originalDone && originalOk && !row.originalDone) {
      const done = await deps.db.complete({
        invitationId: inv,
        itemId: row.id,
        uploaderHash: uploader,
        status: null,
        reason: null,
        metrics: {},
        checks: [],
        sizes: original?.size ? { original: original.size } : {},
        originalDone: true,
      });
      return ok({
        status: done?.status ?? row.status,
        reason: done?.reason ?? row.reason,
        originalDone: true,
      });
    }
    return ok({
      status: row.status,
      reason: row.reason,
      originalDone: row.originalDone || (q.originalDone && originalOk),
    });
  }

  const thumb = found(media, row.thumbPath);
  const display = found(media, row.displayPath);
  const missing: Part[] = [];
  if (row.thumbPath && !thumb) missing.push('thumb');
  if (row.displayPath && !display) missing.push('display');
  if (needsOriginal && !originalOk) missing.push('original');
  if (missing.length) return fail(409, 'missing', { parts: missing });
  if ((thumb?.size ?? 0) > L.thumbBytes || (display?.size ?? 0) > L.displayBytes)
    return fail(413, 'too_large');

  // the automatic check: on the thumbnail (the display version is its big brother)
  let ai: AiResult | null = null;
  if (r.features.has('gallery_ai') && deps.checkImage) {
    if (!row.thumbPath) ai = { status: 'skipped', why: 'no_preview' };
    else if (!(await rateOk(deps, 'ai', 'day', { count: GALLERY.ai.perDay, windowSeconds: 86_400 })))
      ai = { status: 'skipped', why: 'daily_limit' };
    else {
      const bytes = await deps.storage.download(BUCKETS.media, row.thumbPath);
      ai = bytes ? await deps.checkImage(bytes) : { status: 'error', error: 'thumbnail unreadable' };
    }
  }
  const decision = decide({
    mode: r.lookup.gallery.mode,
    kind: row.kind,
    preview: !!row.thumbPath && !!row.displayPath,
    metrics: q.metrics ? { sharpness: q.metrics.sharpness, brightness: q.metrics.brightness } : null,
    nearest: row.nearest ?? null,
    ai,
  });
  const done = await deps.db.complete({
    invitationId: inv,
    itemId: row.id,
    uploaderHash: uploader,
    status: decision.status,
    reason: decision.reason,
    metrics: {
      ...(q.metrics ?? {}),
      ...(ai?.status === 'ok' ? { aiNsfw: ai.nsfw, aiQuality: ai.quality } : {}),
    },
    checks: decision.checks,
    sizes: {
      ...(thumb?.size ? { thumb: thumb.size } : {}),
      ...(display?.size ? { display: display.size } : {}),
      ...(original?.size && originalOk ? { original: original.size } : {}),
    },
    originalDone: (q.originalDone || needsOriginal) && originalOk,
  });
  if (!done) return notFound;
  if (done.first) await deps.broadcast(r.lookup.gallery.channel, 'items');
  return ok({ status: done.status, reason: done.reason, originalDone: done.originalDone });
}

// ─── a guest deletes their own upload ───────────────────────────────────────────────────────────

export const RemoveSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
  id: z.uuid(),
});

/** POST /api/gallery/remove — from the device that uploaded it; its files go at once. */
export async function guestRemove(raw: unknown, ip: string | null, deps: GuestDeps): Promise<ApiResult> {
  const parsed = RemoveSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.t, 'upload', deps);
  if (!r) return notFound;
  const denied = await checkCode(r, q.code, ip, deps);
  if (denied) return denied;
  const removed = await deps.db.guestDelete(r.invitationId, q.id, uploaderHash(r.invitationId, q.uploader));
  if (!removed) return notFound;
  await Promise.all([deps.swept(), deps.broadcast(r.lookup.gallery.channel, 'items')]);
  return ok({});
}

// ─── the screen ─────────────────────────────────────────────────────────────────────────────────

export const ProjectorSchema = z.strictObject({
  p: z.string(),
  since: z.iso.datetime({ offset: true }).optional(),
});

/** POST /api/gallery/projector — what the venue's screen shows: the newest published items, or what changed. */
export async function projectorFeed(raw: unknown, deps: GuestDeps): Promise<ApiResult> {
  const parsed = ProjectorSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const r = await resolve(q.p, 'projector', deps);
  if (!r) return notFound;
  const g = r.lookup.gallery;
  if (r.state === 'off')
    return ok({
      state: 'off',
      now: new Date(deps.now()).toISOString(),
      items: [],
      removed: [],
      realtime: deps.realtime(g.channel),
      expiresAt: 0,
    });
  let rows: ItemRow[];
  let removed: string[] = [];
  let now: string;
  if (q.since) {
    const changes = await deps.db.changes(
      r.invitationId,
      new Date(Date.parse(q.since) - 5_000).toISOString(),
      200,
    );
    rows = changes.added;
    removed = changes.removed;
    now = changes.now;
  } else {
    rows = await deps.db.feed(r.invitationId, null, 200);
    now = new Date(deps.now()).toISOString();
  }
  const urls = await signItems(rows, deps);
  return ok({
    state: r.state,
    now,
    items: rows.map((row) => feedItem(row, urls)),
    removed,
    realtime: deps.realtime(g.channel),
    expiresAt: urls.expiresAt,
  });
}
