import { intlLocale, type UiLocale } from '@/lib/i18n/app';

/**
 * Times on the tickets' screens: Israel time for dates (the server and the browser print the same), and
 * "5 minutes ago" for the last activity. The screens mark these `suppressHydrationWarning`: a minute may
 * pass between the server's render and the browser's.
 */

export function ilDate(
  locale: UiLocale,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Asia/Jerusalem', ...options }).format(
    new Date(value),
  );
}

export function ilDateTime(locale: UiLocale, value: string | number | Date): string {
  return ilDate(locale, value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(locale: UiLocale, value: string | number | Date, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const s = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return ilDate(locale, value);
}
