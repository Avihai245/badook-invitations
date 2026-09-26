import { describe, expect, it } from 'vitest';
import {
  AMBIENT_KINDS,
  type AmbientKind,
  type TemplateManifest,
} from '@/features/invitations/contracts/types';
import { TemplateManifestSchema } from '@/features/invitations/contracts/schemas';
import { AMBIENT } from '@/features/invitations/renderer/fx/Ambient.client';
import { BURSTS } from '@/features/invitations/renderer/fx/burst';
import { PHONE_MAX_PARTICLES } from '@/features/invitations/renderer/fx/motion';
import { SHAPES } from '@/features/invitations/renderer/fx/shapes';
import {
  FX_BY_TEMPLATE,
  ambientFor,
  burstFor,
  fxColors,
  fxTheme,
  type BurstKind,
} from '@/features/invitations/renderer/fx/theme';
import { TEMPLATES, TEMPLATE_IDS } from '@/features/invitations/templates/registry';

// The invitation's particles (renderer/fx): every template gets a fitting ambient effect and burst,
// the manifest may choose its own, colors come from the palette, and nothing exceeds the phone cap.

/** The templates being added next to the pack's 28 (their manifests arrive with that work). */
const UPCOMING = [
  'safari-pals',
  'dig-it',
  'ocean-friends',
  'rocket-launch',
  'unicorn-dream',
  'hoop-stars',
  'superhero-pow',
  'circus-top',
  'grand-prix',
  'skate-graffiti',
  'pixel-quest',
  'disco-ball',
  'ballet-rose',
  'vinyl-groove',
  'retro-80s',
  'tropical-tiki',
  'vineyard-harvest',
  'campfire-night',
  'golden-years',
  'grandma-garden',
];

const HEX = /^#[0-9A-F]{6}$/;
const manifest = (id: string) => TEMPLATES.get(id)!.manifest;
const docCover = { enabled: true, monogram: null, sealColor: null, hint: null };
const BURST_KINDS = AMBIENT_KINDS.filter((k): k is BurstKind => k !== 'none');

describe('particle theme (fallback table)', () => {
  it.each([...TEMPLATE_IDS, ...UPCOMING])('%s has its own entry', (id) => {
    expect(FX_BY_TEMPLATE[id]).toBeDefined();
  });

  it('every registered template gets an ambient effect and a burst', () => {
    for (const id of TEMPLATE_IDS) {
      const m = manifest(id);
      expect(ambientFor(m)).not.toBe('none');
      expect(burstFor(m)).not.toBeNull();
    }
  });

  it('maps themes sensibly', () => {
    const kind = (id: string) => {
      const e = FX_BY_TEMPLATE[id]!;
      return typeof e === 'string' ? e : e[0];
    };
    expect(kind('kalanit')).toBe('petals');
    expect(kind('neon-night')).toBe('confetti');
    expect(kind('ocean-friends')).toBe('bubbles');
    expect(kind('rocket-launch')).toBe('stars');
    expect(kind('campfire-night')).toBe('embers');
    expect(kind('vinyl-groove')).toBe('notes');
    expect(kind('pixel-quest')).toBe('pixels');
    expect(kind('dino-hatch')).toBe('balloons');
  });

  it("a manifest's motion.ambient wins; an unknown template falls back by event type", () => {
    const base = manifest('kalanit');
    expect(ambientFor({ ...base, motion: { ...base.motion, ambient: 'stars' } })).toBe('stars');
    // the table's burst belongs to the table's ambient: another ambient bursts in its own kind
    expect(burstFor({ ...base, motion: { ...base.motion, ambient: 'stars' } })).toBe('stars');
    const stranger = { ...base, id: 'not-in-the-table' };
    expect(ambientFor({ ...stranger, categories: ['birthday'] })).toBe('confetti');
    expect(ambientFor({ ...stranger, categories: ['brit'] })).toBe('bubbles');
    expect(ambientFor({ ...stranger, categories: ['wedding'] })).toBe('petals');
  });

  it("motion preset 'none' turns every effect off; ambient 'none' keeps a light burst", () => {
    const base = manifest('match-day');
    const calm = { ...base, motion: { ...base.motion, preset: 'none' as const } };
    expect(ambientFor(calm)).toBe('none');
    expect(burstFor(calm)).toBeNull();
    const quiet = { ...base, motion: { ...base.motion, ambient: 'none' as AmbientKind } };
    expect(ambientFor(quiet)).toBe('none');
    expect(burstFor(quiet)).toBe('sparkles');
    const theme = fxTheme(calm, { theme: { fontPairId: 'x', palette: null }, cover: docCover });
    expect(theme).toMatchObject({ ambient: 'none', ambientColors: [], burst: null, burstColors: [] });
  });
});

