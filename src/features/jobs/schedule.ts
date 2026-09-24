/** The daily run's hour: 06:00 UTC — 09:00 in Israel in summer, 08:00 in winter. */
export const DAILY_AT_UTC_HOUR = 6;

/** The WhatsApp queue is looked at every couple of minutes. */
export const WHATSAPP_EVERY_MS = 2 * 60_000;

/**
 * The daily run's latest turn at `now`: today's 06:00 UTC once it has come, else yesterday's. The run
 * is due when it last finished before this moment.
 */
export function dailyDue(now: Date): Date {
  const due = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_AT_UTC_HOUR),
  );
  if (due.getTime() > now.getTime()) due.setUTCDate(due.getUTCDate() - 1);
  return due;
}
