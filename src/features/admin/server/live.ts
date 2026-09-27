import 'server-only';
import { broadcastRefresh, realtimeInfo } from '@/lib/live/broadcast';
import type { RealtimeInfo } from '@/lib/live/types';
import { randomId } from '@/lib/links/tokens';
import { adminDb } from './db';
import type { Staff } from './gate';

/**
 * The admin console's live updates: its pages listen on one random channel (made the first time a
 * console page opens, admin_channel) and refresh when the server says something changed there — a
 * signup, an invitation, an RSVP, a message, a payment, a ticket. The hint carries no data and no ids
 * (lib/live/broadcast.ts); the pages then ask again with the staff member's session.
 */

/** What changed (the pages may refresh only what it touches). */
export type AdminNudgeKind =
  | 'user'
  | 'invitation'
  | 'rsvp'
  | 'message'
  | 'payment'
  | 'credits'
  | 'ticket'
  | 'partner'
  | 'staff'
  | 'system';

/** The channel as this server last read it (a renamed one reaches every server within this). */
const CHANNEL_TTL_MS = 5 * 60_000;
let cached: { channel: string | null; at: number } | null = null;

async function channel(): Promise<string | null> {
  const now = Date.now();
  // "no channel yet" isn't kept: the first console page makes one at any moment, and each part of the
  // server (pages, routes, actions) keeps its own copy of this — one that remembered "none" would stay
  // silent for minutes
  if (cached?.channel && now - cached.at < CHANNEL_TTL_MS) return cached.channel;
  const value = await adminDb.channelPeek();
  cached = { channel: value, at: now };
  return value;
}

/**
 * Tells the console's open pages that something changed. Never throws and never waits long (3 s):
 * call it after the answer (next/server `after`). Until a console page was first opened there is no
 * channel and nothing to tell.
 */
export async function adminNudge(kind: AdminNudgeKind, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    const name = await channel();
    if (name) await broadcastRefresh(name, kind, fetchImpl, 'admin');
  } catch (err) {
    console.error('[admin] nudge', err);
  }
}

/** Where a console page listens (the channel made on first use; null when Supabase isn't set up). */
export async function adminRealtime(staff: Staff): Promise<RealtimeInfo | null> {
  const name = await adminDb.channel(staff.userId, randomId());
  cached = { channel: name, at: Date.now() };
  return realtimeInfo(name);
}

/** A new channel name (an owner): pages opened before it stop hearing; hints go to the new one. */
export async function rotateAdminChannel(staff: Staff): Promise<string> {
  const name = await adminDb.channelRotate(staff.userId, randomId());
  cached = { channel: name, at: Date.now() };
  return name;
}
