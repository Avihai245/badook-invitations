import { describe, expect, it } from 'vitest';
import type { EventType, InvitationDocument, Locale } from '@/features/invitations/contracts/types';
import { CAPS, validateDocument, type Issue } from '@/features/invitations/contracts/validate';
import { FIXTURES, demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATE_IDS, TEMPLATES, requireTemplate } from '@/features/invitations/templates/registry';
import { seedDocument } from '@/features/invitations/templates/seed-document';

// §3 validation rules + §12.5 (publishing is blocked when any L10n misses a locale; the error points to
// the field).

const NOW = Date.parse('2026-09-23T10:00:00Z');
const check = (doc: unknown, mode: 'edit' | 'publish' = 'publish', templateId?: string) =>
  validateDocument(doc, requireTemplate(templateId ?? (doc as InvitationDocument).templateId).manifest, {
    mode,
    now: NOW,
  });
const wedding = () => structuredClone(FIXTURES['wedding-he-en']);
const brief = (issues: Issue[]) => issues.map((i) => `${i.code} ${i.path}`);

describe('fixtures, demos and wizard seeds', () => {
  it.each(Object.keys(FIXTURES))('fixture %s is publishable with no warnings', (key) => {
    const r = check(FIXTURES[key as keyof typeof FIXTURES]);
    expect(brief(r.issues)).toEqual([]);
  });

  it.each(TEMPLATE_IDS)('demo-%s is publishable', (id) => {
    expect(brief(check(demoDocument(id)).errors)).toEqual([]);
  });

  const LOCALE_SETS: Locale[][] = [['he'], ['en'], ['he', 'en'], ['en', 'he']];
  const cases = [...TEMPLATES.values()].flatMap(({ manifest }) =>
    manifest.categories.flatMap((eventType: EventType) =>
      LOCALE_SETS.map((locales) => [manifest.id, eventType, locales.join('+')] as const),
    ),
  );

  it.each(cases)(
    'wizard seed %s · %s · %s: only the venue details are missing, then it is publishable',
    (templateId, eventType, localeKey) => {
      const { manifest, defaults } = requireTemplate(templateId);
      const locales = localeKey.split('+') as Locale[];
      const doc = seedDocument(manifest, defaults, {
        eventType,
        locales,
        defaultLocale: locales[0]!,
        hosts: {
          primary: { he: 'נועה', en: 'Noa' },
          secondary: { he: 'איתי', en: 'Itay' },
          parents: { he: 'מרים ודני לוי', en: 'Miriam & Dani Levi' },
        },
        date: '2027-06-17',
        startTime: '19:30',
        endTime: '23:30',
        timezone: 'Asia/Jerusalem',
        slug: 'wizard-seed',
      });
      const r = check(doc);
      expect(r.errors.length).toBeGreaterThan(0);
      expect(
        r.errors.every(
          (e) => e.code === 'required' && (e.field === 'venue.name' || e.field === 'venue.address'),
        ),
      ).toBe(true);
      for (const s of doc.sections)
        if (s.type === 'venues')
          for (const v of s.data.items)
            for (const l of locales) {
              v.name[l] = 'Ahuzat HaGefen';
              v.address[l] = '12 Derech HaKramim';
            }
      expect(brief(check(doc).errors)).toEqual([]);
    },
  );
});

describe('translations (§12.5)', () => {
  it('a missing locale blocks publishing and points to the field and its section', () => {
    const doc = wedding();
    const hero = doc.sections[0]!;
    if (hero.type !== 'hero') throw new Error('hero first');
    hero.data.locationLine = { he: 'זכרון יעקב' };
    const r = check(doc);
    expect(r.errors).toEqual([
      {
        path: 'sections.0.data.locationLine.en',
        code: 'missing_translation',
        severity: 'error',
        field: 'hero.locationLine',
        sectionId: 'hero',
        params: { locale: 'en' },
      },
    ]);
  });

  it('whitespace-only text counts as missing; while editing it is a warning', () => {
    const doc = wedding();
    doc.hosts.primary.en = '   ';
    expect(brief(check(doc).errors)).toEqual(['missing_translation hosts.primary.en']);
    const edit = check(doc, 'edit');
    expect(edit.errors).toEqual([]);
    expect(brief(edit.warnings)).toEqual(['missing_translation hosts.primary.en']);
  });

  it('a disabled section never blocks publishing', () => {
    const doc = wedding();
    const faq = doc.sections.find((s) => s.type === 'faq')!;
    if (faq.type !== 'faq') throw new Error();
    faq.enabled = false;
    delete faq.data.items[0]!.a.en;
    const r = check(doc);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(['missing_translation']);
  });

  it('text empty in every language is "required" at the default language, not a missing translation', () => {
    const doc = wedding();
    doc.hosts.parents = { he: '', en: ' ' };
    expect(check(doc).errors).toEqual([
      { path: 'hosts.parents.he', code: 'required', severity: 'error', field: 'hosts.parents' },
    ]);
  });

  it('null optional texts are fine; a present optional text must be complete', () => {
    const doc = wedding();
    doc.share.ogTitle = null;
    expect(check(doc).errors).toEqual([]);
    doc.share.ogTitle = { he: 'כותרת' };
    expect(brief(check(doc).errors)).toEqual(['missing_translation share.ogTitle.en']);
  });
});

