import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { LOCALES } from '@/features/invitations/contracts/types';
import { GALLERY } from '@/features/live-gallery/config';
import { checkCode, resolve, type GuestDeps, type Resolved } from '@/features/live-gallery/server/guest-api';
import type { HintKind } from '@/features/live-gallery/server/realtime';
import { BUCKETS, type Bucket } from '@/features/live-gallery/server/storage';
import { TOKEN_RE, UPLOADER_RE, rateKey, uploaderHash } from '@/features/live-gallery/server/tokens';
import { AI_PHOTOS } from '../config';
import { detectPeople } from '../model';
import type { GuestAiPhoto, GuestAiState } from '../types';
import type { AiPhotoDb, PhotoRow } from './db';
import { photoPath } from './worker';

/**
 * The guests' side of the AI photos (feature ai_photos), on the gallery's page and behind its link, as
 * plain functions over injected dependencies (tests in tests/unit/ai-photos-api.test.ts): what the page
 * offers (the people of honor, what this phone may still make, its photos), asking for a photo (the
 * phone's photo re-encoded here — no metadata kept — and the request queued under the limits; the
 * worker starts at once), how it is doing (a background photo is checked on the way), adding a finished
 * one to the gallery (copied there as the guest's own upload, marked AI, as the gallery's mode says),
 * and deleting it. Rate-limited per address and per phone; the gallery's access code is asked.
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');

export interface AiGuestDeps {
  /** the gallery's link, access code and rate limits (live-gallery) */
  gallery: GuestDeps;
  db: Pick<AiPhotoDb, 'guestState' | 'create' | 'guestGet' | 'guestDelete' | 'share'>;
  signRead(bucket: Bucket, paths: string[], ttlSeconds: number): Promise<Map<string, string>>;
  download(bucket: Bucket, path: string): Promise<Uint8Array | null>;
  upload(bucket: Bucket, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(bucket: Bucket, paths: string[]): Promise<void>;
  /** the guest's photo as stored: a JPEG ≤ AI_PHOTOS.source.maxEdge, no metadata (null: not a photo) */
  normalize(bytes: Uint8Array): Promise<Uint8Array | null>;
  /** a thumbnail of a stored JPEG (for the gallery's copy) */
  thumbnail(bytes: Uint8Array): Promise<Uint8Array>;
  /** start the queued photos of this event in the background (after the answer) */
  kick(invitationId: string): void;
  /** check this event's background photos now (bounded) */
  advance(invitationId: string): Promise<void>;
  broadcast(channel: string, kind: HintKind): Promise<unknown>;
  dailyLimit: number;
}

const Base = {
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
};

/** The gallery behind the link, with the feature on and the access code given. */
async function open(
  q: { t: string; code?: string },
  ip: string | null,
  deps: AiGuestDeps,
): Promise<{ r: Resolved } | { refused: ApiResult }> {
  if (!TOKEN_RE.test(q.t)) return { refused: notFound };
  const r = await resolve(q.t, 'upload', deps.gallery);
  if (!r) return { refused: notFound };
  if (r.state === 'off' || !r.features.has('ai_photos')) return { refused: fail(403, 'off') };
  const denied = await checkCode(r, q.code, ip, deps.gallery);
  if (denied) return { refused: denied };
  return { r };
}

const rate = (
  deps: AiGuestDeps,
  scope: string,
  value: string,
  limit: { count: number; windowSeconds: number },
) => deps.gallery.db.rateHit(rateKey(scope, value), limit.count, limit.windowSeconds);

async function guestPhotos(rows: readonly PhotoRow[], deps: AiGuestDeps): Promise<GuestAiPhoto[]> {
  const paths = rows.flatMap((r) => [r.thumbPath, r.resultPath]).filter((p): p is string => !!p);
  const urls = paths.length
    ? await deps.signRead(BUCKETS.aiPhotos, paths, AI_PHOTOS.urls.signedTtlSeconds)
    : new Map<string, string>();
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    prompt: r.prompt,
    thumb: r.thumbPath ? (urls.get(r.thumbPath) ?? null) : null,
    result: r.resultPath ? (urls.get(r.resultPath) ?? null) : null,
    width: r.width,
    height: r.height,
    shared: !!r.galleryItemId,
    createdAt: r.createdAt,
  }));
}

