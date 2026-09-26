/**
 * Colors from a photo (the editor's "Colors from a photo" — nothing leaves the device): a small
 * in-house quantizer (k-means in OKLab over a downscaled copy of the picture) finds its dominant
 * colors; three palettes are built from them — a light one on paper tinted by the photo, a dark
 * evening one, and a tinted one led by its second color — each checked and repaired to WCAG AA: text
 * and muted text ≥ 4.5:1 on the background and on the cards, the button text ≥ 4.5:1 on the accent,
 * the accent ≥ 3:1 on the background where it can be (large titles). With a template's fixed colors
 * (its non-editable keys) the editable ones are solved against them.
 *
 * Pure and isomorphic: the pixels come from a canvas in the browser (`pixelsOf`), or from a decoded
 * image in the tests.
 */
import type { Palette } from '../contracts/types';
import { contrastRatio, hexToRgb, mixHex, relativeLuminance } from './contrast';

// ─── color spaces: sRGB ↔ OKLab ↔ OKLCH ─────────────────────────────────────────────────────────

type Lab = [number, number, number];

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;

/** 256 entries: sRGB byte → linear light (the quantizer converts thousands of pixels). */
const LINEAR = Array.from({ length: 256 }, (_, i) => toLinear(i));

export function rgbToOklab(r: number, g: number, b: number): Lab {
  const lr = LINEAR[r] ?? toLinear(r);
  const lg = LINEAR[g] ?? toLinear(g);
  const lb = LINEAR[b] ?? toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → linear sRGB (may be out of gamut). */
function oklabToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: [number, number, number]) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

const hex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/** An OKLCH color (h in degrees) as #RRGGBB — its chroma reduced until it fits in sRGB. */
export function oklchToHex(L: number, C: number, h: number): string {
  const l = Math.min(1, Math.max(0, L));
  const rad = (h * Math.PI) / 180;
  let c = Math.max(0, C);
  let rgb = oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
  for (let i = 0; i < 24 && !inGamut(rgb); i++) {
    c *= 0.85;
    rgb = oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
  }
  return `#${hex2(fromLinear(Math.min(1, Math.max(0, rgb[0]))))}${hex2(
    fromLinear(Math.min(1, Math.max(0, rgb[1]))),
  )}${hex2(fromLinear(Math.min(1, Math.max(0, rgb[2]))))}`.toUpperCase();
}

export interface Lch {
  L: number;
  C: number;
  h: number;
}

export function hexToOklch(hex: string): Lch {
  const [r, g, b] = hexToRgb(hex);
  const [L, a, bb] = rgbToOklab(r, g, b);
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

// ─── the quantizer ───────────────────────────────────────────────────────────────────────────────

/** One of the photo's dominant colors: how much of the picture it covers, and its OKLCH. */
export interface Swatch extends Lch {
  hex: string;
  /** 0..1 of the picture's (opaque) pixels */
  share: number;
}

/** A seeded generator (the same photo gives the same colors every time). */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const dist2 = (p: Lab, q: Lab) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/**
 * The picture's dominant colors (at most `k`, largest first): k-means in OKLab with a k-means++
 * start from a seeded generator — deterministic — over at most `maxSamples` of its opaque pixels
 * (RGBA bytes, as a canvas's getImageData gives them).
 */
export function extractSwatches(
  rgba: ArrayLike<number>,
  {
    k = 6,
    maxSamples = 6000,
    iterations = 14,
  }: { k?: number; maxSamples?: number; iterations?: number } = {},
): Swatch[] {
  const total = Math.floor(rgba.length / 4);
  const step = Math.max(1, Math.floor(total / maxSamples));
  const points: Lab[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if ((rgba[o + 3] ?? 255) < 128) continue;
    points.push(rgbToOklab(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!));
  }
  if (!points.length) return [];
  const rnd = prng(points.length * 7919 + Math.round((points[0]![0] + points.at(-1)![0]) * 1000));
  // k-means++: each next center far from those already chosen
  const centers: Lab[] = [points[Math.floor(rnd() * points.length)]!];
  const nearest = new Float64Array(points.length).fill(Infinity);
  while (centers.length < Math.min(k, points.length)) {
    const last = centers.at(-1)!;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      nearest[i] = Math.min(nearest[i]!, dist2(points[i]!, last));
      sum += nearest[i]!;
    }
    if (sum === 0) break;
    let pick = rnd() * sum;
    let chosen = points.length - 1;
    for (let i = 0; i < points.length; i++) {
      pick -= nearest[i]!;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centers.push(points[chosen]!);
  }
  const assign = new Int32Array(points.length).fill(-1);
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(points[i]!, centers[c]!);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        moved++;
      }
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]!]!;
      const p = points[i]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]! += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c]!;
      if (s[3]) centers[c] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    }
    if (!moved) break;
  }
  const counts = centers.map(() => 0);
  for (let i = 0; i < points.length; i++) counts[assign[i]!]! += 1;
  return centers
    .map((c, i) => {
      const C = Math.hypot(c[1], c[2]);
      const h = ((Math.atan2(c[2], c[1]) * 180) / Math.PI + 360) % 360;
      return { hex: oklchToHex(c[0], C, h), share: counts[i]! / points.length, L: c[0], C, h };
    })
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share);
}

