import { formatPhone } from './phone';

/**
 * Where each guest stands, from their record: the reply wins, then having opened the personal link,
 * then the delivery of the invitation (WhatsApp statuses or marked as sent by the host).
 * Isomorphic and pure — the guests screen, its CSV export and the tests share it.
 */

export type SendStatus = 'none' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface GuestLike {
  name: string;
  phone: string | null;
  group: string | null;
  sendStatus: SendStatus;
  sendChannel: 'whatsapp' | 'manual' | null;
  openedAt: string | null;
  response: { attending: boolean; adults: number; children: number } | null;
}

export type GuestState =
  'attending' | 'declined' | 'opened' | 'read' | 'delivered' | 'sent' | 'queued' | 'failed' | 'none';

export function guestState(g: GuestLike): GuestState {
  if (g.response) return g.response.attending ? 'attending' : 'declined';
  if (g.openedAt) return 'opened';
  return g.sendStatus;
}

/** The invitation reached them (sent, delivered, read, opened or answered). */
export const wasSent = (g: GuestLike) =>
  !!g.response || !!g.openedAt || ['sent', 'delivered', 'read'].includes(g.sendStatus);

export const GUEST_FILTERS = [
  'all',
  'notSent',
  'sent',
  'opened',
  'attending',
  'declined',
  'noReply',
] as const;
export type GuestFilter = (typeof GUEST_FILTERS)[number];

export function matchesGuestFilter(g: GuestLike, filter: GuestFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'notSent':
      return !wasSent(g);
    case 'sent':
      return wasSent(g);
    case 'opened':
      return !!g.openedAt || !!g.response;
    case 'attending':
      return g.response?.attending === true;
    case 'declined':
      return g.response?.attending === false;
    case 'noReply':
      return !g.response;
  }
}

/** Search by name, phone (any format: 050-…, 972…, +972…) or group. */
export function matchesGuestSearch(g: GuestLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (g.name.toLowerCase().includes(q) || (g.group ?? '').toLowerCase().includes(q)) return true;
  const digits = q.replace(/\D/g, '');
  if (digits.length < 3 || !g.phone) return false;
  const local = g.phone.startsWith('+972') ? `0${g.phone.slice(4)}` : g.phone.replace(/\D/g, '');
  return g.phone.replace(/\D/g, '').includes(digits) || local.includes(digits);
}

export interface GuestStats {
  total: number;
  sent: number;
  opened: number;
  /** replies "coming" and the people in them */
  attending: number;
  attendingPeople: number;
  declined: number;
  pending: number;
}

export function guestStats(list: readonly GuestLike[]): GuestStats {
  const stats: GuestStats = {
    total: list.length,
    sent: 0,
    opened: 0,
    attending: 0,
    attendingPeople: 0,
    declined: 0,
    pending: 0,
  };
  for (const g of list) {
    if (wasSent(g)) stats.sent++;
    if (g.openedAt || g.response) stats.opened++;
    if (!g.response) stats.pending++;
    else if (g.response.attending) {
      stats.attending++;
      stats.attendingPeople += g.response.adults + g.response.children;
    } else stats.declined++;
  }
  return stats;
}

/** 050-123-4567 / 03-123-4567 for Israeli numbers, +44 20… style otherwise (display only). */
export function displayPhone(e164: string | null): string {
  return e164 ? formatPhone(e164) : '';
}
