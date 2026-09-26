'use client';

import type { Party, RecentCheckin, Totals } from '../../model';
import type { RealtimeInfo } from '@/lib/live/types';

/** The entrance station's calls (/api/checkin/*): JSON in and out, never cached; a lost network is status 0. */
export async function stationApi<T = Record<string, unknown>>(
  path: 'station' | 'find' | 'search' | 'arrive' | 'undo',
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ status: number; body: (T & { ok?: boolean; code?: string }) | null }> {
  try {
    const res = await fetch(`/api/checkin/${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return {
      status: res.status,
      body: (await res.json().catch(() => null)) as (T & { ok?: boolean; code?: string }) | null,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { status: 0, body: null };
  }
}

export type StationState = { totals: Totals; recent: RecentCheckin[]; realtime: RealtimeInfo | null };
export type PartyAnswer = { party: Party };
export type ArriveAnswer = { checkinId: string; party: Party; totals: Totals };
