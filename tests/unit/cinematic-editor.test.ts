import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { InvitationDocumentSchema } from '@/features/invitations/contracts/schemas';
import {
  DEFAULT_SECTION_ANIMATION,
  type InvitationDocument,
  type Palette,
  type Section,
  type SectionLayout,
  type SectionMedia,
} from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import { CATALOG, newSection } from '@/features/invitations/editor/catalog';
import { commit, createHistory, redo, undo } from '@/features/invitations/editor/history';
import {
  LAYOUTS_BY_TYPE,
  applyDocPalette,
  applySectionPalette,
  layoutState,
  motionMs,
  patchSectionMedia,
  resetSectionPresentation,
  seededHints,
  setOpening,
  setSectionAnimation,
  setSectionColors,
  setSectionLayout,
  setSectionMedia,
  setSectionTokens,
  setThemeTokens,
  takesMedia,
  withoutPresentation,
} from '@/features/invitations/editor/presentation';
import { contrastRatio, relativeLuminance } from '@/features/invitations/lib/contrast';
import { characterOf, moodOf, suggestFontPairs } from '@/features/invitations/lib/font-suggest';
import {
  AA_LARGE,
  AA_TEXT,
  TEXT_PAIRS,
  ensureContrast,
  extractSwatches,
  hexToOklch,
  oklchToHex,
  passesAA,
  photoPalettes,
  repairPalette,
  scrimForPhoto,
} from '@/features/invitations/lib/photo-palette';
import { FONT_LIBRARY } from '@/features/invitations/fonts/library';
import { posterImage } from '@/features/invitations/app/poster';
import { isPlaceholderFile, resolveAsset, templateFileUrl } from '@/features/invitations/renderer/assets';
import {
  hasCinematicValues,
  introducedCinematic,
} from '@/features/invitations/renderer/cinematic/presentation';
import { scrimForNew } from '@/features/invitations/editor/fields/SectionMedia';
import { resolveOpening } from '@/features/invitations/renderer/cover/opening';
import { demoDocument } from '@/features/invitations/templates/demo';
import placeholderMedia from '@/features/invitations/templates/placeholder-media.json';
import { TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';

// The cinematic editor's logic: colors from a photo (always readable), font pairings that fit, the
// presentation changes the controls make (valid documents, one undo step each), the server's rule
// without the feature, and the photographic flagship (its seed, its pictures, unlisted).

const NOW = Date.parse('2026-09-23T10:00:00Z');
const FIXTURES = ['sunset', 'couple', 'bokeh', 'venue', 'candles'] as const;
const pixels = (name: string) => PNG.sync.read(readFileSync(`tests/fixtures/palette/${name}.png`));
const KEYS: readonly (keyof Palette)[] = [
  'bg',
  'surface',
  'ink',
  'inkMuted',
  'accent',
  'accentInk',
  'line',
  'heroText',
];
const HEX = /^#[0-9A-F]{6}$/;

/** A plain RGBA buffer of one color. */
const solid = (rgb: [number, number, number], n = 400) =>
  Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4]!));

