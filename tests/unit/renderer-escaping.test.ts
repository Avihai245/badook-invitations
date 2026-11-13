import { describe, expect, it } from 'vitest';
import { buildIcs, escapeIcsText } from '@/features/invitations/lib/calendar';

/** The guests' calendar file (/i/<slug>/event.ics): what a host writes can't add properties to it. */

const event = {
  uid: 'noa-and-itay-v1@invitations.example.com',
  title: 'Noa & Itay',
  start: new Date('2027-05-19T16:00:00Z'),
  end: new Date('2027-05-19T22:00:00Z'),
  location: 'Hall, Tel Aviv',
  url: 'https://invitations.example.com/i/noa-and-itay',
  timezone: 'Asia/Jerusalem',
};

/** The property names of the unfolded lines. */
const properties = (ics: string) =>
  ics
    .replace(/\r\n /g, '')
    .split('\r\n')
    .filter(Boolean)
    .map((l) => l.split(/[:;]/)[0]);

describe('the calendar file', () => {
  it('escapes TEXT values, line breaks of every kind included', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(escapeIcsText('one\r\ntwo\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour');
  });

  it('a host’s venue id or text can’t start a property of its own', () => {
    const ics = buildIcs({
      ...event,
      uid: 'noa-v1\r\nBEGIN:VALARM\r\nTRIGGER:-PT1M\r\nEND:VALARM@invitations.example.com',
      title: 'Noa\rATTACH:https://evil.example/x',
      location: 'Hall\nATTACH:https://evil.example/y',
    });
    expect(properties(ics)).toEqual([
      'BEGIN',
      'VERSION',
      'PRODID',
      'CALSCALE',
      'METHOD',
      'BEGIN',
      'UID',
      'DTSTAMP',
      'DTSTART',
      'DTEND',
      'SUMMARY',
      'LOCATION',
      'URL',
      'END',
      'END',
    ]);
    expect(ics).not.toMatch(/\r\n(BEGIN:VALARM|ATTACH|TRIGGER)/);
  });
});

describe('a URL in CSS', () => {
  it('can’t close its string and carry on as more CSS', async () => {
    const { cssUrl } = await import('@/features/invitations/lib/css-url');
    expect(cssUrl('https://cdn.example/a.webp')).toBe('url("https://cdn.example/a.webp")');
    const out = cssUrl('https://x.example/a");background:url("https://evil.example/t\\\n');
    // one string, start to end: every quote inside it escaped
    expect(out.slice(5, -2)).not.toMatch(/["\n\\](?![0-9a-f]+ )/);
    expect(out).toBe('url("https://x.example/a\\22 );background:url(\\22 https://evil.example/t\\5c \\a ")');
  });
});
