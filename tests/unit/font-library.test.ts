import { describe, expect, it } from 'vitest';
import { FontPairSchema } from '@/features/invitations/contracts/schemas';
import type { FontPair } from '@/features/invitations/contracts/types';
import { validateDocument } from '@/features/invitations/contracts/validate';
import {
  fontFaceCss,
  fontFaceFiles,
  hasFamily,
  libraryDisplayFamilies,
  pairFontFamilies,
  templateFontFamilies,
} from '@/features/invitations/fonts';
import generated from '@/features/invitations/fonts/font-faces.generated.json';
import {
  FONT_LIBRARY,
  LIBRARY_PAIR_PREFIX,
  findFontPair,
  libraryPair,
} from '@/features/invitations/fonts/library';
import { resolveFontPair, themeVars } from '@/features/invitations/renderer/theme';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATES, requireTemplate } from '@/features/invitations/templates/registry';
import { validateTemplate } from '@/features/invitations/templates/validate-template';

// The font library: Hebrew + Latin pairs any template can use ("More fonts" in the editor and the
// gallery preview) — a document's theme.fontPairId names a pair of its template or one of these.

const NOW = Date.parse('2026-09-23T10:00:00Z');
const ROLES = ['display', 'heading', 'body', 'ui'] as const;
const families = (generated as { families: Record<string, { subsets: string[] }> }).families;

describe('font library', () => {
  it('has at least 12 well-formed pairs, named in Hebrew and English, with unique "lib-" ids', () => {
    expect(FONT_LIBRARY.length).toBeGreaterThanOrEqual(12);
    const ids = FONT_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pair of FONT_LIBRARY) {
      expect(pair.id.startsWith(LIBRARY_PAIR_PREFIX)).toBe(true);
      const { name, ...fonts } = pair;
      expect(FontPairSchema.safeParse(fonts).success, pair.id).toBe(true);
      expect(name.he.trim(), pair.id).not.toBe('');
      expect(name.en.trim(), pair.id).not.toBe('');
    }
    // every pair looks different where it shows most: the names
    const displays = FONT_LIBRARY.map((p) => `${p.display.hebrew}/${p.display.latin}`);
    expect(new Set(displays).size).toBe(displays.length);
  });

  it('self-hosts every family, and the Hebrew side of each role has Hebrew glyphs', () => {
    for (const pair of FONT_LIBRARY) {
      for (const family of pairFontFamilies(pair)) {
        expect(hasFamily(family), `${pair.id}: ${family}`).toBe(true);
        expect(fontFaceFiles(family).length, `${pair.id}: ${family}`).toBeGreaterThan(0);
      }
      for (const role of ROLES) {
        expect(families[pair[role].hebrew]?.subsets, `${pair.id} ${role}`).toContain('hebrew');
        expect(families[pair[role].latin]?.subsets, `${pair.id} ${role}`).toContain('latin');
      }
      // the display face the pickers write the pair's name in (regular weight)
      const css = fontFaceCss([pair.display.hebrew, pair.display.latin], [400]);
      expect(css).toContain(`font-family:'${pair.display.hebrew}'`);
      expect(css).toContain(`font-family:'${pair.display.latin}'`);
    }
    expect(libraryDisplayFamilies()).toEqual(
      expect.arrayContaining(FONT_LIBRARY.flatMap((p) => [p.display.hebrew, p.display.latin])),
    );
  });

  it('resolves and validates with every template, and the page declares its faces', () => {
    for (const { manifest } of TEMPLATES.values()) {
      const doc = demoDocument(manifest.id);
      for (const pair of FONT_LIBRARY) {
        doc.theme.fontPairId = pair.id;
        expect(findFontPair(manifest, pair.id)).toBe(pair);
        expect(resolveFontPair(manifest, doc)).toBe(pair);
        const { errors } = validateDocument(doc, manifest, { mode: 'publish', now: NOW });
        expect(
          errors.map((i) => `${i.code} ${i.path}`),
          `${manifest.id} + ${pair.id}`,
        ).toEqual([]);
        const vars = themeVars(manifest, doc, 'he');
        expect(vars['--f-display']).toMatch(new RegExp(`^"${pair.display.hebrew}"`));
        expect(themeVars(manifest, doc, 'en')['--f-body']).toMatch(new RegExp(`^"${pair.body.latin}"`));
        const declared = templateFontFamilies(manifest, pair.id);
        for (const family of pairFontFamilies(pair)) expect(declared).toContain(family);
        // …and the template's monogram fonts, which the cover keeps
        expect(declared).toContain(manifest.cover.monogramFont.hebrew);
      }
    }
  });

  it("keeps the template's own pairs first; an unknown id is an error and renders the default", () => {
    const { manifest } = requireTemplate('sahar-bordeaux');
    const own = manifest.fontPairs[1]!;
    expect(findFontPair(manifest, own.id)).toBe(own);
    expect(libraryPair(own.id)).toBeUndefined();
    const doc = demoDocument('sahar-bordeaux');
    doc.theme.fontPairId = 'lib-comic';
    expect(findFontPair(manifest, 'lib-comic')).toBeUndefined();
    expect(resolveFontPair(manifest, doc)).toBe(manifest.fontPairs[0]);
    const { errors } = validateDocument(doc, manifest, { mode: 'edit', now: NOW });
    expect(errors.map((i) => `${i.code} ${i.path}`)).toEqual(['font_pair theme.fontPairId']);
  });

  it('reserves the "lib-" prefix: a template pair may not use it', () => {
    const entry = requireTemplate('kalanit');
    const pair: FontPair = { ...entry.manifest.fontPairs[0]!, id: 'lib-meadow' };
    const manifest = { ...entry.manifest, fontPairs: [pair, ...entry.manifest.fontPairs.slice(1)] };
    expect(validateTemplate({ ...entry, manifest })).toEqual([
      `kalanit: font pair id "lib-meadow" uses the font library's "lib-" prefix`,
    ]);
    expect(validateTemplate(entry)).toEqual([]);
  });
});
