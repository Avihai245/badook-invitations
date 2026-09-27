import { describe, expect, it } from 'vitest';
import {
  InvitationDocumentSchema,
  SceneSettingsSchema,
  SectionMediaSchema,
  TemplateManifestSchema,
} from '@/features/invitations/contracts/schemas';
import type { InvitationDocument, Section, TemplateManifest } from '@/features/invitations/contracts/types';
import { setScene } from '@/features/invitations/editor/presentation';
import { introducedCinematic, usesCinematic } from '@/features/invitations/renderer/cinematic/presentation';
import { resolveOpening } from '@/features/invitations/renderer/cover/opening';
import {
  FADE_FROM,
  FADE_TO,
  SCENE_DRIFT,
  SCENE_ZOOM,
  sceneModel,
  sceneOn,
  templateScene,
} from '@/features/invitations/renderer/scene/model';
import {
  inPlayMargins,
  layerRanges,
  layerShown,
  layerState,
  type LayerGeometry,
} from '@/features/invitations/renderer/scene/timeline';
import { resolvePalette } from '@/features/invitations/renderer/theme';
import { demoDocument } from '@/features/invitations/templates/demo';
import { requireTemplate } from '@/features/invitations/templates/registry';
import { validateTemplate } from '@/features/invitations/templates/validate-template';

const bases = { templateMedia: '', uploads: 'https://storage.example/invitation-media' };
const O = { from: FADE_FROM, to: FADE_TO, zoom: SCENE_ZOOM, drift: SCENE_DRIFT };
const H = 800;
const layer = (over: Partial<LayerGeometry> = {}): LayerGeometry => ({
  start: 2000,
  end: 3000,
  zoom: 'in',
  drift: null,
  ...over,
});

