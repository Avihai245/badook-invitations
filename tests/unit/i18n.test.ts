import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, LOCALES, RTL_LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import {
  DICTIONARY_LOCALES,
  dictEntry,
  dictionaryKeys,
  plural,
  t,
  type PluralEntry,
} from '@/features/invitations/i18n/dictionary';
import { shapeArabic } from '@/features/invitations/lib/arabic-shape';
import { visualLine } from '@/features/invitations/lib/bidi';
import { formatDate, formatTime, INTL_LOCALE, resolveTimeFormat } from '@/features/invitations/lib/dates';
import { EVENT_PHRASE, GUEST_MESSAGE } from '@/features/invitations/lib/event-phrases';
import { formatHebrewDate, showsHebrewDate } from '@/features/invitations/lib/hebrew-date';
import { parseLanguage } from '@/features/invitations/lib/language-names';
import {
  bestLocale,
  LOCALE_INFO,
  nativeName,
  paidLocales,
  scriptsOf,
} from '@/features/invitations/lib/locales';
import { chooseLocale } from '@/features/invitations/renderer/live/detect';
import { countdownProps } from '@/features/invitations/sections/countdown/labels';
import { RSVP_NOTES } from '@/features/invitations/sections/rsvp/notes';
import { RSVP_KEYS } from '@/features/invitations/sections/rsvp/strings';
import { CULTURE_COPY } from '@/features/invitations/templates/culture-copy';
import { demoPeople } from '@/features/invitations/templates/demo-people';
import { TEMPLATES } from '@/features/invitations/templates/registry';
import { SEED_COPY } from '@/features/invitations/templates/seed-copy';
import { seedDocument } from '@/features/invitations/templates/seed-document';
import { templateLanguages, templateChain } from '@/features/whatsapp/languages';
import { fillTemplate, TEMPLATE_TEXT } from '@/features/whatsapp/template-text';
import { GALLERY_GUEST } from '@/lib/i18n/gallery-guest';

const NEW_LOCALES = ['ru', 'ar', 'fr', 'es', 'am'] as const satisfies readonly Locale[];
const isPlural = (v: unknown): v is PluralEntry =>
  !!v && typeof v === 'object' && 'one' in v && 'other' in v && typeof (v as PluralEntry).other === 'string';
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/**
 * The categories a language's plurals need (Intl knows them: Russian one/few/many/other…) — but
 * Hebrew's dual, which reads right as its plural ("2 ימים"), may fall back to it.
 */
const categories = (l: Locale) =>
  new Intl.PluralRules(LOCALE_INFO[l].intl)
    .resolvedOptions()
    .pluralCategories.filter((c) => !(l === 'he' && c === 'two'));

