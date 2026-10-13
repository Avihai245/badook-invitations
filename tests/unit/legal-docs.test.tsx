// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { siteEn } from '@/lib/i18n/site.en';
import { siteHe } from '@/lib/i18n/site.he';

// the page's shell (header, footer) is not under test here: only the document body is rendered
vi.mock('@/features/site/SiteFooter', () => ({ SiteFooter: () => null }));
vi.mock('@/features/site/SiteHeader.client', () => ({ SiteHeader: () => null }));

import { LegalContent } from '@/features/legal/LegalPage';
import { isLegalDocKey, legalHref, legalVersionHref } from '@/features/legal/links';
import { legalReadiness } from '@/features/legal/readiness';
import { LEGAL_VERSIONS, versionInForce, visibleVersions } from '@/features/legal/registry';
import {
  LEGAL_DOC_KEYS,
  type LegalBlock,
  type LegalContext,
  type LegalDoc,
  type LegalDocKey,
} from '@/features/legal/types';

const ctx = (locale: 'he' | 'en', over: Partial<LegalContext> = {}): LegalContext => ({
  locale,
  brand: 'Badook',
  site: 'https://invitations.example.test',
  operator: {
    name: 'Example Ltd',
    id: '510000000',
    address: '1 Test Street, Tel Aviv',
    phone: '03-0000000',
    email: 'support@example.test',
  },
  a11y: { name: 'Dana Test', phone: '03-1111111', email: 'access@example.test', manualReview: '' },
  privacyEmail: 'privacy@example.test',
  prices: { pro: 49, business: 149 },
  updated: locale === 'he' ? '1 בנובמבר 2026' : '1 November 2026',
  version: '2',
  faceSearch: true,
  ...over,
});

const blank = (locale: 'he' | 'en') =>
  ctx(locale, {
    operator: { name: '', id: '', address: '', phone: '', email: '' },
    a11y: { name: '', phone: '', email: '', manualReview: '' },
    privacyEmail: '',
  });

const v2 = (key: LegalDocKey) => LEGAL_VERSIONS[key].find((v) => v.version === '2')!;
const text = (d: LegalDoc) => JSON.stringify(d);
const kind = (b: LegalBlock) => (typeof b === 'string' ? 'p' : 'list' in b ? `list${b.list.length}` : 'note');
const shape = (d: LegalDoc) => ({
  intro: d.intro.map(kind),
  sections: d.sections.map((s) => [s.id, ...s.body.map(kind)]),
});

describe('version 1 is frozen', () => {
  const manifest = JSON.parse(readFileSync('tests/fixtures/legal-v1.sha256.json', 'utf8')) as Record<
    string,
    string
  >;
  for (const file of ['terms.ts', 'privacy.ts', 'cookies.ts', 'accessibility.ts']) {
    it(`${file} is byte-identical to the text that was in force`, () => {
      const sha = createHash('sha256')
        .update(readFileSync(`src/features/legal/v1/${file}`))
        .digest('hex');
      expect(sha).toBe(manifest[file]);
    });
  }

  it('still renders in both languages with the date of its own effective day', () => {
    for (const key of ['terms', 'privacy', 'cookies', 'accessibility'] as const) {
      const v1 = LEGAL_VERSIONS[key].find((v) => v.version === '1')!;
      expect(v1.effective).toBe('2026-10-10');
      for (const l of ['he', 'en'] as const) {
        const doc = v1.build(ctx(l, { version: '1', updated: '10 October 2026' }));
        expect(doc.sections.length).toBeGreaterThan(3);
      }
    }
  });
});

describe('the registry', () => {
  it('has six documents; refunds and gallery rules exist only from version 2', () => {
    expect([...LEGAL_DOC_KEYS]).toHaveLength(6);
    expect(LEGAL_VERSIONS.refunds.map((v) => v.version)).toEqual(['2']);
    expect(LEGAL_VERSIONS['gallery-rules'].map((v) => v.version)).toEqual(['2']);
    for (const k of ['terms', 'privacy', 'cookies', 'accessibility'] as const)
      expect(LEGAL_VERSIONS[k].map((v) => v.version)).toEqual(['1', '2']);
  });

  it('shows version 1 until version 2 is active, and nothing for a new document', () => {
    expect(versionInForce('terms', false)?.version).toBe('1');
    expect(versionInForce('terms', true)?.version).toBe('2');
    expect(versionInForce('refunds', false)).toBeNull();
    expect(versionInForce('gallery-rules', true)?.version).toBe('2');
    expect(visibleVersions('privacy', false).map((v) => v.version)).toEqual(['1']);
    expect(visibleVersions('privacy', true).map((v) => v.version)).toEqual(['1', '2']);
  });

  it('has stable public routes', () => {
    expect(LEGAL_DOC_KEYS.map(legalHref)).toEqual([
      '/terms',
      '/privacy',
      '/cookies',
      '/accessibility',
      '/refunds',
      '/gallery-rules',
    ]);
    expect(legalVersionHref('terms', '1')).toBe('/legal/terms/1');
    expect(isLegalDocKey('gallery-rules')).toBe(true);
    expect(isLegalDocKey('nope')).toBe(false);
  });
});

