import 'server-only';
import { after } from 'next/server';
import { adminNudge } from '@/features/admin/server/live';
import { broadcastRefresh, realtimeInfo } from '@/lib/live/broadcast';
import { rateKey } from '@/lib/links/tokens';
import { serviceDb } from '@/lib/supabase/server';
import { TICKETS } from '../config';
import type { AdminTicketDeps } from './admin-api';
import type { TicketDeps } from './api';
import { adminSupportDb, ticketsDb } from './db';
import { emailCustomerReply, emailTeam, tellCustomerPage } from './notify';

/** The real dependencies of the tickets' APIs (tests pass their own). Call inside a request. */

/**
 * The hour's limit on new tickets (the app, the assistant and the contact form together) or on the
 * customer's messages, per `who` (u:<user> or ip:<address>) — the support assistant's counter
 * (support_rate_hit), under its own salted keys.
 */
export async function ticketRateHit(what: 'ticket' | 'reply', who: string): Promise<boolean> {
  const { data, error } = await serviceDb().rpc('support_rate_hit', {
    p_key_hash: rateKey('support', what, who),
    p_limit: what === 'ticket' ? TICKETS.openPerHour : TICKETS.repliesPerHour,
    p_window_seconds: 3600,
  });
  if (error) throw new Error(`support_rate_hit: ${error.message}`);
  return data === true;
}

const nudge = () => adminNudge('ticket');

export function ticketDeps(): TicketDeps {
  return {
    db: ticketsDb,
    rateHit: ticketRateHit,
    realtime: realtimeInfo,
    later: (job) => after(job),
    notifyTeam: emailTeam,
    nudge,
    broadcast: (channel, kind) => broadcastRefresh(channel, kind, fetch, 'support'),
  };
}

export function adminTicketDeps(): AdminTicketDeps {
  return {
    db: adminSupportDb,
    later: (job) => after(job),
    emailCustomer: emailCustomerReply,
    tellCustomer: tellCustomerPage,
    nudge,
  };
}
