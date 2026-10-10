import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { packageFor, planForPackage, whyOff, type FeatureInput } from '@/features/flags/features';
import { safeMigrateDocument } from '@/features/invitations/contracts/migrate';
import { LOCALES } from '@/features/invitations/contracts/types';
import { AI_PHOTOS } from '../config';
import { ROLES, defaultPeople, rolesFor } from '../model';
import type { AiFeatureState, HostAiPerson, HostAiPhoto, HostAiView } from '../types';
import type { AiPhotoDb, OwnerAi, PhotoRow } from './db';

/**
 * The hosts' side of the AI photos (feature ai_photos) as plain functions over injected dependencies
 * (tests in tests/unit/ai-photos-api.test.ts): the people of honor — each with a role, a name in the
 * invitation's languages, a few words and a photo (re-encoded here: no metadata kept) — the settings
 * (on, the limits, adding to the gallery, the consent), and every photo the guests made (seen and
 * deleted). Every call checks the owner (the database functions do too).
 */

export type ApiResult = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): ApiResult => ({
  status,
  body: { ok: false, code, ...extra },
});
const notFound = fail(404, 'not_found');
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface AiHostDeps {
  db: Pick<
    AiPhotoDb,
    'ownerGet' | 'ownerSettings' | 'personSave' | 'personDelete' | 'ownerList' | 'ownerDelete'
  >;
  featureInput(invitationId: string): Promise<(FeatureInput & { ownerId: string }) | null>;
  /** read links of the ai-photos bucket */
  sign(paths: string[]): Promise<Map<string, string>>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  /** a person's photo as stored: a JPEG ≤ AI_PHOTOS.people.maxEdge, no metadata (null: not a photo) */
  portrait(bytes: Uint8Array): Promise<Uint8Array | null>;
  /** files were deleted: remove them from storage now */
  sweep(): Promise<void>;
}

function featureState(input: FeatureInput): AiFeatureState {
  const why = whyOff('ai_photos', input);
  const pkg = packageFor('ai_photos');
  return { on: why === null, why, package: pkg, plan: planForPackage(pkg) };
}

async function gate(userId: string, id: string, deps: Pick<AiHostDeps, 'featureInput'>) {
  if (!isUuid(id)) return null;
  const input = await deps.featureInput(id);
  if (!input || input.ownerId !== userId) return null;
  return input;
}

async function viewOf(
  id: string,
  owned: OwnerAi,
  feature: AiFeatureState,
  deps: AiHostDeps,
): Promise<HostAiView | null> {
  const parsed = safeMigrateDocument(owned.document);
  if (!parsed.success) return null;
  const doc = parsed.data;
  const urls = await deps.sign(owned.people.map((p) => p.photoPath).filter((p): p is string => !!p));
  const people: HostAiPerson[] = owned.people.map((p) => ({
    id: p.id,
    role: p.role,
    name: p.name,
    description: p.description,
    photo: p.photoPath ? (urls.get(p.photoPath) ?? null) : null,
  }));
  return {
    id,
    slug: owned.slug,
    feature,
    settings: owned.settings,
    people,
    counts: owned.counts,
    gallery: owned.gallery,
    event: { eventType: doc.eventType, locales: [...doc.locales], defaultLocale: doc.defaultLocale },
    roles: rolesFor(doc.eventType),
    suggested: defaultPeople(doc),
  };
}

/** The hosts' view (null when the invitation isn't theirs). */
export async function aiHostView(userId: string, id: string, deps: AiHostDeps): Promise<HostAiView | null> {
  const input = await gate(userId, id, deps);
  if (!input) return null;
  const owned = await deps.db.ownerGet(id, userId);
  return owned ? viewOf(id, owned, featureState(input), deps) : null;
}

async function viewResult(
  userId: string,
  id: string,
  input: FeatureInput,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const owned = await deps.db.ownerGet(id, userId);
  const view = owned ? await viewOf(id, owned, featureState(input), deps) : null;
  return view ? ok({ view }) : notFound;
}

/** GET /api/invitations/:id/ai-photos */
export async function getAi(userId: string, id: string, deps: AiHostDeps): Promise<ApiResult> {
  const view = await aiHostView(userId, id, deps);
  return view ? ok({ view }) : notFound;
}

const { perGuest, perEvent } = AI_PHOTOS.limits;
export const SettingsSchema = z
  .strictObject({
    enabled: z.boolean().optional(),
    perGuest: z.number().int().min(perGuest.min).max(perGuest.max).optional(),
    perEvent: z.number().int().min(perEvent.min).max(perEvent.max).optional(),
    toGallery: z.boolean().optional(),
    /** the host says the people in the photos agreed (false takes it back) */
    consent: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0);

const featureOff = (f: AiFeatureState) =>
  fail(403, 'feature_off', { feature: 'ai_photos', reason: f.why, package: f.package });

/** PATCH /api/invitations/:id/ai-photos — the settings (only what is sent changes). */
export async function updateAiSettings(
  userId: string,
  id: string,
  raw: unknown,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const input = await gate(userId, id, deps);
  if (!input) return notFound;
  const feature = featureState(input);
  // turning it off (or the consent back) is always the host's; the rest needs the feature
  const off = parsed.data.enabled === false || parsed.data.consent === false;
  if (!feature.on && !off) return featureOff(feature);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) patch[key] = value;
  const done = await deps.db.ownerSettings(id, userId, patch);
  if (!done) return notFound;
  if (!done.ok) return fail(409, done.code);
  return viewResult(userId, id, input, deps);
}

