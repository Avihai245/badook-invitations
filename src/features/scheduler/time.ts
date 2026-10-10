import { zonedTimeToUtc } from '@/features/invitations/lib/dates';

/**
 * Times a host picks, as plain logic (tests/unit/scheduler.test.ts; the browser and the server alike):
 * a date and a time on the clock mean a moment only together with a time zone — 15:00 in New York is
 * 19:00 UTC in summer and 20:00 in winter, 15:00 in Israel is 12:00 / 13:00. Every scheduled thing
 * keeps the three as the host chose them; the database works the moment out from them again
 * (scheduled_send_set → local_moment) and that is the one it runs at.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type HHmm = string; // 'HH:mm', 24 hours

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** An IANA time zone this runtime knows ("America/New_York", "Asia/Jerusalem"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The moment a date and a time on the clock mean in a time zone. */
export function localMoment(date: ISODate, time: HHmm, timeZone: string): Date {
  return zonedTimeToUtc(date, time, timeZone);
}

/** A moment as the date and the time on the clock in a time zone. */
export function localParts(at: Date, timeZone: string): { date: ISODate; time: HHmm } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Whether that time exists on that day there — not when the clocks jump forward (02:30 on the night
 * New York moves to summer time never shows on a clock there): the host picks another.
 */
export function localExists(date: ISODate, time: HHmm, timeZone: string): boolean {
  if (!DATE_RE.test(date) || !TIME_RE.test(time) || !isTimeZone(timeZone)) return false;
  const at = localMoment(date, time, timeZone);
  if (!Number.isFinite(at.getTime())) return false;
  const back = localParts(at, timeZone);
  return back.date === date && back.time === time;
}

/** A time zone's city as people say it ("America/New_York" → "New York"). */
export function zoneCity(timeZone: string): string {
  return (timeZone.split('/').at(-1) ?? timeZone).replace(/_/g, ' ');
}

/** The browser's own time zone (null on the server or when it can't say). */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** Every time zone this runtime knows, for the picker (a short list when it can't list them). */
export function allTimeZones(): string[] {
  const list = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
  return list?.length
    ? list
    : [
        'Asia/Jerusalem',
        'Europe/London',
        'Europe/Paris',
        'Europe/Moscow',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Toronto',
        'America/Sao_Paulo',
        'Africa/Addis_Ababa',
        'Asia/Dubai',
        'Australia/Sydney',
        'UTC',
      ];
}