// ─── contrast repair ─────────────────────────────────────────────────────────────────────────────

/** WCAG AA: body text. */
export const AA_TEXT = 4.5;
/** WCAG AA for large text: the titles (the accent is the heading color when it reaches this). */
export const AA_LARGE = 3;

/**
 * `fg` with its OKLCH lightness moved away from `bg` just enough to reach `min` (hue and chroma kept,
 * the chroma reduced where sRGB can't hold it) — toward whichever end can get there; black or white
 * when neither can.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const { L, C, h } = hexToOklch(fg);
  const darker = relativeLuminance(bg) > 0.18;
  for (const toward of darker ? [0, 1] : [1, 0]) {
    const end = oklchToHex(toward, C, h);
    if (contrastRatio(end, bg) < min) continue;
    // binary search between the color and the end that reaches `min`: the closest that does
    let near = L;
    let far = toward;
    for (let i = 0; i < 24; i++) {
      const mid = (near + far) / 2;
      if (contrastRatio(oklchToHex(mid, C, h), bg) >= min) far = mid;
      else near = mid;
    }
    return oklchToHex(far, C, h);
  }
  return contrastRatio('#000000', bg) >= contrastRatio('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
}

/** The color that reads best on `bg` of two (white and a deep ink, typically). */
const better = (a: string, b: string, bg: string) => (contrastRatio(a, bg) >= contrastRatio(b, bg) ? a : b);

/** The text pairs a palette must keep readable, and how much (hard: text; soft: titles). */
export const TEXT_PAIRS: readonly [fg: keyof Palette, bg: keyof Palette, min: number][] = [
  ['ink', 'bg', AA_TEXT],
  ['inkMuted', 'bg', AA_TEXT],
  ['ink', 'surface', AA_TEXT],
  ['inkMuted', 'surface', AA_TEXT],
  ['accentInk', 'accent', AA_TEXT],
];

/** Every text pair of `palette` at AA (the titles' soft pair — accent on bg — isn't required). */
export function passesAA(palette: Palette): boolean {
  return TEXT_PAIRS.every(([fg, bg, min]) => contrastRatio(palette[fg], palette[bg]) >= min - 0.005);
}

/**
 * Repairs the pairs that fail, changing only `editable` keys (text before its background); the
 * accent is also pushed to 3:1 on the background (titles) when it can be without losing its button
 * text. What two fixed colors of a template do is the template's own.
 */
export function repairPalette(palette: Palette, editable: ReadonlySet<keyof Palette>): Palette {
  const p = { ...palette };
  const fix = (fg: keyof Palette, bg: keyof Palette, min: number) => {
    if (contrastRatio(p[fg], p[bg]) >= min) return;
    if (editable.has(fg)) p[fg] = ensureContrast(p[fg], p[bg], min);
    else if (editable.has(bg)) p[bg] = ensureContrast(p[bg], p[fg], min);
  };
  // the page first (its background may move), then what sits on it
  fix('ink', 'bg', AA_TEXT);
  fix('ink', 'surface', AA_TEXT);
  fix('inkMuted', 'bg', AA_TEXT);
  fix('inkMuted', 'surface', AA_TEXT);
  if (editable.has('accent')) {
    const titled = ensureContrast(p.accent, p.bg, AA_LARGE);
    // the button text must still read on it
    const ink = editable.has('accentInk') ? better('#FFFFFF', p.ink, titled) : p.accentInk;
    if (contrastRatio(ink, titled) >= AA_TEXT) {
      p.accent = titled;
      if (editable.has('accentInk')) p.accentInk = ink;
    }
  }
  if (editable.has('accentInk') && contrastRatio(p.accentInk, p.accent) < AA_TEXT)
    p.accentInk = better('#FFFFFF', better(p.ink, p.bg, p.accent), p.accent);
  fix('accentInk', 'accent', AA_TEXT);
  // a pair the second pass changed (surface moved for inkMuted…): once more, text first
  fix('ink', 'bg', AA_TEXT);
  fix('inkMuted', 'bg', AA_TEXT);
  return p;
}

