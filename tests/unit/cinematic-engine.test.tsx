import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SECTION_ANIMATION,
  type InvitationDocument,
  type Section,
  type TemplateManifest,
} from '@/features/invitations/contracts/types';
import { cinematicDocument } from '@/features/invitations/dev/cinematic-demo';
import {
  hasPresentation,
  sectionPresentation,
  usesCinematic,
} from '@/features/invitations/renderer/cinematic/presentation';
import { buildRenderContext } from '@/features/invitations/renderer/context';
import { resolveOpening } from '@/features/invitations/renderer/cover/opening';
import { imageAt, imageSet, optimizable } from '@/features/invitations/renderer/images';
import { InvitationBody } from '@/features/invitations/renderer/InvitationBody';
import { InvitationSections } from '@/features/invitations/renderer/InvitationSections';
import {
  KEN_BURNS_ZOOM,
  PARALLAX_DEPTH,
  motionAttributes,
  motionConfig,
  revealGranularity,
} from '@/features/invitations/renderer/motion/engine';
import { resolvePalette, sectionThemeVars, themeVars } from '@/features/invitations/renderer/theme';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';

const NOW = Date.parse('2026-09-23T10:00:00Z');
const sahar = () => requireTemplate('sahar-bordeaux').manifest;
const ctxOf = (doc: InvitationDocument, options: { cinematic?: boolean; locale?: 'he' | 'en' } = {}) =>
  buildRenderContext(doc, requireTemplate(doc.templateId).manifest, options.locale ?? 'he', {
    brand: 'Badook',
    now: NOW,
    bases: { templateMedia: '', uploads: '/dev/media' },
    publicBaseUrl: 'https://invitations.example',
    cinematic: options.cinematic,
  });
const sectionsHtml = (doc: InvitationDocument, options: Parameters<typeof ctxOf>[1] = {}) =>
  renderToStaticMarkup(<InvitationSections ctx={ctxOf(doc, options)} />);

afterEach(() => vi.unstubAllEnvs());

describe('the Scroll Timeline Engine: animation JSON → configuration', () => {
  const template = sahar();

  it('no animation: the template’s own reveal, no scroll effect, no text reveal', () => {
    const c = motionConfig(null, template, 'stack');
    expect(c).toMatchObject({ enter: null, scroll: [], text: 'none', intensity: 1 });
    expect(motionAttributes(c)).toEqual({ attrs: {}, vars: {} });
  });

  it('a preset with its parameters, as time (the fallback) and as scroll distance (0.3px per ms)', () => {
    const c = motionConfig(
      {
        ...DEFAULT_SECTION_ANIMATION,
        enter: { preset: 'rise', duration: 1000, delay: 200, distance: 50, easing: 'spring' },
        stagger: 100,
      },
      template,
      'stack',
    );
    const { attrs, vars } = motionAttributes(c);
    expect(attrs).toEqual({ 'data-enter': 'rise' });
    expect(vars).toMatchObject({
      '--en-dur': '1000ms',
      '--en-delay': '200ms',
      '--en-stagger': '100ms',
      '--en-dist': '50px',
      '--en-ease': 'var(--spring)',
      '--en-len': '300px',
      '--en-off': '60px',
      '--en-step': '30px',
    });
  });

  it('the intensity (the section’s × the template’s) scales travel, zoom, parallax depth and Ken Burns', () => {
    const calm = { ...template, motion: { ...template.motion, intensity: 0.5 } } as TemplateManifest;
    const c = motionConfig(
      {
        ...DEFAULT_SECTION_ANIMATION,
        enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset: 'zoom', distance: 80 },
        scroll: 'ken_burns',
        intensity: 2,
      },
      calm,
      'parallax',
    );
    expect(c.intensity).toBe(1);
    expect(c.scroll).toEqual(['parallax', 'ken_burns']);
    const { attrs, vars } = motionAttributes(c);
    expect(attrs['data-scroll']).toBe('parallax ken_burns');
    expect(vars['--en-dist']).toBe('80px');
    expect(vars['--px-depth']).toBe(String(PARALLAX_DEPTH));
    expect(vars['--kb-zoom']).toBe(String(Math.round((1 + KEN_BURNS_ZOOM) * 1000) / 1000));
    expect(vars['--en-zoom-in']).toBe('0.92');
  });

  it('a parallax layout drifts its media even without a scroll effect of its own', () => {
    expect(motionConfig(null, template, 'parallax').scroll).toEqual(['parallax']);
  });

  it('a template with motion off (preset none) turns every section’s motion off', () => {
    const still = { ...template, motion: { ...template.motion, preset: 'none' as const } };
    const c = motionConfig(
      {
        ...DEFAULT_SECTION_ANIMATION,
        enter: { ...DEFAULT_SECTION_ANIMATION.enter, preset: 'rise' },
        scroll: 'parallax',
        text: 'letters',
      },
      still,
      'parallax',
    );
    expect(c).toMatchObject({
      enter: { preset: 'none', distance: 0 },
      scroll: [],
      text: 'none',
      intensity: 0,
    });
  });

  it('a partial or out-of-range animation (an older editor) falls back and is clamped', () => {
    const c = motionConfig(
      {
        enter: { preset: 'slide_start', duration: 99_999, delay: -5, distance: 1000, easing: 'linear' },
        stagger: -1,
      } as never,
      template,
      'stack',
    );
    expect(c.enter).toEqual({
      preset: 'slide_start',
      duration: 4000,
      delay: 0,
      distance: 240,
      easing: 'linear',
    });
    expect(c.stagger).toBe(0);
    expect(c.text).toBe('none');
  });

  it('a text reveal steps down for long texts: letters → words → lines', () => {
    expect(revealGranularity('letters', 'Our story')).toBe('letters');
    expect(revealGranularity('letters', 'x'.repeat(120))).toBe('words');
    expect(revealGranularity('words', Array.from({ length: 200 }, () => 'word').join(' '))).toBe('lines');
    expect(revealGranularity('lines', 'a b')).toBe('lines');
    expect(revealGranularity('none', 'a')).toBe('none');
    const { attrs, vars } = motionAttributes(
      motionConfig({ ...DEFAULT_SECTION_ANIMATION, text: 'letters' }, template, 'stack'),
    );
    expect(attrs['data-tr']).toBe('letters');
    expect(vars['--tr-step']).toBe('36ms');
  });
});