describe('the seven languages', () => {
  it('are he, en, ru, ar, fr, es, am — Hebrew and Arabic right to left, each with its Intl locale', () => {
    expect(LOCALES).toEqual(['he', 'en', 'ru', 'ar', 'fr', 'es', 'am']);
    expect(RTL_LOCALES).toEqual(['he', 'ar']);
    expect(INTL_LOCALE).toEqual({
      he: 'he-IL',
      en: 'en-GB',
      ru: 'ru-RU',
      ar: 'ar-IL-u-nu-latn',
      fr: 'fr-FR',
      es: 'es-ES',
      am: 'am-ET',
    });
    expect(scriptsOf(['he', 'ru', 'ar', 'am', 'fr'])).toEqual([
      'hebrew',
      'cyrillic',
      'arabic',
      'ethiopic',
      'latin',
    ]);
    expect(nativeName('am')).toBe('አማርኛ');
    expect(paidLocales(['he', 'en', 'ru', 'ar'])).toEqual(['ru', 'ar']);
  });

  it('every guest string exists in every language, with the same placeholders', () => {
    const keys = dictionaryKeys('en');
    expect(keys.length).toBeGreaterThan(60);
    for (const l of DICTIONARY_LOCALES) {
      expect(new Set(dictionaryKeys(l)), l).toEqual(new Set(keys));
      for (const key of keys) {
        const entry = dictEntry(l, key)!;
        const source = dictEntry('en', key)!;
        if (isPlural(entry)) {
          for (const c of categories(l))
            expect(entry[c as keyof PluralEntry], `${l} ${key} ${c}`).toBeTruthy();
          expect(placeholders(entry.other), `${l} ${key}`).toEqual(
            placeholders(isPlural(source) ? source.other : source),
          );
        } else {
          expect(String(entry).trim(), `${l} ${key}`).not.toBe('');
          expect(placeholders(String(entry)), `${l} ${key}`).toEqual(placeholders(String(source)));
        }
      }
    }
  });

  it('counts the way each language counts', () => {
    const days = (l: Locale, n: number) => plural(l, dictEntry(l, 'countdown.days') as PluralEntry, n);
    expect([1, 2, 5, 21, 22, 25].map((n) => days('ru', n))).toEqual([
      'День',
      'Дня',
      'Дней',
      'День',
      'Дня',
      'Дней',
    ]);
    // يوم · يومان · أيام · يومًا — one, two, three to ten, eleven and up
    expect([1, 2, 3, 11].map((n) => days('ar', n))).toEqual(['يوم', 'يومان', 'أيام', 'يومًا']);
    expect(days('he', 1)).not.toBe(days('he', 5));
    expect(countdownProps('ru').labels.days).toMatchObject({ one: 'День', few: 'Дня', many: 'Дней' });
    expect(countdownProps('ar').intl).toBe('ar-IL-u-nu-latn');
  });

  it('the RSVP form speaks every language', () => {
    for (const l of LOCALES) {
      for (const key of RSVP_KEYS) expect(dictEntry(l, key), `${l} ${key}`).toBeTruthy();
      expect(Object.values(RSVP_NOTES[l]).every((v) => typeof v === 'string' && v.trim())).toBe(true);
    }
    expect(t('ar', 'rsvp.submit')).not.toBe(t('en', 'rsvp.submit'));
  });
});

describe('dates, times and the Hebrew calendar in each language', () => {
  it('writes dates in the language, Arabic with Latin digits', () => {
    const texts = Object.fromEntries(
      LOCALES.map((l) => [
        l,
        formatDate('2027-06-17', l, { weekday: 'long', day: 'numeric', month: 'long' }),
      ]),
    );
    expect(texts.ru).toMatch(/июня/);
    expect(texts.fr).toMatch(/juin/);
    expect(texts.es).toMatch(/junio/);
    expect(texts.ar).toMatch(/17/);
    expect(texts.ar).not.toMatch(/[٠-٩]/);
    expect(texts.am).toMatch(/[ሀ-፿]/);
  });

  it('uses each language’s clock unless the host chose one', () => {
    expect(resolveTimeFormat('he', null)).toBe('24h');
    expect(resolveTimeFormat('ru', null)).toBe('24h');
    expect(resolveTimeFormat('fr', null)).toBe('24h');
    expect(resolveTimeFormat('en', null)).toBe('12h');
    expect(resolveTimeFormat('ar', null)).toBe('12h');
    expect(resolveTimeFormat('ar', '24h')).toBe('24h');
    expect(formatTime('19:30', 'ru', null)).toBe('19:30');
    expect(formatTime('19:30', 'ar', null)).not.toMatch(/[٠-٩]/);
  });

  it('writes the Hebrew date in every language — by default only in Hebrew and English', () => {
    for (const l of LOCALES) {
      // the year in Hebrew letters in Hebrew, in digits elsewhere
      expect(formatHebrewDate('2027-06-17', 'day', l), l).toMatch(l === 'he' ? /תשפ״ז/ : /5787/);
      expect(formatHebrewDate('2027-06-17', 'eve', l), l).not.toBe(formatHebrewDate('2027-06-17', 'day', l));
    }
    expect(formatHebrewDate('2027-06-17', 'day', 'ru')).toMatch(/сивана/);
    const event = { hebrewDate: 'day', hebrewDateLocales: undefined } as never;
    expect(LOCALES.filter((l) => showsHebrewDate(event, l))).toEqual(['he', 'en']);
    const chosen = { hebrewDate: 'day', hebrewDateLocales: ['ru', 'am'] } as never;
    expect(LOCALES.filter((l) => showsHebrewDate(chosen, l))).toEqual(['ru', 'am']);
  });
});

