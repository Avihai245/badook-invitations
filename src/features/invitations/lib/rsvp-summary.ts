import { toE164 } from './phone';

/**
 * One count of RSVPs for every screen (the overview, the guest list, the replies, the event's home): a
 * reply counts once, whether it came through a guest's personal link or the invitation's general one,
 * and the screens say how many of the "yes" came from the general link — those belong to no guest on
 * the list until the host matches them (rsvp_link_guest.sql). "Not answered" is the guests on the list
 * with no reply of their own. Pure and isomorphic: the screens and the tests share it.
 */

export interface ReplyLike {
  id: string;
  attending: boolean;
  adults: number;
  children: number;
  /** the guest it belongs to; null (or missing): the general link */
  guestId?: string | null;
}

export interface ListedGuestLike {
  id: string;
  response: unknown | null;
}

export interface RsvpSummary {
  /** every reply */
  replies: number;
  /** "yes" replies, and the people in them */
  coming: number;
  comingPeople: number;
  /** of the "yes": the ones that came through the general link, matched to no guest */
  comingFromLink: number;
  /** "no" replies */
  declined: number;
  /** replies matched to no guest on the list (yes and no) */
  unmatched: number;
  /** guests on the list */
  listed: number;
  /** guests on the list with no reply of their own */
  notAnswered: number;
}

export function rsvpSummary(guests: readonly ListedGuestLike[], replies: readonly ReplyLike[]): RsvpSummary {
  const onList = new Set(guests.map((g) => g.id));
  const s: RsvpSummary = {
    replies: replies.length,
    coming: 0,
    comingPeople: 0,
    comingFromLink: 0,
    declined: 0,
    unmatched: 0,
    listed: guests.length,
    notAnswered: guests.filter((g) => !g.response).length,
  };
  for (const r of replies) {
    const matched = !!r.guestId && onList.has(r.guestId);
    if (!matched) s.unmatched++;
    if (r.attending) {
      s.coming++;
      s.comingPeople += r.adults + r.children;
      if (!matched) s.comingFromLink++;
    } else s.declined++;
  }
  return s;
}

/** Comparable form of a name: no punctuation, single spaces, lower case. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The guests a general-link reply most likely is, best first: the same phone, then the same name, then
 * a name that contains the other (a first name on the list, a full name in the reply). Only guests who
 * have no reply of their own.
 */
export function suggestGuests<
  G extends { id: string; name: string; phone: string | null; response: unknown | null },
>(reply: { name: string; phone: string | null }, guests: readonly G[], limit = 3): G[] {
  const phone = reply.phone ? toE164(reply.phone) : null;
  const name = nameKey(reply.name);
  const scored: { g: G; score: number }[] = [];
  for (const g of guests) {
    if (g.response) continue;
    let score = 0;
    if (phone && g.phone && toE164(g.phone) === phone) score = 3;
    else {
      const other = nameKey(g.name);
      if (other && name && other === name) score = 2;
      else if (other && name && (other.includes(name) || name.includes(other))) score = 1;
    }
    if (score) scored.push({ g, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.g);
}