describe('length caps', () => {
  it('counts after the 12-character token budget', () => {
    const doc = wedding();
    const hero = doc.sections[0]!;
    if (hero.type !== 'hero') throw new Error();
    hero.data.eyebrow = { he: 'א'.repeat(CAPS.eyebrow), en: 'x'.repeat(CAPS.eyebrow + 1) };
    expect(check(doc).errors).toEqual([
      expect.objectContaining({
        path: 'sections.0.data.eyebrow.en',
        code: 'too_long',
        params: { max: 40, length: 41, locale: 'en' },
      }),
    ]);
    hero.data.eyebrow = { he: 'שלום', en: `${'x'.repeat(28)} {primary}` }; // 28 + 1 + 12 = 41
    expect(brief(check(doc).errors)).toEqual(['too_long sections.0.data.eyebrow.en']);
  });

  it('host names 20, timeline labels 22, section titles 32', () => {
    const doc = wedding();
    doc.hosts.primary.he = 'א'.repeat(21);
    const tl = doc.sections.find((s) => s.type === 'timeline')!;
    if (tl.type !== 'timeline') throw new Error();
    tl.data.items[0]!.label.en = 'x'.repeat(23);
    tl.data.title.en = 'x'.repeat(33);
    expect(brief(check(doc).errors).sort()).toEqual(
      [
        'too_long hosts.primary.he',
        `too_long sections.${doc.sections.indexOf(tl)}.data.items.0.label.en`,
        `too_long sections.${doc.sections.indexOf(tl)}.data.title.en`,
      ].sort(),
    );
  });

  it('monogram: at most maxGlyphs visible glyphs (spaces ignored)', () => {
    const doc = wedding(); // sahar-bordeaux: maxGlyphs 3
    doc.cover.monogram = { he: 'נ & א', en: 'NOAI' };
    expect(check(doc).errors).toEqual([
      expect.objectContaining({
        path: 'cover.monogram.en',
        code: 'monogram_too_long',
        params: { max: 3, locale: 'en' },
      }),
    ]);
  });
});

