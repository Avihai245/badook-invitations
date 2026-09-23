import 'server-only';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { invitationsEnabled } from '@/lib/feature';
import { getSessionUser } from '@/lib/supabase/session';
import { getTemplate } from '../templates/registry';
import type { ApiResult, HostDeps } from './host-api';
import { hostDb } from './host-db';

const NO_STORE = { 'cache-control': 'no-store' };
/** Drafts are a few KB; this only stops abuse. */
export const MAX_JSON_BYTES = 512 * 1024;

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/** Refreshes the cached public page of an invitation in every language path (/i/<slug>/<lang>). */
function revalidate(slug: string) {
  for (const lang of ['he', 'en', 'default']) revalidatePath(`/i/${slug}/${lang}`);
}

export const hostDeps: HostDeps = { db: hostDb, template: getTemplate, revalidate, now: () => Date.now() };

/**
 * Wraps a host API route: feature flag, JSON-only bodies (a cross-site form can't post here; with the
 * SameSite=Lax session cookie that closes CSRF), size cap, a verified user, no caching, and no
 * internal errors leaking to the client.
 */
export async function hostRoute(
  request: Request,
  handler: (userId: string, body: unknown, deps: HostDeps) => Promise<ApiResult>,
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
      return json(415, { ok: false, code: 'unsupported_media_type' });
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return json(413, { ok: false, code: 'too_large' });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return json(400, { ok: false, code: 'invalid_json' });
    }
  }
  const user = await getSessionUser();
  if (!user) return json(401, { ok: false, code: 'unauthorized' });
  try {
    const result = await handler(user.id, body, hostDeps);
    return json(result.status, result.body);
  } catch (err) {
    console.error('[host api]', request.method, new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}
