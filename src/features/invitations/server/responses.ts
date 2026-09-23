import 'server-only';
import type { DietaryKey, InvitationDocument, L10n, Locale } from '../contracts/types';
import { endOfDayUtc, formatDate, formatEventDate } from '../lib/dates';
import { formatPhone } from '../lib/phone';
import type { CustomQuestion, NotifyMode, ResponseRecord } from '../lib/responses';
import { hostsLine } from '../lib/text';
import { hostDb, type InvitationStatus, type OwnerInvitation } from './host-db';

/**
 * A reply as the dashboard shows it: the phone formatted for people (050-123-4567) and when it came
 * ("לפני שעה") — formatted here, so the server render and the browser agree.
 */
export type DashboardResponse = ResponseRecord & { phoneDisplay: string | null; receivedLabel: string };

/** A custom question with its label (and options') in the host's language. */
export interface DashboardQuestion {
  id: string;
  type: CustomQuestion['type'];
  label: string;
  options: { value: string; label: string }[];
}

export interface DashboardData {
  id: string;
  slug: string;
  status: InvitationStatus;
  /** "נועה & איתי" · "יום חמישי, 17 ביוני 2027" in the host's language when the invitation has it */
  title: string;
  dateLine: string;
  /** the RSVP deadline: end of that day in the event's time zone, and its date for people */
  deadline: { endUtc: number; label: string } | null;
  notify: NotifyMode;
  responses: DashboardResponse[];
  dietary: DietaryKey[];
  questions: DashboardQuestion[];
  /** the raw questions (CSV export) */
  rawQuestions: CustomQuestion[];
  timeZone: string;
  /** the invitation's language for the host's UI language (it may have only the other one) */
  locale: Locale;
  /** the moment the figures were computed (the page refreshes itself) */
  now: number;
}

/** "לפני 3 שעות" / "yesterday", then a short date after a month. */
export function receivedLabel(iso: string, now: number, uiLocale: Locale, timeZone: string): string {
  const rtf = new Intl.RelativeTimeFormat(uiLocale, { numeric: 'auto' });
  const s = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  if (abs < 30 * 86_400) return rtf.format(Math.round(s / (7 * 86_400)), 'week');
  return new Intl.DateTimeFormat(uiLocale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(iso));
}

/** What guests answered is the published document; before the first publish, the draft. */
const guestDocument = (inv: OwnerInvitation): InvitationDocument => inv.published ?? inv.draft;

export async function loadDashboard(
  id: string,
  ownerId: string,
  uiLocale: Locale,
): Promise<DashboardData | null> {
  const [inv, data] = await Promise.all([hostDb.get(id, ownerId), hostDb.responses(id, ownerId)]);
  if (!inv || !data) return null;
  const doc = guestDocument(inv);
  const locale: Locale = doc.locales.includes(uiLocale) ? uiLocale : doc.defaultLocale;
  const text = (v: L10n | null | undefined) => (v?.[locale] ?? v?.[doc.defaultLocale] ?? '').trim();
  const rsvp = doc.sections.find((s) => s.type === 'rsvp');
  const config = rsvp?.type === 'rsvp' ? rsvp.data : null;
  const deadline = doc.event.rsvpDeadline;
  const now = Date.now();
  return {
    id: inv.id,
    slug: inv.slug,
    status: inv.status,
    title: hostsLine(doc.hosts, locale),
    dateLine: formatEventDate(doc, locale),
    deadline: deadline
      ? {
          endUtc: endOfDayUtc(deadline, doc.timezone).getTime(),
          label: formatDate(deadline, locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        }
      : null,
    notify: data.notify,
    responses: data.responses.map((r) => ({
      ...r,
      phoneDisplay: r.phone ? formatPhone(r.phone) : null,
      receivedLabel: receivedLabel(r.createdAt, now, uiLocale, doc.timezone),
    })),
    dietary: config?.dietary.enabled ? config.dietary.options : [],
    questions: (config?.customQuestions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      label: text(q.label),
      options: (q.options ?? []).map((o) => ({ value: o.value, label: text(o.label) })),
    })),
    rawQuestions: config?.customQuestions ?? [],
    timeZone: doc.timezone,
    locale,
    now,
  };
}
