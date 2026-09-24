import babyShowerFixture from '@kit/fixtures/example-babyshower-en.json';
import saveTheDateFixture from '@kit/fixtures/example-savethedate-he.json';
import weddingFixture from '@kit/fixtures/example-wedding-he-en.json';
import { migrateDocument } from '../contracts/migrate';
import type { EventType, InvitationDocument, L10n, Locale, Section } from '../contracts/types';
import { visibleGlyphCount } from '../lib/text';
import { requireTemplate } from './registry';
import { demoPeople } from './demo-people';
import { seedDocument } from './seed-document';

/** The three §10 examples, read from docs/invitations/fixtures (never retyped). */
export const FIXTURES = {
  'wedding-he-en': migrateDocument(weddingFixture),
  'babyshower-en': migrateDocument(babyShowerFixture),
  'savethedate-he': migrateDocument(saveTheDateFixture),
} as const satisfies Record<string, InvitationDocument>;
export type FixtureId = keyof typeof FIXTURES;

const TIMES: Partial<Record<EventType, [string, string]>> = {
  brit: ['09:00', '12:00'],
  baby_shower: ['11:00', '14:00'],
  birthday: ['21:00', '02:00'],
  bar_mitzvah: ['19:00', '23:30'],
  bat_mitzvah: ['19:00', '23:30'],
};

const VENUES: { name: L10n; address: L10n; geo: { lat: number; lng: number } }[] = [
  {
    name: { he: 'אחוזת הגפן', en: 'Ahuzat HaGefen' },
    address: { he: 'דרך הכרמים 12, זכרון יעקב', en: "12 Derech HaKramim, Zikhron Ya'akov" },
    geo: { lat: 32.5707, lng: 34.9536 },
  },
  {
    name: { he: 'בית הכנסת הגדול', en: 'The Great Synagogue' },
    address: { he: 'אלנבי 110, תל אביב', en: '110 Allenby St, Tel Aviv' },
    geo: { lat: 32.0668, lng: 34.7725 },
  },
];

const pick = (v: L10n, locales: readonly Locale[]): L10n =>
  Object.fromEntries(locales.filter((l) => v[l] !== undefined).map((l) => [l, v[l]]));

/**
 * A complete demo invitation for a template: seeded from its defaults.json (exactly what a new host
 * gets), then filled with sample names/venue/FAQ/gifts so every section renders. Used by the kitchen
 * sink now and by the per-template demo invitations in P1 (`/i/demo-<template>`).
 */