const StateSchema = z.strictObject(Base);

/** POST /api/gallery/ai/state — the people, what this phone may still make, its photos (null: not offered). */
export async function aiState(raw: unknown, ip: string | null, deps: AiGuestDeps): Promise<ApiResult> {
  const parsed = StateSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const o = await open(parsed.data, ip, deps);
  if ('refused' in o) return o.refused;
  const s = await deps.db.guestState(
    o.r.invitationId,
    uploaderHash(o.r.invitationId, parsed.data.uploader),
    12,
  );
  if (!s.settings.enabled || !s.people.length) return ok({ ai: null });
  const ai: GuestAiState = {
    people: s.people,
    perGuest: s.settings.perGuest,
    left: Math.max(0, s.settings.perGuest - s.used.guest),
    eventFull: s.used.event >= s.settings.perEvent,
    toGallery: s.settings.toGallery,
    mine: await guestPhotos(s.mine, deps),
  };
  return ok({ ai });
}

const Photo = z
  .string()
  .max(Math.ceil((AI_PHOTOS.source.maxBytes * 4) / 3) + 64)
  .transform((s) => s.replace(/^data:[^,]*,/, ''));

export const CreateSchema = z.strictObject({
  ...Base,
  /** the guest's personal link (their photo carries their name for the hosts) */
  guest: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,64}$/)
    .nullable()
    .optional(),
  name: z.string().trim().max(GALLERY.limits.nameLength).nullable().optional(),
  prompt: z.string().trim().min(2).max(AI_PHOTOS.prompt.max),
  people: z.array(z.uuid()).max(AI_PHOTOS.people.max),
  /** a photo the guest took at the event (none: a new scene) */
  photo: Photo.nullable().optional(),
  lang: z.enum(LOCALES),
});

/** POST /api/gallery/ai/create — asks for a photo: { id, left } once queued. */
export async function aiCreate(raw: unknown, ip: string | null, deps: AiGuestDeps): Promise<ApiResult> {
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q, ip, deps);
  if ('refused' in o) return o.refused;
  const inv = o.r.invitationId;
  const R = AI_PHOTOS.rate;
  if (!(await rate(deps, 'ai-create-ip', `${inv}:${ip ?? 'unknown'}`, R.createPerAddress)))
    return fail(429, 'rate');
  if (!(await rate(deps, 'ai-create-device', `${inv}:${q.uploader}`, R.createPerDevice)))
    return fail(429, 'rate');
  const hash = uploaderHash(inv, q.uploader);
  // who: the people the guest chose, else the ones the request names, else everyone
  let people = q.people;
  if (!people.length) {
    const state = await deps.db.guestState(inv, hash, 1);
    const named = detectPeople(q.prompt, state.people);
    people = named.length ? named : state.people.map((p) => p.id);
  }
  const id = randomUUID();
  let sourcePath: string | null = null;
  if (q.photo) {
    const bytes = new Uint8Array(Buffer.from(q.photo, 'base64'));
    if (!bytes.length || bytes.length > AI_PHOTOS.source.maxBytes) return fail(400, 'too_large');
    const jpeg = await deps.normalize(bytes);
    if (!jpeg) return fail(400, 'unsupported_type');
    sourcePath = photoPath(inv, id, 'source');
    await deps.upload(BUCKETS.aiPhotos, sourcePath, jpeg, 'image/jpeg');
  }
  const guestId = q.guest ? await deps.gallery.db.guestByToken(inv, q.guest) : null;
  const made = await deps.db.create(
    inv,
    hash,
    guestId,
    q.name ?? null,
    { id, prompt: q.prompt, people, locale: q.lang, sourcePath },
    deps.dailyLimit,
  );
  if (!made.ok) {
    if (sourcePath) await deps.remove(BUCKETS.aiPhotos, [sourcePath]).catch(() => undefined);
    const status = made.code === 'off' ? 403 : made.code === 'no_people' ? 400 : 429;
    return fail(status, made.code, made.limit ? { limit: made.limit } : {});
  }
  deps.kick(inv);
  return ok({ id, left: made.left });
}

