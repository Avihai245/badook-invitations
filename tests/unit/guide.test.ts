import { describe, expect, it } from 'vitest';
import { GUIDE_ARTICLES, GUIDE_FAQ } from '@/features/guide/articles';
import { GUIDE_SCREEN_ARTICLE, GUIDE_SLUGS } from '@/features/guide/catalog';
import { articlesFor, guideAsText, searchGuide } from '@/features/guide/search';
import { GUIDE_SECTIONS } from '@/features/guide/types';
import { NAV_PATHS, type NavKey } from '@/features/invitations/app/workspace/stages';
import { resolveSupportPath } from '@/features/support/pages';

describe('the written guide (UX report §4.4)', () => {
  const slugs = new Set(GUIDE_ARTICLES.map((a) => a.slug));
  it('has unique slugs, links only to articles that exist, and 3–6 steps each, in both languages', () => {
    expect(slugs.size).toBe(GUIDE_ARTICLES.length);
    for (const a of GUIDE_ARTICLES) {
      expect(GUIDE_SECTIONS).toContain(a.section);
      expect(a.steps.length, a.slug).toBeGreaterThanOrEqual(3);
      expect(a.steps.length, a.slug).toBeLessThanOrEqual(6);
      for (const s of [a.title, a.what, a.why, ...a.steps]) {
        expect(s.he.trim(), a.slug).not.toBe('');
        expect(s.en.trim(), a.slug).not.toBe('');
      }
      for (const n of a.next) expect(slugs.has(n), `${a.slug} → ${n}`).toBe(true);
    }
    for (const f of GUIDE_FAQ) if (f.more) expect(slugs.has(f.more), f.more).toBe(true);
  });
  it('has a catalog (the slugs and each screen’s article, on every page) in step with the articles', () => {
    expect([...GUIDE_SLUGS]).toEqual(GUIDE_ARTICLES.map((a) => a.slug));
    for (const key of Object.keys(NAV_PATHS) as NavKey[])
      expect(GUIDE_SCREEN_ARTICLE[key], key).toBe(articlesFor(GUIDE_ARTICLES, key)[0]?.slug);
  });

  it('covers every feature the report lists', () => {
    for (const slug of [
      'quick-start',
      'create-invitation',
      'design-from-photos',
      'publish-and-share',
      'import-guests',
      'personal-links',
      'whatsapp-sending',
      'rsvp-and-notifications',
      'budget-gauge',
      'tasks',
      'vendors',
      'seating',
      'send-table',
      'event-day',
      'live-gallery',
      'hall-screen',
      'moments-film',
      'insights-privacy',
      'plans-billing',
    ])
      expect(slugs.has(slug), slug).toBe(true);
  });
  it('finds articles in either language and by the screen they explain', () => {
    expect(searchGuide(GUIDE_ARTICLES, 'אקסל', 'he')[0]?.article.slug).toBe('import-guests');
    expect(searchGuide(GUIDE_ARTICLES, 'budget gauge', 'en')[0]?.article.slug).toBe('budget-gauge');
    expect(searchGuide(GUIDE_ARTICLES, 'zzzz-nothing', 'he')).toEqual([]);
    expect(articlesFor(GUIDE_ARTICLES, 'budget').map((a) => a.slug)).toContain('budget-gauge');
  });
  it('is the assistant’s knowledge too, and its links resolve', () => {
    expect(guideAsText(GUIDE_ARTICLES, GUIDE_FAQ, 'he')).toContain('/app/guide/budget-gauge');
    expect(resolveSupportPath('/app/guide/budget-gauge', null)).toBe('/app/guide/budget-gauge');
    expect(resolveSupportPath('/app/guide/not-an-article', null)).toBeNull();
  });
});
