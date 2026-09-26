import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import { applyConcept, conceptDocument, rethemeDocument } from '@/features/art-direction/apply';
import { invitationPhotos } from '@/features/art-direction/client/photos';
import { candidateTemplates, slotLayouts } from '@/features/art-direction/catalog';
import { composeConcepts, scoreTemplate } from '@/features/art-direction/compose';
import { headlineCopy } from '@/features/art-direction/copy';
import {
  ConceptSchema,
  conceptsFromAnswer,
  parseAnswer,
  sanitizeConcept,
  type Answer,
  type Concept,
  type ConceptInput,
  type PhotoInfo,
} from '@/features/art-direction/model';
import { answerSchema, briefText } from '@/features/art-direction/prompt';
import { createConcepts, type ArtDeps } from '@/features/art-direction/server/api';
import type { InvitationDocument } from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { hasCinematicValues } from '@/features/invitations/renderer/cinematic/presentation';
import {
  extractSwatches,
  focalPointOf,
  passesAA,
  repairPalette,
  scrimForPhoto,
} from '@/features/invitations/lib/photo-palette';
import { FIXTURES } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';
import { isPremiumTemplate } from '@/features/invitations/templates/tier';

// "Design it for me" (features/art-direction): the AI's JSON held to what the product has, the
// composer that answers without the AI, the palette repair, and a concept applied to an invitation.

const png = (name: string) => PNG.sync.read(readFileSync(`tests/fixtures/palette/${name}.png`));
function info(name: string): PhotoInfo {
  const p = png(name);
  return {
    swatches: extractSwatches(p.data),
    focal: focalPointOf(p.data, p.width),
    scrim: scrimForPhoto(p.data, p.width),
    width: p.width,
    height: p.height,
  };
}
const PHOTOS: PhotoInfo[] = ['couple', 'sunset', 'venue', 'candles', 'bokeh'].map(info);

const input = (over: Partial<ConceptInput> = {}): ConceptInput => ({
  eventType: 'wedding',
  locales: ['he', 'en'],
  uiLocale: 'he',
  mood: '',
  photos: PHOTOS.slice(0, 4),
  access: { admin: false, premium: true },
  cinematic: true,
  current: null,
  ...over,
});

const aiConcept = (over: Record<string, unknown> = {}): Answer['concepts'][number] => ({
  name: 'Golden hour',
  rationale: 'Warm light from the sunset photo.',
  templateId: 'caesarea-shore',
  palette: {
    bg: '#F7F2EA',
    surface: '#FFFFFF',
    ink: '#F7F2EA', // unreadable on purpose: repaired
    inkMuted: '#EEEEEE',
    accent: '#E0A060',
    accentInk: '#E0A060',
    line: '#DDDDDD',
    heroText: '#FFFFFF',
  },
  fontPairId: 'lib-classic',
  opening: 'gate',
  motion: 'lively',
  heroPhoto: 1,
  placements: [
    { slot: 'story', photo: 0, layout: 'split_start' },
    { slot: 'story', photo: 2, layout: 'stack' }, // a slot once
    { slot: 'rsvp', photo: 3, layout: 'split_start' }, // not a layout the RSVP takes
    { slot: 'nowhere', photo: 2, layout: 'stack' },
    { slot: 'quote', photo: 9, layout: 'stack' }, // no such photo
    { slot: 'band', photo: 2, layout: 'parallax' },
  ],
  copy: { eyebrow: { he: 'בשעת זהב', en: 'At golden hour' }, closing: { he: 'נתראה', en: 'See you' } },
  ...over,
});

