import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { displayFontPreloads, fontFaceCss, fontFaceFiles } from '@/features/invitations/fonts';
import generated from '@/features/invitations/fonts/font-faces.generated.json';
import { requireTemplate } from '@/features/invitations/templates/registry';
import { appFaceUrl, appStaticFaceUrl } from '@/lib/app-fonts';

type Face = { weight: number; style: string; subset: string; unicodeRange: string | null; url: string };
type Family = { faces: Face[]; subsets: string[] };
const families = (generated as { families: Record<string, Family> }).families;

/** The code points of a `unicode-range` value. */
function points(range: string): Set<number> {
  const out = new Set<number>();
  for (const part of range.split(',')) {
    const m = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part.trim());
    if (!m) throw new Error(`bad unicode-range part: ${part}`);
    const from = parseInt(m[1]!, 16);
    const to = m[2] ? parseInt(m[2], 16) : from;
    for (let c = from; c <= to; c++) out.add(c);
  }
  return out;
}

const withLatin = Object.entries(families).filter(([, f]) => f.faces.some((x) => x.subset === 'latin'));

/**
 * A Latin file is 12–39 KB a weight and holds what a page in ASCII never shows (accents, ligatures, the
 * rest). Each Latin face has its ASCII part cut out as a file of its own (scripts/build-fonts.mjs), about
 * two thirds of the size, declared after it: it wins for those characters, so the whole Latin face
 * downloads only for the rest — on a Hebrew page (spaces, digits, an English word or two) and on an
 * English one.
 */
describe('latin-basic faces', () => {
  it('exist for every weight and style of every Latin face', () => {
    expect(withLatin.length).toBeGreaterThan(40);
    for (const [name, family] of withLatin) {
      const latin = family.faces.filter((f) => f.subset === 'latin');
      const basic = family.faces.filter((f) => f.subset === 'latin-basic');
      expect(basic.length, name).toBe(latin.length);
      for (const l of latin)
        expect(
          basic.some((b) => b.weight === l.weight && b.style === l.style),
          `${name} ${l.weight} ${l.style}`,
        ).toBe(true);
    }
  });

  it('hold the letters, digits and punctuation of ASCII — and stay inside the Latin face’s range', () => {
    for (const [name, family] of withLatin)
      for (const face of family.faces.filter((f) => f.subset === 'latin-basic')) {
        const held = points(face.unicodeRange!);
        const latin = points(
          family.faces.find(
            (f) => f.subset === 'latin' && f.weight === face.weight && f.style === face.style,
          )!.unicodeRange!,
        );
        for (const c of [0x20, 0x26, 0x2c, 0x2e, 0x30, 0x39, 0x41, 0x5a, 0x61, 0x7a])
          expect(held.has(c), `${name}: U+${c.toString(16)}`).toBe(true);
        for (const c of held)
          expect(latin.has(c), `${name}: U+${c.toString(16)} is outside the Latin range`).toBe(true);
        // accents and the like stay in the whole Latin face
        expect(held.has(0xe9), name).toBe(false);
        // U+2010 is the Hebrew face's (a Hebrew hyphen): never claimed here
        expect(held.has(0x2010), name).toBe(false);
      }
  });

  it('are declared after the Latin face they belong to (the later face wins for those characters)', () => {
    for (const [name, family] of withLatin) {
      const subsets = family.faces
        .filter((f) => f.weight === family.faces[0]!.weight && f.style === family.faces[0]!.style)
        .map((f) => f.subset);
      expect(subsets.indexOf('latin-basic'), name).toBeGreaterThan(subsets.indexOf('latin'));
    }
  });

  it('are lighter than the Latin face they come from, and a file of their own', () => {
    for (const [name, family] of withLatin) {
      const latin = family.faces.find((f) => f.subset === 'latin')!;
      const basic = family.faces.find((f) => f.subset === 'latin-basic')!;
      expect(basic.url, name).not.toBe(latin.url);
      expect(basic.url, name).toMatch(/-latin-basic\d+-/);
    }
  });
});

