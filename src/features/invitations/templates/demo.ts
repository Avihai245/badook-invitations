import babyShowerFixture from '@kit/fixtures/example-babyshower-en.json';
import saveTheDateFixture from '@kit/fixtures/example-savethedate-he.json';
import weddingFixture from '@kit/fixtures/example-wedding-he-en.json';
import { migrateDocument } from '../contracts/migrate';
import type { EventType, InvitationDocument, L10n, Locale, Section } from '../contracts/types';
import { requireTemplate } from './registry';
import { COUPLE_EVENTS } from './seed-copy';
import { seedDocument } from './seed-document';

/** The three §10 examples, read from docs/invitations/fixtures (never retyped). */
export const FIXTURES = {
  'wedding-he-en': migrateDocument(weddingFixture),
  'babyshower-en': migrateDocument(babyShowerFixture),
  'savethedate-he': migrateDocument(saveTheDateFixture),
} as const satisfies Record<string, InvitationDocument>;
export type FixtureId = keyof typeof FIXTURES;

interface DemoPeople {
  primary: L10n;
  secondary?: L10n;
  parents?: L10n;
  monogram?: L10n;
}

const PEOPLE: Partial<Record<EventType, DemoPeople>> = {
  bar_mitzvah: {
    primary: { he: 'יונתן', en: 'Jonathan' },
    parents: { he: 'מיכל ודוד לוי', en: 'Michal & David Levi' },
    monogram: { he: 'י', en: 'J' },
  },
  bat_mitzvah: {
    primary: { he: 'תמר', en: 'Tamar' },
    parents: { he: 'מיכל ודוד לוי', en: 'Michal & David Levi' },
    monogram: { he: 'ת', en: 'T' },
  },
  brit: {
    primary: { he: 'שירה ואורי', en: 'Shira & Ori' },
    parents: { he: 'סבא וסבתא: רות ומשה כהן', en: 'Grandparents Ruth & Moshe Cohen' },
    monogram: { he: 'ש&א', en: 'S&O' },
  },
  baby_shower: { primary: { he: 'מאיה', en: 'Maya' }, monogram: { he: 'מ', en: 'M' } },
  birthday: { primary: { he: 'דנה', en: 'Dana' }, monogram: { he: 'דנה 30', en: 'DANA 30' } },
  corporate: { primary: { he: 'צוות אקמה', en: 'Team Acme' }, monogram: { he: 'אקמה', en: 'ACME' } },
};
const COUPLE: DemoPeople = {
  primary: { he: 'נועה', en: 'Noa' },
  secondary: { he: 'איתי', en: 'Itay' },
  parents: { he: 'מרים ודני לוי · רונית ואבי כהן', en: 'Miriam & Dani Levi · Ronit & Avi Cohen' },
};

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
  const people = COUPLE_EVENTS.includes(type) ? COUPLE : (PEOPLE[type] ?? COUPLE);
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
  if (people.monogram) doc.cover.monogram = pick(people.monogram, locales);
  doc.event.rsvpDeadline = '2027-06-01';

  const sections: Section[] = doc.sections.map((s): Section => {
    switch (s.type) {
      case 'hero':
        return {
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
          enabled: true,
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
          enabled: true,
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
