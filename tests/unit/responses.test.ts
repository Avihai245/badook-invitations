import { describe, expect, it } from 'vitest';
import type { DietaryKey } from '@/features/invitations/contracts/types';
import {
  csvCell,
  dietaryCounts,
  matchesSearch,
  questionBreakdown,
  replyDietary,
  responseStats,
  responsesCsv,
  type CsvLabels,
  type CustomQuestion,
  type ResponseRecord,
} from '@/features/invitations/lib/responses';

const NOW = Date.parse('2027-05-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const adult = (first: string, dietary: DietaryKey[] = [], notes: string | null = null, last = 'לוי') => ({
  kind: 'adult' as const,
  position: 0,
  firstName: first,
  lastName: last,
  fullName: null,
  age: null,
  dietary,
  dietaryNotes: notes,
});
const child = (name: string, age: number, dietary: DietaryKey[] = []) => ({
  kind: 'child' as const,
  position: 0,
  firstName: null,
  lastName: null,
  fullName: name,
  age,
  dietary,
  dietaryNotes: null,
});

const LIST: ResponseRecord[] = [
  {
    id: '1',
    attending: true,
    locale: 'he',
    name: 'דנה לוי',
    phone: '+972501234567',
    email: 'dana@example.com',
    adults: 2,
    children: 1,
    message: 'מזל טוב, "מתרגשים"!',
    answers: { shuttle: 'tlv', parking: true },
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    attendees: [
      adult('דנה', ['vegan']),
      adult('תום', ['nut_allergy'], 'אגוזי מלך'),
      child('נועם', 6, ['kids_meal']),
    ],
  },
  {
    id: '2',
    attending: false,
    locale: 'en',
    name: 'Avi Peretz',
    phone: null,
    email: '=cmd@example.com',
    adults: 0,
    children: 0,
    message: null,
    answers: {},
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
    attendees: [],
  },
  {
    id: '3',
    attending: true,
    locale: 'he',
    name: 'Michal',
    phone: '0521112222',
    email: null,
    adults: 1,
    children: 0,
    message: null,
    answers: {},
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    attendees: [adult('Michal', [], null, 'Cohen')],
  },
];

const SHUTTLE: CustomQuestion = {
  id: 'shuttle',
  type: 'select',
  required: false,
  label: { he: 'מצטרפים להסעה?', en: 'Joining the shuttle?' },
  options: [
    { value: 'no', label: { he: 'לא צריך', en: 'No' } },
    { value: 'tlv', label: { he: 'מתל אביב', en: 'From Tel Aviv' } },
  ],
};
const PARKING: CustomQuestion = { id: 'parking', type: 'boolean', required: false, label: { he: 'חניה?' } };

describe('responseStats', () => {
  it('counts guests, replies, declines and this week', () => {
    expect(responseStats(LIST, NOW)).toEqual({
      responses: 3,
      attending: 4,
      adults: 3,
      children: 1,
      declined: 1,
      declinedPct: 33,
      newThisWeek: 2,
    });
    expect(responseStats([], NOW).declinedPct).toBe(0);
  });
});

describe('dietaryCounts / replyDietary', () => {
  it('counts attendees of "yes" replies per offered option; no choice counts as none', () => {
    const counts = dietaryCounts(LIST, ['none', 'vegan', 'kids_meal', 'nut_allergy', 'gluten_free']);
    expect(counts).toEqual([
      { key: 'none', count: 1 },
      { key: 'vegan', count: 1 },
      { key: 'kids_meal', count: 1 },
      { key: 'nut_allergy', count: 1 },
      { key: 'gluten_free', count: 0 },
    ]);
    expect(replyDietary(LIST[0]!)).toEqual(['vegan', 'nut_allergy', 'kids_meal']);
  });
});

