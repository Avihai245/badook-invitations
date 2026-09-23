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
    'wizard seed %s · %s · %s: only the venue details are missing (a save-the-date has none), then it is publishable',
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
      // §10.3: a save-the-date is the hero, the date reveal, a note and the footer — nothing to fill
      if (eventType === 'save_the_date') return expect(brief(r.errors)).toEqual([]);
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

  it('a hidden section is never checked — not even as a warning', () => {
    const doc = wedding();
    const faq = doc.sections.find((s) => s.type === 'faq')!;
    if (faq.type !== 'faq') throw new Error();
    faq.enabled = false;
    delete faq.data.items[0]!.a.en;
    expect(brief(check(doc).issues)).toEqual([]);
    expect(brief(check(doc, 'edit').issues)).toEqual([]);
    faq.enabled = true;
    expect(brief(check(doc).errors)).toEqual([`missing_translation sections.8.data.items.0.a.en`]);
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
    doc.hosts.parents = null;
    expect(check(doc).errors).toEqual([]);
    doc.hosts.parents = { he: 'מרים ודני' };
    expect(brief(check(doc).errors)).toEqual(['missing_translation hosts.parents.en']);
  });

  it('the link-preview title and description only warn: a language without them gets the automatic text', () => {
    const doc = wedding();
    doc.share.ogTitle = { he: 'כותרת' };
    doc.share.ogDescription = {};
    const r = check(doc);
    expect(r.errors).toEqual([]);
    expect(brief(r.warnings)).toEqual(['missing_translation share.ogTitle.en']);
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

  it('hero media: one of the template hero options, an upload, or a YouTube / Vimeo video', () => {
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
    for (const src of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://vimeo.com/76979871']) {
      hero.data.media = { kind: 'video', src, poster: null, focalPoint: { x: 0.5, y: 0.5 } };
      expect(check(doc).errors, src).toEqual([]);
    }
    // any other link isn't a background
    hero.data.media = {
      kind: 'video',
      src: 'https://example.com/clip.mp4',
      poster: null,
      focalPoint: { x: 0.5, y: 0.5 },
    };
    expect(brief(check(doc).errors)).toEqual(['hero_media sections.0.data.media.src']);
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
      [`required sections.${gi}.data.links.0.url`, `required sections.${gi}.data.links.1.details`].sort(),
    );
    // an empty section isn't shown, so it only warns
    expect(brief(check(doc).warnings)).toContain(`empty_section sections.${fi}.data.items`);
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

describe('switched off: what is off never shows, so nothing in it is checked', () => {
  const sectionOf = <T extends InvitationDocument['sections'][number]['type']>(
    doc: InvitationDocument,
    type: T,
  ) =>
    doc.sections.find((s) => s.type === type) as Extract<InvitationDocument['sections'][number], { type: T }>;

  it('a hidden gifts section with a half-filled Bit item (no label, no link) publishes cleanly', () => {
    const doc = wedding();
    const gifts = sectionOf(doc, 'gifts');
    gifts.enabled = false;
    gifts.data.links.push({ id: 'g9', kind: 'bit', label: { he: '', en: '' }, url: null, details: null });
    expect(brief(check(doc).issues)).toEqual([]);
    expect(brief(check(doc, 'edit').issues)).toEqual([]);
    // shown again → the item has to be completed
    gifts.enabled = true;
    expect(brief(check(doc).errors)).toEqual([
      'required sections.7.data.links.2.label.he',
      'required sections.7.data.links.2.url',
    ]);
  });

  it('no cover → its monogram, hint and seal color are not checked', () => {
    const doc = wedding();
    doc.cover.enabled = false;
    doc.cover.monogram = { he: 'נועה ואיתי לוי', en: '' };
    doc.cover.hint = { he: 'לחצו', en: '' };
    doc.cover.sealColor = '#123456';
    expect(brief(check(doc).issues)).toEqual([]);
    doc.cover.enabled = true;
    expect(
      check(doc)
        .errors.map((i) => i.code)
        .sort(),
    ).toEqual(['missing_translation', 'missing_translation', 'monogram_too_long', 'seal_color']);
  });

  it('RSVP options that are off: no dietary question → its note, no blessing field → its label', () => {
    const doc = wedding();
    const rsvp = sectionOf(doc, 'rsvp');
    rsvp.data.dietary = { ...rsvp.data.dietary, enabled: false, note: { he: 'הערה', en: '' } };
    rsvp.data.askMessage = false;
    rsvp.data.messageLabel = { he: 'ברכה', en: '' };
    expect(brief(check(doc).issues)).toEqual([]);
    rsvp.data.dietary.enabled = true;
    rsvp.data.askMessage = true;
    expect(brief(check(doc).errors)).toEqual([
      'missing_translation sections.9.data.dietary.note.en',
      'missing_translation sections.9.data.messageLabel.en',
    ]);
  });

  it("the parents' names only count when the footer shows them", () => {
    const doc = wedding();
    doc.hosts.parents = { he: 'מרים ודני לוי', en: '' };
    sectionOf(doc, 'footer').data.showParents = false;
    expect(brief(check(doc).issues)).toEqual([]);
    sectionOf(doc, 'footer').data.showParents = true;
    expect(brief(check(doc).errors)).toEqual(['missing_translation hosts.parents.en']);
  });

  it('music off (or the hero video playing its own sound) → the track is not checked', () => {
    const doc = wedding();
    doc.music = { ...doc.music, enabled: false, trackId: null, customUrl: 'template:no-such-track' };
    expect(brief(check(doc).issues)).toEqual([]);
    doc.music.enabled = true;
    expect(brief(check(doc).errors)).toEqual(['asset_missing music.customUrl']);
    const hero = sectionOf(doc, 'hero');
    hero.data.media = { ...hero.data.media, kind: 'video', src: 'upload:u/i/hero.mp4', poster: null };
    doc.music.videoSound = true;
    expect(brief(check(doc).issues)).toEqual([]);
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

  it('the dates that clash travel with the warning (the message names them)', () => {
    const doc = wedding();
    doc.event.date = '2026-09-25';
    doc.event.rsvpDeadline = '2026-09-30';
    expect(check(doc).warnings).toEqual([
      expect.objectContaining({
        code: 'deadline_after_event',
        params: { deadline: '2026-09-30', date: '2026-09-25' },
      }),
    ]);
  });

  it('a venue on another day than the event: fine next to one on the event day, flagged when alone', () => {
    const doc = wedding();
    const venues = doc.sections.find((s) => s.type === 'venues')!;
    if (venues.type !== 'venues') throw new Error();
    const first = venues.data.items[0]!;
    first.date = '2027-06-20';
    expect(check(doc).warnings).toEqual([
      expect.objectContaining({
        code: 'venue_date_differs',
        path: 'sections.3.data.items.0.date',
        sectionId: venues.id,
        params: { venueDate: '2027-06-20', date: '2027-06-17' },
      }),
    ]);
    // a two-day event: the henna on the event day, the wedding three days later
    venues.data.items.unshift({ ...structuredClone(first), id: 'henna', date: null });
    expect(check(doc).warnings).toEqual([]);
    // the venue's date equal to the event's is no clash either
    venues.data.items = [{ ...first, date: '2027-06-17' }];
    expect(check(doc).warnings).toEqual([]);
    // hidden venues show no date at all
    first.date = '2027-06-20';
    venues.data.items = [first];
    venues.enabled = false;
    expect(check(doc).warnings).toEqual([]);
  });

  it('low text contrast after a palette change (template defaults are never flagged)', () => {
    const doc = wedding();
    doc.theme.palette = { accent: '#731F2E', ink: '#DDDDDD' };
    expect(check(doc).warnings).toEqual([
      expect.objectContaining({ code: 'contrast_low', path: 'theme.palette.ink', severity: 'warning' }),
    ]);
  });
});
