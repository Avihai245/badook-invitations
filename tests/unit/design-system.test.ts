import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Palette } from '@/features/invitations/contracts/types';
import { dictionaryKeys } from '@/features/invitations/i18n/dictionary';
import { contrastRatio, mixHex, readableAccent } from '@/features/invitations/lib/contrast';
import { longestWordLength } from '@/features/invitations/lib/text';
import {
  hasPlaceholderArt,
  placeholderArt,
  placeholderScrim,
} from '@/features/invitations/renderer/placeholders';
import { themeVars } from '@/features/invitations/renderer/theme';
import { demoDocument } from '@/features/invitations/templates/demo';
import { TEMPLATE_IDS, requireTemplate } from '@/features/invitations/templates/registry';
import { CUSTOM_ICON_PATHS } from '@/features/invitations/ui/custom-icons';

/** Every palette a host can end up with: the template palette + each preset merged over it. */
function palettes(id: string): { name: string; palette: Palette }[] {
  const { manifest } = requireTemplate(id);
  return [
    { name: `${id}`, palette: manifest.tokens.palette },
    ...manifest.palettePresets.map((p) => ({
      name: `${id}/${p.id}`,
      palette: { ...manifest.tokens.palette, ...p.palette },
    })),
  ];
}

describe('custom icons', () => {
  it.each(Object.keys(CUSTOM_ICON_PATHS))('%s matches docs/invitations/icons/%s.svg', (name) => {
    const svg = readFileSync(join('docs/invitations/icons', `${name}.svg`), 'utf8');
    const kit = [...svg.matchAll(/<(path|circle)\s([^>]*?)\/>/g)].map(([, tag, attrs]) => {
      const a = Object.fromEntries([...attrs!.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
      return tag === 'path' ? a.d : { circle: { cx: Number(a.cx), cy: Number(a.cy), r: Number(a.r) } };
    });
    expect(kit).toEqual(CUSTOM_ICON_PATHS[name as keyof typeof CUSTOM_ICON_PATHS]);
  });
});

describe('contrast helpers', () => {
  it('mixHex endpoints and midpoint', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('readableAccent keeps the reference accent (sahar-bordeaux) unchanged', () => {
    const { palette } = requireTemplate('sahar-bordeaux').manifest.tokens;
    expect(readableAccent(palette)).toBe(palette.accent);
  });

  it('readableAccent darkens a low-contrast accent (honey-meadow) to ≥ 4.5:1', () => {
    const { palette } = requireTemplate('honey-meadow').manifest.tokens;
    expect(contrastRatio(palette.accent, palette.bg)).toBeLessThan(4.5);
    const text = readableAccent(palette);
    expect(text).not.toBe(palette.accent);
    expect(contrastRatio(text, palette.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TEMPLATE_IDS.flatMap(palettes).map((p) => [p.name, p.palette] as const))(
    '%s: accent text ≥ 4.5:1 on bg, body ink ≥ 4.5:1',
    (_, palette) => {
      expect(contrastRatio(readableAccent(palette), palette.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.ink, palette.bg)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('placeholder art', () => {
  it.each(TEMPLATE_IDS)('%s has its own placeholder art', (id) => {
    expect(hasPlaceholderArt(id)).toBe(true);
  });

  it('sahar-bordeaux (the design reference’s pale sunset) is deepened under the text too', () => {
    // its hero text measured 2.2–2.9:1 on the reference's sky; the scrim brings it past WCAG AA
    expect(placeholderScrim(placeholderArt('sahar-bordeaux'))).toBe(
      'linear-gradient(180deg,#FFFFFF 4%,#A87070 24%,#A87070 100%)',
    );
  });

  it('pale skies get a multiply scrim in their shade, untouched at the top', () => {
    const art = placeholderArt('honey-meadow');
    expect(art.shade).toMatch(/^#[0-9A-F]{6}$/i);
    expect(placeholderScrim(art)).toBe(
      `linear-gradient(180deg,#FFFFFF 4%,${art.shade} 24%,${art.shade} 100%)`,
    );
  });
});

describe('theme variables', () => {
  it.each(TEMPLATE_IDS.flatMap((id) => (['he', 'en'] as const).map((locale) => [id, locale] as const)))(
    '%s/%s: every variable is set, name metrics are sane',
    (id, locale) => {
      const vars = themeVars(requireTemplate(id).manifest, demoDocument(id), locale);
      for (const [k, v] of Object.entries(vars)) expect(v, k).toBeTruthy();
      const em = Number(vars['--name-em']);
      expect(em).toBeGreaterThan(0.3);
      expect(em).toBeLessThan(0.9);
      expect(vars['--inv-accent-text']).toMatch(/^#[0-9A-F]{6}$/i);
    },
  );
});

describe('longestWordLength', () => {
  it('counts graphemes of the longest word', () => {
    expect(longestWordLength('Jonathan')).toBe(8);
    expect(longestWordLength('Maya  Rose   Cohen-Levi')).toBe(10);
    expect(longestWordLength('נועה ואיתי', 'he')).toBe(5);
    expect(longestWordLength('👨‍👩‍👧 party')).toBe(5);
    expect(longestWordLength('')).toBe(1);
  });
});

describe('dictionaries', () => {
  it('he and en define the same keys', () => {
    expect([...dictionaryKeys('he')].sort()).toEqual([...dictionaryKeys('en')].sort());
  });
});

describe('stress document (§12.12)', () => {
  it('uses strings exactly at the caps: names 20, eyebrow 40, timeline labels 22', async () => {
    const { STRESS_TEXT } = await import('@/features/invitations/templates/demo');
    const { cappedLength } = await import('@/features/invitations/lib/l10n');
    const graphemes = (s: string) =>
      [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length;
    for (const locale of ['he', 'en'] as const) {
      expect(graphemes(STRESS_TEXT.primary[locale])).toBe(20);
      expect(graphemes(STRESS_TEXT.secondary[locale])).toBe(20);
      expect(cappedLength(STRESS_TEXT.eyebrow[locale])).toBe(40);
      expect(cappedLength(STRESS_TEXT.timelineLabel[locale])).toBe(22);
      for (const text of Object.values(STRESS_TEXT)) expect(text[locale]).toBe(text[locale].trim());
    }
  });
});