describe('the AI’s answer, held to the product', () => {
  it('parses the JSON (alone or inside text); anything else is no answer', () => {
    const answer = { concepts: [aiConcept()] };
    expect(parseAnswer(JSON.stringify(answer))?.concepts).toHaveLength(1);
    expect(parseAnswer(`Here you go:\n${JSON.stringify(answer)}\nEnjoy`)?.concepts).toHaveLength(1);
    expect(parseAnswer('no JSON here')).toBeNull();
    expect(parseAnswer('{"concepts": []}')).toBeNull();
  });

  it('a concept keeps only what exists: slots once, real photos, layouts the section takes', () => {
    const c = sanitizeConcept(aiConcept(), 0, input())!;
    expect(c).toMatchObject({
      id: 'c1',
      templateId: 'caesarea-shore',
      fontPairId: 'lib-classic',
      opening: 'gate',
      motion: 'lively',
      heroPhoto: 1,
      source: 'ai',
    });
    expect(c.placements).toEqual([
      { slot: 'story', photo: 0, layout: 'split_start' },
      { slot: 'rsvp', photo: 3, layout: slotLayouts('rsvp')[1] },
      { slot: 'band', photo: 2, layout: 'parallax' },
    ]);
    expect(slotLayouts('rsvp')).not.toContain('split_start');
    expect(c.copy).toEqual({
      eyebrow: { he: 'בשעת זהב', en: 'At golden hour' },
      closing: { he: 'נתראה', en: 'See you' },
    });
    expect(ConceptSchema.safeParse(c).success).toBe(true);
  });

  it('repairs the palette to WCAG AA (the design’s fixed colors stay its own)', () => {
    const c = sanitizeConcept(aiConcept(), 0, input())!;
    const { manifest } = requireTemplate('caesarea-shore');
    const editable = new Set(manifest.tokens.editablePaletteKeys);
    for (const [key, value] of Object.entries(c.palette))
      if (!editable.has(key as never))
        expect(value, key).toBe(manifest.tokens.palette[key as keyof typeof manifest.tokens.palette]);
    // what may change reads on what it sits on
    expect(repairPalette(c.palette, editable)).toEqual(c.palette);
    const free = repairPalette(
      { ...manifest.tokens.palette, ink: '#F7F2EA', inkMuted: '#EEEEEE', accentInk: '#E0A060' },
      new Set(['ink', 'inkMuted', 'accentInk'] as const),
    );
    expect(passesAA(free)).toBe(true);
  });

  it('refuses a template the host can’t use; fixes an unknown font, opening, motion and photo', () => {
    expect(sanitizeConcept(aiConcept({ templateId: 'no-such' }), 0, input())).toBeNull();
    // made for other events
    expect(sanitizeConcept(aiConcept({ templateId: 'dino-hatch' }), 0, input())).toBeNull();
    // unlisted: the admins'
    expect(sanitizeConcept(aiConcept({ templateId: 'lumiere' }), 0, input())).toBeNull();
    expect(
      sanitizeConcept(
        aiConcept({ templateId: 'lumiere' }),
        0,
        input({ access: { admin: true, premium: true } }),
      ),
    ).not.toBeNull();
    // premium designs need a plan that has them
    expect(
      sanitizeConcept(
        aiConcept({ templateId: 'jasper-cameo' }),
        0,
        input({ access: { admin: false, premium: false } }),
      ),
    ).toBeNull();
    const c = sanitizeConcept(
      aiConcept({ fontPairId: 'comic-sans', opening: 'explode', motion: 'wild', heroPhoto: 42 }),
      1,
      input(),
    )!;
    const { manifest } = requireTemplate('caesarea-shore');
    expect(c).toMatchObject({
      id: 'c2',
      fontPairId: manifest.fontPairs[0]!.id,
      opening: 'envelope',
      motion: 'gentle',
      heroPhoto: 0,
    });
  });

  it('copy must be in every language and short; without `cinematic` no opening or placements', () => {
    const c = sanitizeConcept(
      aiConcept({ copy: { eyebrow: { he: 'רק עברית' }, closing: { he: 'x'.repeat(200), en: 'long' } } }),
      0,
      input(),
    )!;
    expect(c.copy).toEqual({ eyebrow: null, closing: null });
    const plain = sanitizeConcept(aiConcept(), 0, input({ cinematic: false }))!;
    expect(plain.opening).toBe('envelope');
    expect(plain.placements).toEqual([]);
  });

  it('three concepts on three templates; a repeat or a missing one is composed', () => {
    const fill = vi.fn((count: number, avoid: readonly Concept[]) => composeConcepts(input(), count, avoid));
    const concepts = conceptsFromAnswer(
      {
        concepts: [
          aiConcept(),
          aiConcept({ name: 'Same design again' }),
          aiConcept({ templateId: 'papercut-gold', fontPairId: 'lib-heritage' }),
        ],
      },
      input(),
      fill,
    );
    expect(concepts.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(new Set(concepts.map((c) => c.templateId)).size).toBe(3);
    expect(concepts.map((c) => c.source)).toEqual(['ai', 'ai', 'composer']);
    expect(fill).toHaveBeenCalledWith(1, expect.any(Array));
  });
});

describe('the composer (no AI)', () => {
  it('three complete concepts, on templates made for the event, in its languages — the same every time', () => {
    const a = composeConcepts(input());
    const b = composeConcepts(input());
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((c) => c.templateId)).size).toBe(3);
    for (const c of a) {
      const { manifest } = requireTemplate(c.templateId);
      expect(manifest.categories).toContain('wedding');
      expect(manifest.listed).toBe(true);
      expect(ConceptSchema.safeParse(c).success).toBe(true);
      expect(repairPalette(c.palette, new Set(manifest.tokens.editablePaletteKeys))).toEqual(c.palette);
      expect(c.copy.eyebrow).toEqual({ he: expect.any(String), en: expect.any(String) });
      expect(c.name).toBeTruthy();
      expect(c.rationale).toMatch(/\./);
      expect(c.heroPhoto).toBe(0);
      expect(c.placements.length).toBe(3); // four photos: the hero and three more
      for (const p of c.placements) expect(slotLayouts(p.slot)).toContain(p.layout);
    }
    // clearly different: motion, opening and fonts differ
    expect(new Set(a.map((c) => c.motion)).size).toBe(3);
    expect(new Set(a.map((c) => c.opening)).size).toBe(3);
    expect(new Set(a.map((c) => c.fontPairId)).size).toBe(3);
  });

  it('the host’s words move the choice (the sea: a shore design first)', () => {
    const shore = requireTemplate('caesarea-shore');
    const words = input({ mood: 'ים ושקיעה' });
    const plain = input();
    const swatches = PHOTOS.flatMap((p) => p.swatches);
    expect(scoreTemplate(shore, words, swatches)).toBeGreaterThan(scoreTemplate(shore, plain, swatches));
    expect(composeConcepts(words).map((c) => c.templateId)).toContain('caesarea-shore');
  });

  it('only what the host may use; with one design for the event, three looks of it', () => {
    const open = composeConcepts(input({ access: { admin: false, premium: false } }));
    for (const c of open) expect(isPremiumTemplate(requireTemplate(c.templateId).manifest)).toBe(false);
    expect(
      candidateTemplates('henna', ['he', 'en'], { admin: false, premium: false }).map((e) => e.manifest.id),
    ).toEqual(['ramon-dusk']);
    const henna = composeConcepts(input({ eventType: 'henna', access: { admin: false, premium: false } }));
    expect(henna.map((c) => c.templateId)).toEqual(['ramon-dusk', 'ramon-dusk', 'ramon-dusk']);
    expect(new Set(henna.map((c) => `${c.opening}|${c.motion}`)).size).toBe(3);
  });

  it('without `cinematic`: the design’s own opening, no photos in sections', () => {
    for (const c of composeConcepts(input({ cinematic: false }))) {
      expect(c.opening).toBe('envelope');
      expect(c.placements).toEqual([]);
    }
  });

  it('writes its names and reasons in the host’s language', () => {
    expect(composeConcepts(input({ uiLocale: 'en' }))[0]!.rationale).toMatch(/[a-z]/);
    expect(composeConcepts(input({ uiLocale: 'he' }))[0]!.rationale).toMatch(/[א-ת]/);
    expect(headlineCopy('brit', 'warm', ['he', 'en']).eyebrow).toEqual({
      he: 'נולד לנו בן!',
      en: 'Our son is here!',
    });
    // a language the bank doesn't have keeps the invitation's own text
    expect(headlineCopy('wedding', 'classic', ['he', 'de' as never])).toEqual({
      eyebrow: null,
      closing: null,
    });
  });

  it('has its headline copy in all seven languages of the invitations, for every event and tone', () => {
    const seven = ['he', 'en', 'ru', 'ar', 'fr', 'es', 'am'] as never[];
    const events = [
      'wedding',
      'engagement',
      'henna',
      'save_the_date',
      'bar_mitzvah',
      'bat_mitzvah',
      'brit',
      'baby_shower',
      'birthday',
      'corporate',
      'other',
    ] as const;
    for (const event of events)
      for (const tone of ['classic', 'warm', 'playful'] as const) {
        const { eyebrow, closing } = headlineCopy(event, tone, seven);
        for (const line of [eyebrow, closing]) {
          expect(line, `${event} ${tone}`).not.toBeNull();
          expect(Object.keys(line!).sort()).toEqual(['am', 'ar', 'en', 'es', 'fr', 'he', 'ru']);
          for (const text of Object.values(line!)) expect(text!.trim().length).toBeGreaterThan(1);
        }
      }
    expect(headlineCopy('engagement', 'warm', seven).eyebrow).toMatchObject({
      ru: 'Мы обручились!',
      am: 'ታጭተናል!',
    });
  });
});

