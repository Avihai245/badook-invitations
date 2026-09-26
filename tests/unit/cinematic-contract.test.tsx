import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  migrateDocument,
  safeMigrateDocument,
} from '@/features/invitations/contracts/migrate';
import {
  HeroSectionSchema,
  InvitationDocumentSchema,
  SectionAnimationSchema,
  SectionMediaSchema,
  SectionSchema,
  TemplateManifestSchema,
  ThemeOverridesSchema,
} from '@/features/invitations/contracts/schemas';
import {
  DEFAULT_SECTION_ANIMATION,
  type EventType,
  type InvitationDocument,
  type Section,
} from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { cinematicDocument } from '@/features/invitations/dev/cinematic-demo';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { InvitationSections } from '@/features/invitations/renderer/InvitationSections';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATES, TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';
import { demoInvitations } from '@/features/invitations/templates/seed-data';

const fixturesDir = join(process.cwd(), 'docs/invitations/fixtures');
const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'))] as const);

const NOW = Date.parse('2026-09-23T10:00:00Z');
const render = (doc: InvitationDocument, locale = doc.defaultLocale) =>
  renderToStaticMarkup(
    <InvitationSections
      ctx={buildRenderContext(doc, requireTemplate(doc.templateId).manifest, locale, {
        brand: 'Badook',
        now: NOW,
        bases: {
          templateMedia: '',
          uploads: 'https://x.supabase.co/storage/v1/object/public/invitation-media',
        },
        publicBaseUrl: 'https://invitations.example',
      })}
    />,
  );

/** The same document as a v1 one: schema v2 only added optional fields, so it is the version number. */
const asV1 = (doc: InvitationDocument) => ({ ...structuredClone(doc), schemaVersion: 1 });

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
};

/** Every value of `input` is in `output` at the same path (what `migrateDocument` may add: defaults). */
function contains(output: unknown, input: unknown, path = ''): string[] {
  if (input === null || typeof input !== 'object') return Object.is(output, input) ? [] : [path];
  if (!output || typeof output !== 'object') return [path];
  return Object.entries(input).flatMap(([k, v]) =>
    path === '' && k === 'schemaVersion'
      ? []
      : contains((output as Record<string, unknown>)[k], v, `${path}.${k}`),
  );
}

describe('schema v2 migration', () => {
  it('is the latest version, and every document stored or seeded now is v2', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(2);
    for (const { doc } of demoInvitations()) expect(doc.schemaVersion).toBe(2);
  });

  it.each(fixtures)('%s (v1): pure, lossless and idempotent', (_file, json) => {
    expect(json.schemaVersion).toBe(1);
    const frozen = deepFreeze(structuredClone(json));
    const doc = migrateDocument(frozen);
    expect(doc.schemaVersion).toBe(2);
    // lossless: every value of the v1 document is there, at the same path
    expect(contains(doc, json)).toEqual([]);
    // idempotent: a v2 document comes back equal to itself
    expect(migrateDocument(doc)).toEqual(doc);
    expect(migrateDocument(migrateDocument(json))).toEqual(doc);
  });

  it.each(fixtures)('%s renders exactly the same migrated as the v2 document it becomes', (_file, json) => {
    const doc = migrateDocument(json);
    for (const locale of doc.locales) expect(render(migrateDocument(json), locale)).toBe(render(doc, locale));
  });

  it(
    'every template × event type demo: a v1 copy migrates to the same document and renders the same',
    { timeout: 120_000 },
    () => {
      let n = 0;
      for (const { manifest, defaults } of TEMPLATES.values()) {
        for (const type of Object.keys(defaults.defaults) as EventType[]) {
          const v2 = demoDocument(manifest.id, type);
          const migrated = migrateDocument(asV1(v2));
          expect(migrated, `${manifest.id}/${type}`).toEqual(v2);
          for (const locale of v2.locales) expect(render(migrated, locale)).toBe(render(v2, locale));
          n++;
        }
      }
      expect(n).toBeGreaterThanOrEqual(TEMPLATE_IDS.length);
    },
  );

  it(
    'every seeded demo invitation (fixtures, samples, demos) survives the migration unchanged',
    { timeout: 120_000 },
    () => {
      for (const { slug, doc } of demoInvitations()) {
        const migrated = migrateDocument(asV1(doc));
        expect(migrated, slug).toEqual(doc);
        expect(render(migrated), slug).toBe(render(doc));
      }
    },
  );

  it('a document without a version is v1; unknown versions and non-objects are refused', () => {
    const [, json] = fixtures[0]!;
    const { schemaVersion: _v, ...unversioned } = json;
    expect(migrateDocument(unversioned).schemaVersion).toBe(2);
    expect(() => migrateDocument({ ...json, schemaVersion: 3 })).toThrow(/schemaVersion/);
    expect(() => migrateDocument([])).toThrow();
  });

  it('safeMigrateDocument: the latest document, or where it is invalid', () => {
    const [, json] = fixtures.find(([f]) => f.includes('wedding'))!;
    const ok = safeMigrateDocument(json);
    expect(ok.success && ok.data.schemaVersion).toBe(2);
    const bad = safeMigrateDocument({ ...json, timezone: 'Mars/Olympus' });
    expect(bad).toMatchObject({ success: false, issues: [{ path: 'timezone' }] });
    expect(safeMigrateDocument({ ...json, schemaVersion: 7 })).toMatchObject({
      success: false,
      issues: [{ path: 'schemaVersion' }],
    });
    expect(safeMigrateDocument(null)).toMatchObject({ success: false });
  });
});

