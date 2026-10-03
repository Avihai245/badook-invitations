import { addDaysISO } from '@/features/invitations/lib/dates';
import { escapeIcsText, foldIcsLine, utcStamp } from '@/features/invitations/lib/calendar';

/** The tasks as a calendar: all-day events on their due dates (ICS), or one task as a Google Calendar link. */

export interface CalendarTask {
  id: string;
  title: string;
  notes: string | null;
  /** YYYY-MM-DD */
  dueDate: string;
}

const day = (iso: string) => iso.replace(/-/g, '');

export function tasksIcs(tasks: readonly CalendarTask[], name: string, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Badook//Event planning//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];
  for (const t of tasks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@planning.badook`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;VALUE=DATE:${day(t.dueDate)}`,
      `DTEND;VALUE=DATE:${day(addDaysISO(t.dueDate, 1))}`,
      `SUMMARY:${escapeIcsText(t.title)}`,
      ...(t.notes ? [`DESCRIPTION:${escapeIcsText(t.notes)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** One task as "add to Google Calendar" (an all-day event). */
export function googleTaskUrl(t: Pick<CalendarTask, 'title' | 'notes' | 'dueDate'>): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.title,
    dates: `${day(t.dueDate)}/${day(addDaysISO(t.dueDate, 1))}`,
  });
  if (t.notes) p.set('details', t.notes);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