describe('presentation: how a section renders under schema v2', () => {
  const doc = cinematicDocument('sahar-bordeaux');
  const byId = (id: string) => doc.sections.find((s) => s.id === id)!;

  it('a v1 section, or any section without the cinematic feature, has none (the plain rendering)', () => {
    const plain = demoDocument('sahar-bordeaux').sections.find((s) => s.type === 'timeline')!;
    expect(hasPresentation(plain)).toBe(false);
    expect(sectionPresentation(plain, ctxOf(doc))).toBeNull();
    expect(sectionPresentation(byId('quote'), ctxOf(doc, { cinematic: false }))).toBeNull();
    expect(usesCinematic(demoDocument('sahar-bordeaux'))).toBe(false);
    expect(usesCinematic(doc)).toBe(true);
  });

  it('full bleed: the media behind the text, its focal point, the scrim', () => {
    const p = sectionPresentation(byId('quote'), ctxOf(doc))!;
    expect(p.layout).toBe('full_bleed');
    expect(p.onMedia).toBe(true);
    expect(p.media).toMatchObject({ kind: 'image', src: '/dev/media/cine-sunset.jpg', alt: '' });
    expect(p.attrs).toMatchObject({
      'data-layout': 'full_bleed',
      'data-on-media': '',
      'data-enter': 'fade',
      'data-tr': 'words',
    });
    expect(p.vars).toMatchObject({ '--fx': '65%', '--fy': '62%', '--scrim': sahar().hero.overlayColor });
  });

  it('split: the picture beside the text, with its description', () => {
    const p = sectionPresentation(byId('story'), ctxOf(doc, { locale: 'en' }))!;
    expect(p).toMatchObject({ layout: 'split_start', split: true, onMedia: false });
    expect(p.media?.alt).toBe('Two at sunset');
    expect(p.attrs['data-scroll']).toBe('parallax');
  });

  it('video background: the file and its still; a picture there is full bleed; no media is a stack', () => {
    const p = sectionPresentation(byId('dance'), ctxOf(doc))!;
    expect(p.layout).toBe('video_bg');
    expect(p.media).toMatchObject({
      kind: 'video',
      src: '/dev/media/cine-loop.webm',
      still: '/dev/media/cine-loop-poster.jpg',
    });
    expect(p.vars['--scrim-a']).toBe('0.3');
    const picture = {
      ...byId('dance'),
      media: { ...byId('dance').media!, kind: 'image' as const, src: 'upload:p.jpg' },
    } as Section;
    expect(sectionPresentation(picture, ctxOf(doc))?.layout).toBe('full_bleed');
    const bare = { ...byId('dance'), media: null } as Section;
    expect(sectionPresentation(bare, ctxOf(doc))?.layout).toBe('stack');
  });

  it('a YouTube link can’t play as a section background: its still shows instead', () => {
    const linked = {
      ...byId('dance'),
      media: {
        kind: 'video',
        src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        poster: 'upload:still.jpg',
        focalPoint: { x: 0.5, y: 0.5 },
      },
    } as Section;
    const p = sectionPresentation(linked, ctxOf(doc))!;
    expect(p.media).toMatchObject({ kind: 'image', src: '/dev/media/still.jpg' });
    expect(p.layout).toBe('full_bleed');
  });

  it('a section’s own palette: a band with its own derived colors and theme', () => {
    const p = sectionPresentation(byId('when'), ctxOf(doc))!;
    expect(p.attrs).toMatchObject({ 'data-palette': '', 'data-theme': 'dark' });
    expect(p.vars['--inv-bg']).toMatch(/^#[0-9A-F]{6}$/);
    expect(p.vars['--inv-heading']).toBeDefined();
    expect(p.vars['--inv-field']).toBe(p.vars['--inv-bg']);
    expect(p.band).toBe(true);
  });

  it('the hero keeps its entrance; its scroll effect is its drift, a Ken Burns zoom, or none', () => {
    const hero = demoDocument('sahar-bordeaux').sections[0]!;
    const ctx = ctxOf(doc);
    expect(
      sectionPresentation({ ...hero, themeOverrides: { radius: { card: 4 } } }, ctx)?.attrs[
        'data-hero-scroll'
      ],
    ).toBe('parallax');
    const kb = sectionPresentation(
      { ...hero, animation: { ...DEFAULT_SECTION_ANIMATION, scroll: 'ken_burns', text: 'letters' } },
      ctx,
    )!;
    expect(kb.attrs).toMatchObject({ 'data-hero-scroll': 'ken_burns', 'data-layout': 'full_bleed' });
    expect(kb.attrs['data-tr']).toBeUndefined();
    expect(
      sectionPresentation({ ...hero, animation: { ...DEFAULT_SECTION_ANIMATION } }, ctx)?.attrs[
        'data-hero-scroll'
      ],
    ).toBe('none');
  });
});

describe('design tokens v2', () => {
  it('no template emits tokens v2 variables unless it sets them: every look stays as it was', () => {
    for (const id of TEMPLATE_IDS) {
      const t = requireTemplate(id).manifest;
      const vars = themeVars(t, demoDocument(id), 'he');
      expect(
        Object.keys(vars).filter((k) => /^--(ty|lh|ls|sp)-/.test(k)),
        id,
      ).toEqual([]);
      expect(vars['--r-media']).toBe(`${t.tokens.radius.card}px`);
      expect(vars['--motion-intensity']).toBe(t.motion.preset === 'none' ? '0' : '1');
      expect(vars['--reveal-distance']).toBe(`${t.motion.preset === 'none' ? 0 : t.motion.revealDistance}px`);
    }
  });

  it('a template’s tokens reach the page as CSS variables', () => {
    const t = sahar();
    const custom: TemplateManifest = {
      ...t,
      tokens: {
        ...t.tokens,
        radius: { ...t.tokens.radius, media: 30 },
        typography: { ...t.tokens.typography, display: { size: 1.2, lineHeight: 0.9, letterSpacing: 0.02 } },
        spacing: { section: 1.5, gutter: 1, block: 0.8 },
        overlay: { color: '#102030', opacity: 0.5 },
      },
      motion: { ...t.motion, intensity: 1.5 },
    };
    const vars = themeVars(custom, demoDocument('sahar-bordeaux'), 'en');
    expect(vars).toMatchObject({
      '--ty-display': '1.2',
      '--lh-display': '0.9',
      '--ls-display': '0.02em',
      '--sp-section': '1.5',
      '--sp-block': '0.8',
      '--r-media': '30px',
      '--scrim': '#102030',
      '--scrim-a': '0.5',
      '--motion-intensity': '1.5',
      '--reveal-distance': '60px',
    });
    expect(vars['--sp-gutter']).toBeUndefined();
  });

  it('a section’s overrides are the same variables, only what it changes', () => {
    const { vars, dark } = sectionThemeVars(sahar(), demoDocument('sahar-bordeaux'), {
      radius: { media: 8 },
      typography: { heading: { size: 1.1 } },
      spacing: { section: 0.5 },
    });
    expect(vars).toEqual({ '--r-media': '8px', '--ty-heading': '1.1', '--sp-section': '0.5' });
    expect(dark).toBeNull();
    const own = sectionThemeVars(sahar(), demoDocument('sahar-bordeaux'), {
      palette: { bg: '#0E0E12', ink: '#F5F0E8', accent: 'nope' },
    });
    expect(own.dark).toBe(true);
    expect(own.vars['--inv-bg']).toBe('#0E0E12');
    expect(own.vars['--inv-accent']).toBe(resolvePalette(sahar(), demoDocument('sahar-bordeaux')).accent);
  });
});

describe('the openings', () => {
  const t = sahar();
  const palette = t.tokens.palette;
  const doc = demoDocument('sahar-bordeaux');

  it('the template’s own cover unless an opening is chosen — and never without the feature', () => {
    expect(resolveOpening(t, doc, palette, true)).toBeNull();
    expect(resolveOpening(t, { cover: { ...doc.cover, opening: 'envelope' } }, palette, true)).toBeNull();
    expect(resolveOpening(t, { cover: { ...doc.cover, opening: 'gate' } }, palette, false)).toBeNull();
  });

  it('the host’s choice, with the defaults of its kind; the gate and the curtain also open by scrolling', () => {
    const gate = resolveOpening(t, { cover: { ...doc.cover, opening: 'gate' } }, palette, true)!;
    expect(gate).toMatchObject({ preset: 'gate', scroll: true, motion: 'swing' });
    expect(gate.color).toMatch(/^#[0-9A-F]{6}$/);
    expect(resolveOpening(t, { cover: { ...doc.cover, opening: 'curtain' } }, palette, true)).toMatchObject({
      scroll: true,
      motion: 'part',
    });
    expect(resolveOpening(t, { cover: { ...doc.cover, opening: 'fireworks' } }, palette, true)).toMatchObject(
      {
        scroll: false,
        motion: null,
      },
    );
  });

  it('the template’s opening settings apply to its own preset', () => {
    const own = {
      ...t,
      cover: {
        ...t.cover,
        opening: {
          preset: 'curtain' as const,
          motion: 'rise' as const,
          trigger: 'tap' as const,
          color: '#224466',
        },
      },
    };
    expect(resolveOpening(own, doc, palette, true)).toMatchObject({
      preset: 'curtain',
      motion: 'rise',
      scroll: false,
      color: '#224466',
    });
    // the host picked another opening: the template's settings don't carry over
    expect(resolveOpening(own, { cover: { ...doc.cover, opening: 'gate' } }, palette, true)).toMatchObject({
      preset: 'gate',
      motion: 'swing',
      scroll: true,
    });
  });

  it('renders each opening with the monogram as text and the hint as the button’s label', () => {
    for (const opening of ['gate', 'curtain', 'fireworks', 'gold_dust'] as const) {
      const d = { ...doc, cover: { ...doc.cover, opening } };
      const html = renderToStaticMarkup(
        <InvitationBody ctx={{ ...ctxOf(d), mode: 'live' }} showCover langSwitchHref={null} />,
      );
      expect(html, opening).toContain(`data-opening="${opening}"`);
      expect(html).toContain('class="cover-tap"');
      expect(html).toMatch(/aria-label="[^"]+"/);
      expect(html).toContain(`<span class="co-mono">${d.cover.monogram!.he!.replace(/&/g, '&amp;')}</span>`);
      if (opening === 'gate' || opening === 'curtain') expect(html).toContain('גללו להיכנס');
    }
    const off = renderToStaticMarkup(
      <InvitationBody
        ctx={{
          ...ctxOf({ ...doc, cover: { ...doc.cover, opening: 'gate' } }, { cinematic: false }),
          mode: 'live',
        }}
        showCover
        langSwitchHref={null}
      />,
    );
    expect(off).not.toContain('data-opening');
    expect(off).toContain('class="cover');
  });
});

describe('rendering the cinematic showcase', () => {
  it.each(TEMPLATE_IDS)('%s: every layout, in both languages', (id) => {
    const doc = cinematicDocument(id);
    for (const locale of ['he', 'en'] as const) {
      const html = sectionsHtml(doc, { locale });
      for (const layout of ['full_bleed', 'split_start', 'split_end', 'parallax', 'video_bg', 'stack'])
        expect(html, `${id} ${locale} ${layout}`).toContain(`data-layout="${layout}"`);
      expect(html).toContain('data-on-media=""');
      expect(html).toContain('<video class="cine-video" data-src="/dev/media/cine-loop.webm"');
      expect(html).toContain('preload="none"');
    }
  });

  it('without the feature: the plain rendering — no wrappers, no media — and the new sections still read', () => {
    const doc = cinematicDocument('sahar-bordeaux');
    const html = sectionsHtml(doc, { cinematic: false, locale: 'en' });
    expect(html).not.toContain('class="cine');
    expect(html).not.toContain('data-enter');
    expect(html).not.toContain('/dev/media/');
    expect(html).toContain('I have found the one whom my soul loves');
    expect(html).toContain('Rachel &amp; Moshe Cohen');
    expect(html).toContain('Dance till dawn');
  });

  it('a picture band without text shows its picture with the feature, and nothing without it', () => {
    const doc = cinematicDocument('sahar-bordeaux');
    const band = doc.sections.find((s) => s.id === 'candles') as Extract<Section, { type: 'custom' }>;
    const only = {
      ...doc,
      sections: [{ ...band, data: { ...band.data, title: {} } }],
    } as InvitationDocument;
    const on = sectionsHtml(only, { locale: 'en' });
    expect(on).toContain('data-section="candles"');
    expect(on).toContain('cine-candles.jpg');
    expect(sectionsHtml(only, { cinematic: false, locale: 'en' })).toBe('<main></main>');
  });

  it('a content picture keeps its description; backgrounds are decorative', () => {
    const html = sectionsHtml(cinematicDocument('sahar-bordeaux'), { locale: 'en' });
    expect(html).toContain('alt="Two at sunset"');
    expect(html).toMatch(/<div class="cine-bg" aria-hidden="true">/);
    expect(html).toContain('loading="lazy"');
  });
});

describe('responsive images', () => {
  it('local files are optimized; other hosts only when next.config allowed them; off means off', () => {
    expect(optimizable('/dev/media/a.jpg')).toBe(true);
    expect(optimizable('//evil.example/a.jpg')).toBe(false);
    expect(optimizable('/_next/image?url=x')).toBe(false);
    expect(optimizable('https://abc.supabase.co/storage/v1/object/public/invitation-media/u/i.jpg')).toBe(
      false,
    );
    vi.stubEnv(
      'INVITES_IMAGE_SOURCES',
      JSON.stringify([
        {
          protocol: 'https',
          hostname: 'abc.supabase.co',
          port: '',
          pathname: '/storage/v1/object/public/**',
        },
      ]),
    );
    expect(optimizable('https://abc.supabase.co/storage/v1/object/public/invitation-media/u/i.jpg')).toBe(
      true,
    );
    expect(optimizable('https://abc.supabase.co/rest/v1/x')).toBe(false);
    expect(optimizable('https://other.example/storage/v1/object/public/a.jpg')).toBe(false);
    vi.stubEnv('INVITES_IMAGE_SOURCES', 'off');
    expect(optimizable('/dev/media/a.jpg')).toBe(false);
    expect(imageSet('/dev/media/a.jpg', '100vw')).toEqual({ src: '/dev/media/a.jpg' });
  });

  it('a srcset of widths through /_next/image, the original kept for the fallback', () => {
    const set = imageSet('/dev/media/cine-sunset.jpg', '100vw');
    expect(set.src).toMatch(/^\/_next\/image\?url=%2Fdev%2Fmedia%2Fcine-sunset\.jpg&w=\d+&q=70$/);
    expect(set.srcSet).toMatch(/ 640w, .* 1080w, /);
    expect(set.sizes).toBe('100vw');
    expect(set.fallback).toBe('/dev/media/cine-sunset.jpg');
    expect(imageAt('/dev/media/cine-sunset.jpg', 1000)).toMatch(/&w=1080&/);
    expect(imageAt('https://other.example/a.jpg', 1000)).toBe('https://other.example/a.jpg');
  });
});
