import 'server-only';
import { z } from 'zod';
import type { PlanId } from '@/features/billing/plans';
import {
  packageFor,
  planForPackage,
  whyOff,
  type FeatureInput,
  type Package,
} from '@/features/flags/features';
import { GALLERY } from '@/features/live-gallery/config';
import {
  checkCode,
  feedItem,
  resolve,
  signItems,
  type ApiResult,
  type GuestDeps,
  type Resolved,
} from '@/features/live-gallery/server/guest-api';
import { BUCKETS, type GalleryStorage } from '@/features/live-gallery/server/storage';
import { rateKey, uploaderHash, UPLOADER_RE } from '@/features/live-gallery/server/tokens';
import { FACES } from '../config';
import { DescriptorSchema, FacesSchema, faceWindow } from '../model';
import type { FacesDb, FaceState } from './db';

/**
 * "The photos I'm in" (feature face_albums) as plain functions over injected dependencies (the route
 * files only read the request; tests in tests/unit/faces-api.test.ts).
 *
 * Guests, through the gallery's link (and its access code): search with the descriptor of their
 * selfie — made on their phone; the selfie never leaves it, and the descriptor is only compared by the
 * database, never stored or logged — ask to be left out of everyone's searches, or be forgotten. The
 * phone that uploaded a photo may send the faces it found in it. The host: where face search stands,
 * the next photos to look at ("prepare face search", in the host's browser), their faces, and erasing
 * everything now. Everything needs the feature — off for the whole deployment until INVITES_FACE_ALBUMS
 * (legal approval) — and closes when the data is erased, 30 days after the event.
 */

const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── guests ─────────────────────────────────────────────────────────────────────────────────────

export interface FaceGuestDeps {
  /** the gallery's guest dependencies (its link, its access code, its signed URLs) */
  gallery: GuestDeps;
  db: Pick<FacesDb, 'search' | 'leaveOut' | 'forget' | 'indexUpload'>;
}

/** The gallery behind the link when face search is open for it (else the answer to send). */
async function open(
  t: unknown,
  code: unknown,
  ip: string | null,
  deps: FaceGuestDeps,
): Promise<{ refused: ApiResult } | { r: Resolved }> {
  const r = await resolve(t, 'upload', deps.gallery);
  if (!r) return { refused: notFound };
  if (r.state === 'off') return { refused: fail(403, 'off', { state: 'off' }) };
  const denied = await checkCode(r, code, ip, deps.gallery);
  if (denied) return { refused: denied };
  if (!r.features.has('face_albums'))
    return { refused: fail(403, 'feature_off', { feature: 'face_albums' }) };
  if (!faceWindow(r.lookup.invitation.date, deps.gallery.now()).open)
    return { refused: fail(410, 'expired') };
  return { r };
}

async function withinSearchLimits(r: Resolved, ip: string | null, deps: FaceGuestDeps): Promise<boolean> {
  const { searchPerAddress, searchPerLink } = FACES.rate;
  const limits = await Promise.all([
    deps.gallery.db.rateHit(
      rateKey('faces-ip', `${r.invitationId}:${ip ?? 'unknown'}`),
      searchPerAddress.count,
      searchPerAddress.windowSeconds,
    ),
    deps.gallery.db.rateHit(
      rateKey('faces-link', r.invitationId),
      searchPerLink.count,
      searchPerLink.windowSeconds,
    ),
  ]);
  return !limits.includes(false);
}

export const SearchSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  descriptor: DescriptorSchema,
});

/** POST /api/gallery/faces/search — the published photos with a face that matches the guest's descriptor. */
export async function searchFaces(raw: unknown, ip: string | null, deps: FaceGuestDeps): Promise<ApiResult> {
  const parsed = SearchSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q.t, q.code, ip, deps);
  if ('refused' in o) return o.refused;
  if (!(await withinSearchLimits(o.r, ip, deps))) return fail(429, 'rate');
  const rows = await deps.db.search(
    o.r.invitationId,
    q.descriptor,
    FACES.match.search,
    FACES.match.albumLimit,
  );
  if (!rows) return fail(400, 'invalid');
  const urls = await signItems(rows, deps.gallery);
  return ok({ items: rows.map((row) => feedItem(row, urls)), expiresAt: urls.expiresAt });
}

/** POST /api/gallery/faces/leave — the guest is left out of everyone's searches (photos added later too). */
export async function leaveOut(raw: unknown, ip: string | null, deps: FaceGuestDeps): Promise<ApiResult> {
  const parsed = SearchSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q.t, q.code, ip, deps);
  if ('refused' in o) return o.refused;
  if (!(await withinSearchLimits(o.r, ip, deps))) return fail(429, 'rate');
  const done = await deps.db.leaveOut(o.r.invitationId, q.descriptor, FACES.match.exclude);
  return done ? ok({ excluded: done.excluded }) : fail(400, 'invalid');
}

/** POST /api/gallery/faces/forget — the faces that match the guest are erased now, and nothing about them stays. */
export async function forget(raw: unknown, ip: string | null, deps: FaceGuestDeps): Promise<ApiResult> {
  const parsed = SearchSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  // forgetting stays possible after the window (there is nothing left then, but it says so)
  const r = await resolve(q.t, 'upload', deps.gallery);
  if (!r) return notFound;
  const denied = await checkCode(r, q.code, ip, deps.gallery);
  if (denied) return denied;
  if (!(await withinSearchLimits(r, ip, deps))) return fail(429, 'rate');
  const done = await deps.db.forget(r.invitationId, q.descriptor, FACES.match.exclude);
  return done ? ok({ erased: done.erased }) : fail(400, 'invalid');
}