// ─── the three palettes ──────────────────────────────────────────────────────────────────────────

export type PhotoPaletteId = 'light' | 'dark' | 'tinted';

export interface PhotoPalette {
  id: PhotoPaletteId;
  palette: Palette;
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** The photo's main tone: its largest color (a near-grey picture: its most colorful large one). */
function mainTone(swatches: readonly Swatch[]): Swatch {
  return (
    swatches.find((s) => s.C >= 0.025 && s.share >= 0.12) ??
    swatches.slice().sort((a, b) => b.share * (0.02 + b.C) - a.share * (0.02 + a.C))[0]!
  );
}

/** The photo's accents: its vivid mid-tones, most striking first. */
function accents(swatches: readonly Swatch[]): Swatch[] {
  const score = (s: Swatch) => s.C * Math.sqrt(s.share + 0.02) * (1 - Math.abs(s.L - 0.58));
  return swatches
    .filter((s) => s.C >= 0.035)
    .slice()
    .sort((a, b) => score(b) - score(a));
}

/** Its darkest large tone's hue (the ink and the evening palette lean on it). */
function darkTone(swatches: readonly Swatch[]): Swatch {
  return swatches.slice().sort((a, b) => a.L - b.L + (b.share - a.share) * 0.15)[0]!;
}

const clampC = (c: number, max: number) => Math.min(max, Math.max(0, c));

/** What each option must still be once a design's fixed colors are kept: light paper, an evening. */
const TRUE_TO: Record<PhotoPaletteId, (p: Palette) => boolean> = {
  light: (p) => relativeLuminance(p.bg) > 0.45,
  dark: (p) => relativeLuminance(p.bg) < 0.12,
  tinted: () => true,
};

/** Two options the host couldn't tell apart (every color within a small step). */
const alike = (a: Palette, b: Palette) =>
  (Object.keys(a) as (keyof Palette)[]).every((k) => {
    // the distance in OKLab (≈ 0.02 is the smallest difference an eye tells apart)
    const [x, y] = [rgbToOklab(...hexToRgb(a[k])), rgbToOklab(...hexToRgb(b[k]))];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 0.04;
  });

/**
 * Up to three palettes from a photo's dominant colors — light (paper tinted by its main tone, the
 * ink from its shadows, its most vivid color as the accent), dark (an evening built on its deep
 * tones, the accent lifted) and tinted (paper in its second color, a different accent) — each
 * repaired to AA. `base`: a template's palette and the keys it lets the host change; the others stay
 * as they are — an option those fixed colors rule out (an evening where the cards must stay light) or
 * make the same as another is left out. With every key free, all three.
 */
export function photoPalettes(
  swatches: readonly Swatch[],
  base?: { palette: Palette; editable: readonly (keyof Palette)[] },
): PhotoPalette[] {
  if (!swatches.length) return [];
  const main = mainTone(swatches);
  const dark = darkTone(swatches);
  const vivid = accents(swatches);
  const neutral = main.C < 0.02;
  // the first accent, and a second one of another hue (else the first, turned a little)
  const a1: Lch = vivid[0] ?? { L: 0.5, C: neutral ? 0.05 : Math.max(0.07, main.C), h: main.h };
  const a2: Lch = vivid.find((s) => hueDistance(s.h, a1.h) >= 38) ?? {
    L: a1.L,
    C: a1.C * 0.8,
    h: (a1.h + 42) % 360,
  };
  const hDark = dark.C >= 0.015 ? dark.h : main.h;
  const cMain = neutral ? 0.006 : main.C;

  const light: Palette = {
    bg: oklchToHex(0.972, clampC(cMain * 0.22, 0.014), main.h),
    surface: oklchToHex(0.952, clampC(cMain * 0.35, 0.022), main.h),
    ink: oklchToHex(0.27, clampC(dark.C * 0.8, 0.045), hDark),
    inkMuted: oklchToHex(0.47, clampC(dark.C * 0.6, 0.035), hDark),
    accent: oklchToHex(Math.min(0.56, Math.max(0.38, a1.L)), clampC(a1.C, 0.16), a1.h),
    accentInk: '#FFFFFF',
    line: '#000000',
    heroText: '#FFFFFF',
  };
  const evening: Palette = {
    bg: oklchToHex(0.19, clampC(dark.C * 0.7 + 0.01, 0.035), hDark),
    surface: oklchToHex(0.24, clampC(dark.C * 0.7 + 0.012, 0.04), hDark),
    ink: oklchToHex(0.95, clampC(cMain * 0.25, 0.018), main.h),
    inkMuted: oklchToHex(0.8, clampC(cMain * 0.3, 0.025), main.h),
    accent: oklchToHex(Math.max(0.74, a1.L), clampC(a1.C * 0.9, 0.13), a1.h),
    accentInk: '#000000',
    line: '#000000',
    heroText: '#FFFFFF',
  };
  const tinted: Palette = {
    bg: oklchToHex(0.93, clampC(a2.C * 0.3, 0.04), a2.h),
    surface: oklchToHex(0.965, clampC(a2.C * 0.18, 0.025), a2.h),
    ink: oklchToHex(0.25, clampC(a2.C * 0.35, 0.06), a2.h),
    inkMuted: oklchToHex(0.45, clampC(a2.C * 0.3, 0.05), a2.h),
    accent: oklchToHex(Math.min(0.52, Math.max(0.36, a2.L)), clampC(a2.C, 0.15), a2.h),
    accentInk: '#FFFFFF',
    line: '#000000',
    heroText: '#FFFFFF',
  };

  const all: readonly (keyof Palette)[] = [
    'bg',
    'surface',
    'ink',
    'inkMuted',
    'accent',
    'accentInk',
    'line',
    'heroText',
  ];
  const editable = new Set(base ? base.editable : all);
  const options = (
    [
      ['light', light],
      ['dark', evening],
      ['tinted', tinted],
    ] as const
  ).map(([id, wish]): PhotoPalette => {
    // the template's fixed colors stay; the editable ones come from the photo
    const merged = Object.fromEntries(
      all.map((key) => [key, editable.has(key) || !base ? wish[key] : base.palette[key]]),
    ) as unknown as Palette;
    const repaired = repairPalette(merged, editable);
    // the accent's button text: white or the page's ink, whichever reads better (when it may change)
    if (editable.has('accentInk'))
      repaired.accentInk = better(
        '#FFFFFF',
        better(repaired.ink, repaired.bg, repaired.accent),
        repaired.accent,
      );
    // lines: a quiet mix of the text into the paper
    if (editable.has('line')) repaired.line = mixHex(repaired.ink, repaired.bg, 0.82);
    return { id, palette: repairPalette(repaired, editable) };
  });
  return options
    .filter((o) => TRUE_TO[o.id](o.palette))
    .filter((o, i, kept) => !kept.slice(0, i).some((k) => alike(k.palette, o.palette)));
}

// ─── the scrim a photo needs ─────────────────────────────────────────────────────────────────────

/**
 * How dark the scrim over this picture should be (0.2..0.85) for light text to read on it: from the
 * luminance of the middle of the picture (where the text sits) — its typical tones must reach 4.5:1
 * under white text, its brightest 3:1 (large titles). `rgba`: the picture's pixels, `width` wide.
 */
export function scrimForPhoto(rgba: ArrayLike<number>, width: number): number {
  const height = Math.floor(rgba.length / 4 / width);
  const lum: number[] = [];
  for (let y = Math.floor(height * 0.2); y < Math.ceil(height * 0.8); y++) {
    for (let x = Math.floor(width * 0.1); x < Math.ceil(width * 0.9); x++) {
      const o = (y * width + x) * 4;
      const r = LINEAR[rgba[o]!] ?? 0;
      const g = LINEAR[rgba[o + 1]!] ?? 0;
      const b = LINEAR[rgba[o + 2]!] ?? 0;
      lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }
  if (!lum.length) return 0.42;
  lum.sort((a, b) => a - b);
  const at = (q: number) => lum[Math.min(lum.length - 1, Math.floor(q * lum.length))]!;
  // white on (picture × (1 − a) + a dark scrim × a) ≥ min  ⇔  the mix's luminance ≤ 1.05 / min − 0.05
  const scrimL = 0.005;
  const need = (l: number, min: number) => {
    const target = 1.05 / min - 0.05;
    return l <= target ? 0 : (l - target) / (l - scrimL);
  };
  const a = Math.max(need(at(0.6), AA_TEXT), need(at(0.92), AA_LARGE));
  return Math.round(Math.min(0.85, Math.max(0.2, a)) * 100) / 100;
}

// ─── the browser: a picture's pixels ─────────────────────────────────────────────────────────────

/**
 * A downscaled copy of a picture's pixels (at most `size` on its long side) from a canvas — in the
 * browser only. Throws when the picture can't be read (a server that doesn't allow it: CORS).
 */
export function pixelsOf(
  image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width: number; height: number },
  size = 72,
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const w0 = image.naturalWidth || image.width;
  const h0 = image.naturalHeight || image.height;
  const scale = Math.min(1, size / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('no 2d canvas');
  g.drawImage(image, 0, 0, width, height);
  return { rgba: g.getImageData(0, 0, width, height).data, width, height };
}