describe('Arabic in the link preview image (no shaper there)', () => {
  it('joins the letters in reading order, lam-alef as one, then lays the line out right to left', () => {
    expect(shapeArabic('سلام')).toBe('\uFEB3\uFEFC\uFEE1');
    expect(shapeArabic('مرحبا')).toBe('\uFEE3\uFEAE\uFEA3\uFE92\uFE8E');
    expect(shapeArabic('لا')).toBe('\uFEFB');
    // a mark on a letter doesn't break its joins
    expect(shapeArabic('بَب')).toBe('\uFE91\u064E\uFE90');
    expect(shapeArabic('Noa & 17')).toBe('Noa & 17');
    // visual order: the last letter first, digits kept left to right
    expect(visualLine(shapeArabic('سلام 17'), 'rtl')).toBe('17 \uFEE1\uFEFC\uFEB3');
  });
});

describe('the guest’s language', () => {
  it('reads language cells: codes and names in any of the seven languages', () => {
    expect(parseLanguage('ru')).toBe('ru');
    expect(parseLanguage('RU-ru')).toBe('ru');
    expect(parseLanguage('Русский')).toBe('ru');
    expect(parseLanguage('רוסית')).toBe('ru');
    expect(parseLanguage('العربية')).toBe('ar');
    expect(parseLanguage('arabe')).toBe('ar');
    expect(parseLanguage('Français')).toBe('fr');
    expect(parseLanguage('francais')).toBe('fr');
    expect(parseLanguage('español')).toBe('es');
    expect(parseLanguage('አማርኛ')).toBe('am');
    expect(parseLanguage('English')).toBe('en');
    expect(parseLanguage('iw')).toBe('he');
    expect(parseLanguage('Deutsch')).toBeNull();
    expect(parseLanguage('')).toBeNull();
  });

  it('picks the language to show: the guest’s choice, the link, then the browser’s languages', () => {
    const available = ['he', 'en', 'ru', 'ar'];
    expect(chooseLocale({ explicit: 'en', link: 'ru', browser: ['ar'], available })).toBe('en');
    expect(chooseLocale({ explicit: null, link: 'ru', browser: ['ar'], available })).toBe('ru');
    expect(chooseLocale({ explicit: null, link: null, browser: ['de-DE', 'ru-RU', 'en'], available })).toBe(
      'ru',
    );
    expect(chooseLocale({ explicit: null, link: null, browser: ['iw-IL'], available })).toBe('he');
    expect(chooseLocale({ explicit: 'fr', link: 'es', browser: ['pt'], available })).toBeNull();
    expect(bestLocale(['fr-CA', 'ar-IL'], ['he', 'ar'])).toBe('ar');
  });
});