describe('structure and template references', () => {
  it('structural errors come from the schema with their path', () => {
    const doc = wedding();
    doc.share.slug = 'Not A Slug';
    expect(brief(check(doc).errors)).toEqual(['invalid share.slug']);
  });

  it('hero first, footer last, unique ids, one RSVP', () => {
    const doc = wedding();
    doc.sections.reverse();
    expect(check(doc).errors.map((e) => e.params?.expected)).toEqual(['hero_first', 'footer_last']);
    const dup = wedding();
    dup.sections[2]!.id = dup.sections[1]!.id;
    expect(brief(check(dup).errors)).toEqual(['duplicate_id sections.2.id']);
    const two = wedding();
    const rsvp = two.sections.find((s) => s.type === 'rsvp')!;
    two.sections.splice(two.sections.length - 1, 0, { ...rsvp, id: 'rsvp-2' });
    expect(brief(check(two).errors)).toEqual(['rsvp_multiple sections']);
  });

  it('an enabled RSVP needs a deadline', () => {
    const doc = wedding();
    doc.event.rsvpDeadline = null;
    expect(brief(check(doc).errors)).toEqual(['rsvp_deadline_required event.rsvpDeadline']);
    doc.sections.find((s) => s.type === 'rsvp')!.enabled = false;
    expect(check(doc).errors).toEqual([]);
  });

  it('palette keys, font pair, seal color, event type and locales must come from the template', () => {
    const doc = wedding();
    doc.theme.palette = { accent: '#731F2E', heroText: '#000000' }; // heroText is not editable
    doc.theme.fontPairId = 'comic';
    doc.cover.sealColor = '#FF00FF';
    doc.eventType = 'birthday';
    expect(brief(check(doc).errors).sort()).toEqual(
      [
        'event_type eventType',
        'font_pair theme.fontPairId',
        'palette_key theme.palette.heroText',
        'seal_color cover.sealColor',
      ].sort(),
    );
  });

  it('a template without recolor takes no seal color', () => {
    const doc = demoDocument('ramon-dusk'); // tag overlay, recolor false
    expect(check(doc).errors).toEqual([]);
    doc.cover.sealColor = '#A04C27';
    expect(brief(check(doc).errors)).toEqual(['seal_color cover.sealColor']);
  });

  it('default locale must be one of the locales; duplicates are rejected', () => {
    const doc = wedding();
    doc.locales = ['he', 'he'];
    doc.defaultLocale = 'en';
    const codes = check(doc).errors.map((e) => e.code);
    expect(codes).toContain('duplicate_locale');
    expect(codes).toContain('default_locale');
  });

  it('hero media: one of the template hero options or an upload', () => {
    const doc = wedding();
    const hero = doc.sections[0]!;
    if (hero.type !== 'hero') throw new Error();
    hero.data.media = { ...hero.data.media, src: 'template:grapes' };
    expect(brief(check(doc).errors)).toEqual(['hero_media sections.0.data.media.src']);
    hero.data.media = {
      kind: 'image',
      src: 'upload:owner/inv/photo.webp',
      poster: null,
      focalPoint: { x: 0.5, y: 0.5 },
    };
    expect(check(doc).errors).toEqual([]);
  });

  it('template:<key> references must exist in the template assets', () => {
    const doc = wedding();
    const story = doc.sections.find((s) => s.type === 'text')!;
    if (story.type !== 'text') throw new Error();
    story.data.illustration = 'template:unicorn';
    expect(brief(check(doc).errors)).toEqual([
      `asset_missing sections.${doc.sections.indexOf(story)}.data.illustration`,
    ]);
  });

  it('enabled list sections need items; venues at most 4; gift links need a URL (bank transfer: details)', () => {
    const doc = wedding();
    const faq = doc.sections.find((s) => s.type === 'faq')!;
    const gifts = doc.sections.find((s) => s.type === 'gifts')!;
    if (faq.type !== 'faq' || gifts.type !== 'gifts') throw new Error();
    faq.data.items = [];
    gifts.data.links[0]!.url = null;
    gifts.data.links[1] = { ...gifts.data.links[1]!, kind: 'bank_transfer', url: null, details: null };
    const fi = doc.sections.indexOf(faq);
    const gi = doc.sections.indexOf(gifts);
    expect(brief(check(doc).errors).sort()).toEqual(
      [
        `empty_section sections.${fi}.data.items`,
        `required sections.${gi}.data.links.0.url`,
        `required sections.${gi}.data.links.1.details`,
      ].sort(),
    );
    faq.enabled = false; // a hidden empty section is just unused
    expect(check(doc).issues.map((i) => i.code)).not.toContain('empty_section');
    const venues = doc.sections.find((s) => s.type === 'venues')!;
    if (venues.type !== 'venues') throw new Error();
    venues.data.items = Array.from({ length: 5 }, (_, i) => ({ ...venues.data.items[0]!, id: `v${i}` }));
    expect(check(doc).errors.map((e) => e.code)).toContain('too_many');
  });

  it('links must be https URLs', () => {
    const doc = wedding();
    const gifts = doc.sections.find((s) => s.type === 'gifts')!;
    if (gifts.type !== 'gifts') throw new Error();
    gifts.data.links[0]!.url = 'javascript:alert(1)';
    expect(check(doc).errors.map((e) => e.code)).toEqual(['invalid_url']);
  });
});

describe('warnings', () => {
  it('past event, past deadline, deadline after the event', () => {
    const doc = wedding();
    doc.event.rsvpDeadline = '2026-09-01';
    expect(brief(check(doc).warnings)).toEqual(['deadline_past event.rsvpDeadline']);
    doc.event.rsvpDeadline = '2027-07-01';
    expect(brief(check(doc).warnings)).toEqual(['deadline_after_event event.rsvpDeadline']);
    doc.event.date = '2026-01-01';
    doc.event.rsvpDeadline = '2025-12-01';
    expect(check(doc).warnings.map((w) => w.code)).toEqual(['event_past', 'deadline_past']);
    expect(check(doc).errors).toEqual([]);
  });

  it('low text contrast after a palette change (template defaults are never flagged)', () => {
    const doc = wedding();
    doc.theme.palette = { accent: '#731F2E', ink: '#DDDDDD' };
    expect(check(doc).warnings).toEqual([
      expect.objectContaining({ code: 'contrast_low', path: 'theme.palette.ink', severity: 'warning' }),
    ]);
  });
});
