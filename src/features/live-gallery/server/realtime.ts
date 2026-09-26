import 'server-only';
import { serverEnv } from '@/lib/env';

/**
 * "Something changed" for a gallery's open pages — the guests' feed, the screen, the host's tab —
 * through Supabase Realtime's broadcast REST endpoint (no socket on the server). The message carries
 * no photos and no ids: pages then ask the API, with their link, what is new. A failure is logged
 * and swallowed (pages that miss a hint catch up on their next refresh).
 */

export type HintKind = 'items' | 'settings';

export async function broadcastRefresh(
  channel: string,
  kind: HintKind,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const env = serverEnv();
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key || !channel) return false;
  try {
    const res = await fetchImpl(`${base}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [{ topic: channel, event: 'refresh', payload: { kind, at: Date.now() }, private: false }],
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error('[gallery] broadcast answered', res.status);
    await res.body?.cancel().catch(() => undefined);
    return res.ok;
  } catch (err) {
    console.error('[gallery] broadcast failed', err);
    return false;
  }
}