describe('readiness: a blank or half-set identity is never published', () => {
  const full = {
    INVITES_LEGAL_V2: true,
    INVITES_LEGAL_V2_EFFECTIVE: '2026-11-01',
    INVITES_LEGAL_NAME: 'Example Ltd',
    INVITES_LEGAL_ID: '510000000',
    INVITES_LEGAL_ADDRESS: '1 Test Street',
    INVITES_SUPPORT_EMAIL: 'support@example.test',
  };
  it('is active only when switched on and complete', () => {
    expect(legalReadiness(full)).toMatchObject({ active: true, missing: [] });
    expect(legalReadiness({ ...full, INVITES_LEGAL_V2: false }).active).toBe(false);
    for (const k of [
      'INVITES_LEGAL_NAME',
      'INVITES_LEGAL_ID',
      'INVITES_LEGAL_ADDRESS',
      'INVITES_SUPPORT_EMAIL',
      'INVITES_LEGAL_V2_EFFECTIVE',
    ] as const) {
      const r = legalReadiness({ ...full, [k]: '  ' });
      expect(r.active).toBe(false);
      expect(r.missing).toEqual([k]);
    }
  });
});

describe.each(LEGAL_DOC_KEYS)('%s (version 2)', (key) => {
  const he = v2(key).build(ctx('he'));
  const en = v2(key).build(ctx('en'));

  it('has a title, a description, an introduction and unique section ids', () => {
    for (const d of [he, en]) {
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.intro.length).toBeGreaterThan(0);
      const ids = d.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('numbers its sections 1..n without gaps or repeats', () => {
    for (const d of [he, en])
      d.sections.forEach((s, i) => expect(s.heading.startsWith(`${i + 1}. `), s.heading).toBe(true));
  });

  it('is the same document in Hebrew and English (ids, order, block kinds, list lengths)', () => {
    expect(shape(he)).toEqual(shape(en));
  });

  it('refers only to sections that exist', () => {
    for (const [d, re] of [
      [en, /\bsections? (\d+)(?:(?:,| and| or|–|-) ?(\d+))?/gi],
      [he, /סעיפים? (\d+)(?:(?:,| ו־?|–|-) ?(\d+))?/g],
    ] as const) {
      const refs = [...text(d).matchAll(re)].flatMap((m) => [m[1], m[2]].filter(Boolean).map(Number));
      for (const n of refs) expect(n, `${key} refers to section ${n}`).toBeLessThanOrEqual(d.sections.length);
    }
  });

  it('has no unfilled placeholders, nulls or invented details', () => {
    for (const d of [he, en]) {
      const t = text(d);
      expect(t).not.toMatch(/undefined|null|\[object|__[A-Z]+__|\{\{|\$\{|NaN/);
    }
  });

  it('shows the approved entity details and nothing when they are blank', () => {
    for (const [d, l] of [
      [he, 'he'],
      [en, 'en'],
    ] as const) {
      const t = text(d);
      // the accessibility statement names its coordinator, not the company
      expect(t).toContain(key === 'accessibility' ? 'Dana Test' : 'Example Ltd');
      const empty = text(v2(key).build(blank(l)));
      expect(empty).not.toContain(key === 'accessibility' ? 'Dana Test' : 'Example Ltd');
      expect(empty).not.toMatch(/undefined|null|\[object|\{\{|\$\{/);
      // no company number is invented for a deployment that has none
      expect(empty).not.toMatch(/51\d{7}/);
    }
  });

  it('renders to HTML with a heading, an anchor and a contents link for every section', () => {
    for (const [d, l] of [
      [he, 'he'],
      [en, 'en'],
    ] as const) {
      const html = renderToStaticMarkup(
        <LegalContent
          t={{ site: l === 'he' ? siteHe : siteEn } as never}
          doc={d}
          context={ctx(l)}
          info={{
            key,
            version: '2',
            current: true,
            history: [{ version: '2', effective: 'x', current: true }],
            related: ['terms'],
          }}
        />,
      );
      expect(html).toContain('<h1');
      for (const s of d.sections) {
        expect(html).toContain(`id="${s.id}"`);
        expect(html).toContain(`href="#${s.id}"`);
      }
    }
  });
});

describe('documents agree with each other and with the product', () => {
  const en = (k: LegalDocKey) => text(v2(k).build(ctx('en')));
  const he = (k: LegalDocKey) => text(v2(k).build(ctx('he')));

  it('terms and refund policy state the same prices, the same immediate cancellation and the same 14 days', () => {
    for (const f of [en, he]) {
      for (const k of ['terms', 'refunds'] as const) {
        expect(f(k)).toContain('₪49');
        expect(f(k)).toContain('₪149');
      }
    }
    expect(en('terms')).toMatch(/takes effect at once/);
    expect(en('refunds')).toMatch(/immediately/);
    expect(he('terms')).toMatch(/נכנס לתוקף מיד/);
    expect(he('refunds')).toMatch(/מיד/);
    expect(en('refunds')).toMatch(/14 days/);
    expect(he('refunds')).toMatch(/14 יום/);
    expect(en('refunds')).toContain('₪100');
    expect(he('refunds')).toContain('100 ₪');
  });

  it('no document still promises the old "three business days" cancellation', () => {
    for (const k of LEGAL_DOC_KEYS) {
      expect(en(k)).not.toMatch(/takes? effect within three|within three business days/i);
      expect(he(k)).not.toMatch(/נכנס לתוקף תוך שלושה/);
    }
    // ...and the refund policy says plainly that no approval or waiting is needed
    expect(en('refunds')).toMatch(/We do not need three business days/);
  });

  it('does not claim a universal 14-day refund or an unconditional cancellation fee', () => {
    expect(en('refunds')).toMatch(/Where the Consumer Protection Law/);
    expect(en('refunds')).toMatch(/we charge it only where the law permits it/);
    expect(he('refunds')).toMatch(/רק כשהחוק מתיר/);
  });

  it('names the payment providers the code can use, not only the one it used to', () => {
    expect(en('privacy')).toContain('Tranzila');
    expect(en('privacy')).toContain('PayPlus');
  });

  it('the privacy policy keeps the anchors the app links to', () => {
    const ids = v2('privacy')
      .build(ctx('en'))
      .sections.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['faces', 'gallery', 'rights', 'retention', 'reports']));
    const termsIds = v2('terms')
      .build(ctx('en'))
      .sections.map((s) => s.id);
    expect(termsIds).toEqual(expect.arrayContaining(['plans', 'cancel', 'reports', 'gallery']));
  });

  it('the privacy policy has no repeated section numbers (version 1 had two "7C")', () => {
    for (const l of ['he', 'en'] as const) {
      const heads = v2('privacy')
        .build(ctx(l))
        .sections.map((s) => s.heading.split('.')[0]);
      expect(new Set(heads).size).toBe(heads.length);
    }
  });

  it('describes face search as two processing activities and does not say nothing links a face to an uploader', () => {
    const p = en('privacy');
    expect(p).toMatch(/two different processing activities/);
    expect(p).toMatch(/does not extend to them/);
    expect(p).not.toMatch(/nothing links a face to a guest’s identity/);
  });

  it('when face search is not offered, the rules and the policy say no face is processed', () => {
    const off = ctx('en', { faceSearch: false });
    expect(text(v2('privacy').build(off))).toMatch(/not offered on the Service at this time/);
    expect(text(v2('gallery-rules').build(off))).toMatch(/not offered on the Service at this time/);
  });

  it('does not promise provider-side deletion or a backup period nobody verified', () => {
    const p = en('privacy') + en('gallery-rules');
    expect(p).toMatch(/do not promise that it deletes anything|we do not promise that it deletes/);
    expect(p).not.toMatch(/within 90 days/);
    expect(he('privacy')).not.toMatch(/תוך 90 יום/);
  });

  it('the accessibility statement claims no conformance, no exemption and no manual test unless a date is set', () => {
    const a = en('accessibility');
    expect(a).toMatch(/not reporting a manual review/);
    expect(a).not.toMatch(/fully conforms to|is fully accessible|exempt from/);
    const withReview = text(
      v2('accessibility').build(ctx('en', { a11y: { ...ctx('en').a11y, manualReview: '5 May 2026' } })),
    );
    expect(withReview).toMatch(/last carried out on 5 May 2026/);
  });

  it('the cookie policy lists the gallery storage the code uses', () => {
    for (const key of ['badook-gallery:uploader', 'badook-gallery:name', 'badook-gallery:asked'])
      expect(en('cookies')).toContain(key);
  });
});
