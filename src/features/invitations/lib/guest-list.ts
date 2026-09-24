import { whatsappCapable } from './guest-import';
import { matchesGuestFilter, wasSent, type GuestFilter, type GuestLike } from './guest-status';

/**
 * What the guests screen and its WhatsApp dialog add to a guest's status: the "failed" filter, who
 * the system's WhatsApp can reach (and why not), and failure reasons in words. Isomorphic and pure.
 */

export interface ListGuest extends GuestLike {
  sendError?: string | null;
  /** asked the system's number to stop (a STOP reply, or they turned off our messages) */
  optedOut?: boolean;
}

export type ListFilter = GuestFilter | 'failed';
/** The list's filters: the status filters, with "failed" (WhatsApp didn't get through) after "sent". */
export const LIST_FILTERS = [
  'all',
  'notSent',
  'sent',
  'failed',
  'opened',
  'attending',
  'declined',
  'noReply',
] as const satisfies readonly ListFilter[];

export function matchesListFilter(g: ListGuest, filter: ListFilter): boolean {
  // a failed send the guest got past (opened the link, answered) needs nothing from the host
  if (filter === 'failed') return g.sendStatus === 'failed' && !wasSent(g);
  return matchesGuestFilter(g, filter);
}

/** Whether the system's WhatsApp can send to this guest, or why not. */
export type WhatsappReach = 'ok' | 'noPhone' | 'landline' | 'optedOut';

export function whatsappReach(g: Pick<ListGuest, 'phone' | 'optedOut'>): WhatsappReach {
  if (!g.phone) return 'noPhone';
  if (!whatsappCapable(g.phone)) return 'landline';
  return g.optedOut ? 'optedOut' : 'ok';
}

/** Failures the host can act on, from the reason stored with the guest ('timeout', '131026 · …'). */
export type SendFailure = 'timeout' | 'optedOut' | 'notOnWhatsapp' | 'limited' | 'other';

export function sendFailure(error: string | null | undefined): SendFailure {
  if (!error) return 'other';
  if (error === 'timeout') return 'timeout';
  if (error === 'opted_out' || error.startsWith('131050')) return 'optedOut';
  if (error.startsWith('131026')) return 'notOnWhatsapp';
  // Meta's per-guest limit on marketing messages, and rate limits that outlasted the retries
  if (/^(131049|131048|130429|80007|131056)\b/.test(error)) return 'limited';
  return 'other';
}
