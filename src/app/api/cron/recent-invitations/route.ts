import { serverEnv } from '@/lib/env';
import { invitationsEnabled } from '@/lib/feature';
import { sameSecret } from '@/lib/secrets';
import { serviceDb } from '@/lib/supabase/server';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * GET /api/cron/recent-invitations?hours=24 with `Authorization: Bearer <INVITES_CRON_SECRET>` — the
 * invitations published in the last `hours` (1–168, newest first, at most 50): their public addresses,
 * for the performance check of new invitations (scripts/lighthouse-budget.mjs --recent,
 * .github/workflows/lighthouse.yml). Addresses only — nothing about the hosts or their guests. Off
 * (404) without a secret.
 */
export async function GET(request: Request) {
  const env = serverEnv();
  const secret = env.INVITES_CRON_SECRET;
  if (!invitationsEnabled() || !secret) return new Response('Not found', { status: 404, headers: NO_STORE });
  if (!sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`))
    return new Response('Unauthorized', { status: 401, headers: NO_STORE });
  const hours = Math.min(168, Math.max(1, Number(new URL(request.url).searchParams.get('hours')) || 24));
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await serviceDb()
    .from('invitations')
    .select('slug, template_id, published_at')
    .eq('status', 'published')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[recent invitations]', error.message);
    return Response.json({ error: 'server_error' }, { status: 500, headers: NO_STORE });
  }
  const base = env.INVITES_PUBLIC_BASE_URL.replace(/\/+$/, '');
  return Response.json(
    {
      invitations: (data ?? []).map((row) => ({
        url: `${base}/i/${row.slug}`,
        template: row.template_id,
        publishedAt: row.published_at,
      })),
    },
    { headers: NO_STORE },
  );
}