describe('schema v2 contract', () => {
  it('an animation may be partial: the schema fills the defaults', () => {
    expect(SectionAnimationSchema.parse({})).toEqual(DEFAULT_SECTION_ANIMATION);
    expect(SectionAnimationSchema.parse({ enter: { preset: 'zoom' }, text: 'words' })).toEqual({
      ...DEFAULT_SECTION_ANIMATION,
      enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset: 'zoom' },
      text: 'words',
    });
    expect(SectionAnimationSchema.safeParse({ intensity: 3 }).success).toBe(false);
    expect(SectionAnimationSchema.safeParse({ enter: { preset: 'spin' } }).success).toBe(false);
    expect(SectionAnimationSchema.safeParse({ enter: { duration: 50 } }).success).toBe(false);
    expect(SectionAnimationSchema.safeParse({ typo: 1 }).success).toBe(false);
  });

  it('section media: a picture or a file video with its focal point, still, description and scrim', () => {
    const media = { kind: 'image', src: 'upload:a/b.jpg', poster: null, focalPoint: { x: 0.3, y: 0.7 } };
    expect(SectionMediaSchema.parse(media)).toEqual(media);
    expect(SectionMediaSchema.safeParse({ ...media, alt: { he: 'תמונה' }, overlay: 0.4 }).success).toBe(true);
    expect(SectionMediaSchema.safeParse({ ...media, overlay: 0.9 }).success).toBe(false);
    expect(SectionMediaSchema.safeParse({ ...media, focalPoint: { x: 2, y: 0 } }).success).toBe(false);
    expect(SectionMediaSchema.safeParse({ ...media, src: 'ftp://x' }).success).toBe(false);
    expect(SectionMediaSchema.safeParse({ ...media, extra: true }).success).toBe(false);
  });

  it('theme overrides: partial tokens only', () => {
    expect(
      ThemeOverridesSchema.safeParse({
        palette: { bg: '#101010', ink: '#FAFAFA' },
        radius: { media: 24 },
        typography: { display: { size: 1.2 }, body: { lineHeight: 1.1, letterSpacing: 0.02 } },
        spacing: { section: 1.4 },
      }).success,
    ).toBe(true);
    expect(ThemeOverridesSchema.safeParse({ palette: { bg: 'red' } }).success).toBe(false);
    expect(ThemeOverridesSchema.safeParse({ typography: { title: { size: 1 } } }).success).toBe(false);
    expect(ThemeOverridesSchema.safeParse({ spacing: { section: 9 } }).success).toBe(false);
  });

  it('the hero takes motion and colors, but its media stays data.media and it always fills the screen', () => {
    const hero = demoDocument('sahar-bordeaux').sections[0]!;
    expect(HeroSectionSchema.safeParse({ ...hero, animation: { scroll: 'ken_burns' } }).success).toBe(true);
    expect(HeroSectionSchema.safeParse({ ...hero, layout: 'full_bleed' }).success).toBe(true);
    expect(HeroSectionSchema.safeParse({ ...hero, layout: 'split_start' }).success).toBe(false);
    expect(
      HeroSectionSchema.safeParse({
        ...hero,
        media: { kind: 'image', src: 'upload:x.jpg', poster: null, focalPoint: { x: 0.5, y: 0.5 } },
      }).success,
    ).toBe(false);
  });

  it('the five new section types parse, and a v1 section stays valid without any v2 field', () => {
    const doc = cinematicDocument('sahar-bordeaux');
    for (const type of ['parents', 'when', 'where', 'quote', 'custom'] as const)
      expect(
        doc.sections.some((s) => s.type === type),
        type,
      ).toBe(true);
    expect(InvitationDocumentSchema.safeParse(doc).success).toBe(true);
    const plain = demoDocument('sahar-bordeaux').sections.find((s) => s.type === 'timeline')!;
    expect(SectionSchema.parse(plain)).toEqual(plain);
  });

  it('the cover may name an opening (or none)', () => {
    const doc = demoDocument('sahar-bordeaux');
    for (const opening of ['gate', 'curtain', 'fireworks', 'gold_dust', 'envelope', null])
      expect(InvitationDocumentSchema.safeParse({ ...doc, cover: { ...doc.cover, opening } }).success).toBe(
        true,
      );
    expect(
      InvitationDocumentSchema.safeParse({ ...doc, cover: { ...doc.cover, opening: 'confetti' } }).success,
    ).toBe(false);
  });

  it('every template gets tokens v2 at the design’s own values (no manifest had to change)', () => {
    for (const id of TEMPLATE_IDS) {
      const { tokens, motion, cover } = requireTemplate(id).manifest;
      for (const role of ['display', 'heading', 'body', 'caption'] as const)
        expect(tokens.typography[role], `${id} ${role}`).toEqual({
          size: 1,
          lineHeight: 1,
          letterSpacing: 0,
        });
      expect(tokens.spacing).toEqual({ section: 1, gutter: 1, block: 1 });
      expect(tokens.overlay).toEqual({ color: null, opacity: null });
      expect(motion.intensity).toBe(1);
      expect(cover.opening).toBeNull();
    }
  });

  it('a manifest may set tokens v2 and an opening', () => {
    const { manifest } = TEMPLATES.get('sahar-bordeaux')!;
    const parsed = TemplateManifestSchema.parse({
      ...manifest,
      tokens: {
        ...manifest.tokens,
        radius: { ...manifest.tokens.radius, media: 28 },
        typography: { display: { size: 1.15 } },
        spacing: { section: 1.3 },
        overlay: { color: '#101820', opacity: 0.5 },
      },
      motion: { ...manifest.motion, intensity: 1.4 },
      cover: { ...manifest.cover, opening: { preset: 'gate', motion: 'slide', color: '#233040' } },
    });
    expect(parsed.tokens.typography.display).toEqual({ size: 1.15, lineHeight: 1, letterSpacing: 0 });
    expect(parsed.tokens.typography.body).toEqual({ size: 1, lineHeight: 1, letterSpacing: 0 });
    expect(parsed.tokens.spacing).toEqual({ section: 1.3, gutter: 1, block: 1 });
    expect(parsed.cover.opening).toEqual({ preset: 'gate', motion: 'slide', color: '#233040' });
    expect(
      TemplateManifestSchema.safeParse({
        ...manifest,
        cover: { ...manifest.cover, opening: { preset: 'x' } },
      }).success,
    ).toBe(false);
    expect(
      TemplateManifestSchema.safeParse({ ...manifest, motion: { ...manifest.motion, intensity: 4 } }).success,
    ).toBe(false);
  });
});

