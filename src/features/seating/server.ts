import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { featureInput } from '@/features/flags/server';
import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { serviceDb } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/supabase/session';
import type { ApiResult, SaveAnswer, SeatingDeps } from './api';

/** The floor plans' bucket (supabase/migrations/*_seating.sql). */
export const PLAN_BUCKET = 'venue-plans';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await serviceDb().rpc(fn, args);
  if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
  return data as T;
}

/** The seating API's dependencies on Supabase (the service role; every function checks the owner). */
export const seatingDeps: SeatingDeps = {
  access: featureInput,
  state: (id, ownerId) => rpc<unknown | null>('seating_state', { p_id: id, p_owner: ownerId }),
  save: (id, ownerId, version, plan) =>
    rpc<SaveAnswer | null>('seating_save', { p_id: id, p_owner: ownerId, p_version: version, p_plan: plan }),
  async signedUpload(path) {
    const { data, error } = await serviceDb().storage.from(PLAN_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`signed upload: ${error?.message ?? 'no data'}`);
    return { path: data.path, url: data.signedUrl, token: data.token };
  },
  newId: randomUUID,
};

/** Where the browser reads floor plans from (public URLs). */
export function planBaseUrl(): string {
  const url = serverEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  return url ? `${url}/storage/v1/object/public/${PLAN_BUCKET}` : '';
}

const NO_STORE = { 'cache-control': 'no-store' };
/** A plan for a large event (hundreds of tables, thousands of seats) stays well under this. */
export const MAX_SEATING_JSON = 2 * 1024 * 1024;
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * A seating API route: like the host routes (features/invitations/server/host-route.ts) — the
 * invitations flag, JSON-only bodies (a cross-site form can't post here), a size cap, a verified user, no
 * caching, no internal errors shown — with room for a large event's whole plan.
 */
export async function seatingRoute(
  request: Request,
  handler: (userId: string, body: unknown) => Promise<ApiResult>,
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
      return json(415, { ok: false, code: 'unsupported_media_type' });
    const text = await request.text();
    if (text.length > MAX_SEATING_JSON) return json(413, { ok: false, code: 'too_large' });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return json(400, { ok: false, code: 'invalid_json' });
    }
  }
  const user = await getSessionUser();
  if (!user) return json(401, { ok: false, code: 'unauthorized' });
  try {
    const result = await handler(user.id, body);
    return json(result.status, result.body);
  } catch (err) {
    console.error('[seating api]', request.method, new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}