describe('questionBreakdown', () => {
  it('weights select answers by party size; a select nobody touched keeps its first option', () => {
    expect(questionBreakdown(LIST, SHUTTLE)).toEqual([
      { value: 'no', count: 1 },
      { value: 'tlv', count: 3 },
    ]);
    expect(questionBreakdown(LIST, PARKING)).toEqual([
      { value: 'true', count: 3 },
      { value: 'false', count: 1 },
    ]);
    expect(questionBreakdown(LIST, { ...PARKING, type: 'text' })).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('finds by name, attendee, email and phone digits (local or international)', () => {
    expect(matchesSearch(LIST[0]!, 'דנה')).toBe(true);
    expect(matchesSearch(LIST[0]!, 'נועם')).toBe(true);
    expect(matchesSearch(LIST[0]!, 'DANA@')).toBe(true);
    expect(matchesSearch(LIST[0]!, '050-123')).toBe(true);
    expect(matchesSearch(LIST[0]!, '972501')).toBe(true);
    expect(matchesSearch(LIST[2]!, '0521112222')).toBe(true);
    expect(matchesSearch(LIST[0]!, 'Avi')).toBe(false);
    expect(matchesSearch(LIST[0]!, '  ')).toBe(true);
  });
});

describe('CSV', () => {
  const labels: CsvLabels = {
    name: 'שם',
    status: 'סטטוס',
    attending: 'מגיעים',
    declined: 'לא מגיעים',
    adults: 'מבוגרים',
    children: 'ילדים',
    phone: 'טלפון',
    email: 'אימייל',
    guests: 'אורחים',
    dietary: 'תזונה',
    dietaryNotes: 'הערות תזונה',
    message: 'הודעה',
    language: 'שפה',
    received: 'התקבל',
    updated: 'עודכן',
    yes: 'כן',
    no: 'לא',
    diet: {
      none: 'ללא',
      kosher: 'כשר',
      kosher_mehadrin: 'מהדרין',
      vegetarian: 'צמחוני',
      vegan: 'טבעוני',
      gluten_free: 'ללא גלוטן',
      dairy_free: 'ללא חלב',
      pescatarian: 'פסקטריאני',
      nut_allergy: 'אלרגיה לאגוזים',
      other_allergy: 'אלרגיה אחרת',
      kids_meal: 'מנת ילדים',
    },
    localeName: { he: 'עברית', en: 'English' },
  };
  const csv = responsesCsv(LIST, {
    labels,
    questions: [SHUTTLE, PARKING],
    uiLocale: 'he',
    fallbackLocale: 'he',
    timeZone: 'Asia/Jerusalem',
    formatPhone: (p) => (p === '+972501234567' ? '050-123-4567' : p),
  });

  it('starts with a BOM, uses CRLF and a header in the UI language', () => {
    expect(
      csv.startsWith(
        '﻿שם,סטטוס,מבוגרים,ילדים,טלפון,אימייל,אורחים,תזונה,הערות תזונה,מצטרפים להסעה?,חניה?,הודעה,שפה,התקבל,עודכן\r\n',
      ),
    ).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(LIST.length + 2);
  });

  it('writes one row per reply: guests, dietary counts, answers as labels, escaped message', () => {
    const [, dana, avi] = csv.split('\r\n');
    expect(dana).toBe(
      'דנה לוי,מגיעים,2,1,050-123-4567,dana@example.com,דנה לוי; תום לוי; נועם (6),טבעוני; אלרגיה לאגוזים; מנת ילדים,אגוזי מלך,מתל אביב,כן,"מזל טוב, ""מתרגשים""!",עברית,' +
        `"${new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(LIST[0]!.createdAt))}",`,
    );
    // declined: no answers; a formula-looking email is neutralized
    expect(avi!.startsWith("Avi Peretz,לא מגיעים,0,0,,'=cmd@example.com,,,,,,,English,")).toBe(true);
  });

  it('csvCell neutralizes formulas and quotes separators', () => {
    expect(csvCell('+972501234567')).toBe("'+972501234567");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3)).toBe('3');
  });
});