describe('validation of the v2 presentation', () => {
  const template = requireTemplate('sahar-bordeaux').manifest;
  const base = () => demoDocument('sahar-bordeaux');
  const withSection = (patch: (sections: Section[]) => Section[]) => {
    const doc = base();
    return { ...doc, sections: patch(doc.sections) };
  };
  const codes = (doc: unknown, mode: 'edit' | 'publish' = 'edit') =>
    validateDocument(doc, template, { mode, now: NOW }).issues.map(
      (i) => `${i.severity}:${i.code}:${i.path}`,
    );
  const insert = (s: Section) => (sections: Section[]) => [...sections.slice(0, -1), s, sections.at(-1)!];
  /** where `insert` puts a section: just before the footer */
  const at = base().sections.length - 1;

  it('accepts a v1 document (validated after its migration)', () => {
    const [, json] = fixtures.find(([f]) => f.includes('wedding'))!;
    expect(
      validateDocument(json, requireTemplate(json.templateId).manifest, { mode: 'edit', now: NOW }).errors,
    ).toEqual([]);
  });

  it('the cinematic showcase is valid for publishing in every template', { timeout: 60_000 }, () => {
    for (const id of TEMPLATE_IDS) {
      const doc = cinematicDocument(id);
      const { errors } = validateDocument(doc, requireTemplate(id).manifest, { mode: 'publish', now: NOW });
      expect(errors, id).toEqual([]);
    }
  });

  it('a layout that needs media, without it (or a video background with a picture), warns', () => {
    const quote = (layout: Section['layout'], media?: Section['media']): Section => ({
      id: 'q',
      type: 'quote',
      enabled: true,
      layout,
      media,
      data: { text: { he: 'א', en: 'A' }, attribution: null },
    });
    expect(codes(withSection(insert(quote('full_bleed'))))).toContain(
      `warning:layout_media:sections.${at}.layout`,
    );
    const picture = {
      kind: 'image' as const,
      src: 'upload:p.jpg',
      poster: null,
      focalPoint: { x: 0.5, y: 0.5 },
    };
    expect(codes(withSection(insert(quote('video_bg', picture))))).toContain(
      `warning:layout_media:sections.${at}.media`,
    );
    expect(codes(withSection(insert(quote('split_end', picture)))).join()).not.toContain('layout_media');
  });

  it('a section video must be a file with a still; a YouTube link blocks publishing', () => {
    const custom = (src: string, poster: string | null): Section => ({
      id: 'v',
      type: 'custom',
      enabled: true,
      layout: 'video_bg',
      media: { kind: 'video', src, poster, focalPoint: { x: 0.5, y: 0.5 } },
      data: { title: { he: 'ריקודים', en: 'Dance' }, subtitle: null, body: { he: 'א', en: 'A' }, cta: null },
    });
    expect(
      codes(
        withSection(insert(custom('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'upload:s.jpg'))),
        'publish',
      ),
    ).toContain(`error:media_link:sections.${at}.media.src`);
    expect(codes(withSection(insert(custom('upload:v.mp4', null))))).toContain(
      `warning:media_poster:sections.${at}.media.poster`,
    );
    expect(codes(withSection(insert(custom('upload:v.mp4', 'upload:s.jpg')))).join()).not.toMatch(
      /media_(link|poster)/,
    );
  });

  it('a template asset a section names must exist', () => {
    const doc = withSection(
      insert({
        id: 'c',
        type: 'custom',
        enabled: true,
        media: { kind: 'image', src: 'template:no-such-file', poster: null, focalPoint: { x: 0.5, y: 0.5 } },
        data: { title: null, subtitle: null, body: { he: 'א', en: 'A' }, cta: null },
      }),
    );
    expect(codes(doc)).toContain(`error:asset_missing:sections.${at}.media.src`);
  });

  it('the new sections’ texts are checked like the others (translations, lengths, links)', () => {
    const doc = withSection(
      insert({
        id: 'q',
        type: 'quote',
        enabled: true,
        data: { text: { he: 'ציטוט' }, attribution: { he: 'מקור', en: 'x'.repeat(61) } },
      }),
    );
    const found = codes(doc, 'publish');
    expect(found).toContain(`error:missing_translation:sections.${at}.data.text.en`);
    expect(found).toContain(`error:too_long:sections.${at}.data.attribution.en`);
    const cta = withSection(
      insert({
        id: 'c',
        type: 'custom',
        enabled: true,
        data: {
          title: { he: 'כותרת', en: 'Title' },
          subtitle: null,
          body: { he: 'טקסט', en: 'Text' },
          cta: { label: { he: 'לחצו', en: 'Go' }, url: 'http://example.com' },
        },
      }),
    );
    expect(codes(cta, 'publish')).toContain(`error:invalid_url:sections.${at}.data.cta.url`);
  });

  it('a picture’s description is optional: a missing translation only warns', () => {
    const doc = withSection(
      insert({
        id: 'c',
        type: 'custom',
        enabled: true,
        layout: 'split_start',
        media: {
          kind: 'image',
          src: 'upload:p.jpg',
          poster: null,
          focalPoint: { x: 0.5, y: 0.5 },
          alt: { he: 'שניים בשקיעה' },
        },
        data: { title: null, subtitle: null, body: { he: 'א', en: 'A' }, cta: null },
      }),
    );
    expect(codes(doc, 'publish')).toContain(`warning:missing_translation:sections.${at}.media.alt.en`);
  });

  it('parents without names, and without the event’s parents either, is an empty section', () => {
    const parents: Section = {
      id: 'p',
      type: 'parents',
      enabled: true,
      data: { title: null, items: [], note: null },
    };
    const doc = withSection(insert(parents));
    expect(codes({ ...doc, hosts: { ...doc.hosts, parents: null } })).toContain(
      `warning:empty_section:sections.${at}.data.items`,
    );
    expect(
      codes({ ...doc, hosts: { ...doc.hosts, parents: { he: 'הורים', en: 'Parents' } } }).join(),
    ).not.toContain(`empty_section:sections.${at}`);
  });

  it('a section’s own palette is checked for contrast', () => {
    const doc = withSection(
      insert({
        id: 'q',
        type: 'quote',
        enabled: true,
        themeOverrides: { palette: { bg: '#FFFFFF', ink: '#F4F4F4' } },
        data: { text: { he: 'א', en: 'A' }, attribution: null },
      }),
    );
    expect(codes(doc)).toContain(`warning:contrast_low:sections.${at}.themeOverrides.palette.ink`);
  });
});