export const IndexSchema = z.strictObject({
  t: z.string(),
  code: z.string().max(64).optional(),
  uploader: z.string().regex(UPLOADER_RE),
  id: z.uuid(),
  faces: FacesSchema,
});

/** POST /api/gallery/faces/index — the phone that uploaded a photo sends the faces it found in it. */
export async function indexUpload(raw: unknown, ip: string | null, deps: FaceGuestDeps): Promise<ApiResult> {
  const parsed = IndexSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const q = parsed.data;
  const o = await open(q.t, q.code, ip, deps);
  if ('refused' in o) return o.refused;
  const inv = o.r.invitationId;
  const limit = FACES.rate.indexPerDevice;
  if (
    !(await deps.gallery.db.rateHit(
      rateKey('faces-index', `${inv}:${q.uploader}`),
      limit.count,
      limit.windowSeconds,
    ))
  )
    return fail(429, 'rate');
  const done = await deps.db.indexUpload(
    inv,
    q.id,
    uploaderHash(inv, q.uploader),
    q.faces,
    FACES.match.exclude,
  );
  if (!done.ok) return done.code === 'not_found' ? notFound : fail(400, 'invalid');
  return ok({ faces: done.faces, excluded: done.excluded, already: !!done.already });
}

// ─── the host ───────────────────────────────────────────────────────────────────────────────────

export interface FaceHostDeps {
  db: Pick<FacesDb, 'ownerState' | 'ownerPending' | 'ownerIndex' | 'ownerErase'>;
  storage: Pick<GalleryStorage, 'signRead'>;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  now(): number;
}

export interface FeatureState {
  on: boolean;
  why: ReturnType<typeof whyOff>;
  package: Package;
  plan: PlanId;
}

export interface FaceHostView {
  feature: FeatureState;
  state: FaceState;
  /** open until the data's erasure (30 days after the event); `until` is that last day */
  window: { open: boolean; until: string | null };
}

export interface PendingForBrowser {
  id: string;
  /** the display version's signed URL (the browser reads it for faces) */
  url: string;
  width: number | null;
  height: number | null;
}

function featureState(input: FeatureInput): FeatureState {
  const why = whyOff('face_albums', input);
  const pkg = packageFor('face_albums');
  return { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
}

async function ownerGate(
  userId: string,
  id: string,
  deps: Pick<FaceHostDeps, 'featureInput'>,
): Promise<{ refused: ApiResult } | { input: FeatureInput & { ownerId: string } }> {
  if (!isUuid(id)) return { refused: notFound };
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return { refused: notFound };
  return { input };
}

async function pendingBatch(userId: string, id: string, deps: FaceHostDeps): Promise<PendingForBrowser[]> {
  const rows = (await deps.db.ownerPending(id, userId, FACES.hostBatch)) ?? [];
  if (!rows.length) return [];
  const urls = await deps.storage.signRead(
    BUCKETS.media,
    rows.map((r) => r.displayPath),
    GALLERY.urls.signedTtlSeconds,
  );
  return rows.flatMap((r) => {
    const url = urls.get(r.displayPath);
    return url ? [{ id: r.id, url, width: r.width, height: r.height }] : [];
  });
}

/** The host's view (null: not their invitation) — shown whatever the feature says, so they can erase. */
export async function faceHostView(
  userId: string,
  id: string,
  deps: FaceHostDeps,
): Promise<FaceHostView | null> {
  const g = await ownerGate(userId, id, deps);
  if ('refused' in g) return null;
  const state = await deps.db.ownerState(id, userId);
  if (!state) return null;
  return { feature: featureState(g.input), state, window: faceWindow(state.eventDate, deps.now()) };
}

/** GET /api/invitations/:id/gallery/faces — where it stands, and the next photos to look at. */
export async function getFaces(userId: string, id: string, deps: FaceHostDeps): Promise<ApiResult> {
  const view = await faceHostView(userId, id, deps);
  if (!view) return notFound;
  const canIndex = view.feature.on && view.window.open && view.state.gallery;
  return ok({ view, pending: canIndex ? await pendingBatch(userId, id, deps) : [] });
}

export const OwnerIndexSchema = z.strictObject({
  results: z
    .array(z.strictObject({ id: z.uuid(), faces: FacesSchema }))
    .min(1)
    .max(FACES.hostBatch * 2),
});

/** POST /api/invitations/:id/gallery/faces { results } — what the host's browser found; the next photos. */
export async function postFaces(
  userId: string,
  id: string,
  raw: unknown,
  deps: FaceHostDeps,
): Promise<ApiResult> {
  const parsed = OwnerIndexSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const g = await ownerGate(userId, id, deps);
  if ('refused' in g) return g.refused;
  const feature = featureState(g.input);
  if (!feature.on)
    return fail(403, 'feature_off', {
      feature: 'face_albums',
      reason: feature.why,
      package: feature.package,
    });
  const state = await deps.db.ownerState(id, userId);
  if (!state) return notFound;
  if (!faceWindow(state.eventDate, deps.now()).open) return fail(410, 'expired');
  const done = await deps.db.ownerIndex(id, userId, parsed.data.results, FACES.match.exclude);
  if (!done) return notFound;
  return ok({ ...done, pending: await pendingBatch(userId, id, deps) });
}

/** DELETE /api/invitations/:id/gallery/faces — every piece of the event's face data, now. */
export async function eraseFaces(userId: string, id: string, deps: FaceHostDeps): Promise<ApiResult> {
  const g = await ownerGate(userId, id, deps);
  if ('refused' in g) return g.refused;
  const done = await deps.db.ownerErase(id, userId);
  return done ? ok(done) : notFound;
}
