import type { DietaryKey, L10n, Locale, RsvpConfig } from '../contracts/types';

/**
 * The responses dashboard's arithmetic (§9B.3-G) and the CSV export (§12.7) — pure, so the numbers
 * the host sees are unit-tested. Records come from the owner_responses RPC.
 */

export type NotifyMode = 'each' | 'digest' | 'off';
export const NOTIFY_MODES: readonly NotifyMode[] = ['each', 'digest', 'off'];

export interface ResponseAttendee {
  kind: 'adult' | 'child';
  position: number;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  age: number | null;
  dietary: DietaryKey[];
  dietaryNotes: string | null;
}

export interface ResponseRecord {
  id: string;
  attending: boolean;
  locale: Locale;
  name: string;
  /** E.164 when it parsed (see lib/phone), else as typed */
  phone: string | null;
  email: string | null;
  adults: number;
  children: number;
  message: string | null;
  answers: Record<string, string | boolean>;
  createdAt: string;
  updatedAt: string;
  attendees: ResponseAttendee[];
}

export type CustomQuestion = RsvpConfig['customQuestions'][number];

const DAY = 86_400_000;

export interface ResponseStats {
  responses: number;
  /** guests coming: adults + children of the "yes" replies */
  attending: number;
  adults: number;
  children: number;
  declined: number;
  /** share of the replies that are "no", 0..100, rounded */
  declinedPct: number;
  /** replies received in the last 7 days */
  newThisWeek: number;
}

export function responseStats(list: readonly ResponseRecord[], now: number): ResponseStats {
  let adults = 0;
  let children = 0;
  let declined = 0;
  let newThisWeek = 0;
  for (const r of list) {
    if (r.attending) {
      adults += r.adults;
      children += r.children;
    } else declined++;
    if (now - Date.parse(r.createdAt) <= 7 * DAY) newThisWeek++;
  }
  return {
    responses: list.length,
    attending: adults + children,
    adults,
    children,
    declined,
    declinedPct: list.length ? Math.round((declined / list.length) * 100) : 0,
    newThisWeek,
  };
}

/** Whole days from `now` until the end of the deadline day (in the event's time zone); negative after. */
export function daysUntil(deadlineEndUtc: number, now: number): number {
  return Math.ceil((deadlineEndUtc - now) / DAY);
}

/**
 * Guests per dietary option (attendees of "yes" replies), in the order the invitation offers them. An
 * attendee who picked nothing counts as `none` when the invitation offers it.
 */
