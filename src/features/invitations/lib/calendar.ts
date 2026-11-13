/** Calendar links + RFC 5545 ICS (§5 utilities). */

export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description?: string;
  url?: string;
  timezone: string;
}

/** 20270617T163000Z */
export const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export function googleCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(e.end)}`,
    location: e.location,
    ctz: e.timezone,
  });
  if (e.description || e.url) p.set('details', [e.description, e.url].filter(Boolean).join('\n'));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: e.end.toISOString(),
    location: e.location,
  });
  if (e.description || e.url) p.set('body', [e.description, e.url].filter(Boolean).join('\n'));
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

/** Escape TEXT values: backslash, comma, semicolon, newline — CRLF, LF or a lone CR (RFC 5545 §3.3.11). */
export const escapeIcsText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

/**
 * A value that isn't TEXT (the UID, the URL): no control character at all — a line break in a host's
 * venue id would otherwise start a property of its own (an alarm, an attachment) in the guests' calendars.
 */
const icsValue = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '');

/** Fold content lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 sequence. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(e: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Badook//Invitations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsValue(e.uid)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(e.end)}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `LOCATION:${escapeIcsText(e.location)}`,
    ...(e.description ? [`DESCRIPTION:${escapeIcsText(e.description)}`] : []),
    ...(e.url ? [`URL:${icsValue(e.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