describe('the brief', () => {
  it('lists only the templates the host may use, and asks for every language of the invitation', () => {
    const text = briefText(input({ access: { admin: false, premium: false } }));
    expect(text).toContain('caesarea-shore');
    expect(text).not.toContain('jasper-cameo');
    expect(text).not.toContain('lumiere');
    const schema = answerSchema(input()) as unknown as {
      properties: {
        concepts: { items: { properties: { copy: { properties: { eyebrow: { required: string[] } } } } } };
      };
    };
    expect(schema.properties.concepts.items.properties.copy.properties.eyebrow.required).toEqual([
      'he',
      'en',
    ]);
  });
});

describe('a concept applied to an invitation', () => {
  const doc = () => structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
  const photos = [0, 1, 2, 3].map((i) => ({
    ref: `upload:owner/inv/photo-${i}.jpg`,
    focal: PHOTOS[i]!.focal,
    scrim: PHOTOS[i]!.scrim,
  }));

  it('another design keeps the host’s content and drops the old design’s own values', () => {
    const from = requireTemplate('sahar-bordeaux');
    const to = requireTemplate('caesarea-shore');
    const moved = rethemeDocument(doc(), from, to);
    expect(moved.templateId).toBe('caesarea-shore');
    expect(moved.hosts).toEqual(doc().hosts);
    expect(moved.event).toEqual(doc().event);
    expect(moved.sections.map((s) => s.id)).toEqual(doc().sections.map((s) => s.id));
    const { errors } = validateDocument(moved, to.manifest, { mode: 'edit' });
    expect(
      errors.filter((e) => ['palette_key', 'font_pair', 'seal_color', 'asset_missing'].includes(e.code)),
    ).toEqual([]);
    // the same design: nothing to do
    expect(rethemeDocument(doc(), from, from)).toEqual(doc());
  });

  it('the concept: palette, fonts, headline, the hero photo, photos in sections, a band where a slot is missing', () => {
    const concept = composeConcepts(input())[0]!;
    const from = requireTemplate('sahar-bordeaux');
    const to = requireTemplate(concept.templateId);
    const out = conceptDocument(doc(), from, to, concept, photos, true);
    expect(out.templateId).toBe(concept.templateId);
    expect(out.theme.fontPairId).toBe(concept.fontPairId);
    const hero = out.sections.find((s) => s.type === 'hero')!;
    expect(hero.type === 'hero' && hero.data.media.src).toBe('upload:owner/inv/photo-0.jpg');
    expect(hero.type === 'hero' && hero.data.eyebrow).toEqual(concept.copy.eyebrow);
    const placed = out.sections.filter((s) => s.media?.src.startsWith('upload:'));
    expect(placed.length).toBe(concept.placements.length);
    for (const s of placed)
      expect(s.layout === undefined || slotLayouts('story').includes(s.layout)).toBe(true);
    // the palette: only what the design lets change
    const editable = new Set(to.manifest.tokens.editablePaletteKeys);
    for (const key of Object.keys(out.theme.palette ?? {})) expect(editable.has(key as never)).toBe(true);
    const { errors } = validateDocument(out, to.manifest, { mode: 'edit' });
    expect(errors).toEqual([]);
    // the host's names and places are theirs
    expect(out.hosts).toEqual(doc().hosts);
  });

  it('a slot the invitation lacks becomes a picture band (two at most); without `cinematic`, no v2 values', () => {
    const concept: Concept = {
      ...composeConcepts(input())[0]!,
      templateId: 'sahar-bordeaux',
      placements: [
        { slot: 'parents', photo: 1, layout: 'split_start' },
        { slot: 'where', photo: 2, layout: 'full_bleed' },
        { slot: 'band', photo: 3, layout: 'parallax' },
      ],
    };
    const t = requireTemplate('sahar-bordeaux');
    const out = applyConcept(doc(), concept, t.manifest, t.defaults, photos, true);
    const bands = out.sections.filter((s) => s.type === 'custom' && s.id.startsWith('band'));
    expect(bands).toHaveLength(2);
    expect(bands.map((b) => b.layout)).toEqual(['full_bleed', 'full_bleed']);
    const plain = applyConcept(doc(), concept, t.manifest, t.defaults, photos, false);
    expect(hasCinematicValues(plain)).toBe(false);
    expect(plain.sections.filter((s) => s.type === 'custom')).toHaveLength(0);
  });
});