export function demoDocument(
  templateId: string,
  eventType?: EventType,
  locales: Locale[] = ['he', 'en'],
  defaultLocale: Locale = locales[0] ?? 'he',
): InvitationDocument {
  const { manifest, defaults } = requireTemplate(templateId);
  const type = eventType ?? (Object.keys(defaults.defaults)[0] as EventType);
  const people = demoPeople(type);
  const [startTime, endTime] = TIMES[type] ?? ['19:30', '01:00'];
  const doc = seedDocument(manifest, defaults, {
    eventType: type,
    locales,
    defaultLocale,
    hosts: { primary: people.primary, secondary: people.secondary ?? null, parents: people.parents ?? null },
    date: '2027-06-17',
    startTime,
    endTime,
    timezone: 'Asia/Jerusalem',
    slug: `demo-${templateId}`,
  });
  // the sample monogram ("DANA 30", "ACME") where the template's cover fits it — but a ticket prints
  // the seeded name rather than a lone initial; else the seeded one
  const sample = people.monogram ? pick(people.monogram, locales) : null;
  const { kind, text } = manifest.cover.overlay;
  const glyphs = (l: Locale) => visibleGlyphCount(sample?.[l] ?? '', l);
  const fits = locales.every((l) => glyphs(l) <= text.maxGlyphs);
  const initialOnTicket = kind === 'ticket_text' && locales.every((l) => glyphs(l) <= 1);
  if (sample && fits && !initialOnTicket) doc.cover.monogram = sample;
  // a save-the-date keeps its §10.3 shape (hero → reveal → note → footer); the samples are filled in
  // for when its other sections are switched on
  const saveTheDate = type === 'save_the_date';
  if (!saveTheDate) doc.event.rsvpDeadline = '2027-06-01';

  const sections: Section[] = doc.sections.map((s): Section => {
    switch (s.type) {
      case 'hero':
        return saveTheDate
          ? s
          : {
              ...s,
              data: { ...s.data, locationLine: pick({ he: 'זכרון יעקב', en: "Zikhron Ya'akov" }, locales) },
            };
      case 'venues':
        return {
          ...s,
          data: {
            items: s.data.items.map((v, i) => {
              const sample = VENUES[i % VENUES.length]!;
              return {
                ...v,
                name: pick(sample.name, locales),
                address: pick(sample.address, locales),
                geo: sample.geo,
              };
            }),
          },
        };
      case 'faq':
        return {
          ...s,
          enabled: !saveTheDate,
          data: {
            ...s.data,
            items: [
              {
                id: 'q1',
                q: pick({ he: 'יש חניה במקום?', en: 'Is there parking at the venue?' }, locales),
                a: pick({ he: 'כן, חניה חינם בשטח.', en: 'Yes, free parking on site.' }, locales),
              },
              {
                id: 'q2',
                q: pick({ he: 'האוכל כשר?', en: 'Is the food kosher?' }, locales),
                a: pick({ he: 'כן, בהשגחת הרבנות.', en: 'Yes, rabbinate-certified kosher.' }, locales),
              },
            ],
          },
        };
      case 'gifts':
        return {
          ...s,
          enabled: !saveTheDate,
          data: {
            ...s.data,
            links: [
              {
                id: 'g1',
                kind: 'bit',
                label: pick({ he: 'העברה בביט', en: 'Send via Bit' }, locales),
                url: 'https://www.bitpay.co.il/app/me/EXAMPLE',
                details: null,
              },
              {
                id: 'g2',
                kind: 'paybox',
                label: pick({ he: 'העברה בפייבוקס', en: 'Send via PayBox' }, locales),
                url: 'https://payboxapp.page.link/EXAMPLE',
                details: null,
              },
              {
                id: 'g3',
                kind: 'bank_transfer',
                label: pick({ he: 'העברה בנקאית', en: 'Bank transfer' }, locales),
                url: null,
                details: pick(
                  {
                    he: 'בנק הפועלים (12) · סניף 600 · חשבון 123456',
                    en: 'Bank Hapoalim (12) · Branch 600 · Account 123456',
                  },
                  locales,
                ),
              },
            ],
          },
        };
      default:
        return s;
    }
  });
  return { ...doc, sections };
}

/** Longest allowed strings (§12.12), each exactly at its cap: names 20, eyebrow 40, timeline labels 22. */
export const STRESS_TEXT = {
  primary: { he: 'אלכסנדרה־מרגריטה לוי', en: 'Alexandra-Margaretta' },
  secondary: { he: 'בנימין־זאב־יהונתן כץ', en: 'Maximilian-Alexander' },
  eyebrow: { he: 'בשמחה רבה ובהתרגשות אנו מזמינים אתכם לחג', en: 'With joy and gratitude, we invite you to' },
  timelineLabel: { he: 'קבלת פנים ומשקאות קלים', en: 'Welcome drinks & bites' },
} as const satisfies Record<string, L10n>;

export function stressDocument(templateId: string): InvitationDocument {
  const doc = demoDocument(templateId);
  doc.hosts.primary = { ...STRESS_TEXT.primary };
  if (doc.hosts.secondary) doc.hosts.secondary = { ...STRESS_TEXT.secondary };
  doc.sections = doc.sections.map((s): Section => {
    if (s.type === 'hero') return { ...s, data: { ...s.data, eyebrow: { ...STRESS_TEXT.eyebrow } } };
    if (s.type === 'timeline') {
      return {
        ...s,
        data: {
          ...s.data,
          items: s.data.items.map((it) => ({ ...it, label: { ...STRESS_TEXT.timelineLabel } })),
        },
      };
    }
    return s;
  });
  return doc;
}
