import { describe, expect, it } from 'vitest';
import { plural, t } from '@/features/invitations/i18n/dictionary';
import { contrastRatio, headingColor, isDarkPalette } from '@/features/invitations/lib/contrast';
import { countdownParts, countdownPhase } from '@/features/invitations/lib/countdown';
import {
  endOfDayUtc,
  eventRange,
  formatEventDate,
  formatTime,
  zonedTimeToUtc,
} from '@/features/invitations/lib/dates';
import { formatHebrewDate } from '@/features/invitations/lib/hebrew-date';
import { cappedLength, interpolate } from '@/features/invitations/lib/l10n';
import { suggestSlug, visibleGlyphCount } from '@/features/invitations/lib/text';
import { TEMPLATES } from '@/features/invitations/templates/registry';

const doc = {
  timezone: 'Asia/Jerusalem',
  event: {
    date: '2027-06-17',
    startTime: '19:30',
    endTime: '01:00',
    hebrewDate: 'day' as const,
    timeFormat: null,
    rsvpDeadline: '2027-06-01',
  },
};

describe('§12 acceptance 1 — formatHebrewDate', () => {
  it('day / eve / en', () => {
    expect(formatHebrewDate('2027-06-17', 'day', 'he')).toBe('י״ב בסיון תשפ״ז');
    expect(formatHebrewDate('2027-06-17', 'eve', 'he')).toBe('אור לי״ג בסיון תשפ״ז');
    expect(formatHebrewDate('2027-06-17', 'day', 'en')).toBe('12 Sivan 5787');
  });
  it('handles leap-year Adar months', () => {
    expect(formatHebrewDate('2027-03-01', 'day', 'he')).toMatch(/^.+ באדר [אב]׳ תשפ״ז$/);
  });
});

describe('§12 acceptance 2 — eventRange', () => {
  it('19:30–01:00 in Asia/Jerusalem crosses midnight', () => {
    const { start, end } = eventRange(doc);
    expect(start.toISOString()).toBe('2027-06-17T16:30:00.000Z');
    expect(end.toISOString()).toBe('2027-06-17T22:00:00.000Z');
  });
  it('missing endTime ⇒ +4h; venue overrides date/time', () => {
    const { start, end } = eventRange(doc, { date: '2027-06-18', startTime: '11:00', endTime: null });
    expect(start.toISOString()).toBe('2027-06-18T08:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(4 * 3_600_000);
  });
  it('zonedTimeToUtc respects winter time and London', () => {
    expect(zonedTimeToUtc('2027-01-10', '19:30', 'Asia/Jerusalem').toISOString()).toBe(
      '2027-01-10T17:30:00.000Z',
    );
    expect(zonedTimeToUtc('2027-03-14', '11:00', 'Europe/London').toISOString()).toBe(
      '2027-03-14T11:00:00.000Z',
    );
  });
  it('RSVP deadline closes at the end of that day in the event zone', () => {
    expect(endOfDayUtc('2027-06-01', 'Asia/Jerusalem').toISOString()).toBe('2027-06-01T20:59:59.999Z');
  });
});

describe('formatting', () => {
  it('formatEventDate (he-IL / en-GB)', () => {
    expect(formatEventDate(doc, 'he')).toBe('יום חמישי, 17 ביוני 2027');
    expect(formatEventDate(doc, 'en')).toMatch(/^Thursday,? 17 June 2027$/);
  });
  it('formatTime defaults: he 24h, en 12h', () => {
    expect(formatTime('19:30', 'he', null)).toBe('19:30');
    expect(formatTime('19:30', 'en', null)).toBe('7:30 PM');
    expect(formatTime('00:00', 'en', null)).toBe('12:00 AM');
    expect(formatTime('07:05', 'en', '24h')).toBe('07:05');
  });
});

describe('countdown & plurals', () => {
  it('splits the remaining time and switches phases', () => {
    const target = Date.UTC(2027, 5, 17, 16, 30);
    expect(countdownParts(target, target - (2 * 86_400_000 + 3_600_000 + 61_000))).toMatchObject({
      days: 2,
      hours: 1,
      minutes: 1,
      seconds: 1,
    });
    expect(countdownPhase(target, target - 1)).toBe('counting');
    expect(countdownPhase(target, target + 1)).toBe('after');
    expect(countdownPhase(target, target + 86_400_001)).toBe('hidden');
  });
  it('resolves plural forms with Intl.PluralRules, falling back to other', () => {
    expect(t('he', 'countdown.days', { n: 1 })).toBe('יום');
    expect(t('he', 'countdown.days', { n: 2 })).toBe('ימים');
    expect(t('en', 'countdown.hours', { n: 5 })).toBe('Hours');
    expect(plural('en', { one: 'Day', other: 'Days' }, 1)).toBe('Day');
    expect(t('en', 'footer.madeWith', { brand: 'Badook' })).toBe('Made with love by Badook');
  });
});

describe('colors', () => {
  it('heading uses accent only when it reaches 3:1 on bg', () => {
    expect(headingColor(TEMPLATES.get('sahar-bordeaux')!.manifest.tokens.palette)).toBe('#731F2E');
    const honey = TEMPLATES.get('honey-meadow')!.manifest.tokens.palette;
    expect(contrastRatio(honey.accent, honey.bg)).toBeLessThan(3);
    expect(headingColor(honey)).toBe(honey.ink);
  });
  it('detects the dark template', () => {
    expect(isDarkPalette(TEMPLATES.get('rooftop-dusk')!.manifest.tokens.palette)).toBe(true);
    expect(isDarkPalette(TEMPLATES.get('atara')!.manifest.tokens.palette)).toBe(false);
  });
});

describe('text helpers', () => {
  it('interpolates known tokens and keeps unknown ones verbatim', () => {
    expect(interpolate('ב־{date} · {nope} · {primary}', { date: '17 ביוני', primary: 'נועה' })).toBe(
      'ב־17 ביוני · {nope} · נועה',
    );
    expect(cappedLength('On {date}')).toBe(3 + 12);
  });
  it('counts visible monogram glyphs as grapheme clusters without spaces', () => {
    expect(visibleGlyphCount('נ&א')).toBe(3);
    expect(visibleGlyphCount('DANA 30')).toBe(6);
  });
  it('suggests valid slugs', () => {
    expect(suggestSlug(['Noa', 'Itay'])).toBe('noa-and-itay');
    expect(suggestSlug(['נועה'])).toMatch(/^[a-z0-9-]{3,60}$/);
    expect(suggestSlug([''])).toMatch(/^[a-z0-9-]{3,60}$/);
  });
});
