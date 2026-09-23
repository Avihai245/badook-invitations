import type { Palette } from '../contracts/types';

export function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `--inv-heading`: accent when it reaches 3:1 on bg (large display text), otherwise ink (§5 Theming). */
export function headingColor(palette: Pick<Palette, 'accent' | 'bg' | 'ink'>): string {
  return contrastRatio(palette.accent, palette.bg) >= 3 ? palette.accent : palette.ink;
}

const toHex = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/** sRGB mix like CSS `color-mix(in srgb, a (1-t), b t)`. */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`.toUpperCase();
}

/**
 * `--inv-accent-text`: the accent when it is readable as text on bg (≥ 4.5:1), otherwise the accent
 * darkened toward ink just enough to get there. Used for accent-colored text, icons and outline
 * borders (outline buttons, chevrons, pins…). Fills keep the pure accent (§5: accent is safe for fills).
 */
export function readableAccent(palette: Pick<Palette, 'accent' | 'bg' | 'ink'>, min = 4.5): string {
  if (contrastRatio(palette.accent, palette.bg) >= min) return palette.accent;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mixHex(palette.accent, palette.ink, t);
    if (contrastRatio(c, palette.bg) >= min) return c;
  }
  return palette.ink;
}

/** Dark templates (e.g. rooftop-dusk) get no paper grain and light-on-dark form fields. */
export function isDarkPalette(palette: Pick<Palette, 'bg'>): boolean {
  return relativeLuminance(palette.bg) < 0.2;
}
