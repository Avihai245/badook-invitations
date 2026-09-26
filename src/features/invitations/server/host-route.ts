import 'server-only';
import { revalidatePath } from 'next/cache';
import { after, NextResponse } from 'next/server';
import { entitlementsFor, isAdminEmail } from '@/features/billing/server/account';
import type { Feature } from '@/features/flags/features';
import { accountFeatures, featuresFor } from '@/features/flags/server';
import { invitationsEnabled } from '@/lib/feature';
import { broadcastRefresh } from '@/lib/live/broadcast';
import { getSessionUser } from '@/lib/supabase/session';
import { voiceDeps } from '@/features/voice/server/deps';
import { processVoice, queueVoice } from '@/features/voice/server/voice';
import { LOCALES } from '../contracts/types';
import { getTemplate } from '../templates/registry';
import { translationRows } from '../translate/deps';
import { cinematicFor } from './cinematic';
import type { ApiResult, HostDeps } from './host-api';
import { hostDb } from './host-db';

const NO_STORE = { 'cache-control': 'no-store' };
/** Drafts are a few KB; this only stops abuse. */
export const MAX_JSON_BYTES = 512 * 1024;

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * Refreshes the cached public page of an invitation in every language. A page is cached under the
 * path the guest asked for: /i/<slug> (?lang= is a rewrite to /i/<slug>/<lang>), or /i/<slug>/<lang>
 * when that was requested directly.
 */
function revalidate(slug: string) {
  revalidatePath(`/i/${slug}`);
  for (const lang of [...LOCALES, 'default']) revalidatePath(`/i/${slug}/${lang}`);
}

export const hostDeps: HostDeps = {
  db: hostDb,
  template: getTemplate,
  revalidate,
  now: () => Date.now(),
  translations: translationRows,
  broadcast: (channel, kind) => broadcastRefresh(channel, kind, fetch, 'invitations'),
  // the invitation read aloud: after the answer, never in its way (features/voice)
  voice: (id, ownerId, doc) =>
    after(async () => {
      const deps = voiceDeps();
      if (await queueVoice(id, ownerId, doc, deps)) await processVoice(id, deps).catch(() => undefined);
    }),
};

/**
 * Wraps a host API route: feature flag, JSON-only bodies (a cross-site form can't post here; with the
 * SameSite=Lax session cookie that closes CSRF), size cap, a verified user, no caching, and no
 * internal errors leaking to the client.
 */
export async function hostRoute(
  request: Request,
  handler: (
    userId: string,
    body: unknown,
    deps: HostDeps,
    user: { id: string; email: string | null },
  ) => Promise<ApiResult>,
  /** a larger body for the few routes that take one (the design studio's photos) */
  { maxBytes = MAX_JSON_BYTES }: { maxBytes?: number } = {},
): Promise<Response> {
  if (!invitationsEnabled()) return json(404, { ok: false, code: 'not_found' });
  let body: unknown = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
      return json(415, { ok: false, code: 'unsupported_media_type' });
    const text = await request.text();
    if (text.length > maxBytes) return json(413, { ok: false, code: 'too_large' });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return json(400, { ok: false, code: 'invalid_json' });
    }
  }
  const user = await getSessionUser();
  if (!user) return json(401, { ok: false, code: 'unauthorized' });
  try {
    // the plan's limits, read only by the handlers that need them
    let entitlements: ReturnType<typeof entitlementsFor> | null = null;
    const features = new Map<string, Promise<ReadonlySet<Feature>>>();
    const deps: HostDeps = {
      ...hostDeps,
      entitlements: () => (entitlements ??= entitlementsFor(user)),
      // an event's features (or, for a new one, the host's plan's), read once per request
      features: (id) => {
        const key = id ?? '';
        let pending = features.get(key);
        if (!pending)
          features.set(key, (pending = id ? featuresFor(id) : accountFeatures(user).then((a) => a.features)));
        return pending;
      },
      cinematic: cinematicFor,
      admin: isAdminEmail(user.email),
    };
    const result = await handler(user.id, body, deps, { id: user.id, email: user.email ?? null });
    return json(result.status, result.body);
  } catch (err) {
    console.error('[host api]', request.method, new URL(request.url).pathname, err);
    return json(500, { ok: false, code: 'server_error' });
  }
}
