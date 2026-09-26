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

/**
 * The site's sample invitations (the home page shows them in a phone): the wedding example with a
 * still picture behind its opening screen, and the same one with a YouTube video there — how a
 * background video looks. (The kit's own fixture, noa-and-itay, stays as it is for the tests.)
 */
export const SAMPLES = {
  classic: 'noa-and-itay-classic',
  video: 'noa-and-itay-video',
} as const;
export const SAMPLE_VIDEO_LINK = 'https://www.youtube.com/watch?v=5GvcO2lufGU&t=207';

/** The "without a video" sample: a still behind the names, whatever media the template gets later. */
export function classicSampleDocument(): InvitationDocument {
  const doc = structuredClone(FIXTURES['wedding-he-en']);
  doc.share.slug = SAMPLES.classic;
  for (const section of doc.sections) {
    if (section.type !== 'hero') continue;
    section.data.media = {
      kind: 'image',
      src: 'template:hero-poster',
      poster: null,
      focalPoint: section.data.media.focalPoint,
    };
  }
  return doc;
}

export function videoSampleDocument(): InvitationDocument {
  const doc = structuredClone(FIXTURES['wedding-he-en']);
  doc.share.slug = SAMPLES.video;
  for (const section of doc.sections) {
    if (section.type !== 'hero') continue;
    section.data.media = {
      kind: 'video',
      src: SAMPLE_VIDEO_LINK,
      poster: 'https://i.ytimg.com/vi/5GvcO2lufGU/hqdefault.jpg',
      focalPoint: { x: 0.5, y: 0.5 },
    };
    // a darker veil: the names stay readable over any frame of the video
    section.data.overlayOpacity = 0.45;
  }
  return doc;
}

const TIMES: Partial<Record<EventType, [string, string]>> = {
  brit: ['09:00', '12:00'],
  baby_shower: ['11:00', '14:00'],
  birthday: ['21:00', '02:00'],
  bar_mitzvah: ['19:00', '23:30'],
  bat_mitzvah: ['19:00', '23:30'],
};

const VENUES: { name: L10n; address: L10n; geo: { lat: number; lng: number } }[] = [
  {
    name: {
      he: 'אחוזת הגפן',
      en: 'Ahuzat HaGefen',
      ru: 'Ахузат ха-Гефен',
      ar: 'أحوزات هجيفن',
      fr: 'Ahuzat HaGefen',
      es: 'Ahuzat HaGefen',
      am: 'አሑዛት ሃጌፈን',
    },
    address: {
      he: 'דרך הכרמים 12, זכרון יעקב',
      en: "12 Derech HaKramim, Zikhron Ya'akov",
      ru: 'Дерех ха-Крамим, 12, Зихрон-Яаков',
      ar: 'شارع هكراميم 12، زخرون يعقوب',
      fr: '12, Derech HaKramim, Zikhron Yaakov',
      es: 'Derech HaKramim 12, Zikhron Yaakov',
      am: 'ደሬኽ ሃክራሚም 12፣ ዚክሮን ያዕቆብ',
    },
    geo: { lat: 32.5707, lng: 34.9536 },
  },
  {
    name: {
      he: 'בית הכנסת הגדול',
      en: 'The Great Synagogue',
      ru: 'Большая синагога',
      ar: 'الكنيس الكبير',
      fr: 'La Grande Synagogue',
      es: 'La Gran Sinagoga',
      am: 'ታላቁ ምኩራብ',
    },
    address: {
      he: 'אלנבי 110, תל אביב',
      en: '110 Allenby St, Tel Aviv',
      ru: 'ул. Алленби, 110, Тель-Авив',
      ar: 'شارع ألنبي 110، تل أبيب',
      fr: '110, rue Allenby, Tel Aviv',
      es: 'Calle Allenby 110, Tel Aviv',
      am: 'አለንቢ ጎዳና 110፣ ቴል አቪቭ',
    },
    geo: { lat: 32.0668, lng: 34.7725 },
  },
];