export function dietaryCounts(
  list: readonly ResponseRecord[],
  options: readonly DietaryKey[],
): { key: DietaryKey; count: number }[] {
  const counts = new Map<DietaryKey, number>(options.map((k) => [k, 0]));
  for (const r of list) {
    if (!r.attending) continue;
    for (const a of r.attendees) {
      const keys: DietaryKey[] = a.dietary.length ? a.dietary : options.includes('none') ? ['none'] : [];
      for (const k of keys) if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
    }
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}

/** The dietary tags of one reply (every attendee's, once each; "no preference" left out). */
export function replyDietary(r: ResponseRecord): DietaryKey[] {
  return [...new Set(r.attendees.flatMap((a) => a.dietary))].filter((k) => k !== 'none');
}

/**
 * Answers to a select or yes/no question of the "yes" replies, weighted by party size (a shuttle for
 * 3 people is 3 seats). Text questions have no breakdown (null).
 */
export function questionBreakdown(
  list: readonly ResponseRecord[],
  q: CustomQuestion,
): { value: string; count: number }[] | null {
  if (q.type === 'text') return null;
  const values = q.type === 'boolean' ? ['true', 'false'] : (q.options ?? []).map((o) => o.value);
  const counts = new Map(values.map((v) => [v, 0]));
  for (const r of list) {
    if (!r.attending) continue;
    const answer = r.answers[q.id];
    // a select nobody changed keeps its first option (the form sends it); an unanswered yes/no is "no"
    const v = answer === undefined ? (q.type === 'boolean' ? 'false' : values[0]) : String(answer);
    if (v !== undefined && counts.has(v)) counts.set(v, counts.get(v)! + r.adults + r.children);
  }
  return [...counts].map(([value, count]) => ({ value, count }));
}

/** An attendee's display name ("Dana Levi", or the child's full name). */
export function attendeeName(a: ResponseAttendee): string {
  return (a.fullName ?? [a.firstName, a.lastName].filter(Boolean).join(' ')).trim();
}

/** Case- and accent-insensitive search over name, phone (digits) and email. */
export function matchesSearch(r: ResponseRecord, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const phoneDigits = (r.phone ?? '').replace(/\D/g, '');
  const localDigits = phoneDigits.replace(/^972/, '0');
  return (
    r.name.toLocaleLowerCase().includes(q) ||
    (r.email ?? '').toLocaleLowerCase().includes(q) ||
    r.attendees.some((a) => attendeeName(a).toLocaleLowerCase().includes(q)) ||
    (digits.length >= 3 && (phoneDigits.includes(digits) || localDigits.includes(digits)))
  );
}

// ─── CSV ──────────────────────────────────────────────────────────────────────────────────────────

export interface CsvLabels {
  name: string;
  status: string;
  attending: string;
  declined: string;
  adults: string;
  children: string;
  phone: string;
  email: string;
  guests: string;
  dietary: string;
  dietaryNotes: string;
  message: string;
  language: string;
  received: string;
  updated: string;
  yes: string;
  no: string;
  diet: Record<DietaryKey, string>;
  localeName: Record<Locale, string>;
}

/**
 * A spreadsheet cell: quoted when needed, and never a formula — cells starting with = + - @ (or a
 * tab/CR) get a leading apostrophe (CSV injection, OWASP).
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The export (§12.7 "opens in Excel with correct Hebrew"): UTF-8 with a byte-order mark, CRLF rows,
 * one row per reply, the invitation's custom questions as columns (labels in `uiLocale`, answers as
 * their option labels), dates in the event's time zone.
 */
export function responsesCsv(
  list: readonly ResponseRecord[],
  opts: {
    labels: CsvLabels;
    questions: readonly CustomQuestion[];
    uiLocale: Locale;
    fallbackLocale: Locale;
    timeZone: string;
    formatPhone: (phone: string) => string;
  },
): string {
  const { labels: L, questions, uiLocale, fallbackLocale, timeZone } = opts;
  const text = (v: L10n | null | undefined) => (v?.[uiLocale] ?? v?.[fallbackLocale] ?? '').trim();
  const when = new Intl.DateTimeFormat(uiLocale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  });
  const answer = (q: CustomQuestion, r: ResponseRecord) => {
    const v = r.answers[q.id];
    if (v === undefined || !r.attending) return '';
    if (q.type === 'boolean') return v === true ? L.yes : L.no;
    if (q.type === 'select') return text(q.options?.find((o) => o.value === v)?.label) || String(v);
    return String(v);
  };
  const header = [
    L.name,
    L.status,
    L.adults,
    L.children,
    L.phone,
    L.email,
    L.guests,
    L.dietary,
    L.dietaryNotes,
    ...questions.map((q) => text(q.label)),
    L.message,
    L.language,
    L.received,
    L.updated,
  ];
  const rows = list.map((r) => {
    const counts = new Map<DietaryKey, number>();
    for (const a of r.attendees) for (const k of a.dietary) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [
      r.name,
      r.attending ? L.attending : L.declined,
      r.adults,
      r.children,
      r.phone ? opts.formatPhone(r.phone) : '',
      r.email ?? '',
      r.attendees
        .map((a) => (a.kind === 'child' && a.age != null ? `${attendeeName(a)} (${a.age})` : attendeeName(a)))
        .filter(Boolean)
        .join('; '),
      [...counts].map(([k, n]) => (n > 1 ? `${L.diet[k]} ×${n}` : L.diet[k])).join('; '),
      r.attendees
        .map((a) => a.dietaryNotes)
        .filter(Boolean)
        .join('; '),
      ...questions.map((q) => answer(q, r)),
      r.message ?? '',
      L.localeName[r.locale] ?? r.locale,
      when.format(new Date(r.createdAt)),
      r.updatedAt !== r.createdAt ? when.format(new Date(r.updatedAt)) : '',
    ];
  });
  return '﻿' + [header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