describe('messages in each language', () => {
  it('names every event in every language, and the guest message has its values', () => {
    for (const l of LOCALES) {
      for (const type of EVENT_TYPES) expect(EVENT_PHRASE[l][type]?.trim(), `${l} ${type}`).toBeTruthy();
      expect(placeholders(GUEST_MESSAGE[l]), l).toEqual(['date', 'event', 'hosts', 'name', 'url']);
    }
  });

  it('the WhatsApp template: four values in every language, never side by side', () => {
    for (const l of LOCALES) {
      const { body, button, footer } = TEMPLATE_TEXT[l];
      for (const n of [1, 2, 3, 4]) expect(body, `${l} {{${n}}}`).toContain(`{{${n}}}`);
      expect(body, l).not.toMatch(/\}\}\s*\{\{/);
      expect(button.length, l).toBeLessThanOrEqual(25);
      expect(footer.length, l).toBeLessThanOrEqual(60);
      expect(fillTemplate(body, ['a', 'b', 'c', 'd'])).not.toMatch(/\{\{/);
    }
  });

  it('the template languages come from the configuration; each guest gets theirs or the invitation’s', () => {
    expect(templateLanguages(undefined).map((x) => x.locale)).toEqual(['he', 'en']);
    expect(templateLanguages(undefined, 'he')).toEqual([{ locale: 'he', code: 'he' }]);
    const langs = templateLanguages('he, en_US ,ru,ar,de,ru');
    expect(langs).toEqual([
      { locale: 'he', code: 'he' },
      { locale: 'en', code: 'en_US' },
      { locale: 'ru', code: 'ru' },
      { locale: 'ar', code: 'ar' },
    ]);
    const doc = { locales: ['he', 'ru', 'am'] as Locale[], defaultLocale: 'he' as Locale };
    expect(templateChain('ru', doc, langs).map((x) => x.locale)).toEqual(['ru', 'he']);
    expect(templateChain('am', doc, langs).map((x) => x.locale)).toEqual(['he', 'ru']);
    // a language the invitation doesn't have: its default
    expect(templateChain('ar', doc, langs)[0]!.locale).toBe('he');
    expect(templateChain(null, { locales: ['am'], defaultLocale: 'am' }, langs).map((x) => x.locale)).toEqual(
      ['he'],
    );
  });
});

describe('the gallery’s guest pages', () => {
  it('speak every language, with the Hebrew dictionary’s keys and each language’s plurals', () => {
    const shape = (value: unknown, path = ''): string[] =>
      value && typeof value === 'object' && !isPlural(value)
        ? Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
        : [path];
    const keys = shape(GALLERY_GUEST.he).sort();
    for (const l of LOCALES) {
      expect(shape(GALLERY_GUEST[l]).sort(), l).toEqual(keys);
      const walk = (value: unknown, path: string) => {
        if (isPlural(value)) {
          for (const c of categories(l))
            expect(value[c as keyof PluralEntry], `${l} ${path} ${c}`).toBeTruthy();
        } else if (value && typeof value === 'object')
          for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
        else expect(String(value).trim(), `${l} ${path}`).not.toBe('');
      };
      walk(GALLERY_GUEST[l], l);
    }
  });
});

describe('a new invitation in each language', () => {
  it('the seed copy and the culture copy cover every language', () => {
    for (const l of LOCALES) {
      expect(SEED_COPY.faqTitle[l], l).toBeTruthy();
      expect(SEED_COPY.timelineTitle('wedding')[l], l).toBeTruthy();
    }
    for (const l of NEW_LOCALES) {
      const c = CULTURE_COPY[l];
      for (const type of EVENT_TYPES) {
        expect(c.eyebrow[type], `${l} eyebrow ${type}`).toBeTruthy();
        expect(c.countdown.after[type], `${l} after ${type}`).toBeTruthy();
      }
    }
  });

  it('every template seeds a complete invitation in Russian, Arabic, French, Spanish and Amharic', () => {
    for (const { manifest, defaults } of TEMPLATES.values()) {
      const eventType = Object.keys(defaults.defaults)[0] as (typeof EVENT_TYPES)[number];
      const people = demoPeople(eventType, manifest.id);
      for (const l of NEW_LOCALES) {
        // an invitation in that language only: every text is there but what the host must write
        // (the venue)
        const doc = seedDocument(manifest, defaults, {
          eventType,
          locales: [l],
          defaultLocale: l,
          hosts: {
            primary: people.primary,
            secondary: people.secondary ?? null,
            parents: people.parents ?? null,
          },
          date: '2031-06-17',
          startTime: '19:30',
          endTime: '23:30',
          timezone: 'Asia/Jerusalem',
          slug: 'seed-check',
        });
        const { errors } = validateDocument(doc, manifest, {
          mode: 'publish',
          now: Date.parse('2026-09-26'),
        });
        const missing = errors.filter(
          (e) =>
            (e.code === 'missing_translation' || e.code === 'required') &&
            e.field !== 'venue.name' &&
            e.field !== 'venue.address',
        );
        expect(
          missing.map((e) => `${e.path}`),
          `${manifest.id} · ${l}`,
        ).toEqual([]);
      }
    }
  });
});