/** A photo sent as base64 (a data URL's prefix allowed). */
const Base64 = z
  .string()
  .max(Math.ceil((AI_PHOTOS.people.maxBytes * 4) / 3) + 64)
  .transform((s) => s.replace(/^data:[^,]*,/, ''));

export const PersonSchema = z.strictObject({
  id: z.uuid().optional(),
  role: z.enum(ROLES),
  name: z.partialRecord(z.enum(LOCALES), z.string().trim().max(AI_PHOTOS.people.nameLength)),
  description: z.string().trim().max(AI_PHOTOS.people.descriptionLength).nullable().optional(),
  photo: Base64.optional(),
});

/** POST /api/invitations/:id/ai-photos/people — adds a person of honor or changes one (with their photo). */
export async function savePerson(
  userId: string,
  id: string,
  raw: unknown,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const parsed = PersonSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const input = await gate(userId, id, deps);
  if (!input) return notFound;
  const feature = featureState(input);
  if (!feature.on) return featureOff(feature);
  const q = parsed.data;
  const name = Object.fromEntries(Object.entries(q.name).filter(([, v]) => !!v?.trim()));
  if (!Object.keys(name).length) return fail(400, 'invalid', { field: 'name' });
  let photoPath: string | null = null;
  let photoSize: number | null = null;
  if (q.photo) {
    const bytes = new Uint8Array(Buffer.from(q.photo, 'base64'));
    if (!bytes.length || bytes.length > AI_PHOTOS.people.maxBytes) return fail(400, 'too_large');
    const portrait = await deps.portrait(bytes);
    if (!portrait) return fail(400, 'unsupported_type');
    photoPath = `${id}/people/${randomUUID()}/photo.jpg`;
    photoSize = portrait.length;
    await deps.upload(photoPath, portrait, 'image/jpeg');
  }
  const saved = await deps.db.personSave(
    id,
    userId,
    {
      ...(q.id ? { id: q.id } : {}),
      role: q.role,
      name,
      ...(q.description !== undefined ? { description: q.description } : {}),
      ...(photoPath ? { photoPath, photoSize } : {}),
    },
    AI_PHOTOS.people.max,
  );
  if (!saved || 'error' in saved) {
    if (photoPath) await deps.remove([photoPath]).catch(() => undefined);
    return saved ? fail(409, 'full', { max: AI_PHOTOS.people.max }) : notFound;
  }
  // the photo it had before is in the trash queue now (a trigger): remove it
  if (photoPath) await deps.sweep();
  return viewResult(userId, id, input, deps);
}

const DeletePersonSchema = z.strictObject({ personId: z.uuid() });

/** DELETE /api/invitations/:id/ai-photos/people { personId } — a person and their photo. */
export async function deletePerson(
  userId: string,
  id: string,
  raw: unknown,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const parsed = DeletePersonSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const input = await gate(userId, id, deps);
  if (!input) return notFound;
  const done = await deps.db.personDelete(id, userId, parsed.data.personId);
  if (done === null) return notFound;
  await deps.sweep();
  return viewResult(userId, id, input, deps);
}

/** A photo as the host sees it: links to the result, its thumbnail and the guest's own photo. */
export function hostPhoto(p: PhotoRow, urls: Map<string, string>): HostAiPhoto {
  const url = (path: string | null) => (path ? (urls.get(path) ?? null) : null);
  return {
    id: p.id,
    status: p.status,
    error: p.error,
    prompt: p.prompt,
    guestName: p.guestName,
    people: p.people,
    thumb: url(p.thumbPath),
    result: url(p.resultPath),
    source: url(p.sourcePath),
    shared: !!p.galleryItemId,
    createdAt: p.createdAt,
  };
}

const PAGE = 60;

/** GET /api/invitations/:id/ai-photos/photos?before= — the guests' photos, newest first. */
export async function listPhotos(
  userId: string,
  id: string,
  before: string | null,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const input = await gate(userId, id, deps);
  if (!input) return notFound;
  const at = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : null;
  const rows = await deps.db.ownerList(id, userId, at, PAGE);
  if (!rows) return notFound;
  const urls = await deps.sign(
    rows.flatMap((r) => [r.thumbPath, r.resultPath, r.sourcePath]).filter((p): p is string => !!p),
  );
  return ok({
    photos: rows.map((r) => hostPhoto(r, urls)),
    next: rows.length === PAGE ? rows.at(-1)!.createdAt : null,
  });
}

const DeletePhotosSchema = z.strictObject({
  action: z.literal('delete'),
  ids: z.array(z.uuid()).min(1).max(200),
});

/** POST /api/invitations/:id/ai-photos/photos { action: 'delete', ids } — the photos and their files. */
export async function deletePhotos(
  userId: string,
  id: string,
  raw: unknown,
  deps: AiHostDeps,
): Promise<ApiResult> {
  const parsed = DeletePhotosSchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'invalid');
  const input = await gate(userId, id, deps);
  if (!input) return notFound;
  const n = await deps.db.ownerDelete(id, userId, [...new Set(parsed.data.ids)]);
  if (n === null) return notFound;
  await deps.sweep();
  return ok({ count: n });
}