describe('scroll scene — the timeline', () => {
  it('keeps the first picture as the ground', () => {
    for (const y of [0, 500, 5000]) expect(layerState(layer({ start: 0 }), 0, y, H, O).opacity).toBe(1);
  });

  it('cross-fades the next picture as its section crosses the middle of the screen (65% → 35%)', () => {
    const l = layer();
    // its section's top at 65% of the screen: the fade begins
    expect(layerState(l, 1, l.start - 0.65 * H, H, O).opacity).toBe(0);
    expect(layerState(l, 1, l.start - 0.65 * H - 100, H, O).opacity).toBe(0);
    // half-way (50%): half the opacity (smoothstep is symmetric)
    expect(layerState(l, 1, l.start - 0.5 * H, H, O).opacity).toBeCloseTo(0.5, 5);
    // at 35%: fully in, and it stays in
    expect(layerState(l, 1, l.start - 0.35 * H, H, O).opacity).toBe(1);
    expect(layerState(l, 1, l.start + 900, H, O).opacity).toBe(1);
    // an overlap of 30% of the screen
    const band = (FADE_FROM - FADE_TO) * H;
    expect(band).toBeCloseTo(0.3 * H, 5);
  });

  it('zooms each picture from 1 to 1.08 over its passage (Ken Burns), or back out, or not at all', () => {
    const l = layer({ start: 2000, end: 2900 });
    const enter = l.start - 0.65 * H;
    const leave = l.end - 0.35 * H;
    expect(layerState(l, 1, enter, H, O).scale).toBeCloseTo(1, 5);
    expect(layerState(l, 1, leave, H, O).scale).toBeCloseTo(1.08, 5);
    expect(layerState(l, 1, (enter + leave) / 2, H, O).scale).toBeCloseTo(1.04, 5);
    expect(layerState({ ...l, zoom: 'out' }, 1, enter, H, O).scale).toBeCloseTo(1.08, 5);
    expect(layerState({ ...l, zoom: 'out' }, 1, leave, H, O).scale).toBeCloseTo(1, 5);
    expect(layerState({ ...l, zoom: 'none' }, 1, leave, H, O).scale).toBe(1);
  });

  it('lets one picture behind a long stretch go further, never past 1.2', () => {
    const whole = layer({ start: 0, end: 20 * H });
    expect(layerState(whole, 0, 20 * H, H, O).scale).toBeCloseTo(1 + SCENE_ZOOM * 2.5, 5);
    expect(layerState(whole, 0, 20 * H, H, O).scale).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it('drifts a picture up or down by a few percent of the screen', () => {
    const l = layer({ drift: 'up' });
    const enter = l.start - 0.65 * H;
    const leave = l.end - 0.35 * H;
    expect(layerState(l, 1, enter, H, O).shift).toBeCloseTo(-SCENE_DRIFT * H, 5);
    expect(layerState(l, 1, leave, H, O).shift).toBeCloseTo(SCENE_DRIFT * H, 5);
    expect(layerState({ ...l, drift: 'down' }, 1, enter, H, O).shift).toBeCloseTo(SCENE_DRIFT * H, 5);
    expect(layerState({ ...l, drift: null }, 1, leave, H, O).shift).toBe(0);
  });

  it('hands the browser the same timeline as scroll ranges (its scroll-driven animations play it)', () => {
    const l = layer({ start: 2000, end: 2900, drift: 'down' });
    const r = layerRanges(l, 1, H, O);
    // the cross-fade: from 0 at its start to 1 at its end
    expect(r.fade).not.toBeNull();
    const [fa, fb] = r.fade!;
    expect(layerState(l, 1, fa, H, O).opacity).toBe(0);
    expect(layerState(l, 1, fb, H, O).opacity).toBe(1);
    expect(fb - fa).toBeCloseTo((FADE_FROM - FADE_TO) * H, 5);
    // the passage: the zoom and the drift at either end are layerState's there
    const [ma, mb] = r.move;
    for (const [y, i] of [
      [ma, 0],
      [mb, 1],
    ] as const) {
      expect(r.scale[i]).toBeCloseTo(layerState(l, 1, y, H, O).scale, 9);
      expect(r.shift[i]).toBeCloseTo(layerState(l, 1, y, H, O).shift, 9);
    }
    // linear in between, as layerState is
    const mid = layerState(l, 1, (ma + mb) / 2, H, O);
    expect(mid.scale).toBeCloseTo((r.scale[0] + r.scale[1]) / 2, 9);
    expect(mid.shift).toBeCloseTo((r.shift[0] + r.shift[1]) / 2, 9);
    // the first picture never fades: it is the ground, and its passage starts at the top
    const ground = layerRanges(layer({ start: 0, end: 2000 }), 0, H, O);
    expect(ground.fade).toBeNull();
    expect(ground.move[0]).toBe(0);
  });

  it('keeps only the pictures near the screen in play: from its cross-fade until the next one covers it', () => {
    const geometry = [
      layer({ start: 0, end: 2000 }),
      layer({ start: 2000, end: 4000 }),
      layer({ start: 4000, end: 6000 }),
    ];
    const ranges = geometry.map((l, k) => layerRanges(l, k, H, O));
    const shown = (y: number, margin = 0) => ranges.map((_, k) => layerShown(ranges, k, y, margin));
    // at the top: the ground only
    expect(shown(0)).toEqual([true, false, false]);
    // the second picture fading in over the first: both
    expect(shown(2000 - 0.5 * H)).toEqual([true, true, false]);
    // the second one in, the first covered: the second only
    expect(shown(3000)).toEqual([false, true, false]);
    // …but within the margin (the browser scrolls on its own meanwhile) the neighbours are kept ready
    expect(shown(3000, 1500)).toEqual([true, true, true]);
    // the last one stays in play to the end
    expect(shown(50_000)).toEqual([false, false, true]);
  });

  it('says the same with the sections in front of each picture crossing bands around the screen', () => {
    // (how the driver follows it without a scroll listener: IntersectionObservers on the sections)
    const geometry = [
      layer({ start: 0, end: 1900 }),
      layer({ start: 1900, end: 2600 }),
      layer({ start: 2600, end: 6000 }),
    ];
    const ranges = geometry.map((l, k) => layerRanges(l, k, H, O));
    const band = inPlayMargins(O, 0.5);
    for (let y = 13; y < 6000; y += 37)
      geometry.forEach((l, k) => {
        const crossing = l.start <= y + H + band.bottom * H && l.end >= y - band.top * H;
        expect(crossing).toBe(layerShown(ranges, k, y, 0.5 * H));
      });
  });
});

describe('scroll scene — the model', () => {
  const celestial = requireTemplate('celestial').manifest;

  it('is a design made as a scene: gate → through it → up → above → down → the venue → the garden → dusk', () => {
    expect(validateTemplate(requireTemplate('celestial'))).toEqual([]);
    const doc = demoDocument('celestial');
    const m = sceneModel({ doc, template: celestial, bases });
    expect(m.layers.map((l) => l.picture?.src.match(/scene-[a-z]+/)?.[0])).toEqual([
      'scene-gate',
      'scene-threshold',
      'scene-ascent',
      'scene-above',
      'scene-descent',
      'scene-venue',
      'scene-garden',
      'scene-dusk',
    ]);
    // the footer has no picture of its own: it goes on under dusk
    const footer = doc.sections.find((s) => s.type === 'footer')!;
    expect(m.layerOf[footer.id]).toBe(7);
    expect(m.particles).toBe('butterflies');
    expect(m.tracking).toBe(0.25);
    expect(m.shade).toBe('#10182A');
    expect(m.layers[4]).toMatchObject({ drift: 'down', zoom: 'in' });
    expect(m.layers[3]).toMatchObject({ zoom: 'out' });
    // every text rises out of a blur, 90 ms apart (the timeline a little slower)
    expect(Object.values(m.revealOf).every((r) => r.preset === 'rise_blur')).toBe(true);
    const timeline = doc.sections.find((s) => s.type === 'timeline')!;
    expect(m.revealOf[timeline.id]).toEqual({ preset: 'rise_blur', stagger: 110 });
  });

  it('serves the pictures through the image optimizer, the first one only eager (the others load later)', () => {
    const m = sceneModel({ doc: demoDocument('celestial'), template: celestial, bases });
    const first = m.layers[0]!.picture!;
    // AVIF / WebP in a srcset of widths (renderer/images.ts), the file itself as the fallback
    expect(first.fallback).toMatch(/^\/templates\/celestial\/scene-gate\.webp\?v=/);
    expect(first.src).toMatch(/^\/_next\/image\?url=%2Ftemplates%2Fcelestial%2Fscene-gate\.webp/);
    expect(first.srcSet?.split(', ').length).toBeGreaterThanOrEqual(5);
    expect(first.sizes).toBe('100vw');
    expect(first.position).toBe('50% 52%');
  });

  it('turns any design into a scene: its own art behind the whole invitation, its particles', () => {
    const sahar = requireTemplate('sahar-bordeaux').manifest;
    const doc = demoDocument('sahar-bordeaux');
    expect(sceneOn(doc, sahar, true)).toBe(false);
    const on: InvitationDocument = { ...doc, theme: { ...doc.theme, scene: { enabled: true } } };
    expect(sceneOn(on, sahar, true)).toBe(true);
    expect(sceneOn(on, sahar, false)).toBe(false);
    const m = sceneModel({ doc: on, template: sahar, bases });
    expect(m.layers).toHaveLength(1);
    expect(m.layers[0]!.picture).toBeNull();
    expect(new Set(Object.values(m.layerOf))).toEqual(new Set([0]));
    expect(m.particles).toBe('petals');
    expect(templateScene(sahar)).toMatchObject({ enabled: false, tracking: 0 });
  });

  it('starts a new picture only where a section brings one, and never the same picture twice in a row', () => {
    const sahar = requireTemplate('sahar-bordeaux').manifest;
    const doc = demoDocument('sahar-bordeaux');
    const photo = (src: string) =>
      ({ kind: 'image', src, poster: null, focalPoint: { x: 0.5, y: 0.5 } }) as const;
    const ids = doc.sections.filter((s) => s.enabled).map((s) => s.id);
    const sections = doc.sections.map((s): Section => {
      if (s.id === ids[2]) return { ...s, media: photo('upload:a.jpg') } as Section;
      if (s.id === ids[3]) return { ...s, media: photo('upload:a.jpg') } as Section;
      if (s.id === ids[5]) return { ...s, media: { ...photo('upload:b.jpg'), kenBurns: 'out' } } as Section;
      return s;
    });
    const m = sceneModel({
      doc: { ...doc, sections, theme: { ...doc.theme, scene: { enabled: true, particles: 'none' } } },
      template: sahar,
      bases,
    });
    expect(m.layers).toHaveLength(3);
    expect(ids.map((id) => m.layerOf[id])).toEqual([0, 0, 1, 1, 1, 2, ...ids.slice(6).map(() => 2)]);
    expect(m.layers[2]!.zoom).toBe('out');
    expect(m.particles).toBe('none');
  });

  it('keeps a video hero in the hero (the backdrop shows its still)', () => {
    const doc = demoDocument('celestial');
    const sections = doc.sections.map((s): Section =>
      s.type === 'hero'
        ? {
            ...s,
            data: {
              ...s.data,
              media: {
                kind: 'video',
                src: 'upload:v.mp4',
                poster: 'upload:v.jpg',
                focalPoint: { x: 0.5, y: 0.5 },
              },
            },
          }
        : s,
    );
    const m = sceneModel({ doc: { ...doc, sections }, template: celestial, bases });
    expect(m.heroInline).toBe(true);
    expect(m.layers[0]!.picture!.src).toContain('v.jpg');
  });
});

describe('scroll scene — contracts and the editor', () => {
  it('parses the scene settings and a picture’s motion; a manifest without a scene is a page', () => {
    expect(SceneSettingsSchema.parse({ enabled: true, particles: 'gold_dust' })).toEqual({
      enabled: true,
      particles: 'gold_dust',
    });
    expect(() => SceneSettingsSchema.parse({ enabled: true, particles: 'confetti' })).toThrow();
    expect(
      SectionMediaSchema.parse({
        kind: 'image',
        src: 'upload:x.jpg',
        poster: null,
        focalPoint: { x: 0.5, y: 0.5 },
        kenBurns: 'out',
        drift: 'up',
      }),
    ).toMatchObject({ kenBurns: 'out', drift: 'up' });
    const sahar = requireTemplate('sahar-bordeaux').manifest;
    const raw = JSON.parse(JSON.stringify(sahar)) as Record<string, unknown>;
    delete raw.scene;
    expect(TemplateManifestSchema.parse(raw).scene).toBeNull();
    const doc = demoDocument('celestial');
    expect(
      InvitationDocumentSchema.parse({ ...doc, theme: { ...doc.theme, scene: { enabled: false } } }).theme
        .scene,
    ).toEqual({ enabled: false });
  });

  it('counts the scene as the cinematic presentation (the feature gates it)', () => {
    const doc = demoDocument('sahar-bordeaux');
    expect(usesCinematic(doc)).toBe(false);
    const on = { ...doc, theme: { ...doc.theme, scene: { enabled: true } } };
    expect(usesCinematic(on)).toBe(true);
    expect(introducedCinematic(doc, on)).toContain('theme.scene');
    expect(introducedCinematic(on, on)).toEqual([]);
  });

  it('stores the host’s choice only where it differs from the design’s', () => {
    const sahar: TemplateManifest = requireTemplate('sahar-bordeaux').manifest;
    const celestial: TemplateManifest = requireTemplate('celestial').manifest;
    const page = demoDocument('sahar-bordeaux');
    const on = setScene(page, { enabled: true }, sahar, templateScene(sahar).particles);
    expect(on.theme.scene).toEqual({ enabled: true });
    expect(
      setScene(on, { enabled: false }, sahar, templateScene(sahar).particles).theme.scene,
    ).toBeUndefined();
    const withButterflies = setScene(on, { particles: 'butterflies' }, sahar, templateScene(sahar).particles);
    expect(withButterflies.theme.scene).toEqual({ enabled: true, particles: 'butterflies' });
    // a design made as a scene: turning it off is the stored choice; its own particles are not stored
    const film = demoDocument('celestial');
    expect(film.theme.scene).toBeUndefined();
    expect(setScene(film, { enabled: false }, celestial, 'butterflies').theme.scene).toEqual({
      enabled: false,
    });
    expect(
      setScene(film, { particles: 'butterflies' }, celestial, 'butterflies').theme.scene,
    ).toBeUndefined();
  });

  it('opens with a sheet of embossed paper sealed in the host’s wax color', () => {
    const celestial = requireTemplate('celestial').manifest;
    const doc = demoDocument('celestial');
    const palette = resolvePalette(celestial, doc);
    const o = resolveOpening(celestial, doc, palette, true)!;
    expect(o).toMatchObject({ preset: 'gatefold', scroll: false, color: '#F4ECDD', seal: '#5E7C9E' });
    const red = resolveOpening(celestial, { cover: { ...doc.cover, sealColor: '#8C2E3C' } }, palette, true)!;
    expect(red.seal).toBe('#8C2E3C');
    // without the feature: the design's own cover
    expect(resolveOpening(celestial, doc, palette, false)).toBeNull();
  });
});
