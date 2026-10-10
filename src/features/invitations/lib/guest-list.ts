import type { InvitationDocument } from '../contracts/types';
import { whatsappCapable } from './guest-import';
import { formatPhone } from './phone';
import { matchesGuestFilter, wasSent, type GuestFilter, type GuestLike } from './guest-status';

/**
 * What the guests screen and its WhatsApp dialog add to a guest's status: the "failed" filter, who
 * the system's WhatsApp can reach (and why not), and failure reasons in words. Isomorphic and pure.
 */

export interface ListGuest extends GuestLike {
  sendError?: string | null;
  /** asked the system's number to stop (a STOP reply, or they turned off our messages) */
  optedOut?: boolean;
  partySize?: number | null;
  response:
    | (NonNullable<GuestLike['response']> & {
        /** people beyond their invitation they asked to bring (waiting for the host) */
        extraRequested?: number | null;
        source?: 'guest' | 'host';
      })
    | null;
}

export type ListFilter = GuestFilter | 'failed' | 'extra';
/**
 * The list's filters, as the summary above it shows them: the status filters, then the two that need
 * the host — WhatsApp didn't get through ("failed"), asked to bring more people ("extra") — shown when
 * there are any.
 */
export const LIST_FILTERS = [
  'all',
  'notSent',
  'sent',
  'opened',
  'attending',
  'declined',
  'noReply',
  'failed',
  'extra',
] as const satisfies readonly ListFilter[];
/** the filters shown only when some guest is in them */
export const ATTENTION_FILTERS: readonly ListFilter[] = ['failed', 'extra'];

export function matchesListFilter(g: ListGuest, filter: ListFilter): boolean {
  // a failed send the guest got past (opened the link, answered) needs nothing from the host
  if (filter === 'failed') return g.sendStatus === 'failed' && !wasSent(g);
  if (filter === 'extra') return !!g.response?.attending && (g.response.extraRequested ?? 0) > 0;
  return matchesGuestFilter(g, filter);
}

/** A guest's invitation in people (a guest without a number is one). */
export const invitedPeople = (g: Pick<ListGuest, 'partySize'>) => g.partySize ?? 1;
/** The people a guest confirmed (0 without a "coming" reply). */
export const confirmedPeople = (g: Pick<ListGuest, 'response'>) =>
  g.response?.attending ? g.response.adults + g.response.children : 0;

/**
 * The list in people — what the seating and the event day count: invited (each guest's party size),
 * coming (confirmed), not coming (their invitation), and still waiting for an answer.
 */
export function peopleSummary(guests: readonly ListGuest[]): {
  invited: number;
  coming: number;
  declined: number;
  waiting: number;
} {
  let invited = 0;
  let coming = 0;
  let declined = 0;
  let waiting = 0;
  for (const g of guests) {
    invited += invitedPeople(g);
    if (!g.response) waiting += invitedPeople(g);
    else if (g.response.attending) coming += confirmedPeople(g);
    else declined += invitedPeople(g);
  }
  return { invited, coming, declined, waiting };
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

/** A price in shekels, in the host's language (₪0.14 / ‏0.14 ₪). */
export function formatIls(value: number, locale: 'he' | 'en'): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency',
    currency: 'ILS',
  }).format(value);
}

/**
 * A guest's personal link: the invitation with their token — and their language when it's one of the
 * invitation's other languages, so it opens in it (the cached page of that language; no switch).
 */
export function guestLink(
  base: string,
  slug: string,
  guest: { token: string; language?: string | null },
  doc: Pick<InvitationDocument, 'locales' | 'defaultLocale'>,
): string {
  const lang = guest.language;
  const own = !!lang && lang !== doc.defaultLocale && (doc.locales as readonly string[]).includes(lang);
  return `${base}/i/${slug}?g=${guest.token}${own ? `&lang=${lang}` : ''}`;
}

/** A guest's phone for the host: Israeli numbers as dialled (050-123-4567, 03-555-1234), others international. */
export const guestPhone = (e164: string | null): string => (e164 ? formatPhone(e164) : '');