describe('fontFaceCss — the ASCII part', () => {
  const request = { family: 'Frank Ruhl Libre', subsets: ['hebrew', 'latin', 'latin-ext'] };

  it('goes with the Latin face: declared after it, with the range of what it holds', () => {
    const css = fontFaceCss([request], [400]);
    const latin = css.indexOf('-latin-400-normal.woff2');
    const basic = css.indexOf('-latin-basic');
    expect(latin).toBeGreaterThan(-1);
    expect(basic).toBeGreaterThan(latin);
    const rule = css.split('\n').find((r) => r.includes('-latin-basic'))!;
    expect(rule).toMatch(/unicode-range:U\+0020-007E/);
  });

  it('is left out of a request that has no Latin subset', () => {
    const css = fontFaceCss([{ family: 'Frank Ruhl Libre', subsets: ['hebrew'] }], [400]);
    expect(css).not.toContain('latin-basic');
  });

  it('comes with a family named whole (every subset)', () => {
    expect(fontFaceCss(['Pinyon Script'])).toContain('latin-basic');
    expect(
      fontFaceFiles('Frank Ruhl Libre').filter((f) => f.subset === 'latin-basic').length,
    ).toBeGreaterThan(0);
  });
});

describe('a page’s preloads', () => {
  const pair = requireTemplate('kalanit').manifest.fontPairs[0]!;

  it('on a Hebrew page: the display font’s Hebrew face and its ASCII part (the names’ "&" and spaces)', () => {
    const he = displayFontPreloads(pair, 'he');
    expect(he.some((u) => u.includes('-hebrew-'))).toBe(true);
    expect(he.some((u) => u.includes('-latin-basic'))).toBe(true);
    expect(he.some((u) => /-latin-\d/.test(u))).toBe(false);
  });

  it('on an English page: the Latin text’s ASCII part, not the whole Latin face', () => {
    const en = displayFontPreloads(pair, 'en');
    expect(en).toHaveLength(1);
    expect(en[0]).toMatch(/-latin-basic\d+-/);
  });
});

describe('the host app’s variable fonts', () => {
  it('Heebo: Hebrew and the ASCII part in one file, cut to the weights the app uses', () => {
    expect(appFaceUrl('Heebo Variable', 'hebrew-basic')).toMatch(
      /heebo-hebrew-basic\d+-w400-800-normal\.woff2$/,
    );
    // the separate Hebrew and ASCII files are gone: the text is one request
    expect(appFaceUrl('Heebo Variable', 'hebrew')).toBeNull();
    expect(appFaceUrl('Heebo Variable', 'latin-basic')).toBeNull();
    expect(appFaceUrl('Heebo Variable', 'latin')).toMatch(/heebo-latin-wght-normal\.woff2$/);
  });

  it('the display font has Hebrew and the ASCII part in one file per weight', () => {
    expect(appStaticFaceUrl('Frank Ruhl Libre', 700)).toMatch(
      /frank-ruhl-libre-hebrew-basic\d+-700-normal\.woff2$/,
    );
  });

  it('declares the combined face last, so it wins over the whole Latin face for the ASCII part', () => {
    const faces = readFileSync('src/styles/app-fonts.generated.css', 'utf8')
      .split('\n')
      .filter((l) => l.includes("font-family:'Heebo Variable'"));
    expect(faces.at(-1)).toContain('hebrew-basic');
    expect(faces.at(-1)).toContain('U+05');
    expect(faces.at(-1)).toContain('U+0020-007E');
  });

  it('Inter has its ASCII part too (the English text)', () => {
    expect(appFaceUrl('Inter Variable', 'latin-basic')).toMatch(
      /inter-latin-basic\d+-w400-800-normal\.woff2$/,
    );
  });
});
