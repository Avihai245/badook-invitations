import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/features/invitations/contracts/types';
import { AI_PHOTOS_GUEST } from '@/lib/i18n/ai-photos-guest';
import { ALBUM_GUEST } from '@/lib/i18n/album-guest';
import { GALLERY_GUEST } from '@/lib/i18n/gallery-guest';
import { liveGalleryEn } from '@/lib/i18n/live-gallery.en';
import { liveGalleryHe } from '@/lib/i18n/live-gallery.he';

// The strings of version 2 of the legal documents on the guests' pages exist in all seven languages
// with the same shape, are never empty, keep their placeholders, and are translated (not copies).

const leaves = (v: unknown, path = ''): [string, string][] =>
  typeof v === 'string'
    ? [[path, v]]
    : v && typeof v === 'object'
      ? Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k))
      : [];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const SETS: Record<string, (l: Locale) => unknown> = {
  'gallery-guest legal': (l) => GALLERY_GUEST[l].legal,
  'ai-photos-guest notice': (l) => AI_PHOTOS_GUEST[l].notice,
  'album-guest legal': (l) => ALBUM_GUEST[l].legal,
};

describe.each(Object.entries(SETS))('%s', (_name, pick) => {
  const reference = leaves(pick('en'));
  it('has strings in the reference language', () => {
    expect(reference.length).toBeGreaterThan(5);
  });
  for (const locale of LOCALES) {
    it(`${locale}: the same keys, none empty, the same placeholders`, () => {
      const got = leaves(pick(locale));
      expect(got.map(([k]) => k)).toEqual(reference.map(([k]) => k));
      for (const [key, value] of got) {
        expect(value.trim(), `${locale} ${key}`).not.toBe('');
        const ref = reference.find(([k]) => k === key)![1];
        expect(placeholders(value), `${locale} ${key}`).toEqual(placeholders(ref));
      }
    });
  }
  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    it(`${locale}: is translated`, () => {
      const en = new Map(reference);
      const same = leaves(pick(locale)).filter(([k, v]) => v === en.get(k));
      expect(same.map(([k]) => k)).toEqual([]);
    });
  }
});

describe('what the notice must say and must not say', () => {
  it('the face-search line names the feature, in every language', () => {
    for (const l of LOCALES) expect(GALLERY_GUEST[l].legal.notice.faces.length).toBeGreaterThan(40);
  });
  it('the AI notice never promises the provider deletes anything, and names the provider', () => {
    for (const l of LOCALES) expect(AI_PHOTOS_GUEST[l].notice.send).toContain('OpenAI');
    expect(AI_PHOTOS_GUEST.en.notice.retention).toMatch(/provider’s own policy/);
    expect(AI_PHOTOS_GUEST.he.notice.retention).toContain('הספק');
  });
  it('the acknowledgement does not call itself a consent of the people in the photos', () => {
    expect(GALLERY_GUEST.en.legal.notice.ackOnly).toMatch(/not the consent of the people/);
    expect(GALLERY_GUEST.he.legal.notice.ackOnly).toContain('אינה הסכמה');
  });
});

describe('the host’s label for an item a report hid', () => {
  it('exists in Hebrew and English', () => {
    expect(liveGalleryHe.items.reasons.report).toBeTruthy();
    expect(liveGalleryEn.items.reasons.report).toBe('Hidden after a report');
  });
});