/** The demo's other samples, in every invitation language. */
const SAMPLE = {
  place: {
    he: 'זכרון יעקב',
    en: "Zikhron Ya'akov",
    ru: 'Зихрон-Яаков',
    ar: 'زخرون يعقوب',
    fr: 'Zikhron Yaakov',
    es: 'Zikhron Yaakov',
    am: 'ዚክሮን ያዕቆብ',
  },
  parkingQ: {
    he: 'יש חניה במקום?',
    en: 'Is there parking at the venue?',
    ru: 'Есть ли парковка на месте?',
    ar: 'هل يوجد موقف سيارات في المكان؟',
    fr: 'Y a-t-il un parking sur place\u202f?',
    es: '¿Hay aparcamiento en el lugar?',
    am: 'በቦታው የመኪና ማቆሚያ አለ?',
  },
  parkingA: {
    he: 'כן, חניה חינם בשטח.',
    en: 'Yes, free parking on site.',
    ru: 'Да, бесплатная парковка на территории.',
    ar: 'نعم، يوجد موقف مجاني في المكان.',
    fr: 'Oui, parking gratuit sur place.',
    es: 'Sí, aparcamiento gratuito en el lugar.',
    am: 'አዎ፣ በቦታው ነፃ የመኪና ማቆሚያ አለ።',
  },
  kosherQ: {
    he: 'האוכל כשר?',
    en: 'Is the food kosher?',
    ru: 'Еда кошерная?',
    ar: 'هل الطعام كوشير؟',
    fr: 'La cuisine est-elle casher\u202f?',
    es: '¿La comida es kosher?',
    am: 'ምግቡ ኮሸር ነው?',
  },
  kosherA: {
    he: 'כן, בהשגחת הרבנות.',
    en: 'Yes, rabbinate-certified kosher.',
    ru: 'Да, под надзором раввината.',
    ar: 'نعم، بإشراف الحاخامية.',
    fr: 'Oui, sous la surveillance du rabbinat.',
    es: 'Sí, con certificación kosher del rabinato.',
    am: 'አዎ፣ በረቢዎች የተረጋገጠ ኮሸር ነው።',
  },
  bit: {
    he: 'העברה בביט',
    en: 'Send via Bit',
    ru: 'Перевод через Bit',
    ar: 'تحويل عبر Bit',
    fr: 'Envoyer via Bit',
    es: 'Enviar por Bit',
    am: 'በBit ይላኩ',
  },
  paybox: {
    he: 'העברה בפייבוקס',
    en: 'Send via PayBox',
    ru: 'Перевод через PayBox',
    ar: 'تحويل عبر PayBox',
    fr: 'Envoyer via PayBox',
    es: 'Enviar por PayBox',
    am: 'በPayBox ይላኩ',
  },
  bank: {
    he: 'העברה בנקאית',
    en: 'Bank transfer',
    ru: 'Банковский перевод',
    ar: 'تحويل بنكي',
    fr: 'Virement bancaire',
    es: 'Transferencia bancaria',
    am: 'የባንክ ዝውውር',
  },
  bankDetails: {
    he: 'בנק הפועלים (12) · סניף 600 · חשבון 123456',
    en: 'Bank Hapoalim (12) · Branch 600 · Account 123456',
    ru: 'Банк Апоалим (12) · отделение 600 · счёт 123456',
    ar: 'بنك هبوعليم (12) · فرع 600 · حساب 123456',
    fr: 'Banque Hapoalim (12) · agence 600 · compte 123456',
    es: 'Banco Hapoalim (12) · sucursal 600 · cuenta 123456',
    am: 'ባንክ ሃፖዓሊም (12) · ቅርንጫፍ 600 · ሂሳብ 123456',
  },
} as const satisfies Record<string, L10n>;

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
  const people = demoPeople(type, templateId);
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
  // the sample FAQ and gifts show where the design has them (a design that leaves them out of its
  // order keeps them hidden: it ends on its RSVP)
  const ordered = (type: Section['type']) => manifest.sectionDefaults.order.includes(type);

  const sections: Section[] = doc.sections.map((s): Section => {
    switch (s.type) {
      case 'hero':
        return saveTheDate
          ? s
          : {
              ...s,
              data: { ...s.data, locationLine: pick(SAMPLE.place, locales) },
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
          enabled: !saveTheDate && ordered('faq'),
          data: {
            ...s.data,
            items: [
              {
                id: 'q1',
                q: pick(SAMPLE.parkingQ, locales),
                a: pick(SAMPLE.parkingA, locales),
              },
              {
                id: 'q2',
                q: pick(SAMPLE.kosherQ, locales),
                a: pick(SAMPLE.kosherA, locales),
              },
            ],
          },
        };
      case 'gifts':
        return {
          ...s,
          enabled: !saveTheDate && ordered('gifts'),
          data: {
            ...s.data,
            links: [
              {
                id: 'g1',
                kind: 'bit',
                label: pick(SAMPLE.bit, locales),
                url: 'https://www.bitpay.co.il/app/me/EXAMPLE',
                details: null,
              },
              {
                id: 'g2',
                kind: 'paybox',
                label: pick(SAMPLE.paybox, locales),
                url: 'https://payboxapp.page.link/EXAMPLE',
                details: null,
              },
              {
                id: 'g3',
                kind: 'bank_transfer',
                label: pick(SAMPLE.bank, locales),
                url: null,
                details: pick(SAMPLE.bankDetails, locales),
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