describe('POST /api/art-direction', () => {
  const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'host@example.com' };
  const jpeg = Buffer.from('fake jpeg bytes').toString('base64');
  const body = (over: Record<string, unknown> = {}) => ({
    eventType: 'wedding',
    locales: ['he', 'en'],
    uiLocale: 'en',
    mood: 'sea',
    photos: PHOTOS.slice(0, 3).map((p) => ({ jpeg, info: p })),
    ...over,
  });
  const deps = (over: Partial<ArtDeps> = {}): ArtDeps => ({
    access: vi.fn(async () => ({
      status: 'ok' as const,
      access: { admin: false, premium: true },
      cinematic: true,
    })),
    rateHit: vi.fn(async () => true),
    rateKey: (scope, value) => `${scope}:${value}`,
    ask: vi.fn(async () => ({
      status: 'ok' as const,
      answer: {
        concepts: [
          aiConcept(),
          aiConcept({ templateId: 'papercut-gold' }),
          aiConcept({ templateId: 'sahar-bordeaux' }),
        ],
      },
    })),
    limits: { perAccount: 12, site: 2000 },
    ...over,
  });

  it('asks the AI with the photos and answers three concepts', async () => {
    const d = deps();
    const res = await createConcepts(USER, body(), d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, source: 'ai', reason: null });
    expect((res.body.concepts as Concept[]).map((c) => c.templateId)).toEqual([
      'caesarea-shore',
      'papercut-gold',
      'sahar-bordeaux',
    ]);
    expect(d.ask).toHaveBeenCalledWith(expect.objectContaining({ mood: 'sea', eventType: 'wedding' }), [
      jpeg,
      jpeg,
      jpeg,
    ]);
  });

  it('without the AI, past a limit or when it fails: the composer answers (and says why)', async () => {
    const noAi = await createConcepts(USER, body(), deps({ ask: null }));
    expect(noAi.body).toMatchObject({ ok: true, source: 'composer', reason: 'no_ai' });
    expect(noAi.body.concepts).toHaveLength(3);
    const overDay = await createConcepts(
      USER,
      body(),
      deps({ rateHit: vi.fn(async (key: string) => !key.startsWith('account:')) }),
    );
    expect(overDay.body).toMatchObject({ source: 'composer', reason: 'limit' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failed = await createConcepts(
      USER,
      body(),
      deps({ ask: vi.fn(async () => ({ status: 'error' as const, error: '529 overloaded_error' })) }),
    );
    expect(failed.body).toMatchObject({ source: 'composer', reason: 'error' });
    // the log says what went wrong — never the photos
    expect(JSON.stringify(error.mock.calls)).not.toContain(jpeg);
    error.mockRestore();
    const partial = await createConcepts(
      USER,
      body(),
      deps({ ask: vi.fn(async () => ({ status: 'ok' as const, answer: { concepts: [aiConcept()] } })) }),
    );
    expect(partial.body).toMatchObject({ source: 'ai', reason: 'invalid' });
    expect(partial.body.concepts).toHaveLength(3);
  });

  it('refuses without the feature, for another host’s invitation, a bad body, too many requests', async () => {
    expect(
      (await createConcepts(USER, body(), deps({ access: vi.fn(async () => ({ status: 'off' as const })) })))
        .status,
    ).toBe(403);
    expect(
      (
        await createConcepts(
          USER,
          body({ invitationId: '22222222-2222-4222-8222-222222222222' }),
          deps({ access: vi.fn(async () => ({ status: 'not_found' as const })) }),
        )
      ).status,
    ).toBe(404);
    expect((await createConcepts(USER, body({ photos: [] }), deps())).status).toBe(400);
    expect((await createConcepts(USER, body({ locales: ['he', 'he'] }), deps())).status).toBe(400);
    expect((await createConcepts(USER, body({ mood: 'x'.repeat(200) }), deps())).status).toBe(400);
    expect((await createConcepts(USER, body(), deps({ rateHit: vi.fn(async () => false) }))).status).toBe(
      429,
    );
  });
});

