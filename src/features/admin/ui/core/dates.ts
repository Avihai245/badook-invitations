/** Israel's date now, YYYY-MM-DD (what "today" means across the console). */
export function israelToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** A YYYY-MM-DD date `n` days later (or earlier). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date a year later (the same day; 29 February → 28 February). */
export function addYear(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y + 1, m - 1, d, 12));
  if (next.getUTCMonth() !== m - 1) next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

/**
 * The last day something lasts, when it ends at midnight after it in Israel (a gift, a discount): the
 * moment just before its end.
 */
export const lastDayOf = (endsAt: string) => new Date(Date.parse(endsAt) - 1).toISOString();
