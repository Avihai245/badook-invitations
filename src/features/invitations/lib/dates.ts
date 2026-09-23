import type { HHmm, ISODate, InvitationDocument, Locale, Venue } from '../contracts/types';

/** Single place mapping invitation locales to Intl locales (en-US ordering can be offered later). */
export const INTL_LOCALE: Record<Locale, string> = { he: 'he-IL', en: 'en-GB' };

export const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};
export const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

export function parseISODate(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

/**
 * Formats a calendar date (no time) — the instant is UTC noon of that date and formatting uses UTC,
 * so the printed day never shifts with the server's or the guest's zone.
 */
export function formatDate(iso: ISODate, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  const { y, m, d } = parseISODate(iso);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** HE: `יום חמישי, 17 ביוני 2027` · EN: `Thursday, 17 June 2027` */
export function formatEventDate(doc: Pick<InvitationDocument, 'event'>, locale: Locale): string {
  return formatDate(doc.event.date, locale, LONG_DATE);
}

export function resolveTimeFormat(locale: Locale, timeFormat: '24h' | '12h' | null): '24h' | '12h' {
  return timeFormat ?? (locale === 'he' ? '24h' : '12h');
}

/** `19:30` / `7:30 PM` (Hebrew 12h uses the Intl day-period words). */
export function formatTime(hhmm: HHmm, locale: Locale, timeFormat: '24h' | '12h' | null): string {
  if (resolveTimeFormat(locale, timeFormat) === '24h') return hhmm;
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  if (locale === 'en') return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/** Wall-clock date + time in an IANA zone → the UTC instant (handles DST transitions). */
export function zonedTimeToUtc(date: ISODate, time: HHmm, timeZone: string): Date {
  const { y, m, d } = parseISODate(date);
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = zoneOffsetMs(guess, timeZone);
  let ts = guess - first;
  const second = zoneOffsetMs(ts, timeZone);
  if (second !== first) ts = guess - second;
  return new Date(ts);
}

const HOUR = 3_600_000;

/** `{ start, end }` in UTC. endTime < startTime ⇒ next day; missing endTime ⇒ start + 4h. */
export function eventRange(
  doc: Pick<InvitationDocument, 'event' | 'timezone'>,
  venue?: Pick<Venue, 'date' | 'startTime' | 'endTime'> | null,
): { start: Date; end: Date } {
  const date = venue?.date ?? doc.event.date;
  const startTime = venue ? venue.startTime : doc.event.startTime;
  const endTime = venue ? venue.endTime : doc.event.endTime;
  const start = zonedTimeToUtc(date, startTime, doc.timezone);
  if (!endTime) return { start, end: new Date(start.getTime() + 4 * HOUR) };
  let end = zonedTimeToUtc(date, endTime, doc.timezone);
  if (end.getTime() <= start.getTime()) end = zonedTimeToUtc(addDaysISO(date, 1), endTime, doc.timezone);
  return { start, end };
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const { y, m, d } = parseISODate(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** End of an ISO day in a zone (RSVP deadline = end of that day in doc.timezone). */
export function endOfDayUtc(date: ISODate, timeZone: string): Date {
  return new Date(zonedTimeToUtc(addDaysISO(date, 1), '00:00', timeZone).getTime() - 1);
}