describe('particle colors', () => {
  it.each(TEMPLATE_IDS)('%s: 2–6 hex colors for its ambient layer and its burst', (id) => {
    const t = fxTheme(manifest(id), { theme: { fontPairId: 'x', palette: null }, cover: docCover });
    for (const list of [t.ambientColors, t.burstColors]) {
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(6);
      for (const c of list) expect(c).toMatch(HEX);
    }
  });

  it("follow the host's accent (an editable palette key) and ignore a key they can't edit", () => {
    const m = manifest('kalanit');
    const doc = (palette: Record<string, string>) => ({
      theme: { fontPairId: 'x', palette },
      cover: docCover,
    });
    expect(fxTheme(m, doc({ accent: '#7A3E9D' })).burstColors).toContain('#7A3E9D');
    const locked = fxTheme(m, doc({ heroText: '#123456' }));
    expect(locked).toEqual(fxTheme(m, doc({})));
  });

  it('every kind gives colors on light and dark heroes, for both uses', () => {
    for (const kind of BURST_KINDS) {
      for (const heroText of ['#FFFFFF', '#1E1B18']) {
        for (const use of ['ambient', 'burst'] as const) {
          const list = fxColors(kind, { accent: '#731F2E', heroText }, ['#1F3A5F', '#B08D57'], use);
          expect(list.length, `${kind} ${heroText} ${use}`).toBeGreaterThanOrEqual(2);
          for (const c of list) expect(c).toMatch(HEX);
        }
      }
    }
  });
});

describe('particle specs', () => {
  it('every kind has an ambient layer and a burst, with shapes that exist', () => {
    for (const kind of BURST_KINDS) {
      expect(AMBIENT[kind], kind).toBeDefined();
      expect(BURSTS[kind], kind).toBeDefined();
      for (const s of [...AMBIENT[kind].shapes, ...BURSTS[kind].shapes]) expect(SHAPES[s], s).toBeDefined();
    }
  });

  it('never asks for more than 24 particles on a phone', () => {
    for (const kind of BURST_KINDS) {
      expect(AMBIENT[kind].count[0], kind).toBeLessThanOrEqual(PHONE_MAX_PARTICLES);
      expect(BURSTS[kind].count[0], kind).toBeLessThanOrEqual(PHONE_MAX_PARTICLES);
    }
  });
});

describe('manifest field motion.ambient', () => {
  const m = manifest('sahar-bordeaux');
  const withAmbient = (ambient: unknown) => ({ ...m, motion: { ...m.motion, ambient } });

  it('is optional and validated', () => {
    const { ambient: _a, ...motion } = m.motion;
    expect(TemplateManifestSchema.safeParse({ ...m, motion }).success).toBe(true);
    for (const kind of AMBIENT_KINDS)
      expect(TemplateManifestSchema.safeParse(withAmbient(kind)).success).toBe(true);
    expect(TemplateManifestSchema.safeParse(withAmbient('glitter')).success).toBe(false);
  });

  it('the templates that set it use a known kind', () => {
    const set = TEMPLATE_IDS.map((id) => manifest(id)).filter((t: TemplateManifest) => t.motion.ambient);
    expect(set.length).toBeGreaterThan(0);
    for (const t of set) expect(AMBIENT_KINDS).toContain(t.motion.ambient);
  });
});