describe('focal points', () => {
  it('finds the subject of a picture; a flat one is centered', () => {
    const w = 80;
    const h = 60;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const inside = Math.hypot(x - 0.7 * w, y - 0.3 * h) < 7;
        rgba[o] = inside ? 220 : 90;
        rgba[o + 1] = inside ? 40 : 110;
        rgba[o + 2] = inside ? 40 : 130;
        rgba[o + 3] = 255;
      }
    const f = focalPointOf(rgba, w);
    expect(Math.abs(f.x - 0.7)).toBeLessThan(0.08);
    expect(Math.abs(f.y - 0.3)).toBeLessThan(0.1);
    expect(focalPointOf(new Uint8ClampedArray(w * h * 4).fill(128), w)).toEqual({ x: 0.5, y: 0.5 });
    // the fixtures: always inside the picture
    for (const p of PHOTOS) {
      expect(p.focal.x).toBeGreaterThanOrEqual(0.1);
      expect(p.focal.x).toBeLessThanOrEqual(0.9);
    }
  });
});

describe('three more, and the invitation’s own photos', () => {
  it('"three more" avoids the designs already shown (while the event has others)', () => {
    const first = composeConcepts(input());
    const more = composeConcepts(input({ avoid: first }));
    const shown = new Set(first.map((c) => c.templateId));
    expect(more).toHaveLength(3);
    expect(more.filter((c) => shown.has(c.templateId))).toEqual([]);
    // the AI hears what was shown
    expect(briefText(input({ avoid: first }))).toContain('alreadyShown');
    expect(briefText(input())).not.toContain('alreadyShown');
  });

  it('the API passes what was shown to the composer and to the AI', async () => {
    const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'host@example.com' };
    const jpeg = Buffer.from('fake jpeg bytes').toString('base64');
    const first = composeConcepts(input({ uiLocale: 'en', photos: PHOTOS.slice(0, 3) }));
    const avoid = first.map((c) => ({ templateId: c.templateId, fontPairId: c.fontPairId }));
    const ask = vi.fn(async () => ({ status: 'error' as const, error: 'down' }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await createConcepts(
      USER,
      {
        eventType: 'wedding',
        locales: ['he', 'en'],
        uiLocale: 'en',
        photos: PHOTOS.slice(0, 3).map((p) => ({ jpeg, info: p })),
        avoid,
      },
      {
        access: vi.fn(async () => ({
          status: 'ok' as const,
          access: { admin: false, premium: true },
          cinematic: true,
        })),
        rateHit: vi.fn(async () => true),
        rateKey: (scope, value) => `${scope}:${value}`,
        ask,
        limits: { perAccount: 12, site: 2000 },
      },
    );
    error.mockRestore();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ avoid }), expect.any(Array));
    const again = (res.body.concepts as Concept[]).map((c) => c.templateId);
    expect(again.filter((id) => avoid.some((a) => a.templateId === id))).toEqual([]);
  });

  it('the invitation’s own photos: the host’s uploads, each once, never the design’s', () => {
    const doc = structuredClone(FIXTURES['wedding-he-en']) as InvitationDocument;
    const hero = doc.sections.find((s) => s.type === 'hero')!;
    if (hero.type !== 'hero') throw new Error('hero');
    hero.data.media = {
      kind: 'image',
      src: 'upload:o/i/a.jpg',
      poster: null,
      focalPoint: { x: 0.5, y: 0.5 },
    };
    const story = doc.sections.find((s) => s.type === 'text')!;
    story.media = {
      kind: 'video',
      src: 'upload:o/i/v.mp4',
      poster: 'upload:o/i/v.jpg',
      focalPoint: { x: 0.5, y: 0.5 },
    };
    const other = doc.sections.find((s) => s.type === 'venues')!;
    other.media = { kind: 'image', src: 'template:photo1', poster: null, focalPoint: { x: 0.5, y: 0.5 } };
    const last = doc.sections.find((s) => s.type === 'rsvp')!;
    last.media = { kind: 'image', src: 'upload:o/i/a.jpg', poster: null, focalPoint: { x: 0.5, y: 0.5 } };
    const refs = invitationPhotos(doc);
    expect(refs.slice(0, 2)).toEqual(['upload:o/i/a.jpg', 'upload:o/i/v.jpg']);
    expect(refs).not.toContain('template:photo1');
    expect(new Set(refs).size).toBe(refs.length);
  });
});