describe('colors from a photo', () => {
  it('OKLCH round trip keeps the color', () => {
    for (const hex of ['#731F2E', '#F7F3EE', '#1E5A67', '#E0A526', '#000000', '#FFFFFF']) {
      const { L, C, h } = hexToOklch(hex);
      const back = oklchToHex(L, C, h);
      const [a, b] = [parseInt(hex.slice(1), 16), parseInt(back.slice(1), 16)];
      for (const shift of [16, 8, 0])
        expect(Math.abs(((a >> shift) & 255) - ((b >> shift) & 255))).toBeLessThanOrEqual(1);
    }
  });

  it.each(FIXTURES)('%s: dominant colors, largest first, the same every time', (name) => {
    const png = pixels(name);
    const swatches = extractSwatches(png.data);
    expect(swatches.length).toBeGreaterThanOrEqual(3);
    expect(swatches.length).toBeLessThanOrEqual(6);
    for (const s of swatches) expect(s.hex).toMatch(HEX);
    const shares = swatches.map((s) => s.share);
    expect(shares).toEqual([...shares].sort((a, b) => b - a));
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(extractSwatches(png.data)).toEqual(swatches);
  });

  it.each(FIXTURES)('%s: three palettes — light, evening, tinted — every text pair at WCAG AA', (name) => {
    const options = photoPalettes(extractSwatches(pixels(name).data));
    expect(options.map((o) => o.id)).toEqual(['light', 'dark', 'tinted']);
    for (const { id, palette } of options) {
      for (const key of KEYS) expect(palette[key], `${id}.${key}`).toMatch(HEX);
      expect(passesAA(palette), id).toBe(true);
      for (const [fg, bg, min] of TEXT_PAIRS)
        expect(contrastRatio(palette[fg], palette[bg]), `${id} ${fg}/${bg}`).toBeGreaterThanOrEqual(
          min - 0.005,
        );
      // the titles: the accent reads as large text on the paper
      expect(contrastRatio(palette.accent, palette.bg), `${id} accent/bg`).toBeGreaterThanOrEqual(AA_LARGE);
    }
    const [light, dark] = options;
    expect(relativeLuminance(light!.palette.bg)).toBeGreaterThan(0.75);
    expect(relativeLuminance(dark!.palette.bg)).toBeLessThan(0.05);
  });

  it('the accent comes from the photo: a sunset gives a warm accent', () => {
    const [light] = photoPalettes(extractSwatches(pixels('sunset').data));
    const { h, C } = hexToOklch(light!.palette.accent);
    expect(C).toBeGreaterThan(0.05);
    // reds to oranges
    expect(h < 90 || h > 330).toBe(true);
  });

  it.each(TEMPLATE_IDS)(
    '%s: only the keys the design lets the host change move, and those always read',
    (id) => {
      const { tokens } = requireTemplate(id).manifest;
      const editable = new Set(tokens.editablePaletteKeys);
      for (const name of ['sunset', 'venue'] as const) {
        const options = photoPalettes(extractSwatches(pixels(name).data), {
          palette: tokens.palette,
          editable: tokens.editablePaletteKeys,
        });
        // the options its fixed colors allow (an evening needs a dark page), none the same as another
        expect(options.length).toBeGreaterThanOrEqual(1);
        expect(options.length).toBe(editable.size === KEYS.length ? 3 : options.length);
        expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
        for (const { id: option, palette } of options) {
          if (option === 'dark') expect(relativeLuminance(palette.bg)).toBeLessThan(0.12);
          if (option === 'light') expect(relativeLuminance(palette.bg)).toBeGreaterThan(0.45);
          for (const key of KEYS)
            if (!editable.has(key))
              expect(palette[key], `${option}.${key} is the design's`).toBe(tokens.palette[key]);
          for (const [fg, bg, min] of TEXT_PAIRS) {
            if (!editable.has(fg) && !editable.has(bg)) continue;
            expect(
              contrastRatio(palette[fg], palette[bg]),
              `${name} ${option} ${fg}/${bg}`,
            ).toBeGreaterThanOrEqual(min - 0.005);
          }
        }
      }
    },
  );

  it('repairs a palette that doesn’t read, and leaves one that does alone', () => {
    const bad: Palette = {
      bg: '#F4F0EA',
      surface: '#FFFFFF',
      ink: '#C9C2B8',
      inkMuted: '#DDD6CC',
      accent: '#F2D16B',
      accentInk: '#FFFFFF',
      line: '#E2D8CC',
      heroText: '#FFFFFF',
    };
    expect(passesAA(bad)).toBe(false);
    const fixed = repairPalette(bad, new Set(KEYS));
    expect(passesAA(fixed)).toBe(true);
    // the ink keeps its hue family (a warm grey stays warm)
    expect(Math.abs(hexToOklch(fixed.ink).h - hexToOklch(bad.ink).h)).toBeLessThan(25);
    const good = requireTemplate('sahar-bordeaux').manifest.tokens.palette;
    expect(ensureContrast(good.ink, good.bg, AA_TEXT)).toBe(good.ink);
    // a background the host can't change: the text moves instead
    const onFixedBg = repairPalette(bad, new Set(['ink', 'inkMuted'] as const));
    expect(onFixedBg.bg).toBe(bad.bg);
    expect(contrastRatio(onFixedBg.ink, onFixedBg.bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the scrim follows the photo: none needed on a dark one, dark on a bright one', () => {
    expect(scrimForPhoto(solid([12, 10, 14]), 20)).toBe(0.2);
    expect(scrimForPhoto(solid([250, 248, 240]), 20)).toBeGreaterThanOrEqual(0.8);
    const bright = pixels('couple');
    const dim = pixels('bokeh');
    expect(scrimForPhoto(bright.data, bright.width)).toBeGreaterThan(scrimForPhoto(dim.data, dim.width));
  });

  it('a host’s bright photo gets the scrim it needs; the design’s stays the floor', () => {
    const lumiere = requireTemplate('lumiere').manifest;
    // lumiere's own scrim is 0.4: a dark photo keeps it (nothing stored), a bright one raises it
    expect(scrimForNew(0.2, null, lumiere)).toBeNull();
    expect(scrimForNew(0.74, null, lumiere)).toBe(0.74);
    expect(scrimForNew(0.95, null, lumiere)).toBe(0.85);
    // a section's own (the design's .5 over its venue) is kept unless the picture needs more
    expect(scrimForNew(0.3, 0.5, lumiere)).toBe(0.5);
    expect(scrimForNew(0.7, 0.5, lumiere)).toBe(0.7);
    // unreadable picture: as it was
    expect(scrimForNew(null, 0.5, lumiere)).toBe(0.5);
    // a design whose scrim is light sets dark text over pictures: nothing to raise
    const light = { ...lumiere, tokens: { ...lumiere.tokens, overlay: { color: '#FFFFFF', opacity: 0.5 } } };
    expect(scrimForNew(0.8, null, light)).toBeNull();
  });

  it('a transparent or empty picture gives nothing', () => {
    expect(extractSwatches(new Uint8ClampedArray(0))).toEqual([]);
    expect(extractSwatches(Uint8ClampedArray.from({ length: 400 }, () => 0))).toEqual([]);
    expect(photoPalettes([])).toEqual([]);
  });
});

describe('font pairings that fit', () => {
  const lumiere = requireTemplate('lumiere').manifest;

  it('three pairs, none the one in use, from the design and the library', () => {
    const ids = new Set([...lumiere.fontPairs, ...FONT_LIBRARY].map((p) => p.id));
    const s = suggestFontPairs(lumiere, {
      eventType: 'wedding',
      palette: lumiere.tokens.palette,
      current: 'editorial',
    });
    expect(s).toHaveLength(3);
    expect(new Set(s.map((x) => x.pair.id)).size).toBe(3);
    for (const x of s) {
      expect(ids.has(x.pair.id)).toBe(true);
      expect(x.pair.id).not.toBe('editorial');
    }
    // the same answer every time
    expect(suggestFontPairs(lumiere, { eventType: 'wedding', palette: lumiere.tokens.palette })).toEqual(
      suggestFontPairs(lumiere, { eventType: 'wedding', palette: lumiere.tokens.palette }),
    );
  });

  it('a wedding in ivory gets formal faces; a vivid birthday gets playful ones', () => {
    const wedding = suggestFontPairs(lumiere, { eventType: 'wedding', palette: lumiere.tokens.palette });
    expect(characterOf(wedding[0]!.pair).formal).toBeGreaterThanOrEqual(0.75);
    const neon = requireTemplate('neon-night').manifest;
    const party = suggestFontPairs(neon, {
      eventType: 'birthday',
      palette: { bg: '#FFFFFF', accent: '#E4007C' },
    });
    expect(characterOf(party[0]!.pair).playful).toBeGreaterThanOrEqual(0.6);
    expect(party.map((x) => x.label)).toContain('playful');
  });

  it('three different styles rather than three of one kind', () => {
    for (const id of TEMPLATE_IDS) {
      const { manifest } = requireTemplate(id);
      const s = suggestFontPairs(manifest, {
        eventType: manifest.categories[0]!,
        palette: manifest.tokens.palette,
      });
      expect(new Set(s.map((x) => characterOf(x.pair).style)).size, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('the colors move the mood: an evening palette is more formal and bolder', () => {
    const day = moodOf('engagement', { bg: '#FBF8F4', accent: '#8A6A45' });
    const night = moodOf('engagement', { bg: '#16120F', accent: '#C8A46A' });
    expect(night.formal).toBeGreaterThan(day.formal);
    expect(night.bold).toBeGreaterThan(day.bold);
    const vivid = moodOf('engagement', { bg: '#FFFFFF', accent: '#E4007C' });
    expect(vivid.playful).toBeGreaterThan(day.playful);
  });
});

describe('the presentation controls (editor/presentation.ts)', () => {
  const template = requireTemplate('sahar-bordeaux').manifest;
  const base = () => demoDocument('sahar-bordeaux');
  const at = (doc: InvitationDocument, id: string) => doc.sections.findIndex((s) => s.id === id);
  const photo: SectionMedia = {
    kind: 'image',
    src: 'upload:u/i/photo.jpg',
    poster: null,
    focalPoint: { x: 0.5, y: 0.5 },
  };
  const video: SectionMedia = {
    ...photo,
    kind: 'video',
    src: 'upload:u/i/clip.mp4',
    poster: 'upload:u/i/still.jpg',
  };
  /** What validate.ts says in edit mode (the editor's own check), structurally. */
  const valid = (doc: InvitationDocument) => {
    expect(InvitationDocumentSchema.safeParse(doc).success).toBe(true);
    expect(validateDocument(doc, template, { mode: 'edit', now: NOW }).errors).toEqual([]);
  };

  it('offers only the layouts a section can take', () => {
    expect(LAYOUTS_BY_TYPE.hero).toEqual([]);
    expect(LAYOUTS_BY_TYPE.gallery).toEqual([]);
    expect(LAYOUTS_BY_TYPE.rsvp).not.toContain('split_start');
    expect(LAYOUTS_BY_TYPE.text).toContain('split_end');
    expect(takesMedia('hero')).toBe(false);
    expect(takesMedia('custom')).toBe(true);
    expect(layoutState({}, 'stack')).toBe('ok');
    expect(layoutState({}, 'full_bleed')).toBe('needs_media');
    expect(layoutState({ media: photo }, 'video_bg')).toBe('needs_video');
    expect(layoutState({ media: video }, 'video_bg')).toBe('ok');
  });

  it('every offered layout makes a valid document for its section type', () => {
    const doc = base();
    for (const [i, s] of doc.sections.entries()) {
      for (const layout of LAYOUTS_BY_TYPE[s.type]) {
        const withMedia = setSectionMedia(doc, i, layout === 'video_bg' ? video : photo);
        const next = setSectionLayout(withMedia, i, layout);
        expect(next.sections[i]!.layout ?? 'stack', `${s.type} ${layout}`).toBe(layout);
        valid(next);
      }
    }
  });

  it('a layout that needs a picture waits for one; removing the picture takes its layout away', () => {
    const doc = base();
    const story = at(doc, 'story');
    expect(setSectionLayout(doc, story, 'full_bleed')).toEqual(doc);
    const pictured = setSectionLayout(setSectionMedia(doc, story, photo), story, 'full_bleed');
    expect(pictured.sections[story]).toMatchObject({ layout: 'full_bleed', media: photo });
    const bare = setSectionMedia(pictured, story, null);
    expect(bare.sections[story]).not.toHaveProperty('media');
    expect(bare.sections[story]).not.toHaveProperty('layout');
    // a picture where a video played: full bleed; back to the stack: no layout stored
    const videoBg = setSectionLayout(setSectionMedia(doc, story, video), story, 'video_bg');
    expect(setSectionMedia(videoBg, story, photo).sections[story]!.layout).toBe('full_bleed');
    expect(setSectionLayout(pictured, story, 'stack').sections[story]).not.toHaveProperty('layout');
    // the hero keeps its own media
    expect(setSectionMedia(doc, 0, photo)).toEqual(doc);
  });

  it('the focal point, the scrim and the description patch the media', () => {
    const doc = base();
    const story = at(doc, 'story');
    const pictured = setSectionMedia(doc, story, photo);
    const next = patchSectionMedia(pictured, story, { focalPoint: { x: 0.3, y: 0.7 }, overlay: 0.45 });
    expect(next.sections[story]!.media).toEqual({ ...photo, focalPoint: { x: 0.3, y: 0.7 }, overlay: 0.45 });
    // "auto" removes the host's scrim
    expect(patchSectionMedia(next, story, { overlay: undefined }).sections[story]!.media).not.toHaveProperty(
      'overlay',
    );
    expect(patchSectionMedia(doc, story, { overlay: 0.3 })).toEqual(doc);
    valid(next);
  });

  it('motion: changed in part, and gone when it is back at the defaults', () => {
    const doc = base();
    const story = at(doc, 'story');
    const zoom = setSectionAnimation(doc, story, { enter: { preset: 'zoom' }, text: 'words' });
    expect(zoom.sections[story]!.animation).toEqual({
      ...DEFAULT_SECTION_ANIMATION,
      enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset: 'zoom' },
      text: 'words',
    });
    const slower = setSectionAnimation(zoom, story, { enter: { duration: 1400 } });
    expect(slower.sections[story]!.animation!.enter).toMatchObject({ preset: 'zoom', duration: 1400 });
    valid(slower);
    const back = setSectionAnimation(zoom, story, { enter: { preset: 'auto' }, text: 'none' });
    expect(back.sections[story]).not.toHaveProperty('animation');
    expect(setSectionAnimation(slower, story, null).sections[story]).not.toHaveProperty('animation');
    // the "play" button lasts as long as the motion
    expect(motionMs(slower.sections[story]!)).toBeGreaterThan(motionMs(doc.sections[story]!));
  });

  it('colors of its own: set in part, a key back to the invitation’s goes, none left → no overrides', () => {
    const doc = base();
    const rsvp = at(doc, 'rsvp');
    const dark = setSectionColors(doc, rsvp, { bg: '#1A1512', ink: '#F4EEE7' });
    expect(dark.sections[rsvp]!.themeOverrides).toEqual({ palette: { bg: '#1A1512', ink: '#F4EEE7' } });
    valid(dark);
    const inkOnly = setSectionColors(dark, rsvp, { bg: null });
    expect(inkOnly.sections[rsvp]!.themeOverrides).toEqual({ palette: { ink: '#F4EEE7' } });
    expect(setSectionColors(inkOnly, rsvp, { ink: null }).sections[rsvp]).not.toHaveProperty(
      'themeOverrides',
    );
    // title size / spacing / corners live beside the colors
    const sized = setSectionTokens(dark, rsvp, { titleSize: 1.2, sectionSpacing: 0.8, mediaRadius: 12 });
    expect(sized.sections[rsvp]!.themeOverrides).toMatchObject({
      typography: { display: { size: 1.2 } },
      spacing: { section: 0.8 },
      radius: { media: 12 },
    });
    valid(sized);
    const plain = setSectionTokens(setSectionColors(sized, rsvp, null), rsvp, {
      titleSize: 1,
      sectionSpacing: null,
      mediaRadius: null,
    });
    expect(plain.sections[rsvp]).not.toHaveProperty('themeOverrides');
    // a photo's palette for a section over its picture: its colors and the scrim it needs
    const story = at(doc, 'story');
    const [light] = photoPalettes(extractSwatches(pixels('candles').data));
    const banded = applySectionPalette(setSectionMedia(doc, story, photo), story, light!.palette, 0.62);
    expect(banded.sections[story]!.themeOverrides!.palette).toEqual(light!.palette);
    expect(banded.sections[story]!.media!.overlay).toBe(0.62);
    valid(banded);
  });

  it('resetting a section removes all of its presentation', () => {
    const doc = base();
    const story = at(doc, 'story');
    const dressed = setSectionAnimation(
      setSectionColors(setSectionLayout(setSectionMedia(doc, story, photo), story, 'split_start'), story, {
        bg: '#101010',
      }),
      story,
      { enter: { preset: 'tilt' } },
    );
    expect(resetSectionPresentation(dressed, story)).toEqual(doc);
    expect(withoutPresentation(dressed.sections[story]!)).toEqual(doc.sections[story]);
  });

  it('style & motion: the type scale, spacing and motion; back to 1 is as designed', () => {
    const doc = base();
    const styled = setThemeTokens(doc, { typeScale: 1.1, spacing: 0.9, motion: 0 });
    expect(styled.theme.tokens).toEqual({ typeScale: 1.1, spacing: 0.9, motion: 0 });
    valid(styled);
    expect(setThemeTokens(styled, { typeScale: 1, spacing: 1 }).theme.tokens).toEqual({ motion: 0 });
    expect(setThemeTokens(styled, null).theme).not.toHaveProperty('tokens');
  });

  it('a photo palette changes only the keys the design lets the host change', () => {
    const doc = base();
    const [evening] = photoPalettes(extractSwatches(pixels('venue').data)).slice(1);
    // sahar-bordeaux lets the host change its background, text and accent
    const editable = template.tokens.editablePaletteKeys;
    const applied = applyDocPalette(doc, evening!.palette, editable);
    expect(Object.keys(applied.theme.palette!).sort()).toEqual([...editable].sort());
    for (const key of editable) expect(applied.theme.palette![key]).toBe(evening!.palette[key]);
    valid(applied);
    const accentOnly = applyDocPalette(doc, evening!.palette, ['accent']);
    expect(accentOnly.theme.palette).toEqual({ accent: evening!.palette.accent });
    expect(applyDocPalette(doc, evening!.palette, []).theme.palette).toBeNull();
    // a design that lets every color change takes the whole palette
    const all = applyDocPalette(demoDocument('lumiere'), evening!.palette, KEYS);
    expect(all.theme.palette).toEqual(evening!.palette);
    expect(
      validateDocument(all, requireTemplate('lumiere').manifest, { mode: 'edit', now: NOW }).errors,
    ).toEqual([]);
  });

  it('the opening: the design’s own or the host’s; the seeded hint makes way, a hint the host wrote stays', () => {
    const { defaults } = requireTemplate('sahar-bordeaux');
    const doc = base();
    const hints = seededHints(defaults);
    expect(doc.cover.hint).not.toBeNull();
    const curtain = setOpening(doc, 'curtain', hints);
    expect(curtain.cover).toMatchObject({ opening: 'curtain', hint: null });
    valid(curtain);
    const own = { ...doc, cover: { ...doc.cover, hint: { he: 'לחצו עלינו', en: 'Tap us' } } };
    expect(setOpening(own, 'gate', hints).cover).toMatchObject({ opening: 'gate', hint: own.cover.hint });
    expect(setOpening(curtain, null, hints).cover).not.toHaveProperty('opening');
    expect(resolveOpening(template, curtain, template.tokens.palette, true)?.preset).toBe('curtain');
  });

  it('each control is one undo step, and undo gives back the exact document', () => {
    const doc = base();
    const story = at(doc, 'story');
    let h = createHistory(doc);
    const steps = [
      (d: InvitationDocument) => setSectionMedia(d, story, photo),
      (d: InvitationDocument) => setSectionLayout(d, story, 'full_bleed'),
      (d: InvitationDocument) => setSectionAnimation(d, story, { enter: { preset: 'rise' } }),
      (d: InvitationDocument) => setOpening(d, 'gold_dust', []),
    ];
    const seen: InvitationDocument[] = [doc];
    steps.forEach((step, i) => {
      h = commit(h, step(h.present), { now: i * 10_000 });
      seen.push(h.present);
    });
    // the focal point dragged: one step, however many moves
    for (let n = 0; n < 5; n++)
      h = commit(h, patchSectionMedia(h.present, story, { focalPoint: { x: n / 10, y: 0.5 } }), {
        key: `sections.${story}.media.focalPoint`,
        now: 50_000 + n * 100,
      });
    expect(h.past).toHaveLength(steps.length + 1);
    h = undo(h);
    for (let i = seen.length - 1; i > 0; i--) {
      expect(h.present).toEqual(seen[i]);
      h = undo(h);
    }
    expect(h.present).toEqual(doc);
    h = redo(redo(h));
    expect(h.present).toEqual(seen[2]);
  });

  it('the new section types start with content, a picture band too', () => {
    const { manifest, defaults } = requireTemplate('lumiere');
    const doc = demoDocument('lumiere');
    const keys = CATALOG.map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining(['parents', 'when', 'where', 'quote', 'custom_media']));
    const quote = newSection({ key: 'quote', type: 'quote' }, doc, manifest, defaults);
    // the design's own verse, with an id of its own (the design already has one)
    expect(quote).toMatchObject({ id: 'quote-2', type: 'quote', enabled: true });
    if (quote.type !== 'quote') throw new Error();
    expect(quote.data.text.he).toBe('אני לדודי ודודי לי');
    const band = newSection({ key: 'custom_media', type: 'custom' }, doc, manifest, defaults);
    if (band.type !== 'custom') throw new Error();
    expect(band.data.title).toEqual({ he: 'רגע משלנו', en: 'A moment of ours' });
  });
});

describe('without the feature: the server keeps what the draft has and refuses what is new', () => {
  const doc = () => demoDocument('sahar-bordeaux');

  it('a plain document has no v2 values', () => {
    expect(hasCinematicValues(doc())).toBe(false);
    expect(hasCinematicValues(demoDocument('lumiere'))).toBe(true);
  });

  it('names the values a save would add — not the ones already there, wherever they moved', () => {
    const stored = demoDocument('lumiere');
    expect(introducedCinematic(stored, stored)).toEqual([]);
    // a reorder, a text edit: nothing new
    const moved = structuredClone(stored);
    moved.sections.splice(1, 0, moved.sections.splice(2, 1)[0]!);
    moved.hosts.primary = { he: 'רות', en: 'Ruth' };
    expect(introducedCinematic(stored, moved)).toEqual([]);
    // a new layout, a new opening, a new token
    const quote = stored.sections.findIndex((s) => s.id === 'quote');
    const next = structuredClone(stored);
    next.sections[quote] = { ...next.sections[quote]!, layout: 'parallax' } as Section;
    next.cover.opening = 'gate';
    next.theme.tokens = { typeScale: 1.1 };
    expect(introducedCinematic(stored, next).sort()).toEqual(
      ['cover.opening', `sections.${quote}.layout`, 'theme.tokens'].sort(),
    );
    // from a draft without any
    expect(introducedCinematic(doc(), setSectionLayout(doc(), 1, 'stack' as SectionLayout))).toEqual([]);
  });
});

describe('the photographic flagship (lumiere)', () => {
  const { manifest, defaults } = requireTemplate('lumiere');

  it('is unlisted: out of the public gallery until its real photos are in', () => {
    expect(manifest.listed).toBe(false);
    expect(manifest.tier).toBe('premium');
  });

  it('its pictures are one list — shipped placeholders until the bucket has them', () => {
    const photos = Object.entries(manifest.assets).filter(([key]) => key.startsWith('photo-'));
    expect(photos.length).toBeGreaterThanOrEqual(5);
    const listed = (
      placeholderMedia as { templates: Record<string, Record<string, { hash: string; bytes: number }>> }
    ).templates.lumiere!;
    const bases = { templateMedia: 'https://media.example/template-media', uploads: '' };
    for (const [key, path] of photos) {
      const file = path.split('/').pop()!;
      expect(listed[file], file).toBeDefined();
      expect(isPlaceholderFile('lumiere', path)).toBe(true);
      expect(resolveAsset(`template:${key}`, manifest, bases)).toBe(
        `/templates/lumiere/${file}?v=${listed[file]!.hash}`,
      );
      expect(readFileSync(`public/templates/lumiere/${file}`).length).toBe(listed[file]!.bytes);
    }
    // a file the design doesn't ship: not produced yet
    expect(templateFileUrl('lumiere', '/templates/lumiere/nope.webp', bases)).toBeNull();
    // the gallery's poster is its first photo
    expect(posterImage(manifest, bases)).toMatch(/^\/templates\/lumiere\/photo-hero\.webp\?v=/);
  });

  it('seeds a photo per part, the verse and the date as bands, the RSVP as the climax', () => {
    for (const eventType of ['wedding', 'engagement', 'bar_mitzvah', 'bat_mitzvah'] as const) {
      const doc = demoDocument('lumiere', eventType);
      const shown = doc.sections.filter((s) => s.enabled);
      expect(
        shown.map((s) => s.id),
        eventType,
      ).toEqual(['hero', 'quote', 'story', 'when', 'venues', 'timeline', 'rsvp', 'footer']);
      const by = (id: string) => doc.sections.find((s) => s.id === id)!;
      expect(by('quote')).toMatchObject({ layout: 'full_bleed', media: { src: 'template:photo-quote' } });
      expect(by('story')).toMatchObject({ layout: 'split_start', media: { src: 'template:photo-story' } });
      expect(by('venues')).toMatchObject({ layout: 'parallax', media: { src: 'template:photo-venue' } });
      expect(by('rsvp')).toMatchObject({ layout: 'full_bleed', media: { src: 'template:photo-rsvp' } });
      expect(by('when').themeOverrides?.palette?.bg).toBe('#1A1512');
      // every picture a different one
      const pictures = shown.flatMap((s) => (s.type !== 'hero' && s.media ? [s.media.src] : []));
      expect(new Set(pictures).size).toBe(pictures.length);
      // the sections it leaves out are there, hidden, before the RSVP
      const hidden = doc.sections.filter((s) => !s.enabled).map((s) => s.type);
      expect(hidden).toEqual(expect.arrayContaining(['countdown', 'faq', 'gifts']));
      expect(doc.sections.at(-2)!.type).toBe('rsvp');
      expect(validateDocument(doc, manifest, { mode: 'publish', now: NOW }).errors).toEqual([]);
    }
    expect(Object.keys(defaults.defaults).sort()).toEqual([
      'bar_mitzvah',
      'bat_mitzvah',
      'engagement',
      'wedding',
    ]);
  });

  it('opens with gold dust over its first photo; its text over photos reads', () => {
    const doc = demoDocument('lumiere');
    const opening = resolveOpening(manifest, doc, manifest.tokens.palette, true);
    expect(opening).toMatchObject({ preset: 'gold_dust', backdrop: true });
    // a host who picks fireworks keeps the photo; doors and curtains are opaque
    expect(
      resolveOpening(
        manifest,
        { cover: { ...doc.cover, opening: 'fireworks' } },
        manifest.tokens.palette,
        true,
      )?.backdrop,
    ).toBe(true);
    expect(
      resolveOpening(manifest, { cover: { ...doc.cover, opening: 'gate' } }, manifest.tokens.palette, true)
        ?.backdrop,
    ).toBe(false);
    // without the feature: its own envelope
    expect(resolveOpening(manifest, doc, manifest.tokens.palette, false)).toBeNull();
    // every scrim over a picture is dark enough for its white text on the placeholder photos
    for (const s of doc.sections)
      if (s.type !== 'hero' && s.media?.overlay != null) expect(s.media.overlay).toBeGreaterThanOrEqual(0.4);
    expect(contrastRatio(manifest.hero.textColor, manifest.hero.overlayColor)).toBeGreaterThan(AA_TEXT);
  });
});
