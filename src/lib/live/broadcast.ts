import 'server-only';
import { serverEnv } from '@/lib/env';
import type { RealtimeInfo } from './types';

/**
 * "Something changed" for the open pages of one channel — the live gallery's feed, screen and tab, the
 * entrance stations and the host's live hall — through Supabase Realtime's broadcast REST endpoint (no
 * socket on the server). The message carries no data and no ids: pages then ask their API, with their
 * link, what is new. A failure is logged and swallowed (pages that miss a hint catch up on their next
 * refresh).
 */
export async function broadcastRefresh(
  channel: string,
  kind: string,
  fetchImpl: typeof fetch = fetch,
  label = 'live',
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
    if (!res.ok) console.error(`[${label}] broadcast answered`, res.status);
    await res.body?.cancel().catch(() => undefined);
    return res.ok;
  } catch (err) {
    console.error(`[${label}] broadcast failed`, err);
    return false;
  }
}

/** Where pages listen for a channel's hints (null when Supabase isn't set up). */
export function realtimeInfo(channel: string): RealtimeInfo | null {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, ''),
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    channel,
  };
}