const OneSchema = z.strictObject({ ...Base, id: z.uuid() });

/** POST /api/gallery/ai/status — how one of this phone's photos is doing (a background one is checked). */
export async function aiStatus(raw: unknown, ip: string | null, deps: AiGuestDeps): Promise<ApiResult> {
  const parsed = OneSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q, ip, deps);
  if ('refused' in o) return o.refused;
  const inv = o.r.invitationId;
  if (!(await rate(deps, 'ai-status', `${inv}:${q.uploader}`, AI_PHOTOS.rate.statusPerDevice)))
    return fail(429, 'rate');
  const hash = uploaderHash(inv, q.uploader);
  let photo = await deps.db.guestGet(inv, hash, q.id);
  if (!photo) return notFound;
  if (photo.status === 'running' && photo.externalId) {
    await deps.advance(inv);
    photo = (await deps.db.guestGet(inv, hash, q.id)) ?? photo;
  } else if (photo.status === 'queued') {
    // its worker may have stopped with its server: start it again (the database hands it to one)
    deps.kick(inv);
  }
  const [view] = await guestPhotos([photo], deps);
  return ok({ photo: view });
}

/** POST /api/gallery/ai/share — a finished photo into the event's gallery, as this guest's upload. */
export async function aiShare(raw: unknown, ip: string | null, deps: AiGuestDeps): Promise<ApiResult> {
  const parsed = OneSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q, ip, deps);
  if ('refused' in o) return o.refused;
  const inv = o.r.invitationId;
  const hash = uploaderHash(inv, q.uploader);
  const photo = await deps.db.guestGet(inv, hash, q.id);
  if (!photo) return notFound;
  if (photo.status !== 'done' || !photo.resultPath) return fail(409, 'not_done');
  if (photo.galleryItemId) return fail(409, 'shared');
  const result = await deps.download(BUCKETS.aiPhotos, photo.resultPath);
  if (!result) return fail(409, 'not_done');
  const thumb = await deps.thumbnail(result);
  const itemId = randomUUID();
  const folder = `${inv}/${itemId}`;
  const paths = {
    original: `${folder}/original.jpg`,
    display: `${folder}/display.jpg`,
    thumb: `${folder}/thumb.jpg`,
  };
  await Promise.all([
    deps.upload(BUCKETS.originals, paths.original, result, 'image/jpeg'),
    deps.upload(BUCKETS.media, paths.display, result, 'image/jpeg'),
    deps.upload(BUCKETS.media, paths.thumb, thumb, 'image/jpeg'),
  ]);
  const shared = await deps.db.share(
    inv,
    hash,
    q.id,
    {
      id: itemId,
      originalPath: paths.original,
      originalSize: result.length,
      displayPath: paths.display,
      displaySize: result.length,
      thumbPath: paths.thumb,
      thumbSize: thumb.length,
      width: photo.width,
      height: photo.height,
    },
    GALLERY.limits.itemsPerEvent,
  );
  if (!shared.ok) {
    await Promise.all([
      deps.remove(BUCKETS.originals, [paths.original]),
      deps.remove(BUCKETS.media, [paths.display, paths.thumb]),
    ]).catch(() => undefined);
    return fail(shared.code === 'not_found' ? 404 : 409, shared.code);
  }
  await deps.broadcast(o.r.lookup.gallery.channel, 'items');
  return ok({ status: shared.status, itemId: shared.itemId });
}

/** POST /api/gallery/ai/delete — one of this phone's finished photos, and its files. */
export async function aiDelete(raw: unknown, ip: string | null, deps: AiGuestDeps): Promise<ApiResult> {
  const parsed = OneSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q, ip, deps);
  if ('refused' in o) return o.refused;
  const inv = o.r.invitationId;
  const done = await deps.db.guestDelete(inv, uploaderHash(inv, q.uploader), q.id);
  if (!done) return notFound;
  await deps.gallery.swept();
  return ok({});
}
